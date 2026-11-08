"""Gedeo / Central-Highlands harvest, transport and processing set — procedural, real-world metres (Blender 5.x).

One GLB per asset in public/models/gedeo/ (origin = ground level, base centre; vehicles face -Y in Blender = +Z in three.js):
  back-basket          gùi — tall woven bamboo back basket, rattan rim, wooden cross foot, shoulder straps, half full of cherries
  winnow-tray          nia + thúng — flat round twill-woven winnowing tray with cherries, and a deep resin-coated thúng heaped full
  harvest-tarp         bạt hứng — 3 × 3 m blue woven PE tarp with folds / creases / curled edges, grommets, cherries and fallen leaves
  wheelbarrow          xe rùa — pressed-steel tray with rolled lip, one pneumatic treaded wheel, hardwood handles, full of cherries
  motorbike-sacks      xe máy chở bao — 110cc underbone (step-through), spoked wheels, three jute sacks roped to a rack board
  farm-truck           xe tải nhẹ — ~1.5 t cab-over light truck, dual rear wheels, stake bed loaded with 15 jute sacks
  power-tiller-cart    xe công nông — walking tractor (horizontal diesel, radiator hopper, flywheel, belt, long handlebars) + wooden cart
  pulper-machine       máy xát vỏ — hopper, pulping drum, flywheel + V-belt to a small petrol engine, bean chute, pulp heap, concrete pad
  drying-yard          sân phơi — 6 × 4 m cement slab, coffee raked into ridged rows, wooden rake lying on it
  drying-rack-covered  giàn phơi có mái — raised mesh drying bed under a clear-plastic hoop tunnel (semi-transparent BLEND material)
  sack-stack           đống bao — 21 stencilled jute sacks stacked five high on two wooden pallets

Reuses the mesh / texture helpers of gedeo_heroes / gedeo_buildings / gedeo_robots / gedeo_environment (exec chain below).
Headless export (+ optional QA renders):
  Blender -b --factory-startup -P scripts/blender/gedeo_harvest.py -- --export public/models/gedeo [--only a,b] [--preview DIR]
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_environment.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import Matrix, noise as mnoise

# ───────────────────────────── textures ─────────────────────────────

def tex_weave(seed, n=20, banded=False, base=(.70, .54, .33)):
    """Tileable 2/2 twill of flat bamboo strips (n strips per tile each way). banded: smoked weft rows (gùi pattern)."""
    rng = np.random.default_rng(seed); H = W = 1024
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    gx = X / W * n; gy = Y / H * n; i = gx.astype(int); j = gy.astype(int); fx = gx - i; fy = gy - j
    fib_h = fbm(H, W, n * 4, 4, 3, rng); fib_v = fbm(H, W, 4, n * 4, 3, rng); blot = fbm(H, W, 4, 4, 3, rng)
    tone_h = rng.uniform(.82, 1.12, n)[j]; tone_v = rng.uniform(.82, 1.12, n)[i]
    b = srgb(base)
    ch = b * (tone_h * (.8 + .35 * fib_h))[..., None]; cv = b * (tone_v * (.8 + .35 * fib_v))[..., None] * .93
    if banded:
        dark = np.isin(j % 10, (2, 3, 7)); smoke = srgb((.22, .13, .07)) * (.8 + .4 * fib_h[..., None])
        ch = np.where(dark[..., None], smoke, ch)
    top_h = ((i + j) % 4) < 2
    gap_h = np.clip((np.abs(fy - .5) - .40) * 14, 0, 1); gap_v = np.clip((np.abs(fx - .5) - .40) * 14, 0, 1)
    crown_h = np.sin(np.pi * fy); crown_v = np.sin(np.pi * fx)
    ch = ch * (.78 + .22 * crown_h)[..., None]; cv = cv * (.78 + .22 * crown_v)[..., None]
    c = np.where(top_h[..., None], ch * (1 - .75 * gap_h[..., None]) + cv * .45 * gap_h[..., None],
                 cv * (1 - .75 * gap_v[..., None]) + ch * .45 * gap_v[..., None])
    c *= (1 - .18 * np.clip((blot - .55) * 3, 0, 1))[..., None]                       # handling grime
    hgt = np.where(top_h, .55 + .45 * crown_h - .5 * gap_h, .55 + .45 * crown_v - .5 * gap_v)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1); return out, hgt, 6.0

def tex_tarp():
    rng = np.random.default_rng(612); H = W = 512
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    weave = (np.sin(u * TAU * 96) * np.sin(v * TAU * 96) + 1) * .5
    n = fbm(H, W, 6, 6, 4, rng); dirt = fbm(H, W, 3, 3, 4, rng)
    c = srgb((.10, .33, .68)) * (.86 + .14 * weave[..., None]) * (.9 + .2 * n[..., None])
    c = mix3(c, srgb((.42, .30, .22)), np.clip((dirt - .62) * 1.5, 0, .25))          # red-earth smears
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1); return out, weave * .6 + n * .4, 2.5

COFFEE_MIX = {
    'fresh': [((.55, .04, .04), .52), ((.38, .02, .04), .22), ((.70, .18, .05), .1), ((.40, .48, .12), .1), ((.75, .48, .08), .06)],
    'dry': [((.40, .07, .07), .32), ((.30, .09, .07), .28), ((.52, .18, .08), .14), ((.22, .12, .08), .18), ((.60, .10, .06), .08)],
}
def tex_coffee_bed(kind, seed, W=1024, r0=9.5):
    """Tileable layer of whole cherries (tile = 0.8 m)."""
    rng = random.Random(seed); cv = Canvas(W, W, (.16, .07, .05, 1)); mix = COFFEE_MIX[kind]
    for _ in range(int(W * W / (r0 * r0 * 2.3))):
        x, y = rng.uniform(0, W), rng.uniform(0, W); r = rng.random(); acc = 0
        for col, p in mix:
            acc += p
            if r <= acc: break
        col = np.array(col) * rng.uniform(.75, 1.15); rr = r0 * rng.uniform(.8, 1.15); ry = rr * rng.uniform(.72, .95); a = rng.random() * math.pi
        for ox in (-W, 0, W):
            for oy in (-W, 0, W):
                if -2 * rr < x + ox < W + 2 * rr and -2 * rr < y + oy < W + 2 * rr:
                    cv.ellipse(x + ox, y + oy, rr, ry, a, col, shade=.65)
    lum = cv.a[..., :3].mean(2)
    return cv.a, lum, 5.0

GLYPHS = {
    'A': [[(0, 0), (2, 6), (4, 0)], [(.7, 2.2), (3.3, 2.2)]],
    'B': [[(0, 0), (0, 6), (3, 6), (4, 5), (4, 4), (3, 3), (0, 3)], [(3, 3), (4, 2), (4, 1), (3, 0), (0, 0)]],
    'C': [[(4, 5), (3, 6), (1, 6), (0, 5), (0, 1), (1, 0), (3, 0), (4, 1)]],
    'D': [[(0, 0), (0, 6), (2.5, 6), (4, 4.5), (4, 1.5), (2.5, 0), (0, 0)]],
    'E': [[(4, 6), (0, 6), (0, 0), (4, 0)], [(0, 3), (3, 3)]],
    'G': [[(4, 5), (3, 6), (1, 6), (0, 5), (0, 1), (1, 0), (3, 0), (4, 1), (4, 3), (2.2, 3)]],
    'I': [[(2, 0), (2, 6)], [(1, 6), (3, 6)], [(1, 0), (3, 0)]],
    'K': [[(0, 0), (0, 6)], [(4, 6), (0, 2.4)], [(1.4, 3.4), (4, 0)]],
    'L': [[(0, 6), (0, 0), (4, 0)]],
    'M': [[(0, 0), (0, 6), (2, 3), (4, 6), (4, 0)]],
    'N': [[(0, 0), (0, 6), (4, 0), (4, 6)]],
    'O': [[(1, 0), (0, 1), (0, 5), (1, 6), (3, 6), (4, 5), (4, 1), (3, 0), (1, 0)]],
    'R': [[(0, 0), (0, 6), (3, 6), (4, 5), (4, 4), (3, 3), (0, 3)], [(2, 3), (4, 0)]],
    'S': [[(4, 5), (3, 6), (1, 6), (0, 5), (0, 4), (1, 3), (3, 3), (4, 2), (4, 1), (3, 0), (1, 0), (0, 1)]],
    'T': [[(0, 6), (4, 6)], [(2, 6), (2, 0)]],
    'U': [[(0, 6), (0, 1), (1, 0), (3, 0), (4, 1), (4, 6)]],
    'V': [[(0, 6), (2, 0), (4, 6)]],
    '1': [[(1, 4.8), (2, 6), (2, 0)], [(1, 0), (3, 0)]],
    '6': [[(4, 5), (3, 6), (1, 6), (0, 5), (0, 1), (1, 0), (3, 0), (4, 1), (4, 2), (3, 3), (0, 3)]],
}
GLYPHS['0'] = GLYPHS['O']
SACK_ASPECT = .59   # sack top face: 0.88 m (u) × 0.52 m (v) mapped onto a square atlas quadrant

def tex_jute_print():
    """1024² jute atlas: top-left / top-right quadrants = stencilled sack faces (two exporters), bottom half = plain jute."""
    rng = np.random.default_rng(611); H = W = 1024
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    weave = (np.sin(u * TAU * 150) * np.sin(v * TAU * 150) + 1) * .5
    slub = fbm(H, W, 32, 24, 2, rng); n = fbm(H, W, 6, 6, 4, rng); patchy = fbm(H, W, 12, 12, 3, rng)
    c = srgb((.60, .47, .29)) * (.72 + .28 * weave[..., None]) * (.86 + .24 * n[..., None]) * (.94 + .1 * slub[..., None])
    masks = [Canvas(W, H), Canvas(W, H)]
    def text(mk, s, cx, base, size, wid):
        sc = size / 6; ax = sc * SACK_ASPECT; adv = 5.6 * ax; x0 = cx - (len(s) * adv - 1.6 * ax) / 2
        for k, ch in enumerate(s):
            for stroke in GLYPHS.get(ch, []):
                for (pa, pb), (qa, qb) in zip(stroke, stroke[1:]):
                    mk.line(x0 + k * adv + pa * ax, base - pb * sc, x0 + k * adv + qa * ax, base - qb * sc, wid, (1, 1, 1))
    def rect(mk, x0, y0, x1, y1, wid):
        for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))): mk.line(*a, *b, wid, (1, 1, 1))
    def bean(mk, cx, cy, rx, ry, wid):
        pts = [(cx + rx * math.cos(TAU * k / 24), cy + ry * math.sin(TAU * k / 24)) for k in range(25)]
        for a, b in zip(pts, pts[1:]): mk.line(*a, *b, wid, (1, 1, 1))
        s = [(cx + rx * .15 * math.sin(t * math.pi * 2), cy - ry * .9 + ry * 1.8 * t) for t in np.linspace(0, 1, 9)]
        for a, b in zip(s, s[1:]): mk.line(*a, *b, wid * .8, (1, 1, 1))
    for q, (lines, ink) in enumerate((((('ARABICA', 205, 72, 11), ('GEDEO', 300, 58, 10), ('GRADE 1', 370, 40, 7), ('60 KG', 440, 44, 8)), (.06, .08, .16)),
                                      ((('ROBUSTA', 205, 72, 11), ('DAK LAK', 300, 56, 10), ('VIET NAM', 370, 40, 7), ('60 KG', 440, 44, 8)), (.10, .26, .12)))):
        ox = q * 512; mk = masks[q]
        rect(mk, ox + 60, 52, ox + 452, 462, 6); rect(mk, ox + 72, 64, ox + 440, 450, 3)
        bean(mk, ox + 256, 112, 22, 30, 5)
        for s, base, size, wid in lines: text(mk, s, ox + 256, base, size, wid)
        m = mk.a[..., 3] * np.clip(.5 + .8 * (patchy - .5) * 2 + .25, 0, 1) * .88
        c = c * (1 - m[..., None]) + srgb(ink) * m[..., None]
        if q == 1:   # woven green stripes along the length of the Vietnamese sacks
            stripe = ((np.abs(v - .035) < .012) | (np.abs(v - .465) < .012)) & (u >= .5)
            c = np.where(np.broadcast_to(stripe, (H, W))[..., None], c * srgb((.45, .80, .45)), c)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, weave * .7 + n * .3 - (masks[0].a[..., 3] + masks[1].a[..., 3]) * .08, 3.0

def tex_net():
    H = W = 256; Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    line = (np.abs((X % 32) - 16) > 13.5) | (np.abs((Y % 32) - 16) > 13.5)
    out = np.zeros((H, W, 4), np.float32); out[..., :3] = .06; out[..., 3] = line.astype(np.float32); return out

# ───────────────────────────── materials ─────────────────────────────

def _bsdf(m): return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')

def hmats():
    M = env_mats()
    for key, seed, n, banded, base in (('bamboo', 621, 20, False, (.74, .58, .36)), ('bamboo_band', 622, 16, True, (.70, .53, .31))):
        cimg, nimg = tex_pair(key, lambda seed=seed, n=n, banded=banded, base=base: tex_weave(seed, n, banded, base))
        M[key] = material(f'hv_{key}', cimg, .8, two_sided=False, normal=nimg, spec=.3)
    t, tn = tex_pair('tarp', tex_tarp); M['tarp'] = material('hv_tarp', t, .55, two_sided=True, normal=tn, spec=.5)
    s, sn = tex_pair('jute_print', tex_jute_print); M['sack'] = material('hv_sack', s, .95, normal=sn, spec=.2)
    for k, seed in (('fresh', 631), ('dry', 632)):
        ci, cn = tex_pair(f'coffee_{k}', lambda k=k, seed=seed: tex_coffee_bed(k, seed))
        M[f'coffee_{k}'] = material(f'hv_coffee_{k}', ci, .5, normal=cn, spec=.45)
    M['cherry'] = material('hv_cherry', None, .4, spec=.5)
    M['leaf'] = material('coffee_leaf', to_image('T_coffee_leaf', lambda: tex_coffee_leaf(11)), .38, two_sided=True, spec=.6)
    M['paint'] = material('hv_paint', to_image('T_robot', robot_tex), .38, spec=.6)
    M['rubber'] = material('hv_rubber', None, .85, spec=.3)
    M['plastic'] = material('hv_plastic', None, .5, spec=.45)
    M['chrome'] = material('hv_chrome', None, .18, spec=.9); _bsdf(M['chrome']).inputs['Metallic'].default_value = 1.0
    M['steel'] = material('hv_steel', None, .45, spec=.6); _bsdf(M['steel']).inputs['Metallic'].default_value = .6
    M['glass'] = material('hv_glass', None, .05, spec=1.0)
    M['lens'] = material('hv_lens', None, .1, spec=.9)
    M['net'] = material('hv_net', to_image('T_shade_net', tex_net), .8, alpha=True, two_sided=True, spec=.2)
    if 'hv_clear' not in bpy.data.materials:
        m = material('hv_clear', None, .08, two_sided=True, spec=.9); b = _bsdf(m); b.inputs['Alpha'].default_value = .14
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    M['clear'] = bpy.data.materials['hv_clear']
    return M

def parts(*keys): return {k: MB() for k in keys}

# ───────────────────────────── geometry helpers ─────────────────────────────

def V(*a): return Vector(a)
def circ(r, n=8, rx=None): return [((rx or r) * math.cos(TAU * k / n), r * math.sin(TAU * k / n)) for k in range(n)]
def rect(a, b): return [(-a / 2, -b / 2), (a / 2, -b / 2), (a / 2, b / 2), (-a / 2, b / 2)]

def area2(pts): return sum(pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1] for i in range(len(pts))) * .5
def ccw(pts): return list(pts) if area2(pts) > 0 else list(pts)[::-1]

def round_poly(pts, r, n=3):
    """Fillet every corner of a closed 2D polygon (quadratic Bézier, n segments per corner)."""
    out = []; N = len(pts)
    for i in range(N):
        p = Vector(pts[i]); a = Vector(pts[i - 1]); b = Vector(pts[(i + 1) % N])
        rr = r[i] if isinstance(r, (list, tuple)) else r
        if rr <= 0: out.append(p); continue
        da, db = a - p, b - p; p0 = p + da.normalized() * min(rr, da.length * .45); p2 = p + db.normalized() * min(rr, db.length * .45)
        for k in range(n + 1):
            t = k / n; out.append(p0 * (1 - t) ** 2 + p * 2 * t * (1 - t) + p2 * t * t)
    return out

def offset_poly(pts, d):
    """Inset a CCW polygon by d (miter)."""
    N = len(pts); out = []
    for i in range(N):
        a, p, b = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % N])
        e1 = p - a; e2 = b - p
        e1 = e1.normalized() if e1.length > 1e-9 else e2.normalized(); e2 = e2.normalized() if e2.length > 1e-9 else e1
        n1 = Vector((-e1.y, e1.x)); n2 = Vector((-e2.y, e2.x)); m = n1 + n2
        m = m.normalized() if m.length > 1e-6 else n1
        out.append(p + m * (d / max(.35, m.dot(n1))))
    return out

def _ax(axis, s, a, b):
    return Vector((s, a, b)) if axis == 'x' else Vector((b, s, a)) if axis == 'y' else Vector((a, b, s))

def slab(mb, prof, s0, s1, bev, col, axis='x', steps=2, uv=1.0, at=(0, 0, 0)):
    """Convex 2D profile (CCW seen from +axis) extruded s0→s1 along axis with a rounded bevel on both ends."""
    prof = [Vector(p) for p in ccw(prof)]; o = Vector(at); rings = []
    per = [0.0]
    for i in range(1, len(prof) + 1): per.append(per[-1] + (prof[i % len(prof)] - prof[i - 1]).length)
    st = []
    if bev > 0:
        for k in range(steps + 1):
            t = k / steps * math.pi / 2; st.append((s0 + bev * (1 - math.cos(t)), bev * (1 - math.sin(t))))
        st += [(s1 - (s - s0), d) for s, d in reversed(st)]
    else: st = [(s0, 0), (s1, 0)]
    for s, d in st:
        pp = offset_poly(prof, d) if d > 1e-6 else prof
        rings.append([mb.add(o + _ax(axis, s, p.x, p.y), (per[j] * uv, s * uv), col) for j, p in enumerate(pp)])
    n = len(prof)
    for A, B in zip(rings, rings[1:]):
        for j in range(n): mb.face((A[j], A[(j + 1) % n], B[(j + 1) % n], B[j]))
    for (s, d), end in ((st[0], False), (st[-1], True)):
        pp = offset_poly(prof, d) if d > 1e-6 else prof; cen = sum(pp, Vector((0, 0))) / n
        ring = [mb.add(o + _ax(axis, s, p.x, p.y), (p.x * uv, p.y * uv), col) for p in pp]
        c = mb.add(o + _ax(axis, s, cen.x, cen.y), (cen.x * uv, cen.y * uv), col)
        for j in range(n): mb.face((c, ring[j], ring[(j + 1) % n]) if end else (c, ring[(j + 1) % n], ring[j]))

def sweep(mb, pts, sec, col, up=UP, closed=False, caps=True, uv=1.0):
    """Closed 2D section (CCW in (N, B)) swept along pts. up: Vector or fn(i, p, T) giving the N direction hint."""
    pts = [Vector(p) for p in pts]; n = len(pts); sec = ccw(sec); m = len(sec); rings = []; acc = 0
    for i in range(n):
        T = (pts[(i + 1) % n] - pts[i - 1]) if closed else (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        T.normalize(); u = up(i, pts[i], T) if callable(up) else Vector(up)
        N = u - T * u.dot(T)
        if N.length < 1e-5: N = T.orthogonal()
        N.normalize(); B = T.cross(N)
        if i: acc += (pts[i] - pts[i - 1]).length
        rings.append([mb.add(pts[i] + N * a + B * b, (k / m, acc * uv), col) for k, (a, b) in enumerate(sec)])
    for i in range(n if closed else n - 1):
        A = rings[i]; Bv = rings[(i + 1) % n]
        for j in range(m): mb.face((A[j], A[(j + 1) % m], Bv[(j + 1) % m], Bv[j]))
    if caps and not closed:
        for ring, end in ((rings[0], False), (rings[-1], True)):
            c = mb.add(sum((Vector(mb.v[k]) for k in ring), Vector()) / m, (0, 0), col)
            for j in range(m): mb.face((c, ring[j], ring[(j + 1) % m]) if end else (c, ring[(j + 1) % m], ring[j]))

def beam(mb, a, b, w, h, col, up=UP):
    """Rectangular bar a→b: h along `up`, w across."""
    sweep(mb, [a, b], rect(h, w), col, up)

def rod(mb, pts, r, col, sides=8, caps=True, up=None):
    pts = [Vector(p) for p in pts]
    if up is None: up = UP if abs((pts[-1] - pts[0]).normalized().z) < .9 else Vector((1, 0, 0))
    sweep(mb, pts, circ(r, sides), col, up, caps=caps)

def revolve(mb, prof, segs, col, origin, axis, wob=None, uvs=1.0, a0=0.0):
    """Surface of revolution round an arbitrary axis. prof [(r, h[, k])]: normal = (dh, -dr) in (r, h) — walk the profile
    with the solid on your right. wob(j, ang, h) * k is added to r (tyre treads)."""
    a, t, b = axis_frame(axis); o = Vector(origin); rings = []
    for i, pr in enumerate(prof):
        r, h = pr[0], pr[1]; k = pr[2] if len(pr) > 2 else 0; ring = []
        for j in range(segs + 1):
            ang = a0 + TAU * j / segs; rr = r + (wob(j % segs, ang, h) * k if wob and k else 0)
            ring.append(mb.add(o + a * h + (t * math.cos(ang) + b * math.sin(ang)) * rr, (j / segs * uvs, i / max(1, len(prof) - 1)), col))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for j in range(segs): mb.face((rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]))

def disc(mb, c, r, t, axis, col, segs=16, bev=.004):
    """Short closed cylinder (bevelled) centred at c."""
    prof = [(.0005, -t / 2), (r - bev, -t / 2), (r, -t / 2 + bev), (r, t / 2 - bev), (r - bev, t / 2), (.0005, t / 2)] if bev > 0 else [(.0005, -t / 2), (r, -t / 2), (r, t / 2), (.0005, t / 2)]
    revolve(mb, prof, segs, col, c, axis)

def ring_sweep(mb, c, R, sec, col, axis=(0, 0, 1), n=32):
    """Closed hoop of radius R round axis through c; sec in (radial, axial)."""
    a, t, b = axis_frame(axis); o = Vector(c)
    pts = [o + (t * math.cos(TAU * k / n) + b * math.sin(TAU * k / n)) * R for k in range(n)]
    sweep(mb, pts, sec, col, up=lambda i, p, T: (p - o).normalized(), closed=True)

def smooth(pts, k=4):
    """Catmull-Rom resample of a polyline (k sub-steps per span)."""
    P_ = [Vector(p) for p in pts]; out = []
    for i in range(len(P_) - 1):
        p0, p1, p2, p3 = P_[max(i - 1, 0)], P_[i], P_[i + 1], P_[min(i + 2, len(P_) - 1)]
        for s in range(k):
            t = s / k; t2, t3 = t * t, t * t * t
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P_[-1]); return out

def hull2d(pts):
    pts = sorted(set((round(p[0], 6), round(p[1], 6)) for p in pts))
    if len(pts) < 3: return pts
    def cr(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]

def stadium(c1, r1, c2, r2, n=16):
    """CCW hull of two circles (belt / chain-case outline) in 2D."""
    pts = [(c1[0] + r1 * math.cos(TAU * k / n), c1[1] + r1 * math.sin(TAU * k / n)) for k in range(n)]
    pts += [(c2[0] + r2 * math.cos(TAU * k / n), c2[1] + r2 * math.sin(TAU * k / n)) for k in range(n)]
    return hull2d(pts)

def rrect(cx, cy, hx, hy, r, nc=3):
    pts = []
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        ox, oy = cx + sx * (hx - r), cy + sy * (hy - r)
        for q in range(nc + 1):
            a = (k + q / nc) * math.pi / 2; pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts

def loft(mb, rings, col, inner=False, uv=1.0):
    """rings: [(pts2d CCW, z)] bottom→top, equal counts. Outer walls face out (inner=True: face in)."""
    ids = []; n = len(rings[0][0])
    for pts, z in rings:
        acc = 0; row = []
        for j, p in enumerate(pts):
            if j: acc += math.dist(pts[j - 1], p)
            row.append(mb.add((p[0], p[1], z), (acc * uv, z * uv), col))
        ids.append(row)
    for A, B in zip(ids, ids[1:]):
        for j in range(n):
            q = (A[j], A[(j + 1) % n], B[(j + 1) % n], B[j]); mb.face(q[::-1] if inner else q)
    return ids

def cap(mb, ring_ids, up=True, col=None):
    n = len(ring_ids); cen = sum((Vector(mb.v[k]) for k in ring_ids), Vector()) / n
    c = mb.add(cen, (cen.x, cen.y), col or mb.col[ring_ids[0]])
    for j in range(n): mb.face((ring_ids[j], ring_ids[(j + 1) % n], c) if up else (ring_ids[(j + 1) % n], ring_ids[j], c))

def mound(mb, ring_fn, K, zfn, col=(1, 1, 1, 1), uvs=1 / .8, rng=None, cvar=0.0):
    """Heap surface: ring_fn(s) → CCW 2D ring at scale s∈(0,1]; zfn(x, y, s) height. Faces up."""
    rings = []
    for k in range(K):
        s = 1 - k / K
        rings.append([mb.add((x, y, zfn(x, y, s)), (x * uvs, y * uvs), tint(rng, col, cvar) if rng else col) for x, y in ring_fn(s)])
    n = len(rings[0]); cx = sum(mb.v[k][0] for k in rings[-1]) / n; cy = sum(mb.v[k][1] for k in rings[-1]) / n
    c = mb.add((cx, cy, zfn(cx, cy, 0)), (cx * uvs, cy * uvs), col)
    for A, B in zip(rings, rings[1:]):
        for j in range(n): mb.face((A[j], A[(j + 1) % n], B[(j + 1) % n], B[j]))
    for j in range(n): mb.face((rings[-1][j], rings[-1][(j + 1) % n], c))

def pickc(rng, mix, var=.1):
    r = rng.random(); acc = 0
    for c, p in mix:
        acc += p
        if r <= acc: return tint(rng, c, var)
    return tint(rng, mix[0][0], var)

def cherry(mb, p, rng, s=1.0, mix=None, seg=5, rings=3):
    """One ripe coffee cherry (~16 mm) resting with its base at p."""
    ax = (rnd_unit(rng) * Vector((1, 1, .3))).normalized()
    ellipsoid(mb, Vector(p) + V(0, 0, .0066 * s), ax, .0084 * s, .0068 * s, pickc(rng, mix or CHERRY_MIX), seg, rings, tip_col=(.10, .04, .02, 1))

CHERRY_MIX = [((.36, .012, .016), .5), ((.22, .008, .02), .18), ((.48, .07, .014), .12), ((.20, .30, .04), .1), ((.52, .28, .02), .06), ((.12, .03, .02), .04)]
LEAF_PROF = lambda s: max(.06, math.sin(math.pi * min(1, s * 1.02)) ** .7)
def fallen_leaf(mb, p, rng, L=None, dry=False):
    d = Vector((math.cos(a := rng.random() * TAU), math.sin(a), rng.uniform(-.05, .15)))
    L = L or rng.uniform(.10, .15); col = tint(rng, (.95, .85, .35, 1) if dry else (1, 1, 1, 1), .12)
    leaf(mb, Vector(p), d, UP, L, L * .42, COFFEE_CELLS[0], col, LEAF_PROF, segs=3, droop=-.06, fold=.2, rng=rng)

def sack(mb, c, rng, L=.88, Wd=.52, H=.26, rz=0.0, rot=None, design=0, nu=9, nv=6, squash=1.0):
    """60 kg jute sack lying flat: pillow of sewn top / bottom halves, stencil (atlas quadrant `design`) on the top face.
    c = centre of the contact patch (bottom). rot: extra 3×3 rotation applied before rz."""
    c = Vector(c); R = Matrix.Rotation(rz, 3, 'Z') @ (rot or Matrix.Identity(3))
    o = Vector((rng.random() * 40, rng.random() * 40, rng.random() * 40)); col = tint(rng, (1, 1, 1, 1), .08)
    Hb = H * .3; Ht = (H - Hb) * squash
    for side in (1, -1):
        grid = []
        for i in range(nu + 1):
            u = -1 + 2 * i / nu; row = []
            for j in range(nv + 1):
                v = -1 + 2 * j / nv
                f = max(0.0, (1 - abs(u) ** 5) * (1 - abs(v) ** 3)) ** .45
                p = Vector((u * L / 2 * (1 - .04 * (1 - f)), v * Wd / 2 * (1 + .07 * f), Hb + (Ht * f if side > 0 else -Hb * f ** .25)))
                p += Vector((mnoise.noise(o + p * 6) * .012, mnoise.noise(o + p * 6 + V(5, 0, 0)) * .012, mnoise.noise(o + p * 5 + V(0, 9, 0)) * .022 * f * side))
                uvp = (.5 * design + .02 + .46 * i / nu, .52 + .46 * j / nv) if side > 0 else (.05 + .9 * i / nu, .05 + .4 * j / nv)
                row.append(mb.add(c + R @ p, uvp, col))
            grid.append(row)
        for i in range(nu):
            for j in range(nv):
                q = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]); mb.face(q if side > 0 else q[::-1])

def sack_top(c, H=.26, squash=1.0):
    return Vector(c).z + H * .3 + (H * .7) * squash

_prng = random.Random(77)
def plank(mb, c, s, col=(1, 1, 1, 1), uv=1.0, rz=0.0):
    """Box whose wood UVs run the grain along its longest side, one board of the atlas across its width."""
    i0 = len(mb.v); box(mb, c, s, col, 1, rz); c = Vector(c)
    L = max(range(3), key=lambda k: s[k]); o = [k for k in range(3) if k != L]; Rm = Matrix.Rotation(-rz, 3, 'Z')
    u0 = _prng.randrange(5) / 5 + .02; v0 = _prng.random() * 3
    for i in range(i0, len(mb.v)):
        p = Rm @ (Vector(mb.v[i]) - c); a = (p[o[0]] + p[o[1]]) / (s[o[0]] + s[o[1]]) + .5
        mb.uv[i] = (u0 + a * .16, v0 + p[L] / 1.2)

# ── wheels ──
def tyre(mb, c, R, w, axis, rb, segs=48, tread='block', depth=.006, col=(.025, .025, .028, 1)):
    sh = R - rb
    prof = [(rb, -w * .40, 0), (rb + .22 * sh, -w * .49, 0), (rb + .62 * sh, -w * .50, 0), (R - .14 * sh, -w * .45, .4),
            (R, -w * .30, 1), (R, -w * .10, 1), (R, w * .10, 1), (R, w * .30, 1), (R - .14 * sh, w * .45, .4),
            (rb + .62 * sh, w * .50, 0), (rb + .22 * sh, w * .49, 0), (rb, w * .40, 0)]
    if tread == 'block': wob = lambda j, ang, h: depth * ((j + (h > 0)) % 2)
    elif tread == 'chevron': wob = lambda j, ang, h: depth * (((j + int(abs(h) / w * 7)) % 4) < 2)
    else: wob = None
    revolve(mb, [(r, h - .0, k) for r, h, k in prof], segs, col, c, axis, wob)

def disc_rim(mb, c, rb, w, axis, col, nuts=5, nut_col=(.3, .3, .3, 1), dish=.30, segs=28):
    a, t, b = axis_frame(axis); o = Vector(c)
    prof = [(rb + .012, .46 * w), (rb, .43 * w), (rb * .93, .37 * w), (rb * .66, dish * w), (rb * .52, (dish + .07) * w), (rb * .30, (dish + .09) * w), (.001, (dish + .11) * w)]
    revolve(mb, prof, segs, col, c, axis)
    revolve(mb, [(r, -h) for r, h in prof][::-1], segs, col, c, axis)
    for k in range(nuts):
        ang = TAU * k / nuts; p = o + a * ((dish + .1) * w) + (t * math.cos(ang) + b * math.sin(ang)) * rb * .4
        disc(mb, p, .011, .018, axis, nut_col, 6, 0)
    disc(mb, o + a * ((dish + .12) * w), rb * .2, .03, axis, nut_col, 12)

def spoked_rim(mb_rim, mb_hub, c, rb, axis, nsp=36):
    a, t, b = axis_frame(axis); o = Vector(c)
    W = lambda r, ang, h: o + a * h + (t * math.cos(ang) + b * math.sin(ang)) * r
    ring_sweep(mb_rim, c, rb - .006, [(-.012, -.016), (.008, -.018), (.012, 0), (.008, .018), (-.012, .016)], (.75, .75, .76, 1), axis, 48)
    revolve(mb_hub, [(.001, -.07), (.03, -.07), (.05, -.06), (.062, -.045), (.05, -.04), (.045, -.03), (.045, .03), (.058, .036), (.058, .05), (.03, .062), (.001, .062)], 18, (.55, .56, .58, 1), c, axis)
    for k in range(nsp):
        side = 1 if k % 2 else -1; ang = TAU * k / nsp
        rod(mb_rim, [W(.05, ang, side * .042), W(rb - .02, ang + side * .32, side * .006)], .0022, (.7, .7, .72, 1), 3, caps=False, up=a)

# ───────────────────────────── assets ─────────────────────────────

def back_basket(seed=21):
    """Gùi (Ê Đê / Ba Na style): square foot widening to a round mouth, smoked-band twill, rattan-bound rim."""
    rng = random.Random(seed); M = hmats(); P = parts('bamboo_band', 'bamboo', 'pole', 'coffee_fresh', 'cherry', 'leaf')
    prof = [(.125, .09), (.14, .16), (.165, .30), (.195, .46), (.228, .62), (.25, .73), (.255, .76)]
    sq = lambda a, z: .10 * max(0, 1 - z / .42) * (abs(math.cos(2 * a)) - .6)          # square base → round mouth
    lathe(P['bamboo_band'], prof, 32, wobble=sq, u_len=.34, v_len=.34)
    lathe(P['bamboo'], [(r * .965 - .006, z) for r, z in prof][::-1], 32, wobble=sq, u_len=.42, v_len=.42, col=(.72, .66, .6, 1))
    lathe(P['bamboo'], [(.001, .09), (prof[0][0], .09)], 32, wobble=sq, col=(.6, .55, .5, 1))
    # rattan rim: two hoops lashed together + vertical ribs
    for dr in (.008, -.014): ring_sweep(P['pole'], (0, 0, .758), .255 + dr, circ(.012, 6), (.85, .7, .5, 1), n=40)
    for k in range(48):
        a = TAU * k / 48; ca, sa = math.cos(a), math.sin(a)
        rod(P['bamboo'], [V(ca * .236, sa * .236, .748), V(math.cos(a + .05) * .253, math.sin(a + .05) * .253, .776), V(math.cos(a + .1) * .274, math.sin(a + .1) * .274, .75)], .004, (.55, .42, .26, 1), 4)
    for k in range(4):
        a = TAU * k / 4 + math.pi / 4
        pts = [V(math.cos(a) * (r * (1 + sq(a, z)) + .008), math.sin(a) * (r * (1 + sq(a, z)) + .008), z) for r, z in prof]
        sweep(P['pole'], [V(math.cos(a) * .17, math.sin(a) * .17, .02)] + pts, rect(.014, .03), (.62, .48, .32, 1), lambda i, p, T: V(p.x, p.y, 0))
    # wooden cross foot
    for a in (math.pi / 4, -math.pi / 4):
        d = V(math.cos(a), math.sin(a), 0) * .2
        beam(P['pole'], V(0, 0, .055) - d, V(0, 0, .055) + d, .035, .035, (.55, .4, .28, 1))
    for k in range(4):
        a = TAU * k / 4 + math.pi / 4; p = V(math.cos(a) * .17, math.sin(a) * .17, 0)
        beam(P['pole'], p, p + V(0, 0, .09), .04, .04, (.5, .36, .24, 1), up=V(1, 0, 0))
    # shoulder straps (woven rattan bands) on the back (+Y)
    for sx in (-1, 1):
        x0 = sx * .1
        pts = [V(x0, .225, .70), V(x0 * 1.1, .30, .66), V(x0 * 1.2, .35, .52), V(x0 * 1.25, .33, .36), V(x0 * 1.25, .26, .24), V(x0 * 1.2, .16, .2)]
        sweep(P['bamboo'], smooth(pts, 4), rect(.012, .05), (.42, .28, .16, 1), V(0, 1, 0), uv=2)
    # half full: heap of cherries at mid-height + loose cherries + a stray leaf
    zc = .56; rr = .208
    mound(P['coffee_fresh'], lambda s: [(rr * s * math.cos(TAU * k / 24), rr * s * math.sin(TAU * k / 24)) for k in range(24)], 5,
          lambda x, y, s: zc + .045 * (1 - s * s) + .006 * mnoise.noise(V(x * 30, y * 30, 3)))
    for _ in range(70):
        a = rng.random() * TAU; r = math.sqrt(rng.random()) * .17; s = r / rr
        cherry(P['cherry'], V(math.cos(a) * r, math.sin(a) * r, zc + .045 * (1 - s * s) - .004), rng)
    for _ in range(3): fallen_leaf(P['leaf'], V(rng.uniform(-.08, .08), rng.uniform(-.08, .08), zc + .05), rng, .1)
    return group('back_basket', P, M)

def winnow_tray(seed=22):
    """Nia (winnowing tray, 0.85 m) with a thin layer of cherries + a deep resin-coated thúng heaped full beside it."""
    rng = random.Random(seed); M = hmats(); P = parts('bamboo', 'pole', 'coffee_fresh', 'cherry', 'leaf')
    # nia
    R = .425; o = V(-.22, 0, 0)
    lathe(P['bamboo'], [(R + .004, .064), (R - .03, .034), (.30, .024), (.001, .02)], 40, center=o, u_len=.3, v_len=.3)
    lathe(P['bamboo'], [(.001, .006), (.30, .01), (R - .03, .02), (R + .006, .058)], 40, center=o, u_len=.3, v_len=.3, col=(.8, .74, .66, 1))
    for dr, z in ((.006, .064), (-.016, .062)): ring_sweep(P['pole'], o + V(0, 0, z), R + dr, circ(.011, 6), (.82, .66, .46, 1), n=44)
    for k in range(40):
        a = TAU * k / 40
        rod(P['bamboo'], [o + V(math.cos(a) * (R - .03), math.sin(a) * (R - .03), .05), o + V(math.cos(a + .08) * (R + .022), math.sin(a + .08) * (R + .022), .078)], .004, (.5, .38, .24, 1), 4)
    mound(P['coffee_fresh'], lambda s: [(o.x + .30 * s * math.cos(TAU * k / 28), o.y + .30 * s * math.sin(TAU * k / 28)) for k in range(28)], 4,
          lambda x, y, s: .023 + .022 * (1 - s ** 3) + .003 * mnoise.noise(V(x * 40, y * 40, 1)))
    for _ in range(90):
        a = rng.random() * TAU; r = math.sqrt(rng.random()) * .33
        cherry(P['cherry'], o + V(math.cos(a) * r, math.sin(a) * r, .022 + (.02 if r < .28 else 0)), rng)
    for _ in range(3): fallen_leaf(P['leaf'], o + V(rng.uniform(-.2, .2), rng.uniform(-.2, .2), .05), rng, .09)
    # thúng (deep round basket, rounded bottom coated with dark resin)
    t = V(.50, .12, 0); prof = [(.001, .0), (.10, .008), (.19, .04), (.245, .10), (.268, .19), (.275, .30)]
    s0 = len(P['bamboo'].v); lathe(P['bamboo'], prof, 36, center=t, u_len=.3, v_len=.3)
    for i in range(s0, len(P['bamboo'].v)):
        k = max(0, min(1, (P['bamboo'].v[i][2] - .06) / .14)); P['bamboo'].col[i] = (.30 + .7 * k, .22 + .78 * k, .15 + .85 * k, 1)
    lathe(P['bamboo'], [(r * .96 - .005, z + .004) for r, z in prof][::-1], 36, center=t, u_len=.3, v_len=.3, col=(.75, .68, .6, 1))
    for dr in (.008, -.012): ring_sweep(P['pole'], t + V(0, 0, .302), .275 + dr, circ(.012, 6), (.8, .64, .44, 1), n=40)
    for k in range(36):
        a = TAU * k / 36
        rod(P['bamboo'], [t + V(math.cos(a) * .25, math.sin(a) * .25, .285), t + V(math.cos(a + .09) * .30, math.sin(a + .09) * .30, .318)], .0042, (.5, .38, .24, 1), 4)
    mound(P['coffee_fresh'], lambda s: [(t.x + .262 * s * math.cos(TAU * k / 28), t.y + .262 * s * math.sin(TAU * k / 28)) for k in range(28)], 5,
          lambda x, y, s: .29 + .085 * (1 - s * s) + .006 * mnoise.noise(V(x * 30, y * 30, 2)))
    for _ in range(80):
        a = rng.random() * TAU; r = math.sqrt(rng.random()) * .24; s = r / .262
        cherry(P['cherry'], t + V(math.cos(a) * r, math.sin(a) * r, .29 + .085 * (1 - s * s) - .004), rng)
    for _ in range(14):   # a few spilled on the ground
        a = rng.random() * TAU; r = rng.uniform(.3, .42); cherry(P['cherry'], t + V(math.cos(a) * r, math.sin(a) * r, 0), rng)
    return group('winnow_tray', P, M)

def harvest_tarp(seed=23):
    """3 × 3 m blue PE tarp spread under a tree: creases, curled edges, hem + grommets, strip-picked cherries and leaves."""
    rng = random.Random(seed); M = hmats(); P = parts('tarp', 'steel', 'cherry', 'leaf', 'coffee_fresh', 'pole')
    Hs = 1.5; xs = [-Hs, -Hs + .035] + list(np.linspace(-Hs + .08, Hs - .08, 38)) + [Hs - .035, Hs]
    o = V(rng.random() * 50, rng.random() * 50, 0)
    creases = [(V(rng.uniform(-1, 1), rng.uniform(-1, 1), 0), V(math.cos(a := rng.random() * math.pi), math.sin(a), 0), rng.uniform(.035, .06)) for _ in range(6)]
    def hgt(x, y):
        p = V(x, y, 0); z = .012 + .011 * mnoise.noise(o + p * 2.2) + .004 * mnoise.noise(o + p * 7) + .018 * mnoise.noise(o * .3 + p * .6)
        for c0, d, amp in creases:
            q = p - c0; along = q.dot(d); dist = (q - d * along).length
            z += amp * math.exp(-(dist / .09) ** 2) * max(0, 1 - abs(along) / 1.3)
        z += .03 * max(0, math.sin(y * 14 + 2 * mnoise.noise(o + p))) * math.exp(-(x + Hs) / .45)   # pulled wrinkles, west edge
        e1 = Hs - x; e2 = y + Hs; e3 = Hs - y
        z += .10 * math.exp(-e1 / .09) * (.6 + .4 * mnoise.noise(o + p * 3))        # east edge rolled up over a root
        z += .05 * math.exp(-e2 / .07) * max(0, mnoise.noise(o + p * 2.5 + V(3, 0, 0)) + .3)
        z += .07 * math.exp(-e3 / .1) * max(0, x + .2)                                 # north-east corner lifted
        return max(z, .004)
    grid = []
    for x in xs:
        row = []
        for y in xs:
            hem = min(Hs - abs(x), Hs - abs(y)) < .04
            row.append(P['tarp'].add((x, y, hgt(x, y)), (x, y), (.72, .72, .74, 1) if hem else tint(rng, (1, 1, 1, 1), .03)))
        grid.append(row)
    n = len(xs)
    for i in range(n - 1):
        for j in range(n - 1): P['tarp'].face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    for k in range(7):                                                               # aluminium grommets every 0.5 m
        g = -Hs + .02 + k * (2 * Hs - .04) / 6
        for x, y in ((g, -Hs + .02), (g, Hs - .02), (-Hs + .02, g), (Hs - .02, g)):
            ring_sweep(P['steel'], (x, y, hgt(x, y) + .003), .009, rect(.006, .003), (.8, .8, .82, 1), n=8)
    # cherries: thick under the canopy (centre ring), a stripped heap, a scatter
    for _ in range(300):
        a = rng.random() * TAU; r = abs(rng.gauss(.65, .38)); x, y = math.cos(a) * r, math.sin(a) * r
        if abs(x) < 1.4 and abs(y) < 1.4: cherry(P['cherry'], (x, y, hgt(x, y) - .002), rng, mix=CHERRY_MIX if rng.random() < .85 else [((.20, .32, .05), 1)])
    hc = V(.35, -.25, 0)
    mound(P['coffee_fresh'], lambda s: [(hc.x + .26 * s * math.cos(TAU * k / 20) * (1 + .15 * math.sin(3 * TAU * k / 20)), hc.y + .2 * s * math.sin(TAU * k / 20)) for k in range(20)], 4,
          lambda x, y, s: hgt(x, y) + .065 * (1 - s * s) ** 1.2 + .003)
    for _ in range(40):
        a = rng.random() * TAU; r = rng.uniform(.15, .32); x, y = hc.x + math.cos(a) * r, hc.y + math.sin(a) * r * .8
        cherry(P['cherry'], (x, y, hgt(x, y)), rng)
    for _ in range(42):
        a = rng.random() * TAU; r = rng.uniform(.1, 1.35); x, y = math.cos(a) * r, math.sin(a) * r
        fallen_leaf(P['leaf'], V(x, y, hgt(x, y) + .004), rng, dry=rng.random() < .3)
    for _ in range(5):                                                               # snapped twigs
        x, y = rng.uniform(-1, 1), rng.uniform(-1, 1); a = rng.random() * TAU; L = rng.uniform(.15, .3)
        pts = [V(x + math.cos(a) * L * t, y + math.sin(a) * L * t, 0) for t in (0, .5, 1)]
        for p in pts: p.z = hgt(p.x, p.y) + .005
        rod(P['pole'], pts, .005, (.45, .36, .25, 1), 4)
    return group('harvest_tarp', P, M)

def wheelbarrow(seed=24):
    """Pressed-steel tray wheelbarrow (~85 L), one 4.00-8 pneumatic wheel, hardwood handles, heaped with cherries."""
    rng = random.Random(seed); M = hmats(); P = parts('paint', 'steel', 'rubber', 'wood', 'coffee_fresh', 'cherry', 'plastic')
    green = (.05, .20, .08, 1)
    rings = [(rrect(0, .05, .21, .26, .07), .33), (rrect(0, -.01, .29, .37, .09), .44), (rrect(0, -.08, .355, .47, .11), .57), (rrect(0, -.09, .36, .48, .11), .60)]
    out = loft(P['paint'], rings, green); cap(P['paint'], out[0], up=False)
    inn = loft(P['paint'], [(offset_poly(r, .006), z + (.006 if k == 0 else 0)) for k, (r, z) in enumerate(rings)], (.04, .12, .05, 1), inner=True)
    cap(P['paint'], inn[0], up=True)
    ring_sweep_pts = [V(p[0], p[1], .603) for p in rrect(0, -.09, .363, .483, .11, 5)]
    sweep(P['paint'], ring_sweep_pts, circ(.012, 6), green, closed=True)
    # load
    mound(P['coffee_fresh'], lambda s: rrect(0, -.08, .345 * s + .001, .465 * s + .001, .1 * s + .001, 3), 6,
          lambda x, y, s: .57 + .12 * (1 - s * s) + .006 * mnoise.noise(V(x * 25, y * 25, 4)))
    for _ in range(90):
        x, y = rng.uniform(-.3, .3), rng.uniform(-.48, .3); s = max(abs(x) / .345, abs(y + .08) / .465)
        cherry(P['cherry'], (x, y, .57 + .12 * (1 - s * s) - .004), rng)
    # wheel
    wc = V(0, -.62, .2)
    tyre(P['rubber'], wc, .193, .09, (1, 0, 0), .105, 44, 'block', .007)
    disc_rim(P['steel'], wc, .105, .08, (1, 0, 0), (.55, .55, .56, 1), 4)
    rod(P['steel'], [wc - V(.095, 0, 0), wc + V(.095, 0, 0)], .009, (.3, .3, .3, 1), 6)
    # handles (two hardwood rails from the axle to the grips) + grips
    for sx in (-1, 1):
        pts = [V(sx * .085, -.62, .2), V(sx * .13, -.48, .26), V(sx * .19, -.2, .30), V(sx * .23, .3, .32), V(sx * .27, .75, .48), V(sx * .285, 1.0, .58)]
        sweep(P['wood'], pts, rect(.045, .04), (.85, .72, .55, 1), UP, uv=2)
        rod(P['plastic'], [V(sx * .285, .95, .56), V(sx * .29, 1.10, .62)], .02, (.03, .03, .03, 1), 8)
        # front brace: tray nose → handle near the wheel
        sweep(P['steel'], [V(sx * .18, -.52, .55), V(sx * .15, -.5, .36), V(sx * .13, -.47, .27)], rect(.006, .035), (.2, .2, .2, 1), V(0, -1, 0))
        # legs + feet
        sweep(P['steel'], [V(sx * .21, .12, .31), V(sx * .23, .26, .15), V(sx * .24, .33, .015), V(sx * .24, .45, .015)], circ(.011, 6), (.2, .2, .2, 1), UP)
        sweep(P['steel'], [V(sx * .23, .26, .15), V(sx * .22, .45, .33)], circ(.009, 6), (.2, .2, .2, 1), UP)
    rod(P['steel'], [V(-.225, .2, .22), V(.225, .2, .22)], .009, (.2, .2, .2, 1), 6)
    beam(P['wood'], V(-.2, -.25, .30), V(.2, -.25, .30), .05, .03, (.8, .68, .5, 1), up=UP)
    beam(P['wood'], V(-.24, .2, .32), V(.24, .2, .32), .05, .03, (.8, .68, .5, 1), up=UP)
    return group('wheelbarrow', P, M)

def motorbike_sacks(seed=25):
    """110cc underbone step-through (Dream / Wave class, unbadged), spoked 17-in wheels, three jute sacks roped on."""
    rng = random.Random(seed); M = hmats()
    P = parts('paint', 'plastic', 'chrome', 'steel', 'rubber', 'glass', 'lens', 'sack', 'wood')
    body = (.30, .045, .035, 1); blk = (.03, .03, .032, 1); alu = (.55, .56, .58, 1)
    F = V(0, -.64, .285); Rr = V(0, .60, .285); X = (1, 0, 0)
    for c in (F, Rr):
        tyre(P['rubber'], c, .281, .07, X, .218, 48, 'block', .004)
        spoked_rim(P['chrome'], P['steel'], c, .218, X)
    # front fork, fender
    d = V(0, .42, .91).normalized(); H0 = F + d * .56; H1 = H0 + d * .15
    for sx in (-1, 1):
        rod(P['steel'], [F + V(sx * .068, 0, 0), F + V(sx * .068, 0, 0) + d * .26], .021, alu, 10)
        rod(P['chrome'], [F + V(sx * .068, 0, 0) + d * .25, H0 + V(sx * .068, 0, 0)], .015, (.8, .8, .8, 1), 10)
    rod(P['steel'], [F - V(.09, 0, 0), F + V(.09, 0, 0)], .007, alu, 6)
    rod(P['steel'], [H0 - d * .02, H1], .03, blk, 10)
    beam(P['steel'], H0 + V(-.09, 0, 0) - d * .01, H0 + V(.09, 0, 0) - d * .01, .05, .03, blk, up=d)
    fen = [F + V(0, -math.sin(a) * .325, math.cos(a) * .325) for a in np.radians(np.linspace(-62, 38, 12))]
    sweep(P['paint'], fen, [(0, -.05), (.012, -.04), (.02, 0), (.012, .04), (0, .05), (.007, 0)][::-1], body, lambda i, p, T: (p - F).normalized())
    # leg shield + head cowl with headlight + handlebar + mirrors
    shield = round_poly([(-.33, .40), (-.24, .44), (-.29, .92), (-.37, .97), (-.41, .70)], .04)
    slab(P['paint'], shield, -.20, .20, .05, body, 'x')
    slab(P['plastic'], round_poly([(-.30, .34), (-.02, .33), (.04, .47), (-.22, .52)], .04), -.085, .085, .03, blk, 'x')     # underbone tunnel
    hb = H1 + d * .05
    cowl = round_poly([(hb.y - .12, hb.z - .06), (hb.y + .08, hb.z - .055), (hb.y + .10, hb.z + .03), (hb.y - .01, hb.z + .075), (hb.y - .13, hb.z + .02)], .03)
    slab(P['paint'], cowl, -.16, .16, .05, body, 'x')
    lc = V(0, hb.y - .128, hb.z - .015)
    revolve(P['chrome'], [(.075, .0), (.072, .008), (.064, .006)], 20, (.8, .8, .8, 1), lc, (0, -1, 0))
    revolve(P['lens'], [(.065, .004), (.05, .014), (.025, .02), (.001, .022)], 20, (.95, .93, .85, 1), lc, (0, -1, 0))
    for sx in (-1, 1):
        beam(P['plastic'], V(sx * .15, hb.y - .1, hb.z - .01), V(sx * .19, hb.y - .1, hb.z - .01), .04, .03, (.9, .45, .05, 1), up=UP)   # indicators
    revolve(P['plastic'], [(.045, -.01), (.048, .0), (.04, .012), (.001, .014)], 16, blk, V(0, hb.y + .02, hb.z + .07), (0, .35, 1))       # speedo
    bar = [V(-.34, hb.y + .05, hb.z + .03), V(-.18, hb.y + .01, hb.z + .02), V(.18, hb.y + .01, hb.z + .02), V(.34, hb.y + .05, hb.z + .03)]
    rod(P['chrome'], bar, .011, (.8, .8, .8, 1), 8)
    for sx in (-1, 1):
        rod(P['rubber'], [V(sx * .24, hb.y + .035, hb.z + .027), V(sx * .345, hb.y + .052, hb.z + .031)], .017, blk, 10)
        sweep(P['steel'], [V(sx * .17, hb.y + .0, hb.z + .03), V(sx * .27, hb.y + .06, hb.z + .02), V(sx * .30, hb.y + .08, hb.z + .015)], rect(.008, .02), alu, UP)
        rod(P['chrome'], [V(sx * .17, hb.y + .03, hb.z + .04), V(sx * .22, hb.y + .05, hb.z + .16), V(sx * .25, hb.y + .06, hb.z + .23)], .006, (.8, .8, .8, 1), 6)
        mc = V(sx * .27, hb.y + .065, hb.z + .25)
        revolve(P['plastic'], [(.001, -.012), (.035, -.012), (.05, -.004), (.05, .0)], 16, blk, mc, (0, -1, 0))
        revolve(P['chrome'], [(.048, .0), (.001, .002)], 16, (.85, .88, .9, 1), mc, (0, 1, 0))
    # engine: crankcase, finned horizontal cylinder, covers, kick-start, gear pedal, footpegs
    rbox(P['steel'], (0, .06, .29), (.22, .30, .22), alu, e=.25)
    rbox(P['steel'], (.11, .05, .28), (.05, .2, .18), (.62, .63, .65, 1), e=.3)
    disc(P['steel'], V(-.11, .08, .28), .085, .05, X, (.62, .63, .65, 1), 18, .015)
    cd = V(0, -.95, .25).normalized(); c0 = V(0, -.06, .34)
    fins = []
    for k in range(9): fins += [(.050, k * .018), (.074, k * .018 + .004), (.074, k * .018 + .01), (.050, k * .018 + .014)]
    revolve(P['steel'], [(.04, -.01)] + fins + [(.06, .17), (.06, .2), (.001, .205)], 8, alu, c0, cd, a0=math.pi / 8)
    rod(P['rubber'], [c0 + cd * .2 + V(0, 0, .05), c0 + cd * .22 + V(0, -.02, .1)], .012, blk, 6)
    rod(P['steel'], [V(.14, .14, .30), V(.16, .26, .26), V(.16, .34, .30)], .009, (.25, .25, .26, 1), 6)       # kick lever
    rod(P['steel'], [V(-.12, .02, .24), V(-.17, -.08, .26)], .008, (.25, .25, .26, 1), 6)                       # gear pedal
    for sx in (-1, 1): rod(P['rubber'], [V(sx * .1, .02, .25), V(sx * .22, .02, .25)], .016, blk, 8)
    # exhaust: header under the engine → chrome muffler with black end cap on the right
    rod(P['chrome'], [c0 + cd * .17 + V(0, 0, -.05), V(.02, -.25, .16), V(.08, -.12, .14), V(.13, .08, .17), V(.15, .28, .26)], .02, (.8, .8, .8, 1), 8)
    mu = V(.155, .26, .26); md = V(0, 1, .18).normalized()
    revolve(P['chrome'], [(.001, -.02), (.035, -.01), (.058, .06), (.06, .38), (.05, .45)], 16, (.82, .82, .82, 1), mu, md)
    revolve(P['plastic'], [(.05, .45), (.045, .48), (.02, .49), (.001, .49)], 16, blk, mu, md)
    # swing arm, chain case (left), rear shocks with springs, rear fender
    for sx in (-1, 1): sweep(P['steel'], [V(sx * .085, .2, .32), Rr + V(sx * .085, 0, 0)], rect(.04, .025), blk, UP)
    rod(P['steel'], [Rr - V(.1, 0, 0), Rr + V(.1, 0, 0)], .008, alu, 6)
    slab(P['plastic'], stadium((.1, .30), .065, (.60, .285), .1), -.122, -.09, .01, blk, 'x')
    for sx in (-1, 1):
        a = V(sx * .115, .55, .33); b = V(sx * .125, .47, .70); dd = (b - a).normalized()
        rod(P['steel'], [a, b], .014, blk, 8)
        fr = axis_frame(dd); hel = []
        for k in range(73):
            ang = TAU * k / 12; hel.append(a + dd * (.06 + .23 * k / 72) + (fr[1] * math.cos(ang) + fr[2] * math.sin(ang)) * .026)
        rod(P['chrome'], hel, .0045, (.8, .8, .8, 1), 4, up=dd.orthogonal())
    fen2 = [Rr + V(0, -math.sin(a) * .33, math.cos(a) * .33) for a in np.radians(np.linspace(-38, 70, 10))]
    sweep(P['plastic'], fen2, [(0, -.055), (.012, -.045), (.018, 0), (.012, .045), (0, .055), (.006, 0)][::-1], blk, lambda i, p, T: (p - Rr).normalized())
    # rear body, seat, rack board, tail light, plate, centre stand
    slab(P['paint'], round_poly([(.01, .48), (.30, .45), (.62, .56), (.80, .68), (.80, .75), (.04, .78), (-.04, .70)], .05), -.13, .13, .05, body, 'x')
    slab(P['plastic'], round_poly([(-.06, .77), (.40, .765), (.44, .84), (.38, .875), (0, .87), (-.08, .82)], .03), -.135, .135, .05, (.025, .02, .02, 1), 'x')
    for sx in (-1, 1):
        rod(P['steel'], [V(sx * .12, .30, .78), V(sx * .13, .42, .83), V(sx * .13, .86, .83), V(sx * .1, .88, .78)], .011, (.12, .12, .13, 1), 6)
    for y in (.45, .62, .84): rod(P['steel'], [V(-.13, y, .833), V(.13, y, .833)], .009, (.12, .12, .13, 1), 6)
    plank(P['wood'], (0, .64, .85), (.5, .44, .025), (.85, .72, .55, 1), uv=2)
    rbox(P['plastic'], (0, .815, .70), (.16, .06, .07), (.55, .03, .02, 1), e=.3)
    rbox(P['lens'], (0, .842, .70), (.14, .02, .05), (.75, .05, .04, 1), e=.3)
    for sx in (-1, 1): rbox(P['plastic'], (sx * .12, .80, .69), (.05, .05, .035), (.9, .45, .05, 1), e=.3)
    beam(P['steel'], V(0, .83, .67), V(0, .88, .56), .17, .005, (.92, .92, .9, 1), up=V(0, 1, .4))                # plate
    for sx in (-1, 1): rod(P['steel'], [V(sx * .09, .16, .22), V(sx * .12, .24, .01)], .011, blk, 6)
    rod(P['steel'], [V(-.12, .24, .015), V(.12, .24, .015)], .01, blk, 6)
    # load: two sacks across the rack board, one stood up in the step-through; rubber tie-down cords
    S1 = V(0, .64, .862); sack(P['sack'], S1, rng, .92, .5, .25, rz=0.03, design=1)
    S2 = V(.03, .62, sack_top(S1, .25) - .04); sack(P['sack'], S2, rng, .9, .5, .25, rz=-.06, design=0)
    sack(P['sack'], V(0, -.02, .72), rng, .78, .42, .22, rot=Matrix.Rotation(math.pi / 2, 3, 'X'), design=1)
    top = sack_top(S2, .25)
    for sx in (-.2, .22):
        loop = [V(sx, .64 + .29 * math.cos(a), (top + .82) / 2 + (top - .82) / 2 * math.sin(a) * 1.02) for a in np.linspace(0, TAU, 25)[:-1]]
        sweep(P['rubber'], loop, circ(.006, 5), (.5, .06, .05, 1), V(1, 0, 0), closed=True)
    loop = [V(.0 + .05 * math.sin(a), -.13 + .14 * math.cos(a), .76 + .05 * math.sin(a)) for a in np.linspace(0, TAU, 17)[:-1]]
    sweep(P['rubber'], loop, circ(.006, 5), (.5, .06, .05, 1), UP, closed=True)
    return group('motorbike_sacks', P, M)

def farm_truck(seed=26):
    """~1.5 t cab-over light truck, generic: rounded steel cab, dual rear wheels, stake-frame cargo bed, 15 jute sacks."""
    rng = random.Random(seed); M = hmats()
    P = parts('paint', 'plastic', 'chrome', 'steel', 'rubber', 'glass', 'lens', 'sack', 'wood')
    blue = (.04, .14, .40, 1); blk = (.03, .03, .033, 1); grey = (.25, .26, .28, 1); silver = (.6, .61, .63, 1)
    hx = .85; z0 = .78
    D, E, F = (-2.12, 2.12), (-2.34, 1.47), (-2.40, 1.25)
    cab = round_poly([(-2.42, z0), (-1.05, z0), (-1.05, 2.12), D, E, F], [.06, .06, .14, .14, .05, .05], 3)
    slab(P['paint'], cab, -hx, hx, .1, (.92, .92, .92, 1), 'x')                       # white cab
    slab(P['paint'], round_poly([(-2.45, z0 - .2), (-1.05, z0 - .2), (-1.05, z0 + .02), (-2.45, z0 + .02)], .03), -hx + .02, hx - .02, .03, blue, 'x')   # skirt
    # glass: windscreen, door windows, rear window
    def onface(y, z, off=.007):
        e = Vector(E) - Vector(D); n = Vector((e.y, -e.x)).normalized()
        return V(0, y + n.x * off, z + n.y * off)
    wq = [(-.74, 1.52), (.74, 1.52), (.72, 2.0), (-.72, 2.0)]
    def ws(x, z):
        t = (2.12 - z) / (2.12 - 1.47); y = -2.12 - .22 * t; p = onface(y, z); p.x = x; return p
    quad(P['glass'], [ws(x, z) for x, z in wq], (.06, .09, .12, 1))
    for sx in (-1, 1):
        w = [(-2.20, 1.45), (-1.32, 1.45), (-1.32, 1.97), (-2.08, 1.97)]
        pts = [V(sx * (hx + .004), y, z) for y, z in w]
        quad(P['glass'], pts if sx > 0 else pts[::-1], (.06, .09, .12, 1))
        for (ya, za), (yb, zb) in (((-2.30, .86), (-1.28, .86)), ((-1.28, .86), (-1.28, 2.0)), ((-2.30, .86), (-2.30, 1.38))):   # door shut lines
            box(P['plastic'], (sx * (hx + .002), (ya + yb) / 2, (za + zb) / 2), (.006, abs(yb - ya) + .008, abs(zb - za) + .008), blk)
        box(P['chrome'], (sx * (hx + .01), -1.45, 1.3), (.02, .14, .03), silver)
        box(P['plastic'], (sx * (hx - .05), -1.75, .58), (.14, .38, .04), blk)              # step
        rod(P['steel'], [V(sx * (hx - .02), -2.18, 1.62), V(sx * 1.0, -2.24, 1.6)], .012, blk, 6)
        rbox(P['plastic'], (sx * 1.03, -2.24, 1.56), (.05, .14, .26), blk, e=.25)
        # headlights + indicators + front corner
        box(P['chrome'], (sx * .6, -2.43, 1.0), (.30, .03, .17), silver)
        box(P['lens'], (sx * .6, -2.447, 1.0), (.27, .01, .14), (.9, .9, .88, 1))
        box(P['lens'], (sx * .8, -2.43, 1.0), (.07, .03, .13), (.95, .5, .05, 1))
    box(P['glass'], (0, -1.045, 1.7), (1.1, .01, .35), (.06, .09, .12, 1))
    for sx in (-.35, .35): sweep(P['plastic'], [ws(sx - .25, 1.56) + V(0, -.01, 0), ws(sx + .22, 1.6) + V(0, -.01, 0)], rect(.01, .015), blk)
    # grille, bumper, chassis
    box(P['plastic'], (0, -2.43, 1.03), (.78, .03, .24), blk)
    for k in range(4): box(P['chrome'], (0, -2.45, .94 + k * .06), (.76, .012, .018), silver)
    box(P['steel'], (0, -2.48, .68), (1.76, .14, .2), grey)
    for sx in (-1, 1): beam(P['steel'], V(sx * .42, -2.4, .62), V(sx * .42, 2.45, .62), .07, .17, blk)
    for y in (-1.5, -.6, .4, 1.4, 2.35): beam(P['steel'], V(-.45, y, .62), V(.45, y, .62), .06, .1, blk)
    # wheels: front single (6.50-16), rear dual
    R, rb, wt = .36, .21, .19
    for (x, y) in ((-.73, -1.92), (.73, -1.92), (-.58, .95), (.58, .95), (-.79, .95), (.79, .95)):
        c = V(x, y, R); ax = (1 if x > 0 else -1, 0, 0)
        tyre(P['rubber'], c, R - .008, wt, ax, rb, 32, 'block', .008)
        disc_rim(P['steel'], c, rb, wt * .9, ax, (.75, .75, .74, 1), 6, dish=.15 if abs(x) < .7 else .3, segs=20)
    for y in (-1.92, .95): rod(P['steel'], [V(-.7, y, R), V(.7, y, R)], .04, blk, 8)
    rbox(P['steel'], (0, .95, R), (.32, .28, .26), blk, e=.35)
    rod(P['steel'], [V(0, -1.2, .5), V(0, .85, R + .02)], .035, blk, 8)
    for sx in (-1, 1):                                                               # front wheel arches under the cab
        arc = [V(sx * .73, -1.92 - math.sin(a) * (R + .05), R + math.cos(a) * (R + .05)) for a in np.radians(np.linspace(-58, 58, 9))]
        sweep(P['plastic'], arc, rect(.008, .24), blk, lambda i, p, T, sx=sx: (p - V(sx * .73, -1.92, R)).normalized())
    revolve(P['steel'], [(.001, -.3), (.16, -.3), (.18, -.28), (.18, .28), (.16, .3), (.001, .3)], 16, silver, (-.62, -.25, .5), (0, 1, 0))   # fuel tank
    box(P['plastic'], (.62, -.35, .5), (.22, .4, .24), blk)                           # battery box
    # bed: wood floor, steel drop sides, stake frame
    by0, by1, bw = -.95, 2.42, .88; fz = .80
    for k in range(8): plank(P['wood'], (-bw + (k + .5) * bw / 4, (by0 + by1) / 2, fz), (bw / 4 - .006, by1 - by0, .06), tint(rng, (.75, .6, .45, 1), .07))
    for y in np.linspace(by0 + .1, by1 - .1, 7): beam(P['steel'], V(-bw, y, fz - .06), V(bw, y, fz - .06), .06, .06, blk)
    sz = .40
    for sx in (-1, 1):
        box(P['paint'], (sx * bw, (by0 + by1) / 2, fz + .03 + sz / 2), (.04, by1 - by0, sz), blue)
        for y in np.linspace(by0 + .3, by1 - .3, 6): box(P['paint'], (sx * (bw + .025), y, fz + .03 + sz / 2), (.015, .05, sz - .04), blue)
        box(P['steel'], (sx * (bw + .02), (by0 + by1) / 2, fz + sz + .03), (.05, by1 - by0, .04), silver)
    for y in (by0, by1): box(P['paint'], (0, y, fz + .03 + sz / 2), (2 * bw, .04, sz), blue)
    box(P['paint'], (0, by0, 1.65), (2 * bw, .035, .02), blue)
    stz = 2.02
    ys = [by0, by0 + (by1 - by0) / 3, by0 + 2 * (by1 - by0) / 3, by1]
    for y in ys:
        for sx in (-1, 1): beam(P['steel'], V(sx * (bw - .01), y, fz + sz), V(sx * (bw - .01), y, stz), .05, .05, silver, up=V(1, 0, 0))
        beam(P['steel'], V(-bw, y, stz), V(bw, y, stz), .045, .045, silver)
    for sx in (-1, 1):
        for z in (fz + sz + .35, stz): beam(P['steel'], V(sx * (bw - .01), by0, z), V(sx * (bw - .01), by1, z), .035, .035, silver)
    for z in (1.4, 1.65, 1.85): beam(P['steel'], V(-bw, by0, z), V(bw, by0, z), .03, .03, silver)
    for sx in (-1, 1):
        box(P['rubber'], (sx * .69, 1.42, .4), (.42, .012, .34), blk)                # mud flaps
        box(P['lens'], (sx * .72, by1 + .03, .68), (.22, .03, .1), (.7, .05, .04, 1))
    # load: 3 across × 3 rows, then 3 × 2 on top
    for k, (x, y) in enumerate([(x, y) for y in (-.45, .5, 1.45) for x in (-.55, 0, .55)]):
        sack(P['sack'], V(x + rng.uniform(-.02, .02), y + rng.uniform(-.03, .03), fz + .03), rng, .9, .52, .26, rz=math.pi / 2 + rng.uniform(-.05, .05), design=k % 2, nu=8, nv=5)
    z2 = sack_top(V(0, 0, fz + .03), .26) - .05
    for k, (x, y) in enumerate([(x, y) for y in (-.40, .55) for x in (-.55, 0, .55)]):
        sack(P['sack'], V(x + rng.uniform(-.03, .03), y + rng.uniform(-.04, .04), z2), rng, .9, .52, .26, rz=math.pi / 2 + rng.uniform(-.08, .08), design=(k + 1) % 2, nu=8, nv=5)
    return group('farm_truck', P, M)

def power_tiller_cart(seed=27):
    """Xe công nông: walking tractor with a horizontal single-cylinder diesel, radiator hopper, flywheel + belt, long
    handlebars back to the driver's plank seat, coupled to a two-wheel wooden cart."""
    rng = random.Random(seed); M = hmats()
    P = parts('paint', 'plastic', 'chrome', 'steel', 'rubber', 'lens', 'wood', 'sack', 'pole')
    red = (.42, .04, .03, 1); grn = (.07, .16, .09, 1); blk = (.03, .03, .033, 1); grey = (.3, .31, .32, 1)
    X = (1, 0, 0)
    # tractor drive wheels (6.00-12 lug tyres) + gearbox
    wy, R = -1.25, .34
    for sx in (-1, 1):
        c = V(sx * .40, wy, R)
        tyre(P['rubber'], c, R - .028, .17, (sx, 0, 0), .16, 56, 'chevron', .028)
        disc_rim(P['steel'], c, .16, .15, (sx, 0, 0), (.45, .05, .03, 1), 6, segs=20)
    rod(P['steel'], [V(-.36, wy, R), V(.36, wy, R)], .045, grn, 10)
    slab(P['paint'], round_poly([(-1.45, .2), (-1.05, .25), (-1.0, .62), (-1.25, .74), (-1.42, .6)], .05), -.14, .14, .04, grn, 'x')
    # engine frame + horizontal diesel + radiator hopper
    for sx in (-1, 1): beam(P['steel'], V(sx * .16, -1.25, .64), V(sx * .16, -2.08, .64), .05, .06, blk)
    rbox(P['paint'], (0, -1.56, .84), (.34, .52, .34), red, e=.22)
    rbox(P['paint'], (0, -1.36, .84), (.30, .14, .38), red, e=.3)
    for k in range(6): rbox(P['paint'], (0, -1.66 - k * .028, 1.02), (.28, .012, .04), red, e=.4)    # head fins
    box(P['steel'], (0, -1.96, .88), (.40, .24, .44), blk)                           # radiator hopper
    box(P['steel'], (0, -2.085, .86), (.34, .01, .34), (.12, .12, .12, 1))
    for k in range(9): box(P['chrome'], (0, -2.093, .72 + k * .035), (.32, .008, .012), (.35, .35, .36, 1))
    disc(P['steel'], V(0, -1.94, 1.12), .045, .04, (0, 0, 1), red, 12)
    rbox(P['paint'], (0, -1.48, 1.1), (.30, .32, .16), red, e=.25)                   # fuel tank
    disc(P['chrome'], V(.06, -1.48, 1.19), .03, .03, (0, 0, 1), grey, 10)
    revolve(P['steel'], [(.001, 0), (.07, 0), (.075, .02), (.075, .2), (.06, .22), (.001, .23)], 14, blk, V(-.1, -1.72, 1.02), (0, 0, 1))  # oil-bath air filter
    rod(P['steel'], [V(.1, -1.75, 1.0), V(.1, -1.78, 1.25), V(.1, -1.78, 1.5)], .025, blk, 8)                 # exhaust stack
    revolve(P['steel'], [(.001, 0), (.05, .0), (.055, .03), (.055, .25), (.03, .28), (.001, .28)], 12, (.2, .2, .2, 1), V(.1, -1.78, 1.18), (0, 0, 1))
    revolve(P['steel'], [(.07, .0), (.055, .03), (.001, .035)], 12, blk, V(.1, -1.78, 1.53), (0, 0, 1))
    revolve(P['chrome'], [(.08, -.05), (.085, .0), (.075, .02), (.001, .02)], 16, (.6, .6, .62, 1), V(0, -2.05, 1.2), (0, -1, 0))   # headlight
    revolve(P['lens'], [(.07, .02), (.04, .03), (.001, .033)], 16, (.95, .93, .85, 1), V(0, -2.05, 1.2), (0, -1, 0))
    rod(P['steel'], [V(0, -2.0, 1.1), V(0, -2.02, 1.16)], .012, blk, 6)
    # flywheel (right), belt pulley (left) + belt down to the gearbox clutch pulley
    fw = V(.25, -1.5, .84)
    revolve(P['steel'], [(.15, -.03), (.23, -.03), (.24, -.02), (.24, .02), (.23, .03), (.15, .03), (.15, -.03)], 32, blk, fw, X)
    disc(P['steel'], fw, .05, .08, X, grey, 12)
    for k in range(5):
        a = TAU * k / 5; beam(P['steel'], fw + V(0, math.cos(a) * .04, math.sin(a) * .04), fw + V(0, math.cos(a) * .16, math.sin(a) * .16), .025, .03, blk, up=V(1, 0, 0))
    p1, r1, p2, r2 = (-1.56, .84), .09, (-1.18, .5), .15
    disc(P['steel'], V(-.24, *p1), r1, .05, X, grey, 18); disc(P['steel'], V(-.20, *p2), r2, .05, X, grey, 20)
    belt = [V(-.225, y, z) for y, z in stadium(p1, r1 + .008, p2, r2 + .008, 20)]
    sweep(P['rubber'], belt, rect(.03, .012), blk, V(1, 0, 0), closed=True)
    # handlebars back to the driver + clutch / steering levers
    for sx in (-1, 1):
        pts = [V(sx * .12, -1.12, .72), V(sx * .2, -.85, .82), V(sx * .3, -.5, .92), V(sx * .36, -.3, .98), V(sx * .42, -.22, 1.0)]
        rod(P['steel'], pts, .02, grn, 8)
        rod(P['rubber'], [V(sx * .40, -.24, 1.0), V(sx * .47, -.14, 1.0)], .024, blk, 8)
        rod(P['steel'], [V(sx * .36, -.32, 1.0), V(sx * .42, -.2, 1.05)], .007, (.5, .5, .5, 1), 5)
    rod(P['steel'], [V(-.22, -.8, .82), V(.22, -.8, .82)], .015, grn, 6)
    # hitch: drawbar to the cart, vertical king pin
    rod(P['steel'], [V(0, -1.05, .45), V(0, -.62, .48)], .03, blk, 8)
    rod(P['steel'], [V(0, -.66, .40), V(0, -.66, .58)], .02, grey, 8)
    # cart: steel chassis, two wheels, plank box, driver's plank seat at the front
    cy0, cy1, cw = -.55, 1.65, .72; fz = .62
    for sx in (-1, 1): beam(P['steel'], V(sx * .5, cy0, .52), V(sx * .5, cy1, .52), .06, .1, blk)
    for y in (cy0, .1, .95, cy1): beam(P['steel'], V(-.55, y, .52), V(.55, y, .52), .06, .08, blk)
    beam(P['steel'], V(-.5, cy0, .52), V(0, -.66, .48), .05, .06, blk); beam(P['steel'], V(.5, cy0, .52), V(0, -.66, .48), .05, .06, blk)
    for sx in (-1, 1):
        c = V(sx * .62, .95, .3); tyre(P['rubber'], c, .292, .16, (sx, 0, 0), .17, 32, 'block', .008)
        disc_rim(P['steel'], c, .17, .14, (sx, 0, 0), (.5, .52, .5, 1), 5, segs=20)
        box(P['steel'], (sx * .55, .95, .48), (.08, .16, .1), blk)
    rod(P['steel'], [V(-.6, .95, .3), V(.6, .95, .3)], .03, blk, 8)
    by0 = -.12
    for k in range(7): plank(P['wood'], (-cw + (k + .5) * 2 * cw / 7, (by0 + cy1) / 2, fz), (2 * cw / 7 - .006, cy1 - by0, .04), tint(rng, (.8, .66, .5, 1), .07))
    for k in range(3):
        z = fz + .02 + .065 + k * .135
        for sx in (-1, 1): plank(P['wood'], (sx * cw, (by0 + cy1) / 2, z), (.035, cy1 - by0, .125), tint(rng, (.75, .62, .48, 1), .06), uv=1)
        for y in (by0, cy1): plank(P['wood'], (0, y, z), (2 * cw + .035, .035, .125), tint(rng, (.75, .62, .48, 1), .06), uv=1)
    for y in (by0, .5, 1.1, cy1):
        for sx in (-1, 1): box(P['steel'], (sx * (cw + .025), y, fz + .2), (.02, .05, .42), blk)
    plank(P['wood'], (0, -.32, .82), (1.0, .32, .045), (.7, .56, .42, 1), uv=1)        # driver's plank seat
    for sx in (-1, 1): beam(P['steel'], V(sx * .35, -.32, .52), V(sx * .35, -.32, .80), .04, .04, blk, up=V(1, 0, 0))
    for k, (x, y, rz) in enumerate(((-.36, .3, 1.57), (.34, .32, 1.6), (-.35, 1.2, 1.55), (.36, 1.22, 1.58))):
        sack(P['sack'], V(x, y, fz + .02), rng, .88, .52, .26, rz=rz + rng.uniform(-.06, .06), design=k % 2)
    sack(P['sack'], V(0, .75, sack_top(V(0, 0, fz + .02), .26) - .04), rng, .88, .52, .26, rz=.05, design=0)
    return group('power_tiller_cart', P, M)

