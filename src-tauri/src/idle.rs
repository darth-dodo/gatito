/// Seconds since the user's last keyboard or mouse input; 0 when the OS will not say.
pub fn idle_seconds() -> u64 {
    user_idle::UserIdle::get_time()
        .map(|idle| idle.as_seconds())
        .unwrap_or(0)
}

/// Async so Tauri runs it off the main thread.
#[tauri::command]
pub async fn user_idle_seconds() -> u64 {
    idle_seconds()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idle_never_panics() {
        // A headless CI host may have no idle source; that reads as 0, never a panic.
        let seconds = idle_seconds();
        assert!(seconds < 10 * 365 * 24 * 3600);
    }
}
