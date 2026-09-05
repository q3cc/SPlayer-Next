fn main() {
    tauri_plugin::Builder::new(&[
        "load",
        "control",
        "configure",
        "metadata",
        "status",
        "visibility",
        "register_listener",
        "remove_listener",
    ])
    .ios_path("ios")
    .build();
}
