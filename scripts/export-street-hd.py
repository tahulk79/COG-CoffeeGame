#!/usr/bin/env python3
"""Export registered street tiles from one master; verify decoded overlaps too."""
import json
import subprocess
import sys
import tempfile
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-src/slice/chapter1/reference-ui/accepted'
RUNTIME = ROOT / 'public/assets/slice/chapter1'
CELLS = [(0, 0), (0, 1), (1, 0), (1, 1), (1, 2), (2, 1), (2, 2)]
SCALE, PAD = 3, 48
WIDTH, HEIGHT = 649 * SCALE, 412 * SCALE


def run(*args):
    return subprocess.check_output([str(a) for a in args])


def pixels(path, x, y, w, h):
    return run('magick', path, '-crop', f'{w}x{h}+{x}+{y}', '+repage',
               '-alpha', 'off', '-depth', '8', 'rgb:-')


def tile_path(folder, cell, extension):
    return folder / f'street-{cell[0]}-{cell[1]}-v1.{extension}'


def check():
    pairs = 0
    for folder, extension in [(SOURCE / 'hd', 'png'), (RUNTIME / 'hd', 'webp')]:
        for cell in CELLS:
            size = run('magick', 'identify', '-format', '%w %h', tile_path(folder, cell, extension))
            assert size == f'{WIDTH} {HEIGHT}'.encode(), (cell, size)
        for a, b in combinations(CELLS, 2):
            ax, ay = a[1] * 553 * SCALE, a[0] * 316 * SCALE
            bx, by = b[1] * 553 * SCALE, b[0] * 316 * SCALE
            x, y = max(ax, bx), max(ay, by)
            w, h = min(ax, bx) + WIDTH - x, min(ay, by) + HEIGHT - y
            if w <= 0 or h <= 0:
                continue
            left = pixels(tile_path(folder, a, extension), x - ax, y - ay, w, h)
            right = pixels(tile_path(folder, b, extension), x - bx, y - by, w, h)
            assert left == right, f'{extension} overlap mismatch: {a}, {b}'
            pairs += 1
    report = {'tiles': len(CELLS), 'size': [WIDTH, HEIGHT],
              'overlap_comparisons': pairs, 'different_overlap_pixels': 0,
              'webp_encoding': 'lossless'}
    print(json.dumps(report, indent=2))
    return report


def export():
    assert run('magick', 'identify', '-format', '%w %h', SOURCE / 'street-master.png') == b'4977 2844'
    (SOURCE / 'hd').mkdir(exist_ok=True)
    (RUNTIME / 'hd').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='street-hd-') as tmp:
        padded, base = Path(tmp) / 'padded.png', Path(tmp) / 'base.png'
        run('magick', SOURCE / 'street-master.png', '-background', '#f2dfc0',
            '-border', str(PAD * SCALE), padded)
        for cell in CELLS:
            png = tile_path(SOURCE / 'hd', cell, 'png')
            x, y = cell[1] * 553 * SCALE, cell[0] * 316 * SCALE
            run('magick', padded, '-crop', f'{WIDTH}x{HEIGHT}+{x}+{y}', '+repage', png)
            # Independent lossy encodes give shared pixels different colours.
            run('cwebp', '-quiet', '-lossless', '-q', '75', '-m', '6', png,
                '-o', tile_path(RUNTIME / 'hd', cell, 'webp'))
        run('magick', SOURCE / 'street-master.png', '-resize', '1659x948!', base)
        run('cwebp', '-quiet', '-lossless', '-q', '75', '-m', '6', base,
            '-o', RUNTIME / 'street-scene-v2.webp')


if __name__ == '__main__':
    if '--check' not in sys.argv:
        export()
    check()
