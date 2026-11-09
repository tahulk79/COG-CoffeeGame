"""Gedeo village life — villagers (rigged on the worker system) and farm animals (Blender 5.x, procedural only).

Real-world metres, origin at the feet, facing -Y in Blender (exported y-up, facing +Z in three.js like the workers).
Every GLB carries glTF animation clips (NLA tracks, in place, 30 fps).

People (18-bone worker rig + 'prop' bones for held objects; proportions re-scaled from the adult body):
  villager-child-f   bé gái làng        ~1.12 m  dress, hair puffs, plastic sandals        idle, walk, play (hop)
  villager-child-m   bé trai làng       ~1.22 m  T-shirt + shorts                          idle, walk, play (wave)
  villager-elder-f   bà cụ              ~1.57 m  habesha dress with border, white scarf    idle, walk, rest
  villager-elder-m   ông cụ chống gậy    ~1.63 m  old jacket, grey hair + beard, stick      idle, walk, sit
  coffee-buyer       thương lái cà phê   ~1.72 m  shirt, trousers, cap, shoulder bag, notebook  idle, walk, inspect
Animals (own armatures, Skin-modifier bodies, distance-weighted skinning):
  chicken            gà mái             ~0.40 m  shaped-mesh feathers                      idle, walk, peck
  chicken-rooster    gà trống           ~0.50 m  comb, hackles, sickle tail                idle, walk, peck
  goat               dê                 0.75 m at the shoulder, horns, beard           idle, walk, graze
  cow                bò u Boran         1.30 m at the shoulder, hump, dewlap           idle, walk, graze
  dog                chó làng           0.55 m at the shoulder, curled tail            idle, walk, wag
  beehive            đõ ong (tổ ong treo) log hive on a forked stand, bee swirl          idle (bees circle)

Run:  Blender -b --factory-startup -P scripts/blender/gedeo_villagers.py -- --export public/models/gedeo [--only cow,goat]
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_characters.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import noise as mnoise

# ───────────────────────────── shared helpers ─────────────────────────────

def smooth01(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)

def bump(t, a, b):
    """0 outside [a,b], smooth hump to 1 in the middle."""
    if t <= a or t >= b: return 0.0
    return math.sin(math.pi * (t - a) / (b - a)) ** 2

def padd(*ds):
    out = {}
    for d in ds:
        for k, v in d.items(): out.setdefault(k, []).extend(v)
    return out

def blob(mb, c, rx, ry, rz, col, seg=8, rings=5, rigid=None):
    """Axis-aligned ellipsoid (lat-long), outward normals."""
    c = Vector(c); grid = []
    for i in range(rings + 1):
        th = -math.pi / 2 + math.pi * i / rings; row = []
        for j in range(seg + 1):
            ph = TAU * j / seg
            p = c + Vector((math.cos(th) * math.cos(ph) * rx, math.cos(th) * math.sin(ph) * ry, math.sin(th) * rz))
            row.append(mb.add(p, (j / seg, i / rings), col, rigid=rigid) if isinstance(mb, SMB) else mb.add(p, (j / seg, i / rings), col))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))

def obox(mb, c, Rm, s, col):
    """Oriented box: centre, 3×3 rotation, full sizes."""
    hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2; c = Vector(c)
    P = lambda x, y, z: c + Rm @ Vector((x * hx, y * hy, z * hz))
    for f in [[(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)], [(-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)],
              [(1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)], [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)],
              [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)], [(-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)]]:
        quad(mb, [P(*q) for q in f], col, 4)

def merge_mb(a, b):
    off = len(a.v); a.v += b.v; a.uv += b.uv; a.col += b.col; a.rigid += b.rigid; a.f += [tuple(i + off for i in f) for f in b.f]

def rigid_from(mb, start, bone):
    for i in range(start, len(mb.v)): mb.rigid[i] = bone

def skin_mesh(pts, rads, edges, levels=1, max_tris=None):
    """Continuous organic body from a Skin-modifier graph (+ Catmull-Clark, optional decimate to a triangle budget)."""
    me = bpy.data.meshes.new('skin_src'); me.from_pydata([tuple(p) for p in pts], edges, [])
    ob = bpy.data.objects.new('skin_src', me); bpy.context.scene.collection.objects.link(ob)
    ob.modifiers.new('skin', 'SKIN')
    for i, r in enumerate(rads): me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = levels; sub.render_levels = levels
    sm = ob.modifiers.new('lap', 'LAPLACIANSMOOTH'); sm.iterations = 6; sm.lambda_factor = .6; sm.use_volume_preserve = True
    if max_tris:
        dg = bpy.context.evaluated_depsgraph_get(); n = sum(len(p.vertices) - 2 for p in ob.evaluated_get(dg).data.polygons)
        if n > max_tris: dec = ob.modifiers.new('dec', 'DECIMATE'); dec.ratio = max_tris / n
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    out = bpy.data.meshes.new_from_object(ev)
    V = [v.co.copy() for v in out.vertices]; F = [tuple(p.vertices) for p in out.polygons]
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me); bpy.data.meshes.remove(out)
    return V, F

def make_armature(name, bones):
    """bones: [(name, head, tail, parent)] in metres."""
    sc = bpy.context.scene
    ad = bpy.data.armatures.new(f'{name}_rig'); arm = bpy.data.objects.new(name, ad); sc.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects: o.select_set(False)
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, h, t, parent in bones:
        eb = ad.edit_bones.new(bn); eb.head = Vector(h); eb.tail = Vector(t); eb.roll = 0
        if parent: eb.parent = ad.edit_bones[parent]; eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    return arm

def bind_parts(arm, bones, parts, auto=None):
    """parts: [(SMB, material, object name)]. Rigid verts keep their bone(s); the rest weight to the nearest 3 `auto` bones."""
    auto = auto or [b for b, *_ in bones]
    seg = {b: (Vector(h), Vector(t)) for b, h, t, _ in bones if b in auto}
    objs = []
    for mb, M, nm in parts:
        if not mb.f: continue
        ob = mb.build(nm, M); bpy.context.scene.collection.objects.link(ob); ob.parent = arm
        for b, *_ in bones: ob.vertex_groups.new(name=b)
        for vi, co in enumerate(mb.v):
            rb = mb.rigid[vi]
            if isinstance(rb, dict):
                for b, w in rb.items(): ob.vertex_groups[b].add([vi], w, 'REPLACE')
                continue
            if rb: ob.vertex_groups[rb].add([vi], 1.0, 'REPLACE'); continue
            p = Vector(co); ds = sorted(((seg_dist(p, *seg[b])[0], b) for b in seg), key=lambda x: x[0])[:3]
            ws = [(b, 1 / max(d, .004) ** 4) for d, b in ds]; tot = sum(w for _, w in ws)
            for b, w in ws:
                if w / tot > .02: ob.vertex_groups[b].add([vi], w / tot, 'REPLACE')
        mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = arm
        objs.append(ob)
    return objs

def make_clips_from(arm, clips):
    """clips: [(name, frames, fn(t) -> (pose, root_z, root_y))]. Every bone is keyed on every sampled frame."""
    for name, frames, fn in clips: make_clip(arm, name, frames, fn)
    set_pose(arm, {})

# ───────────────────────────── textures ─────────────────────────────

def fur_tex(seed=301, size=512):
    """Short coat: soft mottling + fine hair streaks running along v."""
    rng = np.random.default_rng(seed)
    n = fbm(size, size, 4, 4, 4, rng); st = vnoise(size, size, 16, 128, rng); st2 = vnoise(size, size, 40, 256, rng)
    v = .84 + .16 * (n - .5) + .07 * (st - .5) + .09 * (st2 - .5)
    c = np.ones((size, size, 4), np.float32); c[..., :3] = np.clip(v, 0, 1)[..., None]; return c

def plumage_tex(size=256, rows=8, seed=311):
    """Overlapping scalloped body feathers (tileable)."""
    rng = np.random.default_rng(seed)
    Y, X = np.mgrid[0:size, 0:size].astype(np.float32) + .5; cell = size / rows
    r = np.floor(Y / cell); fx = (X / cell + .5 * (r % 2)) % 1 - .5; fy = (Y / cell) % 1
    d = np.sqrt(fx * fx + (1 - fy) ** 2 * .9)
    shade = .62 + .38 * np.clip(1 - d, 0, 1) - .22 * np.clip(1 - np.abs(d - .55) / .06, 0, 1)
    barb = .5 + .5 * np.sin((fx * 40 + fy * 6) * math.pi)
    n = fbm(size, size, 4, 4, 3, rng)
    v = shade * (.92 + .08 * barb) * (.9 + .2 * (n - .5))
    c = np.ones((size, size, 4), np.float32); c[..., :3] = np.clip(v, 0, 1)[..., None]; return c

def vane_tex(size=256, seed=312):
    """Single feather on a blade card: u across (0..1), v base→tip. Rachis, angled barbs, darker tip."""
    rng = np.random.default_rng(seed)
    Y, X = np.mgrid[0:size, 0:size].astype(np.float32) + .5
    u = X / size; v = 1 - Y / size; t = np.abs(u - .5) * 2
    rachis = np.exp(-(t / .045) ** 2)
    barbs = .5 + .5 * np.sin((v * 70 - t * 16) * math.pi)
    n = fbm(size, size, 3, 8, 3, rng)
    val = (.80 + .10 * barbs * (t > .06) + .10 * (n - .5)) * (1 - .25 * t ** 3) * (1 - .25 * np.clip((v - .8) * 5, 0, 1))
    val = val * (1 - .35 * rachis) + .95 * .35 * rachis
    c = np.ones((size, size, 4), np.float32); c[..., :3] = np.clip(val, 0, 1)[..., None]; return c

# ═════════════════════════════ PEOPLE ═════════════════════════════

PROP_BONES = {'prop.R': 'hand.R', 'prop.L': 'hand.L'}

PEOPLE = {
    'villager-child-f': dict(label='Bé gái làng', sex='f', height=1.12, legs=.90, head=.86, skin=(.40, .25, .17), top=(.90, .50, .32),
                             bottom=(.78, .30, .40), dress=True, dress_len=.40, border=(.97, .86, .42), sleeves='short',
                             shoes=(.85, .32, .50), hair='puffs', kind='child', play='hop'),
    'villager-child-m': dict(label='Bé trai làng', sex='m', height=1.22, legs=.90, head=.86, skin=(.35, .22, .15), top=(.22, .48, .72),
                             bottom=(.36, .32, .24), shorts=True, sleeves='short', shoes=(.20, .30, .55), hair='short', kind='child', play='wave'),
    'villager-elder-f': dict(label='Bà cụ', sex='f', height=1.59, head=.97, skin=(.37, .24, .16), top=(.93, .91, .86), bottom=(.93, .91, .86),
                             dress=True, dress_len=.10, border=(.15, .45, .40), sleeves='long', shoes=(.10, .09, .09), hair='scarf',
                             scarf=(.97, .96, .92), kind='elder', build=.95),
    'villager-elder-m': dict(label='Ông cụ chống gậy', sex='m', height=1.66, head=.97, skin=(.34, .22, .15), top=(.30, .27, .24),
                             bottom=(.44, .40, .33), sleeves='long', shoes=(.12, .10, .08), hair='grey', beard=True, stick=True,
                             kind='elder', build=.93),
    'coffee-buyer': dict(label='Thương lái cà phê', sex='m', height=1.74, head=1.0, skin=(.38, .25, .17), top=(.62, .74, .86),
                         bottom=(.25, .26, .31), sleeves='long', shoes=(.22, .14, .09), hair='cap', hat=(.80, .74, .62), bag=True,
                         notebook=True, kind='adult'),
}

def tibeb_skirt(mb, J, col, border, length=.08, flare=.12):
    """Lib skirt() reworked: fitted at the waist, outward winding, crisp woven tibeb bands at the hem (duplicated rings),
    and only the lower half follows the thighs a little so a stride does not tear the hem."""
    z0 = J['pelvis'].z + .06; z1 = length; seg = 20
    bands = [(0, .22, col), (.22, .45, col), (.45, .66, col), (.66, .80, col)]
    if border: bands += [(.80, .835, border), (.835, .87, col), (.87, .935, border), (.935, 1, col)]
    else: bands += [(.80, 1, col)]
    outer = []; inner = []
    for f0, f1, c in bands:
        rings = []
        for f in (f0, f1):
            z = z0 + (z1 - z0) * f; rad = .150 + (.03 + flare) * f ** 1.1 - .03 * (1 - f) ** 8; row = []
            for j in range(seg + 1):
                a = TAU * j / seg
                p = Vector((math.cos(a) * rad, math.sin(a) * rad * .80 + .01, z + .006 * math.sin(a * 5) * f))
                side = 'L' if p.x > 0 else 'R'; k = .22 * smooth01((f - .3) / .7) * min(1, abs(p.x) / .1)
                row.append(mb.add(p, (j / seg * 3, f * 2), c, rigid={'hips': 1 - k, f'thigh.{side}': k} if k > .01 else 'hips'))
            rings.append(row)
        for j in range(seg): mb.face((rings[0][j], rings[1][j], rings[1][j + 1], rings[0][j + 1]))
        rin = [[mb.add(Vector(mb.v[i]) * Vector((.985, .985, 1)), (0, 0), tuple(v * .45 for v in col[:3]) + (1,), rigid=mb.rigid[i]) for i in r] for r in rings]
        for j in range(seg): mb.face((rin[0][j], rin[0][j + 1], rin[1][j + 1], rin[1][j]))

def beard(mb, c, r, col):
    """Short grey beard + moustache: a shell over the jaw following the head sculpt."""
    rx, ry, rz = r; grid = []; NI, NJ = 5, 10
    for i in range(NI + 1):
        row = []
        for j in range(NJ + 1):
            o = (j / NJ - .5) * 2.3; ph = -math.pi / 2 + o
            th_top = -.62 + .42 * min(1, abs(o) / 1.1)
            th = -1.25 + (th_top + 1.25) * i / NI
            x, y, z = math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), math.sin(th)
            front = max(0, -y)
            sx = rx * (1 - .28 * max(0, -z) ** 1.3 * (.6 + .4 * front)); sz = rz
            p = c + Vector((x * sx, y * ry, z * sz)); p.y -= .008 * front * max(0, 1 - abs(z + .35) * 4)
            d = (p - c).normalized(); p = p + d * (.008 + .022 * max(0, -z) * (1 - i / NI * .5))
            row.append(mb.add(p, (j / NJ, i / NI), col, rigid='head'))
        grid.append(row)
    for i in range(NI):
        for j in range(NJ): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    fr = c + Vector((0, -ry * .93, 0)); s0 = len(mb.v)
    for sx in (-1, 1): ellipsoid(mb, fr + Vector((sx * .014, -.002, -.040)), Vector((1, 0, -.35 * sx)), .018, .006, col, 8, 3)
    rigid_from(mb, s0, 'head')

def shoulder_bag(mb, col, strap):
    """Leather messenger bag at the left hip, strap over the right shoulder (front + back runs)."""
    s0 = len(mb.v)
    superellipsoid(mb, Vector((.215, .02, .90)), (.075, .27, .22), col=col, e=.35, seg=10, rings=6)
    superellipsoid(mb, Vector((.257, .02, .955)), (.012, .27, .12), col=tuple(v * .8 for v in col[:3]) + (1,), e=.3, seg=8, rings=4)  # flap
    rigid_from(mb, s0, 'hips')
    for run in ([(-.12, .0, 1.455), (-.065, -.118, 1.36), (.04, -.128, 1.20), (.15, -.095, 1.03), (.21, -.06, .99)],
                [(-.12, .0, 1.455), (-.06, .115, 1.33), (.07, .118, 1.15), (.17, .10, 1.02), (.21, .10, .99)]):
        pts = [Vector(p) for p in run]; s1 = len(mb.v)
        tube(mb, pts, [.011] * len(pts), 4, col=strap)
        for i in range(s1, len(mb.v)):
            z = mb.v[i][2]; k = min(1, max(0, (z - 1.0) / .2))
            mb.rigid[i] = {'chest': k, 'hips': 1 - k} if 0 < k < 1 else ('chest' if k >= 1 else 'hips')

def reproportion(mb, J, R):
    """Scale the adult build to the target height: legs by an extra factor (children), head by its own factor."""
    sh, kl = R.get('head', 1.0), R.get('legs', 1.0)
    nt = J['neck_top']; zh = J['hip.L'].z; topA = max(v[2] for v in mb.v)
    sb = (R['height'] - (topA - nt.z) * sh) / (zh * kl + nt.z - zh)
    def g(p):
        z = p.z * sb * kl if p.z < zh else zh * sb * kl + (p.z - zh) * sb
        return Vector((p.x * sb, p.y * sb, z))
    nt2 = g(nt)
    for i, co in enumerate(mb.v):
        p = Vector(co)
        mb.v[i] = tuple(nt2 + (p - nt) * sh if mb.rigid[i] == 'head' else g(p))
    J2 = {k: g(v) for k, v in J.items()}; J2['head_top'] = nt2 + (J['head_top'] - nt) * sh
    return J2, sb, g

def posed_prop(arm, bone, base_pose, build):
    """Build a held object in the posed armature space of `base_pose`, then store it in rest space on prop bone."""
    set_pose(arm, base_pose); bpy.context.view_layer.update()
    pb = arm.pose.bones[bone]; Mp = pb.matrix @ pb.bone.matrix_local.inverted()
    mb = SMB(); ax = build(mb, Vector(pb.head).lerp(Vector(pb.tail), .55), pb.matrix.to_3x3())
    inv = Mp.inverted(); prop = 'prop.' + bone[-1]
    if ax: arm[prop + '_axis'] = list((inv.to_3x3() @ (ax[1] - ax[0])).normalized()); arm[prop + '_len'] = (ax[1] - ax[0]).length
    for i in range(len(mb.v)): mb.v[i] = tuple(inv @ Vector(mb.v[i])); mb.rigid[i] = prop
    set_pose(arm, {}); bpy.context.view_layer.update()
    return mb

STICK_ARM = {'upper_arm.R': [(X, -14), (Y, 5)], 'forearm.R': [(X, -36)], 'hand.R': [(X, 4)]}
BOOK_ARM = {'upper_arm.L': [(X, -26), (Y, -8)], 'forearm.L': [(Z, -28), (X, -72)], 'hand.L': [(Z, 15), (X, 10)]}
STOOP = {'spine': [(X, 9)], 'chest': [(X, 8)], 'neck': [(X, -5)], 'head': [(X, -9)],
         'thigh.L': [(X, -5)], 'thigh.R': [(X, -5)], 'shin.L': [(X, 10)], 'shin.R': [(X, 10)], 'foot.L': [(X, -5)], 'foot.R': [(X, -5)]}

def build_person(key):
    R = PEOPLE[key]; rng = random.Random(len(key) * 7919); sex = R['sex']; J = joints(sex)
    skin = lin(R['skin']); top = lin(R['top']); bottom = lin(R['bottom']); shoes = lin(R['shoes'])
    mb = SMB()
    V, F = skin_body(J, sex, R.get('build', 1.0))
    bone_seg = {b: (J[h], J[t]) for b, h, t, _ in BONES}
    knee_z = J['knee.L'].z
    def region_col(p):
        d, best = min(((seg_dist(p, *bone_seg[b])[0], b) for b in bone_seg), key=lambda x: x[0])
        if best.startswith('hand'): return skin
        if best.startswith('foot') or p.z < .13: return shoes
        if best.startswith('shin') or best.startswith('thigh'):
            if R.get('dress') and p.z < knee_z - .05: return skin
            if R.get('shorts') and p.z < knee_z + .11: return skin
            return bottom
        if best.startswith('forearm'): return top if R['sleeves'] == 'long' else skin
        if best.startswith('upper_arm') and R['sleeves'] == 'short' and seg_dist(p, *bone_seg[best])[1] > .45: return skin
        if best in ('neck', 'head'): return skin if p.z > J['neck'].z + .01 else top
        if best == 'hips': return bottom if not R.get('dress') else top
        return top
    for p in V: mb.add(p, ((p.x + p.y) * 3, p.z * 3), region_col(p))
    for f in F: mb.face(f)
    c, r = head_mesh(mb, J, sex, skin, rng)
    hair = R['hair']; black = (.02, .015, .012, 1)
    if hair == 'scarf': headscarf(mb, c, r, lin(R['scarf']), rng)
    elif hair == 'grey': hair_cap(mb, c, r, lin((.62, .61, .58)), sex)
    else:
        hair_cap(mb, c, r, black, sex)
        if hair == 'cap': cap(mb, c, r, lin(R['hat']))
        if hair == 'puffs':
            for sx in (-1, 1): blob(mb, c + Vector((sx * .058, .02, .085)), .042, .042, .040, black, 8, 5, rigid='head')
    if R.get('beard'): beard(mb, c, r, lin((.70, .69, .66)))
    if R.get('dress'): tibeb_skirt(mb, J, top if key.endswith('elder-f') else bottom, lin(R['border']) if R.get('border') else None,
                                   length=R['dress_len'], flare=.045 if R['kind'] == 'child' else .13)
    if R.get('bag'): shoulder_bag(mb, lin((.40, .27, .15)), lin((.25, .17, .10)))
    # pen in the buyer's right hand (rest space along the hand)
    tb = SMB()
    if R.get('notebook'):
        a = J['wrist.R'].lerp(J['hand.R'], .55) + Vector((0, -.022, 0)); s0 = len(tb.v)
        tube(tb, [a + Vector((0, 0, .05)), a + Vector((0, -.004, -.075))], [.0045, .003], 5, col=(.05, .06, .12, 1), cap=True)
        rigid_from(tb, s0, 'hand.R')
    J, sb, g = reproportion(mb, J, R)
    tb.v = [tuple(g(Vector(p))) for p in tb.v]
    # skeleton (+ prop bones parented to the hands)
    bones = [(b, J[h], J[t], par) for b, h, t, par in BONES]
    bones += [(pb, J[hb], J[hb] + Vector((0, 0, -.08)), hb) for pb, hb in PROP_BONES.items()]
    arm = make_armature(key, bones)
    if R.get('stick'):
        def stick(m, grip, Rm):
            top_ = grip + Vector((0, -.01, .07)); bot = Vector((grip.x - .03, grip.y - .10, 0.012))
            pts = [top_ + Vector((.0, .012, .025)), top_, top_.lerp(bot, .35) + Vector((.006, 0, 0)), top_.lerp(bot, .7) + Vector((-.004, .003, 0)), bot]
            tube(m, pts, [.016, .015, .014, .013, .012], 6, col=lin((.48, .36, .24)), cap=True)
            return top_, bot
        merge_mb(tb, posed_prop(arm, 'hand.R', padd(STOOP, STICK_ARM), stick))
    if R.get('notebook'):
        def book(m, grip, Rm):
            Rb = Matrix.Rotation(math.radians(-62), 3, 'X') @ Matrix.Rotation(math.radians(-12), 3, 'Z')
            ctr = grip + Vector((-.045, -.035, .035))
            obox(m, ctr, Rb, (.115, .155, .012), lin((.12, .22, .45)))
            obox(m, ctr + Rb @ Vector((.004, 0, .004)), Rb, (.108, .148, .010), lin((.93, .92, .86)))
        merge_mb(tb, posed_prop(arm, 'hand.L', BOOK_ARM, book))
    M = material('char_cloth', to_image('T_char_cloth', cloth_tex), .82, spec=.35)
    objs = bind_parts(arm, bones, [(mb, M, f'{key}_body'), (tb, M, f'{key}_prop')], auto=[b for b, *_ in BONES])
    person_clips(arm, J, R, sb)
    return arm, objs

def aim_prop(arm, pose, prop, target_fn, rz=0.0, ry=0.0):
    """Pose entry for a prop bone so its object points along target_fn(grip) (world) in `pose` — e.g. a stick laid on the ground."""
    P = dict(pose); P.pop(prop, None); set_pose(arm, P, rz, ry); bpy.context.view_layer.update()
    pb = arm.pose.bones[prop]; A = pb.matrix.to_3x3()
    cur = (A @ pb.bone.matrix_local.to_3x3().inverted() @ Vector(arm[prop + '_axis'])).normalized()
    want = target_fn(Vector(pb.head)).normalized()
    qw = cur.rotation_difference(want); Am = A.to_quaternion()
    ql = Am.inverted() @ qw @ Am                      # same rotation expressed in the bone's local frame
    ax, ang = ql.to_axis_angle(); set_pose(arm, {})
    return [(pb.bone.matrix_local.to_3x3() @ ax, math.degrees(ang))]

def leg_drop(J, th, sh):
    Lt = (J['knee.L'] - J['hip.L']).length; Ls = (J['ankle.L'] - J['knee.L']).length
    return Lt * (1 - math.cos(math.radians(th))) + Ls * (1 - math.cos(math.radians(th + sh)))

def lib_idle(t):
    b = math.sin(t * TAU)
    return {'spine': [(X, 1.5 * b)], 'chest': [(X, 1 * b)], 'head': [(Z, 6 * math.sin(t * TAU + 1)), (X, -2)],
            'upper_arm.L': [(Y, -6), (X, 2 * b)], 'upper_arm.R': [(Y, 6), (X, 2 * b)], 'forearm.L': [(X, -12)], 'forearm.R': [(X, -12)],
            'thigh.L': [(Y, -2)], 'thigh.R': [(Y, 2)]}

def person_clips(arm, J, R, sb):
    kind = R['kind']; clips = []
    if kind == 'child':
        def idle(t):
            P = lib_idle(t); P['head'] = [(Z, 14 * math.sin(t * TAU * 2 + 1)), (X, -4)]
            P['hips'] = [(Z, 4 * math.sin(t * TAU))]
            return P, 0, 0
        def walk(t): P, rz = walk_pose(t, arm_swing=1.15, stride=1.1); return P, rz * sb, 0
        def hop(t):
            p = (t * 2) % 1
            cr = max(0, 1 - min(p, 1 - p) / .2); cr = smooth01(cr)
            air = math.sin((p - .2) / .55 * math.pi) if .2 < p < .75 else 0
            th, sh = -38 * cr - 12 * air, 74 * cr + 28 * air
            P = {'spine': [(X, 16 * cr)], 'head': [(X, -10 * cr + 4 * air)]}
            for s in 'LR':
                P[f'thigh.{s}'] = [(X, th), (Y, sym(s, -3))]; P[f'shin.{s}'] = [(X, sh)]; P[f'foot.{s}'] = [(X, -(th + sh) + 20 * air)]
                P[f'upper_arm.{s}'] = [(X, 20 * cr - 55 * air), (Y, sym(s, -28 * air - 6))]; P[f'forearm.{s}'] = [(X, -20 - 35 * air)]
            return P, -leg_drop(J, -th, sh) * (1 - air) + .16 * air, 0
        def wave(t):
            w = math.sin(t * TAU * 4); bnc = abs(math.sin(t * TAU * 2))
            P = {'upper_arm.R': [(Y, 95), (X, -18)], 'forearm.R': [(Y, 60 + 28 * w)], 'hand.R': [(Y, 12 * w)],
                 'upper_arm.L': [(Y, -14), (X, 6 * math.sin(t * TAU * 2))], 'forearm.L': [(X, -15)],
                 'head': [(Y, -8), (Z, 6 * math.sin(t * TAU))], 'chest': [(Y, -4)], 'spine': [(Z, 5 * math.sin(t * TAU))]}
            for s in 'LR': P[f'thigh.{s}'] = [(X, -8 * bnc)]; P[f'shin.{s}'] = [(X, 16 * bnc)]; P[f'foot.{s}'] = [(X, -8 * bnc + 6 * (1 - bnc))]
            return P, -leg_drop(J, 8 * bnc, 16 * bnc) + .025 * (1 - bnc), 0
        clips = [('idle', 60, idle), ('walk', 24, walk), ('play', 48, hop if R['play'] == 'hop' else wave)]
    elif kind == 'elder':
        stick = R.get('stick'); base = padd(STOOP, STICK_ARM) if stick else STOOP
        dz = -leg_drop(J, 5, 10)
        def idle(t):
            b = math.sin(t * TAU); P = padd(STOOP, {'spine': [(X, 1.5 * b)], 'head': [(Z, 9 * math.sin(t * TAU + 1))]})
            if stick:
                P = padd(P, STICK_ARM, {'upper_arm.L': [(Y, -6), (X, 2 * b)], 'forearm.L': [(X, -14)]})
            else:
                P = padd(P, {'upper_arm.L': [(Y, -7), (X, 3 * b)], 'upper_arm.R': [(Y, 7), (X, 3 * b)], 'forearm.L': [(X, -14)], 'forearm.R': [(X, -14)]})
            return P, dz, 0
        def walk(t):
            P, rz = walk_pose(t, arm_swing=.55, stride=.62)
            P = padd(P, STOOP)
            if stick:
                for k in ('upper_arm.R', 'forearm.R', 'hand.R'): P[k] = list(STICK_ARM[k])
                P['upper_arm.R'] = P['upper_arm.R'] + [(X, -7 * math.sin(t * TAU))]
            return P, rz * .6 + dz, 0
        def sit(t):
            # sitting on the ground, legs out in front, left hand on the knee, stick across the lap
            b = math.sin(t * TAU)
            P = {'spine': [(X, 10 + 1.5 * b)], 'chest': [(X, 6)], 'neck': [(X, -4)], 'head': [(X, -10), (Z, 12 * math.sin(t * TAU + .6))],
                 'thigh.L': [(X, -84), (Y, -5)], 'thigh.R': [(X, -84), (Y, 5)], 'shin.L': [(X, 6)], 'shin.R': [(X, 10)],
                 'foot.L': [(X, 50)], 'foot.R': [(X, 46)],
                 'upper_arm.L': [(X, -18), (Y, -4)], 'forearm.L': [(X, -48)], 'hand.L': [(X, -10)],
                 'upper_arm.R': [(X, -20), (Y, 6)], 'forearm.R': [(X, -55)], 'hand.R': [(X, -12)], 'prop.R': [(X, -62)]}
            return P, -(J['pelvis'].z - .16), .02
        def rest(t):
            # standing rest: hands folded at the waist, slow weight shift and look round
            b = math.sin(t * TAU)
            P = padd(STOOP, {'hips': [(Y, 2.5 * b)], 'spine': [(Y, -2 * b)], 'head': [(Z, 16 * math.sin(t * TAU + .4)), (Y, 3 * b)],
                             'upper_arm.L': [(X, -14), (Y, 6)], 'upper_arm.R': [(X, -14), (Y, -6)],
                             'forearm.L': [(Z, -38), (X, -78)], 'forearm.R': [(Z, 38), (X, -78)],
                             'thigh.L': [(Y, -3 + 2 * b)], 'thigh.R': [(Y, 3 + 2 * b)]})
            return P, dz, 0
        if stick:   # stick rests on the ground ahead-right, still in his hand
            L = arm['prop.R_len']
            def to_ground(g):
                h = g.z - .02; d = math.sqrt(max(.01, L * L - h * h)); return Vector((-.42 * d, -.91 * d, -h))
            stick_aim = aim_prop(arm, *sit(0)[:1], 'prop.R', to_ground, *sit(0)[1:])
            sit0 = sit
            def sit(t): P, rz, ry = sit0(t); P['prop.R'] = stick_aim; return P, rz, ry
        clips = [('idle', 72, idle), ('walk', 44, walk), ('sit', 90, sit) if stick else ('rest', 120, rest)]
    else:   # coffee buyer
        def idle(t):
            b = math.sin(t * TAU); P = padd(lib_idle(t), {})
            for k in ('upper_arm.L', 'forearm.L', 'hand.L'): P[k] = list(BOOK_ARM[k])
            P['upper_arm.L'] = P['upper_arm.L'] + [(X, 2 * b)]
            return P, 0, 0
        def walk(t):
            P, rz = walk_pose(t)
            for k in ('upper_arm.L', 'forearm.L', 'hand.L'): P[k] = list(BOOK_ARM[k])
            P['upper_arm.L'] = P['upper_arm.L'] + [(X, 4 * math.sin(t * TAU))]
            return P, rz, 0
        def inspect(t):
            # bend to a sack/branch, take a cherry, raise it to the eye, then write in the notebook
            reach = bump(t, 0, .42); look = bump(t, .30, .66); write = bump(t, .58, 1.0)
            scrib = math.sin(t * TAU * 9) * 4 * write
            P = {'spine': [(X, 22 * reach + 4 * look + 6 * write)], 'chest': [(X, 8 * reach)],
                 'head': [(X, 14 * reach - 6 * look + 16 * write), (Z, 10 * look - 6 * write)],
                 'upper_arm.R': [(X, -48 * reach - 62 * look - 38 * write), (Y, 8)],
                 'forearm.R': [(Z, 30 * write), (X, -22 * reach - 70 * look - 62 * write + scrib)],
                 'hand.R': [(X, -10 * look)],
                 'thigh.L': [(X, -6 * reach), (Y, -3)], 'thigh.R': [(Y, 3)], 'shin.L': [(X, 10 * reach)]}
            P.update({k: list(v) for k, v in BOOK_ARM.items()})
            P['upper_arm.L'] = P['upper_arm.L'] + [(X, -8 * write)]
            return P, -leg_drop(J, 6 * reach, 10 * reach) * .5, 0
        clips = [('idle', 72, idle), ('walk', 32, walk), ('inspect', 96, inspect)]
    make_clips_from(arm, clips)

# ═════════════════════════════ QUADRUPEDS ═════════════════════════════

QUADS = {
    # Hs shoulder height, BL body length, BD barrel depth, BW barrel width, lr leg radius, NL neck length, na neck angle (° up),
    # HL head length, ha head angle (° from horizontal, − = down), hr head radius, mr muzzle radius factor, TL tail length
    'cow': dict(label='Bò u Boran', Hs=1.30, BL=1.45, BD=.68, BW=.56, lr=.058, NL=.60, na=24, HL=.46, ha=-60, hr=.13, mr=.80, TL=.85, neckk=1.35, nlow=.06,
                tail_dir=(0, .15, -1), fps=(36, 90, 96)),
    'goat': dict(label='Dê', Hs=.75, BL=.80, BD=.34, BW=.30, lr=.026, NL=.38, na=46, HL=.25, ha=-42, hr=.066, mr=.62, TL=.09, neckk=1.1, nlow=.10,
                 tail_dir=(0, .45, .9), fps=(28, 72, 90)),
    'dog': dict(label='Chó làng', Hs=.55, BL=.60, BD=.29, BW=.24, lr=.023, NL=.20, na=48, HL=.21, ha=-8, hr=.066, mr=.55, TL=.30,
                tail_dir=(0, .35, .95), tail_curl=(0, -.35, .6), fps=(22, 72, 30), tuck=.80, neckk=1.2),
}

def quad_skeleton(Q):
    Hs, BL, BD, BW, lr = Q['Hs'], Q['BL'], Q['BD'], Q['BW'], Q['lr']
    zc = Hs - BD * .5; belly = Hs - BD; Lg = belly; tuck = Q.get('tuck', 1.0)
    N = {}   # name: (pos, (rx, rz))
    N['mid'] = ((0, 0, zc), (BW * .50, BD * .50 * (.5 + .5 * tuck))) if tuck < 1 else ((0, 0, zc), (BW * .50, BD * .50))
    if tuck < 1: N['mid'] = ((0, .02, zc + BD * .5 * (1 - tuck) * .5), (BW * .42, BD * .5 * tuck))
    N['pelvis'] = ((0, BL * .30, zc + BD * .03), (BW * .45, BD * .44 * (1 if tuck == 1 else .85)))
    N['rump'] = ((0, BL * .50, zc + BD * .08), (BW * .34, BD * .34))
    N['chest'] = ((0, -BL * .28, zc + BD * .02), (BW * .47, BD * .50))
    N['brisket'] = ((0, -BL * .46, zc - BD * .02), (BW * .34, BD * .40))
    nb = Vector((0, -BL * .50, zc + BD * (.22 - Q.get('nlow', 0) * 2))); nd = Vector((0, -math.cos(math.radians(Q['na'])), math.sin(math.radians(Q['na']))))
    poll = nb + nd * Q['NL']; hd = Vector((0, -math.cos(math.radians(Q['ha'])), math.sin(math.radians(Q['ha']))))
    muz = poll + hd * Q['HL']
    nk = Q.get('neckk', 1.0)
    N['nb'] = (tuple(nb), (BW * .27 * nk, BD * .30 * nk)); N['nm'] = (tuple(nb + nd * Q['NL'] * .5), (BW * .19 * nk, BD * .23 * nk))
    N['poll'] = (tuple(poll), (Q['hr'] * .85, Q['hr'] * .95)); N['hm'] = (tuple(poll + hd * Q['HL'] * .45), (Q['hr'] * .80, Q['hr'] * .85))
    N['muz'] = (tuple(muz - hd * Q['hr'] * Q['mr'] * .6), (Q['hr'] * Q['mr'], Q['hr'] * Q['mr'] * 1.05))
    for s, sx in (('L', 1), ('R', -1)):
        x = BW * .30 * sx
        N[f'sh.{s}'] = ((x * .9, -BL * .33, zc - BD * .24), (lr * 1.9, lr * 2.3))
        N[f'elb.{s}'] = ((x * .95, -BL * .31, belly + Lg * .02), (lr * 1.6, lr * 1.8))
        N[f'knee.{s}'] = ((x * .92, -BL * .34, Lg * .42), (lr * .95, lr * 1.0))
        N[f'fet.{s}'] = ((x * .92, -BL * .35, Lg * .11), (lr * .70, lr * .72))
        N[f'hoof.{s}'] = ((x * .92, -BL * .37, lr * .45), (lr * .85, lr * .9))
        N[f'hip.{s}'] = ((x * .95, BL * .32, zc - BD * .16), (lr * 2.5, lr * 2.8))
        N[f'stif.{s}'] = ((x * 1.12, BL * .20, belly + Lg * .10), (lr * 1.8, lr * 2.0))
        N[f'hock.{s}'] = ((x * .95, BL * .43, Lg * .47), (lr * .85, lr * .95))
        N[f'hfet.{s}'] = ((x * .92, BL * .38, Lg * .11), (lr * .70, lr * .72))
        N[f'hhoof.{s}'] = ((x * .92, BL * .37, lr * .45), (lr * .85, lr * .9))
    td = Vector(Q['tail_dir']).normalized(); tb = Vector((0, BL * .54, zc + BD * .30))
    N['tb'] = (tuple(tb), (lr * .9, lr * .9)); N['t1'] = (tuple(tb + td * Q['TL'] * .5), (lr * .45, lr * .45))
    t2 = tb + td * Q['TL'] if 'tail_curl' not in Q else tb + td * Q['TL'] * .5 + Vector(Q['tail_curl']).normalized() * Q['TL'] * .5
    N['t2'] = (tuple(t2), (lr * .3, lr * .3))
    E = [('mid', 'pelvis'), ('pelvis', 'rump'), ('mid', 'chest'), ('chest', 'brisket'), ('brisket', 'nb'), ('nb', 'nm'), ('nm', 'poll'),
         ('poll', 'hm'), ('hm', 'muz'), ('rump', 'tb'), ('tb', 't1'), ('t1', 't2')]
    for s in 'LR':
        E += [('chest', f'sh.{s}'), (f'sh.{s}', f'elb.{s}'), (f'elb.{s}', f'knee.{s}'), (f'knee.{s}', f'fet.{s}'), (f'fet.{s}', f'hoof.{s}'),
              ('pelvis', f'hip.{s}'), (f'hip.{s}', f'stif.{s}'), (f'stif.{s}', f'hock.{s}'), (f'hock.{s}', f'hfet.{s}'), (f'hfet.{s}', f'hhoof.{s}')]
    P = {k: Vector(v[0]) for k, v in N.items()}
    bones = [('hips', P['pelvis'], P['mid'], None), ('spine', P['mid'], P['brisket'], 'hips'),
             ('neck', P['nb'], P['poll'], 'spine'), ('head', P['poll'], P['muz'], 'neck'),
             ('tail1', P['tb'], P['t1'], 'hips'), ('tail2', P['t1'], P['t2'], 'tail1')]
    for s in 'LR':
        bones += [(f'upper_arm.{s}', P[f'sh.{s}'], P[f'elb.{s}'], 'spine'), (f'forearm.{s}', P[f'elb.{s}'], P[f'knee.{s}'], f'upper_arm.{s}'),
                  (f'hand.{s}', P[f'knee.{s}'], P[f'hoof.{s}'] - Vector((0, 0, lr * .45)), f'forearm.{s}'),
                  (f'thigh.{s}', P[f'hip.{s}'], P[f'stif.{s}'], 'hips'), (f'shin.{s}', P[f'stif.{s}'], P[f'hock.{s}'], f'thigh.{s}'),
                  (f'foot.{s}', P[f'hock.{s}'], P[f'hhoof.{s}'] - Vector((0, 0, lr * .45)), f'shin.{s}')]
    return N, E, P, bones

def build_quad(key):
    Q = QUADS[key]; rng = random.Random(len(key) * 31); N, E, P, bones = quad_skeleton(Q)
    extra_nodes = {}
    if key == 'cow':   # hump over the withers, dewlap under the neck
        extra_nodes['hump'] = ((0, -Q['BL'] * .36, Q['Hs'] + .02), (.13, .15), 'chest')
        extra_nodes['dew1'] = ((0, -Q['BL'] * .50, Q['Hs'] - Q['BD'] + .12), (.035, .12), 'brisket')
        extra_nodes['dew2'] = ((0, -Q['BL'] * .50 - .17, Q['Hs'] - Q['BD'] + .30), (.03, .09), 'dew1')
    if key == 'dog':   # paws reach forward
        for s, sx in (('L', 1), ('R', -1)):
            extra_nodes[f'paw.{s}'] = ((Q['BW'] * .28 * sx, -Q['BL'] * .37 - .035, Q['lr'] * .55), (Q['lr'] * .95, Q['lr'] * .6), f'hoof.{s}')
            extra_nodes[f'hpaw.{s}'] = ((Q['BW'] * .28 * sx, Q['BL'] * .37 - .035, Q['lr'] * .55), (Q['lr'] * .95, Q['lr'] * .6), f'hhoof.{s}')
    names = list(N) + list(extra_nodes); idx = {n: i for i, n in enumerate(names)}
    pts = [N[n][0] for n in N] + [v[0] for v in extra_nodes.values()]
    rads = [N[n][1] for n in N] + [v[1] for v in extra_nodes.values()]
    edges = [(idx[a], idx[b]) for a, b in E] + [(idx[k], idx[v[2]]) for k, v in extra_nodes.items()]
    # root first so the skin root is the barrel centre
    V, F = skin_mesh(pts, rads, edges, levels=2, max_tris=6200)
    mb = SMB(); body_col = quad_colouring(key, Q, P); uvk = 2.2 / Q['Hs'] ** .5
    for p in V: mb.add(p, ((p.x * .6 + p.y) * uvk, p.z * uvk), body_col(p))
    for f in F: mb.face(f)
    quad_details(key, Q, P, mb, rng)
    # lower jaw: skin under the mouth line, toward the muzzle, follows a 'jaw' bone (chewing)
    poll, muz = P['poll'], P['muz']; hd = (muz - poll).normalized(); up = hd.cross(Vector((1, 0, 0))).normalized()
    if up.z < 0: up = -up
    HL, hr = Q['HL'], Q['hr']
    for i, co in enumerate(mb.v):
        if mb.rigid[i] is not None: continue
        q = Vector(co) - poll; a = q.dot(hd); b = q.dot(up)
        if a < HL * .2 or (q - hd * a).length > hr * 1.4: continue
        w = smooth01((a - HL * .25) / (HL * .2)) * smooth01((-b - hr * .02) / (hr * .2))
        if w > .02: mb.rigid[i] = {'head': 1 - w, 'jaw': w}
    bones = bones + [('jaw', poll + hd * HL * .3 - up * hr * .25, muz - up * hr * .45, 'head')]
    M = material(f'anim_fur_{key}', to_image('T_anim_fur', fur_tex), .88, two_sided=True, spec=.3)
    arm = make_armature(key, bones)
    objs = bind_parts(arm, bones, [(mb, M, f'{key}_body')])
    quad_clips(arm, key, Q)
    return arm, objs

def quad_colouring(key, Q, P):
    Hs, BD = Q['Hs'], Q['BD']; head_c = P['hm']; muz = P['muz']
    def n3(p, s): return mnoise.noise(Vector((p.x * s + 3.1, p.y * s + 1.7, p.z * s + .4)))
    if key == 'cow':
        base, dark = lin((.86, .84, .79)), lin((.42, .41, .40))
        def f(p):
            if p.z < Q['lr'] * 1.0: return lin((.10, .09, .08))                               # hooves
            if (p - muz).length < Q['hr'] * .75 and p.y < muz.y + .05: return lin((.16, .15, .14))  # muzzle
            k = 0.0
            if p.y < -Q['BL'] * .25 and p.z > Hs - .12: k = .7                                   # hump + top of neck
            if p.y < -Q['BL'] * .45: k = max(k, .35 + .25 * (p.z > Hs - .25))                   # neck shading
            if (p - head_c).length < Q['hr'] * 1.3: k = max(k, .35)
            if p.z < Q['lr'] * 6: k = max(k, .25)
            k = min(1, max(0, k + .15 * n3(p, 3)))
            return tuple(base[i] * (1 - k) + dark[i] * k for i in range(3)) + (1,)
        return f
    if key == 'goat':
        brown, black, cream = lin((.46, .30, .17)), lin((.07, .06, .05)), lin((.80, .72, .58))
        def f(p):
            if p.z < Q['lr'] * 1.1: return lin((.12, .10, .08))
            if abs(p.x) < .03 and p.z > Hs - .05 and -Q['BL'] * .45 < p.y < Q['BL'] * .5: return black      # dorsal stripe
            if p.z < (Hs - BD) * .55: return black                                                  # dark lower legs
            if (p - muz).length < Q['hr'] * .6: return lin((.18, .14, .11))
            if n3(p, 4.5) > .32: return black
            if p.z < Hs - BD * .85 and abs(p.y) < Q['BL'] * .3: return cream                      # pale belly
            return brown
        return f
    # dog: ginger-tan, cream chest / belly / paws, dark muzzle tip
    tan, cream = lin((.70, .46, .24)), lin((.90, .82, .66))
    def f(p):
        if (p - muz).length < Q['hr'] * .45 and p.y < muz.y: return lin((.22, .16, .12))
        if p.z < Q['lr'] * 2.2: return cream
        if p.y < -Q['BL'] * .38 and p.z < Q['Hs'] - Q['BD'] * .45 and abs(p.x) < .06: return cream
        if p.z < Q['Hs'] - Q['BD'] * .9 and abs(p.y) < Q['BL'] * .35: return cream
        k = .5 + .5 * n3(p, 5)
        return tuple(tan[i] * (.9 + .15 * k) for i in range(3)) + (1,)
    return f

def quad_details(key, Q, P, mb, rng):
    poll, muz, hm = P['poll'], P['muz'], P['hm']; hr = Q['hr']
    hd = (muz - poll).normalized(); side = Vector((1, 0, 0)); up = hd.cross(side).normalized()
    if up.z < 0: up = -up
    eyec = lin((.04, .03, .025)); HL = Q['HL']
    # the subdivided + smoothed head sits inside the skin radii, so face details are snapped onto the real surface
    surf = []
    for co in mb.v:
        q = Vector(co) - poll; a = q.dot(hd)
        if -hr * .5 < a < HL + hr and (q - hd * a).length < hr * 1.8: surf.append((Vector(co), a, q.dot(up), co[0]))
    def snap(score, cond=lambda a, b, x: True):
        return max((t for t in surf if cond(t[1], t[2], t[3])), key=lambda t: score(*t[1:]))[0]
    def nearest(p): return min(surf, key=lambda t: (t[0] - p).length)[0]
    s0 = len(mb.v)
    for sx in (-1, 1):
        # eyes on the sides of the head, a third of the way down the face (half sunk into the surface)
        e = nearest(poll + hd * HL * .30 + side * sx * hr * .78 + up * hr * .35); e = e + side * sx * .003
        blob(mb, e, .012 if key != 'cow' else .017, .014 if key != 'cow' else .02, .011 if key != 'cow' else .016, eyec, 8, 4, rigid='head')
        # nostrils
        n_ = snap(lambda a, b, x: a + 1.1 * sx * x + .25 * b, lambda a, b, x: a > HL * .7 and sx * x > 0 and abs(x) < hr * Q['mr'] * .55)
        blob(mb, n_, .008 * (1 + (key == 'cow')), .008, .006 * (1 + (key == 'cow')), (.02, .02, .02, 1), 6, 3, rigid='head')
    if key == 'dog': blob(mb, snap(lambda a, b, x: a + .35 * b - 2 * abs(x)), .02, .016, .016, (.02, .02, .02, 1), 8, 4, rigid='head')
    chin = snap(lambda a, b, x: -b - 2 * abs(x), lambda a, b, x: HL * .55 < a < HL * .85)
    # ears
    ear_c = lin((.62, .42, .22)) if key == 'dog' else (lin((.44, .29, .17)) if key == 'goat' else lin((.55, .54, .52)))
    for sx in (-1, 1):
        base = poll + side * sx * hr * .65 + up * hr * .3 - hd * .01
        if key == 'dog':
            leaf(mb, base, Vector((sx * .35, .1, 1)), Vector((0, -1, .2)), .085, .06, (0, 0, 1, 1), ear_c, lambda s: (1 - s) ** .8, segs=3, droop=.05, fold=.25, rng=rng)
        elif key == 'goat':
            leaf(mb, base, Vector((sx * 1, .3, -.55)), Vector((0, -1, .3)), .13, .055, (0, 0, 1, 1), ear_c, lambda s: math.sin(math.pi * (.15 + .85 * s)) ** .6, segs=3, droop=.15, fold=.3, rng=rng)
        else:
            leaf(mb, base, Vector((sx * 1, .25, -.2)), Vector((0, -1, .3)), .19, .10, (0, 0, 1, 1), ear_c, lambda s: math.sin(math.pi * (.15 + .85 * s)) ** .6, segs=3, droop=.12, fold=.3, rng=rng)
    rigid_from(mb, s0, 'head')
    s0 = len(mb.v)
    if key == 'goat':
        for sx in (-1, 1):   # scimitar horns sweeping back
            b = poll + side * sx * hr * .38 + up * hr * .85 + hd * .02
            pts = [b, b + Vector((sx * .02, .03, .07)), b + Vector((sx * .045, .10, .12)), b + Vector((sx * .07, .18, .12)), b + Vector((sx * .085, .23, .08))]
            tube(mb, pts, [.022, .018, .013, .008, .003], 7, col=lin((.36, .32, .26)))
        rigid_from(mb, s0, 'head'); s0 = len(mb.v)
        # beard: a few tapered tufts under the chin (moves with the jaw)
        ch = chin + Vector((0, .01, .01))
        for k in range(5):
            o = Vector(((k - 2) * .008, rng.uniform(-.01, .01), 0)); L = .09 + rng.uniform(-.015, .015)
            tube(mb, [ch + o, ch + o + Vector((0, .01, -L * .5)), ch + o + Vector((0, .025, -L))], [.012, .009, .002], 5, col=lin((.10, .08, .06)))
        rigid_from(mb, s0, 'jaw'); s0 = len(mb.v)
    if key == 'cow':
        for sx in (-1, 1):   # short Boran horns, out and up
            b = poll + side * sx * hr * .7 + up * hr * .55
            pts = [b, b + Vector((sx * .06, .01, .03)), b + Vector((sx * .10, .02, .09)), b + Vector((sx * .11, .0, .15))]
            tube(mb, pts, [.032, .026, .018, .006], 8, col=lin((.42, .38, .32)))
    rigid_from(mb, s0, 'head')
    if key == 'cow':
        s0 = len(mb.v)   # tail switch
        t2 = P['t2']; blob(mb, t2 + Vector((0, .01, -.06)), .035, .035, .10, (.05, .045, .04, 1), 8, 5)
        rigid_from(mb, s0, 'tail2')
        s0 = len(mb.v)   # small udder between the hind legs
        blob(mb, Vector((0, Q['BL'] * .26, Q['Hs'] - Q['BD'] - .02)), .08, .09, .06, lin((.70, .58, .55)), 10, 5)
        rigid_from(mb, s0, 'hips')

def quad_clips(arm, key, Q):
    fw, fi, fx = Q['fps']
    legs = [('thigh', 'shin', 'foot', 'L', 0.0, 'h'), ('upper_arm', 'forearm', 'hand', 'L', .25, 'f'),
            ('thigh', 'shin', 'foot', 'R', .5, 'h'), ('upper_arm', 'forearm', 'hand', 'R', .75, 'f')]
    A = {'cow': 16, 'goat': 20, 'dog': 24}[key]
    def legs_walk(t, amp=1.0):
        P = {}
        for a, b, c, s, off, kind in legs:
            ph = (t + off) * TAU; sw = math.sin(ph); lift = max(0, math.cos(ph)) ** 1.5
            if kind == 'f':
                P[f'{a}.{s}'] = [(X, -A * sw * amp)]; P[f'{b}.{s}'] = [(X, 50 * lift * amp)]; P[f'{c}.{s}'] = [(X, 25 * lift * amp)]
            else:
                P[f'{a}.{s}'] = [(X, -A * sw * amp - 10 * lift * amp)]; P[f'{b}.{s}'] = [(X, 22 * lift * amp)]; P[f'{c}.{s}'] = [(X, -40 * lift * amp)]
        return P
    def walk(t):
        P = padd(legs_walk(t), {'spine': [(Z, 2.5 * math.sin(t * TAU))], 'hips': [(Z, -1.5 * math.sin(t * TAU))],
                                'neck': [(X, 4 * math.sin(t * TAU * 2))], 'head': [(X, -3 * math.sin(t * TAU * 2))],
                                'tail1': [(Z, 10 * math.sin(t * TAU))], 'tail2': [(Z, 12 * math.sin(t * TAU - 1))]})
        if key == 'dog': P = padd(P, {'tail1': [(Z, 14 * math.sin(t * TAU * 2))]})
        return P, -.008 * Q['Hs'] * (1 + math.cos(t * TAU * 2)) * .5, 0
    def idle(t):
        b = math.sin(t * TAU)
        look = 14 * math.sin(t * TAU + .5) + 6 * math.sin(t * TAU * 3)
        P = {'spine': [(X, .8 * b)], 'neck': [(Z, look * .6), (X, 3 * math.sin(t * TAU * 2))], 'head': [(Z, look * .4), (Y, 4 * b)],
             'tail1': [(Z, 18 * math.sin(t * TAU * 2))], 'tail2': [(Z, 22 * math.sin(t * TAU * 2 - 1))],
             'jaw': [(X, 4 * max(0, math.sin(t * TAU * 6)) if key != 'dog' else 0)]}     # cud chewing
        if key == 'dog': P = padd(P, {'tail1': [(Z, 12 * math.sin(t * TAU * 4))], 'head': [(Y, 8 * math.sin(t * TAU * 2))]})
        return P, 0, 0
    def graze(t):
        down = 1 - .55 * bump(t, .55, .85)                   # lift the head briefly to look round, then back to the grass
        chew = math.sin(t * TAU * 10) * 1.5; jaw = 8 * max(0, math.sin(t * TAU * 10))
        ND, HD = graze_angles
        step = bump(t, .1, .3); step2 = bump(t, .3, .48)
        P = {'neck': [(X, ND * down), (Z, 6 * math.sin(t * TAU))], 'head': [(X, HD * down + chew), (Z, 8 * bump(t, .55, .85) * math.sin(t * TAU * 2))],
             'jaw': [(X, jaw)], 'spine': [(X, 2 * down)], 'upper_arm.L': [(X, -10 * step)], 'forearm.L': [(X, 25 * step)],
             'thigh.R': [(X, -9 * step2)], 'shin.R': [(X, 14 * step2)], 'foot.R': [(X, -18 * step2)],
             'tail1': [(Z, 22 * math.sin(t * TAU * 3))], 'tail2': [(Z, 26 * math.sin(t * TAU * 3 - 1))]}
        return P, 0, 0
    def wag(t):
        w = math.sin(t * TAU * 3)
        P = {'jaw': [(X, 9 + 3 * math.sin(t * TAU * 6))], 'tail1': [(Z, 40 * w), (X, -10)], 'tail2': [(Z, 30 * math.sin(t * TAU * 3 - .8))],
             'hips': [(Z, 3 * w)], 'spine': [(Z, -3 * w)], 'neck': [(X, -6)], 'head': [(Y, 12 * math.sin(t * TAU)), (X, 4 * math.sin(t * TAU * 2))]}
        return P, 0, 0
    if key != 'dog':
        # solve neck/head drop so the muzzle reaches the grass with the face angled ~70° down
        bn = arm.data.bones; nb, poll, muz = bn['neck'].head_local, bn['neck'].tail_local, bn['head'].tail_local
        def rot(v, deg):
            a = math.radians(deg); return Vector((v.x, v.y * math.cos(a) - v.z * math.sin(a), v.y * math.sin(a) + v.z * math.cos(a)))
        target = Q['hr'] * Q['mr'] * .8; tot = Q['ha'] + 70; best = None
        for nd in range(0, 101):
            hd_ = tot - nd; m = nb + rot(poll - nb, nd) + rot(rot(muz - poll, nd), hd_)
            err = abs(m.z - target)
            if best is None or err < best[0]: best = (err, nd, hd_)
        graze_angles = (best[1], best[2]); print(key, 'graze neck/head', graze_angles)
    extra = ('wag', fx, wag) if key == 'dog' else ('graze', fx, graze)
    make_clips_from(arm, [('idle', fi, idle), ('walk', fw, walk), extra])

# ═════════════════════════════ CHICKENS ═════════════════════════════

CHICKENS = {
    'chicken': dict(label='Gà mái', s=1.0, legs=1.0, body=(.55, .30, .14), back=(.50, .27, .12), neck=(.72, .48, .22), tail=(.22, .13, .08),
                    wing=(.52, .28, .13), comb=.6, rooster=False),
    'chicken-rooster': dict(label='Gà trống', s=1.18, legs=1.15, body=(.07, .08, .07), back=(.55, .17, .07), neck=(.88, .50, .15),
                            tail=(.05, .08, .06), wing=(.45, .14, .06), comb=1.0, rooster=True),
}

def build_chicken(key):
    C = CHICKENS[key]; s = C['s']; rng = random.Random(len(key) * 13); kl = C['legs']
    lift = .02 * (kl - 1) * 4    # longer legs raise the body
    def v(x, y, z): return Vector((x * s, y * s, z * s + lift))
    N = {'mid': (v(0, 0, .20), (.092 * s, .105 * s)), 'rear': (v(0, .07, .205), (.082 * s, .095 * s)), 'tailb': (v(0, .125, .245), (.045 * s, .05 * s)),
         'breast': (v(0, -.065, .215), (.080 * s, .095 * s)), 'crop': (v(0, -.095, .26), (.052 * s, .058 * s)),
         'nk1': (v(0, -.105, .30), (.040 * s, .042 * s)), 'nk2': (v(0, -.112, .335), (.030 * s, .031 * s)),
         'hd': (v(0, -.118, .362), (.029 * s, .030 * s)), 'face': (v(0, -.140, .360), (.020 * s, .022 * s))}
    for sd, sx in (('L', 1), ('R', -1)):
        N[f'drum.{sd}'] = (v(sx * .045, .025, .145), (.034 * s, .040 * s))
        N[f'knee.{sd}'] = (v(sx * .046, .035, .100 - .02 * (kl - 1)), (.016 * s, .016 * s))
    E = [('mid', 'rear'), ('rear', 'tailb'), ('mid', 'breast'), ('breast', 'crop'), ('crop', 'nk1'), ('nk1', 'nk2'), ('nk2', 'hd'), ('hd', 'face')]
    for sd in 'LR': E += [('mid', f'drum.{sd}'), (f'drum.{sd}', f'knee.{sd}')]
    names = list(N); idx = {n: i for i, n in enumerate(names)}
    V, F = skin_mesh([N[n][0] for n in names], [N[n][1] for n in names], [(idx[a], idx[b]) for a, b in E], levels=1)
    body, back, neckc, tailc, wingc = (lin(C[k]) for k in ('body', 'back', 'neck', 'tail', 'wing'))
    J = {n: N[n][0] for n in N}
    def col(p):
        if p.z > J['crop'].z + .01 * s: return neckc
        if p.z > J['mid'].z + .05 * s and p.y > -.02 * s: return back
        return body
    mb = SMB()
    for p in V: mb.add(p, ((p.x * .5 + p.y) * 9, p.z * 9), col(p))
    for f in F: mb.face(f)
    # feathers & bare parts in a second mesh (vane texture)
    fm = SMB(); bare = SMB()
    red = lin((.78, .08, .06)); yel = lin((.86, .66, .26))
    hd = J['hd']; face = J['face']
    # beak
    s0 = len(bare.v)
    bb = face + Vector((0, -.012 * s, -.002 * s))
    tube(bare, [bb, bb + Vector((0, -.016 * s, -.004 * s)), bb + Vector((0, -.026 * s, -.012 * s))], [.010 * s, .006 * s, .001], 6, col=lin((.85, .70, .38)), cap=True)
    for sx in (-1, 1):
        blob(bare, face + Vector((sx * .017 * s, .004 * s, .006 * s)), .006 * s, .006 * s, .006 * s, lin((.85, .45, .10)), 8, 4)     # eye
        blob(bare, face + Vector((sx * .0215 * s, .002 * s, .007 * s)), .003 * s, .004 * s, .004 * s, (.01, .01, .01, 1), 6, 3)     # pupil
        blob(bare, hd + Vector((sx * .026 * s, .012 * s, -.008 * s)), .004 * s, .008 * s, .009 * s, red if C['rooster'] else lin((.85, .55, .45)), 6, 3)  # ear lobe
    # comb (serrated) + wattles
    cs = C['comb']
    for k in range(5):
        f = k / 4; p = hd + Vector((0, (-.030 + .045 * f * (.7 + .3 * cs)) * s, (.024 + .010 * cs * math.sin(math.pi * (.2 + .6 * f))) * s))
        blob(bare, p, .0045 * s, .011 * s * cs ** .5, (.006 + .016 * cs) * s * (.75 + .25 * math.sin(math.pi * f)), red, 6, 4)
    for sx in (-1, 1):
        blob(bare, face + Vector((sx * .006 * s, -.010 * s, -.030 * s - .01 * cs * s)), .006 * s, .010 * s, (.012 + .012 * cs) * s, red, 6, 4)
    rigid_from(bare, s0, 'head')
    # legs: shanks and toes
    for sd, sx in (('L', 1), ('R', -1)):
        kn = J[f'knee.{sd}']; an = Vector((sx * .046 * s, .012 * s, .016 * s))
        s0 = len(bare.v); tube(bare, [kn, kn.lerp(an, .5), an], [.009 * s, .007 * s, .0065 * s], 6, col=yel); rigid_from(bare, s0, f'shin.{sd}')
        s0 = len(bare.v)
        for ang in (-25, 0, 25):
            d = Vector((math.sin(math.radians(ang)) * sx, -math.cos(math.radians(ang)), 0))
            tube(bare, [an, an + d * .025 * s + Vector((0, 0, -.010 * s)), an + d * .05 * s + Vector((0, 0, -.012 * s))], [.005 * s, .004 * s, .002 * s], 5, col=yel, cap=True)
        tube(bare, [an, an + Vector((0, .02 * s, -.012 * s))], [.004 * s, .002 * s], 5, col=yel, cap=True)
        rigid_from(bare, s0, f'foot.{sd}')
    # folded wings: layered blades along each flank
    for sd, sx in (('L', 1), ('R', -1)):
        s0 = len(fm.v)
        for k in range(9):
            f = k / 8
            base = v(sx * (.080 - .008 * f), -.065 + .07 * f, .248 - .025 * f)
            d = Vector((sx * .05, 1, -.28 - .1 * f)); L = (.10 + .05 * f) * s
            c = tuple(wingc[i] * (1.15 - .45 * f) if not C['rooster'] or f < .6 else (.03, .04, .035)[i] for i in range(3)) + (1,)
            leaf(fm, base, d, Vector((sx, 0, .45)), L, .05 * s, (0, 0, 1, 1), c, lambda q: math.sin(math.pi * (.12 + .88 * q)) ** .5, segs=2, droop=.14, fold=.06, rng=rng)
        rigid_from(fm, s0, f'wing.{sd}')
    # tail fan
    s0 = len(fm.v); tb_ = J['tailb']
    for k in range(10):
        f = k / 9 - .5
        d = Vector((f * .55, .55, .9)); L = (.10 + .03 * (1 - abs(f) * 2)) * s
        leaf(fm, tb_ + Vector((f * .02 * s, 0, 0)), d, Vector((1 if f >= 0 else -1, -.2, 0)), L, .045 * s, (0, 0, 1, 1), tailc,
             lambda q: math.sin(math.pi * (.1 + .9 * q)) ** .45, segs=2, droop=.05, fold=.1, rng=rng)
    if C['rooster']:   # long arching sickle feathers
        for k in range(7):
            f = k / 6 - .5
            d = Vector((f * .45, .25, 1.0)); L = (.24 + .06 * (1 - abs(f) * 2)) * s
            gloss = tuple(tailc[i] * (1 + .4 * (k % 2)) for i in range(3)) + (1,)
            leaf(fm, tb_ + Vector((f * .03 * s, .005, .005)), d, Vector((0, -1, .3)), L, .03 * s, (0, 0, 1, 1), gloss,
                 lambda q: math.sin(math.pi * (.06 + .94 * q)) ** .35, segs=5, droop=.65, fold=.06, rng=rng)
        # saddle hackles over the back
        for k in range(10):
            sx = 1 if k % 2 else -1; f = (k // 2) / 4
            leaf(fm, v(sx * .03, .04 + .03 * f, .292), Vector((sx * .22, .85, -.30)), Vector((sx * .3, 0, 1)), .08 * s, .022 * s, (0, 0, 1, 1), back,
                 lambda q: (1 - q) ** .6, segs=2, droop=.1, fold=.05, rng=rng)
    rigid_from(fm, s0, 'tail')
    # neck hackles (a cape of narrow feathers falling over the shoulders)
    s0 = len(fm.v)
    for k in range(16):
        a = TAU * k / 16; cxy = Vector((math.cos(a), math.sin(a), 0))
        if cxy.y < -.7: continue
        base = J['nk2'] + Vector((cxy.x * .026 * s, cxy.y * .026 * s, .004 * s))
        d = Vector((cxy.x * .45, cxy.y * .45 + .25, -1)); L = (.065 if not C['rooster'] else .085) * s
        leaf(fm, base, d, Vector((cxy.x, cxy.y, .2)), L, .022 * s, (0, 0, 1, 1), neckc, lambda q: (1 - q) ** .7, segs=2, droop=.08, fold=.05, rng=rng)
    rigid_from(fm, s0, 'neck')
    bones = [('hips', v(0, .03, .17), v(0, -.07, .20), None), ('neck', J['crop'], J['nk2'], 'hips'), ('head', J['nk2'], J['face'] + Vector((0, -.02 * s, 0)), 'neck'),
             ('tail', J['tailb'], J['tailb'] + Vector((0, .04, .06)) * s, 'hips')]
    for sd, sx in (('L', 1), ('R', -1)):
        an = Vector((sx * .046 * s, .012 * s, .016 * s))
        bones += [(f'thigh.{sd}', v(sx * .045, .03, .17), J[f'knee.{sd}'], 'hips'), (f'shin.{sd}', J[f'knee.{sd}'], an, f'thigh.{sd}'),
                  (f'foot.{sd}', an, an + Vector((0, -.05 * s, -.01 * s)), f'shin.{sd}'),
                  (f'wing.{sd}', v(sx * .08, -.06, .245), v(sx * .085, .09, .21), 'hips')]
    Mb = material(f'plumage_{key}', to_image(f'T_plumage', plumage_tex), .85, two_sided=True, spec=.3)
    Mf = material(f'feather_{key}', to_image(f'T_feather_vane', vane_tex), .7, two_sided=True, spec=.45)
    Mp = material(f'chicken_bare_{key}', None, .5, spec=.5)
    arm = make_armature(key, bones)
    objs = bind_parts(arm, bones, [(mb, Mb, f'{key}_body'), (fm, Mf, f'{key}_feathers'), (bare, Mp, f'{key}_bare')],
                      auto=['hips', 'neck', 'head', 'thigh.L', 'thigh.R', 'tail'])
    chicken_clips(arm, key, s)
    return arm, objs

def chicken_clips(arm, key, s):
    def idle(t):
        # chickens look round in jerky steps; occasional ruffle of the wings and tail flick
        step = math.floor(t * 6); yaw = [0, 25, 10, -20, -30, 5][step % 6]; nxt = [25, 10, -20, -30, 5, 0][step % 6]
        f = smooth01((t * 6 - step) * 4); y = yaw + (nxt - yaw) * f
        ruff = bump(t, .62, .78)
        P = {'neck': [(Z, y * .5), (X, -4 * math.sin(t * TAU * 2))], 'head': [(Z, y * .5), (Y, 10 * math.sin(t * TAU))],
             'wing.L': [(Y, -18 * ruff)], 'wing.R': [(Y, 18 * ruff)], 'tail': [(Z, 10 * ruff * math.sin(t * TAU * 8))]}
        return P, 0, 0
    def walk(t):
        P = {}
        for sd, off in (('L', 0), ('R', .5)):
            ph = (t + off) * TAU; sw = math.sin(ph); lift = max(0, math.cos(ph))
            P[f'thigh.{sd}'] = [(X, -28 * sw - 22 * lift)]; P[f'shin.{sd}'] = [(X, 10 * lift)]; P[f'foot.{sd}'] = [(X, 40 * lift - 8 * sw)]
        bob = math.sin(t * TAU * 2)
        P.update({'neck': [(X, 14 * bob)], 'head': [(X, -14 * bob)], 'hips': [(Z, 5 * math.sin(t * TAU)), (Y, 4 * math.sin(t * TAU))],
                  'tail': [(Z, 6 * math.sin(t * TAU))], 'wing.L': [], 'wing.R': []})
        return P, -.006 * s * (1 + math.cos(t * TAU * 2)), 0
    def peck(t):
        tilt = smooth01(t / .15) * smooth01((1 - t) / .15)
        jab = sum(bump(t, a, a + .1) for a in (.22, .38, .54, .74))
        P = {'hips': [(X, 30 * tilt)], 'thigh.L': [(X, -30 * tilt)], 'thigh.R': [(X, -30 * tilt)],
             'neck': [(X, 58 * tilt + 14 * jab)], 'head': [(X, 30 * tilt + 18 * jab)], 'tail': [(X, -15 * tilt)],
             'wing.L': [], 'wing.R': []}
        return P, -.012 * s * tilt, 0
    make_clips_from(arm, [('idle', 60, idle), ('walk', 20, walk), ('peck', 48, peck)])

# ═════════════════════════════ BEEHIVE ═════════════════════════════

def build_beehive(key='beehive'):
    """Traditional Ethiopian log hive (gindo) lying on a forked-pole stand under a grass cover; bees circle the entrance."""
    rng = random.Random(77); M = mats(); sc = bpy.context.scene
    root = bpy.data.objects.new(key, None); sc.collection.objects.link(root)
    bark = material('hive_bark', to_image('T_hive_bark', lambda: tex_bark('cordia', 77, 512)), .9, spec=.25)
    P = {'pole': MB(), 'bark': MB(), 'mud': MB(), 'thatch': MB(), 'rope': MB()}
    zl = 1.30; L = 1.15; R0 = .17
    # two forked posts + a third prop under the back
    for x in (-.42, .42):
        base = Vector((x, 0, 0)); fork = Vector((x, 0, zl - .12))
        tube(P['pole'], [base + Vector((0, 0, -.05)), base.lerp(fork, .5) + Vector((rng.uniform(-.02, .02), 0, 0)), fork], [.045, .04, .036], 7, col=(1, 1, 1, 1), v_scale=1.5)
        for sy in (-1, 1):
            tip = fork + Vector((rng.uniform(-.02, .02), sy * .21, .22))
            tube(P['pole'], [fork, fork.lerp(tip, .5) + Vector((0, sy * .02, 0)), tip], [.032, .027, .02], 6, col=(1, 1, 1, 1), v_scale=1.5, cap=True)
    # the log hive (hollowed trunk), slightly irregular, lying along X
    def wob(a, z): return .035 * math.sin(a * 3 + z * 7) + .02 * math.sin(a * 7 + 1.3)
    lathe(P['bark'], [(R0 * .96, 0), (R0, .05), (R0 * 1.02, L * .5), (R0, L - .05), (R0 * .96, L)], 18, col=(1, 1, 1, 1), wobble=wob, u_len=.6, v_len=.6)
    mb = P['bark']; c0 = Vector((-L / 2, 0, zl + R0 * .95))
    Rot = Matrix.Rotation(math.pi / 2, 3, 'Y')
    mb.v = [tuple(c0 + Rot @ Vector(p)) for p in mb.v]          # rotation about Y by +90°: lathe z → +X
    # mud/dung end plugs with the bee entrance
    for _ in range(2): lathe(P['mud'], [(R0 * .97, 0), (.001, 0)], 18, col=lin((.58, .46, .32)), center=(0, 0, 0))
    mud = P['mud']; Rl = Matrix.Rotation(-math.pi / 2, 3, 'Y'); Rr = Matrix.Rotation(math.pi / 2, 3, 'Y'); half = len(mud.v) // 2
    mud.v = [tuple(Vector((-L / 2 - .005, 0, zl + R0 * .95)) + Rl @ Vector(p)) if i < half else tuple(Vector((L / 2 + .005, 0, zl + R0 * .95)) + Rr @ Vector(p))
             for i, p in enumerate(mud.v)]
    ent = Vector((-L / 2 - .012, -.02, zl + R0 * .55))
    blob(mud, ent, .006, .035, .014, (.03, .025, .02, 1), 8, 3)          # entrance slit (front end)
    blob(mud, ent + Vector((-.004, 0, -.02)), .012, .06, .008, lin((.50, .38, .26)), 8, 3)   # landing lip
    # rope bindings round the log
    for x in (-.40, -.05, .38):
        pts = [Vector((x + .01 * math.sin(a * 2), math.cos(a) * (R0 + .012), zl + R0 * .95 + math.sin(a) * (R0 + .012))) for a in np.linspace(0, TAU, 17)]
        tube(P['rope'], pts, [.010] * len(pts), 5, col=lin((.66, .55, .36)))
    # grass/false-banana cover draped over the top
    th = P['thatch']
    for k in range(3):
        rr = R0 + .05 + .03 * k; z0 = zl + R0 * .95
        rows = []
        for i in range(9):
            a = math.radians(22 + 136 * i / 8); row = []
            for j in range(7):
                x = -L / 2 - .12 + (L + .24) * j / 6
                hang = .05 * (1 - i / 8 if i < 4 else i / 8) ** 2
                row.append(th.add(Vector((x + rng.uniform(-.01, .01), math.cos(a) * rr, z0 + math.sin(a) * rr - hang + .04 * k)), (j / 6 * 2, i / 8 * 2 + k * .3), (1, 1, 1, 1)))
            rows.append(row)
        for i in range(8):
            for j in range(6): th.face((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    tube(P['rope'], [Vector((-L / 2 - .1, 0, zl + R0 * .95 + R0 + .12)), Vector((L / 2 + .1, 0, zl + R0 * .95 + R0 + .12))], [.018, .018], 6, col=lin((.50, .42, .28)))
    mats_ = {'pole': M['pole'], 'bark': bark, 'mud': M['mud'], 'thatch': M['thatch'], 'rope': M['plain']}
    for k, m in P.items():
        if not m.f: continue
        ob = m.build(f'{key}_{k}', mats_[k]); sc.collection.objects.link(ob); ob.parent = root
    # bee swirls: three rings of bees circling the entrance at different speeds (object-keyed, one NLA track 'idle')
    bm = material('bee', None, .4, spec=.6); frames = 60
    for g in range(3):
        b = MB(); n = 6; rad = .10 + .07 * g
        for k in range(n):
            a = TAU * k / n + g; p = Vector((math.cos(a) * rad, math.sin(a) * rad, .03 * math.sin(a * 3 + g)))
            blob(b, p, .006, .011, .006, lin((.80, .58, .10)), 6, 3)
            blob(b, p + Vector((0, .004, 0)), .0064, .004, .0064, (.03, .025, .02, 1), 6, 3)
            for sx in (-1, 1): blob(b, p + Vector((sx * .007, 0, .005)), .008, .004, .0012, (.85, .88, .92, 1), 6, 2)
        ob = b.build(f'{key}_bees{g}', bm); sc.collection.objects.link(ob); ob.parent = root
        ob.location = ent + Vector((-.10 - .05 * g, -.02, .02 * g))
        act = bpy.data.actions.new(f'bees{g}_idle'); act.use_fake_user = True
        ob.animation_data_create(); ob.animation_data.action = act
        turns = (1, -2, 1)[g]
        for f in range(0, frames + 1, 2):
            t = f / frames
            ob.rotation_euler = (math.radians(12 * math.sin(t * TAU + g)), math.radians(15 * math.cos(t * TAU * 2 + g)), turns * TAU * t)
            ob.location = ent + Vector((-.10 - .05 * g, -.02, .02 * g + .03 * math.sin(t * TAU * 2 + g)))
            ob.keyframe_insert('rotation_euler', frame=f); ob.keyframe_insert('location', frame=f)
        trk = ob.animation_data.nla_tracks.new(); trk.name = 'idle'; st = trk.strips.new('idle', 0, act); st.name = 'idle'
        ob.animation_data.action = None
    return root, [o for o in root.children]

def export_object_anim(root_name, path):
    for o in bpy.data.objects: o.select_set(False)
    root = bpy.data.objects[root_name]; root.select_set(True)
    for c in root.children_recursive: c.select_set(True)
    shrink_textures(root.children_recursive)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_image_format='WEBP',
              export_vertex_color='ACTIVE', export_animations=True, export_animation_mode='NLA_TRACKS',
              export_force_sampling=True, export_frame_step=1, export_extras=False)
    try: bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print('export fallback', e); kw.pop('export_vertex_color'); bpy.ops.export_scene.gltf(**kw)
    print('exported', path, os.path.getsize(path) // 1024, 'KB')

# ═════════════════════════════ exports ═════════════════════════════

VILLAGE = {**{k: ('person', k) for k in PEOPLE}, **{k: ('chicken', k) for k in CHICKENS}, **{k: ('quad', k) for k in QUADS}, 'beehive': ('hive', 'beehive')}
LABELS = {**{k: v['label'] for k, v in PEOPLE.items()}, **{k: v['label'] for k, v in CHICKENS.items()}, **{k: v['label'] for k, v in QUADS.items()}, 'beehive': 'Đõ ong (tổ ong treo)'}

def build_village(key):
    kind, k = VILLAGE[key]
    if kind == 'person': return build_person(k)
    if kind == 'chicken': return build_chicken(k)
    if kind == 'quad': return build_quad(k)
    return build_beehive(k)

def reset_scene():
    purge()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for a in list(bpy.data.armatures):
        if a.users == 0: bpy.data.armatures.remove(a)

def export_village(out_dir, only=None):
    os.makedirs(out_dir, exist_ok=True)
    for key in VILLAGE:
        if only and key not in only: continue
        reset_scene()
        root, objs = build_village(key)
        path = os.path.join(out_dir, f'{key}.glb')
        if VILLAGE[key][0] == 'hive': export_object_anim(key, path)
        else: export_character(key, path)
        print(key, LABELS[key], sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs if o.type == 'MESH'), 'tris')

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_village(sys.argv[sys.argv.index('--export') + 1], only)
