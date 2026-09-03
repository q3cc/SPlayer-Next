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

if (scripts.length < 2) fail("移动 bundle 未分包，可能再次阻塞 iPad 主线程");

const html = fs.readFileSync(indexPath, "utf8");
const javascript = scripts.map((file) => fs.readFileSync(file, "utf8")).join("\n");

if (!html.includes("viewport-fit=cover")) fail("缺少 iOS 全屏 viewport-fit=cover");
if (!html.includes('class="splash-logo"')) fail("缺少内联启动 Logo");
if (!javascript.includes("splayer.mobile.settings")) fail("移动端 window.api 桥接未进入 bundle");
if (!javascript.includes("iPhone / iPad")) fail("移动播放器实现未进入 bundle");

console.log(`[VerifyMobileBundle] 通过：${scripts.length} 个 JS 分包包含移动桥接及 iPad 全屏配置`);
