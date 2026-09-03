type LogMethod = (...args: unknown[]) => void;

interface MobileLogger {
  debug: LogMethod;
  info: LogMethod;
  log: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

const scoped = (scope: string): MobileLogger => ({
  debug: (...args) => console.debug(`[${scope}]`, ...args),
  info: (...args) => console.info(`[${scope}]`, ...args),
  log: (...args) => console.log(`[${scope}]`, ...args),
  warn: (...args) => console.warn(`[${scope}]`, ...args),
  error: (...args) => console.error(`[${scope}]`, ...args),
});

export const initLogger = (): void => undefined;
export const logsDir = "";
export const nativeLogsDir = "";
export const coreLog = scoped("core");
export const playerLog = scoped("player");
export const mediaLog = scoped("media");
export const trayLog = scoped("tray");
export const thumbarLog = scoped("thumbar");
export const systemLog = scoped("system");
export const ipcLog = scoped("ipc");
export const libraryLog = scoped("library");
export const taskbarLog = scoped("taskbar-lyric");
export const nativeLog = scoped("native");
export const streamingLog = scoped("streaming");
export const songCacheLog = scoped("song-cache");
export const downloadLog = scoped("download");
export const serverLog = scoped("server");
export const pluginLog = scoped("plugin");
export const lastfmLog = scoped("lastfm");
export const neteaseLog = scoped("netease");
export const updaterLog = scoped("updater");
export const cloudLog = scoped("cloud");
export const recognitionLog = scoped("recognition");
