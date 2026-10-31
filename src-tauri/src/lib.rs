mod overlay;
mod screen;
mod store;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            overlay::create(app.handle())?;
            screen::start_floor_poll(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            screen::get_floor,
            store::load_save,
            store::write_save,
            store::quarantine_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