def pulper_machine(seed=28):
    """Máy xát vỏ cà phê tươi: hopper over a pulping drum on an angle-iron stand, flywheel + V-belt to a small petrol
    engine, bean chute into a basin, pulp heap, on a concrete pad."""
    rng = random.Random(seed); M = hmats()
    P = parts('concrete', 'paint', 'steel', 'rubber', 'plastic', 'coffee_fresh', 'cherry', 'chrome')
    grn = (.06, .22, .10, 1); blk = (.03, .03, .033, 1); grey = (.33, .34, .35, 1); X = (1, 0, 0)
    slab(P['concrete'], rrect(0, 0, .95, .8, .03), 0, .12, .015, (1, 1, 1, 1), 'z', uv=1 / 1.5)
    top = .12
    # stand: four angle-iron legs, rails, braces
    Lsec = [(-.02, -.02), (.02, -.02), (.02, -.014), (-.014, -.014), (-.014, .02), (-.02, .02)]
    for sx in (-1, 1):
        for sy in (-1, 1): sweep(P['paint'], [V(sx * .30, sy * .24, top), V(sx * .27, sy * .21, .70)], [(a * sx, b * sy) for a, b in Lsec], grn, V(1, 0, 0))
        beam(P['paint'], V(sx * .285, -.24, .40), V(sx * .285, .24, .40), .03, .03, grn)
        beam(P['paint'], V(sx * .27, -.22, .68), V(sx * .27, .22, .68), .04, .04, grn)
    for sy in (-1, 1): beam(P['paint'], V(-.29, sy * .225, .40), V(.29, sy * .225, .40), .03, .03, grn)
    # drum housing (horizontal), bolted end plates, hopper neck + hopper
    dc = V(0, 0, .88)
    revolve(P['paint'], [(.001, -.30), (.22, -.30), (.235, -.285), (.235, .285), (.22, .30), (.001, .30)], 28, grn, dc, X)
    for sx in (-1, 1):
        for k in range(8):
            a = TAU * k / 8; disc(P['steel'], dc + V(sx * .302, math.cos(a) * .19, math.sin(a) * .19), .012, .012, X, grey, 6)
        ring_sweep(P['paint'], dc + V(sx * .2, 0, 0), .237, rect(.015, .03), grn, X, 28)
    box(P['paint'], (0, 0, 1.12), (.36, .22, .12), grn)
    rings = [(rrect(0, 0, .19, .12, .03), 1.16), (rrect(0, 0, .30, .23, .04), 1.32), (rrect(0, 0, .36, .30, .05), 1.46)]
    out = loft(P['paint'], rings, grn); loft(P['paint'], [(offset_poly(r, .006), z) for r, z in rings], (.05, .14, .07, 1), inner=True)
    cap(P['paint'], out[0], up=False)
    sweep(P['paint'], [V(p[0], p[1], 1.465) for p in rrect(0, 0, .363, .303, .05, 4)], circ(.01, 6), grn, closed=True)
    mound(P['coffee_fresh'], lambda s: rrect(0, 0, .335 * s + .001, .27 * s + .001, .045 * s + .001, 3), 5,
          lambda x, y, s: 1.41 + .08 * (1 - s * s) + .005 * mnoise.noise(V(x * 30, y * 30, 5)))
    for _ in range(60):
        x, y = rng.uniform(-.29, .29), rng.uniform(-.23, .23); s = max(abs(x) / .335, abs(y) / .27)
        cherry(P['cherry'], (x, y, 1.41 + .08 * (1 - s * s) - .004), rng)
    # shaft, flywheel / pulley (right), V-belt down to the engine
    rod(P['steel'], [dc + V(.25, 0, 0), dc + V(.47, 0, 0)], .022, grey, 10)
    fw = dc + V(.44, 0, 0)
    revolve(P['steel'], [(.2, -.03), (.26, -.03), (.27, -.02), (.27, .02), (.26, .03), (.2, .03), (.2, -.03)], 36, blk, fw, X)
    disc(P['steel'], fw, .05, .08, X, grey, 12)
    for k in range(6):
        a = TAU * k / 6; beam(P['steel'], fw + V(0, math.cos(a) * .04, math.sin(a) * .04), fw + V(0, math.cos(a) * .21, math.sin(a) * .21), .02, .028, blk, up=V(1, 0, 0))
    ec = V(.30, .52, top)
    pc = (.52, ec.z + .2); pr = .055
    disc(P['steel'], V(.44, *pc), pr, .04, X, grey, 16)
    belt = [V(.44, y, z) for y, z in stadium((fw.y, fw.z), .27, pc, pr + .006, 24)]
    sweep(P['rubber'], belt, rect(.024, .012), blk, V(1, 0, 0), closed=True)
    # small 5.5 hp petrol engine on a skid
    for sx in (-1, 1): beam(P['steel'], V(ec.x + sx * .14, ec.y - .2, top + .02), V(ec.x + sx * .14, ec.y + .2, top + .02), .04, .04, blk)
    rbox(P['steel'], ec + V(0, 0, .17), (.26, .3, .22), (.55, .56, .58, 1), e=.25)
    rbox(P['paint'], ec + V(-.02, .02, .35), (.28, .2, .13), (.55, .05, .04, 1), e=.25)           # fuel tank
    disc(P['chrome'], ec + V(-.02, .02, .42), .025, .02, (0, 0, 1), grey, 10)
    revolve(P['plastic'], [(.001, -.03), (.10, -.03), (.11, .0), (.10, .03), (.001, .035)], 20, (.5, .05, .04, 1), ec + V(-.15, .0, .2), (-1, 0, 0))   # recoil starter
    cd = V(0, .55, .8).normalized(); c0 = ec + V(.0, -.08, .2)
    fins = []
    for k in range(6): fins += [(.04, k * .016), (.065, k * .016 + .004), (.065, k * .016 + .009), (.04, k * .016 + .013)]
    revolve(P['steel'], [(.03, -.01)] + fins + [(.045, .1), (.001, .105)], 8, (.5, .51, .53, 1), c0 + V(0, -.12, -.06), V(0, -.8, .6), a0=math.pi / 8)
    rbox(P['plastic'], ec + V(.0, -.2, .3), (.14, .08, .12), blk, e=.3)               # air filter
    rbox(P['steel'], ec + V(.02, .19, .24), (.16, .08, .1), (.2, .2, .2, 1), e=.3)     # muffler + guard
    rod(P['steel'], [V(.44, pc[0], pc[1]), V(.30, pc[0], pc[1])], .012, grey, 8)
    # bean chute (front) into a plastic basin of wet parchment; pulp chute (back) onto a heap
    Usec = [(.06, -.11), (0, -.11), (0, .11), (.06, .11), (.06, .098), (.012, .098), (.012, -.098), (.06, -.098)]
    sweep(P['paint'], [V(0, -.18, .70), V(0, -.42, .52), V(0, -.62, .38)], Usec, grn, UP, caps=False)
    bc = V(0, -.68, top)
    revolve(P['plastic'], [(.001, 0), (.15, 0), (.21, .16), (.22, .17), (.205, .165), (.14, .012), (.001, .012)], 24, (.05, .2, .55, 1), bc, (0, 0, 1))
    mound(P['plastic'], lambda s: [(bc.x + .18 * s * math.cos(TAU * k / 20), bc.y + .18 * s * math.sin(TAU * k / 20)) for k in range(20)], 3,
          lambda x, y, s: top + .12 + .03 * (1 - s * s), (.42, .36, .2, 1))
    for _ in range(25):
        t = rng.random(); p = V(0, -.18, .70).lerp(V(0, -.62, .38), t)
        ellipsoid(P['plastic'], p + V(rng.uniform(-.08, .08), 0, .02), rnd_unit(rng), .007, .005, (.45, .38, .22, 1), 5, 2)
    sweep(P['paint'], [V(-.05, .18, .70), V(-.08, .38, .48), V(-.1, .5, .32)], Usec, grn, UP, caps=False)
    pc2 = V(-.25, .6, top); o = V(rng.random() * 9, 2, 3)
    mound(P['plastic'], lambda s: [(pc2.x + .32 * s * math.cos(TAU * k / 22) * (1 + .2 * math.sin(2 * k)), pc2.y + .24 * s * math.sin(TAU * k / 22)) for k in range(22)], 5,
          lambda x, y, s: top + .16 * (1 - s * s) ** 1.3 + .015 * mnoise.noise(o + V(x * 12, y * 12, 0)) * (1 - s), (.09, .025, .018, 1), rng=rng, cvar=.15)
    for _ in range(40):
        a = rng.random() * TAU; r = rng.uniform(.25, .7)
        p = V(math.cos(a) * r * 1.1, math.sin(a) * r, top)
        if abs(p.x) < .9 and abs(p.y) < .75: cherry(P['cherry'], p, rng)
    return group('pulper_machine', P, M)

