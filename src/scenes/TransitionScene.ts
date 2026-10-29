import Phaser from 'phaser';
import { queueWorldAssets } from '../components/render/worldAssets';

export const TRANSITION_SCENE = 'TransitionScene';

/** Page load: the loading screen shows progress until `ready`, then `start`s the world. */
export interface BootGate {
  ready: Promise<unknown>;
  start: () => void;
}

/**
 * Story transition that survives the world scene restarting for the new map: the HTML loading screen
 * (index.html: the hero running, the next chapter's name, a bar) covers the screen (`close`) while the next
 * map loads, then fades out on it (`open`). On page load it is the start-up loading screen (`boot`).
 */
export class TransitionScene extends Phaser.Scene {
  /** The loading screen is up and waiting for the new map. */
  closed = false;

  private pending: { label: string } | null = null;
  private boot: BootGate | null = null;
  private progress = 0;
  /** The HTML loading screen while a new map loads. */
  private loader: HTMLElement | null = null;

  constructor() {
    super(TRANSITION_SCENE);
  }

  /** Launched with `{ close: { label } }`: the loading screen shows as soon as the scene exists; `{ boot }`: start-up. */
  init(data: { close?: { label: string }; boot?: BootGate }): void {
    this.pending = data.close ?? null;
    this.boot = data.boot ?? null;
    this.closed = !!this.pending || !!this.boot;
  }

  create(): void {
    if (this.pending) this.close(this.pending.label);
    this.pending = null;
    if (this.boot) this.runBoot(this.boot);
  }

  /**
   * Loading: the HTML screen in index.html stays up until the game is ready. Progress goes to its bar, and it fades
   * out as the world starts.
   */
  private runBoot(gate: BootGate): void {
    this.closed = false;
    const screen = document.getElementById('boot'), fill = screen?.querySelector<HTMLElement>('.bar i') ?? null;
    const started = this.time.now;
    let ready = false, loaded = false, files = 0;
    void gate.ready.then(() => { ready = true; });
    // The world's images load now, alongside the font (not after it): the bar follows the real download.
    if (queueWorldAssets(this.load, this.textures)) {
      this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => { files = v; });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => { files = 1; loaded = true; });
      this.load.start();
    } else { files = 1; loaded = true; }
    const tick = () => {
      // The font is the first sliver, the images most of the bar; the last bit is the world being built.
      const target = (ready ? 0.15 : 0.08) + 0.77 * files;
      this.progress += (target - this.progress) * 0.15;
      if (fill) fill.style.width = `${Math.round(Math.max(0.08, this.progress) * 100)}%`;
      if (ready && loaded && this.time.now - started > 600) {
        this.events.off(Phaser.Scenes.Events.UPDATE, tick);
        this.boot = null;
        if (fill) fill.style.width = '95%';
        // Stays up until the street has been built and drawn (two frames after its create), so there is never a blank
        // screen between the loading screen and the game.
        const world = this.scene.get('WorldScene');
        world.events.once(Phaser.Scenes.Events.CREATE, () => requestAnimationFrame(() => requestAnimationFrame(() => {
          if (fill) fill.style.width = '100%';
          screen?.classList.add('done');
          window.setTimeout(() => screen?.remove(), 400);
        })));
        gate.start();
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
  }

  /** Between maps: the same loading screen as at start-up, with the next chapter's name. */
  close(label = ''): void {
    this.scene.bringToTop();
    this.closed = true;
    this.loader = showLoader(label);
  }

  /** On the new map: the bar completes and the loading screen fades out, then the scene stops. */
  open(): void {
    if (!this.closed) return;
    this.closed = false;
    const screen = this.loader;
    this.loader = null;
    const fill = screen?.querySelector<HTMLElement>('.bar i');
    if (fill) fill.style.width = '100%';
    window.setTimeout(() => { screen?.classList.add('done'); window.setTimeout(() => screen?.remove(), 400); this.scene.stop(); }, 250);
  }
}

/**
 * The loading screen (styles in index.html): the hero running on the spot, `label` and a bar creeping towards
 * 90 % until the caller completes it. Built on demand when the start-up one is gone.
 */
function showLoader(label: string): HTMLElement {
  let screen = document.getElementById('boot');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'boot';
    screen.setAttribute('role', 'status');
    screen.setAttribute('aria-live', 'polite');
    screen.className = 'done';
    screen.innerHTML = '<div class="runner" aria-hidden="true"></div><div class="ground" aria-hidden="true"></div><div class="label"></div><div class="bar"><i></i></div>';
    document.body.appendChild(screen);
    // Next frame: fade in from transparent.
    requestAnimationFrame(() => screen!.classList.remove('done'));
  } else screen.classList.remove('done');
  screen.querySelector('.label')!.textContent = label || 'Đang tải…';
  const fill = screen.querySelector<HTMLElement>('.bar i')!;
  let p = 0.08;
  fill.style.width = '8%';
  const creep = window.setInterval(() => {
    if (!screen!.isConnected || fill.style.width === '100%') { window.clearInterval(creep); return; }
    p += (0.9 - p) * 0.08;
    fill.style.width = `${Math.round(p * 100)}%`;
  }, 100);
  return screen;
}
