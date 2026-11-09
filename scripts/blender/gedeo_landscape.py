"""Gedeo landscape pass (Blender 5.x): the ground-level pieces the realm used to draw with Three.js primitives, and the
hill country around the farm.

  farm/landscape-parts.glb   instanced by realm/plots.js (geometry only; the realm keeps its soil / stone materials):
      planting_row   mounded soil row (luống) 3.34 × 2.3 m, irregular edges, a shallow furrow, world-metre UVs
      mulch_basin    mulched earth basin round a trunk (vòng đất gốc), r 0.12–1.0 m, rim + litter bumps
      wall_unit      1 m module of dry-stone terrace wall (tường đá kè), unit box [-.5,.5]³, stones with UVs
      bank_unit      1 m module of the earth bench behind the wall, rounded front lip
  gedeo/gate-plaza.glb       flagstone plaza round the World Gate, raised border stones (radius 3.6 m)
  gedeo/terrain-*.glb + terrain-meta.json
      hill country around the playable land: flat under the farm (y ≤ 0, hidden by the play ground), rising to
      contour-terraced coffee hills east / west and the highland ridge to the north, misty mountains behind.
      meta: grid size, height samples (for placing things on the hills in Three.js) and tree spots on the slopes.

Run:  Blender -b --factory-startup -P scripts/blender/gedeo_landscape.py -- --export public/models
"""
import os, sys, math, random, json
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_environment.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import noise as mnoise

# Farm layout (src/core/config/layout.js BOUNDS), three.js x / z. Blender: x = x, y = -z.
BOUNDS = dict(minX=-32, maxX=32, minZ=-76, maxZ=28)

def node_obj(name, mb, mat):
    ob = mb.build(name, mat); bpy.context.scene.collection.objects.link(ob); return ob

# ───────────────────────────── instanced ground parts ─────────────────────────────

def planting_row():
    mb = MB(); rng = random.Random(1); nx, ny = 28, 12; W, D = 3.34, 2.3; grid = []
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            x = -W / 2 + W * i / nx; y = -D / 2 + D * j / ny
            edge = .1 * mnoise.noise(Vector((x * 2.1, 7, 1)))                      # wavy row edges
            t = abs(y) / (D / 2 + edge)
            h = .085 * max(0, 1 - t ** 2.2) ** .7 - .02 * math.exp(-((y / .12) ** 2))  # mound + centre furrow
            h += .012 * mnoise.noise(Vector((x * 6, y * 6, 3))) * (1 - min(1, t))
            row.append(mb.add((x, y, max(0, h)), (x / 1.6, y / 1.6)))
        grid.append(row)
    for i in range(nx):
        for j in range(ny): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    return mb

def mulch_basin():
    mb = MB(); seg, rings = 28, 7; grid = []
    for i in range(rings + 1):
        r = .12 + .88 * i / rings; row = []
        for j in range(seg + 1):
            a = TAU * j / seg; x, y = math.cos(a) * r, math.sin(a) * r
            h = .03 + .05 * math.exp(-((r - .85) / .1) ** 2) - .02 * (r < .3)     # raised rim (holds water), dip at the trunk
            h *= 1 - max(0, (r - .9) / .1)
            h += .01 * mnoise.noise(Vector((x * 9, y * 9, 5)))
            row.append(mb.add((x, y, max(0, h)), (x / 1.6, y / 1.6)))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    return mb

def wall_unit():
    """Dry-stone wall module filling [-.5,.5] in x and z (height), y (depth) [-.5,.5]: 3 courses of 2–3 stones."""
    rng = random.Random(3); mb = MB(); z = -.5; course = 0
    while z < .45:
        h = rng.uniform(.28, .38); x = -.5 - (course % 2) * .18
        while x < .5:
            w = rng.uniform(.38, .55)
            cx = max(-.5 + .1, min(.5 - .1, x + w / 2))
            stone(mb, (cx, 0, z + h / 2), (min(w, 1.05 - abs(cx) * 2 + .1), .95, h * 1.08), rng, col=(1, 1, 1, 1), seg=7, rings=4)
            x += w * .97
        z += h * .93; course += 1
    for i, v in enumerate(mb.v):   # clamp into the unit box so modules butt cleanly
        mb.v[i] = (max(-.52, min(.52, v[0])), max(-.55, min(.55, v[1])), max(-.5, min(.5, v[2])))
    return mb

