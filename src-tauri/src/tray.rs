use serde::Deserialize;
use serde_json::json;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, image::Image};
use tauri_plugin_autostart::ManagerExt;

const TRAY_ID: &str = "windowsill";
/// A pet as the menu needs it.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct MenuPet {
    pub id: String,
    pub name: String,
}

/// Menu state kept in Rust: the pets to list and the Nap time flag.
/// The front end saves Nap time in settings and restores it here on start (`set_nap_time`).
#[derive(Default)]
pub struct TrayState {
    pets: Mutex<Vec<MenuPet>>,
    nap: AtomicBool,
    quit: QuitGuard,
}

/// Lets only the first Quit click through, so exit (and Task 12's save hook) runs once.
#[derive(Default)]
pub struct QuitGuard(AtomicBool);

impl QuitGuard {
    /// True the first time it is called, false ever after.
    pub fn first(&self) -> bool {
        !self.0.swap(true, Ordering::SeqCst)
    }
}

/// What a clicked menu entry means.
#[derive(Debug, Clone, PartialEq)]
pub enum MenuAction {
    NewPet,
    EditPet(String),
    CallOver(String),
    RehomePet(String),
    NapTime,
    LaunchAtLogin,
    Quit,
}

const ID_NEW: &str = "new";
const ID_NAP: &str = "nap";
const ID_LOGIN: &str = "login";
const ID_QUIT: &str = "quit";

fn pet_item_id(verb: &str, pet_id: &str) -> String {
    format!("{verb}:{pet_id}")
}

/// Reads a menu item id back into an action; unknown ids are ignored.
pub fn parse_menu_id(id: &str) -> Option<MenuAction> {
    match id {
        ID_NEW => return Some(MenuAction::NewPet),
        ID_NAP => return Some(MenuAction::NapTime),
        ID_LOGIN => return Some(MenuAction::LaunchAtLogin),
        ID_QUIT => return Some(MenuAction::Quit),
        _ => {}
    }
    let (verb, pet) = id.split_once(':')?;
    let pet = pet.to_string();
    match verb {
        "edit" => Some(MenuAction::EditPet(pet)),
        "call" => Some(MenuAction::CallOver(pet)),
        "rehome" => Some(MenuAction::RehomePet(pet)),
        _ => None,
    }
}

fn build_menu(app: &AppHandle, pets: &[MenuPet], nap: bool) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    menu.append(&MenuItem::with_id(
        app,
        ID_NEW,
        "New pet…",
        true,
        None::<&str>,
    )?)?;
    for pet in pets {
        let edit = MenuItem::with_id(
            app,
            pet_item_id("edit", &pet.id),
            "Edit…",
            true,
            None::<&str>,
        )?;
        let call = MenuItem::with_id(
            app,
            pet_item_id("call", &pet.id),
            "Call over",
            true,
            None::<&str>,
        )?;
        let rehome = MenuItem::with_id(
            app,
            pet_item_id("rehome", &pet.id),
            "Rehome…",
            true,
            None::<&str>,
        )?;
        let sub = Submenu::with_id_and_items(
            app,
            format!("pet:{}", pet.id),
            &pet.name,
            true,
            &[&edit, &call, &rehome],
        )?;
        menu.append(&sub)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&CheckMenuItem::with_id(
        app,
        ID_NAP,
        "Nap time",
        true,
        nap,
        None::<&str>,
    )?)?;
    let login = app.autolaunch().is_enabled().unwrap_or(false);
    menu.append(&CheckMenuItem::with_id(
        app,
        ID_LOGIN,
        "Launch at login",
        true,
        login,
        None::<&str>,
    )?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(
        app,
        ID_QUIT,
        "Quit Windowsill",
        true,
        None::<&str>,
    )?)?;
    Ok(menu)
}

