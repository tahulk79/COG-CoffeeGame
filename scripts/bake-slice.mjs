// Bakes the alpha analysis of every chapter 1 sprite sheet (frame cuts + spilled pixels to erase) into src/data/sliceBake.json.
// Run after adding or changing a sheet in public/assets/slice/chapter1: node scripts/bake-slice.mjs   (dev server must be running)
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5180';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(base);
const baked = await page.evaluate(async () => {
  const { SLICE_ASSETS, sheetCanvasSize } = await import('/src/components/render/sliceAssets.ts');
  const { analyzeSheet } = await import('/src/components/render/sliceClean.ts');
  const out = {};
  for (const asset of Object.values(SLICE_ASSETS)) {
    const image = new Image(); image.src = asset.url; await image.decode();
    const { w, h } = sheetCanvasSize(asset, image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, w, h);
    const plan = analyzeSheet(new Uint32Array(ctx.getImageData(0, 0, w, h).data.buffer), w, h, asset.columns, asset.rows);
    out[asset.key] = { url: asset.url, w, h, ...plan };
  }
  return out;
});
await browser.close();
const result = {};
for (const key of Object.keys(baked).sort()) {
  const { url, ...plan } = baked[key];
  // The hash ties the plan to the exact file: tests/unit/slice-bake.test.ts fails when art changes without a re-bake.
  result[key] = { src: createHash('sha1').update(readFileSync(`public${url}`)).digest('hex'), ...plan };
}
writeFileSync('src/data/sliceBake.json', '{\n' + Object.entries(result).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
console.log(`baked ${Object.keys(result).length} sheets, ${Object.values(result).reduce((n, v) => n + v.cuts.length, 0)} frames, ${Object.values(result).reduce((n, v) => n + v.erase.length, 0)} erase boxes`);
