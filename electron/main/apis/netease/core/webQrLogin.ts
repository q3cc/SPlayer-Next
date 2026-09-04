import { randomBytes, randomInt } from "node:crypto";
import { cookieObjToString, cookieToJson } from "./cookie";
import { createOption, type Query } from "./option";
import type { RequestOptions } from "./request";

const WEB_QR_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0";

const randomFrom = (alphabet: string, length: number): string => {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += alphabet[randomInt(0, alphabet.length)];
  }
  return value;
};

const randomWebToken = (length: number): string =>
  randomFrom("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_", length);

const normalizeCookie = (
  cookie: string | Record<string, string> | undefined,
): Record<string, string> => {
  if (!cookie) return {};
  return typeof cookie === "string" ? cookieToJson(cookie) : cookie;
};

const createWebQrCookie = (
  source: string | Record<string, string> | undefined,
): Record<string, string> => {
  const current = normalizeCookie(source);
  const nuid = current._ntes_nuid || randomBytes(16).toString("hex");
  return {
    ...current,
    "JSESSIONID-WYYY": current["JSESSIONID-WYYY"] || randomWebToken(190),
    _iuqxldmzr_: current._iuqxldmzr_ || "33",
    _ntes_nnid: current._ntes_nnid || `${nuid},${Date.now()}`,
    _ntes_nuid: nuid,
    NMTID: current.NMTID || `00${randomWebToken(39)}`,
    WEVNSM: current.WEVNSM || "1.0.0",
    WNMCID: current.WNMCID || `${randomFrom("abcdefghijklmnopqrstuvwxyz", 6)}.${Date.now()}.01.0`,
  };
};

const cookieToList = (cookie: Record<string, string>): string[] =>
  Object.entries(cookie).map(([key, value]) => `${key}=${value}`);

export const cookieHeaderToList = (cookie: unknown): string[] =>
  String(cookie ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

export const mergeCookieLists = (...lists: Array<readonly string[] | undefined>): string[] => {
  const merged = new Map<string, string>();
  for (const item of lists.flatMap((list) => list ?? [])) {
    const value = String(item).split(";")[0];
    const separator = value.indexOf("=");
    if (separator <= 0) continue;
    merged.set(value.slice(0, separator), value);
  }
  return [...merged.values()];
};

export interface WebQrRequest {
  options: RequestOptions;
  cookies: string[];
}

/** 创建网易云网页扫码请求所需的稳定浏览器环境 */
export const createWebQrRequest = (
  query: Query,
  headers: Record<string, string> = {},
): WebQrRequest => {
  const options = createOption(query, "weapi");
  const cookie = createWebQrCookie(options.cookie);
  return {
    options: {
      ...options,
      cookie,
      rawCookie: cookieObjToString(cookie),
      skipCookieProcessing: true,
      ua: query.ua || WEB_QR_USER_AGENT,
      headers: {
        Referer: "https://music.163.com/",
        Origin: "https://music.163.com",
        "x-os": "web",
        "X-channelSource": "undefined",
        "Nm-GCore-Status": "1",
        ...headers,
      },
    },
    cookies: cookieToList(cookie),
  };
};

/** 生成同一次扫码流程共用的网易云链路标识 */
export const generateWebQrChainId = (
  cookie: string | Record<string, string> | undefined,
): string => {
  const deviceId = normalizeCookie(cookie).sDeviceId || `unknown-${randomInt(0, 1_000_000)}`;
  return `v1_${deviceId}_web_login_${Date.now()}`;
};
