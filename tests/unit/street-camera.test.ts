import { describe, expect, it } from 'vitest';
import { streetCamera, streetCameraCenter, STREET_CAMERA_AREA } from '../../src/data/streetSceneLayout';
import { screenToWorld, worldToScreen } from '../../src/utils/iso';

describe('Street camera safe interior', () => {
  it('shows a wider neighborhood on desktop and phone', () => {
    expect(streetCamera(1280, 720).zoom).toBeLessThan(.75);
    expect(streetCamera(390, 844).zoom).toBeLessThan(.7);
  });
  it.each([[390, 844], [844, 390], [1280, 720], [1024, 1366], [2560, 720], [3840, 2160]])('contains all four corners at %ix%i, even beyond ambulance departure', (w, h) => {
    const z = streetCamera(w!, h!).zoom, vw = w! / z, vh = h! / z;
    for (const x of [-60, -12, 2, 24, 47, 61, 110]) for (const y of [0, 7, 14, 24]) {
      const target = worldToScreen({ x, y });
      const c = streetCameraCenter(target, vw, vh);
      for (const dx of [-vw / 2, vw / 2]) for (const dy of [-vh / 2, vh / 2]) {
        const p = screenToWorld({ x: c.x + dx, y: c.y + dy });
        expect(p.x).toBeGreaterThanOrEqual(STREET_CAMERA_AREA.left + .99);
        expect(p.x).toBeLessThanOrEqual(STREET_CAMERA_AREA.right - .99);
        expect(p.y).toBeGreaterThanOrEqual(STREET_CAMERA_AREA.top + .99);
        expect(p.y).toBeLessThanOrEqual(STREET_CAMERA_AREA.bottom - .99);
      }
    }
  });
});
