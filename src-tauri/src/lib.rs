mod create;
mod overlay;
mod quit;
mod screen;
mod store;

pub fn run() {
    tauri::Builder::default()
        .manage(overlay::HitBoxes::default())
        .manage(create::CreateTarget::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            overlay::create(app.handle())?;
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
            create::open_create_window,
            create::create_window_pet,
            quit::quit_ready
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                quit::on_exit_requested(app, &api);
            }
        });
}