def drying_yard(seed=29):
    """Sân phơi: 6 × 4 m cement slab, expansion joints, coffee spread and raked into ridged rows, a pile and a wooden rake."""
    rng = random.Random(seed); M = hmats(); P = parts('concrete', 'plastic', 'coffee_dry', 'cherry', 'wood', 'pole')
    top = .10
    slab(P['concrete'], rrect(0, 0, 3.0, 2.0, .03), 0, top, .02, (1, 1, 1, 1), 'z', uv=1 / 1.5)
    for x in (-1.0, 1.0): box(P['plastic'], (x, 0, top + .0008), (.012, 3.96, .0016), (.12, .11, .10, 1))
    box(P['plastic'], (0, 0, top + .0008), (5.96, .012, .0016), (.12, .11, .10, 1))
    # raked coffee: ridges along X every 0.3 m, ragged edges
    o = V(rng.random() * 50, rng.random() * 50, 0); ax, ay = 2.72, 1.72
    nx, ny = 30, 72; grid = []; mb = P['coffee_dry']
    def ch(x, y):
        dx = ax - abs(x) + .12 * mnoise.noise(o + V(x * 1.5, y * 1.5, 0)); dy = ay - abs(y) + .1 * mnoise.noise(o + V(x * 2, y * 1.3, 7))
        e = max(0, min(1, min(dx, dy) / .18)); e = e * e * (3 - 2 * e)
        ridge = .5 + .5 * math.cos(TAU * (y + .03 * mnoise.noise(o + V(x * .8, 0, 3))) / .30)
        return top + .004 + e * (.018 + .022 * ridge + .004 * mnoise.noise(o + V(x * 9, y * 9, 1))), e
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            x = -ax - .1 + (2 * ax + .2) * i / nx; y = -ay - .1 + (2 * ay + .2) * j / ny; z, e = ch(x, y)
            row.append(mb.add((x, y, z), (x / .8, y / .8), tint(rng, (1, 1, 1, 1), .04)))
        grid.append(row)
    for i in range(nx):
        for j in range(ny): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    pc = V(2.35, -1.45, 0)                                                           # evening pile in the corner
    mound(mb, lambda s: [(pc.x + .4 * s * math.cos(TAU * k / 20), pc.y + .32 * s * math.sin(TAU * k / 20)) for k in range(20)], 5,
          lambda x, y, s: ch(x, y)[0] + .14 * (1 - s * s) ** 1.2)
    for _ in range(120):
        x, y = rng.uniform(-2.9, 2.9), rng.uniform(-1.9, 1.9)
        if abs(x) > ax - .05 or abs(y) > ay - .05: cherry(P['cherry'], (x, y, top), rng, mix=[(c, p) for c, p in COFFEE_MIX['dry']])
    # wooden rake (cào): toothed board on a 1.7 m handle, lying across the rows
    rz = .35; R = Matrix.Rotation(rz, 3, 'Z'); rc = V(-.6, .2, 0)
    hz = ch(rc.x, rc.y)[0] + .05
    T = lambda x, y, z: rc + R @ V(x, y, 0) + V(0, 0, z)
    plank(P['wood'], T(0, 0, hz), (.06, .62, .10), (.78, .64, .46, 1), uv=2, rz=rz)
    for k in range(9): plank(P['wood'], T(-.05, -.28 + k * .07, hz - .015), (.06, .025, .05), (.72, .58, .42, 1), uv=2, rz=rz)
    hp = [T(.03, 0, hz + .02), T(.9, 0, hz - .005), T(1.75, 0, top + .06)]
    rod(P['pole'], hp, .016, (.85, .75, .6, 1), 8)
    for sy in (-1, 1): rod(P['pole'], [T(.03, sy * .2, hz + .02), T(.3, 0, hz + .015)], .008, (.8, .7, .55, 1), 5)
    return group('drying_yard', P, M)

