import Phaser from 'phaser';

/** Short generated click, routed through the game's master mute and volume. */
export function uiClick(scene: Phaser.Scene): void {
  const sound = scene.sound;
  if (!(sound instanceof Phaser.Sound.WebAudioSoundManager) || sound.mute || document.hidden) return;
  const ctx = sound.context;
  if (ctx.state !== 'running') { void ctx.resume().catch(() => undefined); return; }
  const oscillator = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(680, t);
  oscillator.frequency.exponentialRampToValueAtTime(420, t + .045);
  gain.gain.setValueAtTime(.035, t);
  gain.gain.exponentialRampToValueAtTime(.0001, t + .05);
  oscillator.connect(gain).connect(sound.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(t); oscillator.stop(t + .055);
}
