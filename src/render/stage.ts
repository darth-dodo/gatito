import { Container, Graphics, GraphicsContext, Sprite, type Application, type Spritesheet } from 'pixi.js';
import { TUNING } from '../brain/tuning';
import type { Pet } from '../brain/types';
import type { Body } from '../sim/world';
import { PART_NAMES, type PartName } from './artNames';
import type { FloatingZ, Heart } from './effects';
import { fadeKey, nextFade, NO_FADE, topAlpha, type FadeState } from './fade';
import { CAT_BOX, CELL, RIG, type RigFrame } from './rig';

/** How long two poses cross-fade so a cat never snaps between them. */
const TRANSITION_MS = 150;
const Z_LIGHT = 0xf4f1ff;
const Z_SHADOW = 0x2a2140;
const Z_ROWS = ['####', '..#.', '.#..', '####'] as const;
/** Size of one "z" pixel in art pixels. */
const Z_BLOCK = 2;
const HEART_LIGHT = 0xff6f91;
const HEART_SHADOW = 0x5c1f36;
const HEART_ROWS = ['.#.#.', '#####', '#####', '.###.', '..#..'] as const;
const HEART_BLOCK = 2;

interface Look {
  root: Container;
  parts: Record<PartName, Sprite>;
  pose: Sprite;
}

interface Entry {
  outer: Container;
  looks: [Look, Look];
  fade: FadeState;
  facing: 1 | -1;
  fx: Container;
  hearts: Container;
  sheet: Spritesheet;
}

/** A centred pixel glyph from '#' rows, with a one-block drop shadow. */
function pixelGlyph(rows: readonly string[], block: number, light: number, shadow: number): GraphicsContext {
  const g = new GraphicsContext();
  const halfW = ((rows[0]?.length ?? 0) * block) / 2;
  const halfH = (rows.length * block) / 2;
  for (const [colour, shift] of [[shadow, block], [light, 0]] as const) {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '#') g.rect(x * block - halfW + shift, y * block - halfH + shift, block, block);
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
  private readonly zGlyph = pixelGlyph(Z_ROWS, Z_BLOCK, Z_LIGHT, Z_SHADOW);
  private readonly heartGlyph = pixelGlyph(HEART_ROWS, HEART_BLOCK, HEART_LIGHT, HEART_SHADOW);

  constructor(app: Application) {
    app.stage.addChild(this.layer);
  }

  add(pet: Pet, atlas: Spritesheet): void {
    this.remove(pet.id);
    atlas.textureSource.scaleMode = 'nearest';
    const outer = new Container({ sortableChildren: true });
    const looks: [Look, Look] = [this.look(atlas), this.look(atlas)];
    looks[1].root.visible = false;
    const fx = new Container();
    fx.scale.set(TUNING.renderScale);
    fx.zIndex = 2;
    const hearts = new Container();
    hearts.scale.set(TUNING.renderScale);
    hearts.zIndex = 2;
    outer.addChild(looks[0].root, looks[1].root, fx, hearts);
    this.layer.addChild(outer);
    this.entries.set(pet.id, { outer, looks, fade: NO_FADE, facing: 1, fx, hearts, sheet: atlas });
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

    // The base look stays at full alpha underneath; a new look fades in on top of it.
    const now = performance.now();
    const key = fadeKey(frame.pose);
    e.fade = nextFade(e.fade, key, now, TRANSITION_MS);
    const base = e.looks[e.fade.base];
    const top = e.looks[e.fade.base === 0 ? 1 : 0];
    const alpha = topAlpha(e.fade, now, TRANSITION_MS);
    base.root.visible = true;
    base.root.alpha = 1;
    base.root.zIndex = 0;
    top.root.visible = e.fade.dir !== null && alpha > 0;
    top.root.alpha = alpha;
    top.root.zIndex = 1;

    // The look showing this pose gets the frame; the other keeps its last one while it fades.
    const look = key === e.fade.baseKey ? base : top;
    look.root.scale.set(facing * s, s);
    look.root.rotation = frame.rotation * facing;
    this.apply(look, frame, e.sheet);
  }

  /** The floating "z"s of a napping pet; an empty list clears them. */
  drawZs(id: string, zs: readonly FloatingZ[]): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.drawGlyphs(e.fx, this.zGlyph, zs, e.facing);
  }

  /** The rising hearts of a purring pet; an empty list clears them. */
  drawHearts(id: string, hearts: readonly Heart[]): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.drawGlyphs(e.hearts, this.heartGlyph, hearts, e.facing);
  }

  private drawGlyphs(
    layer: Container,
    glyph: GraphicsContext,
    items: readonly { x: number; y: number; alpha: number; scale?: number }[],
    facing: 1 | -1,
  ): void {
    while (layer.children.length < items.length) layer.addChild(new Graphics(glyph));
    layer.children.forEach((child, i) => {
      const it = items[i];
      child.visible = it !== undefined;
      if (!it) return;
      child.position.set(it.x * facing, it.y);
      child.alpha = it.alpha;
      child.scale.set(it.scale ?? 1);
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