def drying_rack_covered(seed=30):
    """Raised African bed (shade-net mesh on eucalyptus poles) under a clear-plastic hoop tunnel."""
    rng = random.Random(seed); M = hmats(); P = parts('pole', 'net', 'coffee_dry', 'clear', 'steel', 'plastic', 'cherry')
    L, Wd, h = 5.0, 1.2, .9; hx, hy = L / 2, Wd / 2
    xs = [-hx, -hx / 2, 0, hx / 2, hx]
    for x in xs:
        for y in (-hy, hy): pole(P['pole'], rng, (x + rng.gauss(0, .02), y * 1.04, 0), (x, y, h - .01), .045, 6)
        for y in (-hy - .12, hy + .12): pole(P['pole'], rng, (x, y, 0), (x, y, h + .06), .035, 6)
    for y in (-hy, hy): pole(P['pole'], rng, (-hx - .15, y, h), (hx + .15, y, h + rng.gauss(0, .01)), .04, 6, wob=.008, segs=6)
    for k in range(11): x = -hx + .5 * k; pole(P['pole'], rng, (x, -hy - .06, h + .03), (x, hy + .06, h + .03), .02, 4, wob=.004, segs=2)
    quad(P['net'], [(-hx - .1, -hy - .04, h + .055), (hx + .1, -hy - .04, h + .055), (hx + .1, hy + .04, h + .055), (-hx - .1, hy + .04, h + .055)], (1, 1, 1, 1), uv=8)
    quad(P['net'], [(-hx - .1, hy + .04, h + .053), (hx + .1, hy + .04, h + .053), (hx + .1, -hy - .04, h + .053), (-hx - .1, -hy - .04, h + .053)], (1, 1, 1, 1), uv=8)
    for y in (-hy - .04, hy + .04):                                                  # net skirt
        p = [(-hx - .1, y, h + .055), (hx + .1, y, h + .055), (hx + .1, y, h - .15), (-hx - .1, y, h - .15)]
        quad(P['net'], p if y < 0 else [p[1], p[0], p[3], p[2]], (1, 1, 1, 1), uv=8)
    nx, ny = 40, 8; grid = []; o = V(rng.random() * 30, 1, 1)
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            x = -hx + .12 + (L - .24) * i / nx; y = -hy + .1 + (Wd - .2) * j / ny; yy = 2 * y / (Wd - .2)
            z = h + .06 + .03 * (1 - yy ** 4) + .006 * mnoise.noise(o + V(x * 6, y * 6, 0))
            row.append(P['coffee_dry'].add((x, y, z), (x / .8, y / .8), tint(rng, (1, 1, 1, 1), .03)))
        grid.append(row)
    for i in range(nx):
        for j in range(ny): P['coffee_dry'].face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    # hoops (galvanised pipe) springing from the outer posts, plastic sheet sagging between them, roped down
    ry, rz0, rzh = hy + .12, h + .06, .95
    arc = lambda x, a, dr=0: V(x, -math.cos(a) * (ry + dr), rz0 + math.sin(a) * (rzh + dr))
    for x in xs: rod(P['steel'], [arc(x, a) for a in np.linspace(0, math.pi, 17)], .013, (.7, .72, .74, 1), 6)
    na, nx2 = 18, 48; sg = []
    for i in range(nx2 + 1):
        x = -hx - .2 + (L + .4) * i / nx2; f = ((x + hx) / (hx / 2)) % 1; sag = .035 * math.sin(math.pi * f) ** 2 if -hx < x < hx else .02
        row = []
        for j in range(na + 1):
            a = math.pi * j / na; dr = .02 - sag * math.sin(a) + .006 * mnoise.noise(V(x * 3, a * 2, 9))
            row.append(P['clear'].add(arc(x, a, dr), (x, a), (.62, .68, .72, 1)))
        sg.append(row)
    for i in range(nx2):
        for j in range(na): P['clear'].face((sg[i][j], sg[i + 1][j], sg[i + 1][j + 1], sg[i][j + 1]))
    for sy in (0, math.pi):                                                          # rolled sheet edges
        rod(P['plastic'], [arc(-hx - .2 + (L + .4) * t, sy, .02) for t in (0, .5, 1)], .018, (.85, .88, .9, 1), 6)
    for k in range(4):
        x = -hx + hx / 4 + k * hx / 2
        rod(P['plastic'], [arc(x, a, .04) for a in np.linspace(0, math.pi, 15)], .005, (.75, .62, .3, 1), 4)
        for sy, a in ((-1, 0), (1, math.pi)): rod(P['plastic'], [arc(x, a, .04), V(x, sy * (hy + .2), .02)], .004, (.75, .62, .3, 1), 4)
    for _ in range(30):
        cherry(P['cherry'], (rng.uniform(-hx, hx), rng.choice((-1, 1)) * rng.uniform(hy + .1, hy + .5), 0), rng, mix=COFFEE_MIX['dry'])
    return group('drying_rack_covered', P, M)

