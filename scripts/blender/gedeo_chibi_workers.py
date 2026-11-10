"""Chibi farm staff (founder 2026-11-10: cute, big head, optimised). Replaces the look of the 8 worker-*.glb, nothing about how the game uses them.

One skeleton for everybody (the 17 bone names of gedeo_characters.py), one file of clips (worker-anims.glb, loaded once), and each
worker is a single skinned mesh with its tool inside: one draw call a person. Flat vertex colours, no real texture. The soft darkening
under the chin and on the feet is painted into the colours, because the farm has no shadows.

Headless:
  blender -b --factory-startup -P scripts/blender/gedeo_chibi_workers.py -- --export public/models/gedeo [--only picker_f,hauler_m]
  blender -b --factory-startup -P scripts/blender/gedeo_chibi_workers.py -- --preview out.png [--work] [--high]
gedeo_characters.py stays as it is: gedeo_villagers.py still builds on it.
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1   # nesting depth: only the outermost script exports
exec(open(os.path.join(_here, 'gedeo_characters.py')).read(), globals())
_GEDEO_LIB -= 1

HEAD_R = (.37, .33, .34)   # the head is about 40% of the height
PI = math.pi

def chibi_joints():
    """One skeleton for men and women, so one set of clips fits everybody. Faces -Y, left = +X."""
    J = {'pelvis': (0, 0, .47), 'spine': (0, .005, .55), 'chest': (0, .01, .66), 'upper_chest': (0, .01, .75),
         'neck': (0, 0, .82), 'neck_top': (0, -.005, .90), 'head_top': (0, -.01, 1.60),
         'shoulder.L': (.155, .01, .77), 'elbow.L': (.235, .02, .62), 'wrist.L': (.275, 0, .475), 'hand.L': (.29, -.01, .41),
         'hip.L': (.095, 0, .44), 'knee.L': (.10, -.01, .26), 'ankle.L': (.105, .01, .10), 'toe.L': (.11, -.14, .035)}
    for key in list(J):
        if key.endswith('.L'): x, y, z = J[key]; J[key[:-2] + '.R'] = (-x, y, z)
    return {n: Vector(p) for n, p in J.items()}

def chibi_body(J, sex, build=1.0):
    """Short round body from a Skin modifier: fat limbs, mitten hands, big shoes."""
    f = sex == 'f'
    nodes = [('pelvis', (.165 * build, .125 * build)), ('spine', ((.145 if f else .155) * build, .12 * build)), ('chest', (.165 * build, .13 * build)),
             ('upper_chest', (.145 * build, .115 * build)), ('neck', (.075, .075)), ('neck_top', (.07, .07))]
    for s in 'LR':
        nodes += [(f'shoulder.{s}', (.078, .078)), (f'elbow.{s}', (.064, .064)), (f'wrist.{s}', (.056, .056)), (f'hand.{s}', (.075, .07)),
                  (f'hip.{s}', (.105, .105)), (f'knee.{s}', (.09, .09)), (f'ankle.{s}', (.086, .09)), (f'toe.{s}', (.09, .055))]
    names = [n for n, _ in nodes]; idx = {n: i for i, n in enumerate(names)}
    verts = [tuple(J[n]) for n in names]
    edges = [(idx['pelvis'], idx['spine']), (idx['spine'], idx['chest']), (idx['chest'], idx['upper_chest']), (idx['upper_chest'], idx['neck']), (idx['neck'], idx['neck_top'])]
    for s in 'LR':
        edges += [(idx['upper_chest'], idx[f'shoulder.{s}']), (idx[f'shoulder.{s}'], idx[f'elbow.{s}']), (idx[f'elbow.{s}'], idx[f'wrist.{s}']), (idx[f'wrist.{s}'], idx[f'hand.{s}']),
                  (idx['pelvis'], idx[f'hip.{s}']), (idx[f'hip.{s}'], idx[f'knee.{s}']), (idx[f'knee.{s}'], idx[f'ankle.{s}']), (idx[f'ankle.{s}'], idx[f'toe.{s}'])]
    me = bpy.data.meshes.new('skin_src'); me.from_pydata(verts, edges, [])
    ob = bpy.data.objects.new('skin_src', me); bpy.context.scene.collection.objects.link(ob)
    ob.modifiers.new('skin', 'SKIN')
    for i, (_, r) in enumerate(nodes): me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    out = bpy.data.meshes.new_from_object(ev)
    V = [v.co.copy() for v in out.vertices]; F = [tuple(p.vertices) for p in out.polygons]
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me); bpy.data.meshes.remove(out)
    return V, F

# ───────────────────────────── head and face ─────────────────────────────

def head_pt(c, r, th, ph, lift=0.0):
    """A point of the head's surface: a ball with soft cheeks and a small chin. Hair, hats and the face all sit on this same surface."""
    x, y, z = math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), math.sin(th)
    cheek = max(0, 1 - abs(z + .35) / .45); low = max(0, -z); front = max(0, -y)
    p = Vector((x * r[0] * (1 + .07 * cheek), y * r[1] * (1 + .06 * cheek * front), z * r[2] * (1 - .10 * low * low)))
    return c + p + Vector((x, y, z)) * lift

