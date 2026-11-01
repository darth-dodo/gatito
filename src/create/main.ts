import { getCurrentWindow } from '@tauri-apps/api/window';
import { Application } from 'pixi.js';
import { validateName } from '../brain/names';
import type { SaveFile } from '../brain/save';
import type { Colour, Mood, Personality, Pet, Style } from '../brain/types';
import { ipc } from '../ipc';
import { interpretSave, type ChangeKind } from '../overlay/persistence';
import { hasAtlas, loadAtlas } from '../render/atlas';
import { CAT_BOX, rigPose } from '../render/rig';
import { PetStage } from '../render/stage';
import type { Body } from '../sim/world';
import {
  colourOptions,
  formState,
  newPet,
  PERSONALITY_OPTIONS,
  SPECIES_OPTIONS,
  STYLE_OPTIONS,
  withEdit,
  withNewPet,
  withoutPet,
  type Option,
} from './form';

const PREVIEW_PX = 144;
const PREVIEW_ID = 'preview';
const NEWBORN_MOOD: Mood = { affection: 60, energy: 80 };

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`create.html is missing #${id}`);
  return found as T;
}

function fill<T extends string>(select: HTMLSelectElement, options: readonly Option<T>[]): void {
  select.replaceChildren(
    ...options.map((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.note ? `${o.label} (${o.note})` : o.label;
      opt.disabled = !o.enabled;
      return opt;
    }),
  );
}

/** Reads the save from disk; the overlay keeps it current and is its only writer. */
async function currentSave(): Promise<SaveFile> {
  return interpretSave(await ipc.loadSave()).save;
}

/** A small stage that shows the chosen coat sitting, at the same scale as on the desktop. */
async function startPreview(container: HTMLElement, mood: Mood): Promise<(pet: Pet) => Promise<void>> {
  const app = new Application();
  await app.init({
    width: PREVIEW_PX,
    height: PREVIEW_PX,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    antialias: false,
    roundPixels: true,
  });
  container.appendChild(app.canvas);
  const stage = new PetStage(app);
  const width = CAT_BOX.right - CAT_BOX.left;
  const height = CAT_BOX.bottom - CAT_BOX.top;
  const body: Body = {
    id: PREVIEW_ID,
    x: (PREVIEW_PX - width) / 2,
    y: (PREVIEW_PX - height) / 2,
    vx: 0,
    vy: 0,
    facing: 1,
    held: false,
    grounded: true,
    width,
    height,
  };
  let t = 0;
  app.ticker.add((ticker) => {
    t += ticker.deltaMS / 1000;
    stage.draw(PREVIEW_ID, body, rigPose('idle-sit', t, mood));
  });
  let shown: Colour | null = null;
  return async (pet) => {
    if (pet.colour === shown) return;
    shown = pet.colour;
    const atlas = await loadAtlas(pet.species, pet.colour);
    if (shown === pet.colour) stage.add({ ...pet, id: PREVIEW_ID }, atlas);
  };
}

async function main(): Promise<void> {
  const win = getCurrentWindow();
  const save = await currentSave();
  const target = await ipc.createWindowTarget();
  const editing = save.pets.find((p) => p.id === target.petId) ?? null;

  const form = el<HTMLFormElement>('pet-form');
  const species = el<HTMLSelectElement>('species');
  const name = el<HTMLInputElement>('name');
  const nameError = el<HTMLParagraphElement>('name-error');
  const style = el<HTMLSelectElement>('style');
  const colour = el<HTMLSelectElement>('colour');
  const personality = el<HTMLSelectElement>('personality');
  const limitNote = el<HTMLParagraphElement>('limit-note');
  const submit = el<HTMLButtonElement>('submit');
  const rehome = el<HTMLButtonElement>('rehome');
  const dialog = el<HTMLDialogElement>('confirm-rehome');

  const colours = colourOptions((c) => hasAtlas('cat', c));
  fill(species, SPECIES_OPTIONS);
  fill(style, STYLE_OPTIONS);
  fill(colour, colours);
  fill(personality, PERSONALITY_OPTIONS);

  if (editing) {
    const title = `Edit ${editing.name}`;
    document.title = title;
    el('heading').textContent = title;
    submit.textContent = 'Save';
    rehome.hidden = false;
    species.value = editing.species;
    name.value = editing.name;
    style.value = editing.style;
    colour.value = editing.colour;
    personality.value = editing.personality;
  } else {
    colour.value = colours.find((o) => o.enabled)?.value ?? 'orange-tabby';
  }

  let touched = false;
  const render = (): void => {
    const s = formState({ pets: save.pets, editing, name: name.value });
    species.disabled = s.speciesReadOnly;
    personality.disabled = s.personalityReadOnly;
    submit.disabled = !s.canSubmit;
    limitNote.textContent = s.limitNote ?? '';
    nameError.textContent = touched ? (s.nameError ?? '') : '';
    name.setAttribute('aria-invalid', String(touched && s.nameError !== null));
  };

  const fields = (): { colour: Colour; style: Style; personality: Personality } => ({
    colour: colour.value as Colour,
    style: style.value as Style,
    personality: personality.value as Personality,
  });

  const showPreview = await startPreview(el('preview'), editing?.mood ?? NEWBORN_MOOD);
  const refreshPreview = (): void => {
    void showPreview(newPet({ name: '', ...fields() }, PREVIEW_ID));
  };

  name.addEventListener('input', () => {
    touched = true;
    render();
  });
  colour.addEventListener('change', refreshPreview);
  style.addEventListener('change', refreshPreview);
  el('cancel').addEventListener('click', () => void win.close());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dialog.open) void win.close();
  });

  const send = async (
    kind: ChangeKind,
    id: string,
    next: (latest: SaveFile) => SaveFile,
  ): Promise<void> => {
    submit.disabled = true;
    await ipc.emitPetsChanged({ save: next(await currentSave()), change: { kind, id } });
    await win.close();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    touched = true;
    render();
    const checked = validateName(name.value);
    if (submit.disabled || !checked.ok) return;
    const f = fields();
    if (editing) {
      void send('edit', editing.id, (latest) =>
        withEdit(latest, editing.id, { name: checked.name, colour: f.colour, style: f.style }),
      );
    } else {
      const pet = newPet({ name: checked.name, ...f }, crypto.randomUUID());
      void send('add', pet.id, (latest) => withNewPet(latest, pet));
    }
  });

  const askRehome = (): void => {
    if (!editing) return;
    el('confirm-text').textContent = `Rehome ${editing.name}? They will leave your desktop for good.`;
    el('confirm-keep').textContent = `Keep ${editing.name}`;
    dialog.showModal();
  };
  rehome.addEventListener('click', askRehome);
  el('confirm-keep').addEventListener('click', () => dialog.close());
  el('confirm-go').addEventListener('click', () => {
    dialog.close();
    if (editing) void send('rehome', editing.id, (latest) => withoutPet(latest, editing.id));
  });

  await ipc.onCreateTarget(() => window.location.reload());

  render();
  refreshPreview();
  name.focus();
  // Menu "Rehome…" opens the window straight on the confirmation.
  if (target.rehome) askRehome();
}

void main();
