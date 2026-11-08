"""Gedeo farm workers — rigged, skinned, animated (Blender 5.x). No AI generator: body is one continuous mesh from a
Skin-modifier skeleton + subdivision, head sculpted from a deformed ellipsoid, clothes as separate skinned garments.

Shared 18-bone rig, clips (in place, 30 fps): idle, walk, harvest, carry, water, prune, plant, rake, inspect.
Roles (one GLB each, tool parented to a bone):
  picker_f   headscarf, dress + apron, woven basket at the waist        → harvest
  picker_m   cap, shirt + trousers, waist basket                        → harvest
  waterer_m  cap, rubber boots, galvanised watering can                 → water
  pruner_m   straw hat, gloves, pruning shears                          → prune
  planter_f  headscarf, skirt, hoe + polybag seedling                   → plant
  hauler_m   cap, jute sack on the shoulder                             → carry
  processor_f headscarf, apron, rubber boots, wooden drying-bed rake     → rake
  supervisor_m collared shirt, cap, clipboard                           → inspect

Headless export:  Blender -b --factory-startup -P scripts/blender/gedeo_characters.py -- --export public/models/gedeo
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1   # nesting depth: only the outermost script exports
exec(open(os.path.join(_here, 'gedeo_buildings.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import Matrix, Euler

def lin(c):
    """sRGB tuple → linear (vertex colours are linear)."""
    f = lambda x: x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)

FPS = 30

# ───────────────────────────── skeleton ─────────────────────────────

def joints(sex='m'):
    """Joint positions (m). Character faces -Y, left = +X. A-pose arms ~12° out."""
    k = 1.0 if sex == 'm' else .94
    J = {'pelvis': (0, 0, .97), 'spine': (0, .005, 1.12), 'chest': (0, .01, 1.30), 'upper_chest': (0, .01, 1.40),
         'neck': (0, .0, 1.47), 'neck_top': (0, -.005, 1.55), 'head_top': (0, -.01, 1.76),
         'shoulder.L': (.185, .01, 1.415), 'elbow.L': (.235, .025, 1.14), 'wrist.L': (.27, .0, .90), 'hand.L': (.285, -.01, .80),
         'hip.L': (.095, 0, .93), 'knee.L': (.105, -.015, .51), 'ankle.L': (.11, .01, .085), 'toe.L': (.115, -.13, .03)}
    if sex == 'f':
        J.update({'shoulder.L': (.165, .01, 1.405), 'elbow.L': (.215, .025, 1.14), 'wrist.L': (.25, 0, .91), 'hand.L': (.262, -.01, .82),
                  'hip.L': (.10, 0, .93)})
    for key in list(J):
        if key.endswith('.L'): x, y, z = J[key]; J[key[:-2] + '.R'] = (-x, y, z)
    return {n: Vector(p) * k for n, p in J.items()}

BONES = [  # name, head joint, tail joint, parent
    ('hips', 'pelvis', 'spine', None), ('spine', 'spine', 'chest', 'hips'), ('chest', 'chest', 'neck', 'spine'),
    ('neck', 'neck', 'neck_top', 'chest'), ('head', 'neck_top', 'head_top', 'neck'),
] + [b for s in 'LR' for b in [
    (f'upper_arm.{s}', f'shoulder.{s}', f'elbow.{s}', 'chest'), (f'forearm.{s}', f'elbow.{s}', f'wrist.{s}', f'upper_arm.{s}'),
    (f'hand.{s}', f'wrist.{s}', f'hand.{s}', f'forearm.{s}'),
    (f'thigh.{s}', f'hip.{s}', f'knee.{s}', 'hips'), (f'shin.{s}', f'knee.{s}', f'ankle.{s}', f'thigh.{s}'),
    (f'foot.{s}', f'ankle.{s}', f'toe.{s}', f'shin.{s}')]]

def seg_dist(p, a, b):
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-9))); return (p - (a + ab * t)).length, t

# ───────────────────────────── body mesh ─────────────────────────────

class SMB(MB):
    """MB with optional rigid bone binding per vertex (None = weights by distance to bones)."""
    def __init__(s): super().__init__(); s.rigid = []
    def add(s, co, uv=(0, 0), col=(1, 1, 1, 1), rigid=None):
        s.rigid.append(rigid); return super().add(co, uv, col)

def skin_body(J, sex, build=1.0):
    """Continuous body from a Skin-modifier skeleton (+ Catmull-Clark)."""
    m = sex == 'm'
    nodes = [('pelvis', (.150 if m else .165, .105)), ('spine', (.135 if m else .118, .095)), ('chest', (.160 if m else .150, .105 if m else .110)),
             ('upper_chest', (.165 if m else .145, .100)), ('neck', (.052, .052)), ('neck_top', (.047, .05))]
    for s in 'LR':
        nodes += [(f'shoulder.{s}', (.054, .054)), (f'elbow.{s}', (.040, .040)), (f'wrist.{s}', (.029, .024)), (f'hand.{s}', (.036, .016)),
                  (f'hip.{s}', (.078 if m else .085, .080)), (f'knee.{s}', (.050, .054)), (f'ankle.{s}', (.035, .040)), (f'toe.{s}', (.038, .024))]
    names = [n for n, _ in nodes]; idx = {n: i for i, n in enumerate(names)}
    verts = [tuple(J[n]) for n in names]
    # mid-thigh / mid-calf / mid-arm helpers give muscle shape
    extra = []
    def mid(a, b, f, r):
        p = J[a].lerp(J[b], f); names.append(f'{a}~{b}'); verts.append(tuple(p)); nodes.append((names[-1], r)); return len(verts) - 1
    edges = [(idx['pelvis'], idx['spine']), (idx['spine'], idx['chest']), (idx['chest'], idx['upper_chest']), (idx['upper_chest'], idx['neck']), (idx['neck'], idx['neck_top'])]
    for s in 'LR':
        sh = idx[f'shoulder.{s}']; edges.append((idx['upper_chest'], sh))
        ua = mid(f'shoulder.{s}', f'elbow.{s}', .4, (.050 * build, .052 * build)); edges += [(sh, ua), (ua, idx[f'elbow.{s}'])]
        fa = mid(f'elbow.{s}', f'wrist.{s}', .35, (.040 * build, .036 * build)); edges += [(idx[f'elbow.{s}'], fa), (fa, idx[f'wrist.{s}']), (idx[f'wrist.{s}'], idx[f'hand.{s}'])]
        hp = idx[f'hip.{s}']; edges.append((idx['pelvis'], hp))
        th = mid(f'hip.{s}', f'knee.{s}', .35, ((.074 if m else .080) * build, .076 * build)); edges += [(hp, th), (th, idx[f'knee.{s}'])]
        cf = mid(f'knee.{s}', f'ankle.{s}', .3, (.050 * build, .056 * build)); edges += [(idx[f'knee.{s}'], cf), (cf, idx[f'ankle.{s}']), (idx[f'ankle.{s}'], idx[f'toe.{s}'])]
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

def head_mesh(mb, J, sex, skin, rng, col_eye=(.03, .02, .02, 1)):
    """Head: ellipsoid sculpted per vertex (jaw, cheeks, skull, brow), plus eyes, nose, ears, lips. Rigid to 'head'."""
    c = J['neck_top'] + Vector((0, -.012, .095)); rx, ry, rz = .078, .095, .112
    seg, rings = 18, 14; grid = []
    for i in range(rings + 1):
        th = -math.pi / 2 + math.pi * i / rings; row = []
        for j in range(seg + 1):
            ph = TAU * j / seg - math.pi / 2               # ph=−π/2 → front (−Y)
            x, y, z = math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), math.sin(th)
            front = max(0, -y)
            sx = rx * (1 - .28 * max(0, -z) ** 1.3 * (.6 + .4 * front))    # jaw narrows
            sy = ry * (1 + .12 * max(0, y) * (z > -.2))                    # skull back
            sz = rz * (1 + .05 * max(0, z))
            p = c + Vector((x * sx, y * sy, z * sz))
            p.y -= .012 * front * max(0, 1 - abs(z - .25) * 3)          # brow ridge
            p.y -= .008 * front * max(0, 1 - abs(z + .35) * 4)          # chin
            row.append(mb.add(p, (j / seg * 2, i / rings), skin, rigid='head'))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    fr = c + Vector((0, -ry * .93, 0))
    for sx in (-1, 1):
        ellipsoid(mb, fr + Vector((sx * .03, .016, .02)), Vector((0, -1, 0)), .007, .012, (.85, .82, .78, 1), 8, 4)    # eye white
        ellipsoid(mb, fr + Vector((sx * .03, .010, .02)), Vector((0, -1, 0)), .004, .0075, col_eye, 8, 3)          # iris
        ellipsoid(mb, fr + Vector((sx * .03, .008, .038)), Vector((1, 0, -.15 * sx)), .016, .0045, (.03, .02, .015, 1), 8, 3)  # brows
        ellipsoid(mb, c + Vector((sx * rx * .93, .012, -.008)), Vector((0, .3, 1)), .026, .009, skin, 8, 4)    # ears
    ellipsoid(mb, fr + Vector((0, -.004, -.014)), Vector((0, -.35, -1)), .022, .013, skin, 8, 4)               # nose
    ellipsoid(mb, fr + Vector((0, .012, -.052)), Vector((1, 0, 0)), .02, .006, tuple(v * .6 for v in skin[:3]) + (1,), 8, 3)  # lips
    return c, (rx, ry, rz)

def bind_rigid(mb, start, bone):
    for i in range(start, len(mb.v)): mb.rigid[i] = bone

# ───────────────────────────── garments & accessories ─────────────────────────────

def hair_cap(mb, c, r, col, sex):
    """Short hair: skull cap whose lower edge follows a hairline (high on the forehead, low at the nape)."""
    seg, rings = 18, 8; grid = []
    for i in range(rings + 1):
        f = i / rings; row = []
        for j in range(seg + 1):
            ph = TAU * j / seg - math.pi / 2; yd = math.sin(ph); front = max(0, -yd)
            ss = min(1, max(0, (-yd - .15) / .55)); ss = ss * ss * (3 - 2 * ss)
            th0 = -.3 + .55 * min(1, max(0, -yd + .35)) + .55 * ss      # forehead high, temples above the eyes, nape low
            th = th0 + (math.pi / 2 - th0) * f
            k = 1.045
            p = c + Vector((math.cos(th) * math.cos(ph) * r[0] * k, math.cos(th) * yd * r[1] * (1.06 if yd > 0 else k), math.sin(th) * r[2] * k + .003))
            row.append(mb.add(p, (j / seg, f), col, rigid='head'))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))

def headscarf(mb, c, r, col, rng):
    """Wrapped headscarf: covers skull + back, knot tail at the nape."""
    seg, rings = 18, 9; grid = []
    for i in range(rings + 1):
        th = -.55 + (math.pi / 2 + .55) * i / rings; row = []
        for j in range(seg + 1):
            ph = TAU * j / seg - math.pi / 2; y = math.cos(th) * math.sin(ph)
            if y < -.25 and th < .45: th_ = max(th, .45)
            else: th_ = th
            k = 1.13 + .025 * math.sin(j * 1.7 + i)
            p = c + Vector((math.cos(th_) * math.cos(ph) * r[0] * k, math.cos(th_) * math.sin(ph) * r[1] * k, math.sin(th_) * r[2] * k + .01))
            row.append(mb.add(p, (j / seg * 2, i / rings), col, rigid='head'))
        grid.append(row)
    for i in range(rings):
        for j in range(seg): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    knot = c + Vector((0, r[1] * 1.15, -.03))
    ellipsoid(mb, knot, Vector((0, 1, 0)), .03, .025, col, 6, 3)
    start = len(mb.v)
    for sx in (-1, 1):
        a = knot + Vector((sx * .01, .01, -.02)); b = knot + Vector((sx * .03, .05, -.14))
        tube(mb, [a, a.lerp(b, .5) + Vector((0, .01, 0)), b], [.018, .016, .01], 5, col=col)
    bind_rigid(mb, start, 'head')

def cap(mb, c, r, col):
    start = len(mb.v)
    lathe(mb, [(r[0] * 1.1, c.z + .035), (r[0] * 1.08, c.z + .07), (r[0] * .85, c.z + .11), (.01, c.z + .125)], 14, col=col, center=(c.x, c.y + .005, 0))
    brim = [mb.add(c + Vector((x * .065, -r[1] * 1.0 - .07 * (1 - x * x) - .01, .042 - .01 * (1 - x * x))), (0, 0), tuple(v * .8 for v in col[:3]) + (1,)) for x in np.linspace(-1, 1, 7)]
    base = [mb.add(c + Vector((x * .07, -r[1] * .9, .045)), (0, 0), col) for x in np.linspace(-1, 1, 7)]
    for i in range(6): mb.face((base[i], base[i + 1], brim[i + 1], brim[i])); mb.face((brim[i], brim[i + 1], base[i + 1], base[i]))
    bind_rigid(mb, start, 'head')

def straw_hat(mb, c, r, col):
    start = len(mb.v)
    z = c.z + .04
    lathe(mb, [(.20, z - .01), (.17, z), (r[0] * 1.12, z + .005), (r[0] * 1.08, z + .085), (.02, z + .1)], 20, col=col, center=(c.x, c.y, 0))
    lathe(mb, [(.02, z + .1), (r[0] * 1.08, z + .085), (r[0] * 1.12, z + .005), (.17, z), (.20, z - .01)], 20, col=col, center=(c.x, c.y, 0))   # inside
    lathe(mb, [(r[0] * 1.13, z + .02), (r[0] * 1.13, z + .04)], 20, col=lin((.35, .16, .10)), center=(c.x, c.y, 0))                         # band
    bind_rigid(mb, start, 'head')

def skirt(mb, J, col, length=.08, flare=.12):
    """Skirt / dress hem: cone from waist to ~mid-calf, weighted by distance (follows hips + thighs)."""
    z0 = J['pelvis'].z + .05; z1 = length
    seg = 20; rows = 7
    grid = []
    for i in range(rows + 1):
        f = i / rows; z = z0 + (z1 - z0) * f
        rad = (.175 + flare * f ** 1.2); row = []
        for j in range(seg + 1):
            a = TAU * j / seg
            p = Vector((math.cos(a) * rad, math.sin(a) * rad * .82 + .01, z)) + Vector((0, 0, .008 * math.sin(a * 5) * f))
            side = 'L' if p.x > 0 else 'R'; k = min(.45, f * .6) * min(1, abs(p.x) / .1)
            row.append(mb.add(p, (j / seg * 3, f * 2), col, rigid={'hips': 1 - k, f'thigh.{side}': k} if k > .01 else 'hips'))
        grid.append(row)
    for i in range(rows):
        for j in range(seg): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))   # outward normals (rows run downward)
    # inside surface so the hem is not see-through from below
    start = len(mb.v); grid2 = []
    for i in range(rows + 1):
        row = []
        for j in range(seg + 1):
            row.append(mb.add(Vector(mb.v[grid[i][j]]) * Vector((.99, .99, 1)), (0, 0), tuple(v * .5 for v in col[:3]) + (1,), rigid=mb.rigid[grid[i][j]]))
        grid2.append(row)
    for i in range(rows):
        for j in range(seg): mb.face((grid2[i][j], grid2[i][j + 1], grid2[i + 1][j + 1], grid2[i + 1][j]))

def apron(mb, J, col, long=True):
    start = len(mb.v)
    zt = J['pelvis'].z + .08; zb = .45 if long else .7; w0, w1 = .15, .19
    rows = 5; grid = []
    for i in range(rows + 1):
        f = i / rows; z = zt + (zb - zt) * f; w = w0 + (w1 - w0) * f; row = []
        for x in np.linspace(-1, 1, 5):
            y = -.125 - .03 * f - .02 * (1 - x * x) - (.06 * f if long else 0)
            row.append(mb.add((x * w, y, z), (x, f), col, rigid='hips'))
        grid.append(row)
    for i in range(rows):
        for j in range(4): mb.face((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])); mb.face((grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j], grid[i][j]))

# ───────────────────────────── tools (rest pose, world coords) ─────────────────────────────

def tool_basket(mb, at, col=lin((.62, .48, .30))):
    """Woven waist basket for cherries, with rope; ~30 cm."""
    lathe(mb, [(.10, 0), (.13, .04), (.155, .20), (.16, .22)], 16, col=col, center=at, u_len=.2, v_len=.2)
    lathe(mb, [(.16, .22), (.145, .21), (.12, .05), (.01, .01)], 16, col=tuple(v * .7 for v in col[:3]) + (1,), center=at, u_len=.2, v_len=.2)
    lathe(mb, [(.01, .14), (.14, .14)], 16, col=lin((.58, .06, .05)), center=at)        # cherries inside
    for k in range(20):
        a = TAU * k / 20; ellipsoid(mb, Vector(at) + Vector((math.cos(a) * .1, math.sin(a) * .1, .155)), UP, .013, .013, lin((.62, .07, .05)), 5, 2)

def tool_can(mb, at):
    """Galvanised watering can held by the top handle at `at` (hand)."""
    o = Vector(at) + Vector((0, 0, -.27)); g = (.16, .17, .17, 1)
    lathe(mb, [(.01, 0), (.09, 0), (.095, .17), (.075, .21), (.04, .23), (.01, .23)], 14, col=g, center=o)
    tube(mb, [o + Vector((0, -.08, .05)), o + Vector((0, -.25, .2)), o + Vector((0, -.36, .32))], [.018, .014, .012], 6, col=g)
    lathe(mb, [(.012, 0), (.04, .045)], 10, col=g, center=o + Vector((0, -.38, .30)))
    tube(mb, [o + Vector((0, .07, .25)), o + Vector((0, .03, .32)), o + Vector((0, -.04, .30)), o + Vector((0, -.05, .25))], [.011] * 4, 6, col=g)

def tool_shears(mb, at):
    o = Vector(at) + Vector((0, -.02, -.03)); red = lin((.75, .12, .08)); steel = (.7, .72, .74, 1)
    for sx in (-1, 1):
        tube(mb, [o + Vector((sx * .012, 0, 0)), o + Vector((sx * .02, -.03, -.09))], [.011, .010], 6, col=red, cap=True)
        pts = [o + Vector((sx * .004, -.03, -.09)), o + Vector((sx * .002, -.05, -.14)), o + Vector((0, -.055, -.17))]
        tube(mb, pts, [.008, .006, .001], 4, col=steel)

def tool_hoe(mb, at):
    """Ethiopian hoe: long eucalyptus handle (held at `at`, angled forward-down) + forged blade."""
    d = Vector((0, -.5, -.866)); a = Vector(at) - d * .35; b = Vector(at) + d * .95
    tube(mb, [a, a.lerp(b, .5), b], [.017, .018, .019], 6, col=lin((.62, .50, .36)), cap=True)
    d = (b - a).normalized(); s = d.cross(Vector((1, 0, 0))).normalized()
    p0 = b + d * .02
    quad(mb, [p0 + Vector((-.08, 0, 0)), p0 + Vector((.08, 0, 0)), p0 + Vector((.07, 0, 0)) + s * .2, p0 + Vector((-.07, 0, 0)) + s * .2], (.30, .30, .31, 1), both=True)

def tool_rake(mb, at):
    d = Vector((0, -.866, -.5)); a = Vector(at) - d * .45; b = Vector(at) + d * 1.25
    tube(mb, [a, b], [.016, .017], 6, col=lin((.70, .58, .42)), cap=True)
    for x in np.linspace(-.25, .25, 2): pass
    box(mb, b + Vector((0, 0, -.02)), (.55, .04, .05), col=lin((.60, .48, .34)), uv=4)
    for x in np.linspace(-.25, .25, 9):
        tube(mb, [b + Vector((x, 0, -.04)), b + Vector((x, -.01, -.12))], [.006, .004], 4, col=lin((.60, .48, .34)))

def tool_sack(mb, at):
    superellipsoid(mb, Vector(at), (.34, .62, .26), e=.5, seg=10, rings=6, rz=.25, sag=.1, col=lin((.66, .54, .36)))

def tool_clipboard(mb, at):
    o = Vector(at) + Vector((0, -.06, .02))
    box(mb, o, (.24, .012, .32), col=lin((.45, .30, .18)), uv=4)
    box(mb, o + Vector((0, -.008, -.01)), (.21, .004, .27), col=(.9, .9, .88, 1), uv=4)
    box(mb, o + Vector((0, -.012, .14)), (.08, .012, .03), col=(.6, .6, .62, 1), uv=4)

def tool_seedling(mb, at, rng):
    o = Vector(at) + Vector((0, -.02, -.13))
    lathe(mb, [(.01, 0), (.05, .005), (.055, .11), (.045, .12)], 10, col=(.03, .03, .03, 1), center=o)          # black polybag
    lathe(mb, [(.045, .12), (.01, .118)], 10, col=lin((.35, .22, .14)), center=o)                             # soil
    tube(mb, [o + Vector((0, 0, .11)), o + Vector((0, 0, .26))], [.003, .002], 4, col=lin((.40, .55, .25)))
    for k in range(4):
        a = k * math.pi / 2 + .3; z = .15 + .03 * k
        leaf(mb, o + Vector((0, 0, z)), Vector((math.cos(a), math.sin(a), .6)), UP, .05, .022, (0, 0, 1, 1), lin((.18, .40, .12)),
             lambda s: math.sin(math.pi * s) ** .7, segs=2, droop=.15, fold=.2, rng=rng)

# ───────────────────────────── character assembly ─────────────────────────────

ROLES = {
    'picker_f': dict(sex='f', skin=(.40, .25, .17), top=(.80, .28, .24), bottom=(.25, .30, .55), hair='scarf', scarf=(.92, .82, .30), dress=True, apron=(.85, .85, .80), boots=False, tool=('basket', 'hips'), clip='harvest'),
    'picker_m': dict(sex='m', skin=(.36, .23, .16), top=(.30, .45, .60), bottom=(.32, .30, .26), hair='cap', hat=(.20, .32, .20), tool=('basket', 'hips'), clip='harvest'),
    'waterer_m': dict(sex='m', skin=(.34, .21, .14), top=(.55, .52, .45), bottom=(.22, .25, .30), hair='cap', hat=(.70, .55, .20), boots=True, tool=('can', 'hand.R'), tool_rot=40, clip='water'),
    'pruner_m': dict(sex='m', skin=(.38, .24, .16), top=(.40, .50, .30), bottom=(.30, .27, .22), hair='straw', hat=(.80, .68, .42), gloves=True, tool=('shears', 'hand.R'), clip='prune'),
    'planter_f': dict(sex='f', skin=(.42, .27, .18), top=(.35, .55, .40), bottom=(.55, .25, .35), hair='scarf', scarf=(.85, .30, .30), dress=True, tool=('hoe', 'hand.R'), tool_rot=95, tool2=('seedling', 'hand.L'), tool2_rot=120, clip='plant'),
    'hauler_m': dict(sex='m', skin=(.33, .20, .13), top=(.75, .70, .60), bottom=(.25, .22, .20), hair='cap', hat=(.15, .15, .18), build=1.08, tool=('sack', 'chest'), clip='carry'),
    'processor_f': dict(sex='f', skin=(.40, .26, .17), top=(.60, .40, .60), bottom=(.30, .35, .45), hair='scarf', scarf=(.95, .95, .92), dress=True, apron=(.30, .40, .55), boots=True, tool=('rake', 'hand.R'), tool_rot=85, clip='rake'),
    'supervisor_m': dict(sex='m', skin=(.37, .23, .15), top=(.90, .90, .86), bottom=(.20, .22, .30), hair='cap', hat=(.30, .20, .12), collar=True, tool=('clipboard', 'hand.L'), tool_rot=60, clip='inspect'),
}

def cloth_tex():
    rng = np.random.default_rng(201); H = W = 256
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    weave = (np.sin(u * TAU * 64) * np.sin(v * TAU * 64) + 1) * .5
    n = fbm(H, W, 4, 4, 3, rng)
    c = np.ones((H, W, 4), np.float32); c[..., :3] = (.86 + .08 * weave + .12 * (n - .5))[..., None]
    return c

def build_character(role, location=(0, 0, 0)):
    R = ROLES[role]; rng = random.Random(hash(role) & 0xffff); sex = R['sex']; J = joints(sex)
    skin = lin(R['skin']); top = lin(R['top']); bottom = lin(R['bottom'])
    boots = (.04, .04, .04, 1) if R.get('boots') else lin((.25, .18, .12))
    mb = SMB()
    V, F = skin_body(J, sex, R.get('build', 1.0))
    bone_seg = {b: (J[h], J[t]) for b, h, t, _ in BONES}
    knee_z = J['knee.L'].z
    def region_col(p):
        best = min(bone_seg, key=lambda b: seg_dist(p, *bone_seg[b])[0])
        if best.startswith('hand'): return lin((.55, .45, .30)) if R.get('gloves') else skin
        if best.startswith('foot') or p.z < .14: return boots
        if R.get('boots') and best.startswith('shin') and p.z < .36: return boots
        if best.startswith('shin') or best.startswith('thigh'):
            if R.get('dress') and p.z < knee_z - .05: return skin
            return bottom
        if best.startswith('forearm'):
            return top if (role in ('supervisor_m', 'waterer_m', 'pruner_m', 'processor_f')) else skin
        if best in ('neck', 'head'): return skin if p.z > J['neck'].z + .01 else top
        if best == 'hips': return bottom
        return top
    for p in V: mb.add(p, ((p.x + p.y) * 3, p.z * 3), region_col(p))
    for f in F: mb.face(f)
    hs = len(mb.v)
    c, r = head_mesh(mb, J, sex, skin, rng)
    hair = R.get('hair')
    if hair == 'scarf': headscarf(mb, c, r, lin(R['scarf']), rng)
    else:
        hair_cap(mb, c, r, (.02, .015, .012, 1), sex)
        if hair == 'cap': cap(mb, c, r, lin(R['hat']))
        elif hair == 'straw': straw_hat(mb, c, r, lin(R['hat']))
    if R.get('dress'): skirt(mb, J, bottom, length=.30 if role != 'processor_f' else .38, flare=.10)
    if R.get('apron'): apron(mb, J, lin(R['apron']), long=R.get('dress', False))
    if R.get('collar'):
        start = len(mb.v)
        for sx in (-1, 1):
            quad(mb, [J['neck'] + Vector((sx * .02, -.06, -.02)), J['neck'] + Vector((sx * .07, -.03, -.03)), J['neck'] + Vector((sx * .065, -.05, .02)), J['neck'] + Vector((sx * .015, -.065, .015))][::sx], top, both=True)
        bind_rigid(mb, start, 'chest')
    body = mb
    # tools as their own mesh (rigid to one bone)
    tb = SMB(); tools = []
    for key in ('tool', 'tool2'):
        if key not in R: continue
        kind, bone = R[key]; s0 = len(tb.v)
        hand = J['hand.R'] if bone == 'hand.R' else J['hand.L']
        if kind == 'basket': tool_basket(tb, Vector((.10, -.17, .76)))
        elif kind == 'can': tool_can(tb, hand)
        elif kind == 'shears': tool_shears(tb, hand)
        elif kind == 'hoe': tool_hoe(tb, hand)
        elif kind == 'rake': tool_rake(tb, hand)
        elif kind == 'sack': tool_sack(tb, J['shoulder.R'] + Vector((-.06, .07, .15)))
        elif kind == 'clipboard': tool_clipboard(tb, hand)
        elif kind == 'seedling': tool_seedling(tb, hand, rng)
        rot = R.get('tool_rot' if key == 'tool' else 'tool2_rot', 0)
        if rot:   # tools are modelled as seen in the working pose; undo the clip's hand rotation so they read right there
            piv = J[bone] if bone in J else hand; Rm = Matrix.Rotation(math.radians(rot), 3, 'X')
            for i in range(s0, len(tb.v)): tb.v[i] = tuple(piv + Rm @ (Vector(tb.v[i]) - piv))
        for i in range(s0, len(tb.v)): tb.rigid[i] = bone
    # armature
    sc = bpy.context.scene
    arm_data = bpy.data.armatures.new(f'{role}_rig'); arm = bpy.data.objects.new(f'{role}', arm_data)
    sc.collection.objects.link(arm); arm.location = location
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects: o.select_set(False)
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, h, t, parent in BONES:
        eb = arm_data.edit_bones.new(name); eb.head = J[h]; eb.tail = J[t]; eb.roll = 0
        if parent: eb.parent = arm_data.edit_bones[parent]; eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    M = material('char_cloth', to_image('T_char_cloth', cloth_tex), .82, spec=.35)
    objs = []
    for mesh_mb, nm in ((body, f'{role}_body'), (tb, f'{role}_tool')):
        if not mesh_mb.f: continue
        ob = mesh_mb.build(nm, M); sc.collection.objects.link(ob)
        ob.parent = arm
        for b, *_ in BONES: ob.vertex_groups.new(name=b)
        for vi, co in enumerate(mesh_mb.v):
            rb = mesh_mb.rigid[vi]
            if isinstance(rb, dict):
                for b, w in rb.items(): ob.vertex_groups[b].add([vi], w, 'REPLACE')
                continue
            if rb: ob.vertex_groups[rb].add([vi], 1.0, 'REPLACE'); continue
            p = Vector(co); ds = sorted(((seg_dist(p, *bone_seg[b])[0], b) for b in bone_seg), key=lambda x: x[0])[:3]
            # shoulders: keep torso skin off the arm bones; hip region stays on hips
            ws = [(b, 1 / max(d, .004) ** 4) for d, b in ds]; tot = sum(w for _, w in ws)
            for b, w in ws:
                if w / tot > .02: ob.vertex_groups[b].add([vi], w / tot, 'REPLACE')
        mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = arm
        objs.append(ob)
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    make_clips(arm, J)
    return arm, objs

# ───────────────────────────── animation ─────────────────────────────
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))

def set_pose(arm, pose, root_z=0.0, root_y=0.0):
    """pose: {bone: [(world_axis_at_rest, degrees), ...]} applied in the bone's rest frame."""
    for pb in arm.pose.bones:
        q = Quaternion()
        for ax, deg in pose.get(pb.name, []):
            la = (pb.bone.matrix_local.to_3x3().inverted() @ ax).normalized()
            q = q @ Quaternion(la, math.radians(deg))
        pb.rotation_quaternion = q
        pb.location = (0, 0, 0)
    hb = arm.pose.bones['hips']
    hb.location = hb.bone.matrix_local.to_3x3().inverted() @ Vector((0, root_y, root_z))

