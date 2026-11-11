import { CompressedTexture } from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// KTX2 / Basis textures (scripts/ktx2-textures.mjs) stay compressed in GPU memory: about a quarter of the VRAM of a
// PNG/JPG, which the GPU holds as raw RGBA. The transcoder (public/basis, copied from three/examples/jsm/libs/basis)
// turns them into whatever this GPU reads: ASTC on most phones, ETC2 on older Android, BC7 / DXT on desktops.
export const ktx2Loader = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);

// detectSupport only asks which compressed formats exist, so a throwaway context answers it before the game's renderer
// is made (models can start loading first). Same GPU and browser, so the answer is the same.
(() => {
  if (typeof document === 'undefined') return; // node tests import the scene without a DOM
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) { ktx2Loader.detectSupport({ extensions: { has: () => false } }); return; } // transcodes to plain RGBA
  ktx2Loader.detectSupport({ extensions: { has: name => !!gl.getExtension(name), get: name => gl.getExtension(name) } });
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  ktx2Loader.init(); // fetch the transcoder now, beside the first models, not after the first KTX2 texture is found inside a GLB
})();

/**
 * A texture usable right away (shared by materials before the file arrives, like TextureLoader.load): it is empty until
 * the KTX2 loads, then takes over its data. `setup(texture)` sets wrap / colour space / anisotropy.
 */
export function loadKTX2Texture(url, setup = () => {}) {
  const texture = new CompressedTexture([], 0, 0); // empty mipmaps: clone() copies the array (undefined throws)
  setup(texture);
  // Copies made before the file arrives (another repeat for the hills) get the data too; later copies share it anyway.
  let loaded = null;
  const waiting = [texture];
  texture.clone = function () { const copy = CompressedTexture.prototype.clone.call(this); if (!loaded) waiting.push(copy); return copy; };
  ktx2Loader.load(url, result => {
    loaded = result;
    for (const t of waiting) {
      t.source = result.source; t.mipmaps = result.mipmaps;
      t.format = result.format; t.type = result.type;
      t.minFilter = result.minFilter; t.magFilter = result.magFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
    }
    waiting.length = 0;
  }, undefined, error => console.warn(`KTX2 ${url} not loaded.`, error));
  return texture;
}
