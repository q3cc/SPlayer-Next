import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const dist = path.resolve("dist-mobile");
const indexPath = path.join(dist, "index.html");
const assetsPath = path.join(dist, "assets");

const fail = (message: string): never => {
  console.error(`[VerifyMobileBundle] ${message}`);
  process.exit(1);
};

if (!fs.existsSync(indexPath)) fail("dist-mobile/index.html 不存在");

const scripts = fs
  .readdirSync(assetsPath)
  .filter((name) => name.endsWith(".js"))
  .map((name) => path.join(assetsPath, name));

if (scripts.length !== 1) {
  fail(`期望单个内联 JS bundle，实际发现 ${scripts.length} 个`);
}

const html = fs.readFileSync(indexPath, "utf8");
const javascript = fs.readFileSync(scripts[0], "utf8");

if (!html.includes("viewport-fit=cover")) fail("缺少 iOS 全屏 viewport-fit=cover");
if (!html.includes('class="splash-logo"')) fail("缺少内联启动 Logo");
if (!javascript.includes("splayer.mobile.settings")) fail("移动端 window.api 桥接未进入 bundle");
if (!javascript.includes("iPhone / iPad")) fail("移动播放器实现未进入 bundle");

console.log(`[VerifyMobileBundle] 通过：${path.basename(scripts[0])} 包含移动桥接及 iPad 全屏配置`);
