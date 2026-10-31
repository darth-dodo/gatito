use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, ExitRequestApi};

/// How long the overlay gets to write the save before the app exits anyway.
const FLUSH_GRACE: Duration = Duration::from_secs(2);

static ASKED: AtomicBool = AtomicBool::new(false);
static READY: AtomicBool = AtomicBool::new(false);

/// Hold the exit until the overlay has flushed the save (or the grace time runs out).
pub fn on_exit_requested(app: &AppHandle, api: &ExitRequestApi) {
    if READY.load(Ordering::SeqCst) {
        return;
    }
    api.prevent_exit();
    if ASKED.swap(true, Ordering::SeqCst) {
        return;
    }
    if app.emit_to("overlay", "quit-requested", ()).is_err() {
        allow_exit(app);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(FLUSH_GRACE);
        allow_exit(&app);
    });
}

fn allow_exit(app: &AppHandle) {
    READY.store(true, Ordering::SeqCst);
    app.exit(0);
}

/// The overlay has written the save; exit now.
#[tauri::command]
pub fn quit_ready(app: AppHandle) {
    allow_exit(&app);
}
