import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { store } from "./store";

const isManualProxyProtocol = (value: string): value is "http" | "https" | "socks5" =>
  value === "http" || value === "https" || value === "socks5";

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
  const proxy = getNetworkProxyUrl();
  return tauriFetch(input, proxy ? { ...init, proxy: { all: proxy } } : init);
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
