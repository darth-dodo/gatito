# macOS release checklist

Run this on a real Mac before publishing a release. It turns the [Success Metrics](product.md#success-metrics) into checks. The release workflow only builds an unsigned draft, so these checks are the gate.

Result values: `pass`, `fail`, `owner` (needs a person at a Mac, not yet done) or `n/a`. Fill in the table at the end and keep one copy per release in the PR description.

## 0. Build and install

- [ ] `npm run tauri build -- --bundles app,dmg` succeeds (checked: dmg 2.22 MiB, app 4.45 MiB, arm64)
- [ ] The built app has no Dock icon (`LSUIElement` is true; checked in the bundled `Info.plist`) and minimum macOS 13.0 (checked)
- [ ] Open the `.dmg`, drag Windowsill to Applications, right-click, Open (unsigned build)
- [ ] First launch with no save file opens the New pet window

## 1. Invisible when working (zero clicks lost)

Open Finder and a browser side by side, with a pet visible above them.

- [ ] 10 clicks on Finder items near the pet but not on it all register
- [ ] 10 clicks on browser links and tabs near the pet but not on it all register
- [ ] Scrolling and typing in the browser behave normally with a pet on screen
- [ ] A click on the pet itself is taken by the pet (pet reacts, Finder does not change)

## 2. Dock positions

For each, check pets stand on the floor just above the Dock and clicks still pass through.

- [ ] Dock at the bottom
- [ ] Dock on the left
- [ ] Dock on the right
- [ ] Dock auto-hidden (pets drop to the screen bottom, nothing jumps when the Dock appears)
- [ ] Changing the Dock position while running re-floors the pets within a few seconds

## 3. Spaces and fullscreen

- [ ] Pets show on every Space (swipe through at least three)
- [ ] Switching to a fullscreen app's Space does not crash or leave a stuck overlay (hiding there is Phase 2)

## 4. Menu bar

- [ ] Menu bar icon appears; there is no Dock icon
- [ ] New pet, per pet Edit, Call over and Rehome work
- [ ] Nap time: on, pets stop changing mood and nap; off, they resume. The setting is remembered after a restart
- [ ] Launch at login toggles

## 5. Petting, tap and drag

- [ ] Stroking a pet with the cursor (no click) purrs, hearts rise, a happy pet rolls belly up
- [ ] Mouse jitter near a pet does not purr it
- [ ] Tapping a pet pets it; three quick taps start a purr
- [ ] Dragging at least 4 px lifts it by the scruff; releasing drops it and it lands on its feet
- [ ] Dropping a pet off screen or onto the Dock area puts it back on the floor

## 6. Tricks

- [ ] Right-click a pet opens the cue ring; it closes on a click outside, after 8 seconds, or when the cursor moves about 200 px away
- [ ] Pick a cue, the pet guesses a trick; petting within 3 seconds rewards it
- [ ] A willing pet learns a trick in 5 to 8 rewarded rounds (record the count below), with a one-time sparkle
- [ ] Tired pets yawn, unhappy ones may walk away

## 7. Pets: New pet, Edit, Rehome

- [ ] New pet: name, coat and personality with a live preview; the pet drops in from the top
- [ ] Edit changes the name, coat and personality of an existing pet
- [ ] Rehome removes a pet (and asks first)

## 8. Remembers

- [ ] Quit from the menu bar and relaunch: names, moods and learned tricks are unchanged
- [ ] Reboot the Mac, launch again: same
- [ ] A corrupted save file is moved aside as `windowsill.json.bad` and New pet opens

## 9. Light (3 pets, 10 minutes)

Create three pets, leave them idle for 10 minutes with normal work going on. In Activity Monitor (CPU and Memory tabs) read the Windowsill process **and** the `com.apple.WebKit.WebContent` and `Networking` processes it owns (hover or use View, All Processes, Hierarchically). Add them up. Turn on the in-app readout first:

```js
localStorage.windowsillDebug = '1'   // in the overlay's web inspector, then relaunch
```

- [ ] Average CPU over 10 minutes is under 2 % (sum of the Windowsill and WebKit processes)
- [ ] Memory is under 150 MB (sum of the same processes)
- [ ] Debug readout frame time stays steady (note the numbers)

## 10. Ten-second delight

- [ ] Show a friend who has never seen it. Within 10 seconds they get the pet-and-trick moment

## Results

Release: v______  Date: ________  Mac / macOS: ________________  Tester: ________

| Check | Result | Notes |
|-------|--------|-------|
| Build, dmg, no Dock icon, min macOS 13.0 | pass | dmg 2.22 MiB, app 4.45 MiB (Windowsill_0.1.0_aarch64.dmg, built 2026-11-01); `LSUIElement` and `LSMinimumSystemVersion` 13.0 present in the bundled Info.plist |
| Built app launches and idles | pass | Built `.app` started via `open -n`; main process RSS 70,992 KB after 8 s and 66,320 KB after 13 s, with no pets yet (first run opens New pet). WebKit child processes could not be attributed to this app from `ps`, so this is the Rust process only and is not the 150 MB figure |
| Install via right-click, Open | owner | |
| Zero clicks lost (Finder, browser) | owner | |
| Dock bottom | owner | |
| Dock left | owner | |
| Dock right | owner | |
| Dock auto-hidden | owner | |
| Pets on every Space | owner | |
| Fullscreen Space switch | owner | |
| Menu bar and Nap time | owner | |
| Petting, tap, drag | owner | |
| Cue ring | owner | |
| Trick learned in 5 to 8 rounds | owner | rounds: ___ (the brain tests assert this; confirm by feel) |
| New pet, Edit, Rehome | owner | |
| State survives quit | owner | |
| State survives reboot | owner | |
| 3 pets, 10 min: CPU under 2 % | owner | measured: ___ % |
| 3 pets, 10 min: memory under 150 MB incl. WebKit | owner | measured: ___ MB (Windowsill ___ + WebContent ___) |
| Debug readout numbers | owner | |
| Ten-second delight | owner | |