def key_all(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
    arm.pose.bones['hips'].keyframe_insert('location', frame=frame)

def sym(side, v):  # mirror sideways axes for the right side
    return v if side == 'L' else -v

def walk_pose(t, arm_swing=1.0, carry=False, stride=1.0):
    """t in [0,1): one full stride cycle."""
    s = math.sin(t * TAU); c2 = math.cos(t * TAU * 2)
    P = {'hips': [(Z, 4 * s)], 'spine': [(X, 3), (Z, -3 * s)], 'chest': [(Z, -4 * s)], 'neck': [(X, -3)], 'head': [(Z, 2 * s)]}
    for side, sg in (('L', 1), ('R', -1)):
        ph = s * sg
        knee = max(0, math.sin((t + (0 if side == 'L' else .5)) * TAU + .6)) * 42 + 4
        P[f'thigh.{side}'] = [(X, -26 * ph * stride)]
        P[f'shin.{side}'] = [(X, knee)]
        P[f'foot.{side}'] = [(X, -6 + 10 * ph)]
        P[f'upper_arm.{side}'] = [(X, 22 * ph * arm_swing), (Y, sym(side, -8))]
        P[f'forearm.{side}'] = [(X, -15 - 10 * max(0, ph) * arm_swing)]
    if carry:   # right hand steadies the sack on the shoulder
        P['upper_arm.R'] = [(Y, 150), (X, -15)]; P['forearm.R'] = [(X, -110)]; P['hand.R'] = [(X, -20)]
        P['neck'] = [(Z, 12), (X, -2)]; P['spine'] += [(Y, -4)]
    return P, -.02 * (1 + c2) * .5

def make_clip(arm, name, frames, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    for f in range(0, frames + 1, 2 if frames > 40 else 1):
        P, rz, ry = fn(f / frames)
        set_pose(arm, P, rz, ry); key_all(arm, f)
    trk = arm.animation_data.nla_tracks.new(); trk.name = name
    st = trk.strips.new(name, 0, act); st.name = name
    arm.animation_data.action = None
    return act

def make_clips(arm, J):
    def idle(t):
        b = math.sin(t * TAU)
        return ({'spine': [(X, 1.5 * b)], 'chest': [(X, 1 * b)], 'head': [(Z, 6 * math.sin(t * TAU + 1)), (X, -2)],
                 'upper_arm.L': [(Y, -6), (X, 2 * b)], 'upper_arm.R': [(Y, 6), (X, 2 * b)], 'forearm.L': [(X, -12)], 'forearm.R': [(X, -12)],
                 'thigh.L': [(Y, -2)], 'thigh.R': [(Y, 2)]}, .0, 0)
    def walk(t): P, rz = walk_pose(t); return P, rz, 0
    def carry(t): P, rz = walk_pose(t, arm_swing=.8, carry=True, stride=.85); return P, rz - .01, 0
    def harvest(t):
        # reach up into the branch with the right hand, strip cherries, drop into the waist basket; left hand bends the branch
        k = (math.sin(t * TAU - math.pi / 2) + 1) / 2          # 0 at basket, 1 at branch
        pick = math.sin(t * TAU * 4) * 6 * k
        return ({'spine': [(X, 8 - 6 * k)], 'chest': [(X, 4 - 6 * k), (Z, 6 * k)], 'head': [(X, -14 * k), (Z, 8 * k)],
                 'upper_arm.R': [(X, -40 - 75 * k), (Y, 10)], 'forearm.R': [(X, -60 + 25 * k + pick)], 'hand.R': [(X, -10 + pick)],
                 'upper_arm.L': [(X, -105), (Y, -12)], 'forearm.L': [(X, -35)], 'hand.L': [(X, -20)],
                 'thigh.L': [(X, -4)], 'shin.L': [(X, 6)], 'thigh.R': [(X, 3)], 'shin.R': [(X, 3)]}, -.01, 0)
    def water(t):
        tilt = max(0, math.sin(t * TAU)) * 35; sway = math.sin(t * TAU) * 10
        return ({'spine': [(X, 10), (Z, sway * .4)], 'chest': [(X, 6)], 'head': [(X, 12)],
                 'upper_arm.R': [(X, -25), (Y, 8)], 'forearm.R': [(X, -15)], 'hand.R': [(X, -tilt), (Z, sway)],
                 'upper_arm.L': [(X, -10), (Y, -10)], 'forearm.L': [(X, -30)],
                 'thigh.R': [(X, -8)], 'shin.R': [(X, 10)], 'thigh.L': [(X, 6)]}, -.01, 0)
    def prune(t):
        snip = (math.sin(t * TAU * 3) > .6) * 12; reach = math.sin(t * TAU) * 15
        return ({'spine': [(X, 6)], 'chest': [(X, 4), (Z, reach * .5)], 'head': [(X, -6), (Z, reach * .4)],
                 'upper_arm.R': [(X, -85 - reach), (Y, 18)], 'forearm.R': [(X, -35)], 'hand.R': [(Y, snip)],
                 'upper_arm.L': [(X, -95 + reach * .5), (Y, -15)], 'forearm.L': [(X, -40)], 'hand.L': [(X, -25)],
                 'thigh.L': [(X, -6)], 'shin.L': [(X, 8)]}, -.01, 0)
    def plant(t):
        # crouched hoeing: raise the hoe, chop down, pull soil back
        k = (math.sin(t * TAU) + 1) / 2
        return ({'hips': [(X, 10)], 'spine': [(X, 18 + 8 * (1 - k))], 'chest': [(X, 8)], 'head': [(X, -20)],
                 'upper_arm.R': [(X, -40 - 70 * k), (Y, 10)], 'forearm.R': [(X, -50 + 20 * k)],
                 'upper_arm.L': [(X, -45 - 60 * k), (Y, -10)], 'forearm.L': [(X, -60 + 20 * k)],
                 'thigh.L': [(X, -50)], 'shin.L': [(X, 70)], 'foot.L': [(X, -18)],
                 'thigh.R': [(X, -25)], 'shin.R': [(X, 45)], 'foot.R': [(X, -18)]}, -.16, .03)
    def rake(t):
        k = math.sin(t * TAU)
        return ({'spine': [(X, 14 + 6 * k)], 'chest': [(X, 5)], 'head': [(X, -10)],
                 'upper_arm.R': [(X, -45 - 25 * k), (Y, 8)], 'forearm.R': [(X, -40 + 10 * k)],
                 'upper_arm.L': [(X, -60 - 25 * k), (Y, -10)], 'forearm.L': [(X, -45 + 10 * k)],
                 'thigh.L': [(X, -18)], 'shin.L': [(X, 20)], 'thigh.R': [(X, 10)], 'shin.R': [(X, 6)]}, -.03, 0)
    def inspect(t):
        look = math.sin(t * TAU) * 25; write = (t > .55) * math.sin((t - .55) / .45 * TAU * 3) * 6
        return ({'spine': [(X, 3)], 'head': [(Z, look), (X, 8 * (t > .55))],
                 'upper_arm.L': [(X, -35), (Y, -6)], 'forearm.L': [(X, -80)], 'hand.L': [(Z, 20)],
                 'upper_arm.R': [(X, -30 + write), (Y, 12)], 'forearm.R': [(X, -75 + write)],
                 'thigh.L': [(Y, -3)], 'thigh.R': [(Y, 3)]}, 0, 0)
    for name, frames, fn in (('idle', 60, idle), ('walk', 32, walk), ('carry', 36, carry), ('harvest', 54, harvest), ('water', 60, water),
                             ('prune', 48, prune), ('plant', 48, plant), ('rake', 50, rake), ('inspect', 90, inspect)):
        make_clip(arm, name, frames, fn)
    set_pose(arm, {})

def export_character(role, path):
    for o in bpy.data.objects: o.select_set(False)
    arm = bpy.data.objects[role]; arm.select_set(True)
    for c in arm.children_recursive: c.select_set(True)
    shrink_textures(arm.children_recursive)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_image_format='WEBP',
              export_vertex_color='ACTIVE', export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
              export_force_sampling=True, export_frame_step=1, export_def_bones=False, export_extras=False)
    try: bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print('export fallback', e); kw.pop('export_vertex_color'); bpy.ops.export_scene.gltf(**kw)
    print('exported', path, os.path.getsize(path) // 1024, 'KB')

def export_characters(out_dir, only=None):
    for role in ROLES:
        if only and role not in only: continue
        purge()
        for a in list(bpy.data.actions): bpy.data.actions.remove(a)
        for a in list(bpy.data.armatures):
            if a.users == 0: bpy.data.armatures.remove(a)
        arm, objs = build_character(role)
        export_character(role, os.path.join(out_dir, f'worker-{role.replace("_", "-")}.glb'))
        print(role, sum(len(o.data.polygons) for o in objs), 'faces')

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_characters(sys.argv[sys.argv.index('--export') + 1], only)
