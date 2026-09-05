use std::{
    fs::{File, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

struct SessionLog {
    file: Mutex<File>,
    path: PathBuf,
}

static SESSION_LOG: OnceLock<SessionLog> = OnceLock::new();

/// 临时诊断：一个原生进程对应一个启动时间命名的文件，不覆盖历史日志。
pub fn init() -> Result<(), String> {
    #[cfg(target_os = "ios")]
    let directory = PathBuf::from(std::env::var_os("HOME").ok_or("iOS sandbox HOME missing")?)
        .join("Documents/logs");
    #[cfg(not(target_os = "ios"))]
    let directory = std::env::temp_dir().join("splayer-logs");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let now = chrono::Local::now();
    let path = directory.join(format!("{}.log", now.format("%Y-%m-%d_%H-%M-%S%.3f%z")));
    let mut file = OpenOptions::new()
        .create_new(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(
        file,
        "{} [native] session-start version={} path={}",
        now.to_rfc3339(),
        env!("CARGO_PKG_VERSION"),
        path.display()
    )
    .map_err(|e| e.to_string())?;

    #[cfg(target_os = "ios")]
    {
        use std::os::fd::AsRawFd;
        // 将原生标准输出与错误输出汇入同一追加文件，保留插件警告和崩溃前输出。
        unsafe {
            if libc::dup2(file.as_raw_fd(), libc::STDOUT_FILENO) == -1
                || libc::dup2(file.as_raw_fd(), libc::STDERR_FILENO) == -1
            {
                return Err(std::io::Error::last_os_error().to_string());
            }
        }
    }
    SESSION_LOG
        .set(SessionLog {
            file: Mutex::new(file),
            path,
        })
        .map_err(|_| "session log already initialized".to_string())
}

#[tauri::command]
pub fn append_diagnostic_log(entries: Vec<String>) -> Result<(), String> {
    if entries.len() > 32 || entries.iter().any(|line| line.len() > 65536) {
        return Err("diagnostic batch too large".into());
    }
    let log = SESSION_LOG.get().ok_or("session log unavailable")?;
    let mut file = log.file.lock().map_err(|e| e.to_string())?;
    for entry in entries {
        writeln!(file, "{entry}").map_err(|e| e.to_string())?;
    }
    file.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn diagnostic_log_path() -> Result<String, String> {
    SESSION_LOG
        .get()
        .map(|log| log.path.to_string_lossy().into_owned())
        .ok_or_else(|| "session log unavailable".into())
}
