"""Gedeo (Ethiopia) farm buildings & props — procedural, regionally modelled, PBR with normal maps (Blender 5.x).

  tukul           round wattle-and-daub farmhouse: stone plinth, mud walls, eave poles + ring beam, 3-tier conical thatch, clay finial
  warehouse       coffee store: stone/concrete slab, timber frame, corrugated-iron walls + gable roof, double doors, sacks on a pallet
  drying_bed      raised "African bed" for natural process: eucalyptus poles, rails, cross sticks, mesh bed; fresh / drying / dry cherry layers
  water_tank      corrugated galvanised tank on a stone plinth, conical lid, tap, yellow jerrycans
  worker_shelter  open eucalyptus-pole shelter with thatched gable roof and a log bench
  coffee_sacks    jute sack stack on a pallet (reusable prop)

Shares mesh / texture helpers with gedeo_heroes.py. Headless export:
  Blender -b --factory-startup -P scripts/blender/gedeo_buildings.py -- --export public/models/gedeo
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1   # nesting depth: only the outermost script exports
exec(open(os.path.join(_here, 'gedeo_heroes.py')).read(), globals())
_GEDEO_LIB -= 1

# ───────────────────────────── textures: (colour, height) → colour + normal map ─────────────────────────────

def height_to_normal(h, k):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * .5 * k
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * .5 * k
    n = np.dstack([-dx, dy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    out = np.ones(h.shape + (4,), np.float32); out[..., :3] = n * .5 + .5; return out

_pairs = {}
def tex_pair(name, fn):
    """fn() -> (rgba, height, strength). Returns (colour image, normal image), both cached by name."""
    if name not in _pairs or _pairs[name][0].name not in bpy.data.images:
        res = {}
        def calc():
            if not res: res['v'] = fn()
            return res['v']
        col = to_image(f'T_{name}', lambda: calc()[0])
        nrm = to_image(f'N_{name}', lambda: height_to_normal(calc()[1], calc()[2]))
        _pairs[name] = (col, nrm)
    return _pairs[name]

def mix3(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]

def tex_thatch():
    rng = np.random.default_rng(101); H = W = 1024
    strands = fbm(H, W, 3, 110, 3, rng); coarse = fbm(H, W, 4, 8, 4, rng); clumps = fbm(H, W, 10, 24, 2, rng)
    h = strands * .65 + clumps * .35
    c = mix3(srgb((.27, .21, .14)), srgb((.70, .58, .38)), np.clip(h * 1.25 - .1, 0, 1))
    c = mix3(c, srgb((.48, .45, .41)), np.clip((coarse - .45) * 2.5, 0, .7))           # sun-bleached / grey weathering
    v = np.linspace(1, 0, H)[:, None]
    tips = vnoise(H, W, 1, 180, rng)
    a = np.ones((H, W), np.float32)
    a *= (v > .13 * (1 - tips) ** 1.5).astype(np.float32)                             # ragged straw fringe at the eave
    c *= (.7 + .3 * np.clip(v / .15, 0, 1))[..., None]                                 # darker cut ends
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1); out[..., 3] = a
    return out, h, 6.0

def tex_mud():
    rng = np.random.default_rng(102); H = W = 1024
    n = fbm(H, W, 4, 4, 5, rng); patches = fbm(H, W, 3, 3, 3, rng); r = fbm(H, W, 5, 5, 4, rng); r2 = fbm(H, W, 3, 3, 3, rng)
    crack = np.clip(1 - np.abs(r - .5) * 70, 0, 1) * (r2 > .5)
    c = mix3(srgb((.40, .30, .21)), srgb((.55, .44, .33)), np.clip(n * 1.4 - .2, 0, 1))
    c = mix3(c, srgb((.70, .60, .48)), np.clip((patches - .6) * 3, 0, .6))              # dried lighter plaster
    v = np.linspace(1, 0, H)[:, None]
    c = mix3(c, srgb((.34, .21, .14)), np.clip((.16 - v) * 8, 0, 1) * (.6 + .4 * n))   # rain-splash red earth band
    c *= (1 - .55 * crack)[..., None]
    # straw fibres in the daub
    cv = Canvas(W, H); cv.a[..., :3] = c; cv.a[..., 3] = 1
    prng = random.Random(7)
    for _ in range(700):
        x, y = prng.random() * W, prng.random() * H; a_ = prng.random() * math.pi; L = prng.uniform(6, 18)
        cv.line(x, y, x + math.cos(a_) * L, y + math.sin(a_) * L, 1.2, (.66, .56, .38))
    h = n * .8 - crack * .4 + patches * .2
    cv.a[..., :3] = np.clip(cv.a[..., :3], 0, 1); return cv.a, h, 5.0

def tex_stone():
    rng = np.random.default_rng(103); H = W = 512; npt = 46
    pts = rng.random((npt, 2)); tone = rng.uniform(.75, 1.15, npt)
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32); X /= W; Y /= H
    d1 = np.full((H, W), 9.0, np.float32); d2 = np.full((H, W), 9.0, np.float32); idx = np.zeros((H, W), np.int32)
    for i, (px, py) in enumerate(pts):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.hypot((X - px - ox) * 1.0, (Y - py - oy) * 1.6)
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d)); idx = np.where(closer, i, idx); d1 = np.where(closer, d, d1)
    edge = d2 - d1
    stone = np.clip(edge * 70 - .5, 0, 1)
    n = fbm(H, W, 8, 8, 4, rng)
    sc = srgb((.37, .34, .30)) * tone[idx][..., None] * (.75 + .45 * n[..., None])
    mortar = srgb((.26, .19, .14)) * (.8 + .3 * n[..., None])
    c = mix3(mortar, sc, stone)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, stone * (.6 + .4 * np.clip(edge * 6, 0, 1)) + n * .2, 7.0

def tex_wood():
    rng = np.random.default_rng(104); H = W = 512
    grain = fbm(H, W, 2, 48, 4, rng); knots = fbm(H, W, 6, 6, 2, rng); boards = 5
    u = np.linspace(0, 1, W, endpoint=False)[None, :]
    board_id = (u * boards).astype(int); tone = rng.uniform(.8, 1.15, boards)[board_id]
    seam = np.clip(1 - np.abs((u * boards) % 1 - .0) * 40, 0, 1) + np.clip(1 - np.abs((u * boards) % 1 - 1) * 40, 0, 1)
    c = mix3(srgb((.30, .24, .18)), srgb((.55, .47, .37)), grain) * tone[..., None]
    c = mix3(c, srgb((.50, .49, .46)), np.clip((knots - .5) * 2, 0, .5))               # silver weathering
    c *= (1 - .6 * np.clip(seam, 0, 1))[..., None] if seam.ndim == 2 else (1 - .6 * np.clip(np.broadcast_to(seam, (H, W)), 0, 1))[..., None]
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, grain - np.broadcast_to(seam, (H, W)) * .5, 3.0

def tex_pole():
    rng = np.random.default_rng(105); H = W = 512   # eucalyptus pole: peeling bark strips over pale wood
    strips = fbm(H, W, 3, 14, 4, rng); fine = fbm(H, W, 2, 60, 3, rng)
    peel = np.clip((strips - .52) * 6, 0, 1)
    c = mix3(srgb((.42, .34, .26)) * (.8 + .4 * fine[..., None]), srgb((.68, .60, .48)) * (.85 + .3 * fine[..., None]), peel)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, peel * .6 + fine * .4, 3.0

def tex_corrugated():
    rng = np.random.default_rng(106); H = W = 1024; ncorr = 16
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(1, 0, H)[:, None]
    wave = (np.sin(u * TAU * ncorr) + 1) * .5
    n = fbm(H, W, 6, 6, 4, rng); streak = fbm(H, W, 1, 48, 3, rng); blot = fbm(H, W, 5, 5, 4, rng)
    zinc = srgb((.58, .60, .61)) * (.82 + .3 * n[..., None]) * (.9 + .12 * wave[..., None])
    rust_m = np.clip((blot + .35 * (np.clip(.15 - v, 0, 1) + np.clip(v - .88, 0, 1)) * 4 + streak * .25 - .82) * 4, 0, 1)
    rust = mix3(srgb((.45, .22, .10)), srgb((.30, .16, .09)), n)
    c = mix3(zinc, rust, rust_m)
    c *= (1 - .25 * np.clip((streak - .55) * 4, 0, 1) * np.clip(v * 1.2, 0, 1))[..., None]   # dirty run-off streaks
    nails = np.zeros((H, W), np.float32)
    for vy in (.06, .94):
        for k in range(ncorr):
            cx, cy = (k + .25) / ncorr * W, (1 - vy) * H
            Y, X = np.ogrid[0:H, 0:W]
            nails += np.clip(1 - np.hypot(X - cx, Y - cy) / 4.5, 0, 1)
    c *= (1 - .6 * np.clip(nails, 0, 1))[..., None]
    seam = np.clip(1 - np.minimum(u, 1 - u) * W / 3, 0, 1); c *= (1 - .4 * np.broadcast_to(seam, (H, W)))[..., None]
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, np.broadcast_to(wave, (H, W)) * 1.0 + nails * .2, 14.0

DRY_CELLS = [(0, 2 / 3, 1, 1), (0, 1 / 3, 1, 2 / 3), (0, 0, 1, 1 / 3)]  # fresh red / drying (raisin) / dry (husk)
def tex_cherry_layer():
    rng = random.Random(107); W, H = 1024, 1536; cv = Canvas(W, H, (.20, .12, .08, 1)); hgt = np.zeros((H, W), np.float32)
    mixes = [[((.62, .05, .05), .55), ((.45, .03, .05), .2), ((.80, .25, .06), .12), ((.40, .50, .12), .13)],
             [((.40, .06, .07), .4), ((.30, .08, .07), .3), ((.55, .18, .08), .15), ((.22, .12, .08), .15)],
             [((.24, .14, .09), .5), ((.18, .10, .07), .3), ((.33, .22, .14), .2)]]
    for cell, mix in zip(DRY_CELLS, mixes):
        x0, y0, x1, y1 = cell_px(cell, W, H); r0 = 7.5 if mix is not mixes[2] else 6.2
        for _ in range(int((x1 - x0) * (y1 - y0) / (r0 * r0 * 2.2))):
            x, y = rng.uniform(x0, x1), rng.uniform(y0 + 4, y1 - 4); r = rng.random(); acc = 0
            for col, p in mix:
                acc += p
                if r <= acc: break
            col = np.array(col) * rng.uniform(.8, 1.15)
            rr = r0 * rng.uniform(.85, 1.15)
            cv.ellipse(x, y, rr, rr * rng.uniform(.75, .95), rng.random() * math.pi, col, shade=.6)
    lum = cv.a[..., :3].mean(2)
    return cv.a, lum, 4.0

def tex_jute():
    rng = np.random.default_rng(108); H = W = 512
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    weave = (np.sin(u * TAU * 90) * np.sin(v * TAU * 90) + 1) * .5
    n = fbm(H, W, 6, 6, 4, rng)
    c = srgb((.60, .48, .31)) * (.75 + .25 * weave[..., None]) * (.85 + .3 * n[..., None])
    band = (np.abs(v - .5) < .03) & (np.abs(u - .25) < .12)                             # faded stencil mark on one face
    c = np.where(np.broadcast_to(band, (H, W))[..., None], c * srgb((.62, .78, .62)), c)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, weave * .7 + n * .3, 3.0

def mats():
    """Shared building materials (created once per Blender session, reused by name)."""
    th, thn = tex_pair('thatch', tex_thatch); md, mdn = tex_pair('mud', tex_mud); st, stn = tex_pair('stone', tex_stone)
    wd, wdn = tex_pair('wood', tex_wood); pl, pln = tex_pair('pole', tex_pole); co, con = tex_pair('corrugated', tex_corrugated)
    ch, chn = tex_pair('cherry_layer', tex_cherry_layer); ju, jun = tex_pair('jute', tex_jute)
    M = {
        'thatch': material('gb_thatch', th, .95, alpha=True, two_sided=True, normal=thn, spec=.25),
        'mud': material('gb_mud', md, .95, normal=mdn, spec=.3),
        'stone': material('gb_stone', st, .9, normal=stn, spec=.3),
        'wood': material('gb_wood', wd, .85, normal=wdn, spec=.3),
        'pole': material('gb_pole', pl, .85, normal=pln, spec=.3),
        'metal': material('gb_corrugated', co, .45, two_sided=True, normal=con, spec=.6),
        'cherries': material('gb_cherry_layer', ch, .55, normal=chn, spec=.45),
        'jute': material('gb_jute', ju, .95, normal=jun, spec=.2),
        'plain': material('gb_plain', None, .6),
    }
    bsdf = next(n for n in M['metal'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bsdf.inputs['Metallic'].default_value = .2
    return M

# ───────────────────────────── geometry helpers ─────────────────────────────

def lathe(mb, prof, segs, col=(1, 1, 1, 1), a0=0.0, a1=TAU, u_len=2.0, v_len=2.0, v_off=0.0, wobble=None, center=(0, 0, 0), swap_uv=False, close_v=False):
    """Surface of revolution. prof: [(r, z)] — bottom→top gives outward normals. UVs in metres / (u_len, v_len)."""
    C = Vector(center); rings = []; vacc = 0; rref = max(r for r, _ in prof)
    tot = sum(math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]) for i in range(1, len(prof)))
    for i, (r, z) in enumerate(prof):
        if i: vacc += math.hypot(r - prof[i - 1][0], z - prof[i - 1][1])
        ring = []
        for j in range(segs + 1):
            a = a0 + (a1 - a0) * j / segs; rr = r * (1 + (wobble(a, z) if wobble else 0))
            u = (a - a0) * rref / u_len; v = (vacc / tot if close_v else vacc / v_len) + v_off
            ring.append(mb.add(C + Vector((math.cos(a) * rr, math.sin(a) * rr, z)), (v, u) if swap_uv else (u, v), col))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for j in range(segs): mb.face((rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]))
    return rings

def quad(mb, pts, col=(1, 1, 1, 1), uv=1.0, both=False):
    """Planar quad (CCW from the visible side). UVs: world metres along edge 0→1 and 0→3, scaled by uv."""
    p = [Vector(q) for q in pts]; e1 = (p[1] - p[0]); e2 = (p[3] - p[0]); l1 = e1.length; e1n = e1 / max(l1, 1e-6)
    def uvof(q): d = q - p[0]; return (d.dot(e1n) * uv, (d - e1n * d.dot(e1n)).length * uv * (1 if d.dot(e2) >= 0 else -1))
    ids = [mb.add(q, uvof(q), col) for q in p]; mb.face(ids)
    if both: mb.face(ids[::-1])

def tri(mb, pts, col=(1, 1, 1, 1), uv=1.0):
    p = [Vector(q) for q in pts]; e1 = (p[1] - p[0]).normalized()
    ids = [mb.add(q, ((q - p[0]).dot(e1) * uv, ((q - p[0]) - e1 * (q - p[0]).dot(e1)).length * uv), col) for q in p]; mb.face(ids)

def box(mb, c, s, col=(1, 1, 1, 1), uv=1.0, rz=0.0):
    c = Vector(c); hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2; R = Matrix.Rotation(rz, 3, 'Z')
    P = lambda x, y, z: c + R @ Vector((x * hx, y * hy, z * hz))
    for f in [[(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)], [(-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)],
              [(1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)], [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)],
              [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)], [(-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)]]:
        quad(mb, [P(*q) for q in f], col, uv)

def pole(mb, rng, a, b, r, sides=6, col=(1, 1, 1, 1), wob=.02, segs=4):
    a, b = Vector(a), Vector(b); d = b - a
    pts = [a + d * (i / segs) + (rnd_unit(rng) * wob * (0 < i < segs)) for i in range(segs + 1)]
    tube(mb, pts, [r * (1 - .15 * i / segs) for i in range(segs + 1)], sides, col=col, v_scale=1 / (TAU * r * 4), cap=True)

def superellipsoid(mb, c, s, col=(1, 1, 1, 1), e=.35, seg=10, rings=6, rz=0.0, sag=0.0, uv_scale=(1, 1)):
    c = Vector(c); R = Matrix.Rotation(rz, 3, 'Z'); sp = lambda x: math.copysign(abs(x) ** e, x)
    grid = []
    for i in range(rings + 1):
        th = -math.pi / 2 + math.pi * i / rings; row = []
        for j in range(seg + 1):
            ph = TAU * j / seg
            x = sp(math.cos(th)) * sp(math.cos(ph)) * s[0] / 2; y = sp(math.cos(th)) * sp(math.sin(ph)) * s[1] / 2; z = sp(math.sin(th)) * s[2] / 2
            z -= sag * (1 - (2 * x / s[0]) ** 2) * (z > 0) * s[2]
            row.append(mb.add(c + R @ Vector((x, y, z)), (j / seg * uv_scale[0], i / rings * uv_scale[1]), col))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))

from mathutils import Matrix

def finish(name, parts, M):
    """parts: {material key: MB} → objects (one per material)."""
    return [mb.build(f'{name}_{k}', M[k]) for k, mb in parts.items() if mb.f]

# ───────────────────────────── buildings ─────────────────────────────

def tukul(seed=1, lod=0):
    """Gedeo round farmhouse (~7.5 m across the eaves, 5.6 m to the finial)."""
    rng = random.Random(seed); M = mats(); segs = 44 if lod == 0 else 22
    P = {k: MB() for k in ('stone', 'mud', 'wood', 'pole', 'thatch', 'plain')}
    R, t, wall_h, door_h, door_w = 3.0, .24, 2.3, 1.85, 1.0
    door_az = -math.pi / 2; gap = door_w / R; ph = rng.random() * TAU
    wob = lambda a, z: .012 * math.sin(3 * a + ph) + .008 * math.sin(7 * a + 2 * ph) + .004 * math.sin(z * 9 + a * 5)
    plinth = .32
    lathe(P['stone'], [(R + .16, 0), (R + .14, plinth), (R + .02, plinth + .03)], segs, u_len=1.4, v_len=1.4, wobble=wob)
    a0, a1 = door_az + gap / 2, door_az + TAU - gap / 2
    lathe(P['mud'], [(R, plinth), (R * .997, door_h)], segs, a0=a0, a1=a1, u_len=2.5, v_len=2.5, wobble=wob)
    lathe(P['mud'], [(R * .997, door_h), (R * .99, wall_h)], segs, u_len=2.5, v_len=2.5, v_off=(door_h - plinth) / 2.5, wobble=wob)
    lathe(P['mud'], [(R - t, door_h), (R - t, plinth)], segs, a0=a0, a1=a1, u_len=2.5, v_len=2.5, col=(.55, .5, .45, 1))
    lathe(P['mud'], [(R - t, wall_h), (R - t, door_h)], segs, u_len=2.5, v_len=2.5, col=(.55, .5, .45, 1))
    lathe(P['mud'], [(R * .99, wall_h), (R - t, wall_h)], segs, u_len=2.5, v_len=2.5, wobble=wob)
    lathe(P['mud'], [(R - t, plinth + .01), (.05, plinth + .01)], segs, u_len=2.5, v_len=2.5, col=(.45, .38, .32, 1))       # floor
    lathe(P['mud'], [(R - t, door_h), (R, door_h)], 4, a0=a1 - TAU, a1=a0, u_len=2.5, v_len=2.5)                            # door soffit (faces down)
    for aj, sgn in ((a0, 1), (a1, -1)):                                                                                       # jambs
        ca, sa = math.cos(aj), math.sin(aj); o = Vector((ca, sa, 0)); i_ = o * (R - t); o = o * R
        pts = [o + Vector((0, 0, plinth)), i_ + Vector((0, 0, plinth)), i_ + Vector((0, 0, door_h)), o + Vector((0, 0, door_h))]
        quad(P['mud'], pts if sgn < 0 else pts[::-1], uv=.4)
    # door: frame posts + lintel + plank leaf, slightly ajar
    dc = Vector((math.cos(door_az), math.sin(door_az), 0)); dt = Vector((-dc.y, dc.x, 0))
    for s_ in (-1, 1): box(P['wood'], dc * (R + .02) + dt * s_ * (door_w / 2 + .03) + Vector((0, 0, (plinth + door_h) / 2)), (.09, .12, door_h - plinth), uv=1, rz=math.atan2(dc.y, dc.x))
    box(P['wood'], dc * (R + .02) + Vector((0, 0, door_h + .05)), (.14, door_w + .3, .12), uv=1, rz=math.atan2(dc.y, dc.x))
    hinge = dc * (R - t * .5) + dt * (door_w / 2); ang = math.atan2(dc.y, dc.x) + math.radians(28)
    leaf_c = hinge + Vector((math.cos(ang + math.pi / 2), math.sin(ang + math.pi / 2), 0)) * -(door_w * .46) + Vector((0, 0, (plinth + door_h) / 2))
    box(P['wood'], leaf_c, (.05, door_w * .92, door_h - plinth - .05), uv=1.2, rz=ang)
    # eave poles + ring beam + rafters
    Rp, eave_z = R + .95, 2.12; npole = 12 if lod == 0 else 8
    for k in range(npole):
        a = door_az + gap * 1.2 + (TAU - gap * 2.4) * k / (npole - 1)
        base = Vector((math.cos(a) * Rp, math.sin(a) * Rp, 0)); pole(P['pole'], rng, base, base + Vector((rng.gauss(0, .04), rng.gauss(0, .04), eave_z)), .065, 6 if lod == 0 else 4)
    ring = [Vector((math.cos(TAU * k / 40) * Rp, math.sin(TAU * k / 40) * Rp, eave_z + .04)) for k in range(41)]
    tube(P['pole'], ring, [.07] * 41, 5, v_scale=.3)
    Re, z_e, apex = R + 1.35, 1.98, wall_h + 3.05
    zr = lambda r: z_e + (apex - z_e) * (1 - r / Re)
    if lod == 0:
        for k in range(18):
            a = TAU * k / 18; d = Vector((math.cos(a), math.sin(a), 0))
            pole(P['pole'], rng, d * (Re - .2) + Vector((0, 0, zr(Re - .2) - .14)), d * .15 + Vector((0, 0, apex - .25)), .04, 4, wob=.01, segs=2)
    # roof: soffit + three overlapping thatch tiers with ragged fringes
    lathe(P['thatch'], [(.2, apex - .3), (Re - .12, zr(Re - .12) - .12)], segs, u_len=1.2, v_len=1.2, v_off=.4, col=(.55, .5, .45, 1))
    tiers = [(Re, Re * .58), (Re * .70, Re * .30), (Re * .42, .02)]
    for ti, (r_lo, r_hi) in enumerate(tiers):
        lift = .14 * ti; prof = []
        for q in range(5):
            r = r_lo + (r_hi - r_lo) * q / 4; prof.append((r, zr(r) + lift + (.05 if q else -.06)))
        prof[0] = (r_lo + .08, prof[0][1] - .06)
        twob = lambda a, z, ph2=rng.random() * TAU: .015 * math.sin(5 * a + ph2) + .01 * math.sin(11 * a)
        lathe(P['thatch'], prof, segs + 8, u_len=1.2, close_v=True, wobble=twob, col=tint(rng, (1, 1, 1), .05))
    # finial: pole + clay pot
    tube(P['pole'], [Vector((0, 0, apex - .3)), Vector((0, 0, apex + .55))], [.05, .035], 6, cap=True)
    lathe(P['plain'], [(.02, apex + .2), (.13, apex + .23), (.17, apex + .33), (.11, apex + .45), (.08, apex + .5), (.1, apex + .53)], 12, col=(.55, .25, .14, 1))
    objs = finish('tukul', P, M)
    return objs, {'height': apex + .55, 'tris': sum(m.tris for m in P.values())}

def coffee_sacks(rng, P, origin, rz=0.0, layers=((3, 0), (2, .5))):
    o = Vector(origin); R = Matrix.Rotation(rz, 3, 'Z')
    # pallet
    for k in range(5): box(P['wood'], o + R @ Vector((0, -.5 + k * .25, .1)), (1.2, .1, .03), uv=1, rz=rz)
    for x in (-.55, 0, .55): box(P['wood'], o + R @ Vector((x, 0, .05)), (.1, 1.1, .08), uv=1, rz=rz)
    z = .12
    for n, off in layers:
        for k in range(n):
            c = o + R @ Vector(((k - (n - 1) / 2) * .40, rng.uniform(-.03, .03), z + .14))
            superellipsoid(P['jute'], c, (.40, .72, .30), e=.5, seg=10, rings=6, rz=rz + rng.uniform(-.08, .08), sag=.12, col=tint(rng, (1, 1, 1), .08))
        z += .24

def warehouse(seed=2, lod=0):
    """Coffee store: 8 × 5 m, corrugated iron on timber frame, stone-faced slab, double doors."""
    rng = random.Random(seed); M = mats()
    P = {k: MB() for k in ('stone', 'wood', 'metal', 'jute', 'plain')}
    L, Wd, slab, eave, ridge, ov = 8.0, 5.0, .38, 3.0, 4.3, .45
    box(P['stone'], (0, 0, slab / 2), (L + .5, Wd + .5, slab), uv=1 / 1.2)
    quad(P['plain'], [(-L / 2 - .2, -Wd / 2 - .2, slab + .005), (L / 2 + .2, -Wd / 2 - .2, slab + .005), (L / 2 + .2, Wd / 2 + .2, slab + .005), (-L / 2 - .2, Wd / 2 + .2, slab + .005)], (.36, .33, .30, 1))   # cement floor
    z0 = slab; hx, hy = L / 2, Wd / 2
    for x in (-hx, -hx / 2, 0, hx / 2, hx):
        for y in (-hy, hy): box(P['wood'], (x, y, z0 + (eave - z0) / 2), (.12, .12, eave - z0), uv=1)
    for x in (-hx, hx): box(P['wood'], (x, 0, z0 + (eave - z0) / 2), (.12, .12, eave - z0), uv=1)
    o = .07; tile = 1 / 1.2
    col = lambda: tint(rng, (1, 1, 1), .06)
    # long walls: back solid; front with a 2.4 × 2.5 m door opening
    quad(P['metal'], [(hx + o, hy + o, z0), (-hx - o, hy + o, z0), (-hx - o, hy + o, eave), (hx + o, hy + o, eave)], col(), tile)
    dw, dh = 2.4, 2.25; fy = -hy - o
    quad(P['metal'], [(-hx - o, fy, z0), (-dw / 2, fy, z0), (-dw / 2, fy, eave), (-hx - o, fy, eave)], col(), tile)
    quad(P['metal'], [(dw / 2, fy, z0), (hx + o, fy, z0), (hx + o, fy, eave), (dw / 2, fy, eave)], col(), tile)
    quad(P['metal'], [(-dw / 2, fy, z0 + dh), (dw / 2, fy, z0 + dh), (dw / 2, fy, eave), (-dw / 2, fy, eave)], col(), tile)
    # gable ends
    for sx in (-1, 1):
        x = sx * (hx + o); pts = [(x, -hy - o * sx * 0 - o, z0), (x, hy + o, z0), (x, hy + o, eave), (x, -hy - o, eave)]
        quad(P['metal'], pts if sx > 0 else [pts[1], pts[0], pts[3], pts[2]], col(), tile)
        g = [(x, -hy - o, eave), (x, hy + o, eave), (x, 0, ridge)]
        tri(P['metal'], g if sx > 0 else [g[1], g[0], g[2]], col(), tile)
    # door frame + leaves (left open, right closed)
    for s_ in (-1, 1): box(P['wood'], (s_ * (dw / 2 + .05), fy - .02, z0 + dh / 2), (.1, .12, dh), uv=1)
    box(P['wood'], (0, fy - .02, z0 + dh + .05), (dw + .2, .12, .1), uv=1)
    box(P['metal'], (dw / 4, fy - .05, z0 + dh / 2 - .02), (dw / 2 - .04, .04, dh - .08), col(), uv=tile)
    hingex = -dw / 2; a = math.radians(-70)
    box(P['metal'], (hingex + math.cos(a) * dw / 4, fy - .05 + math.sin(a) * dw / 4, z0 + dh / 2 - .02), (dw / 2 - .04, .04, dh - .08), col(), uv=tile, rz=a)
    # roof: two corrugated slopes with overhang, fascia boards, ridge cap
    for sy in (-1, 1):
        e = Vector((0, sy * (hy + ov), eave - ov * (ridge - eave) / hy)); rr = Vector((0, 0, ridge + .04))
        p = [(-hx - ov, e.y, e.z), (hx + ov, e.y, e.z), (hx + ov, 0, rr.z), (-hx - ov, 0, rr.z)]
        quad(P['metal'], p if sy < 0 else [p[1], p[0], p[3], p[2]], col(), tile)
        box(P['wood'], (0, e.y, e.z - .08), (L + 2 * ov, .04, .18), uv=1)
    for sy in (-1, 1):
        quad(P['metal'], [(-hx - ov, 0, ridge + .1), (hx + ov, 0, ridge + .1), (hx + ov, sy * .22, ridge + .02), (-hx - ov, sy * .22, ridge + .02)][::(1 if sy > 0 else -1)], (.8, .8, .8, 1), tile)
    coffee_sacks(rng, P, (-hx + 1.0, -hy - 1.1, slab), rz=.1)
    objs = finish('warehouse', P, M)
    return objs, {'height': ridge + .1, 'tris': sum(m.tris for m in P.values())}

def drying_bed(seed=3, lod=0, length=6.0, width=1.1):
    """Raised African drying bed. Emits three cherry-layer meshes (fresh / drying / dry) on the same bed for the game to toggle."""
    rng = random.Random(seed); M = mats()
    P = {k: MB() for k in ('pole', 'plain')}; layers = {k: MB() for k in ('fresh', 'drying', 'dry')}
    h = .95; hx, hy = length / 2, width / 2; sides = 6 if lod == 0 else 4
    nposts = int(length / 1.5) + 1
    for k in range(nposts):
        x = -hx + length * k / (nposts - 1)
        for y in (-hy, hy):
            pole(P['pole'], rng, (x + rng.gauss(0, .03), y * 1.05, 0), (x, y, h - .02), .045, sides)
    for y in (-hy, hy): pole(P['pole'], rng, (-hx - .15, y, h), (hx + .15, y, h + rng.gauss(0, .02)), .04, sides, wob=.01, segs=6)
    for k in range(int(length / .5) + 1):
        x = -hx + .5 * k; pole(P['pole'], rng, (x, -hy - .08, h + .03), (x, hy + .08, h + .03), .022, 4, wob=.005, segs=2)
    # shade-net skirt hanging under the rails
    for y in (-hy, hy):
        quad(P['plain'], [(-hx, y, h - .02), (hx, y, h - .02), (hx, y, h - .2), (-hx, y, h - .2)] if y > 0 else
             [(hx, y, h - .02), (-hx, y, h - .02), (-hx, y, h - .2), (hx, y, h - .2)], (.05, .06, .05, 1))
    nx, ny = (32, 6) if lod == 0 else (12, 3)
    for key, cell in zip(('fresh', 'drying', 'dry'), DRY_CELLS):
        mb = layers[key]; grid = []
        for i in range(nx + 1):
            row = []
            for j in range(ny + 1):
                x = -hx + length * i / nx; y = -hy + width * j / ny; yy = (2 * y / width)
                z = h + .06 + (.035 if key != 'dry' else .02) * (1 - yy ** 4) - .02 * abs(math.sin(math.pi * (i / nx) * (nposts - 1)))
                z += rng.uniform(-.004, .004)
                u0, v0, u1, v1 = cell
                row.append(mb.add((x, y, z), (x / 1.0, v0 + (v1 - v0) * (j / ny)), tint(rng, (1, 1, 1), .03)))
            grid.append(row)
        for i in range(nx):
            for j in range(ny): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    objs = finish('drying_bed', P, M) + [layers[k].build(f'drying_bed_cherries_{k}', M['cherries']) for k in layers]
    return objs, {'height': h + .1, 'tris': sum(m.tris for m in P.values()) + layers['fresh'].tris}

def water_tank(seed=4, lod=0):
    rng = random.Random(seed); M = mats(); P = {k: MB() for k in ('stone', 'metal', 'plain')}; segs = 32 if lod == 0 else 16
    box(P['stone'], (0, 0, .3), (2.5, 2.5, .6), uv=1 / 1.2)
    Rt, z0, z1 = 1.0, .6, 2.45
    lathe(P['metal'], [(Rt, z0), (Rt, z1)], segs, u_len=1.2, v_len=1.2, swap_uv=True, col=tint(rng, (1, 1, 1), .05))
    lathe(P['metal'], [(Rt + .03, z1), (.08, z1 + .38)], segs, u_len=1.2, v_len=1.2, col=(.92, .92, .92, 1))
    box(P['metal'], (.3, 0, z1 + .3), (.4, .4, .06), (.85, .85, .85, 1), uv=1)
    pipe = [Vector((Rt - .02, 0, .9)), Vector((Rt + .25, 0, .9)), Vector((Rt + .32, 0, .82)), Vector((Rt + .34, 0, .72))]
    tube(P['plain'], pipe, [.03] * 4, 6, col=(.18, .2, .22, 1))
    box(P['plain'], (Rt + .34, 0, .95), (.05, .12, .05), (.65, .1, .08, 1))
    for k, (x, y, rz) in enumerate([(1.55, .45, .3), (1.6, -.15, -.2)]):   # yellow jerrycans
        superellipsoid(P['plain'], (x, y, .23), (.17, .35, .44), e=.18, seg=12, rings=8, rz=rz, col=(.95, .72, .06, 1))
        tube(P['plain'], [Vector((x, y, .47)) + Matrix.Rotation(rz, 3, 'Z') @ Vector((0, s_, 0)) for s_ in (-.08, 0, .08)], [.015] * 3, 4, col=(.9, .68, .05, 1))
        tube(P['plain'], [Vector((x, y, .45)) + Matrix.Rotation(rz, 3, 'Z') @ Vector((0, .13, 0)), Vector((x, y, .5)) + Matrix.Rotation(rz, 3, 'Z') @ Vector((0, .13, 0))], [.03, .03], 6, col=(.2, .4, .15, 1), cap=True)
    objs = finish('water_tank', P, M)
    return objs, {'height': z1 + .4, 'tris': sum(m.tris for m in P.values())}

def worker_shelter(seed=5, lod=0):
    rng = random.Random(seed); M = mats(); P = {k: MB() for k in ('pole', 'thatch', 'wood')}
    hx, hy, eave, ridge = 2.2, 1.6, 2.1, 3.2; sides = 6 if lod == 0 else 4
    for x in (-hx, 0, hx):
        for y in (-hy, hy): pole(P['pole'], rng, (x, y, 0), (x, y, eave), .07, sides)
        pole(P['pole'], rng, (x, 0, 0) if x != 0 else (x, 0, eave - .1), (x, 0, ridge), .06, sides) if x != 0 else None
    for y in (-hy, hy): pole(P['pole'], rng, (-hx - .3, y, eave), (hx + .3, y, eave), .06, sides, wob=.01)
    pole(P['pole'], rng, (-hx - .3, 0, ridge), (hx + .3, 0, ridge), .06, sides, wob=.01)
    ov = .55
    for sy in (-1, 1):
        ez = eave - ov * (ridge - eave) / hy
        for layer in range(2):
            lift = .12 * layer; fr = .55 * layer
            e_y = sy * (hy + ov) * (1 - fr) ; e_z = ridge - (ridge - ez) * (1 - fr)
            p = [(-hx - .5, e_y, e_z + lift), (hx + .5, e_y, e_z + lift), (hx + .5, 0, ridge + .08 + lift), (-hx - .5, 0, ridge + .08 + lift)]
            ids = [P['thatch'].add(Vector(q), uv, tint(rng, (1, 1, 1), .04)) for q, uv in zip(p, [(0, 0), (5.2 / 1.2, 0), (5.2 / 1.2, 1), (0, 1)])]
            P['thatch'].face(ids if sy < 0 else [ids[1], ids[0], ids[3], ids[2]])
    pole(P['wood'], rng, (-1.4, .9, .45), (1.4, .9, .45), .16, 8, wob=.01, segs=3)                 # log bench
    for x in (-1.1, 1.1): box(P['wood'], (x, .9, .2), (.12, .3, .4), uv=1)
    objs = finish('worker_shelter', P, M)
    return objs, {'height': ridge + .3, 'tris': sum(m.tris for m in P.values())}

def sacks_prop(seed=6, lod=0):
    rng = random.Random(seed); M = mats(); P = {k: MB() for k in ('wood', 'jute')}
    coffee_sacks(rng, P, (0, 0, 0), 0, layers=((3, 0), (3, 0), (2, 0)))
    objs = finish('coffee_sacks', P, M)
    return objs, {'height': .9, 'tris': sum(m.tris for m in P.values())}

BUILDINGS = {
    'tukul_farmhouse': (tukul, {'seed': 1}),
    'coffee_warehouse': (warehouse, {'seed': 2}),
    'drying_bed': (drying_bed, {'seed': 3}),
    'water_tank': (water_tank, {'seed': 4}),
    'worker_shelter': (worker_shelter, {'seed': 5}),
    'coffee_sacks': (sacks_prop, {'seed': 6}),
}
BUILDING_LODS = {'tukul_farmhouse': (0, 1), 'drying_bed': (0, 1)}

def build_building(key, lod=0, location=(0, 0, 0), rz=0.0):
    fn, kw = BUILDINGS[key]; objs, info = fn(lod=lod, **kw)
    sc = bpy.context.scene; root = bpy.data.objects.new(f'{key}_LOD{lod}', None); sc.collection.objects.link(root)
    root.location = location; root.rotation_euler = (0, 0, rz)
    for o in objs: sc.collection.objects.link(o); o.parent = root
    info['root'] = root.name; return root, info

def export_buildings(out_dir, only=None):
    report = {}
    for key in BUILDINGS:
        if only and key not in only: continue
        for lod in BUILDING_LODS.get(key, (0,)):
            purge()
            root, info = build_building(key, lod)
            export_glb(root.name, os.path.join(out_dir, f'{key.replace("_", "-")}-lod{lod}.glb')); report[f'{key}_lod{lod}'] = info
    for k, v in report.items(): print(k, v)

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_buildings(sys.argv[sys.argv.index('--export') + 1], only)
