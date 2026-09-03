import type { ApiCallResponse, ApiPlatform, ApisApi } from "@shared/types/apis";
import { callNetease, clearNeteaseCookies, mergeNeteaseCookies } from "@main/apis/netease";
import { NeteaseRequestError } from "@main/apis/netease/core/request";
import { callQQMusic, clearQQMusicCookies, mergeQQMusicCookies } from "@main/apis/qqmusic";
import { callKugou, clearKugouSession, mergeKugouSession } from "@main/apis/kugou";

const parseCookie = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    result[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return result;
};

const call = async (
  platform: ApiPlatform,
  name: string,
  params: Record<string, unknown> = {},
): Promise<ApiCallResponse> => {
  try {
    if (platform === "netease") {
      const response = await callNetease(name, params);
      return { ok: true, status: response.status, body: response.body };
    }
    if (platform === "qqmusic") return { ok: true, data: await callQQMusic(name, params) };
    return { ok: true, data: await callKugou(name, params) };
  } catch (error) {
    if (error instanceof NeteaseRequestError) {
      return {
        ok: false,
        error: error.message,
        status: error.response.status,
        body: error.response.body,
      };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const clearSession = async (platform: ApiPlatform): Promise<void> => {
  if (platform === "netease") clearNeteaseCookies();
  if (platform === "qqmusic") clearQQMusicCookies();
  if (platform === "kugou") clearKugouSession();
};

const setCookie = async (
  platform: ApiPlatform,
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const parsed = parseCookie(raw);
  if (platform === "netease") {
    if (!parsed.MUSIC_U) return { ok: false, error: "missing MUSIC_U" };
    mergeNeteaseCookies(parsed);
  } else if (platform === "qqmusic") {
    if (!parsed.uin && !parsed.wxuin && !parsed.qm_keyst && !parsed.qqmusic_key) {
      return { ok: false, error: "missing uin or key" };
    }
    mergeQQMusicCookies(parsed);
  } else {
    if (!parsed.token || !parsed.userid) return { ok: false, error: "missing token or userid" };
    mergeKugouSession(parsed);
  }
  return { ok: true };
};

export const mobileProviders: ApisApi = {
  call,
  clearSession,
  openLoginWeb: async () => ({ ok: false, error: "use QR or cookie login on iOS" }),
  setCookie,
};
