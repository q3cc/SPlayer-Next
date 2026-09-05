import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricLine } from "@shared/types/lyrics";
import type { Track } from "@shared/types/player";
import { mobileMediaSession } from "./mediaSession";

const config = vi.hoisted(() => ({ enabled: true, dynamic: true }));
vi.mock("./shims/store", () => ({
  store: {
    get: (key: string) => (key === "media.dynamicLyrics" ? config.dynamic : config.enabled),
  },
}));

const track: Track = {
  id: "one",
  source: "netease",
  title: "歌曲标题",
  artists: [{ name: "歌手" }],
  album: { name: "专辑" },
  duration: 5000,
  cover: "https://example.com/cover.jpg",
};
const line: LyricLine = {
  startTime: 1000,
  endTime: 2000,
  words: [{ word: "当前歌词", startTime: 1000, endTime: 2000 }],
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
};

beforeEach(() => {
  config.enabled = true;
  config.dynamic = true;
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: { metadata: null },
  });
  vi.stubGlobal(
    "MediaMetadata",
    class {
      constructor(data: MediaMetadataInit) {
        Object.assign(this, data);
      }
    },
  );
  mobileMediaSession.setTrack(null);
  mobileMediaSession.setTrack(track);
  mobileMediaSession.setLyrics({ track, lyric: [line], source: null }, 0);
});

describe("系统正在播放动态歌词", () => {
  it("有歌词时以歌词为标题，歌曲名与歌手为副标题，保留封面", () => {
    mobileMediaSession.setPosition(1500);
    expect(navigator.mediaSession.metadata).toMatchObject({
      title: "当前歌词",
      artist: "歌曲标题 - 歌手",
      album: "",
      artwork: [{ src: track.cover }],
    });
  });

  it("同一行内不重复创建媒体信息", () => {
    mobileMediaSession.setPosition(1200);
    const metadata = navigator.mediaSession.metadata;
    mobileMediaSession.setPosition(1500);
    expect(navigator.mediaSession.metadata).toBe(metadata);
  });

  it.each([0, 999, 5000, 6000])("前奏或歌词结束满三秒的 %i ms 恢复歌曲信息", (position) => {
    mobileMediaSession.setPosition(1500);
    mobileMediaSession.setPosition(position);
    expect(navigator.mediaSession.metadata).toMatchObject({
      title: "歌曲标题",
      artist: "歌手",
      album: "专辑",
    });
  });

  it.each([2000, 4000, 4999])("歌词结束后三秒内的 %i ms 保留歌词", (position) => {
    mobileMediaSession.setPosition(1500);
    const metadata = navigator.mediaSession.metadata;
    mobileMediaSession.setPosition(position);
    expect(navigator.mediaSession.metadata).toBe(metadata);
    expect(navigator.mediaSession.metadata?.title).toBe("当前歌词");
  });

  it("保留期间新歌词立即替换，长句播放中不恢复歌名", () => {
    mobileMediaSession.setLyrics(
      {
        track,
        lyric: [
          line,
          {
            ...line,
            startTime: 3000,
            endTime: 10000,
            words: [{ word: "下一句歌词", startTime: 3000, endTime: 10000 }],
          },
        ],
        source: null,
      },
      0,
    );
    mobileMediaSession.setPosition(2999);
    expect(navigator.mediaSession.metadata?.title).toBe("当前歌词");
    mobileMediaSession.setPosition(3000);
    expect(navigator.mediaSession.metadata?.title).toBe("下一句歌词");
    mobileMediaSession.setPosition(9000);
    expect(navigator.mediaSession.metadata?.title).toBe("下一句歌词");
    mobileMediaSession.setPosition(13000);
    expect(navigator.mediaSession.metadata?.title).toBe("歌曲标题");
  });

  it("间奏空白行不提前清除歌词，也不延长保留时间", () => {
    mobileMediaSession.setLyrics(
      {
        track,
        lyric: [
          line,
          {
            ...line,
            startTime: 2000,
            endTime: 10000,
            words: [{ word: " ", startTime: 2000, endTime: 10000 }],
          },
        ],
        source: null,
      },
      0,
    );
    mobileMediaSession.setPosition(4000);
    expect(navigator.mediaSession.metadata?.title).toBe("当前歌词");
    mobileMediaSession.setPosition(5000);
    expect(navigator.mediaSession.metadata?.title).toBe("歌曲标题");
  });

  it("开关即时生效，不必重新播放", () => {
    config.dynamic = false;
    mobileMediaSession.setPosition(1500);
    expect(navigator.mediaSession.metadata?.title).toBe("歌曲标题");
    config.dynamic = true;
    mobileMediaSession.refresh();
    expect(navigator.mediaSession.metadata?.title).toBe("当前歌词");
    config.dynamic = false;
    mobileMediaSession.refresh();
    expect(navigator.mediaSession.metadata?.title).toBe("歌曲标题");
  });

  it("使用公共歌词偏移并支持回拖", () => {
    mobileMediaSession.setPosition(500);
    mobileMediaSession.setOffset(track.id, 1000);
    expect(navigator.mediaSession.metadata?.title).toBe("当前歌词");
    mobileMediaSession.setPosition(0);
    mobileMediaSession.setOffset(track.id, 0);
    expect(navigator.mediaSession.metadata?.title).toBe("歌曲标题");
  });

  it("切歌或晚到的上一首歌词不能污染新标题", () => {
    mobileMediaSession.setTrack({ ...track, id: "two", title: "下一首" });
    mobileMediaSession.setLyrics({ track, lyric: [line], source: null }, 0);
    mobileMediaSession.setPosition(1500);
    expect(navigator.mediaSession.metadata?.title).toBe("下一首");
  });

  it("关闭媒体控件或清空播放信息时移除系统元数据", () => {
    config.enabled = false;
    mobileMediaSession.refresh();
    expect(navigator.mediaSession.metadata).toBeNull();
    config.enabled = true;
    mobileMediaSession.refresh();
    mobileMediaSession.setLyrics({ track: null, lyric: [], source: null }, 0);
    expect(navigator.mediaSession.metadata).toBeNull();
  });
});