def sack_stack(seed=31):
    """21 stencilled 60 kg jute sacks, five layers on two pallets (crossed courses) + one dropped in front."""
    rng = random.Random(seed); M = hmats(); P = parts('wood', 'sack')
    def pallet(o):
        o = V(*o)
        for k in range(7): plank(P['wood'], o + V(-.45 + k * .15, 0, .132), (.10, 1.2, .022), tint(rng, (.95, .82, .62, 1), .06), uv=1)
        for y in (-.55, 0, .55):
            plank(P['wood'], o + V(0, y, .108), (1.0, .10, .024), tint(rng, (.9, .78, .6, 1), .05), uv=1)
            for x in (-.45, 0, .45): plank(P['wood'], o + V(x, y, .058), (.10, .10, .076), tint(rng, (.85, .72, .55, 1), .05), uv=1)
        for x in (-.45, 0, .45): plank(P['wood'], o + V(x, 0, .01), (.10, 1.2, .02), tint(rng, (.9, .78, .6, 1), .05), uv=1)
    n = 0
    for px in (-.56, .56):
        pallet((px, 0, 0)); z = .143
        for layer in range(5):
            for k in (-1, 1):
                if layer % 2 == 0: c, rz = V(px + k * .25, rng.uniform(-.02, .02), z), math.pi / 2
                else: c, rz = V(px + rng.uniform(-.02, .02), k * .28, z), 0.0
                sack(P['sack'], c, rng, .88, .5, .26, rz=rz + rng.uniform(-.04, .04), design=n % 2, squash=.92 if layer < 4 else 1.0); n += 1
            z = sack_top(V(0, 0, z), .26, .92) - .045
    sack(P['sack'], V(.15, -1.0, 0), rng, .88, .52, .26, rz=.25, design=1)
    return group('sack_stack', P, M)

