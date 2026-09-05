import type { NowPlayingUpdatePayload } from "@shared/types/nowPlaying";
import type { Track } from "@shared/types/player";
import { findLyricIndex } from "@shared/utils/lyric";
import { store } from "./shims/store";

let track: Track | null = null;
let lyrics: NowPlayingUpdatePayload | null = null;
let position = 0;
let offset = 0;
let lastMetadata: { title: string; artist: string; album: string; cover: string } | null = null;

/** 复用公共解析结果与音频时间事件，只在显示内容变化时更新系统卡片。 */
const refresh = (): void => {
  if (!("mediaSession" in navigator)) return;
  if (!track || !store.get("media.systemMediaControls")) {
    navigator.mediaSession.metadata = null;
    lastMetadata = null;
    return;
  }
  const artist = track.artists.map((item) => item.name).join(" / ");
  let lyric = "";
  if (
    store.get("media.dynamicLyrics") &&
    lyrics?.track?.id === track.id &&
    lyrics.track.source === track.source
  ) {
    const time = position + offset;
    let index = findLyricIndex(lyrics.lyric, time);
    // 空白行与背景行不打断主歌词的短暂保留。
    while (
      index >= 0 &&
      (lyrics.lyric[index].isBG || !lyrics.lyric[index].words.some((word) => word.word.trim()))
    )
      index--;
    const line = lyrics.lyric[index];
    if (line && time >= line.startTime && time < line.endTime + 3000) {
      lyric = line.words
        .map((word) => word.word)
        .join("")
        .trim();
    }
  }
  const next = {
    title: lyric || track.title,
    artist: lyric ? [track.title, artist].filter(Boolean).join(" - ") : artist,
    album: lyric ? "" : (track.album?.name ?? ""),
    cover: track.cover ?? "",
  };
  if (
    lastMetadata?.title === next.title &&
    lastMetadata.artist === next.artist &&
    lastMetadata.album === next.album &&
    lastMetadata.cover === next.cover
  )
    return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: next.title,
    artist: next.artist,
    album: next.album,
    artwork: next.cover ? [{ src: next.cover }] : [],
  });
  lastMetadata = next;
};

export const mobileMediaSession = {
  refresh,
  setTrack(value: Track | null): void {
    track = value;
    position = 0;
    if (!value || lyrics?.track?.id !== value.id || lyrics.track.source !== value.source) {
      lyrics = null;
      offset = 0;
    }
    refresh();
  },
  setLyrics(value: NowPlayingUpdatePayload, offsetMs: number): void {
    lyrics = value.track ? value : null;
    if (!value.track) track = null;
    offset = offsetMs;
    refresh();
  },
  setOffset(trackId: string, value: number): void {
    if (track?.id !== trackId) return;
    offset = value;
    refresh();
  },
  setPosition(value: number): void {
    position = value;
    refresh();
  },
};
