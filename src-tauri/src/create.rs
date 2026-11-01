use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Label of the New pet window.
const LABEL: &str = "create";
const WIDTH: f64 = 420.0;
const HEIGHT: f64 = 560.0;

/// The pet the New pet window edits; `None` creates a new pet.
#[derive(Default)]
pub struct CreateTarget(Mutex<Option<String>>);

/// Native title of the window for this target.
fn window_title(pet_id: Option<&str>) -> &'static str {
    if pet_id.is_some() {
        "Edit pet"
    } else {
        "New pet"
    }
}

/// Store the new target and report whether it differs from the old one.
fn retarget(slot: &Mutex<Option<String>>, pet_id: Option<String>) -> bool {
    let Ok(mut current) = slot.lock() else {
        return false;
    };
    let changed = *current != pet_id;
    *current = pet_id;
    changed
}

/// Open the New pet window, or bring it forward; with a pet id it edits that pet.
#[tauri::command]
pub async fn open_create_window(app: AppHandle, pet_id: Option<String>) -> Result<(), String> {
    let title = window_title(pet_id.as_deref());
    let changed = retarget(&app.state::<CreateTarget>().0, pet_id);
    let window = match app.get_webview_window(LABEL) {
        Some(window) => {
            if changed {
                window.set_title(title).map_err(|e| e.to_string())?;
                app.emit_to(LABEL, "create-target", ())
                    .map_err(|e| e.to_string())?;
            }
            window
        }
        None => WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::App("create.html".into()))
            .title(title)
            .inner_size(WIDTH, HEIGHT)
            .resizable(false)
            .decorations(true)
            .focusable(true)
            .center()
            .build()
            .map_err(|e| e.to_string())?,
    };
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

/// The pet the New pet window was opened for.
#[tauri::command]
pub fn create_window_pet(target: State<CreateTarget>) -> Option<String> {
    target.0.lock().ok().and_then(|id| id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_says_edit_only_with_a_pet() {
        assert_eq!(window_title(None), "New pet");
        assert_eq!(window_title(Some("a")), "Edit pet");
    }

    #[test]
    fn retarget_reports_changes_only() {
        let slot = Mutex::new(None);
        assert!(!retarget(&slot, None));
        assert!(retarget(&slot, Some("a".into())));
        assert!(!retarget(&slot, Some("a".into())));
        assert!(retarget(&slot, Some("b".into())));
        assert!(retarget(&slot, None));
        assert_eq!(*slot.lock().unwrap(), None);
    }
}
