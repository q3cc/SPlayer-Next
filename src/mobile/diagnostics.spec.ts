import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { diagnosticText, setDiagnosticsEnabled } from "./diagnostics";
import { defaultSystemConfig } from "@shared/defaults/settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("诊断日志脱敏", () => {
  it("日志位于共享文稿目录，文件共享配置同时开启", () => {
    const native = readFileSync("src-tauri/src/diagnostics.rs", "utf8");
    const plist = readFileSync("src-tauri/Info.ios.plist", "utf8");
    expect(native).toContain('.join("Documents/logs")');
    for (const key of ["UIFileSharingEnabled", "LSSupportsOpeningDocumentsInPlace"]) {
      expect(plist).toMatch(new RegExp(`<key>${key}</key>\\s*<true\\s*/>`));
    }
  });

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
    "https://ssl.ptlogin2.graph.qq.com/check_sig?ptsigx=private-value&uin=123",
    '{"musickey":"private-value"}',
    "qrsig=private-value",
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

describe("日志开关", () => {
  afterEach(async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await setDiagnosticsEnabled(false);
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("默认关闭，原生启动只记时间而不创建文件", () => {
    expect(defaultSystemConfig.system.diagnosticLogging).toBe(false);
    const native = readFileSync("src-tauri/src/diagnostics.rs", "utf8");
    const init = native.split("pub fn init()")[1].split("#[tauri::command]")[0];
    expect(init).not.toMatch(/create_dir|OpenOptions|dup2/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("开启后脱敏写入，关闭后恢复控制台且不再发送日志", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    const original = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(invoke).mockResolvedValue("logs/test.log");
    await setDiagnosticsEnabled(true);
    console.log("MUSIC_U=private-value");
    await vi.waitFor(() => {
      const calls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "append_diagnostic_log");
      expect(JSON.stringify(calls)).toContain("[REDACTED]");
      expect(JSON.stringify(calls)).not.toContain("private-value");
    });
    await setDiagnosticsEnabled(false);
    expect(console.log).toBe(original);
    vi.mocked(invoke).mockClear();
    console.log("after-disable");
    window.dispatchEvent(new ErrorEvent("error", { message: "after-disable" }));
    await Promise.resolve();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("快速开关按顺序完成，重复开启不叠加包装", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.mocked(invoke).mockResolvedValue("logs/test.log");
    const original = console.log;
    await Promise.all([
      setDiagnosticsEnabled(true),
      setDiagnosticsEnabled(false),
      setDiagnosticsEnabled(true),
    ]);
    const wrapped = console.log;
    await setDiagnosticsEnabled(true);
    expect(console.log).toBe(wrapped);
    await setDiagnosticsEnabled(false);
    expect(console.log).toBe(original);
    expect(
      vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "set_diagnostic_logging")
        .map(([, args]) => args),
    ).toEqual([
      { enabled: true },
      { enabled: false },
      { enabled: true },
      { enabled: true },
      { enabled: false },
    ]);
  });

  it("原生开启失败时不包装控制台，后续仍可关闭", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    const original = console.log;
    vi.mocked(invoke).mockRejectedValueOnce(new Error("disk full"));
    await expect(setDiagnosticsEnabled(true)).rejects.toThrow("disk full");
    expect(console.log).toBe(original);
    vi.mocked(invoke).mockResolvedValue(undefined);
    await expect(setDiagnosticsEnabled(false)).resolves.toBeUndefined();
  });
});
