import { describe, expect, it, vi } from "vitest";
import { mobileLibrary, resolveMobileAudioSource } from "./library";

const { open } = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (path: string) => `asset:${path}` }));

describe("移动端系统目录选择", () => {
  it("复用目录选择接口并导入持久副本", async () => {
    open.mockResolvedValueOnce("file:///Documents/Imported%20Music/test/music");
    const result = await mobileLibrary.addScanDir();
    expect(result.success).toBe(true);
    expect(open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      recursive: true,
      fileAccessMode: "copy",
    });
    expect((await mobileLibrary.getScanDirs()).data).toContain(result.data);
  });

  it("取消选择时不添加目录", async () => {
    open.mockResolvedValueOnce(null);
    expect(await mobileLibrary.addScanDir()).toEqual({ success: false, error: "canceled" });
  });

  it("将原生错误交给共用界面显示，不让点击悄悄失效", async () => {
    open.mockRejectedValueOnce("native picker failed");
    expect(await mobileLibrary.addScanDir()).toEqual({
      success: false,
      error: "native picker failed",
    });
  });

  it("通过应用资源协议播放系统目录返回的本地文件", () => {
    expect(resolveMobileAudioSource("file:///Documents/Imported%20Music/test/a.mp3")).toBe(
      "asset:/Documents/Imported Music/test/a.mp3",
    );
    expect(resolveMobileAudioSource("https://example.com/a.mp3")).toBe("https://example.com/a.mp3");
  });
});
