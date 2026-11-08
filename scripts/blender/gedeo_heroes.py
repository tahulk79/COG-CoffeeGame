"""Gedeo (Ethiopia) hero vegetation — procedural, botanically structured, PBR, Blender 5.x (bpy + numpy).

Builds four hero assets from real plant structure (no primitive stand-ins):
  coffea_arabica_mature  multi-stem shrub, decussate plagiotropic laterals, opposite elliptic leaves, axillary cherry clusters
  albizia_schimperiana   tall clear trunk, ascending limbs, flat-topped layered crown, bipinnate feathery foliage cards
  cordia_africana        short crooked trunk, sympodial limbs, dense rounded crown, broad ovate leaves + white flower trusses
  ensete_ventricosum     swollen sheathed pseudostem, huge oblong paddle leaves with red midribs, torn older leaves, dry skirt

Textures are painted in numpy at build time (deterministic per seed), packed into the GLB. Foliage normals point away from
the crown centre so cards shade as one volume in Three.js. Each asset = one root node, one mesh per material
(bark / leaves / fruit) → 2–3 draw calls.

Run inside the live Blender (MCP):  exec(open(path).read()); build_showcase()
Headless export:  Blender -b -P scripts/blender/gedeo_heroes.py -- --export public/models/gedeo
"""
import bpy, math, random, os, sys
import numpy as np
from mathutils import Vector, Quaternion

UP = Vector((0, 0, 1))
TAU = math.tau

# ───────────────────────────── texture painting (numpy) ─────────────────────────────

def vnoise(h, w, cy, cx, rng):
    """Tileable value noise, smoothstep-interpolated."""
    g = rng.random((cy, cx))
    ys = np.arange(h) * cy / h; xs = np.arange(w) * cx / w
    y0 = ys.astype(int); x0 = xs.astype(int); fy = ys - y0; fx = xs - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    y1 = (y0 + 1) % cy; x1 = (x0 + 1) % cx
    a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y1][:, x0]; d = g[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy)[:, None] + (c * (1 - fx) + d * fx) * fy[:, None]

def fbm(h, w, cy, cx, octaves, rng, gain=.5):
    out = np.zeros((h, w)); amp = 1; tot = 0
    for i in range(octaves):
        out += amp * vnoise(h, w, cy * 2 ** i, cx * 2 ** i, rng); tot += amp; amp *= gain
    return out / tot

def srgb(c):
    return np.array(c[:3], np.float32)

