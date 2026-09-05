import { invoke } from "@tauri-apps/api/core";
import { store } from "./shims/store";

const secretKey =
  /cookie|authorization|password|passwd|token|secret|csrf|unikey|codekey|chainid|qrurl|qrimg|qrsig|ptsigx|p_skey|musickey|MUSIC_[UA]/i;

/** 控制台对象和错误统一脱敏，避免把可复用的登录凭据写入日志。 */
export const diagnosticText = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const sanitize = (item: unknown, depth: number): unknown => {
    if (typeof item === "string")
      return item
        .replace(/((?:set-cookie|cookie|authorization)\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]")
        .replace(
          /((?:MUSIC_[UA]|__csrf|token|password|unikey|codekey|chainId|ptsigx|qrsig|p_skey|musickey)["']?\s*[=:]\s*["']?)[^\s;,&#"'}]+/gi,
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

/** 开启时才包装控制台；关闭时清空积压、恢复原方法并移除监听。 */
const installDiagnostics = (): (() => void) => {
  const pending: string[] = [];
  const nativeError = console.error.bind(console);
  const restore: Array<() => void> = [];
  let closed = false;
  let writing = false;
  let dropped = 0;
  const flush = async (): Promise<void> => {
    if (writing || !pending.length) return;
    writing = true;
    try {
      while (!closed && pending.length) {
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
    const original = console[level];
    restore.push(() => {
      console[level] = original;
    });
    console[level] = (...args: unknown[]) => {
      const message = args.map(diagnosticText).join(" ").slice(0, 12000);
      original.call(console, message);
      if (pending.length < 256) pending.push(`${new Date().toISOString()} [${level}] ${message}`);
      else dropped++;
      void flush();
    };
  }
  const onError = (event: ErrorEvent): void =>
    console.error("[uncaught-error]", event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent): void =>
    console.error("[unhandled-rejection]", event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  console.info("[diagnostics] enabled", {
    version: __APP_VERSION__,
    userAgent: navigator.userAgent,
  });
  void invoke<string>("diagnostic_log_path")
    .then((path) => {
      if (!closed) console.info("[diagnostics] file", path);
    })
    .catch(nativeError);
  return () => {
    closed = true;
    pending.length = 0;
    restore.forEach((reset) => reset());
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
};

let cleanup: (() => void) | undefined;
let transition: Promise<void> = Promise.resolve();

/** 串行切换，避免快速开关时原生文件记录与控制台包装状态不一致。 */
export const setDiagnosticsEnabled = (enabled: boolean): Promise<void> => {
  transition = transition
    .catch(() => {})
    .then(async () => {
      if (!("__TAURI_INTERNALS__" in window)) return;
      if (!enabled) {
        cleanup?.();
        cleanup = undefined;
      }
      await invoke("set_diagnostic_logging", { enabled });
      if (enabled && !cleanup) cleanup = installDiagnostics();
    });
  return transition;
};

if (store.get("system.diagnosticLogging") === true) {
  void setDiagnosticsEnabled(true).catch((error) =>
    console.error("[diagnostics] enable failed", error),
  );
}
