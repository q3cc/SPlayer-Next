import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NowPlayingSnapshot } from "@shared/types/nowPlaying";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn(),
  error: vi.fn(),
  events: new Map<string, (event: { active?: boolean; playing?: boolean }) => void>(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  addPluginListener: mocks.addListener,
}));
vi.mock("@/composables/useToast", () => ({ toast: { error: mocks.error } }));

const value = {
  track: { id: "one", title: "歌曲", artists: [{ name: "歌手" }], duration: 60000 },
  lyric: [
    {
      startTime: 1000,
      endTime: 3000,
      words: [{ word: "第一句" }],
      translatedLyric: "翻译",
      isBG: false,
    },
    { startTime: 2000, endTime: 3000, words: [{ word: "和声" }], translatedLyric: "", isBG: true },
    { startTime: 5000, endTime: 6000, words: [{ word: "  " }], translatedLyric: "", isBG: false },
  ],
  lyricOffsetMs: 250,
  position: 1500,
  playing: true,
  state: "playing",
  speed: 1,
  sendTimestamp: 12345,
} as NowPlayingSnapshot;

beforeEach(() => {
  vi.resetModules();
  mocks.invoke.mockReset().mockResolvedValue(undefined);
  mocks.events.clear();
  mocks.addListener.mockImplementation(async (_plugin, event, callback) => {
    mocks.events.set(event, callback);
    return { unregister: vi.fn() };
  });
});

describe("歌词画中画", () => {
  it("复用解析结果和翻译，不发送背景行、空行及逐字数据", async () => {
    const { pipContent } = await import("./lyricPip");
    expect(pipContent(value)).toEqual({
      title: "歌曲",
      artist: "歌手",
      offset: 250,
      lines: [{ start: 1000, end: 3000, text: "第一句", translation: "翻译" }],
    });
  });

  it("关闭时不拉快照、不发送歌词和进度", async () => {
    const { mobileLyricPip: pip } = await import("./lyricPip");
    const snapshot = vi.fn().mockResolvedValue(value);
    pip.configure(snapshot, vi.fn());
    await pip.update();
    pip.sync({
      state: "playing",
      position: 1000,
      duration: 60000,
      speed: 1,
      volume: 1,
      isFinished: false,
    });
    expect(snapshot).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("启动前发送歌词和锚点，只根据系统回调更新开关，关闭不停止音乐", async () => {
    const { mobileLyricPip: pip } = await import("./lyricPip");
    const playback = vi.fn();
    const visibility = vi.fn();
    pip.configure(async () => value, playback);
    const off = pip.onVisibility(visibility);
    await pip.toggle();
    expect(mocks.invoke.mock.calls.map((args) => args[0])).toEqual([
      "plugin:lyric-pip|update",
      "plugin:lyric-pip|sync",
      "plugin:lyric-pip|start",
    ]);
    expect(await pip.isOpen()).toBe(false);
    mocks.events.get("visibility")?.({ active: true });
    expect(await pip.isOpen()).toBe(true);
    mocks.events.get("playback")?.({ playing: false });
    expect(playback).toHaveBeenCalledWith(false);
    playback.mockClear();
    await pip.toggle();
    expect(mocks.invoke).toHaveBeenLastCalledWith("plugin:lyric-pip|stop");
    mocks.events.get("visibility")?.({ active: false });
    expect(playback).not.toHaveBeenCalled();
    expect(visibility).toHaveBeenLastCalledWith(false);
    off();
  });

  it("启动失败显示原因，不把开关伪装成已开启", async () => {
    const { mobileLyricPip: pip } = await import("./lyricPip");
    pip.configure(async () => value, vi.fn());
    mocks.invoke.mockImplementation(async (command) => {
      if (command.endsWith("|start")) throw new Error("设备不支持画中画");
    });
    await pip.toggle();
    expect(mocks.error).toHaveBeenCalledWith("设备不支持画中画");
    expect(await pip.isOpen()).toBe(false);
  });
});
