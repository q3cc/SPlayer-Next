import { fetchArtists, fetchNewAlbums, fetchRecommendPlaylists } from "@/apis/recommend/netease";
import { neteaseQrLoginAdapter } from "@/apis/login/netease";
import { reportBootStage } from "@/boot";
import { useSettingsStore } from "@/stores/settings";
import { CURRENT_AGREEMENT_VERSION } from "@shared/constants/agreement";
import { appCacheDir, join } from "@tauri-apps/api/path";
import { mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { scanMobileDirectories } from "./library";

const requireItems = (name: string, items: unknown[]): void => {
  if (!items.length) throw new Error(`${name} returned no items`);
};

const nextPaint = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const testOnboardingVisible = async (): Promise<void> => {
  await nextPaint();
  const page = document.querySelector<HTMLElement>(".onboarding-page");
  const heading = page?.querySelector<HTMLElement>("h1");
  const splash = document.getElementById("app-loading");
  if (!page || !heading) throw new Error(`onboarding page missing at ${location.hash}`);

  const pageStyle = getComputedStyle(page);
  const headingStyle = getComputedStyle(heading);
  const rect = page.getBoundingClientRect();
  const headingRect = heading.getBoundingClientRect();
  const splashStyle = splash ? getComputedStyle(splash) : null;
  const splashHidden =
    !splash ||
    splash.classList.contains("hidden") ||
    splashStyle?.display === "none" ||
    Number(splashStyle?.opacity ?? 1) === 0;
  const visible =
    rect.width > 0 &&
    rect.height > 0 &&
    headingRect.width > 0 &&
    headingRect.height > 0 &&
    pageStyle.display !== "none" &&
    pageStyle.visibility === "visible" &&
    Number(pageStyle.opacity) > 0 &&
    headingStyle.visibility === "visible";

  reportBootStage(
    `onboarding-layout:${Math.round(rect.width)}x${Math.round(rect.height)}:${headingStyle.color}:${splashHidden ? "clear" : "covered"}`,
  );
  if (!visible) throw new Error("onboarding page is not visible");
  if (!splashHidden) throw new Error("startup splash still covers onboarding");
};

const testHomeRecommendationsVisible = async (): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    const page = document.querySelector<HTMLElement>("main");
    const mobileNav = document.querySelector<HTMLElement>(".mobile-nav");
    const sections = [
      document.querySelector<HTMLElement>("[data-home-recommend-playlists]"),
      document.querySelector<HTMLElement>("[data-home-recommend-artists]"),
      document.querySelector<HTMLElement>("[data-home-new-albums]"),
    ];
    if (
      location.hash === "#/" &&
      page?.getBoundingClientRect().height &&
      mobileNav?.getBoundingClientRect().height &&
      sections.every((section) => section && section.getBoundingClientRect().height > 0)
    ) {
      reportBootStage("home-recommendations-ready");
      return;
    }
  }
  throw new Error(`home recommendation sections missing at ${location.hash}`);
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
    if (!document.querySelector(".onboarding-page")) {
      await testHomeRecommendationsVisible();
      reportBootStage("network-smoke-ready");
      return;
    }

    // 等待挂载后的首帧与启动遮罩淡出，再验证用户实际能看到的公共引导页。
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    await testOnboardingVisible();
    reportBootStage("onboarding-ready");

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

    // 为第二次冷启动准备真实首页，随后由冒烟流程核对推荐区块已经渲染。
    const settings = useSettingsStore();
    await settings.setSystem("system.onboardingCompleted", true);
    await settings.setSystem("system.agreedAgreementVersion", CURRENT_AGREEMENT_VERSION);
    reportBootStage("home-smoke-prepared");
    reportBootStage("network-smoke-ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportBootStage(`network-smoke-failed:${message.replace(/[\r\n]/g, " ").slice(0, 160)}`);
  }
};
