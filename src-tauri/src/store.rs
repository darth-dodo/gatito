use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const FILE: &str = "windowsill.json";
const TMP: &str = "windowsill.json.tmp";
const BAD: &str = "windowsill.json.bad";

fn load_in(dir: &Path) -> io::Result<Option<String>> {
    match fs::read_to_string(dir.join(FILE)) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Write to a temp file then rename over the save, so a failed write never
/// damages an existing save.
fn write_in(dir: &Path, text: &str) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    let tmp = dir.join(TMP);
    fs::write(&tmp, text)?;
    fs::rename(&tmp, dir.join(FILE))
}

/// Move the save aside as `windowsill.json.bad`, replacing any older one.
/// A missing save is not an error.
fn quarantine_in(dir: &Path) -> io::Result<()> {
    match fs::rename(dir.join(FILE), dir.join(BAD)) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        other => other,
    }
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_save(app: AppHandle) -> Result<Option<String>, String> {
    load_in(&data_dir(&app)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_save(app: AppHandle, text: String) -> Result<(), String> {
    write_in(&data_dir(&app)?, &text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quarantine_save(app: AppHandle) -> Result<(), String> {
    quarantine_in(&data_dir(&app)?).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("windowsill-test-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn load_missing_is_none() {
        let dir = temp_dir("load_missing");
        assert_eq!(load_in(&dir).unwrap(), None);
    }

    #[test]
    fn write_then_load_round_trips_and_leaves_no_tmp() {
        let dir = temp_dir("roundtrip");
        write_in(&dir, "{\"a\":1}").unwrap();
        assert_eq!(load_in(&dir).unwrap().as_deref(), Some("{\"a\":1}"));
        assert!(!dir.join("windowsill.json.tmp").exists());
    }

    #[test]
    fn write_is_atomic() {
        let dir = temp_dir("atomic");
        write_in(&dir, "old").unwrap();
        // Block the tmp path with a directory so the temp write fails.
        fs::create_dir(dir.join("windowsill.json.tmp")).unwrap();
        assert!(write_in(&dir, "new").is_err());
        assert_eq!(load_in(&dir).unwrap().as_deref(), Some("old"));
    }

    #[test]
    fn write_creates_missing_dir() {
        let dir = temp_dir("mkdir").join("nested");
        write_in(&dir, "x").unwrap();
        assert_eq!(load_in(&dir).unwrap().as_deref(), Some("x"));
    }

    #[test]
    fn quarantine_renames() {
        let dir = temp_dir("quarantine");
        write_in(&dir, "broken").unwrap();
        quarantine_in(&dir).unwrap();
        assert_eq!(load_in(&dir).unwrap(), None);
        assert_eq!(
            fs::read_to_string(dir.join("windowsill.json.bad")).unwrap(),
            "broken"
        );
    }

    #[test]
    fn quarantine_overwrites_older_bad_and_tolerates_missing() {
        let dir = temp_dir("quarantine2");
        fs::write(dir.join("windowsill.json.bad"), "older").unwrap();
        write_in(&dir, "newer").unwrap();
        quarantine_in(&dir).unwrap();
        assert_eq!(
            fs::read_to_string(dir.join("windowsill.json.bad")).unwrap(),
            "newer"
        );
        quarantine_in(&dir).unwrap();
    }
}
