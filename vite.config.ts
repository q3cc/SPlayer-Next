import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import AutoImport from "unplugin-auto-import/vite";
import Icons from "unplugin-icons/vite";
import IconsResolver from "unplugin-icons/resolver";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import Components from "unplugin-vue-components/vite";
import RekaResolver from "reka-ui/resolver";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import pkg from "./package.json" with { type: "json" };

const gitValue = (command: string): string => {
  try {
    return execSync(command).toString().trim() || "unknown";
  } catch {
    return "unknown";
  }
};

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_REPO_URL__: JSON.stringify(pkg.repository.url),
    __APP_REPO_NAME__: JSON.stringify(pkg.productName),
    __APP_AUTHOR__: JSON.stringify(pkg.author.name),
    __APP_HOMEPAGE__: JSON.stringify(pkg.homepage),
    __APP_AUTHOR_URL__: JSON.stringify(pkg.author.url),
    __COMMIT_HASH__: JSON.stringify(gitValue("git rev-parse --short=7 HEAD")),
    __COMMIT_DATE__: JSON.stringify(gitValue("git log -1 --format=%cI")),
  },
  server: {
    host: "0.0.0.0",
    port: 14558,
    strictPort: true,
  },
  publicDir: resolve(__dirname, "public"),
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    // WKWebView 通过 Tauri 自定义协议加载资源。单文件入口避免首屏路由依赖额外动态
    // chunk 时出现协议/缓存差异，也确保移动桥接一定先于共享应用代码求值。
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
      output: { inlineDynamicImports: true },
    },
  },
  resolve: {
    alias: [
      {
        find: "@main/database/sessions",
        replacement: resolve(__dirname, "src/mobile/shims/sessions.ts"),
      },
      {
        find: "@main/database/lyricCache",
        replacement: resolve(__dirname, "src/mobile/shims/lyricCache.ts"),
      },
      {
        find: "@main/database/lyricMatchCache",
        replacement: resolve(__dirname, "src/mobile/shims/lyricMatchCache.ts"),
      },
      {
        find: "@main/database/lyricTtmlCache",
        replacement: resolve(__dirname, "src/mobile/shims/lyricTtmlCache.ts"),
      },
      { find: "@main/utils/logger", replacement: resolve(__dirname, "src/mobile/shims/logger.ts") },
      { find: "@main/utils/proxy", replacement: resolve(__dirname, "src/mobile/shims/proxy.ts") },
      { find: "@main/store", replacement: resolve(__dirname, "src/mobile/shims/store.ts") },
      { find: "@main", replacement: resolve(__dirname, "electron/main") },
      { find: "@", replacement: resolve(__dirname, "src") },
      { find: "@shared", replacement: resolve(__dirname, "shared") },
      { find: "@windows", replacement: resolve(__dirname, "windows") },
      { find: "@root", replacement: resolve(__dirname) },
    ],
  },
  plugins: [
    nodePolyfills({
      include: ["buffer", "crypto", "events", "process", "stream", "util", "vm", "zlib"],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    vue(),
    UnoCSS(),
    AutoImport({ imports: ["vue", "pinia", "vue-router", "@vueuse/core", "vue-i18n"] }),
    Icons({
      compiler: "vue3",
      scale: 1,
      customCollections: { sp: FileSystemIconLoader("./src/assets/icons") },
    }),
    Components({
      dirs: ["src/components"],
      resolvers: [RekaResolver(), IconsResolver({ prefix: "icon", customCollections: ["sp"] })],
    }),
  ],
});
