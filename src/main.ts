import Phaser from 'phaser';
import { readIncidentReview } from './ui/dev/IncidentReview';
import { HudScene } from './scenes/HudScene';
import { WorldScene, type WorldSceneData } from './scenes/WorldScene';
import { TRANSITION_SCENE, TransitionScene } from './scenes/TransitionScene';
import { readMuted } from './core/audioPrefs';
import { PIXEL_RATIO } from './ui/layout/pixelRatio';

// Every page load starts chapter 1; in-session travel still carries progress to chapter 2.
const params = new URLSearchParams(window.location.search);
// Chapter / map shortcuts are for development only: a shipped build always starts at chapter 1.
const mapParam = readIncidentReview() ? 'incident' : import.meta.env.DEV ? params.get('map') : null;
// TEMP (dev test): `?chap=1|2|3` starts that chapter directly. Remove with `startChapter` in WorldScene and session.ts.
const chapParam = import.meta.env.DEV ? ({ '1': 'S03', '2': 'S04', '3': 'S05' } as Record<string, string>)[params.get('chap') ?? ''] : undefined;
const start: WorldSceneData = { ...(mapParam && !chapParam ? { mapId: mapParam } : {}), ...(chapParam ? { startChapter: chapParam } : {}), persistent: true, restartStory: true };

// Phaser draws text once into a canvas: the game font must be loaded before the world is built, or every
// label keeps the fallback. Never waits long: offline or slow networks go on after 2.5 s with the fallback.
const fontsReady = Promise.race([
  Promise.all(['500', '700', '800'].map((w) => document.fonts.load(`${w} 16px "Baloo 2"`, 'Tiếng Việt'))),
  new Promise((r) => setTimeout(r, 2500)),
]).catch(() => undefined);

// Sharp on phones: the canvas has PIXEL_RATIO device pixels per CSS pixel and is shown at its CSS size
// (`zoom`); scenes lay out in CSS pixels and zoom their cameras by PIXEL_RATIO (see ui/layout/pixelRatio).
const parent = document.getElementById('game');
const viewport = () => ({ w: parent?.clientWidth || window.innerWidth, h: parent?.clientHeight || window.innerHeight });
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#fff4e0',
  scale: { mode: Phaser.Scale.NONE, width: Math.round(viewport().w * PIXEL_RATIO), height: Math.round(viewport().h * PIXEL_RATIO), zoom: 1 / PIXEL_RATIO },
  // Smoother downscaling for power-of-two textures (Phaser leaves the others as they are).
  render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  input: { activePointers: 2 },
  loader: { timeout: 15000 },
  scene: [],
});
// NONE mode does not follow the window by itself: resize the canvas (and fire RESIZE) on every viewport change.
const fitCanvas = () => {
  const { w, h } = viewport();
  if (Math.round(w * PIXEL_RATIO) !== game.scale.width || Math.round(h * PIXEL_RATIO) !== game.scale.height) game.scale.resize(Math.round(w * PIXEL_RATIO), Math.round(h * PIXEL_RATIO));
};
window.addEventListener('resize', fitCanvas);
window.visualViewport?.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', () => requestAnimationFrame(fitCanvas));
// The saved sound choice applies from the first frame (the loading doors already make sound).
game.sound.mute = readMuted();
game.scene.add('WorldScene', WorldScene, false);
game.scene.add('HudScene', HudScene, false);
// Added last so it draws above the world and the HUD. On page load it is the loading screen: shut heavenly
// doors with a progress bar; once the font is in, the world starts and opens them.
game.scene.add(TRANSITION_SCENE, TransitionScene, false);
game.scene.start(TRANSITION_SCENE, { boot: { ready: fontsReady, start: () => game.scene.start('WorldScene', start) } });

if (import.meta.env.DEV) (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;

// Opt-in only, including production phone checks; never shown in the normal handoff UI.
if (params.has('fps')) void import('./core/perfReport').then(({ installPerfReport }) => installPerfReport(game));
