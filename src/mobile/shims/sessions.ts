import type { Platform } from "@shared/types/platform";

const keyFor = (platform: Platform): string => `splayer.mobile.session.${platform}`;

export const getSessionCookies = (platform: Platform): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(keyFor(platform)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

export const saveSessionCookies = (platform: Platform, cookies: Record<string, string>): void => {
  localStorage.setItem(keyFor(platform), JSON.stringify(cookies));
};

export const clearSessionCookies = (platform: Platform): void => {
  localStorage.removeItem(keyFor(platform));
};