def shade(col, k): return (col[0] * k, col[1] * k, col[2] * k, 1)
def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3)) + (1,)

def disc(mb, c, r, a0, th0, ra, rth, lift, col, seg=12):
    """A flat patch painted on the head (eye, highlight, blush). a0 = sideways angle from the nose, th0 = height angle."""
    ph0 = -PI / 2 + a0
    cen = mb.add(head_pt(c, r, th0, ph0, lift), (0, 0), col, rigid='head')
    ring = [mb.add(head_pt(c, r, th0 + rth * math.sin(TAU * j / seg), ph0 + ra * math.cos(TAU * j / seg), lift), (0, 0), col, rigid='head') for j in range(seg)]
    for j in range(seg): mb.face((cen, ring[j], ring[(j + 1) % seg]))

def arc(mb, c, r, pts, w, lift, col):
    """A thin line drawn on the head (mouth, brow, lash). pts: [(a, th)] left to right."""
    lo = [mb.add(head_pt(c, r, th - w, -PI / 2 + a, lift), (0, 0), col, rigid='head') for a, th in pts]
    hi = [mb.add(head_pt(c, r, th + w, -PI / 2 + a, lift), (0, 0), col, rigid='head') for a, th in pts]
    for i in range(len(pts) - 1): mb.face((lo[i], lo[i + 1], hi[i + 1], hi[i]))

def chibi_head(mb, J, R, skin):
    c = J['neck_top'] + Vector((0, -.012, HEAD_R[2] * .74)); r = HEAD_R
    seg, rings = 22, 13; grid = []
    for i in range(rings + 1):
        th = -PI / 2 + PI * i / rings; row = []
        for j in range(seg + 1):
            k = 1 - .16 * max(0, -math.sin(th) - .45) / .55      # the underside of the head is painted a little darker
            row.append(mb.add(head_pt(c, r, th, TAU * j / seg - PI / 2), (0, 0), shade(skin, k), rigid='head'))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    eye = (.03, .02, .03, 1); iris = lin(R.get('eye', (.45, .24, .12))); white = (1, 1, 1, 1); dark = lin((.22, .12, .10))
    blush = mix(skin, lin((.98, .42, .38)), .55)
    for sx in (-1, 1):
        a = sx * .46
        disc(mb, c, r, sx * .74, -.34, .135, .08, .004, blush, 10)
        disc(mb, c, r, a, -.10, .135, .215, .006, eye, 14)
        disc(mb, c, r, a, -.18, .092, .105, .010, iris, 10)
        disc(mb, c, r, a + .035, -.02, .05, .075, .014, white, 8)
        disc(mb, c, r, a - .04, -.20, .022, .032, .014, white, 6)
        arc(mb, c, r, [(a - .11, .21), (a, .25), (a + .11, .21)], .016, .006, dark)
        if R.get('sex') == 'f': arc(mb, c, r, [(a + sx * .15, .06), (a + sx * .13, .12), (a + sx * .05, .15)], .013, .007, eye)
    arc(mb, c, r, [(-.12, -.43), (-.05, -.475), (.05, -.475), (.12, -.43)], .014, .006, shade(dark, .9))
    disc(mb, c, r, 0, -.27, .022, .016, .004, shade(skin, .78), 6)
    return c, r

