"""Original C6S art, rendered in Blender 5.1 through the official MCP server.
Run with an explicit __file__ when invoking execute_blender_code. No scene from
an artist is cleared: this build owns only scenes prefixed C6S_Asset_.
"""
from pathlib import Path
import bpy, math, json, tempfile
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/art/counter';OUT.mkdir(parents=True,exist_ok=True)
def material(name,color,metal=0,rough=.45,transmission=0):
 m=bpy.data.materials.new('C6S_'+name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Transmission Weight'].default_value=transmission
 return m
cream=material('Porcelain',(.89,.79,.57));green=material('SageMetal',(.18,.32,.25),.45,.28);black=material('Charcoal',(.025,.04,.032));gold=material('Brass',(.62,.37,.12),.65,.25);wood=material('Walnut',(.25,.12,.045));wall=material('Wall',(.10,.22,.16));glass=material('Glass',(.85,.96,.90),0,.13,.8);leaf=material('Leaf',(.11,.27,.10));pot=material('Terracotta',(.48,.23,.12));display=material('Display',(.36,.56,.24))
wood.use_nodes=True;n=wood.node_tree.nodes;l=wood.node_tree.links
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=2
mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(2,24,3)
coords=n.new('ShaderNodeTexCoord');l.new(coords.outputs['Generated'],mapping.inputs[0]);l.new(mapping.outputs[0],noise.inputs[0]);ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.09,.035,.012,1);ramp.color_ramp.elements[1].color=(.40,.21,.075,1);l.new(noise.outputs['Fac'],ramp.inputs['Fac']);l.new(ramp.outputs['Color'],n.get('Principled BSDF').inputs['Base Color'])
def cube(name,loc,size,mat,bevel=.006):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name='C6S_'+name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=3
 if mat:o.data.materials.append(mat)
 return o
def lathe(name,profile,mat,origin=(0,0,0),segments=64):
 vertices=[(origin[0]+r*math.cos(i*2*math.pi/segments),origin[1]+r*math.sin(i*2*math.pi/segments),origin[2]+z) for r,z in profile for i in range(segments)]
 faces=[]
 for k in range(len(profile)-1):
  for i in range(segments):a=k*segments+i;b=k*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new('C6S_'+name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 for p in mesh.polygons:p.use_smooth=True
 return o
def tube(name,points,radius,mat):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=16;curve.bevel_depth=radius;curve.bevel_resolution=3
 sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,co in zip(sp.bezier_points,points):b.co=co;b.handle_left_type=b.handle_right_type='AUTO'
 o=bpy.data.objects.new('C6S_'+name,curve);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o
def text(name,value,loc,size,mat,rot=(0,0,0)):
 curve=bpy.data.curves.new(name,'FONT');curve.body=value;curve.size=size;curve.align_x='CENTER';curve.extrude=.0001
 o=bpy.data.objects.new('C6S_'+name,curve);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;o.data.materials.append(mat);return o
def setup(name,transparent=False):
 old=bpy.data.scenes.get('C6S_Asset_'+name)
 if old:
  for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.scenes.remove(old)
 s=bpy.data.scenes.new('C6S_Asset_'+name);bpy.context.window.scene=s;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=4;s.render.film_transparent=transparent;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA' if transparent else 'RGB';s.render.image_settings.compression=75;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('C6S_World_'+name);s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.55,.45,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.35;s.view_settings.view_transform='AgX'
 return s
def camera(s,loc,target,ortho):
 bpy.ops.object.camera_add(location=loc);c=bpy.context.object;c.name='C6S_Camera';c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=ortho;s.camera=c
 return c
def area(loc,energy,size,color=(1,.83,.62),target=(0,0,0)):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def lights():area((-.4,-.35,.55),35,.4);area((.35,.1,.4),22,.3,(.76,.88,1))
def scale():
 cube('Scale body',(0,0,.014),(.16,.19,.028),black,.012);cube('Weighing platform',(0,.025,.033),(.14,.12,.012),green,.008);cube('LCD',(0,-.065,.03),(.09,.032,.002),display,.002);text('Scale digits','0.0 g',(0,-.076,.032),.014,black);cube('Scale button',(.061,-.067,.032),(.013,.013,.003),gold,.004)
def kettle():
 lathe('Kettle body',[(.001,0),(.045,0),(.055,.012),(.056,.045),(.049,.100),(.043,.108),(.001,.108)],green)
 lathe('Kettle lid',[(.001,.109),(.045,.109),(.043,.114),(.001,.118)],cream)
 lathe('Lid knob',[(.001,.118),(.012,.118),(.014,.13),(.008,.135),(.001,.135)],black)
 tube('Gooseneck',[(-.048,0,.027),(-.098,0,.035),(-.12,0,.092),(-.146,0,.123),(-.176,0,.125)],.0045,gold)
 tube('Kettle handle',[(.042,0,.095),(.104,0,.10),(.115,0,.061),(.096,0,.024),(.052,0,.03)],.008,black)
def v60():
 lathe('V60 hollow cone',[(.012,.02),(.061,.108),(.064,.108),(.014,.018),(.012,.02)],cream)
 lathe('V60 collar',[(.014,.017),(.05,.017),(.05,.022),(.014,.022)],cream)
 for i in range(12):
  points=[]
  for k in range(9):
   t=k/8;r=.016+.045*t;theta=2*math.pi*i/12+.45*t;points.append((r*math.cos(theta),r*math.sin(theta),.023+.084*t))
  tube('V60 spiral rib',points,.0009,gold)
 tube('V60 handle',[(.05,0,.09),(.085,0,.087),(.085,0,.065),(.036,0,.055)],.004,cream)
def server():
 lathe('600ml glass server',[(.001,.004),(.045,.004),(.058,.023),(.060,.052),(.051,.075),(.034,.109),(.034,.12),(.031,.12),(.031,.108),(.048,.074),(.057,.05),(.055,.025),(.043,.008),(.001,.008)],glass)
 lathe('Server neck band',[(.034,.102),(.036,.102),(.036,.11),(.034,.11)],green)
 tube('Server handle',[(.035,0,.107),(.091,0,.11),(.106,0,.071),(.078,0,.033),(.055,0,.038)],.006,green)
 text('Server capacity','600 ml',(0,-.059,.045),.010,green,(math.pi/2,0,0))
# Empty, reusable café stage. The moving rig/streams remain live browser code.
s=setup('Counter');cube('Counter',(0,-.08,-.055),(3.5,1.55,.11),wood,.035);cube('Back wall',(0,1.0,1.0),(3.5,.12,2.1),wall,.01)
for x in [-1.25,-.92,-.59]:
 cube('Window frame',(x,.922,1.03),(.32,.065,1.28),wood,.012)
 pane=material('Window glow '+str(x),(.64,.76,.63));p=pane.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.48,.66,.53,1);p.inputs['Emission Strength'].default_value=.3
 cube('Window glass',(x,.875,1.03),(.27,.015,1.17),pane,.005);cube('Window crossbar',(x,.852,1.03),(.28,.02,.024),wood,.004)
