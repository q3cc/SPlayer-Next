// Tauri 桥接必须在桌面渲染器模块图求值前安装，因为部分共享模块会同步读取 window.api。
import "@/mobile/bootstrap";

void import("./main");
