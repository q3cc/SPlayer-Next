import { fetchArtists, fetchNewAlbums, fetchRecommendPlaylists } from "@/apis/recommend/netease";
import { neteaseQrLoginAdapter } from "@/apis/login/netease";
import { reportBootStage } from "@/boot";
import { appCacheDir, join } from "@tauri-apps/api/path";
import { mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { scanMobileDirectories } from "./library";

const requireItems = (name: string, items: unknown[]): void => {
  if (!items.length) throw new Error(`${name} returned no items`);
};

const createSilentWav = (): Uint8Array => {
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string): void => {
    for (const [index, character] of [...value].entries()) {
      view.setUint8(offset + index, character.charCodeAt(0));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  return new Uint8Array(buffer);
};

const testLibraryScan = async (): Promise<void> => {
  const directory = await join(await appCacheDir(), "mobile-library-smoke");
  await remove(directory, { recursive: true }).catch(() => undefined);
  await mkdir(directory, { recursive: true });
  await writeFile(await join(directory, "smoke.wav"), createSilentWav());
  try {
    const tracks = await scanMobileDirectories([directory]);
    if (tracks.length !== 1 || tracks[0]?.title !== "smoke") {
      throw new Error("mobile directory scan returned invalid tracks");
    }
  } finally {
    await remove(directory, { recursive: true }).catch(() => undefined);
  }
};

/** 在移动端模拟器中验证公共在线业务链路 */
export const runMobileSmokeTest = async (): Promise<void> => {
  reportBootStage("network-smoke-start");
  try {
    const [playlists, artists, albums] = await Promise.all([
      fetchRecommendPlaylists(false),
      fetchArtists(),
      fetchNewAlbums(),
    ]);
    requireItems("recommend playlists", playlists);
    requireItems("artists", artists);
    requireItems("albums", albums);
    reportBootStage("recommendations-ready");

    await testLibraryScan();
    reportBootStage("library-scan-ready");

    const qr = await neteaseQrLoginAdapter.create();
    if (!qr.key || !qr.content.includes("/st/platform/scanlogin")) {
      throw new Error("web QR login URL missing");
    }
    reportBootStage("qr-login-ready");
    reportBootStage("network-smoke-ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportBootStage(`network-smoke-failed:${message.replace(/[\r\n]/g, " ").slice(0, 160)}`);
  }
};
