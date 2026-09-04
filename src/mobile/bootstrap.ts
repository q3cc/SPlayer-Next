import { installMobileApi } from "./api";
import { reportBootStage } from "../boot";

if ("__TAURI_INTERNALS__" in window || import.meta.env.MODE === "mobile") {
  reportBootStage("mobile-bootstrap-start");
  reportBootStage("mobile-api-install-start");
  installMobileApi();
  reportBootStage("mobile-bootstrap-ready");
}
