import { installMobileApi } from "./api";
import { reportBootStage } from "../boot";
import { store } from "@main/store";
import { resolveInitialRoute } from "@shared/utils/initialRoute";

if ("__TAURI_INTERNALS__" in window || import.meta.env.MODE === "mobile") {
  reportBootStage("mobile-bootstrap-start");
  reportBootStage("mobile-api-install-start");
  installMobileApi();
  const initialRoute = resolveInitialRoute({
    onboardingCompleted: store.get("system.onboardingCompleted"),
    agreedAgreementVersion: store.get("system.agreedAgreementVersion"),
  });
  if (initialRoute && (!location.hash || location.hash === "#/")) {
    history.replaceState(null, "", `#${initialRoute}`);
  }
  reportBootStage("mobile-bootstrap-ready");
}
