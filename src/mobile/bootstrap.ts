import { installMobileApi } from "./api";
import { fetchWithProxy } from "./shims/proxy";

if ("__TAURI_INTERNALS__" in window || import.meta.env.MODE === "mobile") {
  // 音乐服务普遍不开放浏览器 CORS，统一经 Tauri 原生网络栈请求。
  globalThis.fetch = fetchWithProxy as typeof globalThis.fetch;
  installMobileApi();
}
