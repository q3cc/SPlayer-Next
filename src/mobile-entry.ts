// Keep the mobile bridge and application in the initial module graph. iOS
// WKWebView can stall while resolving the first dynamic import over Tauri's
// custom asset protocol, leaving the splash screen visible indefinitely.
import "./boot";
import "./mobile/bootstrap";
import "./main";