def ears(mb, c, r, skin):
    start = len(mb.v)
    for sx in (-1, 1): ellipsoid(mb, head_pt(c, r, -.08, -PI / 2 + sx * PI / 2, .0), Vector((0, 0, 1)), .07, .05, shade(skin, .94), 7, 3)
    bind_rigid(mb, start, 'head')

def chibi_hair(mb, c, r, col, th_max=PI / 2, rings=5):
    """Short hair with a soft fringe. th_max: stop lower when a hat covers the top."""
    seg = 20; grid = []
    for i in range(rings + 1):
        f = i / rings; row = []
        for j in range(seg + 1):
            ph = TAU * j / seg - PI / 2; yd = math.sin(ph)
            fr = min(1, max(0, (-yd - .1) / .5)); fr = fr * fr * (3 - 2 * fr)
            th0 = -.32 + .62 * fr + .10 * fr * abs(math.sin(ph * 7))    # low at the nape, a zig-zag fringe on the forehead
            th = th0 + (th_max - th0) * f
            row.append(mb.add(head_pt(c, r, min(th, PI / 2), ph, .028 + .012 * f), (0, 0), shade(col, .85 + .15 * f), rigid='head'))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))

def chibi_scarf(mb, c, r, col):
    """Headscarf over the hair, face left open, knot and two tails at the back."""
    seg, rings = 20, 7; grid = []
    for i in range(rings + 1):
        th = -.62 + (PI / 2 + .62) * i / rings; row = []
        for j in range(seg + 1):
            ph = TAU * j / seg - PI / 2; y = math.sin(ph)
            front = min(1, max(0, (-y - .15) / .35)); th_ = th + max(0, .50 - th) * front
            row.append(mb.add(head_pt(c, r, th_, ph, .045), (0, 0), shade(col, .88 + .12 * i / rings), rigid='head'))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    start = len(mb.v)
    knot = c + Vector((0, r[1] + .05, -.10))
    ellipsoid(mb, knot, Vector((0, 1, 0)), .05, .055, shade(col, .92), 7, 3)
    for sx in (-1, 1):
        a = knot + Vector((sx * .02, .02, -.02)); b = knot + Vector((sx * .11, .10, -.20))
        tube(mb, [a, a.lerp(b, .5), b], [.03, .035, .012], 5, col=shade(col, .9))
    bind_rigid(mb, start, 'head')

def chibi_cap(mb, c, r, col):
    start = len(mb.v); z0 = c.z + r[2] * .40
    lathe(mb, [(.375, z0), (.372, z0 + .07), (.335, z0 + .15), (.235, z0 + .225), (.002, z0 + .255)], 22, col=col, center=(c.x, c.y + .005, 0))
    xs = [x / 3 for x in range(-3, 4)]
    base = [mb.add(c + Vector((x * .24, -r[1] * (1.03 - .22 * x * x), r[2] * .46)), (0, 0), shade(col, .8)) for x in xs]
    brim = [mb.add(c + Vector((x * .25, -r[1] * (1.03 - .22 * x * x) - .17 * (1 - x * x), r[2] * .40)), (0, 0), shade(col, .8)) for x in xs]
    for i in range(6): mb.face((brim[i], brim[i + 1], base[i + 1], base[i]))
    bind_rigid(mb, start, 'head')

def chibi_straw(mb, c, r, col):
    start = len(mb.v); z = c.z + r[2] * .40
    lathe(mb, [(.62, z - .05), (.50, z), (.38, z + .03), (.355, z + .17), (.24, z + .25), (.002, z + .27)], 24, col=col, center=(c.x, c.y, 0))
    lathe(mb, [(.385, z + .025), (.375, z + .085)], 24, col=lin((.85, .28, .22)), center=(c.x, c.y, 0))
    bind_rigid(mb, start, 'head')

