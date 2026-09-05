import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getSessionCookies, clearSessionCookies, saveSessionCookies } from "./shims/sessions";

const { nativeFetch } = vi.hoisted(() => ({ nativeFetch: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: nativeFetch }));
vi.mock("@main/utils/proxy", () => import("./shims/proxy"));
vi.mock("@main/database/sessions", () => import("./shims/sessions"));
vi.mock("@main/store", () => import("./shims/store"));
vi.mock("@main/utils/logger", () => ({
  coreLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  nativeFetch.mockReset();
});

describe("QM/KG 移动端登录流程", () => {
  it("QQ 二维码走原生请求并读取 qrsig", async () => {
    const { login_qr_key } = await import("../../electron/main/apis/qqmusic/modules/login_qr");
    const qrResponse = new Response("png");
    Object.defineProperty(qrResponse, "headers", {
      value: new Headers({ "Set-Cookie": "other=x; Path=/, qrsig=qr-test; Path=/; HttpOnly" }),
    });
    nativeFetch.mockResolvedValueOnce(qrResponse);
    const result = await login_qr_key({});
    expect(result).toMatchObject({
      key: "qr-test",
      content: expect.stringMatching(/^data:image\/png;base64,/),
    });
    expect(nativeFetch.mock.calls[0][0]).toContain("ssl.ptlogin2.qq.com/ptqrshow");
  });

  it("QQ 授权保留手动跳转，交换并保存音乐凭据", async () => {
    const { login_qr_check } = await import("../../electron/main/apis/qqmusic/modules/login_qr");
    const { clearQQMusicCookies } = await import("../../electron/main/apis/qqmusic/core/request");
    clearQQMusicCookies();
    const checkResponse = new Response(null, { status: 302 });
    Object.defineProperty(checkResponse, "headers", {
      value: new Headers({
        "Set-Cookie": "p_skey=ps-test; Path=/",
        Location: "https://graph.qq.com/",
      }),
    });
    nativeFetch
      .mockResolvedValueOnce(
        new Response(
          "ptuiCB('0','0','https://ssl.ptlogin2.qq.com/check_sig?uin=123&x=1','0','OK','tester');",
        ),
      )
      .mockResolvedValueOnce(checkResponse)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "https://y.qq.com/?code=auth-test" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          code: 0,
          request: {
            code: 0,
            data: { musickey: "music-test", str_musicid: "123", refresh_key: "refresh-test" },
          },
        }),
      );
    const result = await login_qr_check({ key: "qr-test" });
    expect(result).toMatchObject({ status: 4 });
    expect(nativeFetch.mock.calls[1][1].maxRedirections).toBe(0);
    expect(nativeFetch.mock.calls[2][1].maxRedirections).toBe(0);
    expect(getSessionCookies("qqmusic")).toMatchObject({
      uin: "123",
      qm_keyst: "music-test",
      qm_refresh_key: "refresh-test",
    });
    clearQQMusicCookies();
    expect(getSessionCookies("qqmusic")).toEqual({});
  });

  it("微信二维码生成走两次原生请求", async () => {
    const { login_qr_key } = await import("../../electron/main/apis/qqmusic/modules/login_qr");
    nativeFetch
      .mockResolvedValueOnce(new Response('<img src="/connect/qrcode/?uuid=wx-test">'))
      .mockResolvedValueOnce(new Response("image"));
    expect(await login_qr_key({ type: "wx" })).toMatchObject({ key: "wx-test" });
    expect(nativeFetch).toHaveBeenCalledTimes(2);
  });

  it("酷狗二维码、等待、授权与持久化使用同一实现", async () => {
    const { loginQrKey, loginQrCheck } =
      await import("../../electron/main/apis/kugou/modules/login_qr");
    nativeFetch.mockResolvedValueOnce(Response.json({ data: { qrcode: "kg-qr" } }));
    expect(await loginQrKey({})).toMatchObject({ key: "kg-qr" });
    nativeFetch.mockResolvedValueOnce(Response.json({ data: { status: 2 } }));
    expect(await loginQrCheck({ key: "kg-qr" })).toMatchObject({ status: 2 });
    expect(getSessionCookies("kugou")).toEqual({});
    nativeFetch.mockResolvedValueOnce(
      Response.json({ data: { status: 4, token: "kg-token", userid: 456, username: "KG tester" } }),
    );
    expect(await loginQrCheck({ key: "kg-qr" })).toMatchObject({ status: 4 });
    expect(getSessionCookies("kugou")).toMatchObject({ token: "kg-token", userid: "456" });
    clearSessionCookies("kugou");
    expect(getSessionCookies("kugou")).toEqual({});
  });

  it("酷狗授权缺凭据时不覆盖原登录态", async () => {
    const { loginQrCheck } = await import("../../electron/main/apis/kugou/modules/login_qr");
    saveSessionCookies("kugou", { token: "existing", userid: "1" });
    nativeFetch.mockResolvedValueOnce(Response.json({ data: { status: 4 } }));
    await expect(loginQrCheck({ key: "kg-qr" })).rejects.toThrow("token");
    expect(getSessionCookies("kugou").token).toBe("existing");
  });

  it("重新加载会话模块能恢复两个平台，损坏数据不产生假登录", async () => {
    for (const platform of ["qqmusic", "kugou"] as const)
      saveSessionCookies(platform, { token: platform });
    vi.resetModules();
    const fresh = await import("./shims/sessions");
    expect(fresh.getSessionCookies("qqmusic").token).toBe("qqmusic");
    expect(fresh.getSessionCookies("kugou").token).toBe("kugou");
    for (const raw of ["null", "[]", "invalid", "123"]) {
      localStorage.setItem("splayer.mobile.session.kugou", raw);
      expect(fresh.getSessionCookies("kugou")).toEqual({});
    }
  });

  it("平台实现无 WebView 直连或不支持的 Node UUID 调用", () => {
    for (const path of [
      "qqmusic/modules/login_qr.ts",
      "qqmusic/modules/song_list.ts",
      "qqmusic/modules/song_url.ts",
      "qqmusic/core/request.ts",
      "kugou/modules/login_qr.ts",
      "kugou/core/request.ts",
      "kugou/core/device.ts",
    ]) {
      const text = readFileSync(`electron/main/apis/${path}`, "utf8");
      expect(text).not.toMatch(/\bfetch\(/);
      expect(text).not.toMatch(/import.*randomUUID.*node:crypto/);
    }
  });
});
