// Downsize the textures inside GLBs for mobile (WebP, longest side ≤ --max, default 512; normal maps ≤ half).
// Usage: node scripts/shrink-textures.mjs [--max 512] file.glb …   (in place; geometry / meshopt untouched)
import { stat } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const mi = args.indexOf('--max');
const max = mi >= 0 ? Number(args.splice(mi, 2)[1]) : 512;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
let before = 0, after = 0;
for (const file of args) {
  const b = (await stat(file)).size;
  const doc = await io.read(file);
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [max, max], slots: /^(?!normalTexture).*$/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 88, resize: [max / 2, max / 2], slots: /^normalTexture$/ }),
  );
  await io.write(file, doc);
  const a = (await stat(file)).size; before += b; after += a;
  console.log(`${file.padEnd(48)} ${(b / 1024).toFixed(0).padStart(6)} KB -> ${(a / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`total ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
