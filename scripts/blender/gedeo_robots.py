"""GodBean farm robots — one per farm job, hard-surface, animated by parts (Blender 5.x).

  harvest_bot  HarvestBot H-2: tracked rover, cherry hopper, 3-link arm with soft 3-finger gripper + camera  (work: reach, pick, drop)
  water_bot    AquaBot W-1: 4×4 rover, water tank, sweeping spray boom                                       (work: sweep + spray)
  prune_bot    TrimBot P-1: slim tracked rover, telescopic mast, arm with saw disc + shears, LiDAR dome         (work: lift, cut)
  plant_bot    SeedBot S-1: rover with polybag seedling rack, auger arm                                         (work: drill)
  drone_bot    SkyBot D-1: quadcopter scout / foliar sprayer with gimbal camera                                (work: hover, scan)
  haul_bot     CarryBot C-1: low flatbed following pickers with sacks and a crate                              (drive)

Shared palette: cream painted panels, coffee-brown accents, dark rubber, green status light, solar roof.
Clips (NLA tracks → glTF animations): idle, drive, work. Parts are separate nodes with their pivot at the joint.

Headless export:  Blender -b --factory-startup -P scripts/blender/gedeo_robots.py -- --export public/models/gedeo
"""
import os, sys, math, random
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1   # nesting depth: only the outermost script exports
exec(open(os.path.join(_here, 'gedeo_buildings.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import Matrix

CREAM, CREAM2 = (.80, .76, .66, 1), (.70, .66, .56, 1)
BROWN, DARK, RUBBER, STEEL = (.20, .10, .05, 1), (.05, .05, .055, 1), (.02, .02, .02, 1), (.45, .46, .48, 1)
GREEN_L, GLASS, BLUE = (.10, .55, .20, 1), (.02, .03, .04, 1), (.10, .22, .38, 1)

def robot_tex():
    rng = np.random.default_rng(301); H = W = 512
    n = fbm(H, W, 6, 6, 4, rng); dust = fbm(H, W, 3, 3, 3, rng)
    v = np.linspace(1, 0, H)[:, None]
    c = (.92 + .08 * n) * (1 - .18 * np.clip((dust - .55) * 3, 0, 1)) * (1 - .12 * np.clip(.2 - v, 0, .2) * 5)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = c[..., None]
    return out

def solar_tex():
    H = W = 512; u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    gx = (np.abs((u * 6) % 1 - .5) > .47) | (np.abs((v * 10) % 1 - .5) > .47)
    bus = (np.abs((u * 24) % 1 - .5) > .47)
    c = np.ones((H, W, 4), np.float32)
    c[..., :3] = np.where(np.broadcast_to(gx, (H, W))[..., None], (.75, .78, .80), np.where(np.broadcast_to(bus, (H, W))[..., None], (.25, .30, .40), (.06, .10, .22)))
    return c

def robot_mats():
    M = {'paint': material('rb_paint', to_image('T_robot', robot_tex), .42, spec=.55),
         'solar': material('rb_solar', to_image('T_solar', solar_tex), .18, spec=.9)}
    if 'rb_glow' not in bpy.data.materials:
        g = bpy.data.materials.new('rb_glow'); g.use_nodes = True
        b = next(n for n in g.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (.2, 1, .4, 1); b.inputs['Emission Color'].default_value = (.2, 1, .4, 1); b.inputs['Emission Strength'].default_value = 3.0
    M['glow'] = bpy.data.materials['rb_glow']
    return M

# ───────────────────────────── hard-surface helpers ─────────────────────────────

def rbox(mb, c, s, col, e=.18, rz=0.0, seg=14, rings=8):
    superellipsoid(mb, Vector(c), s, col=col, e=e, seg=seg, rings=rings, rz=rz, uv_scale=(2, 1))

def axis_frame(axis):
    a = Vector(axis).normalized(); t = a.orthogonal().normalized(); return a, t, a.cross(t)

def lathe_axis(mb, prof, segs, col, origin, axis, wob=None):
    """Surface of revolution around an arbitrary axis; prof [(r, h)] along the axis (outward normals for increasing h)."""
    a, t, b = axis_frame(axis); o = Vector(origin); rings = []
    for i, (r, h) in enumerate(prof):
        ring = []
        for j in range(segs + 1):
            ang = TAU * j / segs; rr = r * (1 + (wob(ang) if wob else 0))
            ring.append(mb.add(o + a * h + (t * math.cos(ang) + b * math.sin(ang)) * rr, (j / segs * 2, i / max(1, len(prof) - 1)), col))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for j in range(segs): mb.face((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))

def cyl(mb, c, r, h, axis, col, segs=16, cap_col=None):
    lathe_axis(mb, [(.001, -h / 2), (r * .96, -h / 2), (r, -h / 2 + .01), (r, h / 2 - .01), (r * .96, h / 2), (.001, h / 2)], segs, col, c, axis)

def wheel(mb, c, r, w, axis, lugs=True):
    lug = (lambda ang: .045 * (math.sin(ang * 14) > 0)) if lugs else None
    lathe_axis(mb, [(r * .55, -w / 2), (r * .93, -w / 2), (r, -w / 2 + .03), (r, w / 2 - .03), (r * .93, w / 2), (r * .55, w / 2)], 28, RUBBER, c, axis, wob=lug)
    a = Vector(axis).normalized()
    for sgn in (-1, 1):
        lathe_axis(mb, [(r * .55, 0), (r * .45, .015), (r * .18, .03), (.001, .035)], 16, STEEL, Vector(c) + a * sgn * (w / 2 - .005), a * sgn)

def track_unit(mb, c, length, h, w, col=RUBBER):
    """Rubber track loop (stadium cross-section) seen from the side; axis along Y."""
    c = Vector(c); seg = 24; pts = []
    r = h / 2
    for k in range(seg):
        f = k / seg; ang = TAU * f
        x = math.cos(ang); z = math.sin(ang)
        y = (length / 2 - r) * (1 if x > 0 else -1) + r * x
        pts.append(Vector((0, y, z * r)))
    rows = []
    for sx in (-1, 1):
        rows.append([mb.add(c + p + Vector((sx * w / 2, 0, 0)), (k / seg * 6, (sx + 1) / 2), col) for k, p in enumerate(pts)])
    for k in range(seg):
        k2 = (k + 1) % seg; mb.face((rows[0][k], rows[0][k2], rows[1][k2], rows[1][k]))
    for side, row in ((-1, rows[0]), (1, rows[1])):
        cen = mb.add(c + Vector((side * w / 2, 0, 0)), (0, 0), DARK)
        for k in range(seg):
            k2 = (k + 1) % seg; mb.face((row[k], cen, row[k2]) if side < 0 else (row[k2], cen, row[k]))
    # tread lugs
    for k in range(0, seg, 1):
        p = c + pts[k] * 1.04
        box(mb, p, (w * .95, .03, .025), RUBBER, uv=4, rz=0)

class Rig:
    """Collects robot parts as objects with pivots + per-clip keyframes."""
    def __init__(s, name, M):
        s.name = name; s.M = M; sc = bpy.context.scene
        s.root = bpy.data.objects.new(name, None); sc.collection.objects.link(s.root)
        s.parts = {}; s.world = {name: Vector((0, 0, 0))}; s.keys = {}
    def part(s, name, pivot, build, parent=None, mat='paint'):
        mb = MB(); build(mb); pv = Vector(pivot)
        mb.v = [tuple(Vector(v) - pv) for v in mb.v]
        ob = mb.build(f'{s.name}_{name}', s.M[mat]); bpy.context.scene.collection.objects.link(ob)
        par = s.parts[parent] if parent else s.root
        ob.parent = par; ob.location = pv - s.world[parent or s.name]; ob.rotation_mode = 'XYZ'
        s.parts[name] = ob; s.world[name] = pv
        return ob
    def extra(s, name, pivot, build, parent, mat):
        return s.part(name, pivot, build, parent, mat)
    def anim(s, clip, frames, fn):
        """fn(t) -> {part: {'rot': (x,y,z) radians, 'loc': (dx,dy,dz)}}; keyed every 2 frames, looped."""
        for f in range(0, frames + 1, 2):
            pose = fn(f / frames)
            for name, tr in pose.items():
                ob = s.parts[name] if name in s.parts else s.root
                s.keys.setdefault(clip, {}).setdefault(name, []).append((f, tr))
    def bake(s):
        for clip, per in s.keys.items():   # every clip keys every part, so switching clips never leaves a part stranded
            nf = max(f for fr in per.values() for f, _ in fr)
            for name in s.parts:
                if name not in per: per[name] = [(0, {}), (nf, {})]
        for clip, per in s.keys.items():
            for name, frames in per.items():
                ob = s.parts.get(name, s.root); base_loc = ob.location.copy()
                ob.animation_data_create(); act = bpy.data.actions.new(f'{s.name}_{name}_{clip}'); ob.animation_data.action = act
                for f, tr in frames:
                    ob.rotation_euler = tr.get('rot', (0, 0, 0)); ob.location = base_loc + Vector(tr.get('loc', (0, 0, 0)))
                    ob.keyframe_insert('rotation_euler', frame=f); ob.keyframe_insert('location', frame=f)
                trk = ob.animation_data.nla_tracks.new(); trk.name = clip; trk.strips.new(clip, 0, act)
                ob.animation_data.action = None; ob.location = base_loc; ob.rotation_euler = (0, 0, 0)
        return s.root

def status_light(mb, c, w=.12):
    rbox(mb, c, (w, .03, .03), (1, 1, 1, 1), e=.3, seg=8, rings=4)

def spin(t, turns=1):
    return -TAU * turns * t

# ───────────────────────────── robots ─────────────────────────────

def harvest_bot():
    M = robot_mats(); R = Rig('harvest_bot', M); rng = random.Random(11)
    def chassis(mb):
        rbox(mb, (0, 0, .42), (.72, 1.05, .30), CREAM)
        rbox(mb, (0, -.50, .42), (.60, .10, .20), BROWN, e=.25)          # front bumper
        for sx in (-1, 1): track_unit(mb, (sx * .43, 0, .26), 1.12, .38, .16)
        # hopper with cherries (back half)
        x0, x1, y0, y1, z0, z1 = -.32, .32, -.02, .48, .57, .92
        for p in ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], [(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)],
                  [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)]):
            quad(mb, p, CREAM2, both=True)
        quad(mb, [(x0, y0, z1 - .05), (x1, y0, z1 - .05), (x1, y1, z1 - .05), (x0, y1, z1 - .05)], (.35, .03, .03, 1))
        for _ in range(60):
            ellipsoid(mb, Vector((rng.uniform(x0 + .03, x1 - .03), rng.uniform(y0 + .03, y1 - .03), z1 - .04)), UP, .016, .015,
                      rng.choice([(.62, .03, .03, 1), (.45, .02, .04, 1), (.75, .2, .03, 1)]), 5, 2)
        rbox(mb, (0, -.22, .64), (.36, .34, .18), CREAM)                  # arm turret base
        rbox(mb, (0, -.42, .62), (.30, .05, .10), DARK, e=.3)              # front sensor strip
    R.part('chassis', (0, 0, 0), chassis)
    R.part('light', (0, .49, .80), lambda mb: status_light(mb, (0, .49, .80), .2), 'chassis', 'glow')
    R.part('solar', (0, .23, 1.02), lambda mb: (rbox(mb, (0, .23, 1.02), (.70, .58, .025), (1, 1, 1, 1), e=.1, seg=8, rings=4),
                                                 [tube(mb, [Vector((sx * .3, .23 + sy * .24, .92)), Vector((sx * .3, .23 + sy * .24, 1.01))], [.012, .012], 5, col=STEEL) for sx in (-1, 1) for sy in (-1, 1)]), 'chassis', 'solar')
    R.part('turret', (0, -.22, .73), lambda mb: (cyl(mb, (0, -.22, .78), .12, .1, UP, CREAM2), rbox(mb, (0, -.22, .90), (.16, .16, .16), CREAM, e=.3)), 'chassis')
    R.part('upper', (0, -.22, .92), lambda mb: (cyl(mb, (0, -.22, .92), .07, .2, (1, 0, 0), BROWN), rbox(mb, (0, -.22, 1.20), (.09, .09, .56), CREAM, e=.25)), 'turret')
    R.part('fore', (0, -.22, 1.46), lambda mb: (cyl(mb, (0, -.22, 1.46), .055, .16, (1, 0, 0), BROWN), rbox(mb, (0, -.42, 1.46), (.07, .44, .07), CREAM, e=.25)), 'upper')
    def wrist(mb):
        cyl(mb, (0, -.65, 1.46), .045, .12, (1, 0, 0), BROWN)
        rbox(mb, (0, -.72, 1.46), (.10, .09, .10), CREAM2, e=.3)
        rbox(mb, (0, -.73, 1.53), (.07, .05, .04), DARK, e=.3); cyl(mb, (0, -.76, 1.53), .015, .02, (0, -1, 0), GLASS)   # camera
    R.part('wrist', (0, -.65, 1.46), wrist, 'fore')
    for k in range(3):
        a = TAU * k / 3
        off = Vector((math.cos(a) * .035, 0, math.sin(a) * .035))
        p0 = Vector((0, -.77, 1.46)) + off
        R.part(f'finger{k}', p0, lambda mb, p0=p0, off=off: tube(mb, [p0, p0 + Vector((0, -.06, 0)) + off * .3, p0 + Vector((0, -.11, 0)) - off * .2], [.014, .012, .009], 6, col=(.10, .35, .15, 1), cap=True), 'wrist')
    def idle(t): return {'turret': {'rot': (0, 0, .15 * math.sin(t * TAU))}, 'upper': {'rot': (.6, 0, 0)}, 'fore': {'rot': (-1.2, 0, 0)}}
    def drive(t):
        b = .01 * math.sin(t * TAU * 4)
        return {'chassis': {'loc': (0, 0, b)}, 'upper': {'rot': (.6, 0, 0)}, 'fore': {'rot': (-1.2, 0, 0)}}
    def work(t):
        # 0–.45 reach into the canopy, .45–.6 grip + pull, .6–.85 swing over the hopper, .85–1 release
        k = math.sin(min(1, t / .45) * math.pi / 2) if t < .6 else max(0, 1 - (t - .6) / .25)
        over = 0 if t < .6 else math.sin(min(1, (t - .6) / .25) * math.pi / 2) * (1 if t < .85 else 1 - (t - .85) / .15 * .2)
        grip = .45 if .4 < t < .88 else 0
        pose = {'turret': {'rot': (0, 0, .25 * k + 3.0 * over)}, 'upper': {'rot': (-.35 * k + .35 * over, 0, 0)},
                'fore': {'rot': (.25 * k - .9 * over, 0, 0)}, 'wrist': {'rot': (0, .4 * math.sin(t * TAU * 2) * k, 0)}}
        for i in range(3):
            a = TAU * i / 3; pose[f'finger{i}'] = {'rot': (grip * math.sin(a) , 0, -grip * math.cos(a))}
        return pose
    R.anim('idle', 60, idle); R.anim('drive', 30, drive); R.anim('work', 90, work)
    return R.bake()

def water_bot():
    M = robot_mats(); R = Rig('water_bot', M)
    def chassis(mb):
        rbox(mb, (0, 0, .48), (.70, 1.10, .26), CREAM)
        rbox(mb, (0, -.56, .44), (.60, .08, .16), BROWN, e=.25)
        lathe_axis(mb, [(.001, -.45), (.25, -.45), (.30, -.40), (.30, .40), (.25, .45), (.001, .45)], 24, BLUE, (0, .12, .86), (0, 1, 0))   # tank
        for y in (-.15, .4): lathe_axis(mb, [(.305, -.02), (.305, .02)], 24, STEEL, (0, y, .86), (0, 1, 0))
        cyl(mb, (0, -.36, .98), .05, .08, UP, STEEL)                                                                        # filler cap
        rbox(mb, (0, -.42, .66), (.34, .14, .14), CREAM2)                                                                    # pump housing
        tube(mb, [Vector((0, -.42, .72)), Vector((0, -.42, .95)), Vector((0, -.45, 1.12))], [.025] * 3, 6, col=DARK)
    R.part('chassis', (0, 0, 0), chassis)
    for i, (x, y) in enumerate([(-.43, -.36), (.43, -.36), (-.43, .36), (.43, .36)]):
        R.part(f'wheel{i}', (x, y, .25), lambda mb, x=x, y=y: wheel(mb, (x, y, .25), .25, .17, (1, 0, 0)), 'chassis')
    R.part('light', (0, .55, .62), lambda mb: status_light(mb, (0, .55, .62), .2), 'chassis', 'glow')
    def boom(mb):
        cyl(mb, (0, -.45, 1.15), .06, .1, UP, BROWN)
        rbox(mb, (0, -.75, 1.18), (.08, .60, .06), CREAM, e=.25)
        tube(mb, [Vector((-.6, -1.05, 1.16)), Vector((.6, -1.05, 1.16))], [.025, .025], 8, col=STEEL)                  # spray bar
        for x in np.linspace(-.55, .55, 7): cyl(mb, (x, -1.05, 1.12), .018, .05, UP, DARK)
    R.part('boom', (0, -.45, 1.15), boom, 'chassis')
    def idle(t): return {'boom': {'rot': (0, 0, .1 * math.sin(t * TAU))}}
    def drive(t): return {**{f'wheel{i}': {'rot': (spin(t, 1), 0, 0)} for i in range(4)}, 'chassis': {'loc': (0, 0, .008 * math.sin(t * TAU * 3))}}
    def work(t): return {'boom': {'rot': (.08 * math.sin(t * TAU * 2), 0, .6 * math.sin(t * TAU))}}
    R.anim('idle', 60, idle); R.anim('drive', 30, drive); R.anim('work', 90, work)
    return R.bake()

def prune_bot():
    M = robot_mats(); R = Rig('prune_bot', M)
    def chassis(mb):
        rbox(mb, (0, 0, .36), (.48, .90, .26), CREAM)
        for sx in (-1, 1): track_unit(mb, (sx * .31, 0, .22), .95, .32, .13)
        rbox(mb, (0, .05, .58), (.30, .40, .22), CREAM2)
        for sx in (-1, 1): rbox(mb, (sx * .1, -.05, 1.05), (.06, .06, .95), STEEL, e=.3)      # mast rails
    R.part('chassis', (0, 0, 0), chassis)
    R.part('light', (0, .46, .42), lambda mb: status_light(mb, (0, .46, .42), .16), 'chassis', 'glow')
    def carriage(mb):
        rbox(mb, (0, -.05, .80), (.30, .16, .16), CREAM, e=.25)
        lathe_axis(mb, [(.001, 0), (.07, .0), (.07, .04), (.05, .08), (.001, .09)], 16, DARK, (0, -.05, .88), UP)   # LiDAR dome
    R.part('carriage', (0, -.05, .80), carriage, 'chassis')
    def arm(mb):
        cyl(mb, (0, -.14, .80), .05, .14, (1, 0, 0), BROWN)
        rbox(mb, (0, -.38, .80), (.07, .46, .07), CREAM, e=.25)
    R.part('arm', (0, -.14, .80), arm, 'carriage')
    def head(mb):
        rbox(mb, (0, -.64, .80), (.10, .08, .10), CREAM2, e=.3)
        for sx in (-1, 1):   # bypass shears
            tube(mb, [Vector((sx * .02, -.68, .80)), Vector((sx * .01, -.78, .80)), Vector((0, -.86, .80))], [.01, .008, .002], 4, col=STEEL)
    R.part('head', (0, -.62, .80), head, 'arm')
    R.part('saw', (.09, -.66, .80), lambda mb: (cyl(mb, (.09, -.66, .80), .09, .006, (1, 0, 0), STEEL), cyl(mb, (.095, -.66, .80), .02, .02, (1, 0, 0), DARK)), 'head')
    def idle(t): return {'carriage': {'loc': (0, 0, .03 * math.sin(t * TAU))}, 'carriage_': {}}
    def drive(t): return {'carriage': {'loc': (0, 0, 0)}, 'chassis': {'loc': (0, 0, .006 * math.sin(t * TAU * 4))}}
    def work(t):
        lift = .55 * (1 - math.cos(min(1, t / .3) * math.pi)) / 2 if t < .8 else .55 * (1 - (t - .8) / .2)
        return {'carriage': {'loc': (0, 0, lift)}, 'arm': {'rot': (.25 * math.sin(t * TAU * 2), 0, .5 * math.sin(t * TAU))},
                'saw': {'rot': (spin(t, 12), 0, 0)}, 'head': {'rot': (0, .3 * math.sin(t * TAU * 6), 0)}}
    R.anim('idle', 60, lambda t: {'carriage': {'loc': (0, 0, .03 * math.sin(t * TAU))}}); R.anim('drive', 30, drive); R.anim('work', 90, work)
    return R.bake()

def plant_bot():
    M = robot_mats(); R = Rig('plant_bot', M); rng = random.Random(4)
    def chassis(mb):
        rbox(mb, (0, 0, .44), (.70, 1.0, .24), CREAM)
        rbox(mb, (0, -.52, .40), (.58, .08, .16), BROWN, e=.25)
        # two-shelf seedling rack (polybags with young coffee)
        for z in (.58, .86):
            rbox(mb, (0, .15, z), (.62, .62, .03), CREAM2, e=.15, seg=8, rings=4)
            for ix in range(4):
                for iy in range(3):
                    o = Vector((-.22 + ix * .147, -.05 + iy * .2, z + .015))
                    lathe(mb, [(.001, 0), (.045, .002), (.05, .09), (.04, .1)], 8, col=(.03, .03, .03, 1), center=o)
                    for k in range(3):
                        a = k * 2.1 + rng.random()
                        leaf(mb, o + Vector((0, 0, .1 + .03 * k)), Vector((math.cos(a), math.sin(a), .5)), UP, .05, .022, (0, 0, 1, 1),
                             (.15, .35, .10, 1), lambda s: math.sin(math.pi * s) ** .7, segs=2, droop=.1, fold=.2, rng=rng)
        for sx in (-1, 1):
            for sy in (-1, 1): tube(mb, [Vector((sx * .3, .15 + sy * .3, .56)), Vector((sx * .3, .15 + sy * .3, 1.05))], [.015, .015], 5, col=STEEL)
    R.part('chassis', (0, 0, 0), chassis)
    R.part('roof', (0, .15, 1.07), lambda mb: rbox(mb, (0, .15, 1.07), (.68, .68, .02), (1, 1, 1, 1), e=.1, seg=8, rings=4), 'chassis', 'solar')
    for i, (x, y) in enumerate([(-.42, -.32), (.42, -.32), (-.42, .32), (.42, .32)]):
        R.part(f'wheel{i}', (x, y, .22), lambda mb, x=x, y=y: wheel(mb, (x, y, .22), .22, .14, (1, 0, 0)), 'chassis')
    R.part('light', (0, .51, .55), lambda mb: status_light(mb, (0, .51, .55), .2), 'chassis', 'glow')
    R.part('slide', (0, -.42, .62), lambda mb: (rbox(mb, (0, -.42, .62), (.16, .14, .22), CREAM, e=.25), rbox(mb, (0, -.42, .50), (.08, .08, .3), STEEL, e=.3)), 'chassis')
    def auger(mb):
        cyl(mb, (0, -.42, .36), .03, .1, UP, DARK)
        pts = [Vector((math.cos(k * .7) * .045, -.42 + math.sin(k * .7) * .045, .32 - k * .012)) for k in range(22)]
        tube(mb, pts, [.012] * len(pts), 5, col=STEEL)
        tube(mb, [Vector((0, -.42, .33)), Vector((0, -.42, .04))], [.012, .006], 6, col=STEEL)
    R.part('auger', (0, -.42, .36), auger, 'slide')
    def drive(t): return {f'wheel{i}': {'rot': (spin(t, 1), 0, 0)} for i in range(4)}
    def work(t):
        d = -.22 * (1 - math.cos(min(1, t / .4) * math.pi)) / 2 if t < .7 else -.22 * (1 - (t - .7) / .3)
        return {'slide': {'loc': (0, 0, d)}, 'auger': {'rot': (0, 0, spin(t, 10))}}
    R.anim('idle', 60, lambda t: {'slide': {'loc': (0, 0, .01 * math.sin(t * TAU))}}); R.anim('drive', 30, drive); R.anim('work', 90, work)
    return R.bake()

def drone_bot():
    M = robot_mats(); R = Rig('drone_bot', M)
    def body(mb):
        rbox(mb, (0, 0, 1.6), (.32, .42, .14), CREAM)
        rbox(mb, (0, .02, 1.50), (.22, .26, .10), BLUE, e=.3)                       # spray tank
        for sx in (-1, 1):
            for sy in (-1, 1):
                a = Vector((sx * .12, sy * .15, 1.6)); b = Vector((sx * .42, sy * .42, 1.62))
                tube(mb, [a, b], [.022, .018], 6, col=DARK); cyl(mb, b, .04, .07, UP, BROWN)
                tube(mb, [Vector((sx * .14, sy * .12, 1.52)), Vector((sx * .2, sy * .16, 1.38))], [.008, .008], 4, col=DARK)   # legs
        tube(mb, [Vector((-.2, .16, 1.38)), Vector((-.2, -.16, 1.38))], [.009] * 2, 4, col=DARK); tube(mb, [Vector((.2, .16, 1.38)), Vector((.2, -.16, 1.38))], [.009] * 2, 4, col=DARK)
    R.part('body', (0, 0, 1.6), body)
    R.part('light', (0, .21, 1.62), lambda mb: status_light(mb, (0, .21, 1.62), .12), 'body', 'glow')
    for i, (sx, sy) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
        c = Vector((sx * .42, sy * .42, 1.67))
        def prop(mb, c=c):
            for k in range(2):
                a = k * math.pi; d = Vector((math.cos(a), math.sin(a), 0))
                quad(mb, [c + d * .02 + Vector((0, 0, 0)), c + d * .2 + Vector((-d.y * .02, d.x * .02, .004)), c + d * .2 + Vector((d.y * .02, -d.x * .02, -.004)), c + d * .02], DARK, both=True)
        R.part(f'prop{i}', c, prop, 'body')
    def gimbal(mb):
        rbox(mb, (0, -.2, 1.5), (.08, .08, .08), DARK, e=.3); cyl(mb, (0, -.245, 1.5), .022, .02, (0, -1, 0), GLASS)
    R.part('gimbal', (0, -.2, 1.53), gimbal, 'body')
    def hover(t, scan):
        p = {f'prop{i}': {'rot': (0, 0, spin(t, 8) * (1 if i in (0, 3) else -1))} for i in range(4)}
        p['body'] = {'loc': (0, 0, .04 * math.sin(t * TAU)), 'rot': (.03 * math.sin(t * TAU * 2), .03 * math.cos(t * TAU), 0)}
        if scan: p['gimbal'] = {'rot': (.3 + .2 * math.sin(t * TAU), 0, .8 * math.sin(t * TAU))}
        return p
    R.anim('idle', 60, lambda t: hover(t, False)); R.anim('drive', 30, lambda t: {**hover(t, False), 'body': {'rot': (-.12, 0, 0), 'loc': (0, 0, 0)}}); R.anim('work', 90, lambda t: hover(t, True))
    return R.bake()

def haul_bot():
    M = robot_mats(); R = Rig('haul_bot', M); rng = random.Random(6)
    P = {'jute': MB(), 'wood': MB()}
    def chassis(mb):
        rbox(mb, (0, 0, .34), (.80, 1.30, .16), CREAM)
        rbox(mb, (0, -.68, .42), (.70, .10, .26), CREAM2)
        rbox(mb, (0, -.73, .48), (.50, .02, .06), DARK, e=.3)                # sensor bar
        for sx in (-1, 1): rbox(mb, (sx * .41, 0, .50), (.03, 1.2, .14), BROWN, e=.3)   # side rails
    R.part('chassis', (0, 0, 0), chassis)
    for i, (x, y) in enumerate([(-.42, -.45), (.42, -.45), (-.42, .45), (.42, .45)]):
        R.part(f'wheel{i}', (x, y, .17), lambda mb, x=x, y=y: wheel(mb, (x, y, .17), .17, .12, (1, 0, 0)), 'chassis')
    R.part('light', (0, -.74, .56), lambda mb: status_light(mb, (0, -.74, .56), .2), 'chassis', 'glow')
    # cargo: 3 sacks + one crate of cherries (props share building materials)
    sc = bpy.context.scene
    for k in range(3): superellipsoid(P['jute'], Vector((-.18 + .18 * (k % 2), -.15 + k * .3, .55)), (.32, .55, .24), e=.5, seg=10, rings=6, rz=1.57 + rng.uniform(-.1, .1), sag=.1, col=tint(rng, (1, 1, 1), .06))
    box(P['wood'], (.2, .38, .56), (.36, .42, .28), uv=2)
    Mb = mats()
    for k, mb in P.items():
        ob = mb.build(f'haul_bot_cargo_{k}', Mb[k]); sc.collection.objects.link(ob); ob.parent = R.parts['chassis']
    R.part('cherries', (.2, .38, .70), lambda mb: [ellipsoid(mb, Vector((.2 + rng.uniform(-.15, .15), .38 + rng.uniform(-.18, .18), .70)), UP, .016, .015, (.6, .04, .03, 1), 5, 2) for _ in range(50)], 'chassis')
    def drive(t): return {**{f'wheel{i}': {'rot': (spin(t, 1), 0, 0)} for i in range(4)}, 'chassis': {'loc': (0, 0, .006 * math.sin(t * TAU * 4))}}
    R.anim('idle', 60, lambda t: {'chassis': {'loc': (0, 0, .002 * math.sin(t * TAU))}}); R.anim('drive', 30, drive); R.anim('work', 60, drive)
    return R.bake()

ROBOTS = {'harvest_bot': harvest_bot, 'water_bot': water_bot, 'prune_bot': prune_bot, 'plant_bot': plant_bot, 'drone_bot': drone_bot, 'haul_bot': haul_bot}

def export_robot(name, path):
    for o in bpy.data.objects: o.select_set(False)
    root = bpy.data.objects[name]; root.select_set(True)
    for c in root.children_recursive: c.select_set(True)
    shrink_textures(root.children_recursive)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_image_format='WEBP', export_vertex_color='ACTIVE',
              export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_extras=False,
              export_optimize_animation_size=False, export_optimize_animation_keep_anim_object=True)
    try: bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print('export fallback', e); kw.pop('export_vertex_color'); bpy.ops.export_scene.gltf(**kw)
    print('exported', path, os.path.getsize(path) // 1024, 'KB')

def export_robots(out_dir, only=None):
    for name, fn in ROBOTS.items():
        if only and name not in only: continue
        purge()
        for a in list(bpy.data.actions): bpy.data.actions.remove(a)
        fn(); export_robot(name, os.path.join(out_dir, f'robot-{name.replace("_bot", "").replace("_", "-")}.glb'))

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_robots(sys.argv[sys.argv.index('--export') + 1], only)