def chibi_skirt(mb, J, col, z1=.20):
    z0 = J['pelvis'].z + .08; seg = 18; rows = 3; grid = []
    for i in range(rows + 1):
        f = i / rows; rad = .175 + .085 * f ** 1.2; row = []
        for j in range(seg + 1):
            a = TAU * j / seg; p = Vector((math.cos(a) * rad, math.sin(a) * rad * .86 + .005, z0 + (z1 - z0) * f))
            side = 'L' if p.x > 0 else 'R'; k = min(.45, f * .6) * min(1, abs(p.x) / .1)
            row.append(mb.add(p, (0, 0), shade(col, 1 - .10 * f), rigid={'hips': 1 - k, f'thigh.{side}': k} if k > .01 else 'hips'))
        grid.append(row)
    for i in range(rows):
        for j in range(seg): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))

def chibi_hem(mb, col, dress, build):
    """A short round band at the bottom of the shirt: it hides the body mesh's uneven colour border."""
    seg = 16; rows = ((.63, .165, .135), (.56, .19, .155), (.535 if dress else .49, .195, .16)); grid = []
    for i, (z, rx, ry) in enumerate(rows):
        row = []
        for j in range(seg + 1):
            a = TAU * j / seg
            row.append(mb.add((math.cos(a) * rx * build, math.sin(a) * ry * build + .005, z), (0, 0), shade(col, 1 - .05 * i), rigid='spine' if i == 0 else 'hips'))
        grid.append(row)
    for i in range(2):
        for j in range(seg): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))

def chibi_apron(mb, J, col, z1=.25):
    z0 = J['pelvis'].z + .06; grid = []
    for i in range(3):
        f = i / 2; z = z0 + (z1 - z0) * f; row = []
        rad = .175 + .085 * ((z0 + .02 - z) / (z0 + .02 - .20)) ** 1.2
        for x in (-1, 0, 1): row.append(mb.add((x * (.115 + .05 * f), -(rad * .86 * (1 - .12 * x * x)) - .012, z), (0, 0), col, rigid='hips'))
        grid.append(row)
    for i in range(2):
        for j in range(2): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))

def chibi_basket(mb, at):
    col = lin((.76, .56, .32)); C = Vector(at)
    lathe(mb, [(.07, 0), (.10, .03), (.115, .14), (.125, .16)], 10, col=col, center=C)
    lathe(mb, [(.01, .135), (.115, .135)], 10, col=lin((.80, .10, .09)), center=C)
    for k in range(5):
        a = TAU * k / 5; ellipsoid(mb, C + Vector((math.cos(a) * .06, math.sin(a) * .06, .15)), UP, .028, .028, lin((.88, .12, .10)), 5, 2)

# ───────────────────────────── the eight workers ─────────────────────────────

ROLES = {
    'picker_f': dict(sex='f', skin=(.72, .50, .35), top=(.95, .36, .32), bottom=(.30, .46, .80), hair='scarf', scarf=(1, .84, .28), dress=True, apron=(1, .96, .84), tool=('basket', 'hips'), clip='harvest'),
    'picker_m': dict(sex='m', skin=(.66, .45, .31), top=(.30, .62, .86), bottom=(.46, .36, .26), hair='cap', hat=(.28, .66, .34), tool=('basket', 'hips'), clip='harvest'),
    'waterer_m': dict(sex='m', skin=(.62, .41, .28), top=(.98, .78, .34), bottom=(.28, .40, .62), hair='cap', hat=(.20, .68, .84), boots=True, tool=('can', 'hand.R'), tool_rot=40, long=True, clip='water'),
    'pruner_m': dict(sex='m', skin=(.68, .47, .32), top=(.50, .74, .36), bottom=(.46, .34, .24), hair='straw', hat=(.96, .80, .46), gloves=True, tool=('shears', 'hand.R'), long=True, clip='prune'),
    'planter_f': dict(sex='f', skin=(.74, .52, .36), top=(.34, .76, .56), bottom=(.92, .42, .56), hair='scarf', scarf=(.98, .42, .40), dress=True, tool=('hoe', 'hand.R'), tool_rot=95, tool2=('seedling', 'hand.L'), tool2_rot=120, clip='plant'),
    'hauler_m': dict(sex='m', skin=(.60, .39, .26), top=(1, .62, .30), bottom=(.36, .32, .34), hair='cap', hat=(.32, .36, .56), build=1.1, tool=('sack', 'chest'), clip='carry'),
    'processor_f': dict(sex='f', skin=(.72, .50, .35), top=(.74, .50, .88), bottom=(.36, .54, .70), hair='scarf', scarf=(1, 1, .95), dress=True, apron=(.36, .56, .86), boots=True, tool=('rake', 'hand.R'), tool_rot=85, long=True, clip='rake'),
    'supervisor_m': dict(sex='m', skin=(.67, .46, .31), top=(1, 1, .96), bottom=(.26, .32, .52), hair='cap', hat=(.56, .34, .18), collar=True, tool=('clipboard', 'hand.L'), tool_rot=60, long=True, clip='inspect'),
}
TOOL_SCALE = {'can': .8, 'shears': 1.35, 'hoe': .72, 'rake': .7, 'clipboard': 1.0, 'seedling': 1.0}
_flat = {}

