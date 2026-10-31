import { Container, Graphics, GraphicsContext, Sprite, type Application, type Spritesheet } from 'pixi.js';
import { TUNING } from '../brain/tuning';
import type { Pet } from '../brain/types';
import type { Body } from '../sim/world';
import { PART_NAMES, type PartName } from './artNames';
import type { FloatingZ } from './effects';
import { CAT_BOX, CELL, RIG, type RigFrame } from './rig';

/** How long two poses cross-fade so a cat never snaps between them. */
const TRANSITION_MS = 150;
const Z_LIGHT = 0xf4f1ff;
const Z_SHADOW = 0x2a2140;
const Z_ROWS = ['####', '..#.', '.#..', '####'] as const;

interface Look {
  root: Container;
  parts: Record<PartName, Sprite>;
  pose: Sprite;
}

interface Entry {
  outer: Container;
  looks: [Look, Look];
  active: 0 | 1;
  shown: RigFrame['pose'] | null;
  fadeStart: number;
  facing: 1 | -1;
  fx: Container;
  sheet: Spritesheet;
}

function zGlyph(): GraphicsContext {
  const g = new GraphicsContext();
  const half = Z_ROWS.length / 2;
  for (const [colour, shift] of [[Z_SHADOW, 1], [Z_LIGHT, 0]] as const) {
    Z_ROWS.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '#') g.rect(x - half + shift, y - half + shift, 1, 1);
      });
    });
    g.fill(colour);
  }
  return g;
}

/** Draws every pet as a puppet of atlas parts and key poses, at a whole-number pixel scale. */
export class PetStage {
  private readonly layer = new Container();
  private readonly entries = new Map<string, Entry>();
  private readonly glyph = zGlyph();

  constructor(app: Application) {
    app.stage.addChild(this.layer);
  }

  add(pet: Pet, atlas: Spritesheet): void {
    this.remove(pet.id);
    atlas.textureSource.scaleMode = 'nearest';
    const outer = new Container();
    const looks: [Look, Look] = [this.look(atlas), this.look(atlas)];
    looks[1].root.visible = false;
    const fx = new Container();
    fx.scale.set(TUNING.renderScale);
    outer.addChild(looks[0].root, looks[1].root, fx);
    this.layer.addChild(outer);
    this.entries.set(pet.id, {
      outer, looks, active: 0, shown: null, fadeStart: 0, facing: 1, fx, sheet: atlas,
    });
  }

  remove(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.outer.destroy({ children: true });
    this.entries.delete(id);
  }

  draw(id: string, body: Body, frame: RigFrame): void {
    const e = this.entries.get(id);
    if (!e) return;
    const s = TUNING.renderScale;
    const facing: 1 | -1 = frame.flipX ? (-body.facing as 1 | -1) : body.facing;
    e.facing = facing;

    // The body pivot inside the cell, mirrored about the cell centre when facing left.
    const [ax, ay] = RIG.body.anchor;
    const pivotX = facing === 1 ? ax * CELL : CELL - ax * CELL;
    e.outer.position.set(
      Math.round(body.x + (pivotX - CAT_BOX.left) * s),
      Math.round(body.y + (ay * CELL - CAT_BOX.top) * s),
    );

    const now = performance.now();
    if (frame.pose !== e.shown) {
      if (e.shown !== null) {
        e.active = e.active === 0 ? 1 : 0;
        e.fadeStart = now;
      }
      e.shown = frame.pose;
    }
    const k = Math.min(1, (now - e.fadeStart) / TRANSITION_MS);
    const look = e.looks[e.active];
    const old = e.looks[e.active === 0 ? 1 : 0];
    look.root.visible = true;
    look.root.alpha = k;
    old.root.alpha = 1 - k;
    old.root.visible = k < 1;

    look.root.scale.set(facing * s, s);
    look.root.rotation = frame.rotation * facing;
    this.apply(look, frame, e.sheet);
  }

  /** The floating "z"s of a napping pet; an empty list clears them. */
  drawZs(id: string, zs: readonly FloatingZ[]): void {
    const e = this.entries.get(id);
    if (!e) return;
    while (e.fx.children.length < zs.length) e.fx.addChild(new Graphics(this.glyph));
    e.fx.children.forEach((child, i) => {
      const z = zs[i];
      child.visible = z !== undefined;
      if (!z) return;
      child.position.set(z.x * e.facing, z.y);
      child.alpha = z.alpha;
      child.scale.set(z.scale);
    });
  }

  private look(atlas: Spritesheet): Look {
    const root = new Container({ sortableChildren: true });
    const parts = {} as Record<PartName, Sprite>;
    for (const name of PART_NAMES) {
      const sprite = new Sprite(atlas.textures[name]);
      sprite.anchor.set(...RIG[name].anchor);
      sprite.zIndex = RIG[name].z;
      parts[name] = sprite;
      root.addChild(sprite);
    }
    const pose = new Sprite();
    pose.anchor.set(...RIG.body.anchor);
    pose.zIndex = RIG.body.z;
    root.addChild(pose);
    return { root, parts, pose };
  }

  private apply(look: Look, frame: RigFrame, sheet: Spritesheet): void {
    const posed = frame.pose !== 'puppet';
    if (posed) {
      const b = frame.parts.body;
      look.pose.texture = sheet.textures[frame.pose]!;
      look.pose.visible = b?.visible ?? true;
      look.pose.position.set(b?.x ?? 0, b?.y ?? 0);
      look.pose.rotation = b?.rotation ?? 0;
    } else {
      look.pose.visible = false;
    }
    for (const name of PART_NAMES) {
      const sprite = look.parts[name];
      const p = frame.parts[name];
      if (!p || (posed && name === 'body')) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = p.visible;
      sprite.position.set(p.x, p.y);
      sprite.rotation = p.rotation;
    }
  }
}