HARVEST = {
    'back-basket': (back_basket, 'gùi'), 'winnow-tray': (winnow_tray, 'nia + thúng'), 'harvest-tarp': (harvest_tarp, 'bạt hứng'),
    'wheelbarrow': (wheelbarrow, 'xe rùa'), 'motorbike-sacks': (motorbike_sacks, 'xe máy chở bao'), 'farm-truck': (farm_truck, 'xe tải nhẹ'),
    'power-tiller-cart': (power_tiller_cart, 'xe công nông'), 'pulper-machine': (pulper_machine, 'máy xát vỏ'),
    'drying-yard': (drying_yard, 'sân phơi'), 'drying-rack-covered': (drying_rack_covered, 'giàn phơi có mái'), 'sack-stack': (sack_stack, 'đống bao'),
}
exports = {k: v[0] for k, v in HARVEST.items()}

# ───────────────────────────── QA preview ─────────────────────────────

def tri_count(root):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in root.children_recursive if o.type == 'MESH')

def bounds(root):
    pts = [o.matrix_world @ Vector(c) for o in root.children_recursive if o.type == 'MESH' for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])

def preview(root, path, close_dir=(-1, -1.25, 1.2), res=(960, 720)):
    """QA renders (Eevee; camera-backface culling exposes flipped faces), sun + sky, plain ground:
    <name>.png       close-up 3/4
    <name>_game.png  gameplay camera — perspective FOV 46° (vertical), pitch 34° down, 38 m away, 1080×1920 portrait,
                     with a 1.7 m red/white reference pole beside the model."""
    sc = bpy.context.scene; mn, mx = bounds(root); ctr = (mn + mx) / 2; rad = max((mx - mn).length / 2, .3)
    tmp = []
    gmb = MB(); s = 80; gmb.face([gmb.add(p, (0, 0), (.30, .26, .22, 1)) for p in ((-s, -s, -.001), (s, -s, -.001), (s, s, -.001), (-s, s, -.001))])
    g = gmb.build('qa_ground', material('qa_ground', None, .95)); sc.collection.objects.link(g); tmp.append(g)
    sun = bpy.data.lights.new('qa_sun', 'SUN'); sun.energy = 4.0; sun.angle = math.radians(3)
    so = bpy.data.objects.new('qa_sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(42), 0, math.radians(-35)); tmp.append(so)
    w = sc.world or bpy.data.worlds.new('qa_world'); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (.55, .68, .85, 1); bg.inputs[1].default_value = 1.0
    cam = bpy.data.cameras.new('qa_cam'); co = bpy.data.objects.new('qa_cam', cam); sc.collection.objects.link(co); tmp.append(co); sc.camera = co
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.film_transparent = False
    try: sc.eevee.taa_render_samples = 32
    except Exception: pass
    # (a) close-up 3/4
    cam.sensor_fit = 'AUTO'; cam.lens = 50; sc.render.resolution_x, sc.render.resolution_y = res
    d = Vector(close_dir).normalized(); co.location = ctr + d * (rad / math.tan(math.radians(13.5)) * 1.05)
    co.rotation_euler = (ctr - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    # (b) gameplay camera with a 1.7 m pole
    pmb = MB()
    for k in range(5): rod(pmb, [V(0, 0, 1.7 * k / 5), V(0, 0, 1.7 * (k + 1) / 5)], .035, (.7, .03, .03, 1) if k % 2 == 0 else (.9, .9, .9, 1), 8)
    po = pmb.build('qa_pole', material('qa_pole', None, .6)); sc.collection.objects.link(po); tmp.append(po)
    po.location = (mx.x + .6, ctr.y, 0)
    cam.sensor_fit = 'VERTICAL'; cam.angle = math.radians(46); sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    tgt = V(ctr.x + .3, ctr.y, max(0, ctr.z * .5)); pitch = math.radians(34)
    co.location = tgt + V(0, -math.cos(pitch) * 38, math.sin(pitch) * 38); co.rotation_euler = (math.pi / 2 - pitch, 0, 0)
    gp = path.replace('.png', '_game.png'); sc.render.filepath = gp; bpy.ops.render.render(write_still=True)
    for o in tmp: bpy.data.objects.remove(o, do_unlink=True)
    return [path, gp]

def export_harvest(out_dir, only=None, pv=None, views=None):
    rep = []
    for name, (fn, vn) in HARVEST.items():
        if only and name not in only: continue
        purge(); root = fn(); tris = tri_count(root); mn, mx = bounds(root)
        path = os.path.join(out_dir, f'{name}.glb'); export_glb(root.name, path)
        rep.append((name, vn, tuple(round(v, 2) for v in (mx - mn)), round(mn.z, 3), tris, os.path.getsize(path) // 1024))
        if pv:
            os.makedirs(pv, exist_ok=True)
            preview(root, os.path.join(pv, f'{name}.png'), *(views or ()))
    for r in rep: print('HARVEST', *r)
    return rep

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    pv = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    export_harvest(sys.argv[sys.argv.index('--export') + 1], only, pv)