def flat_material():
    if 'img' not in _flat or _flat['img'].name not in bpy.data.images: _flat['img'] = to_image('T_char_flat', np.ones((4, 4, 4), np.float32))
    return material('char_flat', _flat['img'], .85, spec=.2)

def add_tool(mb, R, key, J, rng):
    kind, bone = R[key]; s0 = len(mb.v); anchor = J[bone] if bone in J else J['pelvis']
    if kind == 'basket': chibi_basket(mb, (.15, -.17, .36)); anchor = None
    elif kind == 'sack': superellipsoid(mb, Vector((0, .25, .70)), (.42, .34, .50), e=.6, seg=9, rings=5, sag=.05, col=lin((.84, .68, .44))); anchor = None
    elif kind == 'can': tool_can(mb, anchor)
    elif kind == 'shears': tool_shears(mb, anchor)
    elif kind == 'hoe': tool_hoe(mb, anchor)
    elif kind == 'rake': tool_rake(mb, anchor)
    elif kind == 'clipboard': tool_clipboard(mb, anchor)
    elif kind == 'seedling': tool_seedling(mb, anchor, rng)
    if anchor is not None:
        k = TOOL_SCALE[kind]
        for i in range(s0, len(mb.v)): mb.v[i] = tuple(anchor + (Vector(mb.v[i]) - anchor) * k)
    rot = R.get('tool_rot' if key == 'tool' else 'tool2_rot', 0)
    if rot:   # tools are modelled as seen in the working pose; undo the clip's hand rotation so they read right there
        Rm = Matrix.Rotation(math.radians(rot), 3, 'X')
        for i in range(s0, len(mb.v)): mb.v[i] = tuple(anchor + Rm @ (Vector(mb.v[i]) - anchor))
    while len(mb.rigid) < len(mb.v): mb.rigid.append(bone)
    for i in range(s0, len(mb.v)): mb.rigid[i] = bone