def bank_unit():
    """Earth bench module [-.5,.5]³: flat top, rounded lip at the front (+y = south), slight bulge."""
    mb = MB(); nx, nz = 6, 8; prof = []
    for k in range(nz + 1):
        t = k / nz; z = -.5 + t; y = .5 - .08 * (t ** 3) * 3 if t > .7 else .5   # front face rounding into the top
        prof.append((min(.5, y), z))
    prof += [(.2, .5), (-.5, .5)]
    rows = []
    for i in range(nx + 1):
        x = -.5 + i / nx; row = []
        for (y, z) in prof: row.append(mb.add((x, y + .02 * mnoise.noise(Vector((x * 5, z * 5, 9))), z), (x, z + y)))
        rows.append(row)
    for i in range(nx):
        for j in range(len(prof) - 1): mb.face((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    return mb

def export_parts(path):
    purge()
    M = env_mats(); root = bpy.data.objects.new('landscape_parts', None); bpy.context.scene.collection.objects.link(root)
    for name, fn, mat in (('planting_row', planting_row, 'path'), ('mulch_basin', mulch_basin, 'path'), ('wall_unit', wall_unit, 'stone'), ('bank_unit', bank_unit, 'path')):
        ob = node_obj(name, fn(), M[mat]); ob.parent = root
    export_glb(root.name, path)

# ───────────────────────────── gate plaza ─────────────────────────────

def gate_plaza(R=3.6):
    rng = random.Random(8); M = env_mats(); P = {'stone': MB(), 'concrete': MB()}
    lathe(P['concrete'], [(.001, .01), (R + .2, .01)], 40, col=lin((.62, .55, .46)), u_len=1.5, v_len=1.5)   # mortar bed (faces up after reversal)
    P['concrete'].f = [f[::-1] for f in P['concrete'].f]
    r = .45
    while r < R - .3:
        n = max(6, int(TAU * r / .55)); off = rng.random()
        for k in range(n):
            a = TAU * (k + off) / n; w = TAU * r / n * .92
            stone(P['stone'], (math.cos(a) * r, math.sin(a) * r, .04), (w, .48, .1), rng, col=tint(rng, (.78, .74, .68, 1), .08), seg=6, rings=3)
        r += .52
    nb = int(TAU * R / .55)
    for k in range(nb):
        a = TAU * k / nb
        stone(P['stone'], (math.cos(a) * R, math.sin(a) * R, .1), (.5, .32, .24), rng, col=tint(rng, (.6, .56, .5, 1), .1), seg=7, rings=4)
    return group('gate_plaza', P, M)

# ───────────────────────────── terrain around the farm ─────────────────────────────

# Mirror of src/core/config/layout.js farmGroundY: the 4 farm tiers (0 / 2.6 / 5.6 / 9 m) stepping up to the north.
TIER_EDGES = [(-2.5, None, 2.2), (-20.5, None, 4.4), (-51.5, -46.5, 6.6)]
def _sm(t): return 0.0 if t <= 0 else 1.0 if t >= 1 else t * t * (3 - 2 * t)
def farm_ground_y(x, z):
    y = prev = 0.0; ax = abs(x)
    ramp = 1 - _sm((ax - 1.5) / .5) if ax < 2.0 else 0.0
    for ez, eze, h in TIER_EDGES:
        step = h - prev; prev = h
        zmax = max(ez, eze if eze is not None else ez)
        t = .5 + min(14, max(0, ax - 30) * 1.5)
        e_at = zmax if ramp > 0 else (eze if (eze is not None and x > 0) else ez)
        wall = _sm((e_at + .3 - z) / t)
        y += step * ((_sm((zmax - z) / 8.5) * ramp + wall * (1 - ramp)) if ramp > 0 else wall)
    return y

def terrain_height(x, z):
    """three.js x / z → height (m): the farm tiers under the farm + a 30 m apron, then hills on top of the tier base."""
    b = BOUNDS
    dx = max(b['minX'] - x, 0, x - b['maxX']); dzn = max(b['minZ'] - z, 0); dzs = max(z - b['maxZ'], 0)
    d = math.hypot(dx, max(dzn, dzs))
    tier = farm_ground_y(x, z)
    ramp = max(0.0, min(1.0, (d - 30) / 60)); ramp = ramp * ramp * (3 - 2 * ramp)
    north = max(0.0, min(1.0, (b['minZ'] - 20 - z) / 90))                       # the highland ridge rises to the north
    base = ramp * (16 + 30 * north + 8 * (dzs > 0) * 0)
    n = mnoise.fractal(Vector((x / 70, z / 70, 1.7)), 1.0, 2.0, 4) * 10 * ramp
    ridge = (1 - abs(mnoise.noise(Vector((x / 120, z / 120, 4.1))))) ** 3 * 18 * ramp * (.4 + north)
    south = -0.5 * ramp * (dzs > 0) * 10                                           # gentler land behind the camera
    return tier + (max(-.2, base + n + ridge + south) if d > 30 else -.05)

def export_terrain(out_dir, step=4.0):
    purge(); M = env_mats()
    grass = M['grass'] if False else material('gb_terrain', farm_tex_image(), .95, spec=.25)
    x0, x1, z0, z1 = -180, 180, -240, 150
    nx, nz = int((x1 - x0) / step), int((z1 - z0) / step)
    H = [[terrain_height(x0 + i * step, z0 + j * step) for j in range(nz + 1)] for i in range(nx + 1)]
    rng = random.Random(21); trees = []
    chunks = {'north': [], 'east': [], 'west': [], 'south': []}
    def chunk_of(x, z):
        if z < BOUNDS['minZ'] - 20: return 'north'
        if z > BOUNDS['maxZ'] + 10: return 'south'
        return 'east' if x > 0 else 'west'
    mbs = {k: MB() for k in chunks}
    vid = {k: {} for k in chunks}
    def vert(k, i, j):
        key = (i, j)
        if key in vid[k]: return vid[k][key]
        x, z = x0 + i * step, z0 + j * step; h = H[i][j]
        # colour: contour-terraced coffee bands on mid slopes, darker forest on steep / high ground, lighter grass low
        hx = (H[min(nx, i + 1)][j] - H[max(0, i - 1)][j]) / (2 * step); hz = (H[i][min(nz, j + 1)] - H[i][max(0, j - 1)]) / (2 * step)
        slope = math.hypot(hx, hz)
        band = .5 + .5 * math.sin(h * 2.1)                                          # contour rows every ~3 m of height
        coffee = max(0.0, min(1.0, (h - 3) / 6)) * max(0.0, 1 - max(0, h - 32) / 10) * (slope < .6)
        forest = max(0.0, min(1.0, (slope - .35) * 2 + (h - 30) / 20))
        g = .78 - .22 * forest - .14 * coffee * band
        c = (g * .92, g, g * .8, 1)
        idx = mbs[k].add((x, -z, h), (x / 4, -z / 4), c); vid[k][key] = idx
        return idx
    for i in range(nx):
        for j in range(nz):
            xc, zc = x0 + (i + .5) * step, z0 + (j + .5) * step
            under = lambda ii, jj: H[ii][jj] - farm_ground_y(x0 + ii * step, z0 + jj * step)
            if max(under(i, j), under(i + 1, j), under(i, j + 1), under(i + 1, j + 1)) <= -.04: continue   # under the farm's own ground
            k = chunk_of(xc, zc)
            a, b2, c2, d2 = vert(k, i, j), vert(k, i + 1, j), vert(k, i + 1, j + 1), vert(k, i, j + 1)
            mbs[k].face((a, d2, c2, b2))                                            # Blender y = -z flips winding
            h = H[i][j]
            if h - farm_ground_y(xc, zc) > 6 and rng.random() < .05: trees.append([round(xc + rng.uniform(-1.5, 1.5), 1), round(h - .3, 2), round(zc + rng.uniform(-1.5, 1.5), 1), round(rng.uniform(.7, 1.3), 2)])
    os.makedirs(out_dir, exist_ok=True)
    for k, mb in mbs.items():
        if not mb.f: continue
        purge(); root = bpy.data.objects.new(f'terrain_{k}', None); bpy.context.scene.collection.objects.link(root)
        ob = node_obj(f'terrain_{k}_mesh', mb, grass); ob.parent = root
        export_glb(root.name, os.path.join(out_dir, f'terrain-{k}.glb'))
    meta = {'step': step, 'x0': x0, 'z0': z0, 'nx': nx, 'nz': nz, 'chunks': [k for k in mbs if mbs[k].f],
            'heights': [[round(H[i][j], 2) for j in range(nz + 1)] for i in range(0, nx + 1)], 'trees': trees}
    with open(os.path.join(out_dir, 'terrain-meta.json'), 'w') as f: json.dump(meta, f, separators=(',', ':'))
    print('terrain chunks', meta['chunks'], 'trees', len(trees))

def farm_tex_image():
    """The farm's grass tile (public/assets/farm/env/grass.jpg) packed into the terrain GLB."""
    p = os.path.join(_here, '..', '..', 'public', 'assets', 'farm', 'env', 'grass.jpg')
    img = bpy.data.images.load(os.path.abspath(p), check_existing=True); img.pack(); return img

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    out = sys.argv[sys.argv.index('--export') + 1]
    export_parts(os.path.join(out, 'farm', 'landscape-parts.glb'))
    purge(); r = gate_plaza(); export_glb(r.name, os.path.join(out, 'gedeo', 'gate-plaza.glb'))
    export_terrain(os.path.join(out, 'gedeo'))