/// Rebuilds the menu from the current state and swaps it into the tray icon.
fn refresh(app: &AppHandle) {
    let state = app.state::<TrayState>();
    let pets = state.pets.lock().map(|p| p.clone()).unwrap_or_default();
    let nap = state.nap.load(Ordering::SeqCst);
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    match build_menu(app, &pets, nap) {
        Ok(menu) => {
            if let Err(e) = tray.set_menu(Some(menu)) {
                eprintln!("windowsill: could not set the menu bar menu: {e}");
            }
        }
        Err(e) => eprintln!("windowsill: could not build the menu bar menu: {e}"),
    }
}

fn handle(app: &AppHandle, action: MenuAction) {
    match action {
        MenuAction::NewPet => {
            let _ = app.emit("menu-new-pet", ());
        }
        MenuAction::EditPet(id) => {
            let _ = app.emit("menu-edit-pet", json!({ "id": id }));
        }
        MenuAction::RehomePet(id) => {
            let _ = app.emit("menu-rehome-pet", json!({ "id": id }));
        }
        MenuAction::CallOver(id) => {
            let _ = app.emit("call-over", json!({ "id": id }));
        }
        MenuAction::NapTime => {
            let on = !app
                .state::<TrayState>()
                .nap
                .fetch_xor(true, Ordering::SeqCst);
            let _ = app.emit("nap-time", json!({ "on": on }));
        }
        MenuAction::LaunchAtLogin => {
            let launch = app.autolaunch();
            let _ = if launch.is_enabled().unwrap_or(false) {
                launch.disable()
            } else {
                launch.enable()
            };
            // Re-read the plugin so the check mark shows what the OS really has.
            refresh(app);
        }
        MenuAction::Quit => {
            if app.state::<TrayState>().quit.first() {
                app.exit(0);
            }
        }
    }
}

/// Adds the menu bar icon (a template image, so macOS tints it) and its menu.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(include_bytes!("../icons/tray-cat.png"))?;
    let menu = build_menu(app, &[], false)?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .on_menu_event(|app, event| {
            if let Some(action) = parse_menu_id(event.id().as_ref()) {
                handle(app, action);
            }
        })
        .build(app)?;
    Ok(())
}

/// The front end calls this on start and whenever pets are added, renamed or rehomed.
#[tauri::command]
pub fn set_menu_pets(app: AppHandle, state: State<TrayState>, pets: Vec<MenuPet>) {
    if let Ok(mut guard) = state.pets.lock() {
        *guard = pets;
    }
    refresh(&app);
}

/// The front end restores the saved Nap time on start; only the check mark changes here.
#[tauri::command]
pub fn set_nap_time(app: AppHandle, state: State<TrayState>, on: bool) {
    state.nap.store(on, Ordering::SeqCst);
    refresh(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quit_guard_lets_only_the_first_call_through() {
        let g = QuitGuard::default();
        assert!(g.first());
        assert!(!g.first());
        assert!(!g.first());
    }

    #[test]
    fn parses_fixed_ids() {
        assert_eq!(parse_menu_id("new"), Some(MenuAction::NewPet));
        assert_eq!(parse_menu_id("nap"), Some(MenuAction::NapTime));
        assert_eq!(parse_menu_id("login"), Some(MenuAction::LaunchAtLogin));
        assert_eq!(parse_menu_id("quit"), Some(MenuAction::Quit));
    }

    #[test]
    fn parses_pet_ids_even_with_colons() {
        assert_eq!(
            parse_menu_id("edit:mochi"),
            Some(MenuAction::EditPet("mochi".into()))
        );
        assert_eq!(
            parse_menu_id("call:a:b"),
            Some(MenuAction::CallOver("a:b".into()))
        );
        assert_eq!(
            parse_menu_id("rehome:x"),
            Some(MenuAction::RehomePet("x".into()))
        );
        assert_eq!(
            parse_menu_id(&pet_item_id("call", "a:b")),
            Some(MenuAction::CallOver("a:b".into()))
        );
    }

    #[test]
    fn ignores_unknown_ids() {
        assert_eq!(parse_menu_id("pet:mochi"), None);
        assert_eq!(parse_menu_id("bogus:1"), None);
        assert_eq!(parse_menu_id(""), None);
    }
}