def build_chibi(role, location=(0, 0, 0), clips=False):
    R = ROLES[role]; rng = random.Random(sum(map(ord, role))); sex = R['sex']; J = chibi_joints()
    skin = lin(R['skin']); top = lin(R['top']); bottom = lin(R['bottom'])
    shoes = lin((.30, .46, .34)) if R.get('boots') else lin((.52, .34, .20))
    glove = lin((.95, .72, .30))
    mb = SMB(); V, F = chibi_body(J, sex, R.get('build', 1.0))
    bone_seg = {b: (J[h], J[t]) for b, h, t, _ in BONES}
    def region_col(p):
        best = min(bone_seg, key=lambda b: seg_dist(p, *bone_seg[b])[0])
        if best.startswith('hand'): c = glove if R.get('gloves') else skin
        elif best.startswith('foot') or p.z < .13: c = shoes
        elif R.get('boots') and best.startswith('shin') and p.z < .22: c = shoes
        elif best.startswith('shin') or best.startswith('thigh'): c = skin if R.get('dress') and p.z < J['knee.L'].z - .06 else bottom   # (a knee poking through a skirt stays the skirt's colour)
        elif best.startswith('forearm'): c = top if R.get('long') else skin
        elif best in ('neck', 'head'): c = skin
        elif best.startswith('upper_arm'): c = top
        else: c = top if p.z > .515 else bottom      # a straight hem: by height, not by the nearest bone
        return c
    def lit(p):   # under the big head and at the feet, painted because the farm has no shadows
        return 1 - max(0, min(1, (p.z - .74) / .10)) * .14 - max(0, (.08 - p.z) / .08) * .14
    # one colour per face, vertices split on the border, so a shirt ends where the trousers start instead of fading into them
    split = {}
    for f in F:
        col = region_col(sum((V[i] for i in f), Vector()) / len(f))
        idx = []
        for i in f:
            key = (i, col)
            if key not in split: split[key] = mb.add(V[i], (0, 0), shade(col, lit(V[i])))
            idx.append(split[key])
        mb.face(idx)
    c, r = chibi_head(mb, J, R, skin)
    hair_col = lin((.13, .09, .08)); hair = R.get('hair')
    if hair == 'scarf': chibi_scarf(mb, c, r, lin(R['scarf']))
    else:
        ears(mb, c, r, skin)
        chibi_hair(mb, c, r, hair_col, th_max=.62, rings=2)
        (chibi_cap if hair == 'cap' else chibi_straw)(mb, c, r, lin(R['hat']))
    if R.get('dress'): chibi_skirt(mb, J, bottom)
    chibi_hem(mb, top, R.get('dress'), R.get('build', 1.0))
    if R.get('apron'): chibi_apron(mb, J, lin(R['apron']))
    if R.get('collar'):
        start = len(mb.v)
        for sx in (-1, 1):
            quad(mb, [J['neck'] + Vector((sx * .02, -.09, -.03)), J['neck'] + Vector((sx * .13, -.06, -.05)), J['neck'] + Vector((sx * .11, -.10, .02)), J['neck'] + Vector((sx * .015, -.105, .02))][::sx], top, both=True)
        bind_rigid(mb, start, 'chest')
    for key in ('tool', 'tool2'):
        if key in R: add_tool(mb, R, key, J, rng)
    while len(mb.rigid) < len(mb.v): mb.rigid.append('hips')     # (helpers of the old file add through MB.add with no bone: none reach here)
    sc = bpy.context.scene
    arm_data = bpy.data.armatures.new(f'{role}_rig'); arm = bpy.data.objects.new(role, arm_data)
    sc.collection.objects.link(arm); arm.location = location
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects: o.select_set(False)
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, h, t, parent in BONES:
        eb = arm_data.edit_bones.new(name); eb.head = J[h]; eb.tail = J[t]; eb.roll = 0
        if parent: eb.parent = arm_data.edit_bones[parent]; eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    ob = mb.build(role, flat_material()); sc.collection.objects.link(ob); ob.parent = arm
    for b, *_ in BONES: ob.vertex_groups.new(name=b)
    for vi, co in enumerate(mb.v):
        rb = mb.rigid[vi]
        if isinstance(rb, dict):
            for b, w in rb.items(): ob.vertex_groups[b].add([vi], w, 'REPLACE')
            continue
        if rb: ob.vertex_groups[rb].add([vi], 1.0, 'REPLACE'); continue
        p = Vector(co); ds = sorted(((seg_dist(p, *bone_seg[b])[0], b) for b in bone_seg), key=lambda x: x[0])[:3]
        ws = [(b, 1 / max(d, .004) ** 4) for d, b in ds]; tot = sum(w for _, w in ws)
        for b, w in ws:
            if w / tot > .02: ob.vertex_groups[b].add([vi], w / tot, 'REPLACE')
    mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = arm
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    if clips: make_chibi_clips(arm)
    return arm, ob

# ───────────────────────────── one set of clips ─────────────────────────────

def _idle(t):
    b = math.sin(t * TAU)
    return ({'spine': [(X, 1.5 * b)], 'chest': [(X, 1 * b)], 'head': [(Z, 6 * math.sin(t * TAU + 1)), (X, 2 * b)],
             'upper_arm.L': [(Y, -6), (X, 2 * b)], 'upper_arm.R': [(Y, 6), (X, 2 * b)], 'forearm.L': [(X, -12)], 'forearm.R': [(X, -12)],
             'thigh.L': [(Y, -2)], 'thigh.R': [(Y, 2)]}, -.006 * (1 + b), 0)
def _walk(t):
    P, rz = walk_pose(t); P['head'] = [(Z, 3 * math.sin(t * TAU)), (X, 2 * math.cos(t * TAU * 2))]    # a little bounce of the big head
    return P, rz * .8, 0
