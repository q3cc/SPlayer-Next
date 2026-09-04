import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Query } from "../core/option";
import type { RequestFn } from "../core/types";
import loginQrCheck from "./login_qr_check";
import loginQrCreate from "./login_qr_create";
import loginQrKey from "./login_qr_key";

describe("网易云网页扫码登录", () => {
  it("使用网页模式申请二维码 key 并保留浏览器 cookie", async () => {
    let captured:
      | { data: Record<string, unknown>; headers?: Record<string, string>; cookie?: string }
      | undefined;
    const request = (async (_uri, data, options) => {
      captured = { data, headers: options.headers, cookie: options.rawCookie };
      return { status: 200, body: { code: 200, unikey: "test-key" }, cookie: ["key=value"] };
    }) as RequestFn;

    const result = await loginQrKey({ cookie: {} } satisfies Query, request);

    assert.equal(captured?.data.type, 1);
    assert.equal(captured?.headers?.["x-os"], "web");
    assert.match(captured?.cookie ?? "", /JSESSIONID-WYYY=/);
    assert.ok(result.cookie.some((item) => item === "key=value"));
  });

  it("创建与轮询复用同一个 chainId", async () => {
    const created = await loginQrCreate({ key: "test-key", cookie: {} }, {} as RequestFn);
    const qrurl = String((created.body.data as { qrurl: string }).qrurl);
    const chainId = new URL(qrurl).searchParams.get("chainId");
    let checkChainId = "";
    const request = (async (_uri, data, options) => {
      checkChainId = options.headers?.["x-login-chain-id"] ?? "";
      assert.equal(data.type, 1);
      return { status: 200, body: { code: 801 }, cookie: [] };
    }) as RequestFn;

    const checked = await loginQrCheck({ key: "test-key", cookie: {} }, request);

    assert.equal(checkChainId, chainId);
    assert.equal(checked.body.code, 801);
    assert.match(String(checked.body.cookie), /JSESSIONID-WYYY=/);
  });
});