cube('Shelf',(.72,.77,.92),(1.18,.43,.045),wood,.018)
for i in range(4):
 lathe('Coffee tin '+str(i),[(.001,0),(.07,0),(.07,.19),(.001,.19)],cream,(.30+i*.25,.79,.95));lathe('Tin lid '+str(i),[(.001,.19),(.073,.19),(.073,.205),(.001,.205)],green,(.30+i*.25,.79,.95))
# The Image Gen owner panel becomes a framed print in the 3D café.
cube('Poster frame',(.78,.902,1.49),(.57,.045,.53),wood,.018)
bpy.ops.mesh.primitive_plane_add(size=1,location=(.78,.873,1.49),rotation=(math.pi/2,0,0));poster=bpy.context.object;poster.scale=(.51,.47,1)
pm=material('ImageGen framed print',(1,1,1));pn=pm.node_tree.nodes;pl=pm.node_tree.links;tex=pn.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'public/art/rebirth-webtoon.png'),check_existing=True);uv=pn.new('ShaderNodeTexCoord');mapping=pn.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs['Scale'].default_value=1/3;pl.new(uv.outputs['UV'],mapping.inputs[0]);pl.new(mapping.outputs[0],tex.inputs[0]);pl.new(tex.outputs['Color'],pn.get('Principled BSDF').inputs['Base Color']);poster.data.materials.append(pm)
lathe('Plant pot',[(.001,0),(.10,0),(.13,.17),(.001,.17)],pot,(-1.35,.56,.0))
for i in range(7):
 angle=i*2*math.pi/7;tip=(-1.35+.18*math.cos(angle),.56+.12*math.sin(angle),.35+.12*(i%2));tube('Plant stem',[(-1.35,.56,.12),tip],.007,leaf)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=tip);o=bpy.context.object;o.scale=(.09,.035,.14);o.rotation_euler=(.3,angle,.4);o.data.materials.append(leaf)
lathe('Pendant shade',[(.02,1.69),(.065,1.67),(.19,1.49),(.185,1.485),(.061,1.66),(.02,1.69)],cream,(0,.28,0));tube('Lamp cable',[(0,.28,1.69),(0,.28,2.4)],.006,black)
area((0,.28,1.47),65,.3,(1,.65,.32),(0,0,0));area((-1,-1,2.5),150,2.5);area((1,-.5,2),90,2,(.75,.89,.76))
camera(s,(1.2,-3.8,2.0),(0,.40,.71),3.65);s.render.resolution_x=960;s.render.resolution_y=540;s.render.filepath=str(OUT/'cozy-counter.png');bpy.ops.render.render(write_still=True)
assets=['cozy-counter.png']
for name,builder,fit,target in [('scale',scale,.25,(0,0,.025)),('kettle',kettle,.37,(-.02,0,.06)),('v60',v60,.21,(.01,0,.06)),('server',server,.24,(.02,0,.06))]:
 s=setup(name,True);builder();lights();camera(s,(.24,-.40,.30),target,fit);s.render.resolution_x=s.render.resolution_y=256;s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True);assets.append(name+'.png')
# Authoring source is committed; the working .blend stays in the graphics tool directory.
work=Path(tempfile.gettempdir())/'c6s-blender-art';work.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(work/'c6s-counter-assets.blend'))
manifest={'generator':'Blender 5.1.2 via official Blender MCP 1.0.3','source':'tools/art/build_counter.py','reference':'public/art/rebirth-webtoon.png, original C6S Image Gen atlas','assets':{n:(OUT/n).stat().st_size for n in assets},'note':'Pre-rendered decorative stage and tool portraits; live flow, scale and 600 ml fill mapping remain code. Approximate equipment proportions, not capacity calibration.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');result=manifest