def _carry(t):   # the sack is on the back: both hands hold its straps
    P, rz = walk_pose(t, arm_swing=0, stride=.85)
    for s, sg in (('L', 1), ('R', -1)): P[f'upper_arm.{s}'] = [(X, -30), (Y, -8 * sg)]; P[f'forearm.{s}'] = [(X, -85)]
    P['spine'] += [(X, 6)]
    return P, rz * .8 - .006, 0
def _harvest(t):
    k = (math.sin(t * TAU - PI / 2) + 1) / 2; pick = math.sin(t * TAU * 4) * 6 * k   # the short arms reach in front of the big head, not over it
    return ({'spine': [(X, 8 - 6 * k)], 'chest': [(X, 4 - 4 * k), (Z, 6 * k)], 'head': [(X, -8 * k), (Z, 8 * k)],
             'upper_arm.R': [(X, -40 - 55 * k), (Y, 16)], 'forearm.R': [(X, -60 + 25 * k + pick)], 'hand.R': [(X, -10 + pick)],
             'upper_arm.L': [(X, -85), (Y, -16)], 'forearm.L': [(X, -35)], 'hand.L': [(X, -20)],
             'thigh.L': [(X, -4)], 'shin.L': [(X, 6)], 'thigh.R': [(X, 3)], 'shin.R': [(X, 3)]}, -.006, 0)
def _water(t):
    tilt = max(0, math.sin(t * TAU)) * 35; sway = math.sin(t * TAU) * 10
    return ({'spine': [(X, 10), (Z, sway * .4)], 'chest': [(X, 6)], 'head': [(X, 6)],
             'upper_arm.R': [(X, -25), (Y, 10)], 'forearm.R': [(X, -15)], 'hand.R': [(X, -tilt), (Z, sway)],
             'upper_arm.L': [(X, -10), (Y, -10)], 'forearm.L': [(X, -30)],
             'thigh.R': [(X, -8)], 'shin.R': [(X, 10)], 'thigh.L': [(X, 6)]}, -.006, 0)
def _prune(t):
    snip = (math.sin(t * TAU * 3) > .6) * 12; reach = math.sin(t * TAU) * 15
    return ({'spine': [(X, 6)], 'chest': [(X, 4), (Z, reach * .5)], 'head': [(X, -4), (Z, reach * .4)],
             'upper_arm.R': [(X, -80 - reach), (Y, 20)], 'forearm.R': [(X, -35)], 'hand.R': [(Y, snip)],
             'upper_arm.L': [(X, -80 + reach * .5), (Y, -18)], 'forearm.L': [(X, -40)], 'hand.L': [(X, -25)],
             'thigh.L': [(X, -6)], 'shin.L': [(X, 8)]}, -.006, 0)
def _plant(t):
    k = (math.sin(t * TAU) + 1) / 2     # short legs: the crouch drops less than on the tall rig
    return ({'hips': [(X, 8)], 'spine': [(X, 14 + 8 * (1 - k))], 'chest': [(X, 6)], 'head': [(X, -14)],
             'upper_arm.R': [(X, -40 - 55 * k), (Y, 12)], 'forearm.R': [(X, -50 + 20 * k)],
             'upper_arm.L': [(X, -45 - 45 * k), (Y, -12)], 'forearm.L': [(X, -60 + 20 * k)],
             'thigh.L': [(X, -50)], 'shin.L': [(X, 70)], 'foot.L': [(X, -18)],
             'thigh.R': [(X, -25)], 'shin.R': [(X, 45)], 'foot.R': [(X, -18)]}, -.07, .015)
def _rake(t):
    k = math.sin(t * TAU)
    return ({'spine': [(X, 12 + 6 * k)], 'chest': [(X, 5)], 'head': [(X, -8)],
             'upper_arm.R': [(X, -45 - 25 * k), (Y, 10)], 'forearm.R': [(X, -40 + 10 * k)],
             'upper_arm.L': [(X, -60 - 25 * k), (Y, -12)], 'forearm.L': [(X, -45 + 10 * k)],
             'thigh.L': [(X, -18)], 'shin.L': [(X, 20)], 'thigh.R': [(X, 10)], 'shin.R': [(X, 6)]}, -.014, 0)
