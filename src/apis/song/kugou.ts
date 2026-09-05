import type { Track } from "@shared/types/player";
import { ErrorCode } from "@shared/types/errors";
import { getQualityLevel, type QualityLevel } from "@/utils/quality";
import { kugouCall } from "@/apis/kugou";

export type KugouPlayUrlResult =
  { available: true; url: string; isTrial: boolean } | { available: false; errorCode: ErrorCode };

interface SongUrlResponse {
  code: number;
  data?: { url?: string; isTrial?: boolean };
}

const QUALITY_ORDER: QualityLevel[] = ["lq", "sq", "hq", "lossless", "hi-res"];

const clampQuality = (requested: QualityLevel, track: Track): QualityLevel => {
  const available = getQualityLevel(track.quality);
  return QUALITY_ORDER[
    Math.min(QUALITY_ORDER.indexOf(requested), QUALITY_ORDER.indexOf(available))
  ];
};

export const resolveKugouUrl = async (
  track: Track,
  level: QualityLevel,
  allowTrial = false,
): Promise<KugouPlayUrlResult> => {
  // 所有完整音质均不可用后才请求试听；下载调用默认不进入试听分支。
  for (const freePart of allowTrial ? [false, true] : [false]) {
    try {
      const result = await kugouCall<SongUrlResponse>("song_url", {
        hash: track.id,
        audioId: track.extId,
        albumId: track.album?.id,
        level: clampQuality(level, track),
        freePart,
      });
      if (result.code === 200 && result.data?.url) {
        return {
          available: true,
          url: result.data.url,
          isTrial: freePart || result.data.isTrial === true,
        };
      }
    } catch (error) {
      console.warn("[kugou] resolve URL failed:", { freePart }, error);
    }
  }
  return { available: false, errorCode: ErrorCode.URL_RESOLVE_FAILED };
};
