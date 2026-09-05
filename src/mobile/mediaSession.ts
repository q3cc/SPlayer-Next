import type { NowPlayingUpdatePayload } from "@shared/types/nowPlaying";
import type { Track } from "@shared/types/player";
import { findLyricIndex } from "@shared/utils/lyric";
import { store } from "./shims/store";

let track: Track | null = null;
let lyrics: NowPlayingUpdatePayload | null = null;
let position = 0;
let offset = 0;
let lastMetadata: { title: string; artist: string; album: string; cover: string } | null = null;
let artworkKey = "";
let artworkCover = "";
let artworkSize = "";
let pendingArtwork: HTMLImageElement | null = null;

/** 只保留当前歌曲的一次高清封面加载，切歌后释放旧图片请求。 */
const clearArtwork = (): void => {
  if (pendingArtwork) {
    pendingArtwork.onload = null;
    pendingArtwork.onerror = null;
    pendingArtwork.src = "";
    pendingArtwork = null;
  }
  artworkKey = "";
  artworkCover = "";
  artworkSize = "";
};

/** 复用曲目的原图地址，网易云使用 CDN 的 600 像素版本，失败仍显示原缩略图。 */
const prepareArtwork = (value: Track): void => {
  let candidate = value.coverOriginal || value.cover || "";
  if (value.source === "netease" && candidate) {
    try {
      const url = new URL(candidate);
      if (/^https?:$/.test(url.protocol) && /(^|\.)music\.126\.net$/.test(url.hostname)) {
        url.searchParams.set("param", "600y600");
        candidate = url.href;
      }
    } catch {
      // 非远程封面继续使用原始地址，不猜测服务端的缩放参数。
    }
  }
  const key = JSON.stringify([value.source, value.id, value.cover, candidate]);
  if (key === artworkKey) return;
  clearArtwork();
  artworkKey = key;
  artworkCover = value.cover || "";
  if (!candidate || candidate === artworkCover) return;
  const image = new Image();
  pendingArtwork = image;
  image.decoding = "async";
  image.onload = () => {
    if (pendingArtwork !== image) return;
    artworkCover = candidate;
    artworkSize = `${image.naturalWidth}x${image.naturalHeight}`;
    image.onload = null;
    image.onerror = null;
    pendingArtwork = null;
    refresh();
  };
  image.onerror = () => {
    if (pendingArtwork !== image) return;
    image.onload = null;
    image.onerror = null;
    pendingArtwork = null;
    console.warn("[media-session] 高清封面加载失败，保留缩略图");
  };
  image.src = candidate;
};

/** 复用公共解析结果与音频时间事件，只在显示内容变化时更新系统卡片。 */
const refresh = (): void => {
  if (!("mediaSession" in navigator)) return;
  if (!track || !store.get("media.systemMediaControls")) {
    clearArtwork();
    navigator.mediaSession.metadata = null;
    lastMetadata = null;
    return;
  }
  prepareArtwork(track);
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
    cover: artworkCover,
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
    artwork: next.cover
      ? [{ src: next.cover, ...(artworkSize ? { sizes: artworkSize } : {}) }]
      : [],
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
