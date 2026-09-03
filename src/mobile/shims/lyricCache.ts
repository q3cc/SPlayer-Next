import type { LyricMatchResult } from "@shared/types/lyrics";
import type { Platform } from "@shared/types/platform";

const PREFIX = "splayer.mobile.lyric.";

export const getCachedLyric = (platform: Platform, id: string): LyricMatchResult | null => {
  try {
    const raw = localStorage.getItem(`${PREFIX}${platform}.${id}`);
    return raw ? (JSON.parse(raw) as LyricMatchResult) : null;
  } catch {
    return null;
  }
};

export const setCachedLyric = (platform: Platform, id: string, value: LyricMatchResult): void => {
  localStorage.setItem(`${PREFIX}${platform}.${id}`, JSON.stringify(value));
};

export const clearLyricCache = (): void => {
  for (const key of Object.keys(localStorage))
    if (key.startsWith(PREFIX)) localStorage.removeItem(key);
};
