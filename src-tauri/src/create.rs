use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Label of the New pet window.
const LABEL: &str = "create";
const WIDTH: f64 = 420.0;
const HEIGHT: f64 = 560.0;

/// What the New pet window is open for.
#[derive(Debug, Default, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    /// The pet to edit; `None` creates a new pet.
    pub pet_id: Option<String>,
    /// Show the rehome confirmation as soon as the window opens (only with a pet).
    pub rehome: bool,
}

impl Target {
    pub fn new(pet_id: Option<String>, rehome: bool) -> Self {
        let rehome = rehome && pet_id.is_some();
        Self { pet_id, rehome }
    }
}

/// The current target of the New pet window.
#[derive(Default)]
pub struct CreateTarget(Mutex<Target>);

/// Native title of the window for this target.
fn window_title(pet_id: Option<&str>) -> &'static str {
    if pet_id.is_some() {
        "Edit pet"
    } else {
        "New pet"
    }
}

/// Store the new target and report whether an open window must reload: the target changed, or
/// a rehome was asked for again (its confirmation may have been dismissed).
fn retarget(slot: &Mutex<Target>, target: Target) -> bool {
    let Ok(mut current) = slot.lock() else {
        return false;
    };
    let reload = *current != target || target.rehome;
    *current = target;
    reload
}

/// Open the New pet window, or bring it forward; with a pet id it edits that pet, and with
/// `rehome` it opens on the rehome confirmation.
#[tauri::command]
pub async fn open_create_window(
    app: AppHandle,
    pet_id: Option<String>,
    rehome: bool,
) -> Result<(), String> {
    let title = window_title(pet_id.as_deref());
    let changed = retarget(&app.state::<CreateTarget>().0, Target::new(pet_id, rehome));
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

/// What the New pet window was opened for.
#[tauri::command]
pub fn create_window_target(target: State<CreateTarget>) -> Target {
    target.0.lock().map(|t| t.clone()).unwrap_or_default()
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
        let slot = Mutex::new(Target::default());
        let edit = |id: &str| Target::new(Some(id.into()), false);
        assert!(!retarget(&slot, Target::default()));
        assert!(retarget(&slot, edit("a")));
        assert!(!retarget(&slot, edit("a")));
        assert!(retarget(&slot, edit("b")));
        assert!(retarget(&slot, Target::default()));
        assert_eq!(*slot.lock().unwrap(), Target::default());
    }

    #[test]
    fn rehome_needs_a_pet_and_always_reloads() {
        assert_eq!(Target::new(None, true), Target::default());
        let slot = Mutex::new(Target::default());
        let rehome = Target::new(Some("a".into()), true);
        assert!(retarget(&slot, rehome.clone()));
        assert!(retarget(&slot, rehome));
        assert!(retarget(&slot, Target::new(Some("a".into()), false)));
    }

    #[test]
    fn target_reaches_the_form_in_camel_case() {
        let json = serde_json::to_value(Target::new(Some("a".into()), true)).unwrap();
        assert_eq!(json, serde_json::json!({ "petId": "a", "rehome": true }));
    }
}
