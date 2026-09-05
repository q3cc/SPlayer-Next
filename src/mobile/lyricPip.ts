import { addPluginListener, invoke } from "@tauri-apps/api/core";
import type { NowPlayingSnapshot } from "@shared/types/nowPlaying";
import type { PlayerStatus } from "@shared/types/player";
import { toast } from "@/composables/useToast";

/** 复用已解析的歌词，仅把当前曲目的行文本交给系统画中画。 */
export const pipContent = (value: NowPlayingSnapshot) => ({
  title: value.track?.title ?? "",
  artist: value.track?.artists.map((artist) => artist.name).join(" / ") ?? "",
  offset: value.lyricOffsetMs,
  lines: value.lyric
    .filter((line) => !line.isBG)
    .map((line) => ({
      start: line.startTime,
      end: line.endTime,
      text: line.words
        .map((word) => word.word)
        .join("")
        .trim(),
      translation: line.translatedLyric,
    }))
    .filter((line) => line.text)
    .sort((a, b) => a.start - b.start),
});

let active = false;
let starting = false;
let revision = 0;
let snapshot: (() => Promise<NowPlayingSnapshot>) | undefined;
let playback: ((playing: boolean) => void) | undefined;
let listenersReady: Promise<unknown> | undefined;
const visibilityListeners = new Set<(open: boolean) => void>();
let pendingAnchor: (PlayerStatus & { timestamp: number }) | undefined;
let syncing = false;

/** 合并尚未发送的进度，原生端阻塞时不积累 IPC 队列。 */
const flushAnchor = async (): Promise<void> => {
  if (syncing) return;
  syncing = true;
  try {
    while (pendingAnchor && (active || starting)) {
      const next = pendingAnchor;
      pendingAnchor = undefined;
      await invoke("plugin:lyric-pip|sync", {
        position: next.position,
        duration: next.duration,
        playing: next.state === "playing",
        speed: next.speed,
        timestamp: next.timestamp,
      });
    }
  } catch (error) {
    console.warn("[lyric-pip] 进度同步失败", error);
  } finally {
    syncing = false;
  }
};

export const mobileLyricPip = {
  configure(
    getSnapshot: () => Promise<NowPlayingSnapshot>,
    onPlayback: (playing: boolean) => void,
  ): void {
    snapshot = getSnapshot;
    playback = onPlayback;
  },
  isOpen: async (): Promise<boolean> => active,
  onVisibility(callback: (open: boolean) => void): () => void {
    visibilityListeners.add(callback);
    return () => visibilityListeners.delete(callback);
  },
  sync(status: PlayerStatus): void {
    if (!active && !starting) return;
    pendingAnchor = { ...status, timestamp: Date.now() };
    void flushAnchor();
  },
  async update(): Promise<void> {
    if ((!active && !starting) || !snapshot) return;
    const token = ++revision;
    const value = await snapshot();
    if (token !== revision || (!active && !starting)) return;
    await invoke("plugin:lyric-pip|update", pipContent(value));
  },
  async close(): Promise<void> {
    await invoke("plugin:lyric-pip|stop");
  },
  async toggle(): Promise<void> {
    if (starting) return;
    if (active) return mobileLyricPip.close();
    starting = true;
    try {
      listenersReady ??= (async () => {
        const visibility = await addPluginListener<{ active: boolean }>(
          "lyric-pip",
          "visibility",
          (event) => {
            active = event.active;
            if (!active) {
              revision++;
              pendingAnchor = undefined;
            }
            visibilityListeners.forEach((listener) => listener(active));
          },
        );
        try {
          await addPluginListener<{ playing: boolean }>("lyric-pip", "playback", (event) => {
            playback?.(event.playing);
          });
        } catch (error) {
          await visibility.unregister();
          throw error;
        }
      })().catch((error: unknown) => {
        listenersReady = undefined;
        throw error;
      });
      await listenersReady;
      await mobileLyricPip.update();
      const value = await snapshot?.();
      if (!value?.track) throw new Error("请先选择并播放一首歌曲，再开启歌词小窗");
      await invoke("plugin:lyric-pip|sync", {
        position: value.position,
        duration: value.track.duration,
        playing: value.playing,
        speed: value.speed,
        timestamp: value.sendTimestamp,
      });
      await invoke("plugin:lyric-pip|start");
    } catch (error) {
      console.warn("[lyric-pip] 开启失败", error);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      starting = false;
    }
  },
};