class Canvas:
    """RGBA float canvas, top-left origin; paint() composites a masked colour inside a bounding box."""
    def __init__(s, w, h, fill=(0, 0, 0, 0)):
        s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.float32); s.a[:] = fill

    def paint(s, x0, y0, x1, y1, fn):
        x0 = max(0, int(x0)); y0 = max(0, int(y0)); x1 = min(s.w, int(math.ceil(x1))); y1 = min(s.h, int(math.ceil(y1)))
        if x1 <= x0 or y1 <= y0: return
        Y, X = np.mgrid[y0:y1, x0:x1].astype(np.float32) + .5
        m, rgb = fn(X, Y)
        m = np.clip(np.nan_to_num(m), 0, 1)[..., None]; rgb = np.nan_to_num(rgb)
        dst = s.a[y0:y1, x0:x1]
        dst[..., :3] = dst[..., :3] * (1 - m) + np.broadcast_to(rgb, dst[..., :3].shape) * m
        dst[..., 3:] = dst[..., 3:] * (1 - m) + m

    def ellipse(s, cx, cy, rx, ry, ang, rgb, shade=0.0):
        r = max(rx, ry) + 1.5; ca, sa = math.cos(ang), math.sin(ang)
        def fn(X, Y):
            dx, dy = X - cx, Y - cy
            u = (dx * ca + dy * sa) / rx; v = (-dx * sa + dy * ca) / ry
            d = np.sqrt(u * u + v * v)
            col = np.asarray(rgb, np.float32) * (1 - shade * np.clip(v, -1, 1)[..., None] * .5 - shade * .15 * d[..., None])
            return (1 - d) * min(rx, ry) * 1.2, col
        s.paint(cx - r, cy - r, cx + r, cy + r, fn)

    def line(s, xa, ya, xb, yb, wa, rgb, wb=None):
        wb = wa if wb is None else wb; pad = max(wa, wb) + 2
        vx, vy = xb - xa, yb - ya; ll = max(1e-6, vx * vx + vy * vy)
        def fn(X, Y):
            t = np.clip(((X - xa) * vx + (Y - ya) * vy) / ll, 0, 1)
            d = np.hypot(X - (xa + t * vx), Y - (ya + t * vy))
            return (wa + (wb - wa) * t) * .5 - d + .5, np.asarray(rgb, np.float32)
        s.paint(min(xa, xb) - pad, min(ya, yb) - pad, max(xa, xb) + pad, max(ya, yb) + pad, fn)

    def blade(s, bx, by, ang, L, W, prof, colfn):
        """Leaf blade from base (bx,by) toward angle; prof(s)->half-width fraction; colfn(s,t)->rgb array."""
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [(bx, by), (bx + ca * L, by + sa * L)]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        def fn(X, Y):
            dx, dy = X - bx, Y - by
            sp = (dx * ca + dy * sa) / L; t = (-dx * sa + dy * ca) / W
            pr = prof(np.clip(sp, 0, 1))
            m = (pr - np.abs(t)) * W * (sp > 0) * (sp < 1)
            return m, colfn(np.clip(sp, 0, 1), np.clip(t / np.maximum(pr, 1e-3), -1, 1))
        s.paint(min(xs) - W - 2, min(ys) - W - 2, max(xs) + W + 2, max(ys) + W + 2, fn)

    def down2(s):
        """2× supersample → premultiplied box filter."""
        a = s.a.copy(); a[..., :3] *= a[..., 3:]
        a = a.reshape(s.h // 2, 2, s.w // 2, 2, 4).mean((1, 3))
        a[..., :3] /= np.maximum(a[..., 3:], 1e-4)
        # bleed colour into transparent texels so mip/filtering does not halo dark
        a[..., :3] = np.where(a[..., 3:] > .02, a[..., :3], a[..., :3].reshape(-1, 3)[a[..., 3].ravel() > .5].mean(0) if (a[..., 3] > .5).any() else 0)
        c = Canvas(s.w // 2, s.h // 2); c.a = a.astype(np.float32); return c

def cell_px(cell, W, H):
    u0, v0, u1, v1 = cell
    return u0 * W, (1 - v1) * H, u1 * W, (1 - v0) * H

def to_image(name, arr):
    """Texture names are deterministic per content (fixed seed), so an existing image of that name is reused."""
    if name in bpy.data.images:
        if bpy.data.images[name].users: return bpy.data.images[name]
        bpy.data.images.remove(bpy.data.images[name])
    arr = arr() if callable(arr) else arr
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(np.clip(arr[::-1], 0, 1)).astype(np.float32).ravel())
    img.pack()
    return img

def cell_grid(H, W, cell):
    """Per-pixel (s along leaf 0..1 from base, t across -1..1) for a whole-cell leaf fill."""
    x0, y0, x1, y1 = [int(round(v)) for v in cell_px(cell, W, H)]
    Y, X = np.mgrid[y0:y1, x0:x1].astype(np.float32) + .5
    s = (y1 - Y) / (y1 - y0); t = ((X - x0) / (x1 - x0) - .5) * 2
    return (x0, y0, x1, y1), s, t

def ragged_cells(arr, cells, seed, radius=.48, cy=.5):
    """Fade alpha to a ragged oval inside each card cell so the card's straight outline never shows."""
    rng = np.random.default_rng(seed); H, W = arr.shape[:2]
    for cell in cells:
        x0, y0, x1, y1 = [int(round(v)) for v in cell_px(cell, W, H)]
        h, w = y1 - y0, x1 - x0
        Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
        lu = (X + .5) / w - .5; lv = (h - Y - .5) / h - cy
        d = np.sqrt(lu * lu + lv * lv) / radius + (fbm(h, w, 6, 6, 3, rng) - .5) * .35
        arr[y0:y1, x0:x1, 3] *= np.clip((1 - d) * 8, 0, 1)
    return arr

# ── bark (opaque, tileable): u around the stem, v along it ──
def tex_bark(kind, seed, size=512):
    rng = np.random.default_rng(seed); h = w = size
    if kind == 'albizia':   # smooth grey-brown, horizontal lenticels, faint mottling
        n = fbm(h, w, 3, 6, 5, rng); m = fbm(h, w, 12, 3, 3, rng)
        base = srgb((.40, .37, .32)) * (.82 + .3 * n[..., None]) + srgb((.06, .05, .02)) * (m[..., None] - .5)
        len_ = vnoise(h, w, 90, 14, rng); base *= (1 - .28 * np.clip((len_ - .82) * 8, 0, 1))[..., None]
    elif kind == 'cordia':  # dark grey-brown, deep longitudinal fissures, flaky ridges
        n = fbm(h, w, 2, 10, 5, rng); f = fbm(h, w, 3, 22, 3, rng)
        fiss = np.clip((f - .42) * 5, 0, 1)
        base = srgb((.30, .25, .20)) * (.75 + .45 * n[..., None]) * (.45 + .55 * fiss[..., None])
        base += srgb((.10, .09, .07)) * np.clip((n[..., None] - .62) * 3, 0, 1)
    elif kind == 'coffee':  # pale grey-brown, fine longitudinal streaks, green tinge on young wood
        n = fbm(h, w, 2, 16, 4, rng)
        base = srgb((.36, .32, .26)) * (.8 + .35 * n[..., None]) + srgb((.02, .04, .0)) * (n[..., None] - .5)
    else:                    # enset pseudostem: overlapping sheaths, green-yellow with maroon streaks, browning base
        n = fbm(h, w, 2, 28, 4, rng); blot = fbm(h, w, 4, 10, 4, rng)
        v = np.linspace(1, 0, h)[:, None, None]
        green = srgb((.36, .44, .20)) * (.8 + .35 * n[..., None])
        maroon = srgb((.42, .14, .12)) * (.8 + .3 * n[..., None])
        base = green * (1 - np.clip((blot[..., None] - .5) * 3, 0, 1)) + maroon * np.clip((blot[..., None] - .5) * 3, 0, 1)
        base = base * (1 - .5 * np.clip((.25 - v) * 4, 0, 1)) + srgb((.36, .27, .16)) * .5 * np.clip((.25 - v) * 4, 0, 1)
        seams = vnoise(h, w, 1, 9, rng); base *= (1 - .35 * np.clip((seams[..., None] - .8) * 10, 0, 1))
    a = np.ones((h, w, 4), np.float32); a[..., :3] = np.clip(base, 0, 1); return a

# ── coffee leaf atlas: 2 cells (mature glossy dark / young flush), whole-cell fill, geometry gives the outline ──
COFFEE_CELLS = [(0, 0, .5, 1), (.5, 0, 1, 1)]
def tex_coffee_leaf(seed):
    rng = np.random.default_rng(seed); W, H = 512, 1024; img = np.ones((H, W, 4), np.float32)
    for ci, (col, vein) in enumerate([((.10, .26, .08), (.36, .46, .16)), ((.30, .50, .14), (.55, .66, .28))]):
        (x0, y0, x1, y1), s, t = cell_grid(H, W, COFFEE_CELLS[ci])
        n = fbm(y1 - y0, x1 - x0, 6, 3, 4, rng)
        c = srgb(col) * (.85 + .3 * n[..., None])
        at = np.abs(t)
        q = (s - .38 * at) * 10.0                                  # 10 pairs of arcuate secondaries toward the tip
        sec = np.clip(1 - np.abs(q - np.round(q)) * 14, 0, 1) * (at > .05) * (at < .9) * (s > .06) * (s < .93)
        mid = np.clip(1 - at / .035, 0, 1)
        c = c * (1 - .55 * sec[..., None]) + srgb(vein) * .55 * sec[..., None]
        c = c * (1 - mid[..., None]) + srgb(vein) * 1.1 * mid[..., None]
        c *= (1 - .25 * np.clip((at - .85) * 6, 0, 1))[..., None]   # darker rolled margin
        c *= (1 + .18 * (1 - at) * (s > .1))[..., None] * (.92 + .08 * s)[..., None]
        img[y0:y1, x0:x1, :3] = np.clip(c, 0, 1)
    return img

# ── enset blade atlas: 4 cells (young, mature, torn, dry), alpha for tears ──
ENSET_CELLS = [(i / 4, 0, (i + 1) / 4, 1) for i in range(4)]
def tex_enset_leaf(seed):
    rng = np.random.default_rng(seed); W, H = 1024, 2048; img = np.ones((H, W, 4), np.float32)
    looks = [((.36, .58, .16), (.70, .30, .22), 0), ((.24, .44, .12), (.55, .16, .14), 0),
             ((.26, .44, .13), (.52, .16, .13), 1), ((.48, .36, .20), (.40, .26, .15), 2)]
    for ci, (col, rib, torn) in enumerate(looks):
        (x0, y0, x1, y1), s, t = cell_grid(H, W, ENSET_CELLS[ci])
        h, w = y1 - y0, x1 - x0
        n = fbm(h, w, 12, 3, 4, rng); at = np.abs(t)
        c = srgb(col) * (.82 + .3 * n[..., None])
        q = (s * 70 - at * 9)                                           # dense parallel laterals sweeping to the margin
        vein = np.clip(1 - np.abs(q - np.round(q)) * 6, 0, 1) * (at > .05)
        c *= (1 - .10 * vein[..., None])
        c *= (1 + .22 * np.clip(1 - at * 2, 0, 1))[..., None]          # paler, glossy centre
        mid = np.clip(1 - at / .05, 0, 1)
        c = c * (1 - mid[..., None]) + srgb(rib) * mid[..., None]
        edge = np.clip((at - .9) * 10, 0, 1)                            # thin red/brown margin
        c = c * (1 - .5 * edge[..., None]) + srgb((.45, .22, .12)) * .5 * edge[..., None]
        a = np.ones((h, w), np.float32)
        if torn:
            k = 14 if torn == 1 else 28
            for _ in range(k):                                          # wind tears run along the laterals, edge → midrib
                s0 = rng.uniform(.08, .97); depth = rng.uniform(.25, .95) if torn == 1 else rng.uniform(.5, 1)
                side = rng.choice([-1, 1]); ql = s0 * 70
                d = np.abs((s * 70 - at * 9) - ql)
                tear = (d < rng.uniform(.25, .6)) * (at > 1 - depth) * (np.sign(t) == side)
                a *= 1 - tear
            fray = fbm(h, w, 40, 6, 2, rng); a *= (at < .97 - .12 * fray)
            if torn == 2:
                c = c * (.7 + .5 * fbm(h, w, 20, 4, 3, rng)[..., None]); a *= (fbm(h, w, 30, 4, 3, rng) > .32)
        img[y0:y1, x0:x1, :3] = np.clip(c, 0, 1); img[y0:y1, x0:x1, 3] = a
    return img

# ── albizia foliage cards: sprays of bipinnate leaves seen from above; 2 cells ──
ALBIZIA_CELLS = [(0, 0, .5, 1), (.5, 0, 1, 1)]
def tex_albizia_cards(seed):
    rng = random.Random(seed); nrng = np.random.default_rng(seed)
    W, H = 2048 * 2, 1024 * 2                    # drawn at 2×, filtered to 2048×1024 (two square cells)
    cv = Canvas(W, H)
    for cell in ALBIZIA_CELLS:
        x0, y0, x1, y1 = cell_px(cell, W, H); cw, ch = x1 - x0, y1 - y0
        px_m = cw / 1.4                           # card is 1.4 m wide
        for spray in range(9):                    # short twigs, each carrying 4–6 leaves, fanning over the card
            bx = x0 + cw * (.5 + rng.uniform(-.28, .28)); by = y1 - ch * rng.uniform(.05, .55)
            for leaf in range(rng.randint(4, 6)):
                ang = -math.pi / 2 + rng.uniform(-1.3, 1.3)
                Lr = px_m * rng.uniform(.26, .40)
                tone = rng.uniform(.82, 1.12); yellow = rng.random() < .12
                base_col = np.array((.30, .46, .14) if not yellow else (.48, .52, .18)) * tone
                ex, ey = bx + math.cos(ang) * Lr, by + math.sin(ang) * Lr
                cv.line(bx, by, ex, ey, 2.4 * px_m / 365, (.30, .30, .16))
                npin = rng.randint(5, 8)
                for k in range(npin):
                    f = .18 + .8 * k / npin
                    px_, py_ = bx + (ex - bx) * f, by + (ey - by) * f
                    for side in (-1, 1):
                        pa = ang + side * math.radians(rng.uniform(55, 75))
                        pl = Lr * .36 * (1 - .45 * abs(f - .45))
                        qx, qy = px_ + math.cos(pa) * pl, py_ + math.sin(pa) * pl
                        cv.line(px_, py_, qx, qy, 1.4 * px_m / 365, (.28, .34, .14))
                        nlf = rng.randint(11, 16)
                        for j in range(nlf):
                            g = .08 + .9 * j / nlf
                            lx, ly = px_ + (qx - px_) * g, py_ + (qy - py_) * g
                            lr = px_m * .0085 * (1 - .3 * g); lw = lr * .45
                            for s2 in (-1, 1):
                                la = pa + s2 * math.radians(rng.uniform(55, 80))
                                cv.ellipse(lx + math.cos(la) * lr, ly + math.sin(la) * lr, lr, lw, la,
                                           base_col * rng.uniform(.88, 1.1), shade=.35)
    return ragged_cells(cv.down2().a, ALBIZIA_CELLS, seed)

# ── cordia atlas: 3 leafy-twig cells + 1 flower-truss cell ──
CORDIA_CELLS = {'leafA': (0, .5, .5, 1), 'leafB': (.5, .5, 1, 1), 'leafC': (.5, 0, 1, .5), 'flower': (0, 0, .5, .5)}
def tex_cordia(seed):
    rng = random.Random(seed); nrng = np.random.default_rng(seed)
    W = H = 2048 * 2; cv = Canvas(W, H)
    def leafcol(base):
        def f(s, t):
            at = np.abs(t)
            q = (s - .3 * at) * 7; sec = np.clip(1 - np.abs(q - np.round(q)) * 10, 0, 1) * (at > .06) * (at < .85)
            mid = np.clip(1 - at / .05, 0, 1)
            c = np.asarray(base, np.float32) * (.9 + .25 * (1 - at))[..., None]
            c = c * (1 - .35 * sec[..., None]) + np.array((.42, .48, .22)) * .35 * sec[..., None]
            c = c * (1 - mid[..., None]) + np.array((.45, .50, .25)) * mid[..., None]
            return c * (1 - .3 * np.clip((at - .82) * 5, 0, 1))[..., None]
        return f
    ovate = lambda s: np.power(np.clip(np.sin(np.pi * np.power(s, .62)), 0, 1), .75) * (1 - .15 * s)
    for key in ('leafA', 'leafB', 'leafC'):
        x0, y0, x1, y1 = cell_px(CORDIA_CELLS[key], W, H); cw = x1 - x0; px_m = cw / .8
        bx, by = x0 + cw * .5, y1 - cw * .03
        tx, ty = bx + rng.uniform(-.06, .06) * cw, y0 + cw * .30
        cv.line(bx, by, tx, ty, 6 * px_m / 640, (.36, .30, .22), 3 * px_m / 640)
        leaves = []
        for k in range(rng.randint(12, 15)):
            f = rng.uniform(.15, 1.0)
            ax, ay = bx + (tx - bx) * f, by + (ty - by) * f
            ang = -math.pi / 2 + rng.choice([-1, 1]) * rng.uniform(.3, 1.55) * (1.15 - f * .5)
            L = px_m * rng.uniform(.14, .21); leaves.append((L, ax, ay, ang))
        for L, ax, ay, ang in sorted(leaves, key=lambda v: v[0]):
            tone = rng.uniform(.8, 1.15); base = np.array((.15, .30, .10)) * tone
            if rng.random() < .1: base = np.array((.36, .42, .14)) * tone
            pet = L * .18
            px_, py_ = ax + math.cos(ang) * pet, ay + math.sin(ang) * pet
            cv.line(ax, ay, px_, py_, 2.5 * px_m / 640, (.30, .34, .16))
            cv.blade(px_, py_, ang, L, L * .42, ovate, leafcol(base))
    # flower truss: dense corymb of white funnel flowers with 5–7 crinkled lobes
    x0, y0, x1, y1 = cell_px(CORDIA_CELLS['flower'], W, H); cw = x1 - x0; px_m = cw / .5
    cx, cy = x0 + cw * .5, y0 + cw * .52
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * .45
        cv.line(cx, y1 - cw * .05, cx + math.cos(a) * cw * .3, cy + math.sin(a) * cw * .1, 4 * px_m / 1000, (.40, .44, .24))
    for k in range(rng.randint(26, 34)):
        r = cw * .38 * math.sqrt(rng.random()); a = rng.random() * TAU
        fx, fy = cx + math.cos(a) * r, cy + math.sin(a) * r * .8
        R = px_m * rng.uniform(.022, .032); lobes = rng.choice([5, 6, 7]); ph = rng.random() * TAU
        bud = rng.random() < .15
        def fn(X, Y, fx=fx, fy=fy, R=R, lobes=lobes, ph=ph, bud=bud):
            dx, dy = X - fx, Y - fy; rr = np.hypot(dx, dy); th = np.arctan2(dy, dx)
            edge = R * (.5 if bud else (.82 + .18 * np.cos(lobes * (th + ph))))
            d = rr / edge
            c = np.array((.97, .96, .92)) * (1 - .18 * d)[..., None]
            c = c * (1 - np.clip(1 - d / .3, 0, 1)[..., None]) + np.array((.93, .86, .55)) * np.clip(1 - d / .3, 0, 1)[..., None]
            if bud: c = np.array((.86, .88, .74)) * np.ones_like(d)[..., None]
            return (1 - d) * R * .8, c
        cv.paint(fx - R - 2, fy - R - 2, fx + R + 2, fy + R + 2, fn)
    return ragged_cells(cv.down2().a, [CORDIA_CELLS[k] for k in ('leafA', 'leafB', 'leafC')], seed, radius=.5, cy=.45)

# ───────────────────────────── mesh building ─────────────────────────────

class MB:
    """Mesh accumulator: per-vertex position / uv / colour (seams by duplicated verts)."""
    def __init__(s): s.v, s.uv, s.col, s.f = [], [], [], []; s.normals = None
    def add(s, co, uv=(0, 0), col=(1, 1, 1, 1)):
        s.v.append(tuple(co)); s.uv.append(tuple(uv)); s.col.append(tuple(col)); return len(s.v) - 1
    def face(s, idx): s.f.append(tuple(idx))
    @property
    def tris(s): return sum(len(f) - 2 for f in s.f)

    def build(s, name, mat, smooth=True, normal_center=None, normal_radii=(1, 1, 1), normal_up=.35):
        me = bpy.data.meshes.new(name); me.from_pydata(s.v, [], s.f)
        lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
        uvl = me.uv_layers.new(name='UVMap'); uvl.data.foreach_set('uv', np.array(s.uv, np.float32)[lv].ravel())
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        ca.data.foreach_set('color', np.array(s.col, np.float32)[lv].ravel())
        me.color_attributes.active_color = ca; me.color_attributes.render_color_index = 0
        me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
        me.materials.append(mat)
        if normal_center is not None:   # volumetric foliage normals: away from crown centre, biased up
            c = Vector(normal_center); r = Vector(normal_radii); ns = []
            for co in s.v:
                d = Vector(((co[0] - c.x) / r.x, (co[1] - c.y) / r.y, (co[2] - c.z) / r.z))
                d = d.normalized() if d.length > 1e-6 else UP.copy()
                ns.append((d + UP * normal_up).normalized())
            me.normals_split_custom_set_from_vertices(ns)
        me.validate(); ob = bpy.data.objects.new(name, me); return ob

def tube(mb, pts, rads, sides, col=(1, 1, 1, 1), v_scale=1.0, u_rep=1, cap=False):
    n = len(pts)
    T = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    ref = Vector((0, 0, 1)) if abs(T[0].z) < .9 else Vector((1, 0, 0))
    N = T[0].cross(ref).normalized(); rings = []; vacc = 0
    for i in range(n):
        if i > 0:
            ax = T[i - 1].cross(T[i])
            if ax.length > 1e-6: N = Quaternion(ax.normalized(), T[i - 1].angle(T[i])) @ N
            vacc += (pts[i] - pts[i - 1]).length
        B = T[i].cross(N); ring = []
        for j in range(sides + 1):
            a = TAU * j / sides
            ring.append(mb.add(pts[i] + (N * math.cos(a) + B * math.sin(a)) * rads[i], (u_rep * j / sides, vacc * v_scale), col))
        rings.append(ring)
    for i in range(n - 1):
        for j in range(sides): mb.face((rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]))
    if cap:
        c = mb.add(pts[-1] + T[-1] * rads[-1] * .5, (0, vacc * v_scale), col)
        for j in range(sides): mb.face((rings[-1][j], rings[-1][j + 1], c))

