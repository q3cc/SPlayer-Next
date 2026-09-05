import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";

const invoke = vi.fn();

const response = (status = 200) => ({
  status,
  statusText: "OK",
  url: "https://music.163.com/test",
  headers: [["set-cookie", "MUSIC_U=test-only"]],
  rid: 2,
});
const calls = (command: string) => invoke.mock.calls.filter(([name]) => name === command);

beforeEach(() => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: { invoke } });
  invoke.mockReset();
  let bodyRead = false;
  invoke.mockImplementation(async (command: string) => {
    if (command === "plugin:http|fetch") return 1;
    if (command === "plugin:http|fetch_send") return response();
    if (command === "plugin:http|fetch_read_body") {
      if (bodyRead) return [1];
      bodyRead = true;
      return [...new TextEncoder().encode("ok"), 0];
    }
    return undefined;
  });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
});

describe("原生 HTTP 取消生命周期", () => {
  it("响应读完后即使八秒超时触发也不重复取消，保留授权响应头", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const result = await fetch("https://music.163.com/test", { signal: controller.signal });
    expect(result.headers.get("set-cookie")).toContain("MUSIC_U=test-only");
    expect(await result.text()).toBe("ok");
    await vi.advanceTimersByTimeAsync(8000);
    expect(calls("plugin:http|fetch_cancel")).toHaveLength(0);
    expect(calls("plugin:http|fetch_cancel_body")).toHaveLength(0);
  });

  it("请求失败后解绑取消监听器", async () => {
    const controller = new AbortController();
    invoke.mockImplementation(async (command: string) => {
      if (command === "plugin:http|fetch") return 1;
      throw new Error("network failed");
    });
    await expect(
      fetch("https://music.163.com/test", { signal: controller.signal }),
    ).rejects.toThrow("network failed");
    controller.abort();
    expect(calls("plugin:http|fetch_cancel")).toHaveLength(0);
  });

  it("仍在等待响应时主动取消请求一次", async () => {
    const controller = new AbortController();
    let rejectSend!: (reason: Error) => void;
    invoke.mockImplementation(async (command: string) => {
      if (command === "plugin:http|fetch") return 1;
      if (command === "plugin:http|fetch_send")
        return new Promise((_, reject) => {
          rejectSend = reject;
        });
      if (command === "plugin:http|fetch_cancel") rejectSend(new Error("cancelled"));
      return undefined;
    });
    const result = fetch("https://music.163.com/test", { signal: controller.signal });
    const failed = expect(result).rejects.toThrow("cancelled");
    await vi.waitFor(() => expect(calls("plugin:http|fetch_send")).toHaveLength(1));
    controller.abort();
    await failed;
    expect(calls("plugin:http|fetch_cancel")).toHaveLength(1);
    expect(calls("plugin:http|fetch_cancel_body")).toHaveLength(0);
  });

  it.each(["abort", "cancel"])("读取响应中 %s 只清理响应体，容忍与原生释放竞态", async (mode) => {
    const controller = new AbortController();
    let rejectRead!: (reason: Error) => void;
    invoke.mockImplementation(async (command: string) => {
      if (command === "plugin:http|fetch") return 1;
      if (command === "plugin:http|fetch_send") return response();
      if (command === "plugin:http|fetch_read_body")
        return new Promise((_, reject) => {
          rejectRead = reject;
        });
      if (command === "plugin:http|fetch_cancel_body") throw new Error("resource already released");
      return undefined;
    });
    const result = await fetch("https://music.163.com/test", { signal: controller.signal });
    const reader = result.body!.getReader();
    const read = reader.read();
    if (mode === "abort") {
      const failed = expect(read).rejects.toBe("Request cancelled");
      controller.abort();
      await failed;
    } else {
      await reader.cancel();
      await read;
      controller.abort();
    }
    rejectRead(new Error("late read failure"));
    await Promise.resolve();
    expect(calls("plugin:http|fetch_cancel")).toHaveLength(0);
    expect(calls("plugin:http|fetch_cancel_body")).toHaveLength(1);
  });

  it("无响应体的状态码立即释放资源，之后超时不再取消", async () => {
    const controller = new AbortController();
    invoke.mockImplementation(async (command: string) => {
      if (command === "plugin:http|fetch") return 1;
      if (command === "plugin:http|fetch_send") return response(204);
      return undefined;
    });
    const result = await fetch("https://music.163.com/test", { signal: controller.signal });
    expect(result.body).toBeNull();
    controller.abort();
    expect(calls("plugin:http|fetch_cancel")).toHaveLength(0);
    expect(calls("plugin:http|fetch_cancel_body")).toHaveLength(1);
  });
});
