import { expect, it, vi } from "vitest";

const { sync } = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("./nativePlayer", () => ({ createNativePlayer: () => ({}) }));
vi.mock("./library", () => ({ resolveMobileAudioSource: (source: string) => source }));
vi.mock("./mediaSession", () => ({ mobileMediaSession: {} }));
vi.mock("./lyricPip", () => ({ mobileLyricPip: { sync } }));

it("iOS 回到前台时，未使用的 Web 播放器不覆盖原生歌词小窗状态", async () => {
  await import("./player");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(sync).not.toHaveBeenCalled();
});
