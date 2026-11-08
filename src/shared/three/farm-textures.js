import * as THREE from 'three';

// Realistic farm ground textures (scripts/blender/gedeo_environment.py export_ground_textures → public/assets/farm/env):
// grass (highland pasture), soil (Gedeo red earth), road (packed dirt + gravel), stone (dry-stone wall). Each has a
// matching -normal map. Tiles repeat in world metres; one cached texture per (name, kind) shared by every material.
const loader = new THREE.TextureLoader();
const cache = new Map();

/** Cached repeat-wrapped texture. kind: 'color' (sRGB) | 'normal' (linear). */
export function farmTex(name, kind = 'color') {
  const key = `${name}:${kind}`;
  if (!cache.has(key)) {
    const t = loader.load(`${import.meta.env.BASE_URL}assets/farm/env/${name}${kind === 'normal' ? '-normal' : ''}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = kind === 'normal' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.userData.keep = true;
    cache.set(key, t);
  }
  return cache.get(key);
}

/** A ground material using one texture set (map + normal), optional tint, its UVs being world metres / tile. */
export function farmMaterial(name, { color = 0xffffff, normalScale = .8, roughness = .97, ...rest } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, map: farmTex(name), normalMap: farmTex(name, 'normal'), roughness, ...rest });
  m.normalScale.setScalar(normalScale);
  return m;
}

/**
 * Grass ↔ red-soil blend for the big ground plane: the geometry carries a per-vertex `soil` weight (0 grass … 1 bare
 * earth); the soil texture shows through where it is high. Keeps the material's vertex colours (brightness variation).
 */
export function blendSoil(material) {
  const soil = farmTex('soil'), soilN = farmTex('soil', 'normal');
  material.onBeforeCompile = shader => {
    shader.uniforms.soilMap = { value: soil }; shader.uniforms.soilNormal = { value: soilN };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float soil;\nvarying float vSoil;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoil = soil;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D soilMap;
uniform sampler2D soilNormal;
varying float vSoil;
float gbH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gbN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gbH(i), gbH(i + vec2(1.0, 0.0)), f.x), mix(gbH(i + vec2(0.0, 1.0)), gbH(i + vec2(1.0)), f.x), f.y); }`)
      // Real ground (founder 2026-11-08 "nền đất thực"): two texture scales mixed by a macro noise kill the tiling grid,
      // dry-season straw patches and darker lush hollows vary the grass, and the red earth (soil attribute: worn verges
      // along the tracks and round the fields) comes through with ragged, noise-eroded edges instead of soft blobs.
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec2 wuv = vMapUv;
  float macro = gbN(wuv * 0.33) * 0.6 + gbN(wuv * 1.07 + 7.3) * 0.4;
  float fine = gbN(wuv * 4.1 + 3.1);
  vec4 gA = texture2D( map, wuv );
  vec4 gB = texture2D( map, wuv * 0.37 + vec2(0.31, 0.77) );
  vec4 gTex = mix( gA, gB, smoothstep(0.3, 0.7, gbN(wuv * 0.6 + 11.0)) );
  float dry = smoothstep(0.58, 0.8, macro);
  gTex.rgb = mix( gTex.rgb, gTex.rgb * vec3(1.32, 1.12, 0.62) + vec3(0.05, 0.03, 0.0), dry * 0.75 );
  gTex.rgb *= 0.86 + 0.28 * smoothstep(0.15, 0.55, macro);
  vec4 sA = texture2D( soilMap, wuv * 0.8 );
  vec4 sB = texture2D( soilMap, wuv * 0.29 + vec2(0.53, 0.19) );
  vec4 sTex = mix( sA, sB, 0.45 );
  float sw = smoothstep( 0.42, 0.58, vSoil + (fine - 0.5) * 0.55 + (gTex.g - 0.25) * 0.35 );
  diffuseColor *= mix( gTex, sTex, sw );
#endif`);
  };
  material.customProgramCacheKey = () => 'farm-ground-soil';
  return material;
}
