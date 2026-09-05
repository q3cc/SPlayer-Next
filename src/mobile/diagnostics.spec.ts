import { describe, expect, it, vi } from "vitest";
import { diagnosticText } from "./diagnostics";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("临时诊断日志脱敏", () => {
  it("保留登录状态与凭据存在标志，隐藏对象中的凭据值", () => {
    const output = diagnosticText({
      code: 803,
      hasUserCredential: true,
      nested: { MUSIC_U: "user-secret", cookie: "cookie-secret", accessToken: "token-secret" },
    });
    expect(output).toContain('"code":803');
    expect(output).toContain('"hasUserCredential":true');
    for (const secret of ["user-secret", "cookie-secret", "token-secret"])
      expect(output).not.toContain(secret);
  });

  it.each([
    "Cookie: MUSIC_U=private-value; other=value",
    "https://music.163.com/?codekey=private-value&foo=bar",
    '{"MUSIC_U":"private-value"}',
    "Authorization: Bearer private-value",
  ])("隐藏字符串内的凭据：%s", (value) => {
    expect(diagnosticText(value)).not.toContain("private-value");
    expect(diagnosticText(new Error(value))).not.toContain("private-value");
  });

  it("循环对象和长消息不会造成日志无限增长", () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(diagnosticText(value)).toContain("[Circular]");
    expect(diagnosticText("x".repeat(20000))).toHaveLength(12000);
  });
});