def frame(d, up_hint=UP):
    d = d.normalized(); side = d.cross(up_hint)
    if side.length < 1e-4: side = d.cross(Vector((1, 0, 0)))
    side.normalize(); return d, side, side.cross(d).normalized()

def rnd_unit(rng):
    v = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
    return v.normalized() if v.length > 1e-6 else UP.copy()

def leaf(mb, base, d, nrm_hint, L, W, cell, col, prof, segs=3, droop=.25, fold=.18, wave=0.0, rng=None):
    """Blade mesh: `segs` rows along, 3 verts across (V-fold on the midrib), drooping toward the tip."""
    d, side, n = frame(d, nrm_hint)
    if n.dot(nrm_hint) < 0: side, n = -side, -n
    u0, v0, u1, v1 = cell; rows = []
    ph = rng.random() * TAU if rng else 0
    for i in range(segs + 1):
        s = i / segs; w = W * .5 * prof(s)
        c = base + d * (s * L) - n * (droop * L * s * s)
        row = []
        for t in (-1, 0, 1):
            p = c + side * (t * w) + n * (fold * abs(t) * w) + n * (wave * w * math.sin(s * 9 + ph) * abs(t))
            row.append(mb.add(p, (u0 + (t + 1) * .5 * (u1 - u0), v0 + s * (v1 - v0)), col))
        rows.append(row)
    for i in range(segs):
        a, b = rows[i], rows[i + 1]
        mb.face((a[0], a[1], b[1], b[0])); mb.face((a[1], a[2], b[2], b[1]))

