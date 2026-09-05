import { invoke } from "@tauri-apps/api/core";

const secretKey =
  /cookie|authorization|password|passwd|token|secret|csrf|unikey|codekey|chainid|qrurl|qrimg|MUSIC_[UA]/i;

/** 控制台对象和错误统一脱敏，避免把可复用的登录凭据写入日志。 */
export const diagnosticText = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const sanitize = (item: unknown, depth: number): unknown => {
    if (typeof item === "string")
      return item
        .replace(/((?:set-cookie|cookie|authorization)\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]")
        .replace(
          /((?:MUSIC_[UA]|__csrf|token|password|unikey|codekey|chainId)["']?\s*[=:]\s*["']?)[^\s;,&#"'}]+/gi,
          "$1[REDACTED]",
        );
    if (!item || typeof item !== "object") return typeof item === "bigint" ? String(item) : item;
    if (seen.has(item)) return "[Circular]";
    if (depth > 6) return "[Depth limit]";
    seen.add(item);
    if (item instanceof Error)
      return sanitize({ name: item.name, message: item.message, stack: item.stack }, depth + 1);
    if (Array.isArray(item)) return item.slice(0, 100).map((entry) => sanitize(entry, depth + 1));
    return Object.fromEntries(
      Object.entries(item)
        .slice(0, 100)
        .map(([key, entry]) => [
          key,
          secretKey.test(key) ? "[REDACTED]" : sanitize(entry, depth + 1),
        ]),
    );
  };
  try {
    const safe = sanitize(value, 0);
    return (typeof safe === "string" ? safe : (JSON.stringify(safe) ?? String(safe))).slice(
      0,
      12000,
    );
  } catch {
    return "[Unserializable]";
  }
};

/** 临时开启完整控制台日志，单批写入，限制积压以免诊断本身拖垮播放器。 */
export const installDiagnostics = (): void => {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const pending: string[] = [];
  const nativeError = console.error.bind(console);
  let writing = false;
  let dropped = 0;
  const flush = async (): Promise<void> => {
    if (writing || !pending.length) return;
    writing = true;
    try {
      while (pending.length) {
        const entries = pending.splice(0, 16);
        if (dropped) {
          entries.push(
            `${new Date().toISOString()} [warn] diagnostic overflow: ${dropped} entries dropped`,
          );
          dropped = 0;
        }
        await invoke("append_diagnostic_log", { entries });
      }
    } catch (error) {
      pending.length = 0;
      nativeError("[diagnostics] file write failed", error);
    } finally {
      writing = false;
    }
  };
  for (const level of ["debug", "info", "log", "warn", "error", "trace"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const message = args.map(diagnosticText).join(" ").slice(0, 12000);
      original(message);
      if (pending.length < 256) pending.push(`${new Date().toISOString()} [${level}] ${message}`);
      else dropped++;
      void flush();
    };
  }
  window.addEventListener("error", (event) =>
    console.error("[uncaught-error]", event.error ?? event.message),
  );
  window.addEventListener("unhandledrejection", (event) =>
    console.error("[unhandled-rejection]", event.reason),
  );
  console.info("[diagnostics] enabled", {
    version: __APP_VERSION__,
    userAgent: navigator.userAgent,
  });
  void invoke<string>("diagnostic_log_path")
    .then((path) => console.info("[diagnostics] file", path))
    .catch(nativeError);
};

installDiagnostics();
