"""Turns CC0 photo-scanned textures (Poly Haven) into the farm's ground set (docs/design/ground-pass.md).

  blender -b --factory-startup -P scripts/blender/photo_textures.py -- <source dir> <output dir>

For each set: removes the photo's large light and dark patches (they show as a grid when the tile repeats), then moves
the average colour to the farm's own (Gedeo red earth, highland grass). Fine detail stays as photographed.
Writes PNGs; the caller converts them to JPG and copies the normal maps.
"""
import sys, os, bpy
import numpy as np

SETS = {  # game name: (Poly Haven id, target average colour, contrast of the fine detail)
    'grass': ('leafy_grass', (.39, .51, .21), 1.05),
    'soil': ('brown_mud_02', (.47, .28, .18), .8),
    'road': ('dirt', (.63, .46, .32), 1.0),
    'stone': ('rock_face_03', (.66, .60, .51), .95),
}

def read(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[..., :3].copy()

def blur(a, sigma):
    """Gaussian blur that wraps round the edges, so the tile still repeats."""
    h, w = a.shape[:2]
    fy, fx = np.fft.fftfreq(h)[:, None], np.fft.rfftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.dstack([np.fft.irfft2(np.fft.rfft2(a[..., c]) * g, s=(h, w)) for c in range(3)])

def save(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h)
    out = np.ones((h, w, 4), np.float32); out[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
os.makedirs(dst, exist_ok=True)
for name, (pid, target, contrast) in SETS.items():
    c = read(os.path.join(src, f'{pid}_diff_1k.jpg'))
    flat = c / np.maximum(blur(c, c.shape[0] / 7), .02)          # keeps detail, drops patches larger than about 1/7 of the tile
    flat = 1 + (flat - 1) * contrast
    out = flat * np.array(target)
    save(out, os.path.join(dst, f'{name}.png'))
    print('PHOTO', name, pid, 'mean', [round(float(v), 3) for v in out.reshape(-1, 3).mean(0)])
print('PHOTO_OK')
