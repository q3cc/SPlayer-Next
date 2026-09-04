// 移动桥接与应用保留在首个模块图中，避免 WKWebView 首次解析动态分包时卡住启动页。
import "./boot";
import "./mobile/bootstrap";
import "./main";
