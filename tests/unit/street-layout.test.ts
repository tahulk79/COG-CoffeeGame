import { expect, it } from 'vitest';
import { streetHouses } from '../../src/components/render/streetLayout';

it('keeps a single non-overlapping low frontage and leaves the courtyard and alley clear', () => {
  const houses = streetHouses();
  expect(houses.length).toBeLessThan(40);
  for (const h of houses) {
    expect(h.height).toBeLessThanOrEqual(176);
    if (h.y > 0) {
      expect(h.y + h.d).toBeCloseTo(4.9);
      expect(h.x + h.w <= 19 || h.x >= 26).toBe(true);
    } else expect(h.y + h.d).toBeLessThan(1);
    for (const other of houses) {
      if (other === h) continue;
      expect(h.x < other.x + other.w && h.x + h.w > other.x && h.y < other.y + other.d && h.y + h.d > other.y).toBe(false);
    }
  }
});
