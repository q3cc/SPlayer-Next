import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { store } from "./store";

const webFetch = globalThis.fetch.bind(globalThis);

const isManualProxyProtocol = (value: string): value is "http" | "https" | "socks5" =>
  value === "http" || value === "https" || value === "socks5";

const requestUrl = (input: string | URL | Request): URL | null => {
  try {
    const value = input instanceof Request ? input.url : input.toString();
    return new URL(value, location.href);
  } catch {
    return null;
  }
};

/** Vite 分包、字体、图片等应用内资源必须继续交给 WKWebView/Tauri 协议加载。 */
const isApplicationAsset = (input: string | URL | Request): boolean => {
  const url = requestUrl(input);
  if (!url) return false;
  const current = new URL(location.href);
  if (url.protocol === current.protocol && url.host === current.host) return true;
  return url.protocol === "tauri:" || url.protocol === "file:" || url.protocol === "blob:";
};

export const getNetworkProxyUrl = (): string | null => {
  const config = store.get("system.networkProxy");
  if (!isManualProxyProtocol(config.protocol)) return null;
  const host = config.host.trim();
  const port = Number(config.port);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return `${config.protocol}://${host}:${port}`;
};

export const fetchWithProxy = (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  if (isApplicationAsset(input)) return webFetch(input, init);
  const proxy = getNetworkProxyUrl();
  // 原生 API 请求保留公共实现指定的 Cookie/Referer/Origin；未指定 Origin 时不注入应用协议地址。
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  if (!headers.has("Origin")) headers.set("Origin", "");
  return tauriFetch(input, { ...init, headers, ...(proxy ? { proxy: { all: proxy } } : {}) });
};

export const testNetworkProxy = async (): Promise<boolean> => {
  if (!getNetworkProxyUrl()) return false;
  try {
    return (await fetchWithProxy("https://www.baidu.com", { signal: AbortSignal.timeout(8000) }))
      .ok;
  } catch {
    return false;
  }
};
