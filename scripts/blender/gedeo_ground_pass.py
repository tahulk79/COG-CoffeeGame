"""Bright ground pass (Blender 5.x): the pieces that must fit the terrain, in the polished mobile-game look the founder chose
(docs/design/ground-pass.md). Same file names, same size, same node names as before: the game needs no change to load them.

  textures   public/assets/farm/env: grass, soil, road, stone + normal maps (clean, light, no black cracks)
  models     tier-wall, terrace-wall, stone-steps, gate-plaza, dirt-path, dirt-ramp, stream, irrigation-channel, drip-line,
             cliff-face, fence, fence-gate, tier-sign, terrain-north/east/west/south, ../farm/landscape-parts
             stones are fitted warm blocks instead of dark round lumps; the terrain keeps its exact heights (terrain-meta.json).

Run:  Blender -b --factory-startup -P scripts/blender/gedeo_ground_pass.py -- --export <models dir> --tex <png dir> [--only a,b]
"""
import os, sys, math, random, json
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_waterworks.py')).read(), globals())
_land = {}
exec(open(os.path.join(_here, 'gedeo_landscape.py')).read(), globals())
exec(open(os.path.join(_here, 'gedeo_village.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import noise as mnoise

# ───────────────────────────── textures: light, clean, readable from the game camera ─────────────────────────────

def _rgba(c):
    out = np.ones(c.shape[:2] + (4,), np.float32); out[..., :3] = np.clip(c, 0, 1); return out

def tex_grass_tile(seed=501, size=1024):
    """Fresh highland grass: soft blade speckle in clear greens, gentle light and dark clumps. The game shader adds the big dry patches."""
    rng = np.random.default_rng(seed); H = W = size
    fine = fbm(H, W, 128, 128, 2, rng); mid = fbm(H, W, 20, 20, 3, rng); big = fbm(H, W, 4, 4, 3, rng)
    streak = fbm(H, W, 160, 40, 2, rng) * .5 + fbm(H, W, 40, 160, 2, rng) * .5
    g = np.clip(fine * .5 + streak * .5, 0, 1)
    c = mix3(srgb((.40, .58, .20)), srgb((.58, .75, .30)), np.clip(g * 1.25 - .12, 0, 1))
    c = mix3(c, srgb((.66, .78, .36)), np.clip((mid - .6) * 2.4, 0, .5))
    c *= (.92 + .16 * big)[..., None]
    return _rgba(c), g * .7 + mid * .3, 2.2

def tex_soil_tile(seed=502, size=1024):
    """Tilled red earth, warm terracotta: soft clods and a few pale pebbles, no cracks."""
    rng = np.random.default_rng(seed); H = W = size
    n = fbm(H, W, 16, 16, 4, rng); clod = fbm(H, W, 56, 56, 2, rng); fine = fbm(H, W, 180, 180, 1, rng)
    c = mix3(srgb((.56, .31, .18)), srgb((.76, .46, .27)), np.clip(n * 1.1 + clod * .35 - .2, 0, 1))
    c *= (.94 + .12 * fine)[..., None]
    peb = np.clip((vnoise(H, W, 120, 120, rng) - .93) * 14, 0, 1); c = mix3(c, srgb((.82, .72, .60)), peb * .8)
    return _rgba(c), clod * .7 + n * .3 + peb * .3, 3.0

def tex_road_tile(seed=503, size=1024):
    """Packed farm track: pale warm sand with soft mottling and sparse small gravel."""
    rng = np.random.default_rng(seed); H = W = size
    n = fbm(H, W, 8, 8, 4, rng); grit = fbm(H, W, 200, 200, 1, rng)
    c = mix3(srgb((.74, .57, .38)), srgb((.89, .74, .53)), np.clip(n * 1.2 - .1, 0, 1)) * (.95 + .1 * grit)[..., None]
    cv = Canvas(W, H); cv.a[..., :3] = c; cv.a[..., 3] = 1; prng = random.Random(seed)
    for _ in range(520):
        x, y = prng.random() * W, prng.random() * H; rr = prng.uniform(1.5, 4)
        cv.ellipse(x, y, rr, rr * prng.uniform(.6, 1), prng.random() * 3, np.array((.86, .80, .70)) * prng.uniform(.85, 1.05), shade=.25)
    return cv.a, n * .4 + cv.a[..., :3].mean(2) * .5, 2.0

def _grain(seed, size=512):
    """Stone surface without any pattern, so each block reads as one piece: warm limestone, soft mottling, a little lichen."""
    rng = np.random.default_rng(seed); H = W = size
    n = fbm(H, W, 6, 6, 4, rng); grain = fbm(H, W, 96, 96, 2, rng)
    c = mix3(srgb((.73, .68, .58)), srgb((.92, .87, .77)), np.clip(n * 1.2 - .1, 0, 1)) * (.93 + .14 * grain)[..., None]
    lich = np.clip((fbm(H, W, 18, 18, 3, rng) - .68) * 4, 0, 1); c = mix3(c, srgb((.74, .78, .52)), lich * .35)
    return _rgba(c), n * .55 + grain * .35, 2.5

def tex_stone(): return _grain(103)
def tex_rock(seed=608): return _grain(seed)

def _lift(fn, gamma, tone):
    """Keep a texture's detail, lift its dark range and warm it."""
    def wrapped(*a, **k):
        res = fn(*a, **k); arr = res[0] if isinstance(res, tuple) else res; arr = arr.copy()
        arr[..., :3] = np.clip(np.power(np.clip(arr[..., :3], 0, 1), gamma) * np.array(tone), 0, 1)
        return (arr,) + res[1:] if isinstance(res, tuple) else arr
    return wrapped

tex_basalt = _lift(tex_basalt, .62, (1.08, 1.0, .86))
tex_gravel = _lift(tex_gravel, .7, (1.06, 1.02, .94))
def _bleed(fn):
    """Cut-out leaves: give the see-through pixels the leaf colour, or mipmaps draw a black fringe round every blade on a phone."""
    def wrapped(*a, **k):
        arr = fn(*a, **k).copy(); solid = arr[..., 3] > .5
        arr[~solid, :3] = arr[solid, :3].mean(0) if solid.any() else 0
        return arr
    return wrapped

tex_grass_cards = _bleed(_lift(tex_grass_cards, .8, (1.12, 1.25, .92)))
tex_fern = _bleed(_lift(tex_fern, .8, (1.1, 1.25, .9)))

_wetspot = tex_wetspot
def tex_wetspot(seed=607):
    out = _wetspot(seed).copy(); out[..., 3] *= .4; return out

def tex_water(seed=601):
    rng = np.random.default_rng(seed); H = W = 512
    h = fbm(H, W, 16, 4, 4, rng) * .65 + fbm(H, W, 32, 8, 3, rng) * .35
    return _rgba(mix3(srgb((.20, .54, .56)), srgb((.42, .74, .72)), np.clip(h * 1.5 - .25, 0, 1))), h, 3.0

def tex_path(seed=402):
    rng = np.random.default_rng(seed); H, W = 512, 1024
    n = fbm(H, W, 4, 8, 4, rng); grass = fbm(H, W, 6, 12, 3, rng); vv = np.linspace(0, 1, H)[:, None]
    rut = np.exp(-((vv - .3) / .07) ** 2) + np.exp(-((vv - .7) / .07) ** 2)
    c = mix3(srgb((.74, .57, .38)), srgb((.89, .74, .53)), np.clip(n * 1.2 - .1, 0, 1)) * (1 - .1 * rut[..., None])
    edge = np.clip(np.minimum(vv, 1 - vv) * 6 + (grass - .5) * .8, 0, 1)
    c = mix3(srgb((.46, .66, .22)) * (.9 + .2 * grass[..., None]), c, np.clip(edge * 1.6 - .2, 0, 1))
    out = _rgba(c); out[..., 3] = np.clip(edge * 2.2, 0, 1)
    return out, n - rut * .3, 2.0

_tuft = tuft
def tuft(mb, base, rng, s=.5, n=6, flowers=False, hang=0.0, out=None, col=None):
    """Less droop: strongly hanging cards turn their dark underside to the camera."""
    _tuft(mb, base, rng, s=s, n=n, flowers=flowers, hang=min(hang, .2), out=out, col=col)

# Photo set (scripts/blender/photo_textures.py, CC0): everything that shows earth, grass or rock uses the same pictures as the ground.
_ENV = os.path.join(_here, '..', '..', 'public', 'assets', 'farm', 'env')
def _photo(name, k):
    img = bpy.data.images.load(os.path.abspath(os.path.join(_ENV, f'{name}.jpg')), check_existing=True); w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); arr = px.reshape(h, w, 4)[::-1].copy(); arr[..., 3] = 1
    return arr, arr[..., :3].mean(2), k
def tex_grass_tile(seed=501, size=1024): return _photo('grass', 2.5)
def tex_soil_tile(seed=502, size=1024): return _photo('soil', 3.0)
def tex_road_tile(seed=503, size=1024): return _photo('road', 2.5)
def tex_stone(): return _photo('stone', 3.0)
def tex_rock(seed=608): return _photo('stone', 3.0)
def tex_path(seed=402):
    rng = np.random.default_rng(seed); H, W = 512, 1024
    base = _photo('road', 2.5)[0][:H, :W, :3]; grass = fbm(H, W, 6, 12, 3, rng); vv = np.linspace(0, 1, H)[:, None]
    edge = np.clip(np.minimum(vv, 1 - vv) * 6 + (grass - .5) * .8, 0, 1)
    c = mix3(_photo('grass', 2.5)[0][:H, :W, :3], base, np.clip(edge * 1.6 - .2, 0, 1))
    out = _rgba(c); out[..., 3] = np.clip(edge * 2.2, 0, 1)
    return out, c.mean(2), 2.5

# ───────────────────────────── stones: fitted blocks, not lumps ─────────────────────────────

WARM = ((.95, .88, .76), (.87, .80, .68), (1.0, .95, .85), (.82, .75, .66), (.93, .82, .68))
MOSS = (.50, .62, .22, 1)

def stone(mb, c, s, rng, col=None, seg=8, rings=4, rz=None):
    """A squared, softly bevelled stone. Mostly faces forward (rz) so walls read as courses; slightly uneven."""
    s0 = len(mb.v); shade = rng.choice(WARM)
    tone = (*shade, 1)
    superellipsoid(mb, Vector(c), s, e=.42, seg=8, rings=4, rz=rng.gauss(0, .025) if rz is None else rz, col=tone, uv_scale=(2, 1))
    o = Vector((rng.random() * 50, rng.random() * 50, rng.random() * 50)); cc = Vector(c)
    for i in range(s0, len(mb.v)):
        p = Vector(mb.v[i]); d = p - cc
        q = cc + d * (1 + .07 * mnoise.noise(o + d * 2.5))
        q.z = max(q.z, cc.z - s[2] * .46)
        mb.v[i] = tuple(q)
    du, dv = rng.random(), rng.random()                     # every stone shows a different part of the photo
    for i in range(s0, len(mb.v)): mb.uv[i] = (mb.uv[i][0] * .5 + du, mb.uv[i][1] * .5 + dv)

_rock = rock
def rock(mb, c, s, rng, col, rz=None, amp=.22, e=.75, seg=10, rings=6):
    s0 = len(mb.v); _rock(mb, c, s, rng, col, rz=rng.gauss(0, .08) if rz is None else rz, amp=min(amp, .1), e=min(e, .5), seg=min(seg, 8), rings=min(rings, 5))
    du, dv = rng.random(), rng.random()
    for i in range(s0, len(mb.v)): mb.uv[i] = (mb.uv[i][0] * .5 + du, mb.uv[i][1] * .5 + dv)

def tier_wall(seed=12, length=4.0, height=3.0):
    """Tier retaining wall: large warm blocks in tidy courses, gently battered, flat coping, a soft grass lip. Origin at the foot, face +y, top at z = height."""
    rng = random.Random(seed); M = env_mats(); P = {'stone': MB(), 'plain': MB(), 'grass': MB()}
    z = 0; course = 0
    while z < height - .12:
        h = min(rng.uniform(.5, .66), height - z); x = -length / 2; batter = -.3 * z / height; first = True
        while x < length / 2:
            w = min(rng.uniform(.42, .62) if first and course % 2 else rng.uniform(.78, 1.3), length / 2 - x + .04); first = False   # modules butt cleanly: nothing past the ends
            stone(P['stone'], (x + w / 2, batter, z + h / 2), (w * 1.02, .52, h * 1.04), rng)
            x += w * .985
        z += h * .985; course += 1
    quad(P['plain'], [(-length / 2, -.12, 0), (length / 2, -.12, 0), (length / 2, -.42, height), (-length / 2, -.42, height)], lin((.60, .50, .38)), both=True)   # backing: no see-through gaps between blocks
    x = -length / 2
    while x < length / 2:
        w = min(rng.uniform(.9, 1.4), length / 2 - x + .05)
        stone(P['stone'], (x + w / 2, -.3 + .04, height + .06), (w * 1.02, .68, .17), rng)
        x += w * .985
    quad(P['plain'], [(-length / 2, -.46, height + .13), (length / 2, -.46, height + .13), (length / 2, -1.6, height + .13), (-length / 2, -1.6, height + .13)], lin((.47, .66, .24)))
    for _ in range(int(length * 7)):
        x0 = rng.uniform(-length / 2, length / 2); s_ = rng.uniform(.22, .36); cell = GRASS_CELLS[0]
        base = Vector((x0, rng.uniform(-.56, -.46), height + .14)); d = Vector((0, 1, 0))
        ids = [P['grass'].add(base + Vector((1, 0, 0)) * x * s_ + d * z_ * s_ * .7 - UP * z_ * s_ * (.15 + .5 * z_), (cell[0] + (x + .5) * (cell[2] - cell[0]), z_), (1, 1, 1, 1)) for z_ in (0, 1) for x in (-.5, .5)]
        P['grass'].face((ids[0], ids[1], ids[3], ids[2]))
    return group('tier_wall', P, M)

def terrace_wall(seed=3, length=4.0, height=.9):
    rng = random.Random(seed); M = env_mats(); P = {'stone': MB(), 'plain': MB()}
    z = 0; course = 0
    while z < height - .05:
        h = min(rng.uniform(.26, .34), height - z); x = -length / 2 + (course % 2) * .22; batter = .1 * z / height
        while x < length / 2:
            w = min(rng.uniform(.46, .78), length / 2 - x + .05)
            stone(P['stone'], (x + w / 2, batter, z + h / 2), (w * 1.02, .36, h * 1.05), rng)
            x += w * .985
        z += h * .985; course += 1
    quad(P['plain'], [(-length / 2, -.08, 0), (length / 2, -.08, 0), (length / 2, .02, height), (-length / 2, .02, height)], lin((.60, .50, .38)), both=True)
    quad(P['plain'], [(-length / 2, .05, height), (length / 2, .05, height), (length / 2, .6, height), (-length / 2, .6, height)], lin((.47, .66, .24)))
    return group('terrace_wall', P, M)

def fence(seed=4, gate=False):
    """Post and rail, thicker than life so it reads on a phone. The gate leaf stays its own node, hinged at -L/2."""
    rng = random.Random(seed); M = env_mats(); P = {'pole': MB()}
    L = 3.0; warm = (1.25, 1.05, .82, 1)
    for x in (-L / 2, 0, L / 2):
        if gate and x == 0: continue
        pole(P['pole'], rng, (x, 0, -.05), (x, 0, 1.25 + rng.uniform(-.03, .05)), .085, 7, wob=.012, col=warm)
    if not gate:
        for z in (.45, .95): pole(P['pole'], rng, (-L / 2 - .1, .07, z), (L / 2 + .1, .07, z + rng.gauss(0, .015)), .058, 6, wob=.012, segs=4, col=warm)
        return group('fence', P, M)
    root = group('fence_gate', P, M)
    gm = MB()
    for z in (.3, .7, 1.05): pole(gm, rng, (-L / 2 + .05, .03, z), (L / 2 - .05, .03, z), .05, 6, wob=.008, segs=3, col=warm)
    for x in (-L / 2 + .08, 0, L / 2 - .08): pole(gm, rng, (x, .05, .2), (x, .05, 1.12), .045, 6, wob=.008, segs=2, col=warm)
    pole(gm, rng, (-L / 2 + .1, .06, .3), (L / 2 - .1, .06, 1.05), .042, 6, wob=.008, segs=3, col=warm)
    gm.v = [tuple(Vector(v) - Vector((-L / 2, 0, 0))) for v in gm.v]
    leaf_ob = gm.build('fence_gate_leaf', M['pole']); bpy.context.scene.collection.objects.link(leaf_ob); leaf_ob.parent = root; leaf_ob.location = (-L / 2, 0, 0)
    return root

def gate_plaza(R=3.6):
    """Warm flagstone rings round the World Gate with a kerb."""
    rng = random.Random(8); M = env_mats(); P = {'stone': MB(), 'concrete': MB()}
    lathe(P['concrete'], [(.001, .01), (R + .2, .01)], 40, col=lin((.86, .78, .64)), u_len=1.5, v_len=1.5)
    P['concrete'].f = [f[::-1] for f in P['concrete'].f]
    r = .55
    while r < R - .35:
        n = max(6, int(TAU * r / .85)); off = rng.random()
        for k in range(n):
            a = TAU * (k + off) / n
            stone(P['stone'], (math.cos(a) * r, math.sin(a) * r, .05), (TAU * r / n * .95, .62, .1), rng, rz=a + math.pi / 2)
        r += .68
    nb = int(TAU * R / .8)
    for k in range(nb):
        a = TAU * k / nb
        stone(P['stone'], (math.cos(a) * R, math.sin(a) * R, .11), (TAU * R / nb * .96, .4, .24), rng, rz=a + math.pi / 2)
    return group('gate_plaza', P, M)

# ───────────────────────────── terrain: same heights, clean colours ─────────────────────────────

def export_terrain_only(out_dir, step=4.0):
    with open(os.path.join(_here, '..', '..', 'public', 'models', 'gedeo', 'terrain-meta.json')) as f: meta = json.load(f)
    purge()
    mat = material('gb_terrain', to_image('T_terrain_grass', lambda: tex_grass_tile(611, 1024)[0]), .95, spec=.2)
    x0, z0, nx, nz = meta['x0'], meta['z0'], meta['nx'], meta['nz']
    H = [[terrain_height(x0 + i * step, z0 + j * step) for j in range(nz + 1)] for i in range(nx + 1)]
    worst = max(abs(H[i][j] - meta['heights'][i][j]) for i in range(nx + 1) for j in range(nz + 1))
    if worst > .02: raise RuntimeError(f'terrain heights moved by {worst:.3f} m from terrain-meta.json: refusing to export')
    def chunk_of(x, z):
        if z < BOUNDS['minZ'] - 20: return 'north'
        if z > BOUNDS['maxZ'] + 10: return 'south'
        return 'east' if x > 0 else 'west'
    mbs = {k: MB() for k in meta['chunks']}; vid = {k: {} for k in mbs}
    def vert(k, i, j):
        if (i, j) in vid[k]: return vid[k][(i, j)]
        x, z = x0 + i * step, z0 + j * step; h = H[i][j]
        hx = (H[min(nx, i + 1)][j] - H[max(0, i - 1)][j]) / (2 * step); hz = (H[i][min(nz, j + 1)] - H[i][max(0, j - 1)]) / (2 * step)
        slope = math.hypot(hx, hz); band = .5 + .5 * math.sin(h * 2.1)
        coffee = max(0.0, min(1.0, (h - 3) / 6)) * max(0.0, 1 - max(0, h - 32) / 10) * (slope < .6)
        forest = max(0.0, min(1.0, (slope - .35) * 2 + (h - 30) / 20))
        grove = max(0.0, min(1.0, .5 + 1.5 * mnoise.noise(Vector((x / 26, z / 26, 2.3)))))                   # darker groves break up the green
        c = [1.0 - .56 * forest - .24 * coffee * band - .26 * grove, 1.0 - .34 * forest - .1 * coffee * band - .13 * grove, 1.0 - .4 * forest - .32 * coffee * band - .26 * grove]
        haze = max(0.0, min(1.0, (h - 40) / 34)) * .62                                                        # far ridges fade into blue-green air
        c = (c[0] + (.70 - c[0]) * haze, c[1] + (.84 - c[1]) * haze, c[2] + (.90 - c[2]) * haze, 1)
        idx = mbs[k].add((x, -z, h), (x / 11, -z / 11), c); vid[k][(i, j)] = idx
        return idx
    for i in range(nx):
        for j in range(nz):
            under = lambda ii, jj: H[ii][jj] - farm_ground_y(x0 + ii * step, z0 + jj * step)
            if max(under(i, j), under(i + 1, j), under(i, j + 1), under(i + 1, j + 1)) <= -.04: continue
            k = chunk_of(x0 + (i + .5) * step, z0 + (j + .5) * step)
            a, b2, c2, d2 = vert(k, i, j), vert(k, i + 1, j), vert(k, i + 1, j + 1), vert(k, i, j + 1)
            mbs[k].face((a, d2, c2, b2))
    for k, mb in mbs.items():
        for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
        root = bpy.data.objects.new(f'terrain_{k}', None); bpy.context.scene.collection.objects.link(root)
        ob = node_obj(f'terrain_{k}_mesh', mb, mat); ob.parent = root
        export_glb(root.name, os.path.join(out_dir, f'terrain-{k}.glb'))
    print('terrain ok, height difference', round(worst, 4))

# ───────────────────────────── run ─────────────────────────────

PIECES = {'tier-wall': tier_wall, 'terrace-wall': terrace_wall, 'stone-steps': stone_steps, 'gate-plaza': gate_plaza, 'dirt-path': dirt_path, 'dirt-ramp': dirt_ramp,
          'stream': stream, 'irrigation-channel': irrigation_channel, 'drip-line': drip_line, 'cliff-face': cliff_face, 'fence': fence, 'fence-gate': lambda: fence(gate=True), 'tier-sign': tier_sign}

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    arg = lambda n: sys.argv[sys.argv.index(n) + 1] if n in sys.argv else None
    out, tex, only = arg('--export'), arg('--tex'), (arg('--only') or '').split(',') if arg('--only') else None
    if tex: export_ground_textures(tex)
    for name, fn in PIECES.items():
        if only and name not in only: continue
        purge(); root = fn()
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in root.children_recursive if o.type == 'MESH')
        print(f'piece {name}: {tris} tris')
        export_glb(root.name, os.path.join(out, f'{name}.glb'))
    if not only or 'landscape-parts' in only: export_parts(os.path.join(out, 'landscape-parts.glb'))
    if not only or 'terrain' in only: export_terrain_only(out)
    print('GROUND_PASS_OK')
