fn main() {
    tauri_plugin::Builder::new(&["download", "share", "register_listener", "remove_listener"])
        .ios_path("ios")
        .build();
}
