import Phaser from 'phaser';
import { HudScene } from './scenes/HudScene';
import { WorldScene, type WorldSceneData } from './scenes/WorldScene';
import { TRANSITION_SCENE, TransitionScene } from './scenes/TransitionScene';
import { readMuted } from './core/audioPrefs';

// ?map=sandbox opens the M1 movement sandbox (never saved). Default: the map you were last on (farm for a new game).
const params = new URLSearchParams(window.location.search);
const mapParam = params.get('map');
const start: WorldSceneData = { ...(mapParam ? { mapId: mapParam } : {}), persistent: mapParam !== 'sandbox', fresh: params.has('fresh') };

// Phaser draws text once into a canvas: the game font must be loaded before the world is built, or every
// label keeps the fallback. Never waits long: offline or slow networks go on after 2.5 s with the fallback.
const fontsReady = Promise.race([
  Promise.all(['500', '700', '800'].map((w) => document.fonts.load(`${w} 16px "Baloo 2"`, 'Tiếng Việt'))),
  new Promise((r) => setTimeout(r, 2500)),
]).catch(() => undefined);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#fff4e0',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  input: { activePointers: 2 },
  scene: [],
});
// The saved sound choice applies from the first frame (the loading doors already make sound).
game.sound.mute = readMuted();
game.scene.add('WorldScene', WorldScene, false);
game.scene.add('HudScene', HudScene, false);
// Added last so it draws above the world and the HUD. On page load it is the loading screen: shut heavenly
// doors with a progress bar; once the font is in, the world starts and opens them.
game.scene.add(TRANSITION_SCENE, TransitionScene, false);
game.scene.start(TRANSITION_SCENE, { boot: { ready: fontsReady, start: () => game.scene.start('WorldScene', start) } });

if (import.meta.env.DEV) (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;
