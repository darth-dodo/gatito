use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

/// Transparent, borderless, always-on-top window covering the primary monitor.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let monitor = app
        .primary_monitor()?
        .ok_or_else(|| tauri::Error::WindowNotFound)?;
    let scale = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();

    WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
        .title("Windowsill")
        .position(f64::from(pos.x) / scale, f64::from(pos.y) / scale)
        .inner_size(
            f64::from(size.width) / scale,
            f64::from(size.height) / scale,
        )
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .focusable(false)
        .shadow(false)
        .visible_on_all_workspaces(true)
        .build()?;
    Ok(())
}
