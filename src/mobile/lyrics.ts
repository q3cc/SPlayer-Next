import * as netease from "@main/apis/common/lyric/netease";
import * as qqmusic from "@main/apis/common/lyric/qqmusic";
import * as kugou from "@main/apis/common/lyric/kugou";
import { fetchTTML } from "@main/apis/common/lyric/ttml";
import type { LyricsApi, LyricMatchResponse } from "@shared/types/lyrics";
import type { Platform } from "@shared/types/platform";
import type { Track } from "@shared/types/player";

const byId = async (platform: Platform, id: string): Promise<LyricMatchResponse> => {
  try {
    if (platform === "netease") return { ok: true, data: await netease.getByPlatformId(id) };
    if (platform === "qqmusic") return { ok: true, data: await qqmusic.getByPlatformId(id) };
    if (platform === "kugou") return { ok: true, data: await kugou.getByPlatformId(id) };
    return { ok: false, error: `unsupported platform: ${platform}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const byQuery = async (platform: Platform, track: Track): Promise<LyricMatchResponse> => {
  try {
    if (platform === "netease") return { ok: true, data: await netease.getByQuery(track) };
    if (platform === "qqmusic") return { ok: true, data: await qqmusic.getByQuery(track) };
    if (platform === "kugou") return { ok: true, data: await kugou.getByQuery(track) };
    return { ok: false, error: `unsupported platform: ${platform}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const mobileLyrics: LyricsApi = {
  matchById: byId,
  matchByQuery: byQuery,
  fetchTTMLOverlay: async (track, platform) => {
    try {
      const ids = [platform === "qqmusic" ? track.extId : track.id, track.id].filter(
        (id): id is string => Boolean(id),
      );
      return { ok: true, data: await fetchTTML(platform, [...new Set(ids)]) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  matchLocalTTML: async () => ({ ok: true, data: null }),
  pickLyricRepoDir: async () => null,
};
