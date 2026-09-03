const splash = (): HTMLElement | null => document.getElementById("app-loading");

const describeError = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "未知启动错误";
};

const showBootError = (reason: unknown): void => {
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

window.addEventListener("splayer:boot-error", (event) => {
  showBootError((event as CustomEvent<unknown>).detail);
});

const boot = async (): Promise<void> => {
  // 桌面共享模块会在求值时同步读取 window.api，移动桥接必须先完成安装。
  if (import.meta.env.MODE === "mobile") await import("./mobile/bootstrap");
  await import("./main");
};

void boot().catch(showBootError);

window.setTimeout(() => {
  if (splash() && !document.querySelector("#app > *")) {
    showBootError(new Error("应用初始化超时"));
  }
}, 12_000);
