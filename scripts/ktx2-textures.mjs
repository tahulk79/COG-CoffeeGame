// Compress textures to KTX2 / Basis Universal so they stay compressed in GPU memory (about 4× less VRAM than PNG/JPG/WebP,
// which the GPU holds as raw RGBA). Usage:
//   node scripts/ktx2-textures.mjs [--dry] [files.glb …]    GLBs (default: every public/models/**/*.glb, in place)
//   node scripts/ktx2-textures.mjs --env                    farm ground textures public/assets/farm/env/*.jpg → .ktx2 beside them
// Everything ETC1S by default: UASTC measured 4–7× larger than the JPG/WebP it replaces (grass.jpg 335 KB → UASTC 1.2 MB,
// ETC1S q128 186 KB), too much to download on a phone. Normal maps: ETC1S q255 with the normal-map preset, linear. Sizes are rounded to a power of two (block formats and
// mipmaps on every GPU). Runtime: src/shared/three/ktx2.js (the loader) and public/basis/ (the transcoder).
import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';
import sharp from 'sharp';

const ROOT = 'public/models', ENV = 'public/assets/farm/env';
const args = process.argv.slice(2);
const dry = args.includes('--dry'), env = args.includes('--env');
const files = args.filter(a => a.endsWith('.glb'));
// Tuning (env vars, for experiments): KTX2_NORMAL=etc1s|uastc, KTX2_ALPHA=etc1s|uastc, KTX2_RDO=<UASTC RDO scalar, higher = smaller>.
const NORMAL_MODE = process.env.KTX2_NORMAL || 'etc1s', ALPHA_MODE = process.env.KTX2_ALPHA || 'etc1s', DATA_MODE = process.env.KTX2_DATA || 'etc1s', RDO = Number(process.env.KTX2_RDO || 1);
const Q = Number(process.env.KTX2_Q || 128), NORMAL_HALF = process.env.KTX2_NORMAL_HALF === '1'; // ETC1S quality 1-255; halve normal maps
const COLOR_SLOTS = /baseColor|emissive|specularColor|sheenColor|diffuse/i;

const pot = n => 2 ** Math.round(Math.log2(n));
// Decode → RGBA at power-of-two size. Returns the raster and whether any pixel is not fully opaque.
async function decode(buffer, scale = 1) {
  const img = sharp(Buffer.from(buffer)), meta = await img.metadata();
  const width = Math.max(4, pot(meta.width * scale)), height = Math.max(4, pot(meta.height * scale));
  const { data, info } = await img.resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let alpha = false;
  if (meta.hasAlpha) for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { alpha = true; break; }
  return { data: new Uint8Array(data), width: info.width, height: info.height, srcW: meta.width, srcH: meta.height, alpha };
}

async function encode(buffer, kind, flipY = false) {
  const raster = await decode(buffer, kind === 'normal' && NORMAL_HALF ? .5 : 1);
  const imageDecoder = async () => raster;
  const color = kind === 'color', normal = kind === 'normal';
  const uastc = normal ? NORMAL_MODE === 'uastc' : color ? raster.alpha && ALPHA_MODE === 'uastc' : DATA_MODE === 'uastc';
  const out = await encodeToKTX2(buffer, {
    imageDecoder, isUASTC: uastc, generateMipmap: true, isYFlip: flipY,
    isSetKTX2SRGBTransferFunc: color, isPerceptual: color, isNormalMap: normal,
    ...(uastc ? { needSupercompression: true, enableRDO: true, rdoQualityLevel: RDO } : { qualityLevel: normal ? 255 : Q, compressionLevel: 2 }),
  });
  return { out, raster, mode: uastc ? 'UASTC' : 'ETC1S' };
}

function slotsOf(texture) {
  const root = Document.fromGraph(texture.getGraph()).getRoot();
  return [...new Set(texture.getGraph().listParentEdges(texture).filter(e => e.getParent() !== root).map(e => e.getName()))];
}
const kindOf = slots => (slots.some(s => /normal/i.test(s)) ? 'normal' : slots.some(s => COLOR_SLOTS.test(s)) || !slots.length ? 'color' : 'data');
const vram = (w, h, bpp) => w * h * bpp / 8 * 4 / 3; // with mipmaps

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.glb') ? [join(dir, e.name)] : [])))).flat();
}

let fileBefore = 0, fileAfter = 0, vramBefore = 0, vramAfter = 0, count = 0;
if (env) {
  for (const name of (await readdir(ENV)).filter(n => n.endsWith('.jpg'))) {
    const src = join(ENV, name), buffer = await readFile(src);
    // TextureLoader flips images on upload; compressed data cannot be flipped there, so flip while encoding.
    const { out, raster, mode } = await encode(buffer, name.includes('-normal') ? 'normal' : 'color', true);
    fileBefore += buffer.length; fileAfter += out.length; vramBefore += vram(raster.srcW, raster.srcH, 32); vramAfter += vram(raster.width, raster.height, 8); count++;
    console.log(`${name.padEnd(22)} ${mode} ${raster.srcW}x${raster.srcH} ${(buffer.length / 1024).toFixed(0)} KB -> ${(out.length / 1024).toFixed(0)} KB`);
    if (!dry) await writeFile(src.replace(/\.jpg$/, '.ktx2'), out);
  }
} else {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  for (const file of files.length ? files : await walk(ROOT)) {
    const doc = await io.read(file);
    const textures = doc.getRoot().listTextures().filter(t => t.getMimeType() !== 'image/ktx2' && t.getImage());
    if (!textures.length) continue;
    const size = (await stat(file)).size;
    const log = [];
    for (const t of textures) {
      const slots = slotsOf(t), kind = kindOf(slots);
      const { out, raster, mode } = await encode(t.getImage(), kind);
      vramBefore += vram(raster.srcW, raster.srcH, 32); vramAfter += vram(raster.width, raster.height, 8); count++;
      log.push(`${t.getName() || '?'}:${mode}/${kind} ${raster.srcW}x${raster.srcH}`);
      t.setImage(out).setMimeType('image/ktx2');
    }
    doc.createExtension(KHRTextureBasisu).setRequired(true);
    // Unused WebP extension entries would make loaders look for a fallback that is gone.
    for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'EXT_texture_webp' || ext.extensionName === 'EXT_texture_avif') ext.dispose();
    const binary = await io.writeBinary(doc);
    fileBefore += size; fileAfter += binary.byteLength;
    console.log(`${relative(ROOT, file).padEnd(40)} ${(size / 1024).toFixed(0).padStart(6)} KB -> ${(binary.byteLength / 1024).toFixed(0).padStart(6)} KB  ${log.join(', ')}`);
    if (!dry) await writeFile(file, binary);
  }
}
console.log(`${count} textures. files ${(fileBefore / 1048576).toFixed(1)} MB -> ${(fileAfter / 1048576).toFixed(1)} MB; VRAM (est., 8 bpp target) ${(vramBefore / 1048576).toFixed(0)} MB -> ${(vramAfter / 1048576).toFixed(0)} MB${dry ? ' (dry run, nothing written)' : ''}`);