def card(mb, base, d, nrm, Wd, L, cell, col, droop=.12, curl=.10):
    """Foliage card, 3×3 grid: bends down along its length and cups across."""
    d, side, n = frame(d, nrm)
    if n.dot(nrm) < 0: side, n = -side, -n
    u0, v0, u1, v1 = cell; g = []
    for i in range(3):
        s = i / 2; row = []
        for j in range(3):
            x = (j / 2 - .5)
            p = base + d * (s * L) + side * (x * Wd) + n * (-droop * L * s * s + curl * Wd * x * x)
            row.append(mb.add(p, (u0 + (x + .5) * (u1 - u0), v0 + s * (v1 - v0)), col))
        g.append(row)
    for i in range(2):
        for j in range(2): mb.face((g[i][j], g[i][j + 1], g[i + 1][j + 1], g[i + 1][j]))

def ellipsoid(mb, c, axis, r_long, r, col, seg=6, rings=4, tip_col=None):
    d, s1, s2 = frame(axis, rnd_unit(random.Random(int(c.x * 1e4) ^ int(c.y * 1e4))))
    top = mb.add(c + d * r_long, (0, 1), tip_col or col); bot = mb.add(c - d * r_long, (0, 0), col)
    ringsv = []
    for i in range(1, rings):
        a = math.pi * i / rings; z = math.cos(a) * r_long; rr = math.sin(a) * r
        ringsv.append([mb.add(c + d * z + (s1 * math.cos(TAU * j / seg) + s2 * math.sin(TAU * j / seg)) * rr, (j / seg, 1 - i / rings), col) for j in range(seg)])
    for j in range(seg):
        k = (j + 1) % seg
        mb.face((top, ringsv[0][j], ringsv[0][k])[::-1])
        mb.face((bot, ringsv[-1][k], ringsv[-1][j])[::-1])
    for i in range(len(ringsv) - 1):
        for j in range(seg):
            k = (j + 1) % seg; mb.face((ringsv[i][k], ringsv[i + 1][k], ringsv[i + 1][j], ringsv[i][j]))

def grow(rng, p, d, L, r0, r1, segs, wobble, trop):
    pts = [p.copy()]; step = L / segs
    for _ in range(segs):
        d = (d + rnd_unit(rng) * wobble + trop(pts[-1], d)).normalized(); pts.append(pts[-1] + d * step)
    return pts, [r0 + (r1 - r0) * (i / segs) ** .8 for i in range(segs + 1)]

def spread(rng, d, angle, out_bias):
    perp = (rnd_unit(rng) + out_bias)
    perp = (perp - d * perp.dot(d))
    perp = perp.normalized() if perp.length > 1e-5 else d.orthogonal().normalized()
    return (d * math.cos(angle) + perp * math.sin(angle)).normalized()

def tint(rng, base, var=.08):
    k = rng.uniform(1 - var, 1 + var); return (base[0] * k * rng.uniform(.96, 1.04), base[1] * k, base[2] * k * rng.uniform(.94, 1.06), 1)

# ───────────────────────────── materials ─────────────────────────────

