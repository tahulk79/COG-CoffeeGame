import { afterEach, describe, expect, it, vi } from 'vitest';
import { readMuted, toggleMute } from '../../src/core/audioPrefs';

/** Like the browser's sound manager: reading `mute` straight after setting it still gives the old value until it is applied. */
function laggingSound(start: boolean) {
  let shown = start, pending = start;
  return { get mute() { return shown; }, set mute(v: boolean) { pending = v; }, apply: () => { shown = pending; } };
}

function stubStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } });
}

afterEach(() => vi.unstubAllGlobals());

describe('sound preference', () => {
  it('stores the state it switched to, even when the sound manager reports the old value for a moment', () => {
    stubStorage();
    const sound = laggingSound(false);
    expect(toggleMute(sound)).toBe(true);
    expect(readMuted()).toBe(true);
    sound.apply();
    expect(toggleMute(sound)).toBe(false);
    expect(readMuted()).toBe(false);
  });
});
