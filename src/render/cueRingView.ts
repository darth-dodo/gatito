import { Container, Graphics, Text, type Application } from 'pixi.js';
import type { Rect } from '../ipc';
import type { Cue } from '../brain/types';
import { CUE_ICONS } from '../overlay/cueRing';

const BUTTON_FILL = 0xfffaf0;
const BUTTON_EDGE = 0x2a2140;
const ICON_SHARE = 0.55;

/** Draws the open cue ring: one round button with its emoji per cue. Above the pets. */
export class CueRingView {
  private readonly layer = new Container();
  private shownKey = '';

  constructor(app: Application) {
    app.stage.addChild(this.layer);
  }

  /** Shows `layout`, or hides the ring when it is null. Rebuilds only when the layout changes. */
  draw(layout: readonly { cue: Cue; rect: Rect }[] | null): void {
    const key = layout ? JSON.stringify(layout) : '';
    if (key === this.shownKey) return;
    this.shownKey = key;
    for (const child of this.layer.removeChildren()) child.destroy({ children: true });
    if (!layout) return;
    for (const { cue, rect } of layout) {
      const r = rect.width / 2;
      const cx = rect.x + r;
      const cy = rect.y + rect.height / 2;
      const button = new Graphics()
        .circle(cx, cy, r - 1)
        .fill({ color: BUTTON_FILL, alpha: 0.92 })
        .stroke({ color: BUTTON_EDGE, width: 2, alpha: 0.8 });
      const icon = new Text({ text: CUE_ICONS[cue], style: { fontSize: Math.round(rect.width * ICON_SHARE) } });
      icon.anchor.set(0.5);
      icon.position.set(cx, cy);
      this.layer.addChild(button, icon);
    }
  }
}