def material(name, img, rough, alpha=False, two_sided=False, spec=.5, normal=None, normal_strength=1.0):
    if name in bpy.data.materials:
        if bpy.data.materials[name].users: return bpy.data.materials[name]
        bpy.data.materials.remove(bpy.data.materials[name])
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = spec
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    if img is not None:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1.0
        nt.links.new(tex.outputs['Color'], mix.inputs[6]); nt.links.new(vc.outputs['Color'], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
        if alpha:
            rnd = nt.nodes.new('ShaderNodeMath'); rnd.operation = 'ROUND'   # glTF exporter reads ROUND as alphaMode MASK
            nt.links.new(tex.outputs['Alpha'], rnd.inputs[0]); nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
            try: m.surface_render_method = 'DITHERED'
            except Exception: pass
    else:
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    if normal is not None:
        nimg = normal; nimg.colorspace_settings.name = 'Non-Color'
        nt_ = nt.nodes.new('ShaderNodeTexImage'); nt_.image = nimg
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(nt_.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    m.use_backface_culling = not two_sided
    return m

# ───────────────────────────── species ─────────────────────────────

COFFEE_LOD = {0: dict(stem=6, lat=4, node=.075, leafstep=.062, segs=4, leafk=1.0, latpts=6, cherry=(6, 2), kmax=7),
              1: dict(stem=4, lat=3, node=.13, leafstep=.11, segs=2, leafk=1.6, latpts=5, cherry=(4, 2), kmax=5),
              2: dict(stem=3, lat=3, node=.19, leafstep=.14, segs=2, leafk=2.5, latpts=3, cherry=None, kmax=0),
              # 3: game instancing for the big species (robusta / liberica): fewer, larger leaf pairs, blob fruit
              3: dict(stem=3, lat=3, node=.3, leafstep=.26, segs=1, leafk=3.4, latpts=3, cherry=None, kmax=0)}
COFFEE_RIPE = [((.70, .03, .03), .58), ((.45, .02, .05), .17), ((.85, .18, .03), .12), ((.88, .52, .08), .06), ((.38, .55, .12), .07)]
COFFEE_GREEN = [((.30, .52, .10), .6), ((.42, .60, .14), .3), ((.58, .60, .14), .1)]

# Species profiles (founder table 2026-11-08): arabica compact ~2 m; robusta (C. canephora) wide umbrella canopy ~2.7 m,
# big wavy leaves, dense clusters of small cherries; liberica a tall tree ~4.5 m, clear trunk, huge leathery leaves, big
# cherries in small clusters. Factors scale the arabica build.
COFFEE_SPECIES = {
    'arabica': dict(H=(1.85, 2.15), youngH=1.0, seedH=1.0, stems=(2, 3, 3), trunk=1.0, lean=(5, 13), lat=1.0, rise=.22, sag=1.0,
                    leaf=1.0, leafw=.42, tint=(1, 1, 1), cherry=1.0, k=(4, 0), clear=1.0, node=1.0),
    'robusta': dict(H=(2.5, 2.95), youngH=1.1, seedH=1.1, stems=(3, 4, 4), trunk=1.15, lean=(14, 24), lat=1.85, rise=.12, sag=1.7,
                    leaf=1.55, leafw=.40, tint=(1.1, 1.12, 1.0), cherry=.86, k=(6, 3), clear=1.0, node=1.25),
    'liberica': dict(H=(4.2, 5.0), youngH=1.4, seedH=1.25, stems=(1, 1, 1), trunk=2.4, lean=(1, 3), lat=1.9, rise=.38, sag=.5,
                     leaf=1.9, leafw=.46, tint=(.84, .9, .84), cherry=1.45, k=(2, -2), clear=2.6, node=1.05),
}

def coffee_robusta(seed=13, lod=0, stage='mature'): return coffee_arabica(seed, lod, stage, 'robusta')
def coffee_liberica(seed=17, lod=0, stage='mature'): return coffee_arabica(seed, lod, stage, 'liberica')

def coffee_arabica(seed=11, lod=0, stage='mature', species='arabica'):
    """Coffea arabica (or a sister species via `species`, COFFEE_SPECIES). stage: 'seedling' (~25 cm nursery plant), 'young' (~0.9 m, first laterals), 'mature' (~2 m, pruned
    multi-stem). Mature emits separate flower / green-cherry / ripe-cherry meshes at the same axils, so the game shows
    mature, flowering, green, ripe and harvested by toggling parts of one model."""
    rng = random.Random(seed); P = COFFEE_LOD[lod]; S = COFFEE_SPECIES[species]
    M_bark = material('coffee_bark', to_image('T_coffee_bark', lambda: tex_bark('coffee', 11)), .85)
    M_leaf = material('coffee_leaf', to_image('T_coffee_leaf', lambda: tex_coffee_leaf(11)), .38, two_sided=True, spec=.6)
    M_fruit = material('coffee_cherry', None, .32, spec=.7); M_flower = material('coffee_flower', None, .6, two_sided=True)
    bark, lf, fl, cg, cr = MB(), MB(), MB(), MB(), MB()
    elliptic = lambda s: (math.sin(math.pi * min(1, s ** .9)) ** .7) * (1 - .2 * s ** 3) + (.04 if s < .02 else 0)
    roundish = lambda s: math.sin(math.pi * s) ** .6 + (.05 if s < .02 else 0)
    def pick(mix):
        r = rng.random(); acc = 0
        for c, p in mix:
            acc += p
            if r <= acc: return tint(rng, c, .1)
        return tint(rng, mix[0][0], .1)
    def leaf_pair(p, tdir, sv, hf, young, upward=0.0):
        for sgn in (-1, 1):
            ang = math.radians(rng.uniform(48, 68))
            ld = (tdir * math.cos(ang) + sv * sgn * math.sin(ang) + UP * (upward - rng.uniform(.05, .3))).normalized()
            ll = (rng.uniform(.07, .10) if young else rng.uniform(.13, .175)) * (1.08 - .25 * hf) * P['leafk'] * S['leaf']
            leaf(lf, p, ld, (UP + rnd_unit(rng) * .25).normalized(), ll, ll * S['leafw'], COFFEE_CELLS[1 if young else 0],
                 tint(rng, S['tint'], .1), elliptic, segs=P['segs'], droop=rng.uniform(.18, .35) * (1.2 if species == 'robusta' else 1),
                 fold=.22 if P['segs'] > 1 else 0, wave=.12 if species == 'robusta' else .05, rng=rng)
    def fruit_cluster(p, sv, sgn):
        if lod >= 2:   # far LOD: one bumpy blob per axil cluster reads as a red dot from the game camera
            c = p + sv * sgn * .016 - UP * .008
            cs = S['cherry']
            ellipsoid(cg, c, sv * sgn, .022 * cs, .019 * cs, pick(COFFEE_GREEN), 6, 2); ellipsoid(cr, c, sv * sgn, .022 * cs, .019 * cs, pick(COFFEE_RIPE), 6, 2)
            ellipsoid(fl, c + UP * .01, UP, .02, .02, (.95, .95, .9, 1), 5, 3); return
        cs = S['cherry']; k = rng.randint(min(S['k'][0], P['kmax'] + S['k'][1]), max(S['k'][0], P['kmax'] + S['k'][1]))
        for _ in range(k):
            off = (sv * sgn * rng.uniform(.006, .017) + rnd_unit(rng) * .009 - UP * .006) * cs
            ax = (off.normalized() + rnd_unit(rng) * .5).normalized()
            ellipsoid(cg, p + off, ax, .0083 * cs, .0069 * cs, pick(COFFEE_GREEN), *P['cherry'], tip_col=(.20, .22, .05, 1))
            ellipsoid(cr, p + off, ax, .0083 * cs, .0069 * cs, pick(COFFEE_RIPE), *P['cherry'], tip_col=(.12, .04, .02, 1))
            # white star flower (5 petals) at the same spot: arabica flowers come in axillary clusters before the fruit
            n = (off.normalized() + UP * .6).normalized(); d, s1, s2 = frame(n, rnd_unit(rng)); c0 = p + off * 1.2
            if rng.random() < .3: continue
            ph = rng.random() * TAU; cen = fl.add(c0 + n * .002, (0, 0), (.9, .88, .7, 1))
            pts = [fl.add(c0 + (s1 * math.cos(ph + TAU * j / 5) + s2 * math.sin(ph + TAU * j / 5)) * .009 - n * .001, (0, 0), (.97, .97, .94, 1)) for j in range(5)]
            for j in range(5): fl.face((cen, pts[j], pts[(j + 1) % 5]))
    if stage == 'seedling':
        H = rng.uniform(.24, .32) * S['seedH']; n = 6
        pts = [Vector((rng.gauss(0, .003) * (i > 0), rng.gauss(0, .003) * (i > 0), H * i / n)) for i in range(n + 1)]
        tube(bark, pts, [.005 * (1 - .6 * i / n) for i in range(n + 1)], 4, col=(.7, .85, .55, 1), v_scale=4, cap=True)
        phi = rng.random() * TAU
        for sgn in (-1, 1):   # rounded cotyledons ("butterfly" stage) low on the stem
            d = Vector((math.cos(phi) * sgn, math.sin(phi) * sgn, .25)).normalized()
            leaf(lf, pts[1] + UP * .01, d, UP, .03, .028, COFFEE_CELLS[1], (1, 1, 1, 1), roundish, segs=2, droop=.1, fold=.1, rng=rng)
        z = .08
        while z < H - .01:
            phi += math.pi / 2; hf = z / H
            for sgn in (-1, 1):
                d = (Vector((math.cos(phi) * sgn, math.sin(phi) * sgn, 0)) + UP * (.5 + .6 * hf)).normalized()
                ll = (.045 + .05 * (1 - hf) * rng.uniform(.8, 1.1)) * S['leaf'] ** .6
                leaf(lf, Vector((0, 0, z)), d, (UP + rnd_unit(rng) * .2).normalized(), ll, ll * (S['leafw'] + .03), COFFEE_CELLS[1 if hf > .7 else 0],
                     tint(rng, S['tint'], .08), elliptic, segs=max(2, P['segs']), droop=.2, fold=.25, rng=rng)
            z += .045 * S['seedH']
        objs = [bark.build('coffee_bark', M_bark), lf.build('coffee_leaves', M_leaf, normal_center=(0, 0, H * .5), normal_radii=(.1, .1, .15), normal_up=.4)]
        return objs, {'height': H, 'tris': bark.tris + lf.tris}
    young = stage == 'young'
    H = rng.uniform(.8, .95) * S['youngH'] if young else rng.uniform(*S['H'])
    nstem = 1 if young else rng.choice(S['stems']); az0 = rng.random() * TAU
    for si in range(nstem):
        az = az0 + si * TAU / nstem + rng.uniform(-.4, .4); lean = math.radians(rng.uniform(2, 5) if young else rng.uniform(*S['lean']))
        base = Vector((rng.uniform(-.05, .05), rng.uniform(-.05, .05), 0)) * (0 if young else 1)
        Hs = H * rng.uniform(.9, 1.0); n = max(4, int(10 * P['stem'] / 6))
        pts = [base + Vector((math.sin(lean) * math.cos(az) * Hs * (i / n) ** 1.1, math.sin(lean) * math.sin(az) * Hs * (i / n) ** 1.1, Hs * i / n))
               + Vector((rng.gauss(0, .008), rng.gauss(0, .008), 0)) * (i > 0) for i in range(n + 1)]
        tube(bark, pts, [(.014 if young else .028) * S['trunk'] ** (.6 if young else 1) * (1 - .82 * (i / n)) for i in range(n + 1)], P['stem'], v_scale=4, cap=True)
        stem_at = lambda z: pts[0].lerp(pts[-1], z / Hs)
        z = ((.16 if young else .22) + rng.uniform(0, .04)) * (S['clear'] if not young else S['clear'] ** .5); phi = rng.random() * TAU
        while z < Hs - .06:
            phi += math.pi / 2 + rng.uniform(-.25, .25); hf = z / Hs
            for side in (0, 1):
                if not young and hf < .3 and rng.random() < .3: continue
                a = phi + side * math.pi
                L = ((.34 if young else .72) * (1 - hf) ** .75 + .06) * rng.uniform(.85, 1.12) * (S['lat'] ** (.5 if young else 1))
                p0 = stem_at(z); hdir = Vector((math.cos(a), math.sin(a), 0))
                sag = rng.uniform(.18, .32) * (1.2 - hf * .6) * (.5 if young else 1) * S['sag']
                wig = Vector((rng.gauss(0, .02), rng.gauss(0, .02), 0)); npt = P['latpts']
                lp = [p0 + (hdir + wig * s) * (L * s) + UP * (L * (S['rise'] * s - sag * s * s)) for s in np.linspace(0, 1, npt)]
                tube(bark, lp, [(.0035 if young else .0052) * S['trunk'] ** .5 * (1 - .65 * s) for s in np.linspace(0, 1, npt)], P['lat'], v_scale=4, col=(.75, .85, .62, 1))
                nodes = max(2 if lod < 2 else 1, int(L / (P['leafstep'] * S['node'])))
                for k in range(1, nodes + 1):
                    s = k / (nodes + .3)
                    f = s * (npt - 1); i0 = min(npt - 2, int(f)); p = lp[i0].lerp(lp[i0 + 1], f - i0)
                    tdir = (lp[i0 + 1] - lp[i0]).normalized(); sv = tdir.cross(UP).normalized()
                    if young or s > .34 or (hf > .8 and s > .12) or lod == 2:
                        leaf_pair(p, tdir, sv, hf, s > .86)
                    if not young and .08 < s < .7 and rng.random() < (.5 if lod < 2 else .75):
                        for sgn in (-1, 1):
                            if rng.random() < .15: continue
                            fruit_cluster(p, sv, sgn)
            z += P['node'] * S['node'] * rng.uniform(.85, 1.15)
        tip = pts[-1]
        for k in range(2 if lod < 2 else 1):
            for sgn in (-1, 1):
                a = phi + k * math.pi / 2 + (0 if sgn > 0 else math.pi)
                ld = (Vector((math.cos(a), math.sin(a), 0)) + UP * .9).normalized()
                leaf(lf, tip - UP * (.03 + .05 * k), ld, (UP + rnd_unit(rng) * .3).normalized(), (.07 + .03 * k) * P['leafk'] ** .5, (.03 + .012 * k) * P['leafk'] ** .5,
                     COFFEE_CELLS[1], tint(rng, (1, 1, 1)), elliptic, segs=min(2, P['segs']), droop=.25, fold=.25, rng=rng)
    objs = [bark.build('coffee_bark', M_bark),
            lf.build('coffee_leaves', M_leaf, normal_center=(0, 0, H * .45), normal_radii=(.7 * H / 2, .7 * H / 2, H / 2), normal_up=.3)]
    if not young:
        objs += [fl.build('coffee_flowers', M_flower), cg.build('coffee_cherries_green', M_fruit), cr.build('coffee_cherries_ripe', M_fruit)]
    shown = bark.tris + lf.tris + max(cg.tris, fl.tris)
    return objs, {'height': H, 'tris': shown, 'cherry_tris': cr.tris, 'flower_tris': fl.tris}

def albizia_schimperiana(seed=2, lod=0):
    """Albizia schimperiana: 13–16 m, clear trunk, ascending limbs, flat-topped layered umbrella crown."""
    rng = random.Random(seed)
    M_bark = material('albizia_bark', to_image('T_albizia_bark', lambda: tex_bark('albizia', seed)), .75)
    M_fol = material('albizia_foliage', to_image('T_albizia_foliage', lambda: tex_albizia_cards(seed)), .7, alpha=True, two_sided=True, spec=.35)
    bark, fol = MB(), MB(); terminals = []
    top = rng.uniform(13.5, 15.5); trunk_h = rng.uniform(4.8, 6.0); base_sides = (12, 7, 5, 4)[lod]
    def trop(p, d):
        out = Vector((p.x, p.y, 0)); out = out.normalized() if out.length > 1e-3 else Vector()
        t = out * .05
        if p.z > top - 3.0: t += Vector((0, 0, -d.z * .45)) + out * .05      # canopy flattens into layers
        elif p.z < top - 6: t += UP * .02
        return t
    tp, tr = grow(rng, Vector((0, 0, 0)), UP, trunk_h, .40, .29, 9, .025, lambda p, d: Vector())
    tr[0] *= 1.55; tr[1] *= 1.18
    tube(bark, tp, tr, base_sides, v_scale=1 / (TAU * .38))
    def branch(p, d, L, r, depth):
        segs = max(3, int(L * 1.4)); sides = max(3, base_sides - 3 * (depth + 1))
        bp, br = grow(rng, p, d, L, r, r * .6, segs, .05 + .03 * depth, trop)
        tube(bark, bp, br, sides, v_scale=1 / (TAU * max(r, .05)), cap=depth >= 3)
        if depth >= (4, 3, 2, 1)[lod] or r < .016:
            terminals.append((bp, br)); return
        nch = 2 if rng.random() < .55 else 3
        for c in range(nch):
            f = 1.0 if c == 0 else rng.uniform(.5, .85); idx = max(1, min(len(bp) - 1, round(f * (len(bp) - 1))))
            q = bp[idx]; dd = (bp[idx] - bp[idx - 1]).normalized()
            out = Vector((q.x, q.y, 0)); out = out.normalized() * .9 if out.length > 1e-3 else Vector()
            cd = spread(rng, dd, math.radians(rng.uniform(22, 42)), out)
            branch(q - dd * br[idx] * .6, cd, L * rng.uniform(.58, .74), br[idx] * (.82 if c == 0 else .62), depth + 1)
        if depth >= 1 and lod == 0:         # secondary twigs feeding the foliage pads
            for _ in range(rng.randint(1, 2)):
                idx = rng.randint(1, len(bp) - 1); dd = (bp[idx] - bp[idx - 1]).normalized()
                terminals.append(grow(rng, bp[idx], spread(rng, dd, math.radians(50), Vector()), L * .35, br[idx] * .5, .01, 3, .1, trop))
    nlimb = rng.choice([3, 4, 4, 5]); az0 = rng.random() * TAU
    for k in range(nlimb):
        az = az0 + k * TAU / nlimb + rng.uniform(-.35, .35); el = math.radians(rng.uniform(32, 50))
        branch(tp[-2].lerp(tp[-1], .5), Vector((math.sin(el) * math.cos(az), math.sin(el) * math.sin(az), math.cos(el))),
               rng.uniform(5.2, 6.6), .24, 0)
    density = (8.0, 3.0, 1.1, .55)[lod]
    for bp, br in terminals:
        L = sum((bp[i + 1] - bp[i]).length for i in range(len(bp) - 1))
        ncard = max(2, int(L * density))
        for k in range(ncard):
            f = rng.uniform(.3, 1.0); i0 = min(len(bp) - 2, int(f * (len(bp) - 1)))
            p = bp[i0].lerp(bp[i0 + 1], f * (len(bp) - 1) - i0)
            out = Vector((p.x, p.y, 0)); out = out.normalized() if out.length > 1e-3 else rnd_unit(rng)
            yaw = (out + rnd_unit(rng) * .9); yaw.z = 0; yaw = yaw.normalized() if yaw.length > 1e-3 else out
            d = (yaw + UP * rng.uniform(-.15, .25)).normalized()
            nrm = (UP + rnd_unit(rng) * .35).normalized()
            sz = rng.uniform(1.5, 2.1) * (1, 1.3, 2.0, 3.0)[lod]
            card(fol, p + UP * rng.uniform(-.15, .3) - d * .3, d, nrm, sz, sz, ALBIZIA_CELLS[rng.randint(0, 1)],
                 tint(rng, (1, 1, 1), .12), droop=.10, curl=.12)
    objs = [bark.build('albizia_bark', M_bark),
            fol.build('albizia_foliage', M_fol, normal_center=(0, 0, top - 2.5), normal_radii=(8, 8, 2.5), normal_up=.6)]
    return objs, {'height': top, 'tris': bark.tris + fol.tris}

def cordia_africana(seed=3, lod=0, flowering=True):
    """Cordia africana: 9–12 m, short often crooked trunk, sympodial limbs, dense rounded crown, white flower trusses."""
    rng = random.Random(seed)
    M_bark = material('cordia_bark', to_image('T_cordia_bark', lambda: tex_bark('cordia', seed)), .92)
    M_fol = material('cordia_foliage', to_image('T_cordia_foliage', lambda: tex_cordia(seed)), .75, alpha=True, two_sided=True, spec=.35)
    bark, fol = MB(), MB(); terminals = []; inner = []
    C = Vector((0, 0, rng.uniform(6.4, 7.0))); R = Vector((rng.uniform(4.6, 5.4), rng.uniform(4.4, 5.2), 3.4)); base_sides = (12, 7, 5, 4)[lod]
    def trop(p, d):
        q = Vector(((p.x - C.x) / R.x, (p.y - C.y) / R.y, (p.z - C.z) / R.z))
        out = Vector((p.x, p.y, 0)); out = out.normalized() if out.length > 1e-3 else Vector()
        if q.length > .95: return -Vector((q.x, q.y, q.z * .6)).normalized() * .10 + UP * .02   # stay inside the dome
        return out * .05 + UP * .045
    lean = rnd_unit(rng); lean.z = 0; lean = lean.normalized() * .12
    tp, tr = grow(rng, Vector((0, 0, 0)), (UP + lean).normalized(), rng.uniform(2.2, 3.0), .36, .30, 6, .07, lambda p, d: Vector())
    tr[0] *= 1.5; tr[1] *= 1.12
    tube(bark, tp, tr, base_sides, v_scale=1 / (TAU * .33))
    def branch(p, d, L, r, depth):
        segs = max(3, int(L * 1.7)); sides = max(3, base_sides - 3 * (depth + 1))
        bp, br = grow(rng, p, d, L, r, r * .62, segs, .09 + .03 * depth, trop)
        tube(bark, bp, br, sides, v_scale=1 / (TAU * max(r, .05)), cap=depth >= 3)
        if depth >= 2: inner.append((bp, br))
        if depth >= (4, 3, 2, 1)[lod] or r < .02:
            terminals.append((bp, br)); return
        nch = 2 if rng.random() < .5 else 3
        for c in range(nch):
            f = 1.0 if c == 0 else rng.uniform(.45, .85); idx = max(1, min(len(bp) - 1, round(f * (len(bp) - 1))))
            q = bp[idx]; dd = (bp[idx] - bp[idx - 1]).normalized()
            out = Vector((q.x, q.y, 0)); out = out.normalized() * .6 if out.length > 1e-3 else Vector()
            branch(q - dd * br[idx] * .6, spread(rng, dd, math.radians(rng.uniform(25, 48)), out),
                   L * rng.uniform(.6, .76), br[idx] * (.8 if c == 0 else .6), depth + 1)
    nlimb = rng.choice([3, 4, 4]); az0 = rng.random() * TAU
    for k in range(nlimb):
        az = az0 + k * TAU / nlimb + rng.uniform(-.4, .4); el = math.radians(rng.uniform(28, 52))
        branch(tp[-2].lerp(tp[-1], .6), Vector((math.sin(el) * math.cos(az), math.sin(el) * math.sin(az), math.cos(el))),
               rng.uniform(3.8, 4.8), .2, 0)
    density = (15.0, 5.0, 2.2, .9)[lod]
    leaf_cells = [CORDIA_CELLS['leafA'], CORDIA_CELLS['leafB'], CORDIA_CELLS['leafC']]
    for bp, br in terminals + inner:
        L = sum((bp[i + 1] - bp[i]).length for i in range(len(bp) - 1))
        is_tip = any(bp is t[0] for t in terminals)
        for k in range(max(2, int(L * density * (1 if is_tip else .45)))):
            f = rng.uniform(.2, 1.0); i0 = min(len(bp) - 2, int(f * (len(bp) - 1)))
            p = bp[i0].lerp(bp[i0 + 1], f * (len(bp) - 1) - i0)
            out = (p - C); out = Vector((out.x / R.x, out.y / R.y, out.z / R.z)).normalized()
            d = (out + UP * .3 + rnd_unit(rng) * .7).normalized()
            nrm = (out * .6 + UP * .5 + rnd_unit(rng) * .4).normalized()
            sz = rng.uniform(.95, 1.25) * (1, 1.35, 2.1, 3.2)[lod]
            card(fol, p - d * .1, d, nrm, sz, sz, leaf_cells[rng.randint(0, 2)], tint(rng, (1, 1, 1), .12), droop=.12, curl=.15)
        if flowering and is_tip and rng.random() < .8:
            p = bp[-1]; out = (p - C).normalized()
            for _ in range(rng.randint(2, 3)):
                d = (out + UP * .6 + rnd_unit(rng) * .5).normalized()
                card(fol, p + out * .25 + rnd_unit(rng) * .2, d, (out + UP).normalized(), .75, .75, CORDIA_CELLS['flower'], (1, 1, 1, 1), droop=.05, curl=.2)
    objs = [bark.build('cordia_bark', M_bark),
            fol.build('cordia_foliage', M_fol, normal_center=tuple(C), normal_radii=tuple(R), normal_up=.35)]
    return objs, {'height': C.z + R.z, 'tris': bark.tris + fol.tris}

def ensete_ventricosum(seed=4, lod=0):
    """Ensete ventricosum (false banana) mature: swollen pseudostem, 14–18 huge paddle leaves, red midribs, no fruit."""
    rng = random.Random(seed)
    M_stem = material('enset_pseudostem', to_image('T_enset_stem', lambda: tex_bark('enset', seed)), .55)
    M_leaf = material('enset_leaf', to_image('T_enset_leaf', lambda: tex_enset_leaf(seed)), .45, alpha=True, two_sided=True, spec=.55)
    M_rib = material('enset_midrib', None, .45)
    stem, blade, rib = MB(), MB(), MB()
    Hs = rng.uniform(2.8, 3.2); sides = 18 if lod == 0 else 10
    prof = lambda z: .44 * (1 + .35 * math.sin(math.pi * min(1, z / Hs * 1.6)) ) * (1 - .45 * (z / Hs) ** 1.4) + .02
    n = 12; sp = [Vector((rng.gauss(0, .01), rng.gauss(0, .01), Hs * i / n)) for i in range(n + 1)]
    tube(stem, sp, [prof(p.z) for p in sp], sides, v_scale=1 / Hs, u_rep=2)
    # loose outer sheaths with diagonal tops (overlapping leaf bases)
    for k in range(4 if lod == 0 else 2):
        a0 = rng.random() * TAU; span = rng.uniform(.55, .85) * TAU; ztop = Hs * rng.uniform(.55, .95); seg = 10; rows = 6
        grid = []
        for i in range(rows + 1):
            row = []
            for j in range(seg + 1):
                a = a0 + span * j / seg; zt = ztop - .5 * (j / seg); z = zt * i / rows
                r = prof(z) + .012 + .01 * k
                row.append(stem.add((math.cos(a) * r, math.sin(a) * r, z), (j / seg * .5, z / Hs)))
            grid.append(row)
        for i in range(rows):
            for j in range(seg): stem.face((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    top = Vector((0, 0, Hs)); nleaf = rng.randint(14, 17) if lod == 0 else 10
    rib_sides = 6 if lod == 0 else 4; segL = 16 if lod == 0 else 9
    phi = rng.random() * TAU
    for k in range(nleaf):
        age = k / (nleaf - 1)                                           # 0 = youngest (centre, upright), 1 = oldest
        phi += math.radians(137.5 + rng.uniform(-12, 12))
        tilt0 = math.radians(3 + 30 * age ** 1.1 + rng.uniform(-3, 3)); bend = math.radians(12 + 62 * age ** 1.5 + rng.uniform(-8, 8))
        Lb = rng.uniform(3.4, 4.4) * (.75 + .25 * min(1, age * 3)); Wb = Lb * rng.uniform(.26, .31); pet = rng.uniform(.3, .5)
        h = Vector((math.cos(phi), math.sin(phi), 0)); side = Vector((-h.y, h.x, 0))
        start = top + h * .06 * (1 - age) - UP * (.25 + .2 * age); total = pet + Lb; pts = [start]; th = []
        N = segL + 3
        for i in range(N):
            s = i / (N - 1); a = tilt0 + bend * s ** 1.6; th.append(a)
            if i: pts.append(pts[-1] + (h * math.sin(a) + UP * math.cos(a)) * (total / (N - 1)))
        sb0 = pet / total
        rads = [(.075 if lod == 0 else .07) * (1 - .85 * (i / (N - 1)) ** .6) + .004 for i in range(N)]
        tube(rib, pts, rads, rib_sides, col=tint(rng, (.50, .26, .16), .12) if age > .2 else (.52, .44, .22, 1))
        cell = ENSET_CELLS[0 if age < .25 else (1 if rng.random() < .55 or age < .5 else 2)]
        if age > .92 and rng.random() < .5: cell = ENSET_CELLS[2]
        rows = []; twist = rng.uniform(-.25, .25)
        for i in range(N):
            s = i / (N - 1)
            if s < sb0 - 1e-6: continue
            sb = (s - sb0) / (1 - sb0)
            w = Wb * .5 * min(1, (sb / .06)) ** .45 * min(1, ((1 - sb) / .16)) ** .28 + .01
            T = (pts[min(i + 1, N - 1)] - pts[max(i - 1, 0)]).normalized()
            sd = (side * math.cos(twist * sb) + T.cross(side).normalized() * math.sin(twist * sb)).normalized()
            nrm = sd.cross(T).normalized()
            if nrm.z < 0: nrm = -nrm
            row = []
            for t in (-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1):
                lift = (.18 * (1 - age) - .30 * age) * abs(t) ** 1.4 * w          # young: V-cup, old: Λ-droop
                ripple = .02 * w * math.sin(sb * 23 + t * 3) * abs(t)
                p = pts[i] + sd * (t * w) + nrm * (lift + ripple + .012)
                u0, v0, u1, v1 = cell
                row.append(blade.add(p, (u0 + (t + 1) * .5 * (u1 - u0), v0 + sb * (v1 - v0)), tint(rng, (1, 1, 1), .04)))
            rows.append(row)
        for i in range(len(rows) - 1):
            for j in range(6): blade.face((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    # dry skirt: old leaves collapsed and hanging against the pseudostem
    for k in range(rng.randint(4, 6) if lod == 0 else 3):
        a = rng.random() * TAU; h = Vector((math.cos(a), math.sin(a), 0)); side = Vector((-h.y, h.x, 0))
        z0 = Hs * rng.uniform(.82, .98); L = rng.uniform(1.1, 1.8); w = rng.uniform(.18, .32); rows = []
        for i in range(7):
            s = i / 6; z = z0 + .15 * math.sin(s * math.pi * .5) * (1 - s) - L * s * s * .95
            r = prof(max(0, z)) + .05 + .25 * math.sin(math.pi * min(1, s * 1.6)) * (1 - s)
            c = h * r + Vector((0, 0, max(.05, z)))
            row = [blade.add(c + side * (t * w * (1 - .4 * s)) + h * (.06 * abs(t)),
                             (ENSET_CELLS[3][0] + (t + 1) * .5 * .25, s), tint(rng, (1, 1, 1), .1)) for t in (-1, 0, 1)]
            rows.append(row)
        for i in range(6):
            for j in range(2): blade.face((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    # rolled cigar leaf emerging at the centre
    cp = [top - UP * .2 + Vector((rng.gauss(0, .02), rng.gauss(0, .02), 0)) + UP * (1.3 * i / 5) for i in range(6)]
    tube(rib, cp, [.07 * (1 - .8 * i / 5) + .01 for i in range(6)], rib_sides, col=(.55, .70, .30, 1), cap=True)
    objs = [stem.build('enset_pseudostem', M_stem), rib.build('enset_midribs', M_rib),
            blade.build('enset_leaves', M_leaf, normal_center=(0, 0, Hs + 1.2), normal_radii=(3, 3, 2), normal_up=.4)]
    return objs, {'height': Hs + 4, 'tris': stem.tris + blade.tris + rib.tris}

# ───────────────────────────── assembly / export ─────────────────────────────

HEROES = {
    'coffea_arabica_mature': (coffee_arabica, {'seed': 11, 'stage': 'mature'}),
    'coffea_arabica_young': (coffee_arabica, {'seed': 7, 'stage': 'young'}),
    'coffea_arabica_seedling': (coffee_arabica, {'seed': 5, 'stage': 'seedling'}),
    'coffea_robusta_mature': (coffee_robusta, {'seed': 13, 'stage': 'mature'}),
    'coffea_robusta_young': (coffee_robusta, {'seed': 9, 'stage': 'young'}),
    'coffea_robusta_seedling': (coffee_robusta, {'seed': 6, 'stage': 'seedling'}),
    'coffea_liberica_mature': (coffee_liberica, {'seed': 17, 'stage': 'mature'}),
    'coffea_liberica_young': (coffee_liberica, {'seed': 8, 'stage': 'young'}),
    'coffea_liberica_seedling': (coffee_liberica, {'seed': 4, 'stage': 'seedling'}),
    'albizia_schimperiana': (albizia_schimperiana, {'seed': 23}),
    'cordia_africana': (cordia_africana, {'seed': 31}),
    'ensete_ventricosum': (ensete_ventricosum, {'seed': 47}),
}

def build_asset(key, lod=0, collection=None, location=(0, 0, 0), **over):
    fn, kw = HEROES[key]; kw = {**kw, **over}
    objs, info = fn(lod=lod, **kw)
    col = collection or bpy.context.scene.collection
    root = bpy.data.objects.new(f'{key}_LOD{lod}', None); col.objects.link(root); root.location = location
    for o in objs:
        col.objects.link(o); o.parent = root
    info['root'] = root.name; info['lod'] = lod
    return root, info

def build_showcase():
    """Clean scene with the four heroes at real scale on Gedeo red-brown soil, for QA renders."""
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for b in list(coll):
            if b.users == 0: coll.remove(b)
    sc = bpy.context.scene
    layout = {'coffea_arabica_mature': (0, 0, 0), 'ensete_ventricosum': (4.5, 1.0, 0),
              'cordia_africana': (-10, 7, 0), 'albizia_schimperiana': (15, 12, 0)}
    infos = {}
    for key, loc in layout.items():
        _, info = build_asset(key, 0, sc.collection, loc); infos[key] = info
    gmb = MB(); s = 60; col = (.26, .14, .08, 1)
    gmb.face([gmb.add(p, (0, 0), col) for p in ((-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0))])
    g = gmb.build('qa_ground', material('qa_soil', None, .95)); sc.collection.objects.link(g)
    if 'qa_sun' not in bpy.data.objects:
        sun = bpy.data.lights.new('qa_sun', 'SUN'); sun.energy = 4.5; sun.angle = math.radians(2)
        so = bpy.data.objects.new('qa_sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(35))
    w = sc.world or bpy.data.worlds.new('qa_world'); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (.62, .75, .92, 1); bg.inputs[1].default_value = .9
    for k, v in infos.items(): print(k, v)
    return infos

def shrink_textures(objs, color_max=1024, normal_max=512):
    """Mobile texture budget: scale down every image used by these objects' materials before export."""
    seen = set()
    for o in objs:
        for slot in getattr(o, 'material_slots', []):
            m = slot.material
            if not m or not m.use_nodes: continue
            for n in m.node_tree.nodes:
                if n.type != 'TEX_IMAGE' or not n.image or n.image.name in seen: continue
                img = n.image; seen.add(img.name)
                cap = normal_max if img.colorspace_settings.name == 'Non-Color' else color_max
                w, h = img.size
                if max(w, h) > cap:
                    k = cap / max(w, h); img.scale(max(1, int(w * k)), max(1, int(h * k)))

def export_glb(root_name, path):
    bpy.ops.object.select_all(action='DESELECT')
    root = bpy.data.objects[root_name]; root.select_set(True)
    for c in root.children_recursive: c.select_set(True)
    shrink_textures(root.children_recursive)
    loc = root.location.copy(); root.location = (0, 0, 0)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
              export_image_format='WEBP', export_vertex_color='ACTIVE', export_extras=False, export_animations=False)
    try: bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print('export option fallback:', e); kw.pop('export_vertex_color'); bpy.ops.export_scene.gltf(**kw)
    root.location = loc
    print('exported', path, os.path.getsize(path) // 1024, 'KB')

HERO_LODS = {'coffea_arabica_mature': (0, 1, 2), 'coffea_arabica_young': (0, 1, 2), 'coffea_arabica_seedling': (0, 1),
             'coffea_robusta_mature': (0, 1, 2), 'coffea_robusta_young': (0, 1), 'coffea_robusta_seedling': (0,),
             'coffea_liberica_mature': (0, 1, 2), 'coffea_liberica_young': (0, 1), 'coffea_liberica_seedling': (0,),
             'albizia_schimperiana': (0, 1, 2, 3), 'cordia_africana': (0, 1, 2, 3)}

def purge():
    """Remove all objects and orphan meshes so re-built parts keep their exact names (no '.001' suffixes)."""
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for b in list(bpy.data.meshes):
        if b.users == 0: bpy.data.meshes.remove(b)

def export_all(out_dir, only=None):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene; report = {}
    for key in HEROES:
        if only and key not in only: continue
        for lod in HERO_LODS.get(key, (0, 1)):
            purge()
            root, info = build_asset(key, lod, sc.collection)
            export_glb(root.name, os.path.join(out_dir, f'{key.replace("_", "-")}-lod{lod}.glb'))
            report[f'{key}_lod{lod}'] = info
    for k, v in report.items(): print(k, v)
    return report

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_all(sys.argv[sys.argv.index('--export') + 1], only)

# ───────────────────────────── game-compatible farm tree ─────────────────────────────
def export_game_tree(path, lod=2, height=1.39, species='arabica'):
    """public/models/farm/coffee-tree-gedeo.glb (arabica) / coffee-tree-<species>.glb for realm/plots.js instancing: root
    nodes 'tree' (bark + leaves), 'fruit_green', 'fruit_ripe'. All species share the arabica scale factor (arabica scaled
    to the old coffee-tree.glb height), so robusta / liberica keep their true size relative to arabica."""
    purge()
    ref = coffee_arabica(seed=11, lod=2, stage='mature')[1]['height']; purge()
    for b in list(bpy.data.meshes):
        if b.users == 0: bpy.data.meshes.remove(b)
    seed = {'arabica': 11, 'robusta': 13, 'liberica': 17}[species]
    objs, info = coffee_arabica(seed=seed, lod=lod, stage='mature', species=species)
    sc = bpy.context.scene; k = height / ref
    tree = bpy.data.objects.new('tree', None); sc.collection.objects.link(tree)
    names = {'coffee_cherries_green': 'fruit_green', 'coffee_cherries_ripe': 'fruit_ripe'}
    keep = []
    for o in objs:
        if o.name.startswith('coffee_flowers'): bpy.data.objects.remove(o, do_unlink=True); continue
        sc.collection.objects.link(o)
        o.scale = (k, k, k)
        if o.name in names: o.name = names[o.name]
        else: o.parent = tree
        keep.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in [tree] + keep: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_image_format='WEBP', export_vertex_color='ACTIVE', export_extras=False, export_animations=False)
    print('exported', path, os.path.getsize(path) // 1024, 'KB', info)

if __name__ == '__main__' and '--game-tree' in sys.argv and not globals().get('_GEDEO_LIB'):
    _sp = sys.argv[sys.argv.index('--species') + 1] if '--species' in sys.argv else 'arabica'
    export_game_tree(sys.argv[sys.argv.index('--game-tree') + 1], lod=3 if _sp == 'robusta' else 2, species=_sp)

def export_game_stages(path):
    """public/models/farm/coffee-stages-gedeo.glb: root nodes 'seedling' (nursery plant, LOD0) and 'young' (first-year
    plant, LOD1), real metres — realm/plots.js shows them during a tree's first crop before the mature model."""
    purge(); sc = bpy.context.scene; keep = []
    for node, kw in (('seedling', dict(seed=5, lod=0, stage='seedling')), ('young', dict(seed=7, lod=1, stage='young'))):
        root = bpy.data.objects.new(node, None); sc.collection.objects.link(root); keep.append(root)
        objs, info = coffee_arabica(**kw)
        for o in objs:
            sc.collection.objects.link(o); o.parent = root; o.name = f'{node}_{o.name}'; keep.append(o)
        print(node, info)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep: o.select_set(True)
    shrink_textures(keep)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_image_format='WEBP', export_vertex_color='ACTIVE', export_extras=False, export_animations=False)
    print('exported', path, os.path.getsize(path) // 1024, 'KB')

if __name__ == '__main__' and '--game-stages' in sys.argv and not globals().get('_GEDEO_LIB'):
    export_game_stages(sys.argv[sys.argv.index('--game-stages') + 1])
