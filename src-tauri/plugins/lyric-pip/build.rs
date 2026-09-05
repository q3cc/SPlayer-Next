fn main() {
    tauri_plugin::Builder::new(&[
        "start",
        "stop",
        "update",
        "sync",
        "status",
        "preview",
        "discard",
        "keepawake",
        "register_listener",
        "remove_listener",
    ])
    .ios_path("ios")
    .build();
}
