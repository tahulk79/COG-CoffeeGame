// Compress GLB geometry with meshopt (EXT_meshopt_compression) for faster mobile downloads.
// Usage: node scripts/optimize-models.mjs [--out dir] [--full] [files...]   (default: every public/models/**/*.glb, in place)
// --simplify <ratio> (e.g. 0.5) also decimates triangles and re-encodes files that are already meshopt (PF-6).
// Default keeps POSITION as float so node transforms stay exactly as authored (game code moves named nodes);
// --full also quantizes positions, which rewrites mesh-node position/scale.
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder, quantize, simplify } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = 'public/models';
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args.splice(outIndex, 2)[1] : null;
const simplifyIndex = args.indexOf('--simplify');
const ratio = simplifyIndex >= 0 ? Number(args.splice(simplifyIndex, 2)[1]) : 0;
const full = args.includes('--full');
const files = args.filter(a => a.endsWith('.glb'));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.glb') ? [join(dir, e.name)] : []))).flat();
}

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
let before = 0, after = 0;
for (const file of files.length ? files : await walk(ROOT)) {
  const document = await io.read(file);
  if (!ratio && document.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')) { console.log(`skip ${file} (already meshopt)`); continue; }
  if (ratio) await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }));
  await document.transform(
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ pattern: full ? /.*/ : /^(NORMAL|TANGENT|TEXCOORD|COLOR|JOINTS|WEIGHTS)(_\d+)?$/, patternTargets: full ? /.*/ : /^(NORMAL|TANGENT)$/ }),
  );
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const binary = await io.writeBinary(document), size = (await stat(file)).size;
  const target = out ? join(out, relative(ROOT, file)) : file;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, binary);
  before += size; after += binary.byteLength;
  console.log(`${relative(ROOT, file).padEnd(32)} ${(size / 1024).toFixed(0).padStart(6)} KB -> ${(binary.byteLength / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`total ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
