use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Monitor};

/// A rectangle in logical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// The usable screen area, in logical pixels relative to the overlay window's
/// actual origin (macOS may place it below the menu bar). `bottom` is the usable area's bottom edge.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Floor {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub bottom: f64,
}

pub fn floor_from(_monitor: Rect, work: Rect, window_origin: (f64, f64)) -> Floor {
    let y = work.y - window_origin.1;
    Floor {
        x: work.x - window_origin.0,
        y,
        width: work.width,
        bottom: y + work.height,
    }
}

/// Monitor and work-area rects in logical pixels.
pub fn monitor_rects(monitor: &Monitor) -> (Rect, Rect) {
    let scale = monitor.scale_factor();
    let to_rect = |pos: &tauri::PhysicalPosition<i32>, size: &tauri::PhysicalSize<u32>| Rect {
        x: f64::from(pos.x) / scale,
        y: f64::from(pos.y) / scale,
        width: f64::from(size.width) / scale,
        height: f64::from(size.height) / scale,
    };
    let work = monitor.work_area();
    (
        to_rect(monitor.position(), monitor.size()),
        to_rect(&work.position, &work.size),
    )
}

fn current_floor(app: &AppHandle) -> Option<Floor> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let (monitor_rect, work_rect) = monitor_rects(&monitor);
    let window = app.get_webview_window("overlay")?;
    let scale = window.scale_factor().ok()?;
    app.state::<crate::overlay::ScaleFactor>().set(scale);
    let origin = window.outer_position().ok()?;
    let origin = (f64::from(origin.x) / scale, f64::from(origin.y) / scale);
    Some(floor_from(monitor_rect, work_rect, origin))
}

#[tauri::command]
pub fn get_floor(app: AppHandle) -> Result<Floor, String> {
    current_floor(&app).ok_or_else(|| "no primary monitor".to_string())
}

/// Poll every 2 s and emit `floor-changed` when the usable area changes.
pub fn start_floor_poll(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = current_floor(&app);
        loop {
            std::thread::sleep(Duration::from_secs(2));
            let now = current_floor(&app);
            if now != last {
                if let Some(floor) = now {
                    let _ = app.emit("floor-changed", floor);
                }
                last = now;
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn floor_uses_work_area_bottom() {
        let monitor = Rect {
            x: 0.0,
            y: 0.0,
            width: 1440.0,
            height: 900.0,
        };
        let work = Rect {
            x: 0.0,
            y: 25.0,
            width: 1440.0,
            height: 800.0,
        };
        assert_eq!(
            floor_from(monitor, work, (0.0, 0.0)),
            Floor {
                x: 0.0,
                y: 25.0,
                width: 1440.0,
                bottom: 825.0
            }
        );
    }

    #[test]
    fn floor_is_relative_to_window_origin() {
        let monitor = Rect {
            x: 0.0,
            y: 0.0,
            width: 1440.0,
            height: 900.0,
        };
        let work = Rect {
            x: 0.0,
            y: 25.0,
            width: 1440.0,
            height: 800.0,
        };
        assert_eq!(
            floor_from(monitor, work, (0.0, 25.0)),
            Floor {
                x: 0.0,
                y: 0.0,
                width: 1440.0,
                bottom: 800.0
            }
        );
    }
}
