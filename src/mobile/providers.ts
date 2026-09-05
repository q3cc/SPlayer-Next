import type { ApiCallResponse, ApiPlatform, ApisApi } from "@shared/types/apis";

// 平台实现包含较大的加密垫片，延迟到首次网络请求时加载，避免阻塞移动端首帧。
const loadNetease = () => import("@main/apis/netease");
const loadQQMusic = () => import("@main/apis/qqmusic");
const loadKugou = () => import("@main/apis/kugou");

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
  const started = performance.now();
  console.debug("[api] start", { platform, name });
  try {
    if (platform === "netease") {
      const { callNetease, getNeteaseCookies } = await loadNetease();
      const response = await callNetease(name, params);
      const body = response.body;
      console.info("[api] result", {
        platform,
        name,
        status: response.status,
        code: body?.code ?? body?.data?.code,
        message: body?.message ?? body?.msg,
        elapsedMs: Math.round(performance.now() - started),
      });
      if (name.startsWith("login") || name === "logout") {
        const session = getNeteaseCookies();
        console.info("[login] persisted-state", {
          name,
          hasUserCredential: Boolean(session.MUSIC_U),
          hasAnonymousCredential: Boolean(session.MUSIC_A),
          hasAntiforgeryCredential: Boolean(session.__csrf),
          hasBrowserSession: Boolean(session["JSESSIONID-WYYY"]),
          hasAccount: Boolean(body?.data?.account ?? body?.account),
          hasProfile: Boolean(body?.data?.profile ?? body?.profile),
          hasNickname: Boolean((body?.data?.profile ?? body?.profile)?.nickname),
        });
      }
      return { ok: true, status: response.status, body: response.body };
    }
    if (platform === "qqmusic") {
      const { callQQMusic } = await loadQQMusic();
      return { ok: true, data: await callQQMusic(name, params) };
    }
    const { callKugou } = await loadKugou();
    return { ok: true, data: await callKugou(name, params) };
  } catch (error) {
    console.error(
      "[api] failure",
      { platform, name, elapsedMs: Math.round(performance.now() - started) },
      error,
    );
    if (
      error instanceof Error &&
      "response" in error &&
      typeof error.response === "object" &&
      error.response !== null &&
      "status" in error.response &&
      "body" in error.response
    ) {
      return {
        ok: false,
        error: error.message,
        status: Number(error.response.status),
        body: error.response.body,
      };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const clearSession = async (platform: ApiPlatform): Promise<void> => {
  console.warn("[login] clear-session", { platform });
  if (platform === "netease") (await loadNetease()).clearNeteaseCookies();
  if (platform === "qqmusic") (await loadQQMusic()).clearQQMusicCookies();
  if (platform === "kugou") (await loadKugou()).clearKugouSession();
};

const setCookie = async (
  platform: ApiPlatform,
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const parsed = parseCookie(raw);
  if (platform === "netease") {
    if (!parsed.MUSIC_U) return { ok: false, error: "missing MUSIC_U" };
    (await loadNetease()).mergeNeteaseCookies(parsed);
  } else if (platform === "qqmusic") {
    if (
      !(parsed.qm_str_musicid || parsed.uin || parsed.wxuin || parsed.p_uin) ||
      !(parsed.qm_keyst || parsed.qqmusic_key)
    ) {
      return { ok: false, error: "missing music account ID or music key" };
    }
    (await loadQQMusic()).mergeQQMusicCookies(parsed);
  } else {
    if (!parsed.token || !parsed.userid) return { ok: false, error: "missing token or userid" };
    (await loadKugou()).mergeKugouSession(parsed);
  }
  return { ok: true };
};

export const mobileProviders: ApisApi = {
  call,
  clearSession,
  openLoginWeb: async () => ({ ok: false, error: "use QR or cookie login on mobile" }),
  setCookie,
};