def _inspect(t):
    look = math.sin(t * TAU) * 25; write = (t > .55) * math.sin((t - .55) / .45 * TAU * 3) * 6
    return ({'spine': [(X, 3)], 'head': [(Z, look), (X, 6 * (t > .55))],
             'upper_arm.L': [(X, -35), (Y, -8)], 'forearm.L': [(X, -80)], 'hand.L': [(Z, 20)],
             'upper_arm.R': [(X, -30 + write), (Y, 14)], 'forearm.R': [(X, -75 + write)],
             'thigh.L': [(Y, -3)], 'thigh.R': [(Y, 3)]}, 0, 0)
CLIPS = (('idle', 60, _idle), ('walk', 32, _walk), ('carry', 36, _carry), ('harvest', 54, _harvest), ('water', 60, _water),
         ('prune', 48, _prune), ('plant', 48, _plant), ('rake', 50, _rake), ('inspect', 90, _inspect))

def make_chibi_clips(arm):
    for name, frames, fn in CLIPS: make_clip(arm, name, frames, fn)
    set_pose(arm, {})

# ───────────────────────────── export / preview ─────────────────────────────

def export_glb(arm, path, with_mesh, with_clips):
    for o in bpy.data.objects: o.select_set(False)
    arm.select_set(True)
    if with_mesh:
        for c in arm.children_recursive: c.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_image_format='WEBP', export_vertex_color='ACTIVE',
              export_animations=with_clips, export_skins=with_mesh, export_def_bones=False, export_extras=False)
    if with_clips: kw.update(export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=1)
    bpy.ops.export_scene.gltf(**kw)
    print('exported', path, os.path.getsize(path) // 1024, 'KB')

def reset():
    purge()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for a in list(bpy.data.armatures):
        if a.users == 0: bpy.data.armatures.remove(a)

def export_all(out_dir, only=None):
    for role in ROLES:
        if only and role not in only: continue
        reset(); arm, ob = build_chibi(role)
        export_glb(arm, os.path.join(out_dir, f'worker-{role.replace("_", "-")}.glb'), True, False)
        print(role, sum(len(p.vertices) - 2 for p in ob.data.polygons), 'tris')
    reset(); arm, _ = build_chibi('supervisor_m', clips=True)
    export_glb(arm, os.path.join(out_dir, 'worker-anims.glb'), False, True)

def preview(path, work, high):
    bpy.ops.object.select_all(action='DESELECT'); purge()
    sc = bpy.context.scene; fn = {n: f for n, _, f in CLIPS}; step = 1.5
    for i, role in enumerate(ROLES):
        arm, ob = build_chibi(role, location=(i * step, 0, 0))
        for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
        P, rz, ry = fn[ROLES[role]['clip'] if work else 'idle'](.3)
        set_pose(arm, P, rz, ry)
    mid = (len(ROLES) - 1) * step / 2
    plane = bpy.data.meshes.new('g'); plane.from_pydata([(-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0)], [], [(0, 1, 2, 3)])
    g = bpy.data.objects.new('g', plane); sc.collection.objects.link(g)
    mg = bpy.data.materials.new('gm'); mg.use_nodes = True; next(n for n in mg.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (.32, .55, .20, 1); plane.materials.append(mg)
    cam = bpy.data.cameras.new('c'); cam.lens = 42; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    co.location = (mid, -17, 13 if high else 2.2); aim = Vector((mid, 0, .75)) - Vector(co.location); co.rotation_euler = aim.to_track_quat('-Z', 'Y').to_euler()
    sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 2.2; so = bpy.data.objects.new('s', sun); sc.collection.objects.link(so); so.rotation_euler = (.9, .2, -.5)
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.85, .9, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0; sc.world = w
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'; sc.render.resolution_x = 1800; sc.render.resolution_y = 520 if not high else 620
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

if __name__ == '__main__' and not globals().get('_GEDEO_LIB'):
    a = sys.argv
    if '--export' in a: export_all(a[a.index('--export') + 1], a[a.index('--only') + 1].split(',') if '--only' in a else None)
    if '--preview' in a: preview(a[a.index('--preview') + 1], '--work' in a, '--high' in a)
