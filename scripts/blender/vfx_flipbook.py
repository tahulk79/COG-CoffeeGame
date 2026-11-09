"""Bakes a real smoke simulation (Mantaflow) into an 8 x 8 flipbook for the game's particles (docs/design/art-upgrade-plan.md).

  blender -b --factory-startup -P scripts/blender/vfx_flipbook.py -- <cache dir> <frames dir> [--res 72]

Renders 64 frames, white smoke on transparent, lit from the upper left so a puff reads as a volume. The game tints it
(smoke, dust, steam). The caller assembles the frames into public/assets/farm/vfx/smoke-atlas.webp.
"""
import sys, os, bpy, math

a = sys.argv[sys.argv.index('--') + 1:]
cache, frames = os.path.abspath(a[0]), os.path.abspath(a[1])
res = int(a[a.index('--res') + 1]) if '--res' in a else 72
FRAMES, SIM_END = 64, 84
os.makedirs(cache, exist_ok=True); os.makedirs(frames, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, SIM_END

bpy.ops.mesh.primitive_cube_add(size=5, location=(0, 0, 1.6))   # roomy: smoke that touches the walls goes flat
dom = bpy.context.object; dom.name = 'domain'
m = dom.modifiers.new('fluid', 'FLUID'); m.fluid_type = 'DOMAIN'
d = m.domain_settings
d.domain_type = 'GAS'; d.resolution_max = res; d.cache_type = 'ALL'; d.cache_directory = cache
d.cache_frame_start, d.cache_frame_end = 1, SIM_END
d.use_noise = False; d.alpha = .4; d.beta = .35; d.vorticity = .8; d.use_dissolve_smoke = True; d.dissolve_speed = 46
d.use_adaptive_domain = False

bpy.ops.mesh.primitive_ico_sphere_add(radius=.55, subdivisions=3, location=(0, 0, .75))
src = bpy.context.object; src.name = 'source'
f = src.modifiers.new('fluid', 'FLUID'); f.fluid_type = 'FLOW'
s = f.flow_settings
s.flow_type = 'SMOKE'; s.flow_behavior = 'INFLOW'; s.flow_source = 'MESH'; s.density = 1.0; s.temperature = 1.0; s.use_initial_velocity = True; s.velocity_coord = (.15, .1, .5)
s.keyframe_insert('density', frame=1); s.density = 1.0; s.keyframe_insert('density', frame=5); s.density = 0.0; s.keyframe_insert('density', frame=8)   # one puff, no column

mat = bpy.data.materials.new('smoke'); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
vol = nt.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (1, 1, 1, 1); vol.inputs['Density'].default_value = 16.0
out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(vol.outputs[0], out.inputs['Volume'])
dom.data.materials.append(mat)
src.hide_render = True

bpy.ops.object.select_all(action='DESELECT'); dom.select_set(True); bpy.context.view_layer.objects.active = dom
bpy.ops.fluid.bake_all()
print('SIM_BAKED')

sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 5; sun.angle = .5
so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(-40))
w = bpy.data.worlds.new('w'); w.use_nodes = True
b = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); b.inputs[0].default_value = (1, 1, 1, 1); b.inputs[1].default_value = 1.1; sc.world = w
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 3.4
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); co.location = (0, -12, 1.45); co.rotation_euler = (math.pi / 2, 0, 0); sc.camera = co
r = sc.render; r.engine = 'CYCLES'; r.resolution_x = r.resolution_y = 128; r.film_transparent = True; r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
sc.cycles.device = 'CPU'; sc.cycles.samples = 40; sc.cycles.use_denoising = True; sc.cycles.volume_step_rate = 2.0; sc.cycles.volume_bounces = 2
sc.view_settings.view_transform = 'Standard'
for i in range(FRAMES):
    sc.frame_set(6 + int(i * (SIM_END - 8) / FRAMES))
    r.filepath = os.path.join(frames, f'f{i:02d}.png')
    bpy.ops.render.render(write_still=True)
print('FLIPBOOK_OK')
