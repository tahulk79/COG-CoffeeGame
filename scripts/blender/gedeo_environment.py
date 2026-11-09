"""Gedeo farm environment set — processing, terraces, fences, nature, props (Blender 5.x).

  wet_mill        hand pulper (hopper, drum, crank wheel) under a tin roof, two concrete fermentation tanks, washing channel
  compost_house   thatched open shed with wattle walls and a compost heap of pulp + leaves
  terrace_wall    4 m dry-stone retaining wall module (stacked irregular stones), for stepped coffee terraces
  fence           3 m eucalyptus post-and-rail module; fence_gate with a swinging gate
  rocks           five weathered basalt rocks (noise-displaced)
  grass           three alpha-card grass/weed clumps (with small yellow Meskel daisies)
  shrub           understory shrub (leafy cards)
  dirt_path       4 × 2 m rutted red-earth path tile with soft edges
  props           crate, harvest bucket, orchard ladder, wheelbarrow, mesh drying tray, hand-tool rack (one GLB, named nodes)

Headless export:  Blender -b --factory-startup -P scripts/blender/gedeo_environment.py -- --export public/models/gedeo
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_robots.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import Matrix, noise as mnoise

def lin(c):
    f = lambda x: x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)

def tex_concrete():
    rng = np.random.default_rng(401); H = W = 512
    n = fbm(H, W, 6, 6, 5, rng); stain = fbm(H, W, 3, 3, 3, rng); v = np.linspace(1, 0, H)[:, None]
    c = (.58 + .14 * (n - .5)) * (1 - .25 * np.clip((stain - .55) * 3, 0, 1)) * (1 - .3 * np.clip(.3 - v, 0, .3) / .3 * (stain > .45))
    out = np.ones((H, W, 4), np.float32); out[..., :3] = c[..., None] * np.array([1, .97, .92]); return out, n, 3.0

def tex_path():
    rng = np.random.default_rng(402); H, W = 512, 1024
    n = fbm(H, W, 4, 8, 5, rng); pebbles = vnoise(H, W, 60, 120, rng); grass = fbm(H, W, 6, 12, 3, rng)
    vv = np.linspace(0, 1, H)[:, None]
    rut = np.exp(-((vv - .3) / .06) ** 2) + np.exp(-((vv - .7) / .06) ** 2)
    c = mix3(srgb((.48, .27, .17)), srgb((.62, .38, .24)), np.clip(n * 1.3 - .15, 0, 1))
    c = c * (1 - .18 * rut[..., None])
    c = mix3(c, srgb((.55, .52, .45)), np.clip((pebbles - .82) * 8, 0, 1))
    edge = np.clip(np.minimum(vv, 1 - vv) * 6 + (grass - .5) * .8, 0, 1)
    c = mix3(srgb((.30, .38, .16)) * (.8 + .4 * grass[..., None]), c, np.clip(edge * 1.6 - .2, 0, 1))
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1); out[..., 3] = np.clip(edge * 2.2, 0, 1)
    return out, n - rut * .5 + pebbles * .3, 4.0

GRASS_CELLS = [(0, 0, .5, 1), (.5, 0, 1, 1)]
def tex_grass_cards():
    rng = random.Random(403); W, H = 2048, 1024; cv = Canvas(W, H)
    for ci, cell in enumerate(GRASS_CELLS):
        x0, y0, x1, y1 = cell_px(cell, W, H); cw = x1 - x0
        for _ in range(130):
            bx = x0 + cw * (.5 + rng.gauss(0, .14)); by = y1 - 2; L = (y1 - y0) * rng.uniform(.35, .95)
            ang = -math.pi / 2 + rng.gauss(0, .28); bend = rng.gauss(0, .25)
            col = np.array(rng.choice([(.36, .50, .16), (.45, .55, .20), (.30, .42, .14), (.58, .56, .26)])) * rng.uniform(.8, 1.15)
            pts = []; x, y, a = bx, by, ang
            for k in range(6): pts.append((x, y)); a += bend * .12; x += math.cos(a) * L / 6; y += math.sin(a) * L / 6
            for k in range(5):
                w0 = 7 * (1 - k / 5); w1 = 7 * (1 - (k + 1) / 5) + .5
                cv.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], w0, col * (.7 + .3 * k / 5), w1)
        if ci == 1:   # Meskel daisies (Bidens) — the yellow flowers of the Ethiopian highlands
            for _ in range(14):
                fx = x0 + cw * rng.uniform(.2, .8); fy = y0 + (y1 - y0) * rng.uniform(.1, .5)
                cv.line(fx, fy, fx + rng.gauss(0, 8), y1, 3, (.30, .42, .15))
                for p in range(8):
                    a = p * TAU / 8; cv.ellipse(fx + math.cos(a) * 11, fy + math.sin(a) * 11, 9, 4, a, (.98, .80, .10))
                cv.ellipse(fx, fy, 6, 6, 0, (.55, .35, .05))
    return cv.down2().a if False else cv.a

def env_mats():
    M = mats()
    cc, ccn = tex_pair('concrete', tex_concrete); pa, pan = tex_pair('path', tex_path)
    M['concrete'] = material('gb_concrete', cc, .9, normal=ccn, spec=.3)
    M['path'] = material('gb_path', pa, .95, alpha=True, normal=pan, spec=.2)
    M['grass'] = material('gb_grass', to_image('T_grass_cards', tex_grass_cards), .8, alpha=True, two_sided=True, spec=.3)
    M['water'] = material('gb_water', None, .08, spec=.9)
    M['leaf'] = bpy.data.materials.get('cordia_foliage') or material('cordia_foliage', to_image('T_cordia_foliage', lambda: tex_cordia(31)), .75, alpha=True, two_sided=True, spec=.35)
    return M

def group(name, parts, M, extra=()):
    sc = bpy.context.scene; root = bpy.data.objects.new(name, None); sc.collection.objects.link(root)
    for k, mb in parts.items():
        if mb.f:
            ob = mb.build(f'{name}_{k}', M[k]); sc.collection.objects.link(ob); ob.parent = root
    for ob in extra: ob.parent = root
    return root

def stone(mb, c, s, rng, col=None, seg=10, rings=6):
    """Irregular rock: superellipsoid displaced by 3D noise, flattened bottom."""
    s0 = len(mb.v)
    superellipsoid(mb, Vector(c), s, e=.75, seg=seg, rings=rings, rz=rng.random() * TAU, col=col or tint(rng, (.36, .33, .30, 1), .15), uv_scale=(2, 1))
    o = Vector((rng.random() * 50, rng.random() * 50, rng.random() * 50)); cc = Vector(c)
    for i in range(s0, len(mb.v)):
        p = Vector(mb.v[i]); d = p - cc
        k = 1 + .22 * mnoise.noise(o + d * 3.5) + .08 * mnoise.noise(o + d * 9)
        q = cc + d * k
        q.z = max(q.z, cc.z - s[2] * .38)
        mb.v[i] = tuple(q)

# ───────────────────────────── processing ─────────────────────────────

def wet_mill(seed=1):
    rng = random.Random(seed); M = env_mats(); P = {k: MB() for k in ('concrete', 'metal', 'wood', 'pole', 'plain', 'water', 'stone')}
    # slab + two fermentation tanks (2.0 × 1.4 × 0.9) with mucilage-covered beans + water
    box(P['concrete'], (0, 0, .1), (7.5, 4.2, .2), uv=1 / 1.5)
    for k, x in enumerate((-1.2, 1.2)):
        t, L, Wd, h = .15, 2.0, 1.4, .9; cx, cy, z0 = x, .7, .2
        for (dx, dy, sx, sy) in ((0, -Wd / 2, L, t), (0, Wd / 2, L, t), (-L / 2, 0, t, Wd), (L / 2, 0, t, Wd)):
            box(P['concrete'], (cx + dx, cy + dy, z0 + h / 2), (sx + t, sy + (t if sy == t else 0), h), uv=1 / 1.5)
        lvl = z0 + h * (.55 if k == 0 else .75)
        quad(P['water' if k else 'plain'], [(cx - L / 2 + .08, cy - Wd / 2 + .08, lvl), (cx + L / 2 - .08, cy - Wd / 2 + .08, lvl), (cx + L / 2 - .08, cy + Wd / 2 - .08, lvl), (cx - L / 2 + .08, cy + Wd / 2 - .08, lvl)],
             (.06, .07, .05, 1) if k else (.42, .34, .18, 1))
    # washing channel along the front (long concrete trough with running water)
    for dy in (-.25, .25): box(P['concrete'], (0, -1.1 + dy, .32), (6.6, .1, .24), uv=1 / 1.5)
    quad(P['water'], [(-3.25, -1.32, .38), (3.25, -1.32, .38), (3.25, -.88, .38), (-3.25, -.88, .38)], (.08, .10, .08, 1))
    for _ in range(80):
        ellipsoid(P['plain'], Vector((rng.uniform(-3, 3), -1.1 + rng.uniform(-.18, .18), .39)), UP, .009, .008, (.60, .52, .30, 1), 4, 2)   # parchment beans
    # hand pulper on a timber stand under a tin roof
    for sx in (-1, 1):
        for sy in (-1, 1): box(P['wood'], (-2.9 + sx * .35, .6 + sy * .3, .55), (.09, .09, .7), uv=1)
    box(P['wood'], (-2.9, .6, .92), (.85, .7, .06), uv=1)
    green = (.10, .25, .14, 1)
    cyl(P['metal'], (-2.9, .6, 1.17), .22, .5, (1, 0, 0), green)                                   # pulping drum
    for p in ([(-3.1, .45, 1.35), (-2.7, .45, 1.35), (-2.6, .3, 1.75), (-3.2, .3, 1.75)], [(-2.7, .75, 1.35), (-3.1, .75, 1.35), (-3.2, .9, 1.75), (-2.6, .9, 1.75)],
              [(-3.1, .75, 1.35), (-3.1, .45, 1.35), (-3.2, .3, 1.75), (-3.2, .9, 1.75)], [(-2.7, .45, 1.35), (-2.7, .75, 1.35), (-2.6, .9, 1.75), (-2.6, .3, 1.75)]):
        quad(P['metal'], p, green, both=True)                                                     # hopper
    lathe_axis(P['plain'], [(.001, -.02), (.3, -.02), (.3, .02), (.001, .02)], 20, (.12, .12, .12, 1), (-2.55, .6, 1.17), (1, 0, 0))   # crank wheel
    tube(P['plain'], [Vector((-2.52, .6, 1.17)), Vector((-2.52, .6, 1.42)), Vector((-2.4, .6, 1.42))], [.015] * 3, 5, col=(.12, .12, .12, 1))
    tube(P['metal'], [Vector((-2.9, .35, 1.0)), Vector((-2.9, -.2, .6)), Vector((-2.9, -.7, .45))], [.08, .08, .08], 8, col=green)   # chute to the channel
    for sx in (-1, 1):
        for sy in (-1, 1): pole(P['pole'], rng, (-2.9 + sx * 1.0, .6 + sy * .9, .2), (-2.9 + sx * 1.0, .6 + sy * .9, 2.6 - .25 * sy), .06)
    quad(P['metal'], [(-4.1, -.5, 2.85), (-1.7, -.5, 2.85), (-1.7, 1.7, 2.3), (-4.1, 1.7, 2.3)], (1, 1, 1, 1), 1 / 1.2, both=True)
    for _ in range(3): superellipsoid(P['plain'], Vector((-1.9 + rng.uniform(-.2, .2), -.5 + rng.uniform(-.2, .2), .38)), (.45, .45, .35), e=.6, col=lin((.38, .10, .07)))   # pulp heap
    return group('wet_mill', P, M)

def compost_house(seed=2):
    rng = random.Random(seed); M = env_mats(); P = {k: MB() for k in ('pole', 'thatch', 'plain', 'leaf')}
    hx, hy, eave, ridge = 2.0, 1.5, 1.8, 2.8
    for x in (-hx, 0, hx):
        for y in (-hy, hy): pole(P['pole'], rng, (x, y, 0), (x, y, eave), .06)
    for y in (-hy, hy): pole(P['pole'], rng, (-hx - .3, y, eave), (hx + .3, y, eave), .05, wob=.01)
    pole(P['pole'], rng, (-hx - .3, 0, ridge), (hx + .3, 0, ridge), .05, wob=.01)
    for x in (-hx, hx): pole(P['pole'], rng, (x, 0, eave), (x, 0, ridge), .05, wob=.01)
    ov = .5
    for sy in (-1, 1):
        ez = eave - ov * (ridge - eave) / hy
        p = [(-hx - .5, sy * (hy + ov), ez), (hx + .5, sy * (hy + ov), ez), (hx + .5, 0, ridge + .1), (-hx - .5, 0, ridge + .1)]
        ids = [P['thatch'].add(Vector(q), uv, tint(rng, (1, 1, 1), .05)) for q, uv in zip(p, [(0, 0), (4.4, 0), (4.4, 1), (0, 1)])]
        P['thatch'].face(ids if sy < 0 else [ids[1], ids[0], ids[3], ids[2]])
    # wattle walls (woven sticks) on the back and sides, low
    for y in (hy,):
        for k in range(22):
            x = -hx + 2 * hx * k / 21; pole(P['pole'], rng, (x, y, 0), (x, y, .9), .02, 4, wob=.01, segs=2)
        for z in np.linspace(.15, .85, 6): pole(P['pole'], rng, (-hx, y + .02 * (z * 10 % 2), z), (hx, y, z), .018, 4, wob=.015)
    # compost heap: pulp, husks, leaves
    for _ in range(4): superellipsoid(P['plain'], Vector((rng.uniform(-1.2, 1.2), rng.uniform(-.5, .6), .25)), (rng.uniform(1.0, 1.6), rng.uniform(.9, 1.3), .7), e=.7, col=tint(rng, lin((.24, .15, .10)), .2))
    for _ in range(40):
        p = Vector((rng.uniform(-1.6, 1.6), rng.uniform(-.7, .8), rng.uniform(.4, .62)))
        card(P['leaf'], p, rnd_unit(rng) * Vector((1, 1, .2)) + Vector((0, 0, .01)), UP, .45, .45, CORDIA_CELLS['leafA'], (.55, .45, .3, 1), droop=.02, curl=.05)
    for _ in range(50): ellipsoid(P['plain'], Vector((rng.uniform(-1.4, 1.4), rng.uniform(-.6, .7), rng.uniform(.5, .6))), UP, .02, .02, (.40, .04, .04, 1), 4, 2)
    return group('compost_house', P, M)

# ───────────────────────────── terraces, fences, nature ─────────────────────────────

def terrace_wall(seed=3, length=4.0, height=.9):
    """Dry-stone retaining wall module: courses of irregular stones, slightly battered, soil cap on top."""
    rng = random.Random(seed); M = env_mats(); P = {'stone': MB(), 'plain': MB()}
    z = 0; course = 0
    while z < height - .05:
        h = rng.uniform(.16, .24); x = -length / 2 + (course % 2) * .15; batter = .12 * z / height
        while x < length / 2:
            w = rng.uniform(.28, .48); w = min(w, length / 2 - x + .05)
            stone(P['stone'], (x + w / 2, batter + rng.uniform(-.02, .02), z + h / 2), (w * 1.05, rng.uniform(.30, .40), h * 1.1), rng, seg=8, rings=5)
            x += w * .98
        z += h * .92; course += 1
    quad(P['plain'], [(-length / 2, .05, height), (length / 2, .05, height), (length / 2, .6, height), (-length / 2, .6, height)], (.22, .12, .07, 1))
    return group('terrace_wall', P, M)

def fence(seed=4, gate=False):
    rng = random.Random(seed); M = env_mats(); P = {'pole': MB()}; extra = []
    L = 3.0
    for x in (-L / 2, 0, L / 2):
        if gate and x == 0: continue
        pole(P['pole'], rng, (x + rng.gauss(0, .02), 0, -.05), (x, 0, 1.25 + rng.uniform(-.05, .08)), .055, 6, wob=.02)
    if not gate:
        for z in (.45, .95): pole(P['pole'], rng, (-L / 2 - .1, .06, z + rng.gauss(0, .02)), (L / 2 + .1, .06, z + rng.gauss(0, .02)), .035, 5, wob=.02, segs=5)
        return group('fence', P, M)
    root = group('fence_gate', P, M)
    gm = MB()
    for z in (.3, .7, 1.05): pole(gm, rng, (-L / 2 + .05, .02, z), (L / 2 - .05, .02, z), .03, 5, wob=.01, segs=4)
    for x in (-L / 2 + .08, 0, L / 2 - .08): pole(gm, rng, (x, .03, .2), (x, .03, 1.12), .028, 5, wob=.01, segs=2)
    pole(gm, rng, (-L / 2 + .1, .04, .3), (L / 2 - .1, .04, 1.05), .026, 5, wob=.01, segs=3)     # diagonal brace
    gm.v = [tuple(Vector(v) - Vector((-L / 2, 0, 0))) for v in gm.v]
    leaf_ob = gm.build('fence_gate_leaf', M['pole']); bpy.context.scene.collection.objects.link(leaf_ob); leaf_ob.parent = root; leaf_ob.location = (-L / 2, 0, 0)
    return root

def rocks(seed=5):
    rng = random.Random(seed); M = env_mats(); P = {'stone': MB()}
    for k, (x, s) in enumerate([(-3, (1.2, .9, .7)), (-1.2, (.7, .6, .45)), (.3, (.45, .4, .3)), (1.5, (1.6, 1.2, .9)), (3.3, (.35, .3, .22))]):
        stone(P['stone'], (x, 0, s[2] * .3), s, rng, col=tint(rng, (.33, .31, .29, 1), .12), seg=14, rings=9)
    root = group('rocks', P, M)
    return root

def grass(seed=6):
    rng = random.Random(seed); M = env_mats(); P = {'grass': MB()}
    for k, (cx, n) in enumerate([(-1.0, 10), (0, 14), (1.0, 9)]):
        for i in range(n):
            a = i * TAU / n + rng.random() * .5; d = Vector((math.cos(a), math.sin(a), 0))
            s = rng.uniform(.45, .8); cell = GRASS_CELLS[1 if (k == 1 and i % 3 == 0) else 0]
            base = Vector((cx, 0, 0)) + d * .05
            ids = [P['grass'].add(base + d.cross(UP) * x * s + UP * z * s * 1.1 + d * z * .12 * s, (cell[0] + (x + .5) * (cell[2] - cell[0]), z), (1, 1, 1, 1)) for z in (0, 1) for x in (-.5, .5)]
            P['grass'].face((ids[0], ids[1], ids[3], ids[2]))
    return group('grass', P, M)

def shrub(seed=7):
    rng = random.Random(seed); M = env_mats(); P = {'pole': MB(), 'leaf': MB()}
    for k in range(5):
        a = k * TAU / 5 + rng.random(); d = Vector((math.cos(a) * .4, math.sin(a) * .4, 1)).normalized()
        pole(P['pole'], rng, (0, 0, 0), d * rng.uniform(.8, 1.2), .02, 4, wob=.05)
    for _ in range(40):
        p = Vector((rng.gauss(0, .35), rng.gauss(0, .35), rng.uniform(.3, 1.1)))
        out = (p - Vector((0, 0, .6))).normalized()
        card(P['leaf'], p, (out + rnd_unit(rng) * .6).normalized(), (out + UP).normalized(), .5, .5, CORDIA_CELLS[rng.choice(['leafA', 'leafB', 'leafC'])], tint(rng, (1, 1, 1), .1), droop=.1, curl=.15)
    return group('shrub', P, M)

def dirt_path():
    M = env_mats(); P = {'path': MB()}; rng = random.Random(8)
    nx, ny = 16, 4; grid = []
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            x = -2 + 4 * i / nx; y = -1 + 2 * j / ny
            row.append(P['path'].add((x, y, .01 + .015 * mnoise.noise(Vector((x * 1.3, y * 1.3, 3)))), (x / 4 + .5, j / ny), (1, 1, 1, 1)))
        grid.append(row)
    for i in range(nx):
        for j in range(ny): P['path'].face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    return group('dirt_path', P, M)

def props(seed=9):
    """Small farm props as named child nodes of one GLB."""
    rng = random.Random(seed); M = env_mats(); sc = bpy.context.scene
    root = bpy.data.objects.new('farm_props', None); sc.collection.objects.link(root)
    def node(name, at, build, mat):
        mb = MB(); build(mb); mb.v = [tuple(Vector(v) - Vector(at)) for v in mb.v]
        ob = mb.build(name, M[mat]); sc.collection.objects.link(ob); ob.parent = root; ob.location = at; return ob
    # wooden crate with cherries
    def crate(mb):
        for z in (.05, .2, .35):
            for (dx, dy, sx, sy) in ((0, -.2, .6, .02), (0, .2, .6, .02), (-.29, 0, .02, .4), (.29, 0, .02, .4)): box(mb, (dx, dy, z), (sx, sy, .1), uv=2)
        box(mb, (0, 0, .02), (.6, .42, .02), uv=2)
    node('crate', (0, 0, 0), crate, 'wood')
    node('crate_cherries', (0, 0, .35), lambda mb: [ellipsoid(mb, Vector((rng.uniform(-.26, .26), rng.uniform(-.17, .17), .35)), UP, .016, .015, rng.choice([(.62, .03, .03, 1), (.45, .02, .04, 1)]), 5, 2) for _ in range(120)], 'plain')
    # harvest bucket (plastic, yellow)
    node('bucket', (1, 0, 0), lambda mb: (lathe(mb, [(.001, 0), (.13, 0), (.16, .32), (.165, .33)], 18, col=(.85, .55, .05, 1), center=(1, 0, 0)),
                                           lathe(mb, [(.165, .33), (.15, .32), (.12, .02), (.001, .02)], 18, col=(.6, .38, .03, 1), center=(1, 0, 0)),
                                           lathe(mb, [(.001, .27), (.15, .27)], 18, col=(.55, .04, .04, 1), center=(1, 0, 0))), 'plain')
    # orchard ladder (3 legs)
    def ladder(mb):
        for sx in (-1, 1): pole(mb, rng, (1.8 + sx * .22, -.1, 0), (1.8 + sx * .06, 0, 2.2), .03, 5, wob=.01)
        pole(mb, rng, (1.8, .9, 0), (1.8, .05, 2.15), .03, 5, wob=.01)
        for k in range(7): z = .25 + k * .28; w = .22 - .16 * z / 2.2; pole(mb, rng, (1.8 - w, -.1 + .1 * z / 2.2, z), (1.8 + w, -.1 + .1 * z / 2.2, z), .018, 4, wob=0, segs=1)
    node('ladder', (1.8, 0, 0), ladder, 'pole')
    # wheelbarrow
    def barrow(mb):
        o = Vector((3.2, 0, 0)); red = (.45, .08, .05, 1)
        for p in ([(-.3, -.35, .35), (.3, -.35, .35), (.38, -.45, .62), (-.38, -.45, .62)], [(.3, .35, .35), (-.3, .35, .35), (-.38, .5, .62), (.38, .5, .62)],
                  [(-.3, .35, .35), (-.3, -.35, .35), (-.38, -.45, .62), (-.38, .5, .62)], [(.3, -.35, .35), (.3, .35, .35), (.38, .5, .62), (.38, -.45, .62)],
                  [(-.3, -.35, .35), (-.3, .35, .35), (.3, .35, .35), (.3, -.35, .35)]):
            quad(mb, [o + Vector(q) for q in p], red, both=True)
        wheel(mb, o + Vector((0, -.55, .2)), .2, .08, (1, 0, 0))
        for sx in (-1, 1): tube(mb, [o + Vector((sx * .2, -.55, .2)), o + Vector((sx * .25, -.2, .35)), o + Vector((sx * .28, .9, .55))], [.018] * 3, 6, col=(.15, .15, .15, 1))
        for sx in (-1, 1): tube(mb, [o + Vector((sx * .22, .25, .35)), o + Vector((sx * .22, .3, 0))], [.015] * 2, 5, col=(.15, .15, .15, 1))
    node('wheelbarrow', (3.2, 0, 0), barrow, 'plain')
    # mesh drying tray (hand tray for small lots)
    def tray(mb):
        o = Vector((4.8, 0, .04))
        for (dx, dy, sx, sy) in ((0, -.4, 1.0, .04), (0, .4, 1.0, .04), (-.5, 0, .04, .8), (.5, 0, .04, .8)): box(mb, o + Vector((dx, dy, 0)), (sx, sy, .06), uv=2)
    node('drying_tray', (4.8, 0, 0), tray, 'wood')
    node('drying_tray_cherries', (4.8, 0, .06), lambda mb: [ellipsoid(mb, Vector((4.8 + rng.uniform(-.46, .46), rng.uniform(-.36, .36), .06)), UP, .014, .013, rng.choice([(.40, .06, .07, 1), (.25, .12, .08, 1), (.55, .1, .05, 1)]), 4, 2) for _ in range(260)], 'plain')
    # tool rack with machete, hoe, rake, sickle
    def rack(mb):
        o = Vector((6.4, 0, 0))
        for sx in (-1, 1): pole(mb, rng, o + Vector((sx * .6, 0, 0)), o + Vector((sx * .6, 0, 1.5)), .04, 5, wob=.01)
        pole(mb, rng, o + Vector((-.7, 0, 1.4)), o + Vector((.7, 0, 1.4)), .03, 5, wob=.005)
    node('tool_rack', (6.4, 0, 0), rack, 'pole')
    def rack_tools(mb):
        o = Vector((6.4, -.04, 0))
        for k, x in enumerate((-.4, -.1, .2, .45)):
            tube(mb, [o + Vector((x, 0, 1.42)), o + Vector((x + .03, 0, .25))], [.015, .016], 5, col=(.55, .42, .28, 1))
            if k == 0: quad(mb, [o + Vector((x - .08, -.01, .15)), o + Vector((x + .1, -.01, .15)), o + Vector((x + .09, -.01, .32)), o + Vector((x - .07, -.01, .32))], (.32, .32, .33, 1), both=True)
            if k == 1: box(mb, o + Vector((x + .03, 0, .24)), (.4, .03, .04), (.5, .38, .25, 1), uv=2)
            if k == 2: tube(mb, [o + Vector((x + .03, 0, .25)), o + Vector((x + .2, 0, .3)), o + Vector((x + .3, 0, .45))], [.02, .015, .004], 4, col=(.35, .35, .36, 1))
            if k == 3: quad(mb, [o + Vector((x, -.01, .45)), o + Vector((x + .06, -.01, .45)), o + Vector((x + .05, -.01, 1.0)), o + Vector((x + .01, -.01, 1.05))], (.42, .43, .45, 1), both=True)
    node('tool_rack_tools', (6.4, 0, 0), rack_tools, 'plain')
    return root

ENV = {'wet_mill': wet_mill, 'compost_house': compost_house, 'terrace_wall': terrace_wall, 'fence': fence,
       'fence_gate': lambda: fence(gate=True), 'rocks': rocks, 'grass': grass, 'shrub': shrub, 'dirt_path': dirt_path, 'farm_props': props}

def export_env(out_dir, only=None):
    for name, fn in ENV.items():
        if only and name not in only: continue
        purge(); root = fn()
        export_glb(root.name, os.path.join(out_dir, f'{name.replace("_", "-")}.glb'))


# ───────────────────────────── ground textures + single props + workshops (landscape pass) ─────────────────────────────

def tex_grass_tile(seed=501, size=1024):
    """Highland pasture seen from above: blade speckle in several greens, darker clumps, dry yellow tips, soil specks."""
    rng = np.random.default_rng(seed); H = W = size
    fine = fbm(H, W, 128, 128, 2, rng); mid = fbm(H, W, 24, 24, 3, rng); big = fbm(H, W, 4, 4, 3, rng)
    streak = fbm(H, W, 160, 40, 2, rng) * .5 + fbm(H, W, 40, 160, 2, rng) * .5
    g = np.clip(fine * .55 + streak * .45, 0, 1)
    c = mix3(srgb((.16, .25, .08)), srgb((.36, .48, .16)), g)
    c = mix3(c, srgb((.50, .52, .24)), np.clip((mid - .58) * 3, 0, .7))           # dry straw patches
    c *= (.78 + .4 * big)[..., None]
    soil = np.clip((fbm(H, W, 64, 64, 2, rng) - .74) * 6, 0, 1) * np.clip((.55 - mid) * 4, 0, 1)
    c = mix3(c, srgb((.36, .22, .14)), soil)
    dots = vnoise(H, W, 220, 220, rng); c = mix3(c, srgb((.95, .80, .20)), np.clip((dots - .985) * 60, 0, 1) * np.clip((mid - .5) * 4, 0, 1))  # tiny Meskel daisies
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, g * .7 + mid * .3 - soil * .4, 5.0

def tex_soil_tile(seed=502, size=1024):
    """Gedeo red-brown earth: clods, small stones, dry cracks, organic darker spots."""
    rng = np.random.default_rng(seed); H = W = size
    n = fbm(H, W, 16, 16, 5, rng); clod = vnoise(H, W, 90, 90, rng); r = fbm(H, W, 10, 10, 4, rng)
    crack = np.clip(1 - np.abs(r - .5) * 50, 0, 1) * (fbm(H, W, 6, 6, 2, rng) > .55)
    c = mix3(srgb((.32, .17, .10)), srgb((.55, .31, .19)), np.clip(n * 1.3 - .15, 0, 1))
    c *= (.85 + .25 * clod)[..., None]
    peb = np.clip((vnoise(H, W, 140, 140, rng) - .9) * 12, 0, 1); c = mix3(c, srgb((.55, .50, .44)), peb)
    org = np.clip((fbm(H, W, 30, 30, 2, rng) - .68) * 4, 0, .6); c = mix3(c, srgb((.18, .11, .07)), org)
    c *= (1 - .5 * crack)[..., None]
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, n * .5 + clod * .3 + peb * .4 - crack * .5, 6.0

def tex_road_tile(seed=503, size=1024):
    """Packed dirt farm track: compacted orange-brown earth, scattered gravel, faint wheel polish, dust."""
    rng = np.random.default_rng(seed); H = W = size
    n = fbm(H, W, 8, 8, 5, rng); grit = fbm(H, W, 200, 200, 1, rng)
    c = mix3(srgb((.48, .32, .21)), srgb((.66, .47, .32)), np.clip(n * 1.3 - .1, 0, 1))
    c *= (.9 + .2 * grit)[..., None]
    gravel = np.zeros((H, W), np.float32); cv = Canvas(W, H); cv.a[..., :3] = c; cv.a[..., 3] = 1
    prng = random.Random(seed)
    for _ in range(1400):
        x, y = prng.random() * W, prng.random() * H; rr = prng.uniform(1.5, 5)
        cv.ellipse(x, y, rr, rr * prng.uniform(.6, 1), prng.random() * 3, np.array((.62, .58, .52)) * prng.uniform(.7, 1.15), shade=.5)
    lum = cv.a[..., :3].mean(2)
    return cv.a, n * .4 + lum * .8, 5.0

def export_ground_textures(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in (('grass', tex_grass_tile), ('soil', tex_soil_tile), ('road', tex_road_tile), ('stone', tex_stone)):
        col, h, k = fn()
        for suffix, arr, cs in (('', col, 'sRGB'), ('-normal', height_to_normal(h, k), 'Non-Color')):
            img = bpy.data.images.new(f'{name}{suffix}', arr.shape[1], arr.shape[0])
            img.pixels.foreach_set(np.ascontiguousarray(np.clip(arr[::-1], 0, 1)).astype(np.float32).ravel())
            path = os.path.join(out_dir, f'{name}{suffix}.png')
            img.filepath_raw = path; img.file_format = 'PNG'; img.save()   # converted to JPEG by the caller (sips / any tool)
            print('texture', path, os.path.getsize(path) // 1024, 'KB')

def rock_single(seed=11):
    rng = random.Random(seed); M = env_mats(); P = {'stone': MB()}
    stone(P['stone'], (0, 0, .3), (1.0, .8, .62), rng, col=tint(rng, (.34, .32, .29, 1), .08), seg=9, rings=5)   # mobile: scattered by the hundred
    return group('rock', P, M)

def stump(seed=12):
    rng = random.Random(seed); M = env_mats(); P = {'pole': MB(), 'plain': MB()}
    prof = [(.30, 0), (.26, .06), (.22, .18), (.21, .34)]
    lathe(P['pole'], prof, 8, col=(.8, .75, .7, 1), u_len=1, v_len=1, wobble=lambda a, z: .06 * math.sin(a * 5) * (1 - z * 2))
    lathe(P['plain'], [(.21, .34), (.001, .36)], 8, col=lin((.62, .48, .32)))
    for k in range(4):   # exposed roots
        a = k * TAU / 4 + rng.random(); d = Vector((math.cos(a), math.sin(a), 0))
        tube(P['pole'], [d * .18 + Vector((0, 0, .08)), d * .42 + Vector((0, 0, .0))], [.07, .02], 4, col=(.8, .75, .7, 1))
    return group('stump', P, M)

def grass_clump(seed=13):
    rng = random.Random(seed); M = env_mats(); P = {'grass': MB()}
    n = 7
    for i in range(n):
        a = i * TAU / n + rng.random() * .4; d = Vector((math.cos(a), math.sin(a), 0)); s = rng.uniform(.45, .7)
        cell = GRASS_CELLS[1 if i % 3 == 0 else 0]; base = d * .04
        ids = [P['grass'].add(base + d.cross(UP) * x * s + UP * z * s + d * z * .14 * s, (cell[0] + (x + .5) * (cell[2] - cell[0]), z), (1, 1, 1, 1)) for z in (0, 1) for x in (-.5, .5)]
        P['grass'].face((ids[0], ids[1], ids[3], ids[2]))
    return group('grass_clump', P, M)

def lamp_post(seed=14):
    """Eucalyptus post with an arm and a hanging hurricane lantern (glass glows)."""
    rng = random.Random(seed); M = env_mats(); P = {'pole': MB(), 'plain': MB(), 'metal': MB()}
    pole(P['pole'], rng, (0, 0, 0), (0, 0, 2.3), .06, 6, wob=.01)
    pole(P['pole'], rng, (0, 0, 2.15), (0, -.45, 2.2), .035, 5, wob=0, segs=1)
    tube(P['plain'], [Vector((0, -.42, 2.2)), Vector((0, -.42, 2.05))], [.006, .006], 4, col=(.1, .1, .1, 1))
    lathe(P['plain'], [(.001, 1.80), (.07, 1.80), (.07, 1.84)], 10, col=(.15, .15, .15, 1), center=(0, -.42, 0))
    lathe(P['plain'], [(.06, 1.84), (.065, 1.92), (.05, 1.98)], 10, col=(1.6, 1.25, .6, 1), center=(0, -.42, 0))   # lit glass chimney
    lathe(P['plain'], [(.06, 1.98), (.045, 2.02), (.001, 2.05)], 10, col=(.15, .15, .15, 1), center=(0, -.42, 0))
    return group('lamp_post', P, M)

def daisy_clump(seed=15):
    rng = random.Random(seed); M = env_mats(); P = {'grass': MB()}
    for i in range(10):
        a = i * TAU / 10 + rng.random() * .3; d = Vector((math.cos(a), math.sin(a), 0)); s = rng.uniform(.5, .75)
        cell = GRASS_CELLS[1]
        ids = [P['grass'].add(d.cross(UP) * x * s + UP * z * s + d * z * .2 * s, (cell[0] + (x + .5) * (cell[2] - cell[0]), z), (1, 1, 1, 1)) for z in (0, 1) for x in (-.5, .5)]
        P['grass'].face((ids[0], ids[1], ids[3], ids[2]))
    return group('daisy_clump', P, M)

def roastery_shed(seed=16):
    """Farm roastery: mud-brick room with a tin lean-to roof, chimney, a drum roaster and cooling tray under the eave."""
    rng = random.Random(seed); M = env_mats(); P = {k: MB() for k in ('mud', 'metal', 'wood', 'pole', 'plain', 'stone')}
    box(P['stone'], (0, 0, .15), (4.4, 3.4, .3), uv=1 / 1.2)
    for (cx, cy, sx, sy) in ((0, 1.2, 3.6, .25), (-1.7, 0, .25, 2.6), (1.7, 0, .25, 2.6)): box(P['mud'], (cx, cy, 1.4), (sx, sy, 2.2), uv=1 / 2.5)
    box(P['mud'], (-1.05, -1.2, 1.4), (1.5, .25, 2.2), uv=1 / 2.5); box(P['mud'], (1.05, -1.2, 1.4), (1.5, .25, 2.2), uv=1 / 2.5)
    box(P['mud'], (0, -1.2, 2.3), (.6, .25, .4), uv=1 / 2.5)                                   # lintel over the door
    quad(P['metal'], [(-2.3, -2.4, 2.45), (2.3, -2.4, 2.45), (2.3, 1.6, 2.85), (-2.3, 1.6, 2.85)], (1, 1, 1, 1), 1 / 1.2, both=True)
    for x in (-2.1, 2.1): pole(P['pole'], rng, (x, -2.25, .3), (x, -2.25, 2.42), .06)
    lathe(P['mud'], [(.32, 0), (.3, 1.0), (.22, 1.2)], 10, center=(1.2, .8, 2.6), u_len=1, v_len=1)  # chimney stack
    lathe(P['metal'], [(.13, 3.8), (.13, 4.6), (.18, 4.62)], 10, col=(.5, .5, .5, 1))
    # drum roaster on a brick firebox under the eave
    box(P['stone'], (-.6, -1.8, .55), (.9, .6, .5), uv=1)
    cyl(P['plain'], (-.6, -1.8, 1.05), .32, .8, (1, 0, 0), (.08, .08, .09, 1))
    lathe_axis(P['plain'], [(.001, -.02), (.18, -.02), (.18, .02), (.001, .02)], 14, (.5, .45, .4, 1), (-.15, -1.8, 1.05), (1, 0, 0))
    tube(P['plain'], [Vector((-.6, -1.8, 1.35)), Vector((-.6, -1.8, 1.9)), Vector((-.6, -1.4, 2.4))], [.06] * 3, 8, col=(.1, .1, .1, 1))
    cyl(P['wood'], (.6, -1.9, .75), .35, .08, UP, (1, 1, 1, 1))                                     # cooling tray
    for _ in range(40): ellipsoid(P['plain'], Vector((.6 + rng.uniform(-.28, .28), -1.9 + rng.uniform(-.28, .28), .8)), UP, .01, .009, lin((.28, .16, .08)), 4, 2)
    return group('roastery_shed', P, M)

def packing_shed(seed=17):
    """Open timber packing shed: thatch roof, sorting table with beans, a hanging scale, a stack of filled sacks."""
    rng = random.Random(seed); M = env_mats(); P = {k: MB() for k in ('pole', 'thatch', 'wood', 'plain', 'jute')}
    for x in (-1.8, 1.8):
        for y in (-1.3, 1.3): pole(P['pole'], rng, (x, y, 0), (x, y, 2.1), .07)
    for y in (-1.3, 1.3): pole(P['pole'], rng, (-2.1, y, 2.1), (2.1, y, 2.1), .05, wob=.01)
    pole(P['pole'], rng, (-2.1, 0, 2.9), (2.1, 0, 2.9), .05, wob=.01)
    for sy in (-1, 1):
        p = [(-2.4, sy * 1.8, 1.85), (2.4, sy * 1.8, 1.85), (2.4, 0, 3.0), (-2.4, 0, 3.0)]
        ids = [P['thatch'].add(Vector(q), uv, tint(rng, (1, 1, 1), .05)) for q, uv in zip(p, [(0, 0), (4, 0), (4, 1), (0, 1)])]
        P['thatch'].face(ids if sy < 0 else [ids[1], ids[0], ids[3], ids[2]])
    box(P['wood'], (-.4, 0, .8), (2.2, .9, .06), uv=2)
    for x in (-1.4, .6):
        for y in (-.4, .4): box(P['wood'], (x, y, .4), (.07, .07, .8), uv=2)
    for _ in range(140): ellipsoid(P['plain'], Vector((-.4 + rng.uniform(-1, 1), rng.uniform(-.4, .4), .84)), UP, .009, .008, lin(rng.choice([(.62, .55, .35), (.55, .48, .30), (.30, .20, .12)])), 4, 2)
    tube(P['plain'], [Vector((1.2, 0, 2.1)), Vector((1.2, 0, 1.6))], [.008, .008], 4, col=(.2, .2, .2, 1))
    lathe(P['plain'], [(.001, 1.45), (.14, 1.47), (.15, 1.55), (.001, 1.6)], 12, col=(.45, .45, .4, 1), center=(1.2, 0, 0))
    for k, (x, y, z) in enumerate([(1.4, -.6, .15), (1.4, .1, .15), (1.4, .8, .15), (1.4, -.25, .42), (1.4, .45, .42)]):
        superellipsoid(P['jute'], Vector((x, y, z)), (.38, .62, .28), e=.5, seg=10, rings=6, rz=1.57, sag=.1, col=tint(rng, (1, 1, 1), .06))
    return group('packing_shed', P, M)

def tier_wall(seed=12, length=4.0, height=3.0):
    """Mountain-tier retaining wall (farm tiers, founder 2026-11-08): 3 m of big dry-laid basalt blocks, battered back
    0.45 m, through-stones jutting out, flat coping slabs and a grass lip on top, a scree of fallen stones at the foot.
    Origin at the foot, face towards +y (south, the lower tier), top at z = height."""
    rng = random.Random(seed); M = env_mats(); P = {'stone': MB(), 'plain': MB(), 'grass': MB()}
    z = 0; course = 0
    while z < height - .12:
        h = rng.uniform(.26, .42) * (1.15 - .3 * z / height); x = -length / 2 - (course % 2) * .22; batter = -.45 * z / height
        while x < length / 2:
            w = min(rng.uniform(.42, .85), length / 2 - x + .08)
            col = tint(rng, (.36, .33, .31, 1) if rng.random() < .7 else (.45, .38, .32, 1), .12)
            jut = .1 if rng.random() < .08 else 0                                            # through-stones
            stone(P['stone'], (x + w / 2, batter + rng.uniform(-.03, .03) + jut, z + h / 2), (w * 1.04, rng.uniform(.40, .55) + jut, h * 1.08), rng, col=col, seg=8, rings=5)
            x += w * .97
        z += h * .93; course += 1
    x = -length / 2
    while x < length / 2:                                                                    # coping slabs
        w = min(rng.uniform(.55, .9), length / 2 - x + .05)
        stone(P['stone'], (x + w / 2, -.45 + .05, height + .06), (w * 1.02, .62, .14), rng, col=tint(rng, (.42, .40, .37, 1), .08), seg=8, rings=4)
        x += w * .98
    quad(P['plain'], [(-length / 2, -.2, height + .13), (length / 2, -.2, height + .13), (length / 2, -1.6, height + .13), (-length / 2, -1.6, height + .13)], (.18, .2, .08, 1))
    for _ in range(int(length * 10)):                                                        # grass lip hanging over the coping
        x0 = rng.uniform(-length / 2, length / 2); s_ = rng.uniform(.25, .45); cell = GRASS_CELLS[0]
        base = Vector((x0, rng.uniform(-.3, -.08), height + .13)); d = Vector((0, 1, 0))
        ids = [P['grass'].add(base + Vector((1, 0, 0)) * x * s_ + d * z_ * s_ * .7 - UP * z_ * s_ * (.15 + .5 * z_), (cell[0] + (x + .5) * (cell[2] - cell[0]), z_), (1, 1, 1, 1)) for z_ in (0, 1) for x in (-.5, .5)]
        P['grass'].face((ids[0], ids[1], ids[3], ids[2]))
    for _ in range(int(length * 2)):                                                         # scree at the foot
        stone(P['stone'], (rng.uniform(-length / 2, length / 2), rng.uniform(.15, .55), .07), (rng.uniform(.12, .26),) * 2 + (rng.uniform(.08, .14),), rng, col=tint(rng, (.34, .32, .3, 1), .1), seg=6, rings=4)
    return group('tier_wall', P, M)

ENV.update({'rock': rock_single, 'stump': stump, 'grass_clump': grass_clump, 'lamp_post': lamp_post, 'daisy_clump': daisy_clump,
            'roastery_shed': roastery_shed, 'packing_shed': packing_shed, 'tier_wall': tier_wall})

if __name__ == '__main__' and '--textures' in sys.argv and not globals().get('_GEDEO_LIB'):
    export_ground_textures(sys.argv[sys.argv.index('--textures') + 1])

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_env(sys.argv[sys.argv.index('--export') + 1], only)
