import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import SLICE_BAKE from '../../src/data/sliceBake.json';
import { SLICE_ASSETS } from '../../src/components/render/sliceAssets';

describe('baked sprite-sheet plans', () => {
  it.each(Object.values(SLICE_ASSETS).map(a => [a.key, a.url] as const))('%s matches its file (re-run scripts/bake-slice.mjs when art changes)', (key, url) => {
    const baked = (SLICE_BAKE as Record<string, { src: string; cuts: unknown[] }>)[key];
    expect(baked, 'no baked plan').toBeDefined();
    expect(baked!.src).toBe(createHash('sha1').update(readFileSync(`public${url}`)).digest('hex'));
    expect(baked!.cuts.length).toBeGreaterThan(0);
  });
});
