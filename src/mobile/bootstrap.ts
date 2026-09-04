import { installMobileApi } from "./api";
import { fetchWithProxy } from "./shims/proxy";
import { reportBootStage } from "../boot";

if ("__TAURI_INTERNALS__" in window || import.meta.env.MODE === "mobile") {
  reportBootStage("mobile-bootstrap-start");
  // 音乐服务普遍不开放浏览器 CORS，统一经 Tauri 原生网络栈请求。
  globalThis.fetch = fetchWithProxy as typeof globalThis.fetch;
  reportBootStage("mobile-api-install-start");
  installMobileApi();
  reportBootStage("mobile-bootstrap-ready");
}
