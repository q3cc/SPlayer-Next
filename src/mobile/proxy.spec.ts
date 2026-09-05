import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fetchWithProxy } from "./shims/proxy";

const { fetchNative } = vi.hoisted(() => ({ fetchNative: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: fetchNative }));
vi.mock("./shims/store", () => ({ store: { get: () => ({ protocol: "off" }) } }));

describe("移动端登录请求头", () => {
  it("QQ 授权手动跳转保留 302 和 Location", async () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: "https://y.qq.com/?code=test" },
    });
    fetchNative.mockResolvedValueOnce(response);
    expect(
      await fetchWithProxy("https://graph.qq.com/oauth2.0/authorize", { redirect: "manual" }),
    ).toBe(response);
    expect(fetchNative.mock.calls.at(-1)?.[1].maxRedirections).toBe(0);
  });
  it("原生插件必须开启自定义请求头支持", () => {
    const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
    expect(cargo).toMatch(/tauri-plugin-http\s*=\s*\{[^\n]*"unsafe-headers"/);
  });

  it("原生请求必须解压 QM 和网易云主动协商的 gzip/deflate 响应", () => {
    const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
    for (const feature of ["gzip", "deflate"]) {
      expect(cargo).toMatch(new RegExp(`tauri-plugin-http\\s*=\\s*\\{[^\\n]*"${feature}"`));
    }
  });

  it("把公共登录实现的 Cookie、Origin 和 Referer 原样交给原生请求", async () => {
    fetchNative.mockResolvedValueOnce(new Response("{}"));
    await fetchWithProxy("https://music.163.com/weapi/login/qrcode/client/login", {
      method: "POST",
      headers: {
        Cookie: "MUSIC_U=test-only",
        Origin: "https://music.163.com",
        Referer: "https://music.163.com/",
      },
    });
    const headers = fetchNative.mock.calls.at(-1)?.[1].headers as Headers;
    expect(headers.get("Cookie")).toBe("MUSIC_U=test-only");
    expect(headers.get("Origin")).toBe("https://music.163.com");
    expect(headers.get("Referer")).toBe("https://music.163.com/");
  });

  it("未指定 Origin 的原生 API 不携带 tauri 应用地址", async () => {
    fetchNative.mockResolvedValueOnce(new Response("{}"));
    await fetchWithProxy("https://music.163.com/api/test");
    const headers = fetchNative.mock.calls.at(-1)?.[1].headers as Headers;
    expect(headers.get("Origin")).toBe("");
  });
});
