"""Fit a Meshy GLB to the model it replaces (run by scripts/meshy/generate.mjs apply, headless Blender).

  blender -b --factory-startup -P scripts/meshy/fit.py -- --in raw.glb --like original.glb --out new.glb
          --fit height|footprint|box --tris 8000 --tex 1024 [--lod name:ratio ...]

· joins every mesh into one object (one mesh per material survives the export)
· scales it uniformly so it matches the size of the original (height, footprint or the whole box)
· puts the origin at the middle of the base (the game stands every model on the ground at its origin)
· decimates to the triangle budget, shrinks textures, exports GLB (Y up); every --lod makes one more, smaller file
"""
import sys, os, bpy, bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default=None, many=False):
    out = [argv[i + 1] for i, v in enumerate(argv) if v == name and i + 1 < len(argv)]
    return out if many else (out[0] if out else default)

SRC, LIKE, DST = opt('--in'), opt('--like'), opt('--out')
FIT, TRIS, TEX = opt('--fit', 'height'), int(opt('--tris', 8000)), int(opt('--tex', 1024))
LODS = [(n, float(r)) for n, r in (x.split(':') for x in opt('--lod', [], many=True))]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def meshes():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']

def bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

def load(path):
    bpy.ops.import_scene.gltf(filepath=path)
    objs = meshes()
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    return objs

def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)

# the size of what is being replaced (Blender: Z is up)
reset()
ref = load(LIKE)
rlo, rhi = bbox(ref)
ref_size = rhi - rlo

reset()
objs = load(SRC)
for o in objs:
    o.parent = None
    o.matrix_world = o.matrix_world.copy()
bpy.ops.object.select_all(action='DESELECT')
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
lo, hi = bbox([obj])
size = hi - lo
k_h = ref_size.z / max(size.z, 1e-6)
k_w = ref_size.x / max(size.x, 1e-6)
k_d = ref_size.y / max(size.y, 1e-6)
k = {'height': k_h, 'footprint': min(k_w, k_d), 'box': min(k_h, k_w, k_d)}.get(FIT, k_h)
obj.scale = (k, k, k)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
lo, hi = bbox([obj])
obj.location = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))   # base centre on the origin
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

for img in bpy.data.images:
    if img.size[0] > TEX or img.size[1] > TEX:
        r = TEX / max(img.size[0], img.size[1])
        img.scale(max(1, int(img.size[0] * r)), max(1, int(img.size[1] * r)))

def decimate_to(target):
    n = tri_count(obj)
    if n <= target:
        return n
    mod = obj.modifiers.new('fit_decimate', 'DECIMATE')
    mod.ratio = max(0.02, target / n)
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return tri_count(obj)

def export(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    for fmt in ('WEBP', 'AUTO'):
        try:
            bpy.ops.export_scene.gltf(export_image_format=fmt, **kw)
            return
        except TypeError:
            continue
        except Exception:
            if fmt == 'AUTO':
                raise

final = decimate_to(TRIS)
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
export(DST)
report = {'tris': final, 'scale': round(k, 4), 'ref': [round(v, 2) for v in ref_size], 'new': [round(v * k, 2) for v in size]}
prev = 1.0   # the ratios in the manifest are shares of LOD 0; each step decimates the previous LOD, so it uses ratio / previous ratio
for name, ratio in LODS:
    mod = obj.modifiers.new('lod_decimate', 'DECIMATE')
    mod.ratio = max(0.02, min(1.0, ratio / prev))
    prev = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    export(os.path.join(os.path.dirname(os.path.abspath(DST)), name + '.glb'))
    report[name] = tri_count(obj)
print('MESHY_FIT', report)
