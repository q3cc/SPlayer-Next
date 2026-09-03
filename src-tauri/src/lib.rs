#[cfg(target_os = "ios")]
fn configure_ios_audio_session() {
    use objc2_avf_audio::{AVAudioSession, AVAudioSessionCategoryPlayback};

    // SAFETY: AVAudioSession 是 iOS 主进程内的线程安全单例；这里只在应用启动时配置一次。
    unsafe {
        let session = AVAudioSession::sharedInstance();
        let Some(category) = AVAudioSessionCategoryPlayback else {
            eprintln!("AVAudioSessionCategoryPlayback is unavailable");
            return;
        };
        if let Err(error) = session.setCategory_error(category) {
            eprintln!("failed to set iOS audio session category: {error}");
            return;
        }
        if let Err(error) = session.setActive_error(true) {
            eprintln!("failed to activate iOS audio session: {error}");
        }
    }
}

#[tauri::command]
fn report_boot_stage(stage: String) {
    eprintln!("[splayer-boot] {stage}");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "ios")]
    configure_ios_audio_session();

    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![report_boot_stage])
        .run(tauri::generate_context!())
        .expect("error while running SPlayer Next mobile");
}
