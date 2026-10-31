mod idle;
mod overlay;
mod screen;
mod store;
mod tray;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(overlay::HitBoxes::default())
        .manage(tray::TrayState::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            overlay::create(app.handle())?;
            tray::create(app.handle())?;
            screen::start_floor_poll(app.handle().clone());
            overlay::start_cursor_poll(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            screen::get_floor,
            overlay::set_hitboxes,
            store::load_save,
            store::write_save,
            store::quarantine_save,
            idle::user_idle_seconds,
            tray::set_menu_pets,
            tray::quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
