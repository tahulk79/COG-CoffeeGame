/**
 * Sound on/off, remembered between sessions (M key, or the sound button on the HUD).
 * v2 key: the first mix was so quiet that players muted it thinking they were turning sound on;
 * everyone starts with sound on again.
 */
const KEY = 'tcss.audio.mute.v2';

export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function toggleMute(sound: { mute: boolean }): void {
  sound.mute = !sound.mute;
  try {
    window.localStorage.setItem(KEY, sound.mute ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts for this session only */
  }
}

