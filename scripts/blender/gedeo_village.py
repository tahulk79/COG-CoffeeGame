"""Village & market set — Central Highlands / Gedeo mountain coffee farm (Blender 5.x, procedural, PBR + normal maps).

  stilt_house     nhà sàn: 10 × 5 m platform raised 1.8 m on round posts over stone pads, plank floor + lap-board walls,
                  woven-bamboo gables, steep 7-course thatch with ridge roll + crossed ridge sticks + gable horns,
                  front veranda with slat railing, notched-log ladder (crescent top), firewood stacks + rice mortar below
  wooden_house    nhà gỗ: 8 × 6 m plank house on dry-stone piers, corrugated-iron roof with rust (geometric sheets),
                  porch lean-to on posts + knee braces, railing, steps, bench, open window shutters, door ajar
  wood_kitchen    bếp củi: open pole hut, smoke-stained thatch, three-stone fire with embers + flames, blackened pot,
                  clay stove with kettle, smoke-drying rack (gác bếp) with corn, firewood pile, stools
  market_stall    sạp chợ phiên: 3 × 2 m lashed bamboo frame, striped tarp roof, plank table, woven trays of roasted /
                  green beans + cherries, dial scale, open jute sacks
  farm_gate_sign  cổng trang trại: 2 timber posts on stone plinths, upswept crossbeam, tie beam + knee braces, carved sign
                  board; node "sign_face" (material "sign_face", plain light wood, UV 0–1) takes the farm name texture
  tier_sign       biển tên tầng: 1.6 m post sign with a chamfered board; node "sign_face" (same convention)
  lantern_string  dây đèn lồng: 6 ribbed red paper lanterns with tassels on a sagging rope between two bamboo poles
  flag_pole       cột cờ đuôi nheo: bamboo pole, guy line to a stake carrying 3 curved triangular cloth pennants

Real-world metres, origin at ground / base centre, fronts face -Y (Blender z-up; the exporter makes y-up).
Headless export (one GLB each → <dir>/<name>.glb, names hyphenated):
  Blender -b --factory-startup -P scripts/blender/gedeo_village.py -- --export public/models/gedeo [--only stilt-house,tier-sign]
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_environment.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import noise as mnoise

WHITE = (1, 1, 1, 1)

# ───────────────────────────── textures ─────────────────────────────

def tex_plank():
    """Weathered sawn hardwood board; grain runs along u (planks are geometry, tinted per board)."""
    rng = np.random.default_rng(601); H = W = 512
    grain = fbm(H, W, 56, 3, 4, rng); fib = fbm(H, W, 160, 6, 2, rng); weather = fbm(H, W, 5, 3, 3, rng)
    crack = np.clip(1 - np.abs(fbm(H, W, 18, 2, 3, rng) - .5) * 70, 0, 1) * (fbm(H, W, 4, 4, 2, rng) > .58)
    c = mix3(srgb((.20, .14, .10)), srgb((.47, .36, .26)), np.clip(grain * 1.5 - .25, 0, 1))
    c *= (.88 + .24 * fib)[..., None]
    c = mix3(c, srgb((.50, .48, .44)), np.clip((weather - .5) * 2.2, 0, .55))         # silver-grey sun weathering
    cv = Canvas(W, H); cv.a[..., :3] = c; cv.a[..., 3] = 1
    prng = random.Random(61)
    for _ in range(5):                                                                 # knots with a darker halo
        x, y = prng.uniform(30, W - 30), prng.uniform(20, H - 20); r = prng.uniform(5, 10)
        cv.ellipse(x, y, r * 2.6, r * 1.3, 0, (.30, .22, .15), shade=.2)
        cv.ellipse(x, y, r, r * .7, 0, (.13, .09, .06), shade=.4)
    out = cv.a.copy(); out[..., :3] = np.clip(out[..., :3] * (1 - .6 * crack)[..., None], 0, 1)
    return out, grain * .6 + fib * .3 - crack * .7, 4.0

def tex_bamboo():
    """Dry bamboo culm: straw-yellow with green tinge, fine streaks, dark node rings with a waxy band (2 nodes per tile)."""
    rng = np.random.default_rng(602); H, W = 1024, 256
    v = np.linspace(1, 0, H, endpoint=False)[:, None]
    streak = fbm(H, W, 4, 48, 3, rng); blot = fbm(H, W, 6, 3, 3, rng); spot = vnoise(H, W, 90, 30, rng)
    c = mix3(srgb((.55, .45, .25)), srgb((.78, .68, .42)), streak)
    c = mix3(c, srgb((.46, .52, .24)), np.clip((blot - .55) * 2.5, 0, .45))
    c = mix3(c, srgb((.30, .24, .15)), np.clip((spot - .9) * 8, 0, .8))
    d = np.minimum(np.abs(v - .25), np.abs(v - .75))
    ring = np.broadcast_to(np.exp(-(d / .006) ** 2), (H, W)); wax = np.broadcast_to(np.exp(-((np.minimum(np.abs(v - .23), np.abs(v - .73))) / .012) ** 2), (H, W))
    c = mix3(c, srgb((.30, .22, .12)), ring * .85); c = mix3(c, srgb((.84, .82, .72)), wax * .35)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, streak * .3 + ring, 4.0

def tex_tarp():
    """Market tarp (bạt sọc): woven poly, blue / white / red stripes, sun-faded with dirt."""
    rng = np.random.default_rng(603); H = W = 512
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    weave = (np.sin(u * TAU * 128) * np.sin(v * TAU * 128) + 1) * .5
    k = (u * 6) % 1
    blue, white, red = srgb((.10, .28, .58)), srgb((.86, .86, .82)), srgb((.70, .13, .10))
    col = np.where((k < .45)[..., None], blue, np.where((k < .55)[..., None], white, np.where((k < .9)[..., None], red, white)))
    col = np.broadcast_to(col, (H, W, 3)).copy()
    fade = fbm(H, W, 4, 4, 3, rng); dirt = fbm(H, W, 6, 2, 3, rng)
    col = mix3(col, srgb((.70, .70, .66)), np.clip((fade - .45) * 1.2, 0, .35))
    col *= (.86 + .14 * weave)[..., None] * (1 - .25 * np.clip((dirt - .55) * 3, 0, 1))[..., None]
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(col, 0, 1)
    return out, weave * .6 + fade * .4, 2.0

def tex_weave():
    """Plain-weave split bamboo (phên / nia): over-under strips with dark gaps."""
    rng = np.random.default_rng(604); H = W = 512; N = 16
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32); a = X / W * N; b = Y / H * N
    fa, fb = a % 1, b % 1; ia, ib = a.astype(int), b.astype(int)
    pa = np.clip((.5 - np.abs(fa - .5)) * 8, 0, 1); pb = np.clip((.5 - np.abs(fb - .5)) * 8, 0, 1)
    over = ((ia + ib) % 2 == 0)
    sa = np.sin(fb * math.pi) * .3 + .7; sb = np.sin(fa * math.pi) * .3 + .7          # strips arch over each other
    hA = pa * np.where(over, sa, .55); hB = pb * np.where(~over, sb, .55)
    h = np.maximum(hA, hB); useA = hA >= hB
    ta = rng.uniform(.8, 1.15, N + 1)[ia % N]; tb = rng.uniform(.8, 1.15, N + 1)[ib % N]
    grain = fbm(H, W, 3, 60, 2, rng) * useA + fbm(H, W, 60, 3, 2, rng) * (~useA)
    tone = np.where(useA, ta, tb) * (.85 + .3 * grain)
    c = srgb((.70, .57, .36))[None, None, :] * tone[..., None] * (.55 + .45 * h[..., None])
    c = mix3(srgb((.14, .10, .07)) * np.ones((H, W, 1), np.float32), c, np.clip(h * 3, 0, 1))
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, h, 5.0

def tex_beans():
    """Coffee beans en masse (neutral beige, tinted roasted / green per mesh). Tile ≈ 0.37 m."""
    rng = random.Random(605); W = H = 512; cv = Canvas(W, H, (.16, .13, .10, 1))
    for _ in range(2400):
        x, y = rng.random() * W, rng.random() * H; a = rng.random() * math.pi; rx = rng.uniform(6.5, 8.2); ry = rx * .7
        col = np.array((.86, .80, .70)) * rng.uniform(.75, 1.1); ca, sa = math.cos(a), math.sin(a)
        for ox in ((0, W, -W) if (x < 12 or x > W - 12) else (0,)):
            for oy in ((0, H, -H) if (y < 12 or y > H - 12) else (0,)):
                cv.ellipse(x + ox, y + oy, rx, ry, a, col, shade=.7)
                cv.line(x + ox - ca * rx * .7, y + oy - sa * rx * .7, x + ox + ca * rx * .7, y + oy + sa * rx * .7, 1.3, col * .42)
    return cv.a, cv.a[..., :3].mean(2), 4.0

def tex_cloth():
    """Plain cotton / paper: fine weave, soft blotches, near white (tinted by vertex colour)."""
    rng = np.random.default_rng(606); H = W = 256
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    weave = (np.sin(u * TAU * 64) * np.sin(v * TAU * 64) + 1) * .5; blot = fbm(H, W, 4, 4, 3, rng); fib = fbm(H, W, 40, 40, 2, rng)
    c = (.84 + .1 * weave + .08 * (fib - .5) - .1 * np.clip((blot - .55) * 2, 0, 1))[..., None] * np.array([1, .98, .94])
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, weave * .5 + blot * .5, 2.0

def tex_rust_iron():
    """Old corrugated iron sheet (one sheet across u, 12 corrugations), heavy rust from the eave, run-off streaks, nails."""
    rng = np.random.default_rng(607); H = W = 512; ncorr = 12
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(1, 0, H)[:, None]
    wave = np.broadcast_to((np.sin(u * TAU * ncorr) + 1) * .5, (H, W))
    n = fbm(H, W, 6, 6, 4, rng); streak = fbm(H, W, 2, 64, 3, rng); blot = fbm(H, W, 4, 4, 4, rng); fine = fbm(H, W, 24, 24, 2, rng)
    zinc = srgb((.52, .54, .55)) * (.78 + .3 * n[..., None]) * (.86 + .16 * wave[..., None])
    edge = np.clip(.3 - v, 0, 1) * 3 + np.clip(v - .9, 0, 1) * 3
    rust_m = np.clip((blot * .9 + streak * .4 + edge * .5 - .8) * 3.0, 0, 1)
    rust = mix3(srgb((.52, .25, .10)), srgb((.26, .13, .07)), fine)
    c = mix3(zinc, rust, rust_m)
    c *= (1 - .3 * np.clip((streak - .55) * 4, 0, 1) * np.clip(v * 1.4, 0, 1))[..., None]
    nails = np.zeros((H, W), np.float32); Y, X = np.ogrid[0:H, 0:W]
    for vy in (.05, .5, .95):
        for kk in range(0, ncorr, 2):
            nails += np.clip(1 - np.hypot(X - (kk + .25) / ncorr * W, Y - (1 - vy) * H) / 4, 0, 1)
    c = mix3(c, srgb((.22, .11, .06)), np.clip(nails * 2, 0, 1))
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, wave * .25 + rust_m * .35 * fine + nails * .3, 5.0

def _emit(m, col, strength):
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Emission Color'].default_value = col; b.inputs['Emission Strength'].default_value = strength
    return m

def sign_material():
    """'sign_face': plain light wood, no texture and no vertex colour — the game binds the farm-name texture to it."""
    m = bpy.data.materials.get('sign_face')
    if m is None:
        m = bpy.data.materials.new('sign_face'); m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = lin((.82, .70, .52)); b.inputs['Roughness'].default_value = .78
        if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = .3
    return m

def village_mats():
    M = env_mats()
    for key, name, fn, rough, kw in (('plank', 'gv_plank', tex_plank, .82, {}), ('bamboo', 'gv_bamboo', tex_bamboo, .55, {'spec': .45}),
                                     ('tarp', 'gv_tarp', tex_tarp, .7, {'two_sided': True}), ('weave', 'gv_weave', tex_weave, .8, {'two_sided': True}),
                                     ('beans', 'gv_beans', tex_beans, .55, {'spec': .45}), ('cloth', 'gv_cloth', tex_cloth, .85, {'two_sided': True}),
                                     ('rust', 'gv_rust_iron', tex_rust_iron, .6, {'two_sided': True, 'spec': .5})):
        col, nrm = tex_pair(key, fn); kw.setdefault('spec', .3)
        M[key] = material(name, col, rough, normal=nrm, **kw)
    bsdf = next(n for n in M['rust'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bsdf.inputs['Metallic'].default_value = .25
    M['paper'] = _emit(material('gv_lantern_paper', tex_pair('cloth', tex_cloth)[0], .7, two_sided=True, spec=.3), (.9, .06, .02, 1), .35)
    M['ember'] = _emit(material('gv_ember', None, .9), (1, .38, .06, 1), 4.0)
    M['sign_face'] = sign_material()
    sm = material('gv_smoke', None, 1.0, two_sided=True, spec=.0)                       # translucent wood smoke (glTF BLEND)
    bs = next(n for n in sm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bs.inputs['Alpha'].default_value = .2
    try: sm.surface_render_method = 'BLENDED'
    except Exception: pass
    M['smoke'] = sm
    return M

# ───────────────────────────── geometry helpers ─────────────────────────────

FACES = [[(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)], [(-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)],
         [(1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)], [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)],
         [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)], [(-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)]]

def quv(mb, pts, col=WHITE, su=1.0, sv=1.0, off=(0, 0)):
    """Quad / polygon (CCW from the visible side); u along edge 0→1, v across it, in metres × (su, sv) + off."""
    p = [Vector(q) for q in pts]; e1 = (p[1] - p[0]).normalized(); nrm = (p[1] - p[0]).cross(p[-1] - p[0])
    e2 = nrm.cross(e1).normalized()
    ids = [mb.add(q, ((q - p[0]).dot(e1) * su + off[0], (q - p[0]).dot(e2) * sv + off[1]), col) for q in p]; mb.face(ids); return ids

def poly_face(mb, pts, col, uvf):
    ids = [mb.add(Vector(q), uvf(Vector(q)), col) for q in pts]; mb.face(ids); return ids

def beam(mb, a, b, w, h, col=WHITE, up=UP, su=.8, sv=.8, rng=None, caps=True):
    """Squared timber from a to b: width w along up×dir, height h along ~up. Grain (texture u) runs along the beam."""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length; d /= L; up = Vector(up).normalized()
    if abs(d.dot(up)) > .97: up = Vector((0, -1, 0)) if abs(d.y) < .9 else Vector((1, 0, 0))
    side = up.cross(d).normalized(); upv = d.cross(side)
    o = (rng.random() * 4, rng.random()) if rng else (0, 0)
    P = lambda x, y, z: a + d * (L * (x + 1) / 2) + side * (w / 2 * y) + upv * (h / 2 * z)
    for i, f in enumerate(FACES):
        if i < 2 and not caps: continue
        quv(mb, [P(*q) for q in f], col, su, sv, o)

def prism(mb, a, b, poly, col=WHITE, end_mb=None, end_col=None, su=1.0, sv=1.0, up=UP, cap_su=1.0):
    """Extrude a 2D outline [(side, up)] from a to b. Sides: u around the outline, v along the length."""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length; d /= L; up = Vector(up)
    if abs(d.dot(up.normalized())) > .97: up = Vector((1, 0, 0)) if abs(d.x) < .9 else Vector((0, 1, 0))
    side = up.cross(d).normalized(); upv = d.cross(side)
    if sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(poly, poly[1:] + poly[:1])) < 0: poly = poly[::-1]
    Q = lambda p, base: base + side * p[0] + upv * p[1]; per = 0
    for p, q in zip(poly, poly[1:] + poly[:1]):
        l = math.hypot(q[0] - p[0], q[1] - p[1])
        mb.face([mb.add(Q(p, a), (per * su, 0), col), mb.add(Q(q, a), ((per + l) * su, 0), col),
                 mb.add(Q(q, b), ((per + l) * su, L * sv), col), mb.add(Q(p, b), (per * su, L * sv), col)]); per += l
    em = end_mb or mb; ec = end_col or col
    em.face([em.add(Q(p, b), (p[0] * cap_su, p[1] * cap_su), ec) for p in poly])
    em.face([em.add(Q(p, a), (p[0] * cap_su, p[1] * cap_su), ec) for p in poly][::-1])

def bamboo(mb, a, b, r, col=WHITE, node=.35, sides=None):
    """Bamboo culm with swollen nodes; texture node rings line up with the geometric ones (tile = 2 nodes = 0.7 m)."""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length; d /= L; sides = sides or (8 if r >= .04 else 6)
    pts, rads = [a], [r]; s = node / 2
    while s < L - .03:
        pts.append(a + d * s); rads.append(r * 1.06 * (1 - .1 * (s / L))); s += node
    pts.append(b); rads.append(r * .9)
    tube(mb, pts, rads, sides, col=col, v_scale=1 / (2 * node), cap=True)

def rope(mb, pts, r=.008, col=None, sides=4):
    tube(mb, [Vector(p) for p in pts], [r] * len(pts), sides, col=col or lin((.42, .33, .20)), v_scale=8)

def ring_lash(mb, c, axis, r, col=None, turns=3):
    """Rope lashing wrapped round a pole joint."""
    a = Vector(axis).normalized(); t = a.orthogonal().normalized(); b = a.cross(t); c = Vector(c)
    for k in range(turns):
        pts = [c + a * ((k - (turns - 1) / 2) * .022) + (t * math.cos(TAU * j / 10) + b * math.sin(TAU * j / 10)) * r for j in range(11)]
        tube(mb, pts, [.008] * 11, 4, col=col or lin((.40, .31, .19)), v_scale=6)

def dome(mb, c, r, h, col=WHITE, segs=16, rings=4, su=None, rect=None, rough=0.0, seed=0):
    """Heap / dome with planar top-down UVs (tile scale su, or mapped into an atlas rect)."""
    c = Vector(c); rows = []
    def uvf(p):
        if rect: return (rect[0] + (p.x - c.x + r) / (2 * r) * (rect[2] - rect[0]), rect[1] + (p.y - c.y + r) / (2 * r) * (rect[3] - rect[1]))
        return (p.x * (su or 1), p.y * (su or 1))
    for i in range(rings):
        t = i / rings; rr = r * math.cos(t * math.pi / 2); z = h * math.sin(t * math.pi / 2); row = []
        for j in range(segs + 1):
            a = TAU * (j % segs) / segs
            k = 1 + (rough * mnoise.noise(Vector((math.cos(a) * 1.7 + seed, math.sin(a) * 1.7, t * 2))) if rough else 0)
            p = c + Vector((math.cos(a) * rr * k, math.sin(a) * rr * k, z * (1 + (k - 1) * .5)))
            row.append(mb.add(p, uvf(p), col))
        rows.append(row)
    top = c + Vector((0, 0, h)); ti = mb.add(top, uvf(top), col)
    for i in range(rings - 1):
        for j in range(segs): mb.face((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    for j in range(segs): mb.face((rows[-1][j], rows[-1][j + 1], ti))

def uv_shift(mb, start, du=0.0, dv=0.0):
    for i in range(start, len(mb.uv)): mb.uv[i] = (mb.uv[i][0] + du, mb.uv[i][1] + dv)

def cut(ivs, s0, s1):
    out = []
    for a, b in ivs:
        if s1 <= a or s0 >= b: out.append((a, b)); continue
        if s0 - a > .04: out.append((a, s0))
        if b - s1 > .04: out.append((s1, b))
    return out

def wall_line(a2, b2):
    a = Vector((a2[0], a2[1], 0)); d = Vector((b2[0] - a2[0], b2[1] - a2[1], 0)); L = d.length; d /= L
    return a, d, d.cross(UP), L                     # out = right-hand side walking a → b

def plank_wall(mb, rng, a2, b2, z0, z1, openings=(), board=.21, t=.035, o0=.07, col=(.8, .7, .6, 1), ext=.1, lap=.06):
    """Horizontal lap boards on the outside of the frame, cut round openings [(s0, s1, zb, zt)], random butt joints."""
    a, d, out, L = wall_line(a2, b2); up = (UP - out * lap).normalized(); z = z0
    while z < z1 - .03:
        h = min(board * rng.uniform(.92, 1.08), z1 - z); ivs = [(-ext, L + ext)]
        for s0, s1, zb, zt in openings:
            if z + h > zb + .02 and z < zt - .02: ivs = cut(ivs, s0, s1)
        for u0, u1 in ivs:
            cuts = [u0]
            while u1 - cuts[-1] > 3.4: cuts.append(cuts[-1] + rng.uniform(1.6, 3.0))
            cuts.append(u1)
            for p0, p1 in zip(cuts, cuts[1:]):
                c = a + UP * (z + h / 2) + out * (o0 + t / 2)
                beam(mb, c + d * p0, c + d * p1, t, h + .015, tint(rng, col, .1), up=up, rng=rng)
        z += h

def liner(mb, a2, b2, z0, z1, inset=.09, col=(.035, .03, .025, 1)):
    """Dark inward-facing interior skin so doors and windows read as a dim room."""
    a, d, out, L = wall_line(a2, b2); F = lambda s, z: a + d * s - out * inset + UP * z
    quv(mb, [F(L, z0), F(0, z0), F(0, z1), F(L, z1)], col)

def window(P, rng, a2, b2, s_mid, zb, zt, w, key='plank', col=(.8, .7, .6, 1), o=.11, shutter=155, bars=3):
    """Framed window: jambs, head, projecting sill, wooden bars, dark interior, two plank shutters swung open."""
    a, d, out, L = wall_line(a2, b2); s0, s1 = s_mid - w / 2, s_mid + w / 2; f = .07
    F = lambda s, z, oo: a + d * s + UP * z + out * oo; mb = P[key]; vup = UP.cross(d)
    for s in (s0 - f / 2, s1 + f / 2): beam(mb, F(s, zb - .02, o - .02), F(s, zt + f, o - .02), f, .12, tint(rng, col, .06), up=vup, rng=rng)
    beam(mb, F(s0 - f * 1.4, zt + f / 2, o - .01), F(s1 + f * 1.4, zt + f / 2, o - .01), .14, f, tint(rng, col, .06), rng=rng)
    beam(mb, F(s0 - f * 1.6, zb - .03, o + .01), F(s1 + f * 1.6, zb - .03, o + .01), .2, .05, tint(rng, col, .06), rng=rng)
    for k in range(bars): beam(mb, F(s0 + w * (k + 1) / (bars + 1), zb, o - .06), F(s0 + w * (k + 1) / (bars + 1), zt, o - .06), .035, .035, tint(rng, col, .06), up=vup)
    quv(P['plain'], [F(s0, zb, -.06), F(s1, zb, -.06), F(s1, zt, -.06), F(s0, zt, -.06)], (.03, .025, .02, 1))
    for hinge, sgn in ((s0 - f, 1), (s1 + f, -1)):
        th = math.radians(shutter + rng.uniform(-12, 6)); dr = d * (sgn * math.cos(th)) + out * math.sin(th)
        H = F(hinge, 0, o + .02); lw = w / 2 + f * .7; nb = 3; bw = lw / nb; nl = dr.cross(UP) * sgn
        for k in range(nb):
            p = H + dr * (bw * (k + .5)); beam(mb, p + UP * (zb - .02), p + UP * (zt + .04), bw - .006, .025, tint(rng, col, .1), up=UP.cross(dr), rng=rng)
        for z in (zb + .1, zt - .08): beam(mb, H + UP * z + nl * .025 + dr * .03, H + UP * z + nl * .025 + dr * (lw - .03), .025, .07, tint(rng, col, .1), rng=rng)

def door(P, rng, a2, b2, s_mid, zb, zt, w, key='plank', col=(.8, .7, .6, 1), o=.11, ajar=55):
    """Door frame + plank leaf with ledges, swung inward; dark room behind."""
    a, d, out, L = wall_line(a2, b2); s0, s1 = s_mid - w / 2, s_mid + w / 2; f = .08
    F = lambda s, z, oo: a + d * s + UP * z + out * oo; mb = P[key]; vup = UP.cross(d)
    for s in (s0 - f / 2, s1 + f / 2): beam(mb, F(s, zb, o - .02), F(s, zt + f, o - .02), f, .14, tint(rng, col, .06), up=vup, rng=rng)
    beam(mb, F(s0 - f * 1.5, zt + f / 2, o - .01), F(s1 + f * 1.5, zt + f / 2, o - .01), .16, f, tint(rng, col, .06), rng=rng)
    beam(mb, F(s0 - f, zb + .015, o - .03), F(s1 + f, zb + .015, o - .03), .18, .04, tint(rng, col, .06), rng=rng)   # threshold
    quv(P['plain'], [F(s0, zb, -.9), F(s1, zb, -.9), F(s1, zt, -.9), F(s0, zt, -.9)], (.03, .025, .02, 1))
    for s, sg in ((s0, 1), (s1, -1)):                                            # dark reveal so the doorway has depth
        quv(P['plain'], [F(s, zb, o), F(s, zb, -.9), F(s, zt, -.9), F(s, zt, o)][::sg], (.05, .04, .03, 1))
    th = math.radians(ajar); dr = d * math.cos(th) - out * math.sin(th); H = F(s0, 0, -.02); nb = 4; bw = w / nb
    for k in range(nb):
        p = H + dr * (bw * (k + .5)); beam(mb, p + UP * (zb + .03), p + UP * (zt - .02), bw - .006, .035, tint(rng, col, .1), up=UP.cross(dr), rng=rng)
    nl = dr.cross(UP)
    for z in (zb + .25, zb + (zt - zb) * .55, zt - .2): beam(mb, H + UP * z + nl * .03 + dr * .04, H + UP * z + nl * .03 + dr * (w - .04), .03, .1, tint(rng, col, .1), rng=rng)

def slope(eave, ridge):
    """Roof plane through eave (y, z) and ridge (y, z) lines (both along x): origin, down-slope unit, outward normal, length."""
    E = Vector((0, eave[0], eave[1])); R = Vector((0, ridge[0], ridge[1])); sd = R - E; Ls = sd.length; s_ = sd / Ls
    n = Vector((1, 0, 0)).cross(s_) * (1 if eave[0] < ridge[0] else -1)
    return E, s_, n, Ls, eave[0] < ridge[0]

def thatch_slope(mb, rng, x0, x1, eave, ridge, courses, colf=None, lift=.09, ov=.34, tilex=1.2, segw=.5, cap=True):
    """Shingled thatch: courses overlap like real bundles (bottom edge lifted, ragged fringe from the texture alpha)."""
    E, s_, n, Ls, front = slope(eave, ridge); ch = (Ls + .12) / ((courses - 1) * (1 - ov) + 1); st = ch * (1 - ov)
    spans = [(k * st, k * st + ch, lift, k / max(1, courses - 1)) for k in range(courses)]
    if cap: spans.append((Ls - .62, Ls + .1, lift * 1.6, 1.0))                      # ridge saddle course
    for sb, se, lf, frac in spans:
        nx = max(2, int((x1 - x0) / segw)); xa = x0 - rng.uniform(0, .07); xb = x1 + rng.uniform(0, .07)
        uo = rng.random() * 3; ph = rng.random() * 50; grid = []
        for i in range(nx + 1):
            x = xa + (xb - xa) * i / nx; row = []
            for t in (0, .5, 1):
                s = sb + (se - sb) * t
                if t == 0: s -= .05 * (1 + mnoise.noise(Vector((x * 1.7, ph, 0))))
                off = lf * (1 - t) * (.75 + .5 * (mnoise.noise(Vector((x * 1.3, ph, t))) * .5 + .5)) + .012 * frac
                if se > Ls: off += .04 * t
                p = E + Vector((x, 0, 0)) + s_ * s + n * off
                c = colf(frac, x) if colf else tint(rng, WHITE, .05)
                row.append(mb.add(p, ((x - xa) / tilex + uo, t * .98), c))
            grid.append(row)
        for i in range(nx):
            for j in range(2):
                f = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])
                mb.face(f if front else f[::-1])

def thatch_roll(mb, pts, r, col=WHITE, sides=7):
    """Thick thatch bundle (ridge roll / rake edge): tube with UVs kept clear of the fringe band."""
    s0 = len(mb.v); L = sum((pts[i] - pts[i - 1]).length for i in range(1, len(pts)))
    tube(mb, pts, [r] * len(pts), sides, col=col, v_scale=.7 / max(L, .1), u_rep=2); uv_shift(mb, s0, dv=.22)

def corr_roof(mb, rng, x0, x1, eave, ridge, sheet=.86, waves=12, amp=.018, col=WHITE, lift0=0.0):
    """Corrugated-iron roof slope from real sheets: geometric corrugation, side laps, upper rows lapped over lower."""
    E, s_, n, Ls, front = slope(eave, ridge); nrows = max(1, math.ceil((Ls - .15) / 2.3)); rl = (Ls + .15 * (nrows - 1)) / nrows
    for r in range(nrows):
        sa = r * (rl - .15); sb = sa + rl; x = x0; k = 0
        while x < x1 - .05:
            w = min(sheet, x1 - x + .02); segs = max(4, int(waves * 4 * w / sheet)); jit = rng.uniform(-.006, .006)
            ct = tint(rng, col, .07); lift = lift0 + .006 * (k % 2) + .02 * r; grid = []; uo = rng.randrange(6) / 6; vo = rng.random(); vs = rng.choice((.6, .8, 1.0))
            for i in range(segs + 1):
                xx = x + w * i / segs; ph = TAU * waves * (xx - x) / sheet; off = amp * (1 - math.cos(ph)) * .5
                grid.append([mb.add(E + Vector((xx, 0, 0)) + s_ * s + n * (off + lift + jit * (s - sa)), ((xx - x) / sheet + uo, (s - sa) / rl * vs + vo), ct) for s in (sa, sb)])
            for i in range(segs):
                f = (grid[i][0], grid[i + 1][0], grid[i + 1][1], grid[i][1]); mb.face(f if front else f[::-1])
            x += sheet - .075; k += 1

def log_poly(rng, r):
    """Firewood cross-section: whole round, half or quarter split, randomly rolled."""
    kind = rng.random(); rot = rng.random() * TAU
    if kind < .3: pts = [(r * math.cos(TAU * k / 6), r * math.sin(TAU * k / 6)) for k in range(6)]
    elif kind < .7: pts = [(r * math.cos(math.pi * k / 4), r * math.sin(math.pi * k / 4) - r * .42) for k in range(5)]
    else: pts = [(-r * .4, -r * .4), (r * .6, -r * .4)] + [(-r * .4 + r * math.cos(math.pi / 2 * k / 3), -r * .4 + r * math.sin(math.pi / 2 * k / 3)) for k in (1, 2)] + [(-r * .4, r * .6)]
    pts = [(p[0] * rng.uniform(.9, 1.1), p[1] * rng.uniform(.9, 1.1)) for p in pts]
    return [(x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)) for x, y in pts]

def firewood_stack(P, rng, c, length, height, depth, rz=0.0, stakes=True, side_col=(.55, .45, .38, 1)):
    """Neatly stacked split firewood: logs along local y (ends facing ±y), courses along local x, end stakes."""
    c = Vector(c); R = Matrix.Rotation(rz, 3, 'Z'); z = 0; row = 0
    end_col = lin((.66, .50, .32))
    while z < height - .04:
        x = -length / 2 + (row % 2) * .04; zz = z
        while x < length / 2 - .06:
            r = rng.uniform(.055, .085); L = depth * rng.uniform(.88, 1.06); y0 = -L / 2 + rng.uniform(-.04, .04)
            A = c + R @ Vector((x + r, y0, zz + r)); B = c + R @ Vector((x + r + rng.uniform(-.02, .02), y0 + L, zz + r + rng.uniform(-.015, .015)))
            prism(P['pole'], A, B, log_poly(rng, r), tint(rng, side_col, .12), end_mb=P['plain'], end_col=tint(rng, end_col, .12), su=2, sv=1.5)
            x += 2 * r * 1.02
        z += .14; row += 1
    if stakes:
        for sx in (-1, 1):
            for sy in (-1, 1):
                pole(P['pole'], rng, c + R @ Vector((sx * (length / 2 + .05), sy * depth * .3, -.05)), c + R @ Vector((sx * (length / 2 + .05), sy * depth * .3, height + .1)), .035, 5, wob=.01)

def notched_log(P, key, rng, base, top, r, steps, col, extra=.38):
    """Ê Đê notched-log ladder: one log, horizontal treads cut into its upper face, crescent-moon top and two 'breasts'."""
    mb = P[key]; base, top = Vector(base), Vector(top); d = top - base; L = d.length; d /= L
    upn = (UP - d * UP.dot(d)).normalized(); side = d.cross(upn)
    T, D = .62 * r, -.22 * r; al_ = (T - D) * upn.z / max(d.z, .2)
    prof = [(0, T)]; s0, s1 = .12, L - extra
    for k in range(steps):
        sk = s0 + (s1 - s0) * (k + 1) / steps; prof += [(sk - al_, T), (sk, D), (sk + .004, T)]
    prof.append((L, T)); K = 12; rings = []; tops = []
    for s, t in prof:
        al = math.asin(max(-.99, min(.99, t / r))); sweep = math.pi + 2 * al; ring = []
        for j in range(K):
            phi = al - sweep * j / (K - 1)
            ring.append(mb.add(base + d * s + side * (r * math.cos(phi)) + upn * (r * math.sin(phi)), (j / (K - 1) * .6, s * .6), col))
        rings.append(ring)
        w = r * math.cos(al); tops.append([mb.add(base + d * s + side * (sx * w) + upn * t, (sx * w * 2, s * 1.5), col) for sx in (1, -1)])
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        for j in range(K - 1): mb.face((a_[j], a_[j + 1], b_[j + 1], b_[j]))
        mb.face((tops[i][1], tops[i][0], tops[i + 1][0], tops[i + 1][1]))
    mb.face(rings[0]); mb.face(rings[-1][::-1])
    c = top + d * .1; R = .17                                                    # crescent moon
    pts = [c + side * (R * math.cos(math.radians(a))) + d * (R * math.sin(math.radians(a))) for a in range(200, 341, 14)]
    tube(mb, pts, [.016 + .03 * math.sin(math.pi * i / (len(pts) - 1)) for i in range(len(pts))], 6, col=col, v_scale=1)
    for sx in (-1, 1): ellipsoid(mb, top - d * .3 + side * (sx * .06) + upn * (T + .01), upn, .045, .05, col, 8, 4)

# ───────────────────────────── assets ─────────────────────────────

def stilt_house(seed=21):
    """Nhà sàn Tây Nguyên, 10 × 5 m platform at 1.8 m."""
    rng = random.Random(seed); M = village_mats()
    P = {k: MB() for k in ('pole', 'plank', 'thatch', 'weave', 'bamboo', 'stone', 'plain')}
    FL, WT, EZ, RZ, EY, XR = 1.8, 3.55, 3.35, 6.5, 3.15, 5.75
    YW, YB, XW = -1.2, 2.45, 4.95
    roofz = lambda y: EZ + (RZ - EZ) * (1 - abs(y) / EY)
    PLK, POST = (.74, .62, .52, 1), (.52, .43, .37, 1)
    xs, ys = (-4.8, -2.4, 0.0, 2.4, 4.8), (-2.4, -1.2, 1.2, 2.4)
    for x in xs:                                                                   # stone pads + round hardwood posts
        for y in ys:
            stone(P['stone'], (x, y, .05), (.46, .46, .2), rng, seg=7, rings=3)
            pole(P['pole'], rng, (x + rng.gauss(0, .015), y + rng.gauss(0, .015), .08), (x, y, 1.53), .12, 7, col=tint(rng, POST, .08), wob=.012)
        beam(P['plank'], (x, -2.62, 1.6), (x, 2.62, 1.6), .16, .16, tint(rng, PLK, .06), rng=rng)          # girders
    for y in (-2.45, -1.65, -.82, 0, .82, 1.65, 2.45): beam(P['plank'], (-5.08, y, 1.72), (5.08, y, 1.72), .08, .08, tint(rng, PLK, .06), rng=rng)
    y = -2.56
    while y < 2.56:                                                                # floor boards
        sx = rng.uniform(-2.5, 2.5); c = tint(rng, PLK, .1)
        for xa, xb in ((-5.1, sx), (sx, 5.1)): beam(P['plank'], (xa, y + .1, 1.78), (xb, y + .1, 1.78), .197, .045, tint(rng, c, .04), rng=rng)
        y += .2
    for sy in (-1, 1): beam(P['plank'], (-5.12, sy * 2.57, 1.72), (5.12, sy * 2.57, 1.72), .04, .16, tint(rng, PLK, .06), rng=rng)
    # wall frame
    for x, y in [(sx * XW, yy) for sx in (-1, 1) for yy in (YW, YB)] + [(xx, yy) for xx in (-2.4, 0, 2.4) for yy in (YW, YB)]:
        beam(P['plank'], (x, y, FL), (x, y, WT), .14, .14, tint(rng, PLK, .06), rng=rng)
    for (ax, ay), (bx, by) in (((-XW - .1, YW), (XW + .1, YW)), ((-XW - .1, YB), (XW + .1, YB))): beam(P['plank'], (ax, ay, WT + .07), (bx, by, WT + .07), .16, .14, tint(rng, PLK, .06), rng=rng)
    for sx in (-1, 1): beam(P['plank'], (sx * XW, YW - .1, WT + .07), (sx * XW, YB + .1, WT + .07), .16, .14, tint(rng, PLK, .06), rng=rng)
    # walls, openings, interior
    door_x, wins = 1.2, (-3.3, -1.0, 3.5)
    walls = {'front': ((-XW, YW), (XW, YW)), 'back': ((XW, YB), (-XW, YB)), 'right': ((XW, YW), (XW, YB)), 'left': ((-XW, YB), (-XW, YW))}
    ops = {'front': [(door_x + XW - .48, door_x + XW + .48, FL, FL + 1.72)] + [(x + XW - .4, x + XW + .4, FL + .72, FL + 1.38) for x in wins],
           'back': [(XW + 1.0 - .4, XW + 1.0 + .4, FL + .72, FL + 1.38)], 'right': [(1.8 - .36, 1.8 + .36, FL + .72, FL + 1.38)], 'left': [(1.85 - .36, 1.85 + .36, FL + .72, FL + 1.38)]}
    for k, (a2, b2) in walls.items():
        plank_wall(P['plank'], rng, a2, b2, FL, WT, ops[k], col=PLK)
        liner(P['plain'], a2, b2, FL, WT)
        for s0, s1, zb, zt in ops[k]:
            if zt - zb > 1.5: door(P, rng, a2, b2, (s0 + s1) / 2, zb, zt, s1 - s0, col=PLK, o=.12)
            else: window(P, rng, a2, b2, (s0 + s1) / 2, zb, zt, s1 - s0, col=PLK, o=.12, shutter=150)
    quv(P['plain'], [(-XW, YB, WT), (XW, YB, WT), (XW, YW, WT), (-XW, YW, WT)], (.03, .025, .02, 1))      # ceiling (faces down)
    # woven bamboo gables
    for sx in (-1, 1):
        x = sx * (XW + .13); pts = [(x, YW - .1, WT - .02), (x, YB + .1, WT - .02), (x, YB + .1, roofz(YB + .1) - .08), (x, 0, RZ - .2), (x, YW - .1, roofz(YW - .1) - .08)]
        if sx < 0: pts = pts[::-1]
        poly_face(P['weave'], pts, (.82, .74, .62, 1), lambda q: (q.y / .9, q.z / .9))
        for (p, q) in zip(pts, pts[1:] + pts[:1]): bamboo(P['bamboo'], Vector(p) + Vector((sx * .03, 0, 0)), Vector(q) + Vector((sx * .03, 0, 0)), .03, (.8, .72, .6, 1))
    # roof frame: veranda posts + plates, ridge, rafters, purlins
    zv = roofz(-2.42) - .14
    for x in xs: pole(P['pole'], rng, (x, -2.42, FL), (x, -2.42, zv), .09, 7, col=tint(rng, POST, .08), wob=.01)
    beam(P['plank'], (-5.3, -2.42, zv + .07), (5.3, -2.42, zv + .07), .14, .14, tint(rng, PLK, .06), rng=rng)
    pole(P['pole'], rng, (-XR, 0, RZ - .16), (XR, 0, RZ - .16), .09, 8, col=POST, wob=.01, segs=6)
    for sy in (-1, 1):
        E, s_, n, Ls, _ = slope((sy * EY, EZ), (0, RZ))
        x = -XR + .25
        while x < XR:
            bamboo(P['bamboo'], E + Vector((x, 0, 0)) - s_ * .1 - n * .06, E + Vector((x, 0, 0)) + s_ * (Ls - .1) - n * .06, .04, (.8, .7, .58, 1), node=.5, sides=6); x += .9
        for f in (.15, .5, .85): bamboo(P['bamboo'], E + Vector((-XR, 0, 0)) + s_ * (Ls * f) - n * .015, E + Vector((XR, 0, 0)) + s_ * (Ls * f) - n * .015, .028, (.8, .7, .58, 1), node=.7, sides=5)
    # thatch: 7 shingled courses each side, ridge saddle, rake rolls, ridge roll, crossed ridge sticks, gable horns
    def colf(f, x):
        g = .78 + .22 * (mnoise.noise(Vector((x * .6, f * 3, 7))) * .5 + .5)
        return tint(rng, ((.80 + .2 * f) * g, (.76 + .2 * f) * g, (.72 + .18 * f) * g, 1), .1)
    for sy in (-1, 1):
        thatch_slope(P['thatch'], rng, -XR, XR, (sy * (EY + .12), EZ - .1), (0, RZ), 7, colf, tilex=2.1)
        E, s_, n, Ls, _ = slope((sy * (EY + .12), EZ - .1), (0, RZ))
        for sx in (-1, 1): thatch_roll(P['thatch'], [E + Vector((sx * (XR + .02), 0, 0)) + s_ * (Ls * k / 6) + n * .1 for k in range(7)], .1)
    apex = lambda x: Vector((x, 0, RZ + .32))
    for i in range(12):
        x = -XR + .25 + (2 * XR - .5) * i / 11; big = i in (0, 11)
        for sy in (-1, 1):
            E, s_, n, Ls, _ = slope((sy * (EY + .12), EZ - .1), (0, RZ)); p0 = E + Vector((x + sy * .03, 0, 0)) + s_ * (Ls - (.75 if big else .55)) + n * .2
            tip = p0 + (apex(x + sy * .03) - p0) * (1.9 if big else 1.45)
            if big:
                q = tip + Vector((0, -sy * .25, .3)) + Vector((math.copysign(.12, x), 0, 0))
                tube(P['pole'], [p0, apex(x), tip, q], [.06, .055, .045, .015], 6, col=POST, v_scale=.5, cap=True)
            else: bamboo(P['bamboo'], p0, tip, .022, (.7, .62, .5, 1))
    # veranda railing (gap for the ladder)
    gap = (door_x - .42, door_x + .42)
    for x in gap: beam(P['plank'], (x, -2.47, FL), (x, -2.47, FL + .95), .1, .1, tint(rng, PLK, .06), rng=rng)
    for z, h in ((FL + .9, .08), (FL + .45, .06)):
        for xa, xb in ((-XW - .05, gap[0]), (gap[1], XW + .05)): beam(P['plank'], (xa, -2.5, z), (xb, -2.5, z), .08, h, tint(rng, PLK, .06), rng=rng)
        for sx in (-1, 1): beam(P['plank'], (sx * (XW + .02), -2.5, z), (sx * (XW + .02), YW, z), .07, h, tint(rng, PLK, .06), rng=rng)
    x = -XW + .12
    while x < XW:
        if not (gap[0] - .05 < x < gap[1] + .05): beam(P['plank'], (x, -2.54, FL), (x, -2.54, FL + .86), .07, .025, tint(rng, PLK, .12), up=Vector((0, 1, 0)), rng=rng)
        x += .19
    for sx in (-1, 1):
        y = -2.38
        while y < YW - .05: beam(P['plank'], (sx * (XW + .06), y, FL), (sx * (XW + .06), y, FL + .86), .07, .025, tint(rng, PLK, .12), up=Vector((1, 0, 0)), rng=rng); y += .19
    # notched-log ladder + bamboo handrail
    notched_log(P, 'pole', rng, (door_x, -4.0, -.04), (door_x, -2.45, FL + .3), .15, 7, (.62, .52, .45, 1))
    bamboo(P['bamboo'], (gap[1] + .02, -3.95, -.05), (gap[1] + .02, -2.52, FL + .9), .03, (.8, .72, .6, 1))
    # under the floor: firewood stacks, rice mortar + pestle
    firewood_stack(P, rng, (-2.9, .1, 0), 2.8, .95, .55)
    firewood_stack(P, rng, (3.6, 1.7, 0), 1.6, .7, .5)
    mc = (2.0, -.4)
    lathe(P['pole'], [(.21, 0), (.23, .06), (.19, .3), (.2, .52), (.23, .58)], 14, col=(.58, .48, .4, 1), center=(*mc, 0), u_len=1, v_len=1)
    lathe(P['plain'], [(.23, .58), (.15, .58), (.1, .44), (.001, .42)], 14, col=(.07, .05, .04, 1), center=(*mc, 0))
    pole(P['pole'], rng, (mc[0] + .1, mc[1] + .05, .4), (mc[0] + .45, mc[1] + .35, 1.66), .045, 6, col=(.7, .6, .5, 1), wob=0, segs=2)
    # gùi basket by the door
    gc = (door_x - .9, -2.05)
    lathe(P['weave'], [(.13, FL), (.15, FL + .16), (.23, FL + .5), (.26, FL + .6)], 14, col=(.9, .8, .66, 1), center=(*gc, 0), u_len=.6, v_len=.6)
    tube(P['bamboo'], [Vector((gc[0] + .26 * math.cos(TAU * k / 16), gc[1] + .26 * math.sin(TAU * k / 16), FL + .6)) for k in range(17)], [.014] * 17, 5, col=(.8, .7, .55, 1))
    return group('stilt_house', P, M)

def wooden_house(seed=22):
    """Nhà gỗ miền núi on stone footings, 8 × 6 m with porch, rusty corrugated-iron roof."""
    rng = random.Random(seed); M = village_mats()
    P = {k: MB() for k in ('stone', 'plank', 'rust', 'plain', 'pole', 'mud')}
    FZ, WT, XW, YW, YB, YP = .77, 3.15, 4.0, -1.4, 3.0, -3.0
    PLK = (.95, .80, .66, 1); TRIM = (.78, .62, .5, 1)
    for x in (-3.9, -1.3, 1.3, 3.9):                                              # dry-stone piers
        for y in (-2.9, -1.4, .8, 2.9):
            stone(P['stone'], (x, y, .14), (.62, .58, .3), rng, seg=8, rings=4)
            stone(P['stone'], (x + rng.uniform(-.03, .03), y, .42), (.46, .44, .28), rng, seg=8, rings=4)
    for y in (-2.9, -1.4, .8, 2.9): beam(P['plank'], (-4.1, y, .63), (4.1, y, .63), .16, .16, tint(rng, TRIM, .06), rng=rng)
    x = -4.1
    while x < 4.1:                                                                 # floor boards run front-to-back
        beam(P['plank'], (x + .095, YP - .05, FZ - .02), (x + .095, YB + .05, FZ - .02), .188, .04, tint(rng, PLK, .1), rng=rng); x += .19
    beam(P['plank'], (-4.12, YP - .07, .66), (4.12, YP - .07, .66), .04, .2, tint(rng, TRIM, .06), rng=rng)
    for (x, y) in [(sx * XW, yy) for sx in (-1, 1) for yy in (YW, YB)] + [(0, YW), (0, YB)]:
        beam(P['plank'], (x, y, FZ), (x, y, WT), .14, .14, tint(rng, TRIM, .06), rng=rng)
    door_x, wins = -.6, (-2.6, 2.3)
    walls = {'front': ((-XW, YW), (XW, YW)), 'back': ((XW, YB), (-XW, YB)), 'right': ((XW, YW), (XW, YB)), 'left': ((-XW, YB), (-XW, YW))}
    ops = {'front': [(door_x + XW - .48, door_x + XW + .48, FZ, FZ + 2.05)] + [(x + XW - .5, x + XW + .5, FZ + .9, FZ + 1.95) for x in wins],
           'back': [(XW - 1.0 - .45, XW - 1.0 + .45, FZ + .95, FZ + 1.9)], 'right': [(2.2 - .45, 2.2 + .45, FZ + .95, FZ + 1.9)], 'left': [(2.2 - .45, 2.2 + .45, FZ + .95, FZ + 1.9)]}
    for k, (a2, b2) in walls.items():
        plank_wall(P['plank'], rng, a2, b2, FZ, WT, ops[k], board=.2, col=PLK)
        liner(P['plain'], a2, b2, FZ, WT)
        for s0, s1, zb, zt in ops[k]:
            if zt - zb > 1.8: door(P, rng, a2, b2, (s0 + s1) / 2, zb, zt, s1 - s0, col=TRIM, o=.12, ajar=40)
            else: window(P, rng, a2, b2, (s0 + s1) / 2, zb, zt, s1 - s0, col=TRIM, o=.12, shutter=165, bars=0)
    quv(P['plain'], [(-XW, YB, WT), (XW, YB, WT), (XW, YW, WT), (-XW, YW, WT)], (.03, .025, .02, 1))
    beam(P['plank'], (-XW - .1, YW, WT + .07), (XW + .1, YW, WT + .07), .16, .14, tint(rng, TRIM, .06), rng=rng)
    beam(P['plank'], (-XW - .1, YB, WT + .07), (XW + .1, YB, WT + .07), .16, .14, tint(rng, TRIM, .06), rng=rng)
    # main gable roof
    YR, RZ = (YW + YB) / 2, 4.42; pitch = (RZ - WT - .14) / (YR - YW)
    rz = lambda y: RZ - abs(y - YR) * pitch
    for sx in (-1, 1):                                                             # board-and-batten gables (vertical grain)
        x = sx * (XW + .1); pts = [(x, YW - .06, WT - .02), (x, YB + .06, WT - .02), (x, YB + .06, rz(YB + .06) - .04), (x, YR, RZ - .06), (x, YW - .06, rz(YW - .06) - .04)]
        if sx < 0: pts = pts[::-1]
        poly_face(P['plank'], pts, tint(rng, PLK, .05), lambda q: (q.z * .8, q.y * 1.6))
        y = YW + .1
        while y < YB:
            beam(P['plank'], (x + sx * .02, y, WT), (x + sx * .02, y, rz(y) - .06), .05, .03, tint(rng, PLK, .1), up=Vector((1, 0, 0))); y += .3
    ov = .45
    for E2, R2 in (((YB + ov, rz(YB + ov)), (YR, RZ)), ((YW - .2, rz(YW - .2)), (YR, RZ))):
        corr_roof(P['rust'], rng, -XW - .45, XW + .45, E2, R2)
        E, s_, n, Ls, _ = slope(E2, R2)
        for sx in (-1, 1): beam(P['plank'], E + Vector((sx * (XW + .47), 0, 0)) - n * .06, E + Vector((sx * (XW + .47), 0, 0)) + s_ * Ls - n * .06, .035, .2, tint(rng, TRIM, .06), up=n, rng=rng)
        beam(P['plank'], E - n * .08 + Vector((-XW - .47, 0, 0)), E - n * .08 + Vector((XW + .47, 0, 0)), .035, .16, tint(rng, TRIM, .06), rng=rng)
        x = -XW
        while x <= XW + .01:                                                       # rafter tails
            beam(P['plank'], E + Vector((x, 0, 0)) - n * .1 + s_ * .02, E + Vector((x, 0, 0)) + s_ * Ls - n * .1, .07, .1, tint(rng, TRIM, .06), up=n, rng=rng); x += .8
    x = -XW - .5
    while x < XW + .45:                                                            # ridge capping
        for sy in (-1, 1):
            E, s_, n, Ls, _ = slope(((YR + sy * 2), rz(YR + sy * 2)), (YR, RZ)); top = Vector((0, YR, RZ + .05)); lo = top - s_ * .24 + n * .02
            f = [top + Vector((x, 0, 0)), top + Vector((x + .95, 0, 0)), lo + Vector((x + .95, 0, 0)), lo + Vector((x, 0, 0))]
            quv(P['rust'], f if sy > 0 else [f[1], f[0], f[3], f[2]], tint(rng, (.9, .85, .8, 1), .06), su=1 / .95, sv=1 / .6)
        x += .88
    # porch lean-to: posts, beam, knee braces, rafters, sheets
    zp = 2.55; pr = ((YP - .35, 2.62), (YW - .05, 2.98))
    for x in (-3.9, -1.3, 1.3, 3.9):
        beam(P['plank'], (x, YP + .15, FZ), (x, YP + .15, zp - .08), .13, .13, tint(rng, TRIM, .06), rng=rng)
        for sx in (-1, 1):
            if abs(x + sx * .55) < XW + .1: beam(P['plank'], (x, YP + .15, zp - .7), (x + sx * .55, YP + .15, zp - .15), .08, .08, tint(rng, TRIM, .06), up=Vector((0, 1, 0)), rng=rng)
    beam(P['plank'], (-4.2, YP + .15, zp - .04), (4.2, YP + .15, zp - .04), .14, .16, tint(rng, TRIM, .06), rng=rng)
    E, s_, n, Ls, _ = slope(*pr); x = -4.1
    while x < 4.2:
        beam(P['plank'], E + Vector((x, 0, 0)) - n * .08, E + Vector((x, 0, 0)) + s_ * Ls - n * .08, .06, .09, tint(rng, TRIM, .06), up=n, rng=rng); x += .82
    corr_roof(P['rust'], rng, -XW - .3, XW + .3, *pr, lift0=.0)
    beam(P['plank'], E - n * .05 + Vector((-XW - .32, 0, 0)), E - n * .05 + Vector((XW + .32, 0, 0)), .03, .14, tint(rng, TRIM, .06), rng=rng)
    for k in range(5):                                                             # stones holding the sheets down
        stone(P['stone'], E + Vector((-3.4 + 1.7 * k + rng.uniform(-.2, .2), 0, 0)) + s_ * rng.uniform(.4, 1.0) + n * .08, (.2, .18, .13), rng, seg=6, rings=4)
    # porch railings (centre bay open), steps, bench, water jar
    for xa, xb in ((-3.9, -1.3), (1.3, 3.9)):
        for z, h in ((FZ + .88, .08), (FZ + .12, .06)): beam(P['plank'], (xa, YP + .15, z), (xb, YP + .15, z), .07, h, tint(rng, TRIM, .06), rng=rng)
        x = xa + .14
        while x < xb - .08: beam(P['plank'], (x, YP + .15, FZ + .15), (x, YP + .15, FZ + .84), .045, .045, tint(rng, TRIM, .1), rng=rng); x += .16
    for sx in (-1, 1):
        for z in (FZ + .88, FZ + .12): beam(P['plank'], (sx * 3.9, YP + .15, z), (sx * 3.9, YW, z), .07, .07, tint(rng, TRIM, .06), rng=rng)
    for k, (zt, yo) in enumerate(((.52, .3), (.26, .6))):
        beam(P['plank'], (door_x - .75, YP - yo + .14, zt - .02), (door_x + .75, YP - yo + .14, zt - .02), .3, .045, tint(rng, PLK, .08), rng=rng)
    for sx in (-1, 1): beam(P['plank'], (door_x + sx * .7, YP - .62, .02), (door_x + sx * .7, YP + .0, FZ - .04), .2, .05, tint(rng, TRIM, .06), up=Vector((1, 0, 0)), rng=rng)
    stone(P['stone'], (door_x, YP - .85, .03), (1.1, .5, .12), rng, seg=10, rings=4)
    bx0, bx1, by = .5, 1.9, YW - .32
    for k in range(2): beam(P['plank'], (bx0, by - .08 + .16 * k, FZ + .44), (bx1, by - .08 + .16 * k, FZ + .44), .15, .04, tint(rng, PLK, .08), rng=rng)
    for x in (bx0 + .15, bx1 - .15):
        for sy in (-1, 1): beam(P['plank'], (x, by + sy * .12, FZ), (x, by + sy * .1, FZ + .42), .05, .05, tint(rng, TRIM, .06), rng=rng)
        beam(P['plank'], (x, by - .14, FZ + .2), (x, by + .14, FZ + .2), .04, .04, tint(rng, TRIM, .06), rng=rng)
    jc = (-1.75, YP + .55)
    lathe(P['mud'], [(.001, FZ), (.16, FZ), (.25, FZ + .2), (.24, FZ + .45), (.14, FZ + .58), (.13, FZ + .63), (.15, FZ + .65)], 16, col=(.62, .42, .3, 1), center=(*jc, 0), u_len=1, v_len=1)
    lathe(P['plain'], [(.15, FZ + .65), (.12, FZ + .62), (.001, FZ + .55)], 16, col=(.03, .04, .04, 1), center=(*jc, 0))
    # stove pipe through the back slope
    tube(P['rust'], [Vector((2.6, 2.2, 3.4)), Vector((2.6, 2.2, 4.4))], [.07, .07], 10, col=(.5, .45, .42, 1), v_scale=.5)
    lathe(P['rust'], [(.001, 4.38), (.17, 4.44), (.001, 4.58)], 10, col=(.5, .45, .42, 1), center=(2.6, 2.2, 0))
    return group('wooden_house', P, M)

def wood_kitchen(seed=23):
    """Bếp củi: open pole kitchen hut, smoke-blackened thatch, three-stone fire, clay stove, smoke rack."""
    rng = random.Random(seed); M = village_mats()
    P = {k: MB() for k in ('pole', 'bamboo', 'thatch', 'weave', 'plank', 'stone', 'plain', 'mud', 'ember')}
    hx, hy, EZ, RZ, EY = 1.75, 1.4, 2.0, 3.3, 1.85
    roofz = lambda y: EZ + (RZ - EZ) * (1 - abs(y) / EY)
    SOOT = (.32, .27, .24, 1); zp = roofz(hy) - .1
    for sx in (-1, 1):
        for sy in (-1, 1): pole(P['pole'], rng, (sx * hx, sy * hy, -.05), (sx * hx, sy * hy, zp), .075, 7, col=tint(rng, SOOT, .1))
        pole(P['pole'], rng, (sx * hx, 0, -.05), (sx * hx, 0, RZ - .12), .08, 7, col=tint(rng, SOOT, .1))
        pole(P['pole'], rng, (sx * hx, -hy - .1, zp + .05), (sx * hx, hy + .1, zp + .05), .055, 6, col=SOOT, wob=.01)
    for sy in (-1, 1): pole(P['pole'], rng, (-hx - .3, sy * hy, zp + .1), (hx + .3, sy * hy, zp + .1), .06, 6, col=SOOT, wob=.01)
    pole(P['pole'], rng, (-hx - .45, 0, RZ - .1), (hx + .45, 0, RZ - .1), .065, 6, col=SOOT, wob=.01)
    for sy in (-1, 1):
        E, s_, n, Ls, _ = slope((sy * EY, EZ), (0, RZ)); x = -hx - .3
        while x < hx + .4: bamboo(P['bamboo'], E + Vector((x, 0, 0)) - n * .05, E + Vector((x, 0, 0)) + s_ * (Ls - .05) - n * .05, .03, (.36, .3, .24, 1)); x += .55
        quv(P['thatch'], [E + Vector((-hx - .4, 0, 0)) - n * .09, E + Vector((hx + .4, 0, 0)) - n * .09, E + Vector((hx + .4, 0, 0)) + s_ * Ls - n * .09, E + Vector((-hx - .4, 0, 0)) + s_ * Ls - n * .09][::(1 if sy < 0 else -1)],
            (.07, .06, .05, 1), su=1 / 1.2, sv=.6 / Ls, off=(0, .3))                 # sooted underside
    def soot(f, x):
        k = min(1, f ** 1.3 + .25 * max(0, 1 - abs(x + .35) / 1.4)); g = .25 * (mnoise.noise(Vector((x * 2, f * 4, 3))) * .5 + .5)
        return tint(rng, ((.78 - .5 * k) * (1 - g), (.72 - .48 * k) * (1 - g), (.64 - .44 * k) * (1 - g), 1), .04)
    for sy in (-1, 1): thatch_slope(P['thatch'], rng, -hx - .45, hx + .45, (sy * (EY + .08), EZ - .08), (0, RZ), 4, soot, tilex=1.8)
    # walls: woven bamboo back wall (full), left half wall, sooted towards the top
    def weave_panel(a, b, z0, z1, rows=4):
        a, b = Vector(a), Vector(b)
        for r in range(rows):
            za, zb = z0 + (z1 - z0) * r / rows, z0 + (z1 - z0) * (r + 1) / rows; k = (r + .5) / rows
            quv(P['weave'], [a + UP * za, b + UP * za, b + UP * zb, a + UP * zb], ((.8 - .5 * k), (.72 - .46 * k), (.6 - .4 * k), 1), su=1 / .8, sv=1 / .8, off=(0, za / .8))
    weave_panel((hx, hy - .03, 0), (-hx, hy - .03, 0), .02, zp - .02)
    weave_panel((-hx + .03, hy, 0), (-hx + .03, -hy, 0), .02, 1.1, rows=2)
    for y in (-hy + .4, -.4, .4): pole(P['pole'], rng, (-hx + .03, y, -.05), (-hx + .03, y, 1.15), .03, 5, col=SOOT, wob=.01)
    quv(P['plain'], [(-hx - .2, -hy - .25, .006), (hx + .2, -hy - .25, .006), (hx + .2, hy + .1, .006), (-hx - .2, hy + .1, .006)], lin((.24, .18, .13)))
    # three-stone hearth: ash bed, stones, radiating sticks with charred tips, embers, flames, blackened pot
    hc = Vector((-.35, -.2, 0))
    dome(P['plain'], hc, .55, .045, lin((.42, .40, .37)), segs=18, rings=3, rough=.15, seed=3)
    for k in range(3):
        a = math.radians(90 + 120 * k); stone(P['stone'], hc + Vector((math.cos(a) * .24, math.sin(a) * .24, .13)), (.24, .2, .28), rng, col=tint(rng, (.16, .14, .13, 1), .1), seg=8, rings=5)
    for k in range(5):
        a = math.radians(30 + 72 * k + rng.uniform(-10, 10)); dd = Vector((math.cos(a), math.sin(a), 0))
        p_in, p_out = hc + dd * .07 + UP * .1, hc + dd * rng.uniform(.75, .95) + UP * .05
        pole(P['pole'], rng, p_out, p_in, .035, 6, col=tint(rng, (.5, .4, .32, 1), .1), wob=.008, segs=3)
        tube(P['plain'], [p_in + (p_out - p_in) * .28, p_in + (p_out - p_in) * .02], [.038, .03], 6, col=(.02, .018, .016, 1), cap=True)
        for _ in range(3): ellipsoid(P['ember'], p_in + (p_out - p_in) * rng.uniform(.0, .22) + Vector((rng.gauss(0, .015), rng.gauss(0, .015), .025)), UP, .012, .014, (1, .45, .1, 1), 5, 3)
    for _ in range(26): ellipsoid(P['ember'], hc + Vector((rng.gauss(0, .07), rng.gauss(0, .07), .06 + rng.random() * .03)), rnd_unit(rng), .02, .015, tint(rng, (1, .5, .12, 1), .2), 5, 3)
    for k in range(5):
        base = hc + Vector((rng.gauss(0, .05), rng.gauss(0, .05), .08)); h = rng.uniform(.18, .3); lean = Vector((rng.gauss(0, .05), rng.gauss(0, .05), 0))
        tube(P['ember'], [base, base + lean * .5 + UP * h * .5, base + lean + UP * h], [.045, .03, .002], 6, col=(1, .78, .25, 1), cap=True)
    zp0 = .27
    lathe(P['plain'], [(.001, zp0), (.12, zp0), (.2, zp0 + .04), (.235, zp0 + .13), (.225, zp0 + .22), (.19, zp0 + .27), (.205, zp0 + .285)], 20, col=(.02, .018, .017, 1), center=tuple(hc))
    lathe(P['plain'], [(.2, zp0 + .275), (.12, zp0 + .31), (.03, zp0 + .325), (.03, zp0 + .35), (.001, zp0 + .355)], 20, col=(.03, .028, .026, 1), center=tuple(hc))
    for sx in (-1, 1): tube(P['plain'], [hc + Vector((sx * .2, 0, zp0 + .2)), hc + Vector((sx * .28, 0, zp0 + .22)), hc + Vector((sx * .2, 0, zp0 + .25))], [.012] * 3, 5, col=(.02, .02, .02, 1))
    for k in range(6):                                                               # smoke seeping up through the thatch, drifting
        t = k / 5; c = hc + Vector((.25 + .9 * t ** 1.4, -.1 + .25 * t, RZ - .15 + 1.4 * t)); r = .18 + .26 * t
        P['smoke'] = P.get('smoke') or MB()
        superellipsoid(P['smoke'], c, (r * 2, r * 1.7, r * 1.4), col=tint(rng, (.72 - .1 * t, .72 - .1 * t, .72 - .08 * t, 1), .04), e=.9, seg=10, rings=6, rz=rng.random())
    # clay stove (U-shaped) with kettle and glowing mouth
    sc = Vector((.95, .85, 0)); MUD = (.72, .55, .45, 1)
    for sx in (-1, 1): superellipsoid(P['mud'], sc + Vector((sx * .2, 0, .17)), (.14, .5, .36), col=tint(rng, MUD, .05), e=.25, seg=10, rings=6)
    superellipsoid(P['mud'], sc + Vector((0, .21, .17)), (.46, .12, .36), col=tint(rng, MUD, .05), e=.25, seg=10, rings=6)
    for _ in range(8): ellipsoid(P['ember'], sc + Vector((rng.uniform(-.1, .1), rng.uniform(-.15, .12), .05)), rnd_unit(rng), .02, .015, tint(rng, (1, .45, .1, 1), .2), 5, 3)
    kz = .35
    lathe(P['plain'], [(.001, kz), (.13, kz), (.15, kz + .05), (.14, kz + .14), (.09, kz + .2), (.07, kz + .21), (.001, kz + .24)], 16, col=(.09, .09, .085, 1), center=tuple(sc))
    tube(P['plain'], [sc + Vector((0, -.12, kz + .07)), sc + Vector((0, -.22, kz + .14)), sc + Vector((0, -.27, kz + .2))], [.025, .018, .013], 6, col=(.09, .09, .085, 1))
    tube(P['plain'], [sc + Vector((.1 * math.cos(math.radians(a)), 0, kz + .2 + .12 * math.sin(math.radians(a)))) for a in range(0, 181, 20)], [.008] * 10, 5, col=(.15, .15, .15, 1))
    # gác bếp: hanging smoke rack with corn cobs and split wood
    rz0 = 1.85; rx, ry = .55, .42
    for sy in (-1, 1): bamboo(P['bamboo'], hc + Vector((-rx, sy * ry, rz0)), hc + Vector((rx, sy * ry, rz0)), .025, (.3, .25, .2, 1))
    for k in range(8): bamboo(P['bamboo'], hc + Vector((-rx + .08 + k * (2 * rx - .16) / 7, -ry - .05, rz0 + .03)), hc + Vector((-rx + .08 + k * (2 * rx - .16) / 7, ry + .05, rz0 + .03)), .016, (.25, .2, .16, 1))
    for sx in (-1, 1):
        for sy in (-1, 1): rope(P['plain'], [hc + Vector((sx * rx, sy * ry, rz0)), hc + Vector((sx * rx * .9, sy * hy, zp + .05)) * 1], .007, col=(.1, .08, .06, 1))
    for k in range(7):
        ellipsoid(P['plain'], hc + Vector((-.4 + k * .13, rng.uniform(-.25, .25), rz0 + .08)), Vector((rng.gauss(0, .2), 1, 0)), .11, .035, tint(rng, lin((.42, .30, .10)), .2), 6, 4)
    for k in range(3): prism(P['pole'], hc + Vector((-.45, -.3 + k * .12, rz0 + .09)), hc + Vector((.45, -.3 + k * .12, rz0 + .09)), log_poly(rng, .035), (.3, .25, .2, 1), end_mb=P['plain'], end_col=(.12, .1, .08, 1))
    # firewood pile by the open side, low stools
    firewood_stack(P, rng, (hx + .65, .1, 0), 2.2, .85, .55, rz=math.pi / 2)
    for (x, y) in ((-1.05, -.85), (.3, -.75)):
        beam(P['plank'], (x - .15, y, .2), (x + .15, y, .2), .2, .035, tint(rng, (.7, .58, .48, 1), .08), rng=rng)
        for sx in (-1, 1):
            for sy in (-1, 1): beam(P['plank'], (x + sx * .11, y + sy * .07, 0), (x + sx * .11, y + sy * .07, .19), .035, .035, (.6, .5, .42, 1))
    return group('wood_kitchen', P, M)

def market_stall(seed=24):
    """Sạp chợ phiên: 3 × 2 m lashed bamboo stall, striped tarp, coffee on woven trays, dial scale, open sacks."""
    rng = random.Random(seed); M = village_mats()
    P = {k: MB() for k in ('bamboo', 'tarp', 'plank', 'weave', 'beans', 'cherries', 'jute', 'plain')}
    hx, hy, ez, rzz = 1.5, 1.0, 2.12, 2.62; BB = (.92, .85, .72, 1)
    for sx in (-1, 1):
        for sy in (-1, 1): bamboo(P['bamboo'], (sx * hx, sy * hy, -.05), (sx * hx, sy * hy, ez + .1), .042, tint(rng, BB, .06))
        bamboo(P['bamboo'], (sx * hx, 0, -.05), (sx * hx, 0, rzz + .1), .045, tint(rng, BB, .06))
        bamboo(P['bamboo'], (sx * hx, -hy - .12, ez), (sx * hx, hy + .12, ez), .035, tint(rng, BB, .06))
        for sy in (-1, 0, 1): ring_lash(P['plain'], (sx * hx, sy * hy, ez if sy else rzz), UP, .055)
    for sy in (-1, 1): bamboo(P['bamboo'], (-hx - .15, sy * hy, ez + .04), (hx + .15, sy * hy, ez + .04), .035, tint(rng, BB, .06))
    bamboo(P['bamboo'], (-hx - .15, 0, rzz), (hx + .15, 0, rzz), .04, tint(rng, BB, .06))
    # tarp draped over ridge and rails, flaps hanging at front and back
    prof = [(-1.26, 1.86), (-1.12, 2.06), (-1.03, ez + .07), (-.5, 2.32), (0, rzz + .07), (.5, 2.32), (1.03, ez + .07), (1.12, 2.04), (1.2, 1.92)]
    nx = 18; xs = [-1.74 + 3.48 * i / nx for i in range(nx + 1)]; grid = []
    acc = [0]
    for j in range(1, len(prof)): acc.append(acc[-1] + math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]))
    for x in xs:
        row = []
        for j, (y, z) in enumerate(prof):
            sag = .05 * math.sin(math.pi * min(1, abs(y) / 1.03)) if abs(y) < 1.03 else 0
            droop = .1 * ((abs(x) - hx) / .24) ** 2 if abs(x) > hx else 0
            flap = abs(y) > 1.05; wav = (.025 * math.sin(x * 6 + y)) if flap else 0
            row.append(P['tarp'].add((x, y + wav * (1 if y > 0 else -1), z - sag - droop - (.04 * (abs(y) - 1.05) / .2 if flap else 0)), (x / 1.2, acc[j] / 1.2), WHITE))
        grid.append(row)
    for i in range(nx):
        for j in range(len(prof) - 1): P['tarp'].face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    for sx in (-1, 1): rope(P['plain'], [Vector(P['tarp'].v[grid[0 if sx < 0 else -1][0]]), Vector((sx * hx, -hy, 1.7))], .006)
    # table: plank top on bamboo trestles
    ty, tz = -.45, .78
    for k in range(4): beam(P['plank'], (-1.32, ty - .3 + k * .2, tz), (1.32, ty - .3 + k * .2, tz), .195, .035, tint(rng, (.92, .8, .68, 1), .08), rng=rng)
    for sx in (-1, 1):
        for sy in (-1, 1): bamboo(P['bamboo'], (sx * 1.2, ty + sy * .32, -.02), (sx * 1.2, ty + sy * .32, tz - .02), .03, tint(rng, BB, .06))
        bamboo(P['bamboo'], (sx * 1.2, ty - .4, tz - .05), (sx * 1.2, ty + .4, tz - .05), .025, BB)
    for sy in (-1, 1): bamboo(P['bamboo'], (-1.3, ty + sy * .32, .28), (1.3, ty + sy * .32, .28), .022, BB)
    top = tz + .018
    def nia(c, r, fill, tint_):
        lathe(P['weave'], [(.001, top), (r * .8, top + .005), (r * .95, top + .035), (r, top + .07)], 18, col=(.95, .85, .7, 1), center=(c[0], c[1], 0), u_len=.5, v_len=.5)
        tube(P['bamboo'], [Vector((c[0] + r * math.cos(TAU * k / 20), c[1] + r * math.sin(TAU * k / 20), top + .07)) for k in range(21)], [.014] * 21, 5, col=BB)
        if fill == 'cherries': dome(P['cherries'], (c[0], c[1], top + .02), r * .88, .07, WHITE, segs=18, rings=4, rect=DRY_CELLS[0], rough=.08, seed=c[0])
        else: dome(P['beans'], (c[0], c[1], top + .02), r * .9, .065, tint_, segs=18, rings=4, su=1 / .37, rough=.08, seed=c[0])
    nia((-.88, ty - .05), .3, 'beans', lin((.40, .22, .11)))
    nia((-.18, ty - .08), .28, 'beans', lin((.66, .70, .50)))
    rc = (.5, ty + .02)                                                              # deep rổ of fresh cherries
    lathe(P['weave'], [(.001, top), (.15, top + .01), (.22, top + .17), (.24, top + .24)], 18, col=(.95, .85, .7, 1), center=(*rc, 0), u_len=.5, v_len=.5)
    tube(P['bamboo'], [Vector((rc[0] + .24 * math.cos(TAU * k / 20), rc[1] + .24 * math.sin(TAU * k / 20), top + .24)) for k in range(21)], [.016] * 21, 5, col=BB)
    dome(P['cherries'], (*rc, top + .2), .225, .08, WHITE, segs=18, rings=4, rect=DRY_CELLS[0], rough=.08, seed=5)
    # dial scale (cân đồng hồ): red body, white dial facing the buyer, needle, steel platter
    sc = Vector((1.02, ty - .05, top)); RED = (.55, .05, .04, 1)
    superellipsoid(P['plain'], sc + Vector((0, 0, .1)), (.22, .2, .2), col=RED, e=.25, seg=12, rings=6)
    cyl(P['plain'], sc + Vector((0, -.105, .11)), .075, .02, (0, -1, 0), (.85, .85, .8, 1), segs=20)
    for k in range(12):
        a = TAU * k / 12; beam(P['plain'], sc + Vector((math.cos(a) * .06, -.117, .11 + math.sin(a) * .06)), sc + Vector((math.cos(a) * .068, -.117, .11 + math.sin(a) * .068)), .004, .004, (.05, .05, .05, 1), up=Vector((0, -1, 0)))
    beam(P['plain'], sc + Vector((0, -.12, .11)), sc + Vector((.035, -.12, .16)), .006, .004, RED, up=Vector((0, -1, 0)))
    tube(P['plain'], [sc + Vector((0, 0, .2)), sc + Vector((0, 0, .24))], [.02, .02], 8, col=(.4, .4, .42, 1))
    lathe(P['plain'], [(.001, top + .24), (.14, top + .245), (.16, top + .27)], 18, col=(.55, .56, .58, 1), center=(sc.x, sc.y, 0))
    for k in range(3):                                                               # kraft pouches of ground coffee
        superellipsoid(P['plain'], Vector((.1 + k * .14, ty + .22, top + .1)), (.11, .06, .2), col=tint(rng, lin((.60, .44, .28)), .05), e=.3, seg=8, rings=6)
    tube(P['plain'], [Vector((-.7, ty - .1, top + .09)), Vector((-.55, ty - .25, top + .09))], [.012, .012], 6, col=(.5, .5, .52, 1))   # scoop handle
    lathe(P['plain'], [(.001, top + .05), (.05, top + .05), (.055, top + .11)], 12, col=(.6, .6, .62, 1), center=(-.75, ty - .05, 0))
    # sacks: two open in front with rolled rims, closed ones behind, low stool
    def open_sack(c, h, fill_col, cherries=False):
        wob = lambda a, z: .07 * math.sin(a * 2 + c[0] * 5) * min(1, z * 3) + .05 * math.sin(a * 5 + c[1] * 3) * min(1, z * 4)
        lathe(P['jute'], [(.17, 0), (.24, .06), (.255, h * .45), (.22, h * .85), (.21, h)], 14, col=tint(rng, WHITE, .06), center=(c[0], c[1], 0), u_len=.6, v_len=.6, wobble=wob)
        tube(P['jute'], [Vector((c[0] + .235 * (1 + wob(TAU * k / 16, h)) * math.cos(TAU * k / 16), c[1] + .235 * (1 + wob(TAU * k / 16, h)) * math.sin(TAU * k / 16), h - .02 + .02 * math.sin(k))) for k in range(17)], [.045] * 17, 6, col=tint(rng, WHITE, .06))
        dome(P['cherries' if cherries else 'beans'], (c[0], c[1], h - .05), .215, .09, fill_col, segs=16, rings=4, su=1 / .37, rect=DRY_CELLS[2] if cherries else None, rough=.1, seed=c[1])
    open_sack((-.95, -1.3), .46, lin((.40, .22, .11)))
    open_sack((-.38, -1.38), .4, WHITE, cherries=True)
    for (x, y, z, r) in ((1.0, .55, .16, .3), (1.0, .55, .44, -.2), (.35, .65, .16, .1)):
        superellipsoid(P['jute'], Vector((x, y, z)), (.42, .7, .3), e=.5, seg=10, rings=6, rz=r, sag=.12, col=tint(rng, WHITE, .08))
    beam(P['plank'], (-.2, .5, .32), (.15, .5, .32), .25, .04, (.7, .58, .48, 1), rng=rng)
    for sx in (-1, 1):
        for sy in (-1, 1): bamboo(P['bamboo'], (-.025 + sx * .14, .5 + sy * .09, 0), (-.025 + sx * .14, .5 + sy * .09, .3), .018, BB)
    return group('market_stall', P, M)

def sign_face_obj(corners):
    """Plain quad, UV 0–1 (bl, br, tr, tl seen from the front), named + materialled 'sign_face', no vertex colours."""
    mb = MB(); mb.face([mb.add(Vector(p), uv) for p, uv in zip(corners, ((0, 0), (1, 0), (1, 1), (0, 1)))])
    ob = mb.build('sign_face', sign_material(), smooth=False)
    for a in list(ob.data.color_attributes): ob.data.color_attributes.remove(a)
    bpy.context.scene.collection.objects.link(ob); return ob

def farm_gate_sign(seed=25):
    """Cổng trang trại: timber posts on stone plinths, upswept crossbeam, tie beam + knee braces, carved name board."""
    rng = random.Random(seed); M = village_mats(); P = {k: MB() for k in ('plank', 'stone', 'plain')}
    PX, TIM, DARK = 1.95, (.82, .66, .52, 1), (.6, .46, .36, 1)
    for sx in (-1, 1):
        box(P['stone'], (sx * PX, 0, .2), (.66, .66, .4), uv=1 / 1.1)
        box(P['stone'], (sx * PX, 0, .44), (.5, .5, .08), (.8, .8, .8, 1), uv=1 / 1.1)
        for _ in range(4):
            a = rng.random() * TAU; stone(P['stone'], (sx * PX + math.cos(a) * .5, math.sin(a) * .5, .06), (rng.uniform(.18, .3), rng.uniform(.15, .25), .16), rng, seg=7, rings=4)
        beam(P['plank'], (sx * PX, 0, .48), (sx * PX, 0, 3.66), .32, .32, tint(rng, TIM, .05), up=Vector((1, 0, 0)), su=.5, sv=.5, rng=rng)
        for z in (.62, 3.3): beam(P['plank'], (sx * PX - .19, 0, z), (sx * PX + .19, 0, z), .38, .07, DARK, rng=rng)       # carved collars
        beam(P['plank'], (sx * PX, 0, 1.75), (sx * PX * .66, 0, 2.3), .12, .12, tint(rng, TIM, .06), up=Vector((0, -1, 0)), rng=rng)   # knee braces
    # crossbeam with upswept ends (extruded outline), tie beam with through-tenons + wedges
    out = []
    for i in range(9): t = i / 8; out.append((1.9 + .55 * t, 3.62 + .34 * t ** 2.2))
    out += [(2.5, 4.0), (2.42, 4.02)]
    for i in range(6): t = i / 5; out.append((2.36 - .4 * t, 4.0 - .06 * t ** .6))
    poly = [(x, z) for x, z in out] + [(-x, z) for x, z in out[::-1]]
    prism(P['plank'], (0, .15, 0), (0, -.15, 0), poly, tint(rng, TIM, .03), su=.5, sv=.5, cap_su=.5)
    beam(P['plank'], (-PX - .32, 0, 2.38), (PX + .32, 0, 2.38), .22, .2, tint(rng, TIM, .05), rng=rng)
    for sx in (-1, 1): beam(P['plank'], (sx * (PX + .24), -.16, 2.38), (sx * (PX + .24), .16, 2.38), .04, .26, DARK)
    # carved board: body, raised moulded frame, corner rosettes, scroll wings, struts
    bx, bz0, bz1, by = 1.5, 2.6, 3.46, -.035
    beam(P['plank'], (-bx, 0, (bz0 + bz1) / 2), (bx, 0, (bz0 + bz1) / 2), .07, bz1 - bz0, DARK, rng=rng)
    fw = .07
    for z in (bz0 + fw / 2, bz1 - fw / 2): beam(P['plank'], (-bx, by - .02, z), (bx, by - .02, z), .045, fw, tint(rng, TIM, .04), rng=rng)
    for x in (-bx + fw / 2, bx - fw / 2): beam(P['plank'], (x, by - .02, bz0 + fw), (x, by - .02, bz1 - fw), fw, .045, tint(rng, TIM, .04), up=Vector((0, 1, 0)), rng=rng)
    for x in (-bx + fw / 2, bx - fw / 2):
        for z in (bz0 + fw / 2, bz1 - fw / 2):
            cyl(P['plank'], (x, by - .05, z), .055, .02, (0, -1, 0), tint(rng, DARK, .05), segs=12)
    for sx in (-1, 1):
        wing = [(bx - .02, bz0 + .04)]
        for i in range(17):
            t = i / 16; w = .26 * math.sin(math.pi * t) ** .55 * (.72 + .28 * math.cos(4 * math.pi * t)); wing.append((bx + w, bz0 + .04 + (bz1 - bz0 - .08) * t))
        wing.append((bx - .02, bz1 - .04))
        wp = [(sx * x, z) for x, z in wing]
        prism(P['plank'], (0, .03, 0), (0, -.03, 0), wp, tint(rng, TIM, .04), su=.5, sv=.5, cap_su=.5)
        cyl(P['plank'], (sx * (bx + .12), -.04, (bz0 + bz1) / 2), .06, .03, (0, -1, 0), DARK, segs=12)
        for z0, z1 in ((bz1, 3.62), (2.48, bz0)): beam(P['plank'], (sx * .95, 0, z0), (sx * .95, 0, z1), .1, .06, tint(rng, TIM, .05), up=Vector((0, -1, 0)))
    face = sign_face_obj([(-bx + fw, by - .003, bz0 + fw), (bx - fw, by - .003, bz0 + fw), (bx - fw, by - .003, bz1 - fw), (-bx + fw, by - .003, bz1 - fw)])
    return group('farm_gate_sign', P, M, extra=[face])

def tier_sign(seed=26):
    """Biển tên tầng: 1.6 m squared post, chamfered board with a raised frame, small gabled cap, stones at the foot."""
    rng = random.Random(seed); M = village_mats(); P = {k: MB() for k in ('plank', 'stone', 'plain')}
    TIM, DARK = (.85, .7, .56, 1), (.6, .47, .37, 1)
    beam(P['plank'], (0, 0, -.1), (0, 0, 1.52), .11, .11, tint(rng, DARK, .04), up=Vector((1, 0, 0)), su=.6, sv=.6, rng=rng)
    for sy in (-1, 1): beam(P['plank'], (-.12, sy * .045, 1.56), (.12, sy * .045, 1.56), .11, .025, TIM, up=Vector((0, -sy * .7, .7)), rng=rng)
    for k in range(6):
        a = TAU * k / 6 + rng.random() * .4; stone(P['stone'], (math.cos(a) * .17, math.sin(a) * .17, .05), (rng.uniform(.14, .22), rng.uniform(.12, .18), .14), rng, seg=7, rings=4)
    bw, bz0, bz1, t = .8, 1.1, 1.44, .045; yb = -.055 - t / 2; ch = .05
    poly = [(-bw / 2 + ch, bz0), (bw / 2 - ch, bz0), (bw / 2, bz0 + ch), (bw / 2, bz1 - ch), (bw / 2 - ch, bz1), (-bw / 2 + ch, bz1), (-bw / 2, bz1 - ch), (-bw / 2, bz0 + ch)]
    prism(P['plank'], (0, yb + t / 2, 0), (0, yb - t / 2, 0), poly, tint(rng, TIM, .04), su=.6, sv=.6, cap_su=.8)
    fw, yf = .035, yb - t / 2 - .008
    for z in (bz0 + .04 + fw / 2, bz1 - .04 - fw / 2): beam(P['plank'], (-bw / 2 + .06, yf, z), (bw / 2 - .06, yf, z), .016, fw, DARK, rng=rng)
    for x in (-bw / 2 + .06 + fw / 2, bw / 2 - .06 - fw / 2): beam(P['plank'], (x, yf, bz0 + .04 + fw), (x, yf, bz1 - .04 - fw), .016, fw, DARK, up=Vector((0, 1, 0)).cross(UP) * -1)
    for x in (-bw / 2 + .035, bw / 2 - .035):
        for z in (bz0 + .03, bz1 - .03): cyl(P['plain'], (x, yb - t / 2 - .004, z), .008, .008, (0, -1, 0), (.08, .07, .06, 1), segs=6)
    face = sign_face_obj([(-bw / 2 + .06 + fw, yb - t / 2 - .002, bz0 + .04 + fw), (bw / 2 - .06 - fw, yb - t / 2 - .002, bz0 + .04 + fw),
                          (bw / 2 - .06 - fw, yb - t / 2 - .002, bz1 - .04 - fw), (-bw / 2 + .06 + fw, yb - t / 2 - .002, bz1 - .04 - fw)])
    return group('tier_sign', P, M, extra=[face])

def lantern_string(seed=27):
    """Dây đèn lồng: 6 ribbed red paper lanterns on a sagging rope between two bamboo poles 5 m apart."""
    rng = random.Random(seed); M = village_mats(); P = {k: MB() for k in ('bamboo', 'paper', 'plain', 'stone')}
    X, H, sag = 2.5, 3.35, .42; BB = (.9, .82, .68, 1)
    for sx in (-1, 1):
        bamboo(P['bamboo'], (sx * X, 0, -.1), (sx * (X + .06), 0, H), .045, BB)
        rope(P['plain'], [(sx * (X + .05), 0, H - .12), (sx * (X + .9), .25, 0)], .006)
        tube(P['bamboo'], [Vector((sx * (X + .9), .25, -.1)), Vector((sx * (X + .92), .25, .25))], [.025, .02], 5, col=BB, cap=True)
        for k in range(3): stone(P['stone'], (sx * X + rng.uniform(-.2, .2), rng.uniform(-.2, .2), .04), (rng.uniform(.14, .22), rng.uniform(.12, .18), .12), rng, seg=6, rings=4)
        ring_lash(P['plain'], (sx * (X + .055), 0, H - .15), UP, .05, turns=2)
    rz = lambda x: H - .15 - sag * (1 - (x / X) ** 2)
    rope(P['plain'], [Vector((x, 0, rz(x))) for x in [-X + 2 * X * k / 24 for k in range(25)]], .007)
    R0, h0 = .19, .4; RED, GOLD = (.62, .025, .02, 1), (.75, .52, .12, 1)
    for k in range(6):
        x = -1.9 + 3.8 * k / 5; drop = .1 + rng.uniform(0, .05); ztop = rz(x) - drop; zb = ztop - h0; c = (x, 0, 0)
        rope(P['plain'], [(x, 0, rz(x)), (x, 0, ztop + .02)], .004, col=(.6, .45, .1, 1))
        prof = [(R0 * max(.36, math.sin(math.pi * (.08 + .84 * t)) ** .75), zb + h0 * t) for t in [i / 10 for i in range(11)]]
        s0 = len(P['paper'].v)
        lathe(P['paper'], prof, 36, col=tint(rng, RED, .05), center=c, u_len=.4, v_len=.4, wobble=lambda a, z: -.06 * (1 - abs(math.cos(6 * a))))
        for i in range(s0, len(P['paper'].v)):                                       # bamboo ribs show as darker lines
            q = P['paper'].v[i]; k = abs(math.cos(6 * math.atan2(q[1], q[0] - x))) ** 8; cc = P['paper'].col[i]
            P['paper'].col[i] = (cc[0] * (1 - .55 * k), cc[1] * (1 - .4 * k), cc[2], 1)
        for z, s in ((ztop, 1), (zb, -1)):
            lathe(P['plain'], [(R0 * .4, z - .012 * s), (R0 * .42, z), (R0 * .38, z + .02 * s), (.001, z + .024 * s)][::s], 14, col=GOLD, center=c)
        tube(P['plain'], [Vector((x, 0, zb - .02)), Vector((x, 0, zb - .07))], [.006, .006], 4, col=GOLD)
        lathe(P['plain'], [(.012, zb - .07), (.022, zb - .1), (.032, zb - .2), (.024, zb - .24)][::-1], 10, col=RED, center=c, wobble=lambda a, z: .25 * math.sin(a * 9))
        lathe(P['plain'], [(.016, zb - .065), (.02, zb - .085)][::-1], 10, col=GOLD, center=c)
    return group('lantern_string', P, M)

def flag_pole(seed=28):
    """Cột cờ đuôi nheo: bamboo pole with a guy line to a stake carrying three triangular cloth pennants."""
    rng = random.Random(seed); M = village_mats(); P = {k: MB() for k in ('bamboo', 'cloth', 'plain', 'stone')}
    H = 4.6; BB = (.9, .82, .68, 1)
    bamboo(P['bamboo'], (0, 0, -.15), (.04, 0, H), .05, BB)
    for k in range(7):
        a = TAU * k / 7 + rng.random() * .3; stone(P['stone'], (math.cos(a) * .2, math.sin(a) * .2, .06), (rng.uniform(.16, .26), rng.uniform(.14, .2), .16), rng, seg=7, rings=4)
    A, B = Vector((.05, 0, H - .15)), Vector((3.4, 0, .28))
    line = lambda t: A + (B - A) * t - UP * (.22 * math.sin(math.pi * t))
    rope(P['plain'], [line(k / 20) for k in range(21)], .006)
    ring_lash(P['plain'], (.045, 0, H - .15), UP, .055, turns=2)
    tube(P['bamboo'], [B - UP * .4, B + UP * .1], [.025, .022], 5, col=BB, cap=True)
    cols = [(.78, .06, .05, 1), (.95, .72, .08, 1), (.08, .26, .66, 1)]
    for f, (t0, col) in enumerate(zip((.16, .4, .64), cols)):
        t1 = t0 + .17; p0, p1 = line(t0), line(t1); mid = (p0 + p1) / 2; tip = mid - UP * .62 + Vector((rng.uniform(.04, .12), 0, 0))
        rows, m = 6, 6; ph = rng.random() * TAU; grid = []
        for i in range(rows + 1):
            r = i / rows; row = []
            for j in range(m + 1):
                u = j / m; e = line(t0 + (t1 - t0) * u)
                p = e + (tip - e) * r if i < rows else tip.copy()
                p.y += .06 * r * math.sin(math.pi * u + ph + r * 2) + .035 * math.sin(TAU * (u * 1.2 + r * .8) + ph) * r
                row.append(P['cloth'].add(p, (u * .6, 1 - r * .6), col))
            grid.append(row)
        for i in range(rows):
            for j in range(m):
                if i == rows - 1: P['cloth'].face((grid[i + 1][0], grid[i][j + 1], grid[i][j]))
                else: P['cloth'].face((grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1], grid[i][j]))
        tube(P['cloth'], [line(t0 + (t1 - t0) * k / 6) + Vector((0, 0, .006)) for k in range(7)], [.011] * 7, 5, col=col)   # hem round the line
    return group('flag_pole', P, M)

VILLAGE = {'stilt_house': stilt_house, 'wooden_house': wooden_house, 'wood_kitchen': wood_kitchen, 'market_stall': market_stall,
           'farm_gate_sign': farm_gate_sign, 'tier_sign': tier_sign, 'lantern_string': lantern_string, 'flag_pole': flag_pole}

def export_village(out_dir, only=None):
    for name, fn in VILLAGE.items():
        if only and name not in only: continue
        purge(); root = fn(); tris = 0; mn = Vector((1e9,) * 3); mx = -mn
        for o in root.children_recursive:
            if o.type != 'MESH': continue
            o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
            for v in o.data.vertices:
                p = o.matrix_world @ v.co; mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
        path = os.path.join(out_dir, f'{name.replace("_", "-")}.glb'); export_glb(root.name, path)
        print(f'village {name}: tris {tris}, size {mx.x - mn.x:.2f} x {mx.y - mn.y:.2f} x {mx.z - mn.z:.2f} m, {os.path.getsize(path) // 1024} KB')

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = [s.replace('-', '_') for s in sys.argv[sys.argv.index('--only') + 1].split(',')] if '--only' in sys.argv else None
    export_village(sys.argv[sys.argv.index('--export') + 1], only)
