export type Platform = "netease" | "qqmusic";

const PREFIX = "splayer.mobile.ttml.";

export const getCachedTTML = (platform: Platform, id: string): string | null | "miss" => {
  const raw = localStorage.getItem(`${PREFIX}${platform}.${id}`);
  if (raw == null) return "miss";
  return raw === "__none__" ? null : raw;
};

export const setCachedTTML = (platform: Platform, id: string, content: string | null): void => {
  localStorage.setItem(`${PREFIX}${platform}.${id}`, content ?? "__none__");
};

export const clearLyricTtmlCache = (): void => {
  for (const key of Object.keys(localStorage))
    if (key.startsWith(PREFIX)) localStorage.removeItem(key);
};
