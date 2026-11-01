use crate::screen::Rect;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// How often the cursor is polled for hit testing.
const POLL_HZ: u64 = 60;
/// How often the `cursor` event is emitted while the cursor is away from every pet.
/// Over a pet (a held pet's hit box is padded, so a drag counts) it goes at `POLL_HZ`,
/// because the front end reads petting strokes from these positions: macOS sends no
/// mouse-moved events to the unfocused overlay.
const CURSOR_EMIT_HZ: u64 = 20;

/// A point in logical pixels, relative to the overlay window.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Pet hit boxes (logical px, window-relative), set by the front end.
#[derive(Default)]
pub struct HitBoxes(Mutex<Vec<Rect>>);

/// The overlay window's scale factor, cached so the 60 Hz cursor poll does not ask the main thread for it.
/// The 2 s floor poll refreshes it (a display change or a move to another monitor).
pub struct ScaleFactor(AtomicU64);

impl Default for ScaleFactor {
    fn default() -> Self {
        Self(AtomicU64::new(1.0_f64.to_bits()))
    }
}

impl ScaleFactor {
    pub fn get(&self) -> f64 {
        f64::from_bits(self.0.load(Ordering::Relaxed))
    }

    /// Stores a new factor; ignores values that are not positive and finite.
    pub fn set(&self, scale: f64) {
        if scale.is_finite() && scale > 0.0 {
            self.0.store(scale.to_bits(), Ordering::Relaxed);
        }
    }
}

/// True when `p` is inside any box; edges are inclusive.
pub fn cursor_hits(boxes: &[Rect], p: Point) -> bool {
    boxes
        .iter()
        .any(|b| p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height)
}

/// True when poll tick `tick` should emit `cursor`: every tick while over a pet hit box,
/// otherwise every `POLL_HZ / CURSOR_EMIT_HZ` ticks.
pub fn should_emit_cursor(tick: u64, over_pet: bool) -> bool {
    over_pet || tick.is_multiple_of((POLL_HZ / CURSOR_EMIT_HZ).max(1))
}

/// Convert a physical screen cursor position to logical window coordinates.
pub fn to_window_space(
    cursor_physical: (f64, f64),
    window_origin_physical: (f64, f64),
    scale_factor: f64,
) -> Point {
    Point {
        x: (cursor_physical.0 - window_origin_physical.0) / scale_factor,
        y: (cursor_physical.1 - window_origin_physical.1) / scale_factor,
    }
}

#[tauri::command]
pub fn set_hitboxes(state: State<HitBoxes>, boxes: Vec<Rect>) {
    if let Ok(mut guard) = state.0.lock() {
        *guard = boxes;
    }
}

/// Transparent, borderless, always-on-top window covering the primary monitor.
/// It starts ignoring cursor events; the poll below enables them over pets.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let monitor = app
        .primary_monitor()?
        .ok_or_else(|| tauri::Error::WindowNotFound)?;
    let scale = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();

    let window = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
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
    window.set_ignore_cursor_events(true)?;
    app.state::<ScaleFactor>()
        .set(window.scale_factor().unwrap_or(scale));
    Ok(())
}

/// Poll the cursor at `POLL_HZ`: toggle click-through only when the hit result
/// changes, and emit `cursor` at `POLL_HZ` over a pet, `CURSOR_EMIT_HZ` elsewhere.
pub fn start_cursor_poll(app: AppHandle) {
    std::thread::spawn(move || {
        let mut tick: u64 = 0;
        let mut ignoring = true;
        loop {
            std::thread::sleep(Duration::from_millis(1000 / POLL_HZ));
            let Some(window) = app.get_webview_window("overlay") else {
                continue;
            };
            let (Ok(cursor), Ok(origin)) = (app.cursor_position(), window.outer_position()) else {
                continue;
            };
            let scale = app.state::<ScaleFactor>().get();
            let point = to_window_space(
                (cursor.x, cursor.y),
                (f64::from(origin.x), f64::from(origin.y)),
                scale,
            );
            let hit = app
                .state::<HitBoxes>()
                .0
                .lock()
                .map(|boxes| cursor_hits(&boxes, point))
                .unwrap_or(false);
            if ignoring == hit && window.set_ignore_cursor_events(!hit).is_ok() {
                ignoring = !hit;
            }
            if should_emit_cursor(tick, hit) {
                let _ = app.emit("cursor", point);
            }
            tick = tick.wrapping_add(1);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scale_factor_cache_round_trips_and_rejects_nonsense() {
        let cache = ScaleFactor::default();
        assert_eq!(cache.get(), 1.0);
        cache.set(2.0);
        assert_eq!(cache.get(), 2.0);
        cache.set(0.0);
        cache.set(f64::NAN);
        assert_eq!(cache.get(), 2.0);
    }

    fn boxes() -> Vec<Rect> {
        vec![Rect {
            x: 100.0,
            y: 200.0,
            width: 64.0,
            height: 64.0,
        }]
    }

    #[test]
    fn cursor_hits_inside_box() {
        assert!(cursor_hits(&boxes(), Point { x: 120.0, y: 230.0 }));
    }

    #[test]
    fn cursor_hits_false_outside_box() {
        assert!(!cursor_hits(&boxes(), Point { x: 99.0, y: 230.0 }));
        assert!(!cursor_hits(&boxes(), Point { x: 120.0, y: 265.0 }));
    }

    #[test]
    fn cursor_hits_false_with_no_boxes() {
        assert!(!cursor_hits(&[], Point { x: 0.0, y: 0.0 }));
    }

    #[test]
    fn cursor_hits_true_on_edges() {
        assert!(cursor_hits(&boxes(), Point { x: 100.0, y: 200.0 }));
        assert!(cursor_hits(&boxes(), Point { x: 164.0, y: 264.0 }));
    }

    #[test]
    fn should_emit_cursor_every_tick_over_a_pet() {
        assert!((0..10).all(|t| should_emit_cursor(t, true)));
    }

    #[test]
    fn should_emit_cursor_at_the_slow_rate_elsewhere() {
        let every = POLL_HZ / CURSOR_EMIT_HZ;
        assert_eq!(every, 3);
        let emitted: Vec<u64> = (0..10).filter(|&t| should_emit_cursor(t, false)).collect();
        assert_eq!(emitted, vec![0, 3, 6, 9]);
    }

    #[test]
    fn to_window_space_subtracts_origin_and_scales() {
        let p = to_window_space((700.0, 450.0), (100.0, 50.0), 2.0);
        assert_eq!(p, Point { x: 300.0, y: 200.0 });
    }
}
