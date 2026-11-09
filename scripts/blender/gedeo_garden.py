"""Gedeo garden set — nursery and intercrop / shade plants of a highland coffee farm (Blender 5.x, bpy + numpy).

All real-world metres, origin at the base centre on the ground, one GLB per asset (public/models/gedeo/<name>.glb):

  nursery-bed    vườn ươm: 3 × 1.5 m earth bed, 40 black polybags (bầu đất) each with a coffee seedling, low bamboo frame
                 carrying a sagging black shade net (alpha-blended knitted texture) with a skirt down the back and one end
  banana         chuối (Musa): clump of a 3.5 m fruiting plant + two suckers, blotched pseudostems, wind-torn paddle leaves,
                 dry leaf skirt, arching peduncle with 7 hands of upturned fingers and a purple male bell
  avocado        bơ (Persea americana): ~6 m, short trunk, dense dark-green dome of leaf-spray cards, pear-shaped fruit on stalks
  durian         sầu riêng (Durio zibethinus): ~9 m, straight monopodial trunk, tiers of near-horizontal branches → tall narrow
                 crown, leaves glossy green above / golden-bronze below, spiky green fruit hanging under the limbs
  pepper-vine    hồ tiêu (Piper nigrum): ~1 m column of heart-shaped leaves round a pollarded living support tree (trụ sống),
                 zig-zag climbing stems, fruiting laterals with dangling green / ripening red berry spikes
  bamboo-clump   tre (Bambusa): 8 m windbreak clump of ~30 arching jointed culms, branch whorls with feathery leaf sprays,
                 young shoots (măng) and leaf litter at the foot

Textures are painted in numpy at build time (deterministic seeds) and packed into the GLB (≤1024 px after shrink_textures).
Reuses the hero / building / environment helpers (MB, tube, leaf, card, ellipsoid, lathe, pole, material, Canvas, …).

Run:  Blender -b --factory-startup -P scripts/blender/gedeo_garden.py -- --export public/models/gedeo [--only banana,durian]
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_environment.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import noise as mnoise

# ───────────────────────────── painted textures ─────────────────────────────

P_OVATE = lambda s: np.power(np.clip(np.sin(np.pi * np.power(s, .62)), 0, 1), .75) * (1 - .15 * s)
P_ELLIPTIC = lambda s: np.power(np.clip(np.sin(np.pi * np.power(s, .85)), 0, 1), .8)
P_LANCE = lambda s: np.power(np.clip(np.sin(np.pi * np.power(s, .38)), 0, 1), 1.2)

def leafcol(base, vein=(.42, .48, .22), nsec=7, gloss=.3):
    base = np.asarray(base, np.float32); vein = np.asarray(vein, np.float32)
    def f(s, t):
        at = np.abs(t)
        q = (s - .3 * at) * nsec
        sec = np.clip(1 - np.abs(q - np.round(q)) * 10, 0, 1) * (at > .07) * (at < .85) * (s > .05) * (s < .92)
        mid = np.clip(1 - at / .06, 0, 1)
        c = base * (1 - gloss * .4 + gloss * (1 - at))[..., None]
        c = c * (1 - .3 * sec[..., None]) + vein * .3 * sec[..., None]
        c = c * (1 - mid[..., None]) + vein * mid[..., None]
        return c * (1 - .3 * np.clip((at - .82) * 5, 0, 1))[..., None]
    return f

GARDEN_CELLS = {'a': (0, .5, .5, 1), 'b': (.5, .5, 1, 1), 'c': (0, 0, .5, .5), 'd': (.5, 0, 1, .5)}

def paint_spray(cv, cell, rng, kind):
    """One foliage-card cell: a twig (base at the bottom centre of the cell) carrying painted leaves of `kind`."""
    x0, y0, x1, y1 = cell_px(cell, cv.w, cv.h); cw = x1 - x0; k = cw / 1000
    bx, by = x0 + cw * .5, y1 - cw * .02
    twig = np.array((.33, .28, .20))
    def put(ax, ay, ang, L, wr, prof, base, vein, pet=.1, nsec=7, gloss=.3):
        px_, py_ = ax + math.cos(ang) * L * pet, ay + math.sin(ang) * L * pet
        cv.line(ax, ay, px_, py_, 5 * k, (.30, .34, .16), 3 * k)
        cv.blade(px_, py_, ang, L, L * wr, prof, leafcol(base, vein, nsec, gloss))
    if kind in ('avocado', 'avocado_flush'):
        for fork in range(2):
            tx = bx + rng.uniform(-.25, .25) * cw * (fork + .3); ty = y0 + cw * rng.uniform(.30, .42) + fork * cw * .12
            cv.line(bx, by, tx, ty, 9 * k, twig, 4 * k)
            lv = []
            for _ in range(rng.randint(14, 18)):
                f = 1 - rng.random() ** 1.8 * .65                                   # crowded toward the shoot tip
                ax, ay = bx + (tx - bx) * f, by + (ty - by) * f
                ang = math.atan2(ty - by, tx - bx) + rng.choice([-1, 1]) * rng.uniform(.25, 1.6) * (1.15 - .5 * f)
                lv.append((f, ax, ay, ang, cw * rng.uniform(.17, .24)))
            for f, ax, ay, ang, L in sorted(lv):
                tone = rng.uniform(.8, 1.15)
                young = kind == 'avocado_flush' and f > .7 and rng.random() < .6
                base = np.array((.20, .36, .10) if young else (.09, .22, .06)) * tone
                put(ax, ay, ang, L, .42, P_OVATE, base, (.38, .44, .20) if not young else (.52, .62, .3), pet=.14, nsec=9, gloss=.45)
    elif kind == 'durian':
        ang0 = -math.pi / 2 + rng.uniform(-.15, .15); L0 = cw * .9
        tx, ty = bx + math.cos(ang0) * L0, by + math.sin(ang0) * L0
        cv.line(bx, by, tx, ty, 8 * k, twig, 3 * k)
        n = rng.randint(13, 16)
        for i in range(n):
            f = .06 + .92 * i / n; sgn = 1 if i % 2 else -1
            ax, ay = bx + (tx - bx) * f, by + (ty - by) * f
            ang = ang0 + sgn * rng.uniform(.8, 1.25) * (1.1 - .4 * f)
            under = rng.random() < .03
            base = np.array((.30, .28, .14) if under else (.11, .26, .07)) * rng.uniform(.85, 1.12)
            put(ax, ay, ang, cw * rng.uniform(.25, .32) * (1 - .3 * f), .32, P_ELLIPTIC, base, (.40, .46, .2) if not under else (.66, .55, .3), pet=.08, nsec=10, gloss=.4)
    elif kind in ('bamboo', 'bamboo2', 'bamboo_dry'):
        dry = kind == 'bamboo_dry'
        pts = [(bx, by)]; a = -math.pi / 2 + rng.uniform(-.3, .3)
        for i in range(5):
            a += rng.uniform(-.25, .25); seg = cw * .17
            pts.append((pts[-1][0] + math.cos(a) * seg, pts[-1][1] + math.sin(a) * seg))
        for i in range(5): cv.line(*pts[i], *pts[i + 1], (6 - i) * 1.2 * k, twig * (1.2 if dry else 1))
        nodes = [1, 2, 3, 4, 5] if kind != 'bamboo2' else [2, 3, 4, 5]
        for ni in nodes:
            nx, ny = pts[ni]; na = math.atan2(pts[ni][1] - pts[ni - 1][1], pts[ni][0] - pts[ni - 1][0])
            for j in range(rng.randint(3, 6) if ni < 5 else 6):
                ang = na + rng.choice([-1, 1]) * rng.uniform(.25, 1.25)
                col = (.17, .33, .08) if rng.random() < .6 else (.24, .40, .11)
                if rng.random() < .04: col = (.50, .50, .22)
                if dry: col = rng.choice([(.62, .50, .30), (.55, .42, .25), (.70, .60, .40)])
                base = np.array(col) * rng.uniform(.85, 1.12)
                put(nx, ny, ang, cw * rng.uniform(.22, .32), .14, P_LANCE, base, base * 1.25, pet=.04, nsec=0, gloss=.2)
    elif kind == 'pinnate':   # Gliricidia sepium sprout: 3 pinnate leaves fanning from the cut stub
        for r in range(3):
            ang0 = -math.pi / 2 + (r - 1) * .55 + rng.uniform(-.1, .1); L0 = cw * rng.uniform(.75, .9)
            tx, ty = bx + math.cos(ang0) * L0, by + math.sin(ang0) * L0
            cv.line(bx, by, tx, ty, 5 * k, (.32, .36, .18), 2 * k)
            for i in range(7):
                f = .2 + .8 * i / 6; ax, ay = bx + (tx - bx) * f, by + (ty - by) * f
                for sgn in ((-1, 1) if i < 6 else (0,)):
                    base = np.array((.22, .42, .12)) * rng.uniform(.85, 1.15)
                    put(ax, ay, ang0 + sgn * 1.0, cw * .12, .4, P_ELLIPTIC, base, (.45, .55, .25), pet=.05, nsec=5)

def tex_spray_atlas(kinds, seed):
    rng = random.Random(seed); cv = Canvas(2048, 2048)
    for key, kind in kinds.items(): paint_spray(cv, GARDEN_CELLS[key], rng, kind)
    return cv.down2().a

def tex_pepper_atlas(seed):
    """Heart-shaped (cordate, acuminate) Piper leaves with 5 curved main veins: a/d mature, b young; c = Gliricidia sprout."""
    rng = random.Random(seed); nrng = np.random.default_rng(seed); cv = Canvas(2048, 2048)
    looks = {'a': ((.08, .22, .05), (.32, .42, .16)), 'd': ((.12, .27, .06), (.36, .46, .18)), 'b': ((.30, .50, .14), (.52, .64, .26))}
    for key, (col, vein) in looks.items():
        x0, y0, x1, y1 = cell_px(GARDEN_CELLS[key], cv.w, cv.h); cw = x1 - x0
        jx, jy = x0 + cw * .5, y1 - cw * .14; L = cw * .83
        noise = fbm(int(y1 - y0), int(x1 - x0), 24, 24, 3, nrng)
        def fn(X, Y, jx=jx, jy=jy, L=L, col=col, vein=vein, noise=noise, x0=x0, y0=y0):
            u = (X - jx) / L; v = (jy - Y) / L
            tv = np.clip((v + .16) / 1.16, 0, 1)
            w = .37 * np.power(np.clip(np.sin(np.pi * np.power(tv, .8)), 0, 1), .85) + 1e-4
            m = (w - np.abs(u)) * L * (v > -.16) * (v < 1)
            m = np.where(v < 0, np.minimum(m, (np.abs(u) - .8 * (-v)) * L), m)          # basal sinus between the lobes
            rel = u / w
            c = np.asarray(col, np.float32) * (.85 + .3 * (1 - np.abs(rel)))[..., None]
            nz = noise[(Y - y0).astype(int).clip(0, noise.shape[0] - 1), (X - x0).astype(int).clip(0, noise.shape[1] - 1)]
            c = c * (.9 + .2 * nz)[..., None]
            vv = np.zeros_like(u)
            for kk in (-.62, -.3, 0, .3, .62):
                uk = kk * w * np.clip(v / .2, 0, 1) ** .5
                vv = np.maximum(vv, np.clip(1 - np.abs(u - uk) * L / (2.4 + 2 * (kk == 0)), 0, 1) * (v > 0) * (v < .95 - .3 * abs(kk)))
            c = c * (1 - .7 * vv[..., None]) + np.asarray(vein, np.float32) * .7 * vv[..., None]
            c *= (1 - .3 * np.clip((np.abs(rel) - .85) * 6, 0, 1))[..., None]
            return m, c
        cv.paint(x0, y0, x1, y1, fn)
    paint_spray(cv, GARDEN_CELLS['c'], rng, 'pinnate')
    return cv.down2().a

SPIKE_CELLS = [(i / 4, 0, (i + 1) / 4, 1) for i in range(4)]   # green, green-yellow, ripe red, ripening mix
def tex_pepper_spike(seed=93):
    """Hanging pepper spikes (gié tiêu): a stalk at the top, then ~25 packed round berries, shaded + glossy dot."""
    rng = random.Random(seed); W, H = 1024, 532; cv = Canvas(W * 2, H * 2)   # cell aspect ≈ card aspect (0.48)
    looks = [((.30, .58, .08), None), ((.52, .70, .12), None), ((.78, .08, .04), None), ((.36, .60, .10), (.85, .12, .05))]
    for ci, (col, col2) in enumerate(looks):
        x0, y0, x1, y1 = cell_px(SPIKE_CELLS[ci], cv.w, cv.h); cw = x1 - x0; ch = y1 - y0; cx = x0 + cw / 2
        cv.line(cx, y0, cx + cw * .02, y0 + ch * .12, cw * .06, (.32, .40, .14))
        def berry(bx, by, R, c):
            c = np.asarray(c, np.float32); hx, hy = bx - R * .35, by - R * .4
            def fn(X, Y):
                d = np.hypot(X - bx, Y - by) / R; hl = np.clip(1 - np.hypot(X - hx, Y - hy) / (R * .35), 0, 1) ** 1.5
                col = c * (1.05 - .6 * d[..., None] ** 2) * (1 - .25 * np.clip((Y - by) / R, 0, 1))[..., None]
                return (1 - d) * R * .9, col + (1 - col) * .55 * hl[..., None]
            cv.paint(bx - R - 2, by - R - 2, bx + R + 2, by + R + 2, fn)
        n = 10; R = cw * .17
        for i in range(n):
            t = i / (n - 1); yy = y0 + ch * (.17 + .74 * t); taper = 1 - .3 * t ** 2
            k = 3 if i % 2 else 2
            for j in range(k):
                xx = cx + (j - (k - 1) / 2) * R * 1.3 * taper + rng.uniform(-1, 1) * R * .12
                c = col if col2 is None or rng.random() > t * .9 else col2
                berry(xx, yy + rng.uniform(-1, 1) * R * .15, R * taper * rng.uniform(.9, 1.08), np.array(c) * rng.uniform(.82, 1.12))
    return cv.down2().a

BANANA_CELLS = [(i / 4, 0, (i + 1) / 4, 1) for i in range(4)]
def tex_banana_leaf(seed):
    """4 cells: young clean, mature lightly torn, old shredded into strips, dry brown. Laterals near-perpendicular to the midrib;
    wind tears follow them from the margin toward the rib."""
    rng = np.random.default_rng(seed); W, H = 1024, 2048; img = np.ones((H, W, 4), np.float32)
    looks = [((.36, .60, .17), (.74, .80, .44), 0), ((.22, .46, .11), (.62, .70, .38), 1),
             ((.24, .44, .11), (.60, .66, .36), 2), ((.50, .40, .20), (.56, .46, .28), 3)]
    for ci, (col, rib, torn) in enumerate(looks):
        (x0, y0, x1, y1), s, t = cell_grid(H, W, BANANA_CELLS[ci]); h, w = y1 - y0, x1 - x0
        n = fbm(h, w, 12, 3, 4, rng); at = np.abs(t)
        c = srgb(col) * (.85 + .25 * n[..., None])
        q = s * 110 - at * 5
        vein = np.clip(1 - np.abs(q - np.round(q)) * 5, 0, 1) * (at > .04)
        c *= (1 - .09 * vein[..., None])
        c *= (1 + .2 * np.clip(1 - at * 1.6, 0, 1))[..., None]
        mid = np.clip(1 - at / .045, 0, 1); c = c * (1 - mid[..., None]) + srgb(rib) * mid[..., None]
        edge = np.clip((at - .93) * 14, 0, 1); c = c * (1 - .5 * edge[..., None]) + srgb((.50, .40, .18)) * .5 * edge[..., None]
        a = np.ones((h, w), np.float32)
        if torn:
            for _ in range({1: 9, 2: 26, 3: 30}[torn]):
                s0 = rng.uniform(.06, .97); depth = rng.uniform(.3, .85) if torn == 1 else rng.uniform(.55, 1)
                side = rng.choice([-1, 1]); d = np.abs(q - s0 * 110)
                tear = (d < rng.uniform(.3, .7)) * (at > max(.07, 1 - depth)) * (np.sign(t) == side)
                a *= 1 - tear
            fray = fbm(h, w, 40, 6, 2, rng); a *= (at < .97 - .1 * fray)
            if torn >= 2:   # browning along the old margins
                dry = np.clip((at - .55) * 2.5 + (fbm(h, w, 16, 4, 3, rng) - .5), 0, 1)[..., None] * (.35 if torn == 2 else 1)
                c = c * (1 - dry) + srgb((.50, .38, .18)) * (.8 + .4 * n[..., None]) * dry
            if torn == 3:
                a *= (fbm(h, w, 30, 4, 3, rng) > .3)
        img[y0:y1, x0:x1, :3] = np.clip(c, 0, 1); img[y0:y1, x0:x1, 3] = a
    return img

def tex_banana_stem(seed):
    """Pseudostem: overlapping sheaths, green with dark-brown blotches, drying brown at the foot."""
    rng = np.random.default_rng(seed); h = w = 512
    n = fbm(h, w, 2, 24, 4, rng); blot = fbm(h, w, 8, 14, 4, rng)
    v = np.linspace(1, 0, h)[:, None, None]
    base = srgb((.44, .56, .22)) * (.8 + .3 * n[..., None])
    m = np.clip((blot[..., None] - .58) * 5, 0, 1) * .85
    base = base * (1 - m) + srgb((.18, .12, .08)) * m
    low = np.clip((.22 - v) * 5, 0, 1) * .55
    base = base * (1 - low) + srgb((.40, .30, .18)) * low
    seams = vnoise(h, w, 1, 7, rng); base *= (1 - .35 * np.clip((seams[..., None] - .8) * 10, 0, 1))
    a = np.ones((h, w, 4), np.float32); a[..., :3] = np.clip(base, 0, 1); return a

def tex_bamboo_culm(seed=121, dry=False):
    """One internode per tile along v (node ring at v = 0/1, white waxy band just below it), fine longitudinal streaks.
    dry: cut, sun-dried pole (straw / grey-tan) for frames."""
    rng = np.random.default_rng(seed); h, w = 512, 256
    v = np.linspace(1, 0, h)[:, None]
    streak = fbm(h, w, 2, 40, 3, rng); n = fbm(h, w, 3, 6, 4, rng); blot = fbm(h, w, 6, 6, 3, rng)
    c = srgb((.66, .58, .38) if dry else (.46, .58, .26)) * (.82 + .25 * streak[..., None]) * (.9 + .2 * n[..., None])
    c = mix3(c, srgb((.55, .55, .45)), np.clip((blot - .68) * 4, 0, .6))                     # grey lichen patches
    wax = np.exp(-((v - .93) / .03) ** 2); c = mix3(c, srgb((.80, .82, .72)), wax * (.15 if dry else .55))
    node = np.exp(-((v - .985) / .008) ** 2) + np.exp(-((v - .0) / .006) ** 2)
    ridge = np.exp(-((v - .018) / .008) ** 2)
    c = mix3(c, srgb((.30, .24, .14) if dry else (.22, .24, .10)), np.clip(node, 0, 1) * .8)
    c = mix3(c, srgb((.66, .64, .36)), ridge * .7)
    a = np.ones((h, w, 4), np.float32); a[..., :3] = np.clip(c, 0, 1); return a

def tex_shade_net(seed=131):
    """Knitted HDPE shade cloth: diamond lattice of flat tapes + chain stitches; alpha ≈ 70 % shade."""
    h = w = 256; Y, X = np.mgrid[0:h, 0:w].astype(np.float32) / h; k = 16
    a_ = (X + Y) * k; b_ = (X - Y) * k
    da = np.abs(a_ - np.round(a_)); db = np.abs(b_ - np.round(b_))
    tape = np.clip((.2 - np.minimum(da, db)) * 12, 0, 1)
    dc = np.abs(X * k - np.round(X * k)); chain = np.clip((.14 - dc) * 14, 0, 1)
    m = np.maximum(tape, chain * .85)
    out = np.ones((h, w, 4), np.float32)
    out[..., :3] = (np.array((.045, .05, .05)) + np.array((.06, .065, .06)) * m[..., None])
    out[..., 3] = .42 + .55 * m
    return out

# ───────────────────────────── shared helpers ─────────────────────────────

def blend_material(name, img, rough):
    """Semi-transparent (glTF alphaMode BLEND): texture alpha straight into the BSDF, no ROUND."""
    m = material(name, img, rough, two_sided=True, spec=.3)
    nt = m.node_tree; tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE'); bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m

def garden_group(name, parts, M, normals=None):
    """Like group(), but foliage parts can get volumetric normals: normals = {key: (centre, radii, up)}."""
    sc = bpy.context.scene; root = bpy.data.objects.new(name, None); sc.collection.objects.link(root); tris = 0
    for k, mb in parts.items():
        if not mb.f: continue
        kw = {}
        if normals and k in normals: c, r, u = normals[k]; kw = dict(normal_center=c, normal_radii=r, normal_up=u)
        ob = mb.build(f'{name}_{k}', M[k], **kw); sc.collection.objects.link(ob); ob.parent = root; tris += mb.tris
        if getattr(mb, 'nlist', None) and len(mb.nlist) == len(ob.data.vertices): ob.data.normals_split_custom_set_from_vertices(mb.nlist)
    root['tris'] = tris
    return root

def fruit_mat(): return material('garden_fruit', None, .42, spec=.6)

def surface_frame(n):
    n = n.normalized(); s1 = n.orthogonal().normalized(); return s1, n.cross(s1)

def spike(mb, base, n, r, h, col, tip_col):
    """4-sided pyramid standing on a surface point (durian thorn)."""
    s1, s2 = surface_frame(n); ids = []
    for j in range(4):
        a = TAU * j / 4; ids.append(mb.add(base - n * .004 + (s1 * math.cos(a) + s2 * math.sin(a)) * r, (0, 0), col))
    apex = mb.add(base + n * h, (0, 1), tip_col)
    for j in range(4): mb.face((ids[j], ids[(j + 1) % 4], apex))

def spiky_fruit(mb, c, a, b, rng, col, tip_col, seg=9, rings=7):
    ellipsoid(mb, c, UP, a, b, col, seg, rings, tip_col=tip_col)
    for i in range(1, rings):
        th = math.pi * i / rings
        for j in range(seg):
            ph = TAU * (j + .5 * (i % 2)) / seg + rng.uniform(-.05, .05)
            p = c + Vector((b * math.sin(th) * math.cos(ph), b * math.sin(th) * math.sin(ph), a * math.cos(th)))
            n = Vector((math.sin(th) * math.cos(ph) / b, math.sin(th) * math.sin(ph) / b, math.cos(th) / a)).normalized()
            spike(mb, p, n, .021, rng.uniform(.03, .04), col, tip_col)

def paddle_leaf(rng, rib, blade, start, phi, tilt0, bend, Lb, Wb, pet, cell, age, segL=14, rib_r=.045, rib_col=(.6, .66, .36, 1)):
    """Banana-type leaf: petiole + midrib tube arching out from `start`, 7-wide blade strip (V-cup young, Λ-droop old)."""
    h = Vector((math.cos(phi), math.sin(phi), 0)); side = Vector((-h.y, h.x, 0))
    total = pet + Lb; N = segL + 3; pts = [start.copy()]
    for i in range(1, N):
        s = i / (N - 1); a = tilt0 + bend * s ** 1.6
        nxt = pts[-1] + (h * math.sin(a) + UP * math.cos(a)) * (total / (N - 1))
        nxt.z = max(nxt.z, .06 + .02 * i)
        pts.append(nxt)
    tube(rib, pts, [rib_r * (1 - .85 * (i / (N - 1)) ** .6) + .003 for i in range(N)], 5, col=rib_col)
    sb0 = pet / total; rows = []; twist = rng.uniform(-.25, .25)
    for i in range(N):
        s = i / (N - 1)
        if s < sb0 - 1e-6: continue
        sb = (s - sb0) / (1 - sb0)
        w = Wb * .5 * min(1, (sb / .06)) ** .45 * min(1, ((1 - sb) / .14)) ** .3 + .008
        T = (pts[min(i + 1, N - 1)] - pts[max(i - 1, 0)]).normalized()
        sd = (side * math.cos(twist * sb) + T.cross(side).normalized() * math.sin(twist * sb)).normalized()
        nrm = sd.cross(T).normalized()
        if nrm.z < 0: nrm = -nrm
        row = []
        for t in (-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1):
            lift = (.16 * (1 - age) - .28 * age) * abs(t) ** 1.4 * w
            ripple = .025 * w * math.sin(sb * 23 + t * 3) * abs(t)
            p = pts[i] + sd * (t * w) + nrm * (lift + ripple + .01)
            u0, v0, u1, v1 = cell
            row.append(blade.add(p, (u0 + (t + 1) * .5 * (u1 - u0), v0 + sb * (v1 - v0)), tint(rng, (1, 1, 1), .04)))
        rows.append(row)
    for i in range(len(rows) - 1):
        for j in range(6): blade.face((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    return pts

# ───────────────────────────── 1. nursery bed ─────────────────────────────

def coffee_seedling(rng, stem, lf, base, H):
    n = 5; lean = Vector((rng.gauss(0, .015), rng.gauss(0, .015), 0))
    pts = [base + Vector((0, 0, H * i / n)) + lean * (i / n) ** 1.5 * H * 3 for i in range(n + 1)]
    tube(stem, pts, [.0045 * (1 - .6 * i / n) for i in range(n + 1)], 4, col=lin((.36, .46, .22)), cap=True)
    elliptic = lambda s: (math.sin(math.pi * min(1, s ** .9)) ** .7) * (1 - .2 * s ** 3) + (.04 if s < .02 else 0)
    phi = rng.random() * TAU; z = .05
    while z < H - .015:
        phi += math.pi / 2 + rng.uniform(-.2, .2); hf = z / H
        p = pts[0].lerp(pts[-1], hf)
        for sgn in (-1, 1):
            d = (Vector((math.cos(phi) * sgn, math.sin(phi) * sgn, 0)) + UP * (.25 + .7 * hf)).normalized()
            ll = (.065 + .065 * math.sin(math.pi * min(1, hf * 1.1 + .1))) * rng.uniform(.85, 1.1)
            leaf(lf, p, d, (UP + rnd_unit(rng) * .2).normalized(), ll, ll * .44, COFFEE_CELLS[1 if hf > .75 else 0],
                 tint(rng, (1, 1, 1), .08), elliptic, segs=2, droop=.3, fold=.25, rng=rng)
        z += rng.uniform(.04, .052)

def nursery_bed(seed=111):
    rng = random.Random(seed); M = env_mats()
    sc_, sn_ = tex_pair('soil', tex_soil_tile)
    M['soil'] = material('garden_soil', sc_, .95, normal=sn_, spec=.2)
    M['bag'] = material('polybag', None, .55, spec=.35)
    M['coffee'] = material('coffee_leaf', to_image('T_coffee_leaf', lambda: tex_coffee_leaf(11)), .38, two_sided=True, spec=.6)
    M['bamboo'] = material('bamboo_dry', to_image('T_bamboo_dry', lambda: tex_bamboo_culm(122, dry=True)), .6, spec=.35)
    M['net'] = blend_material('shade_net', to_image('T_shade_net', tex_shade_net), .8)
    P = {k: MB() for k in ('soil', 'bag', 'plain', 'coffee', 'bamboo', 'net')}
    # raised earth bed with rounded shoulders
    BX, BY, nx, ny = 1.42, .66, 30, 14; grid = []
    def bed_h(x, y):
        e = min(BX - abs(x), BY - abs(y)); return .07 * min(1, max(0, e) / .14) ** .7 - .02 + .008 * mnoise.noise(Vector((x * 4, y * 4, 1)))
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            x = -BX - .08 + (2 * BX + .16) * i / nx; y = -BY - .08 + (2 * BY + .16) * j / ny
            row.append(P['soil'].add((x, y, bed_h(x, y)), (x / 1.5, y / 1.5), (1, 1, 1, 1)))
        grid.append(row)
    for i in range(nx):
        for j in range(ny): P['soil'].face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    # 10 × 4 polybags, each with a seedling
    lf = P['coffee']
    for i in range(10):
        for j in range(4):
            x = -1.215 + i * .27 + rng.gauss(0, .012); y = -.45 + j * .3 + rng.gauss(0, .012)
            z = bed_h(x, y) - .015; s = rng.uniform(.93, 1.07); ph = rng.random() * TAU
            prof = [(.06 * s, z), (.072 * s, z + .03), (.076 * s, z + .09), (.071 * s, z + .15), (.065 * s, z + .175), (.069 * s, z + .19), (.062 * s, z + .182)]
            lathe(P['bag'], prof, 11, col=tint(rng, (.012, .012, .012, 1), .2), center=(x, y, 0), a0=ph, a1=ph + TAU,
                  wobble=lambda a, zz, ph=ph, z=z: (.06 * math.sin(a * 7 + ph + zz * 50) + .03 * math.sin(a * 13 - zz * 90)) * min(1, (zz - z) / .04) + .03 * math.sin(a * 2 + ph))
            lathe(P['plain'], [(.064 * s, z + .182), (.03 * s, z + .19), (.001, z + .192)], 9, col=tint(rng, lin((.30, .19, .12)), .12), center=(x, y, 0))
            if rng.random() < .3:   # a few grains of mulch / spilled soil on the bag top
                ellipsoid(P['plain'], Vector((x + rng.uniform(-.03, .03), y + rng.uniform(-.03, .03), z + .19)), UP, .008, .008, lin((.36, .25, .15)), 4, 2)
            coffee_seedling(rng, P['plain'], lf, Vector((x, y, z + .188)), rng.uniform(.24, .34) * (.75 if rng.random() < .1 else 1))
    # bamboo frame: 6 posts, rails along both long sides, 3 cross rails; front lower than back so rain runs off
    hF, hB, X, Y = 1.12, 1.30, 1.45, .74
    pc = (1, 1, 1, 1)
    hz = lambda y: hF + (hB - hF) * (y + Y) / (2 * Y)
    for x in (-X, 0, X):
        for y in (-Y, Y): pole(P['bamboo'], rng, (x, y, -.05), (x + rng.gauss(0, .01), y, hz(y) + .04), .028, 6, col=pc, wob=.008, segs=3)
        pole(P['bamboo'], rng, (x, -Y - .04, hF - .02), (x, Y + .04, hB - .02), .022, 6, col=pc, wob=.006, segs=3)
    for y in (-Y, Y): pole(P['bamboo'], rng, (-X - .12, y, hz(y) + .01), (X + .12, y, hz(y) + .01), .022, 6, col=pc, wob=.006, segs=4)
    # shade net resting on the rails, sagging between them, hanging a little past the edges
    NX, NY = 28, 12; grid = []
    for i in range(NX + 1):
        row = []
        for j in range(NY + 1):
            x = -X - .14 + (2 * X + .28) * i / NX; y = -Y - .1 + (2 * Y + .2) * j / NY
            fx = (x + X) / X % 1 if -X <= x <= X else 0; fy = (y + Y) / (2 * Y) if -Y <= y <= Y else 0
            sag = .05 * math.sin(math.pi * fx) * (.4 + .6 * math.sin(math.pi * fy)) + .02 * math.sin(math.pi * fy)
            over = max(0, abs(x) - X) * .5 + max(0, abs(y) - Y) * .6
            row.append(P['net'].add((x, y, hz(max(-Y, min(Y, y))) + .035 - sag - over), (x / .3, y / .3), (1, 1, 1, 1)))
        grid.append(row)
    for i in range(NX):
        for j in range(NY): P['net'].face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    # skirts: down the back (afternoon-sun side) and the east end, tied short of the ground
    for (a, b, zb) in (((-X - .14, Y + .1), (X + .14, Y + .1), .32), ((X + .14, -Y - .1), (X + .14, Y + .1), .42)):
        n = 16; rows = []
        for i in range(n + 1):
            t = i / n; px_ = a[0] + (b[0] - a[0]) * t; py_ = a[1] + (b[1] - a[1]) * t
            ztop = hz(max(-Y, min(Y, py_))) + .035 - .06
            bulge = .03 * math.sin(t * math.pi * 5)
            rows.append([P['net'].add((px_ + bulge * (b[1] != a[1]), py_ + bulge * (b[0] != a[0]), zt), (t * 9, zt / .3), (1, 1, 1, 1)) for zt in (ztop, zb + .08 * math.sin(t * 7))])
        for i in range(n): P['net'].face((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
    return garden_group('nursery_bed', P, M)

# ───────────────────────────── 2. banana ─────────────────────────────

def musa_plant(rng, P, base, Hs, k, bunch):
    prof = lambda z: (.12 * k + .02) * (1 - .38 * z / Hs) * (1 + .16 * max(0, 1 - z / (.2 * Hs)))
    n = 10; sp = [base + Vector((rng.gauss(0, .006) * (i > 0), rng.gauss(0, .006) * (i > 0), Hs * i / n)) for i in range(n + 1)]
    tube(P['stem'], sp, [prof(p.z) for p in sp], 14 if k > .5 else 9, v_scale=1 / Hs, u_rep=2)
    for j in range(2 if k > .5 else 1):   # loose outer sheaths with diagonal tops
        a0 = rng.random() * TAU; span = rng.uniform(.5, .8) * TAU; ztop = Hs * rng.uniform(.5, .9); seg = 8; rows = 5; grid = []
        for i in range(rows + 1):
            row = []
            for jj in range(seg + 1):
                a = a0 + span * jj / seg; z = (ztop - .35 * k * (jj / seg)) * i / rows; r = prof(z) + .01 + .008 * j
                row.append(P['stem'].add(base + Vector((math.cos(a) * r, math.sin(a) * r, z)), (jj / seg * .5, z / Hs)))
            grid.append(row)
        for i in range(rows):
            for jj in range(seg): P['stem'].face((grid[i][jj], grid[i][jj + 1], grid[i + 1][jj + 1], grid[i + 1][jj]))
    top = base + Vector((0, 0, Hs)); nleaf = 9 if k > .9 else (6 if k > .5 else 4); phi = rng.random() * TAU
    sword = k < .4
    for i in range(nleaf):
        age = i / max(1, nleaf - 1); phi += math.radians(137.5 + rng.uniform(-15, 15))
        tilt0 = math.radians((2 if sword else 6) + (12 if sword else 26) * age + rng.uniform(-3, 3))
        bend = math.radians((8 if sword else 16) + (30 if sword else 72) * age ** 1.4 + rng.uniform(-8, 8))
        Lb = rng.uniform(1.55, 2.0) * k ** .8 * (.72 + .28 * min(1, age * 3)); Wb = Lb * (rng.uniform(.13, .16) if sword else rng.uniform(.28, .33))
        pet = .38 * k ** .7
        cell = BANANA_CELLS[0 if age < .2 else (1 if age < .55 or rng.random() < .4 else 2)]
        if sword: cell = BANANA_CELLS[0]
        start = top + Vector((math.cos(phi), math.sin(phi), 0)) * .03 - UP * (.08 + .25 * age) * k
        paddle_leaf(rng, P['rib'], P['leaf'], start, phi, tilt0, bend, Lb, Wb, pet, cell, age, segL=13 if k > .5 else 9,
                    rib_r=.035 * k + .01, rib_col=tint(rng, lin((.66, .72, .42)), .08))
    # dry leaves collapsed against the pseudostem (broken petioles)
    for j in range(3 if k > .5 else 1):
        a = rng.random() * TAU; h = Vector((math.cos(a), math.sin(a), 0)); side = Vector((-h.y, h.x, 0))
        z0 = Hs * rng.uniform(.75, .95); L = rng.uniform(.9, 1.4) * k; w = rng.uniform(.16, .26) * k; rows = []
        for i in range(7):
            s = i / 6; z = z0 + .12 * math.sin(s * math.pi * .5) * (1 - s) - L * s * s * .95
            r = prof(max(0, z)) + .04 + .22 * k * math.sin(math.pi * min(1, s * 1.6)) * (1 - s)
            c = base + h * r + Vector((0, 0, max(.04, z)))
            u0, _, u1, _ = BANANA_CELLS[3]
            rows.append([P['leaf'].add(c + side * (t * w * (1 - .4 * s)) + h * (.05 * abs(t)), (u0 + (t + 1) * .5 * (u1 - u0), s), tint(rng, (1, 1, 1), .1)) for t in (-1, 0, 1)])
        for i in range(6):
            for jj in range(2): P['leaf'].face((rows[i][jj], rows[i][jj + 1], rows[i + 1][jj + 1], rows[i + 1][jj]))
    if sword:   # rolled cigar leaf
        cp = [top - UP * .1 + UP * (.35 * i / 4) for i in range(5)]
        tube(P['rib'], cp, [.02 * (1 - .8 * i / 4) + .004 for i in range(5)], 5, col=lin((.5, .66, .3)), cap=True)
    if bunch: musa_bunch(rng, P, top, phi + 2.0)

def musa_bunch(rng, P, top, az):
    h = Vector((math.cos(az), math.sin(az), 0))
    ped = [top - UP * .1, top + h * .08 + UP * .14, top + h * .26 + UP * .2, top + h * .42 + UP * .08, top + h * .5 - UP * .2, top + h * .52 - UP * .45]
    hang = ped[-1]; rach = [hang - UP * t + h * .03 * t for t in np.linspace(.12, 1.3, 7)]
    allp = ped + rach; tube(P['rib'], allp, [.042 - .02 * i / (len(allp) - 1) for i in range(len(allp))], 7, col=lin((.42, .48, .24)))
    for j in range(7):   # hands: two rows of fingers wrapped half-way round the stalk, curving upward
        t = .04 + j * .105; c = hang - UP * t + h * .03 * t; size = 1 - .045 * j; face = j * 2.4 + rng.uniform(-.2, .2)
        for row, (n, rr, zoff) in enumerate(((8, .05, 0), (7, .04, -.04))):
            for i in range(n):
                a = face + (i / (n - 1) - .5) * 3.4 + row * .2; rad = Vector((math.cos(a), math.sin(a), 0))
                p0 = c + rad * rr + UP * zoff
                L = .17 * size * rng.uniform(.92, 1.06)
                pts = [p0, p0 + rad * .26 * L - UP * .05 * L, p0 + rad * .5 * L + UP * .15 * L, p0 + rad * .6 * L + UP * .5 * L, p0 + rad * .6 * L + UP * .82 * L]
                col = tint(rng, lin((.36, .52, .16)), .08)
                tube(P['fruit'], pts, [x * size for x in (.009, .016, .019, .017, .009)], 6, col=col, cap=True)
                ellipsoid(P['fruit'], pts[-1] + UP * .004, UP, .007, .0055, lin((.22, .16, .08)), 4, 2)
    e = rach[-1]   # male bell: purple-maroon bracts, two lifting to show a row of cream flowers
    lathe(P['fruit'], [(.004, -.29), (.028, -.25), (.052, -.18), (.066, -.1), (.062, -.045), (.04, -.008), (.016, .005)], 12,
          col=lin((.42, .10, .20)), center=tuple(e), wobble=lambda a, z: .07 * ((-z * 13 + a / TAU * 2) % 1) - .035)
    for sgn in (-1, 1):
        a = az + sgn * 1.2; rad = Vector((math.cos(a), math.sin(a), 0))
        leaf(P['fruit'], e - UP * .03 + rad * .04, (rad * .7 + UP * .7).normalized(), (rad - UP * .2).normalized(), .13, .075, (0, 0, 1, 1),
             lin((.50, .12, .22)), lambda s: math.sin(math.pi * min(1, s * .9 + .1)) ** .6, segs=2, droop=-.25, fold=-.3, rng=rng)
        for f in range(4):
            ellipsoid(P['fruit'], e - UP * .045 + rad * .035 + (rad.cross(UP)) * (f - 1.5) * .012, (rad + UP).normalized(), .016, .005, lin((.92, .84, .58)), 4, 2)

def banana(seed=61):
    rng = random.Random(seed); M = env_mats()
    M['stem'] = material('banana_pseudostem', to_image('T_banana_stem', lambda: tex_banana_stem(seed)), .5)
    M['leaf'] = material('banana_leaf', to_image('T_banana_leaf', lambda: tex_banana_leaf(seed)), .62, alpha=True, two_sided=True, spec=.35)
    M['rib'] = material('banana_midrib', None, .45); M['fruit'] = fruit_mat()
    P = {k: MB() for k in ('stem', 'rib', 'leaf', 'fruit')}
    for base, Hs, k, bunch in ((Vector((0, 0, 0)), 2.25, 1.0, True), (Vector((.42, .3, 0)), 1.25, .64, False), (Vector((-.36, .34, 0)), .5, .3, False)):
        musa_plant(rng, P, base, Hs, k, bunch)
    return garden_group('banana', P, M, normals={'leaf': ((0, 0, 2.6), (2, 2, 1.2), .5)})

# ───────────────────────────── 3. avocado ─────────────────────────────

def dome_tree(rng, bark, C, R, trunk_h, trunk_r, limb_L, limb_r, nlimb, el, max_depth, sides0):
    """Cordia-style sympodial tree staying inside the crown ellipsoid (C, R). Returns (terminals, inner) branch lists."""
    terminals, inner = [], []
    def trop(p, d):
        q = Vector(((p.x - C.x) / R.x, (p.y - C.y) / R.y, (p.z - C.z) / R.z))
        out = Vector((p.x, p.y, 0)); out = out.normalized() if out.length > 1e-3 else Vector()
        if q.length > .85: return -Vector((q.x, q.y, q.z * .6)).normalized() * .35 + UP * .02
        return out * .05 + UP * .04
    lean = rnd_unit(rng); lean.z = 0; lean = lean.normalized() * .1
    tp, tr = grow(rng, Vector((0, 0, 0)), (UP + lean).normalized(), trunk_h, trunk_r, trunk_r * .85, 5, .06, lambda p, d: Vector())
    tr[0] *= 1.5; tr[1] *= 1.12
    tube(bark, tp, tr, sides0, v_scale=1 / (TAU * trunk_r))
    def branch(p, d, L, r, depth):
        segs = max(3, int(L * 1.8)); sides = max(3, sides0 - 3 * (depth + 1))
        bp, br = grow(rng, p, d, L, r, r * .62, segs, .09 + .03 * depth, trop)
        tube(bark, bp, br, sides, v_scale=1 / (TAU * max(r, .05)), cap=depth >= 2)
        if depth >= 1: inner.append((bp, br))
        if depth >= max_depth or r < .018: terminals.append((bp, br)); return
        for c in range(2 if rng.random() < .5 else 3):
            f = 1.0 if c == 0 else rng.uniform(.45, .85); idx = max(1, min(len(bp) - 1, round(f * (len(bp) - 1))))
            q = bp[idx]; dd = (bp[idx] - bp[idx - 1]).normalized()
            out = Vector((q.x, q.y, 0)); out = out.normalized() * .6 if out.length > 1e-3 else Vector()
            branch(q - dd * br[idx] * .6, spread(rng, dd, math.radians(rng.uniform(25, 48)), out), L * rng.uniform(.6, .76), br[idx] * (.8 if c == 0 else .6), depth + 1)
    az0 = rng.random() * TAU
    for k in range(nlimb):
        az = az0 + k * TAU / nlimb + rng.uniform(-.4, .4); e = math.radians(rng.uniform(*el))
        branch(tp[-2].lerp(tp[-1], .6), Vector((math.sin(e) * math.cos(az), math.sin(e) * math.sin(az), math.cos(e))), limb_L * rng.uniform(.9, 1.1), limb_r, 0)
    return terminals, inner

def crown_cards(rng, fol, C, R, branches, density, size, cells, inner_k=.45, n_terminals=None):
    for idx, (bp, br) in enumerate(branches):
        is_tip = n_terminals is None or idx < n_terminals
        L = sum((bp[i + 1] - bp[i]).length for i in range(len(bp) - 1))
        for _ in range(max(2, int(L * density * (1 if is_tip else inner_k)))):
            f = rng.uniform(.2, 1.0); i0 = min(len(bp) - 2, int(f * (len(bp) - 1)))
            p = bp[i0].lerp(bp[i0 + 1], f * (len(bp) - 1) - i0)
            out = (p - C); out = Vector((out.x / R.x, out.y / R.y, out.z / R.z)).normalized()
            d = (out + UP * .3 + rnd_unit(rng) * .7).normalized()
            nrm = (out * .6 + UP * .5 + rnd_unit(rng) * .4).normalized()
            sz = rng.uniform(*size)
            card(fol, p - d * .1, d, nrm, sz, sz, cells[rng.randrange(len(cells))], tint(rng, (1, 1, 1), .12), droop=.12, curl=.15)

def avocado(seed=79):
    rng = random.Random(seed); M = env_mats()
    M['bark'] = material('avocado_bark', to_image('T_avocado_bark', lambda: tex_bark('cordia', seed)), .9)
    M['fol'] = material('avocado_foliage', to_image('T_avocado_foliage', lambda: tex_spray_atlas({'a': 'avocado', 'b': 'avocado', 'c': 'avocado', 'd': 'avocado_flush'}, seed)),
                        .72, alpha=True, two_sided=True, spec=.3)
    M['fruit'] = fruit_mat()
    P = {k: MB() for k in ('bark', 'fol', 'fruit')}
    C = Vector((0, 0, 3.7)); R = Vector((2.5, 2.4, 2.2))
    terms, inner = dome_tree(rng, P['bark'], C, R, 1.3, .17, 1.7, .11, 6, (22, 52), 3, 10)
    cells = [GARDEN_CELLS[k] for k in 'abcabcd']
    crown_cards(rng, P['fol'], C, R, terms + inner, 14.0, (.95, 1.25), cells, n_terminals=len(terms))
    for _ in range(40):   # crown top
        p = C + Vector((rng.gauss(0, .75), rng.gauss(0, .75), R.z * rng.uniform(.72, .95)))
        dd = rnd_unit(rng); dd.z = rng.uniform(-.1, .2)
        card(P['fol'], p, dd.normalized(), UP, 1.1, 1.1, cells[rng.randrange(len(cells))], tint(rng, (1, 1, 1), .12), droop=.12, curl=.15)
    for _ in range(55):   # fill cards so the dome reads as one dense crown, not separate limb clumps
        d = rnd_unit(rng); d.z = abs(d.z) * .9 + .05; d.normalize()
        p = C + Vector((d.x * R.x, d.y * R.y, d.z * R.z)) * rng.uniform(.45, .78)
        cd = (d + rnd_unit(rng) * .6).normalized()
        card(P['fol'], p, cd, (d * .6 + UP * .5).normalized(), 1.1, 1.1, cells[rng.randrange(len(cells))], tint(rng, (1, 1, 1), .12), droop=.12, curl=.15)
    # pear-shaped fruit hanging at the lower / outer skin of the crown, each on a twig from the nearest branch
    knots = [p for bp, br in inner + terms for p in bp[1:]]; hung = 0
    for _ in range(1500):
        if hung >= 16: break
        a = rng.random() * TAU; zq = rng.uniform(-.5, .25); rq = math.sqrt(1 - zq * zq) * rng.uniform(1.05, 1.15)
        top = C + Vector((math.cos(a) * rq * R.x, math.sin(a) * rq * R.y, zq * R.z))
        near = min(knots, key=lambda p: (p - top).length)
        if (near - top).length > 1.0 or near.z < top.z + .05: continue
        s = rng.uniform(1.3, 1.45); col = tint(rng, lin((.46, .58, .16)) if rng.random() < .75 else lin((.20, .24, .10)), .08)
        mid = near.lerp(top, .5) + UP * .04
        tube(P['fruit'], [near, mid, top], [.007, .005, .006], 4, col=lin((.40, .40, .22)))
        lathe(P['fruit'], [(.004, -.135 * s), (.034 * s, -.128 * s), (.048 * s, -.1 * s), (.047 * s, -.065 * s), (.035 * s, -.035 * s), (.022 * s, -.015 * s), (.008, 0)],
              10, col=col, center=tuple(top))
        hung += 1
    return garden_group('avocado', P, M, normals={'fol': (tuple(C), tuple(R), .35)})

# ───────────────────────────── 4. durian ─────────────────────────────

def durian(seed=81):
    """Tall straight trunk; broad irregular oval crown built from ~9 leaf masses, each fed by a thick main limb; spiky fruit
    hanging on short stalks from those limbs. Foliage normals point out of each mass, so the masses shade as separate lumps."""
    rng = random.Random(seed); M = env_mats()
    M['bark'] = material('durian_bark', to_image('T_durian_bark', lambda: tex_bark('albizia', seed)), .85)
    M['fol'] = material('durian_foliage', to_image('T_durian_foliage', lambda: tex_spray_atlas({'a': 'durian', 'b': 'durian', 'c': 'durian', 'd': 'durian'}, seed)),
                        .6, alpha=True, two_sided=True, spec=.4)
    M['fruit'] = fruit_mat()
    P = {k: MB() for k in ('bark', 'fol', 'fruit')}; bark_col = (.82, .6, .46, 1)
    Ht = 7.9
    tp, tr = grow(rng, Vector((0, 0, 0)), UP, Ht, .26, .07, 12, .02, lambda p, d: Vector((-p.x, -p.y, 0)) * .05)
    tr[0] *= 1.6; tr[1] *= 1.15
    tube(P['bark'], tp, tr, 10, col=bark_col, v_scale=1 / (TAU * .22), cap=True)
    trunk_at = lambda z: tp[min(len(tp) - 2, int(z / Ht * 12))].lerp(tp[min(len(tp) - 1, int(z / Ht * 12) + 1)], (z / Ht * 12) % 1)
    masses = [(Vector((rng.uniform(-.3, .3), rng.uniform(-.3, .3), 8.0)), 1.35)]
    n = 8; az0 = rng.random() * TAU
    for k in range(n):
        az = az0 + k * TAU / n + rng.uniform(-.3, .3); lowk = k % 2
        z = rng.uniform(5.3, 5.9) if lowk else rng.uniform(6.4, 7.1)
        dist = rng.uniform(1.9, 2.5) if lowk else rng.uniform(1.3, 1.8)
        masses.append((Vector((math.cos(az) * dist, math.sin(az) * dist, z)), rng.uniform(1.15, 1.45) if lowk else rng.uniform(1.1, 1.35)))
    limbs = []
    for mi, (mc, r) in enumerate(masses):
        if mi == 0:
            bp = [tp[-1], tp[-1].lerp(mc, .5), mc]; base_r = tr[-1]
        else:
            zb = max(3.7, mc.z - rng.uniform(1.0, 1.6)); p0 = trunk_at(zb)
            hdir = Vector((mc.x - p0.x, mc.y - p0.y, 0)).normalized()
            end = mc - hdir * r * .35
            p1 = p0 + hdir * (end - p0).length * .45 + UP * (end.z - p0.z) * .7
            bp = [(p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + end * t * t) + (rnd_unit(rng) * .05 if 0 < i < 6 else Vector()) for i, t in enumerate(np.linspace(0, 1, 7))]
            base_r = .1 if mc.z < 6 else .075
        br = [base_r * (1 - .6 * i / (len(bp) - 1)) for i in range(len(bp))]
        tube(P['bark'], bp, br, 6, col=bark_col, v_scale=1 / (TAU * .08))
        limbs.append((bp, br, mc))
        for _ in range(4):   # twigs fanning into the mass
            d = rnd_unit(rng); d.z = abs(d.z) * .4 + .1; d.normalize()
            sp, sr = grow(rng, bp[-1], d, r * rng.uniform(.5, .8), br[-1] * .6, .008, 3, .1, lambda p, d: Vector((0, 0, -.02)))
            tube(P['bark'], sp, sr, 3, col=bark_col, v_scale=4)
        # foliage cards filling the mass, denser toward its skin; normals out of the mass centre
        fol = P['fol']; fol.nlist = getattr(fol, 'nlist', [])
        cells = [GARDEN_CELLS[k] for k in 'abcd']
        for _ in range(int(92 * (r / 1.3) ** 2)):
            d = rnd_unit(rng); d.z *= .75
            p = mc + Vector((d.x * r, d.y * r, d.z * r * .78)) * rng.uniform(.4, 1.0) ** .45
            cd = (d + UP * .2 + rnd_unit(rng) * .55).normalized()
            nrm = (d * .7 + UP * .5 + rnd_unit(rng) * .3).normalized(); sz = rng.uniform(.85, 1.05)
            s0 = len(fol.v)
            card(fol, p - cd * sz * .4, cd, nrm, sz, sz, cells[rng.randrange(4)], tint(rng, (1, 1, 1), .1), droop=.18, curl=.14)
            for vi in range(s0, len(fol.v)):
                q = Vector(fol.v[vi]) - mc; q = Vector((q.x / r, q.y / r, q.z / (r * .78)))
                fol.nlist.append(((q.normalized() if q.length > 1e-4 else UP) + UP * .35).normalized())
    # fruit: on short stalks under the thick lower limbs, near the trunk end of each limb
    cand = limbs[1:]
    for bp, br, mc in cand:   # some dangling just below the skin of the lower leaf masses, on a stout stalk from the limb end
        if mc.z > 6.2: continue
        r = masses[[m[0] for m in masses].index(mc)][1]
        for _ in range(2):
            h = rnd_unit(rng); h.z = 0; h = h.normalized() * r * rng.uniform(.2, .6)
            top = mc + h * 1.3 - UP * (r * .78 + .5); c = top - UP * .17
            tube(P['fruit'], [bp[-1], bp[-1].lerp(top, .5) - UP * .1, top], [.03, .02, .012], 5, col=lin((.42, .38, .22)))
            spiky_fruit(P['fruit'], c, .17, .14, rng, tint(rng, lin((.60, .66, .22)), .06), lin((.74, .68, .32)))
    for bp, br, mc in cand:
        for _ in range(1 if mc.z < 6.2 else 0):
            f = rng.uniform(.08, .3) * (len(bp) - 1); i0 = int(f); q = bp[i0].lerp(bp[i0 + 1], f - i0) - UP * br[i0]
            s = rng.uniform(.9, 1.1); stalk = rng.uniform(.1, .16); c = q - UP * (stalk + .16 * s)
            tube(P['fruit'], [q, q - UP * stalk * .5, q - UP * stalk], [.012, .01, .012], 5, col=lin((.42, .38, .22)))
            spiky_fruit(P['fruit'], c, .17 * s, .14 * s, rng, tint(rng, lin((.60, .66, .22)), .06), lin((.74, .68, .32)))
    return garden_group('durian', P, M)

# ───────────────────────────── 5. black pepper on a living post ─────────────────────────────

def pepper_vine(seed=91):
    rng = random.Random(seed); M = env_mats()
    M['bark'] = material('pepper_post_bark', to_image('T_pepper_post_bark', lambda: tex_bark('albizia', seed)), .9)
    M['leaf'] = material('pepper_leaf', to_image('T_pepper_leaf', lambda: tex_pepper_atlas(seed)), .6, alpha=True, two_sided=True, spec=.35)
    M['vine'] = material('pepper_vine', None, .6, spec=.5)
    M['spike'] = material('pepper_spike', to_image('T_pepper_spike', tex_pepper_spike), .4, alpha=True, two_sided=True, spec=.5)
    P = {k: MB() for k in ('bark', 'leaf', 'vine', 'spike')}
    # living support (Gliricidia), pollarded at ~3.7 m with fresh sprouts
    Hp = 3.7
    tp, tr = grow(rng, Vector((0, 0, 0)), UP, Hp, .105, .075, 9, .03, lambda p, d: Vector((-p.x, -p.y, 0)) * .08)
    tr[0] *= 1.35; tr[-1] *= 1.25
    tube(P['bark'], tp, tr, 9, col=(.95, .82, .7, 1), v_scale=1 / (TAU * .1), cap=True)
    post_at = lambda z: tp[min(8, int(z / Hp * 9))].lerp(tp[min(9, int(z / Hp * 9) + 1)], (z / Hp * 9) % 1)
    for k in range(4):
        a = k * TAU / 4 + rng.uniform(-.4, .4); d = Vector((math.cos(a) * .5, math.sin(a) * .5, 1)).normalized()
        sp, sr = grow(rng, tp[-1] - UP * rng.uniform(.0, .15), d, rng.uniform(.45, .75), .02, .007, 3, .12, lambda p, d: Vector((0, 0, .02)))
        tube(P['bark'], sp, sr, 4, col=lin((.5, .55, .3)), v_scale=3, cap=True)
        for j in range(5):
            dd = (d + rnd_unit(rng) * .6 + UP * .2).normalized()
            card(P['leaf'], sp[-1 - j % len(sp)], dd, (UP + rnd_unit(rng) * .5).normalized(), .55, .55, GARDEN_CELLS['c'], tint(rng, (1, 1, 1), .1), droop=.15, curl=.1)
    # pepper: 4 orthotropic stems spiralling up the post, fruiting laterals from every node
    stem_col = lin((.36, .38, .22)); TOPZ = 3.35
    for si in range(4):
        az = si * TAU / 4 + rng.uniform(-.3, .3); pts = []; nodes = []; z = 0.0; zig = 1
        while z < TOPZ:
            pr = post_at(z); r = .085 + .02 * (z < .3)
            a = az + .22 * z + zig * .07; zig = -zig
            pts.append(pr + Vector((math.cos(a) * r, math.sin(a) * r, 0)) + Vector((0, 0, z - pr.z))); nodes.append((pts[-1], a, z))
            z += rng.uniform(.075, .1)
        tube(P['vine'], pts, [.012 * (1 - .4 * i / len(pts)) for i in range(len(pts))], 4, col=stem_col)
        for (p0, a, z) in nodes:
            if z < .3 or rng.random() < .12: continue
            da = rng.uniform(-.85, .85); out = Vector((math.cos(a + da), math.sin(a + da), 0))
            Lw = (.28 + .26 * math.sin(math.pi * min(1, z / 3.6))) * rng.uniform(.75, 1.15) * (1 - max(0, z - 2.85) / .9)
            d = (out + UP * rng.uniform(-.3, .45)).normalized()
            sag = rng.uniform(.05, .35); lp = [p0 + d * (Lw * s) - UP * (sag * Lw * s * s) for s in (0, .34, .67, 1)]
            tube(P['vine'], lp[::3] if Lw < .3 else [lp[0], lp[1], lp[3]], [.006, .0045, .003] if Lw >= .3 else [.006, .003], 3, col=stem_col)
            nl = max(3, int(Lw / .037)); side = d.cross(UP).normalized()
            for i in range(nl):
                s = (i + 1) / nl; f = s * 3; i0 = min(2, int(f)); q = lp[i0].lerp(lp[i0 + 1], f - i0); sgn = 1 if i % 2 else -1
                ld = (d * .35 + side * sgn * .5 + rnd_unit(rng) * .35 - UP * rng.uniform(.55, .95)).normalized()   # petiole bends, blade hangs facing out
                L = rng.uniform(.15, .2) * (1.05 - .2 * s)
                cell = GARDEN_CELLS['b' if (s > .85 and rng.random() < .5) or z > 3.1 else ('a' if rng.random() < .62 else 'd')]
                junction = q + ld * .015
                leaf(P['leaf'], junction - ld * .14 * L, ld, (out * .6 + UP * .25 + rnd_unit(rng) * .8).normalized(), L, L, cell, tint(rng, (1, 1, 1), .08),
                     lambda s_: 1.0, segs=1, droop=.15, fold=.12, rng=rng)
                if .5 < z < 3.2 and s > .5 and rng.random() < .42:   # berry spike hanging at the outer skin of the column
                    Ls = rng.uniform(.125, .14); Ws = Ls * .48
                    top = q + out * .05 - UP * .01; sway = (out * .3 + rnd_unit(rng) * .15) * Ls
                    r_ = rng.random(); cell = SPIKE_CELLS[0 if r_ < .2 else (1 if r_ < .38 else (2 if r_ < .8 else 3))]
                    u0, v0, u1, v1 = cell; ph = rng.random() * math.pi
                    for k_ in range(2):   # two crossed cards
                        sd_ = Vector((math.cos(ph + k_ * math.pi / 2), math.sin(ph + k_ * math.pi / 2), 0)) * Ws / 2
                        ids = [P['spike'].add(top - sd_, (u0, v1)), P['spike'].add(top + sd_, (u1, v1)),
                               P['spike'].add(top + sway + sd_ - UP * Ls, (u1, v0)), P['spike'].add(top + sway - sd_ - UP * Ls, (u0, v0))]
                        P['spike'].face(ids)
        # leaves straight on the climbing stem fill the core of the column
        for (p0, a, z) in nodes[2::2]:
            out = Vector((math.cos(a), math.sin(a), 0)); ld = (out - UP * .3 + rnd_unit(rng) * .3).normalized(); L = rng.uniform(.12, .16)
            leaf(P['leaf'], p0 + ld * .01 - ld * .14 * L, ld, (UP + out).normalized(), L, L, GARDEN_CELLS['a'], tint(rng, (1, 1, 1), .08), lambda s_: 1.0, segs=1, droop=.2, fold=.1, rng=rng)
    # mulched basin round the foot
    lathe(P['vine'], [(.75, -.02), (.6, .03), (.3, .06), (.001, .07)], 18, col=lin((.30, .20, .13)))
    return garden_group('pepper_vine', P, M, normals={'leaf': ((0, 0, 1.8), (.55, .55, 1.9), .25)})

# ───────────────────────────── 6. bamboo clump ─────────────────────────────

def bamboo_clump(seed=101):
    rng = random.Random(seed); M = env_mats()
    M['culm'] = material('bamboo_culm', to_image('T_bamboo_culm', tex_bamboo_culm), .45, spec=.5)
    M['fol'] = material('bamboo_foliage', to_image('T_bamboo_foliage', lambda: tex_spray_atlas({'a': 'bamboo', 'b': 'bamboo', 'c': 'bamboo2', 'd': 'bamboo_dry'}, seed)),
                        .75, alpha=True, two_sided=True, spec=.28)
    P = {k: MB() for k in ('culm', 'fol', 'plain')}
    green = [GARDEN_CELLS['a'], GARDEN_CELLS['b'], GARDEN_CELLS['c']]
    tints = [((.95, 1.0, .9), .5), ((1.15, 1.08, .7), .25), ((.75, .85, .7), .15), ((1.1, .95, .7), .1)]
    for ci in range(30):
        rr = 1.0 * math.sqrt(rng.random()); a = rng.random() * TAU
        base = Vector((math.cos(a) * rr, math.sin(a) * rr, -.05))
        out = Vector((math.cos(a), math.sin(a), 0)) if rr > .15 else rnd_unit(rng) * Vector((1, 1, 0))
        out = out.normalized()
        lean0 = math.radians(3 + 15 * rr + rng.uniform(-3, 4)); bend = math.radians(rng.uniform(18, 40)) * (.5 + rr)
        Hc = rng.uniform(6.4, 8.6) * (1 - .15 * rr); segs = 14; step = Hc / segs
        pts = [base]
        for i in range(segs):
            t = (i + .5) / segs; ang = lean0 + bend * t ** 2.4
            pts.append(pts[-1] + (out * math.sin(ang) + UP * math.cos(ang)) * step)
        r0 = rng.uniform(.04, .06)
        rads = [r0 * (1 - .78 * (i / segs) ** 1.3) + .005 for i in range(segs + 1)]
        r_ = rng.random(); acc = 0
        for tc, p_ in tints:
            acc += p_
            if r_ <= acc: break
        tube(P['culm'], pts, rads, 6, col=(*tc, 1), v_scale=1 / .42)
        # branch whorls on the upper two thirds, each carrying drooping leaf sprays
        for i in range(7, segs):
            t = i / segs; p = pts[i]
            T = (pts[min(i + 1, segs)] - pts[i - 1]).normalized()
            for b in range(1):
                sd = rnd_unit(rng); sd = (sd - T * sd.dot(T)).normalized()
                bd = (sd + out * .6 + UP * .2).normalized(); Lb = rng.uniform(.5, .9) * (1.1 - .4 * t)
                bp = [p, p + bd * Lb * .5 + UP * .03, p + bd * Lb - UP * .05]
                tube(P['culm'], bp, [.008, .006, .003], 3, col=(.9, .9, .7, 1), v_scale=1)
                for j in range(2 if rng.random() < .7 else 1):
                    q = bp[2 - j]; d = (bd + rnd_unit(rng) * .45 - UP * .25).normalized()
                    sz = rng.uniform(.85, 1.1)
                    card(P['fol'], q - d * .08, d, (UP + out * .3 + rnd_unit(rng) * .3).normalized(), sz, sz, green[rng.randrange(3)], tint(rng, (1, 1, 1), .1), droop=.28, curl=.12)
        for j in range(3):   # drooping tip sprays
            d = ((pts[-1] - pts[-2]).normalized() + rnd_unit(rng) * .6 - UP * .3).normalized()
            card(P['fol'], pts[-1 - j] - d * .05, d, (UP + rnd_unit(rng) * .3).normalized(), 1.1, 1.1, green[rng.randrange(3)], tint(rng, (1, 1, 1), .1), droop=.3, curl=.12)
        # papery culm sheaths still clinging at the lowest nodes
        for i in (1, 2):
            if rng.random() < .55:
                q = pts[i]; d = (out + UP * 2).normalized()
                leaf(P['fol'], q - UP * .3, d, out, .38, .16, GARDEN_CELLS['d'], (1, .9, .8, 1), lambda s: .7 + .3 * (1 - s), segs=1, droop=-.1, fold=-.2, rng=rng)
    # young shoots (măng) breaking the litter round the clump
    for k in range(5):
        a = rng.random() * TAU; rr = rng.uniform(.8, 1.4); h = rng.uniform(.2, .55); c = (math.cos(a) * rr, math.sin(a) * rr, -.02)
        lathe(P['plain'], [(.06 * h / .4 + .02, 0), (.055 * h / .4 + .018, h * .3), (.035 * h / .4 + .01, h * .65), (.012, h * .9), (.002, h)], 10,
              col=tint(rng, lin((.46, .36, .22)), .1), center=c, wobble=lambda a_, z: .12 * ((z * 9 + a_ / TAU) % 1) - .06)
    for _ in range(26):   # dry leaf litter lying flat
        a = rng.random() * TAU; rr = rng.uniform(.2, 2.0); p = Vector((math.cos(a) * rr, math.sin(a) * rr, .015 + rng.random() * .01))
        d = Vector((math.cos(a + rng.uniform(-1.5, 1.5)), math.sin(a + rng.uniform(-1.5, 1.5)), 0))
        card(P['fol'], p, d, UP, rng.uniform(.6, .9), rng.uniform(.6, .9), GARDEN_CELLS['d'], tint(rng, (1, 1, 1), .1), droop=0, curl=.02)
    return garden_group('bamboo_clump', P, M, normals={'fol': ((0, 0, 5.0), (3.5, 3.5, 3.0), .35)})

# ───────────────────────────── export ─────────────────────────────

GARDEN = {'nursery_bed': nursery_bed, 'banana': banana, 'avocado': avocado, 'durian': durian,
          'pepper_vine': pepper_vine, 'bamboo_clump': bamboo_clump}

def export_garden(out_dir, only=None):
    for name, fn in GARDEN.items():
        if only and name not in only: continue
        purge(); root = fn()
        print('garden', name, 'tris', root.get('tris'))
        export_glb(root.name, os.path.join(out_dir, f'{name.replace("_", "-")}.glb'))

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_garden(sys.argv[sys.argv.index('--export') + 1], only)
