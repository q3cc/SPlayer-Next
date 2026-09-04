import { invoke } from "@tauri-apps/api/core";

const splash = (): HTMLElement | null => document.getElementById("app-loading");

export const reportBootStage = (stage: string): void => {
  console.info(`[splayer-boot] ${stage}`);
  if (!("__TAURI_INTERNALS__" in window)) return;
  void invoke("report_boot_stage", { stage }).catch(() => undefined);
};

const describeError = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "未知启动错误";
};

export const showBootError = (reason: unknown): void => {
  const root = splash();
  if (!root || root.classList.contains("hidden") || root.classList.contains("boot-failed")) return;

  console.error("[boot] SPlayer Next failed to start", reason);
  root.classList.add("boot-failed");
  const footer = root.querySelector<HTMLElement>(".splash-footer");
  if (footer) footer.textContent = `启动失败：${describeError(reason)}`;

  const retry = document.createElement("button");
  retry.className = "splash-retry";
  retry.type = "button";
  retry.textContent = "重新启动";
  retry.addEventListener("click", () => location.reload());
  root.querySelector(".splash")?.append(retry);
};

reportBootStage("entry-loaded");

window.addEventListener("splayer:boot-error", (event) => {
  showBootError((event as CustomEvent<unknown>).detail);
});

window.setTimeout(() => {
  if (splash() && !document.querySelector("#app > *")) {
    showBootError(new Error("应用初始化超时"));
  }
}, 12_000);
