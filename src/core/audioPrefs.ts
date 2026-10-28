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

/**
 * Flips sound on/off and returns whether it is now muted. The new value is computed first and stored as such:
 * reading `sound.mute` straight after setting it can still return the old value, which used to store the previous state.
 */
export function toggleMute(sound: { mute: boolean }): boolean {
  const next = !sound.mute;
  sound.mute = next;
  try {
    window.localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts for this session only */
  }
  return next;
}
