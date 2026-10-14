# The Grand Estate (Good Space World): builds the island in Blender and renders a day + night turntable for the web page.
# Run: blender -b -P build_world.py -- <out_dir> [frames] [width] [height]
import bpy, bmesh, math, json, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'Portraits')
FRAMES = int(argv[1]) if len(argv) > 1 else 24
W = int(argv[2]) if len(argv) > 2 else 1280
H = int(argv[3]) if len(argv) > 3 else 720
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

# ---------- materials ----------
def hexc(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (a,)

def mat(name, color, rough=0.5, metal=0.0, coat=0.0, emit=None, emit_str=0.0, sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hexc(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.12
    p.inputs['Sheen Weight'].default_value = sheen
    if emit:
        p.inputs['Emission Color'].default_value = hexc(emit)
        p.inputs['Emission Strength'].default_value = emit_str
    return m

def stripes(name, a, b, count=8):
    m = mat(name, a, rough=0.4, coat=0.6); nt = m.node_tree; n = nt.nodes
    tc = n.new('ShaderNodeTexCoord'); sep = n.new('ShaderNodeSeparateXYZ'); mul = n.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = count
    sn = n.new('ShaderNodeMath'); sn.operation = 'SINE'; gt = n.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0
    mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs[6].default_value = hexc(a); mix.inputs[7].default_value = hexc(b)
    nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['X'], mul.inputs[0]); nt.links.new(mul.outputs[0], sn.inputs[0])
    nt.links.new(sn.outputs[0], gt.inputs[0]); nt.links.new(gt.outputs[0], mix.inputs[0]); nt.links.new(mix.outputs[2], n['Principled BSDF'].inputs['Base Color'])
    return m

M = {
    'wall': mat('Wall', '#fff6ef', 0.6), 'ink': mat('Ink', '#2b1f26', 0.25, coat=1),
    'gold': mat('Gold', '#e3b85c', 0.18, 1.0), 'glass': mat('Glass', '#fff1c2', 0.05, coat=1, emit='#ffc46b', emit_str=0.0),
    'grass': mat('Grass', '#9fd28e', 0.9, sheen=0.3), 'cliff': mat('Cliff', '#ecd3b4', 0.95), 'road': mat('Road', '#f3dcc0', 0.85),
    'water': mat('Water', '#7fc1e0', 0.04, coat=1), 'trunk': mat('Trunk', '#8a5a3b', 0.8), 'leaf': mat('Leaf', '#6fb565', 0.7, sheen=0.4),
    'blush': mat('Blush', '#ff8fab', 0.6), 'basket': mat('Basket', '#c8925a', 0.7),
}
def roof(c): return mat('Roof ' + c, c, 0.32, coat=1.0)

# ---------- helpers ----------
def link(o):
    if o.name not in col.objects: col.objects.link(o)
    return o
def smooth(o):
    for p in o.data.polygons: p.use_smooth = True
    return o
def bevel(o, w=0.25, seg=4):
    b = o.modifiers.new('Bevel', 'BEVEL'); b.width = w; b.segments = seg; b.limit_method = 'ANGLE'; return o
def put(o, m, loc=(0, 0, 0), parent=None):
    o.data.materials.clear(); o.data.materials.append(m); o.location = loc
    if parent: o.parent = parent
    return o
def cube(size, m, loc, parent=None, bev=0.25):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.scale = size; bpy.ops.object.transform_apply(scale=True)
    return bevel(put(o, m, loc, parent), bev)
def cyl(r, d, m, loc, parent=None, v=48, r2=None, cone=False):
    if cone or r2 is not None: bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2 or 0, depth=d)
    else: bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d)
    return smooth(put(bpy.context.object, m, loc, parent))
def sphere(r, m, loc, parent=None, seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r); return smooth(put(bpy.context.object, m, loc, parent))
def half_sphere(r, m, loc, parent=None):
    o = sphere(r, m, loc, parent); bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS'); bm.to_mesh(o.data); bm.free(); return smooth(o)
def torus(R, r, m, loc, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=64, minor_segments=12); o = put(bpy.context.object, m, loc, parent); o.rotation_euler = rot; return smooth(o)
def empty(name, loc):
    e = bpy.data.objects.new(name, None); e.location = loc; link(e); return e

# ---------- island + sea ----------
def R(a): return 19 + math.sin(a * 3) * 1.6 + math.cos(a * 5) * 0.9
bm = bmesh.new(); top, bot = [], []
for i in range(96):
    a = i / 96 * math.tau; r = R(a)
    top.append(bm.verts.new((math.cos(a) * r * 1.25, math.sin(a) * r, 0)))
    bot.append(bm.verts.new((math.cos(a) * r * 1.15, math.sin(a) * r * 0.92, -3.2)))
ft = bm.faces.new(top); ft.material_index = 0
fb = bm.faces.new(list(reversed(bot))); fb.material_index = 1
for i in range(96):
    f = bm.faces.new((top[i], bot[i], bot[(i + 1) % 96], top[(i + 1) % 96])); f.material_index = 1
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('Island'); bm.to_mesh(me); bm.free()
island = link(bpy.data.objects.new('Island', me)); me.materials.append(M['grass']); me.materials.append(M['cliff'])
bv = island.modifiers.new('Bevel', 'BEVEL'); bv.width = 0.9; bv.segments = 6; bv.limit_method = 'ANGLE'
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -2.4)); put(bpy.context.object, M['water'], (0, 0, -2.4))

# ---------- roads ----------
def road(name, pts):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.9; cu.bevel_resolution = 2
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.use_endpoint_u = True; sp.order_u = 3
    for p, (x, y) in zip(sp.points, pts): p.co = (x, y, 0.02, 1)
    o = link(bpy.data.objects.new(name, cu)); o.scale = (1, 1, 0.06); cu.materials.append(M['road']); return o
roads = {'gigi': [(0, 0), (-7, 3), (-14, 6)], 'lulu': [(0, 0), (7, 3), (14, 6)], 'fifi': [(0, -1), (-7, -5), (-14, -8)],
         'zaza': [(0, -1), (7, -5), (14, -8)], 'club': [(0, -2), (0, -7), (0, -12)], 'shelfL': [(-14, 5), (-7, -3), (0, -5.2)], 'shelfR': [(14, 5), (7, -3), (0, -5.2)]}
for k, v in roads.items(): road('Road ' + k, v)

# ---------- buildings ----------
anchors = {}
def house(id_, x, y, color, kind):
    g = empty('House ' + id_, (x, y, 0)); rm = roof(color)
    cube((5, 4, 3.4), M['wall'], (0, 0, 1.7), g, 0.35)
    if kind == 'gable':
        o = cyl(4.2, 2.6, rm, (0, 0, 4.7), g, v=4, cone=True); o.rotation_euler = (0, 0, math.pi / 4)
    elif kind == 'flat':
        cube((5.8, 4.8, 0.7), rm, (0, 0, 3.75), g, 0.2); cyl(0.9, 0.6, M['gold'], (1.4, 0, 4.4), g)
    elif kind == 'dome':
        half_sphere(2.6, rm, (0, 0, 3.4), g); sphere(0.35, M['gold'], (0, 0, 6.1), g)
    elif kind == 'awning':
        st = stripes('Awning ' + id_, color, '#fff6ef', 9)
        o = cube((6.0, 5.0, 0.55), st, (0, 0.2, 3.85), g, 0.22); o.rotation_euler = (math.radians(-10), 0, 0)
        v = cube((6.0, 0.25, 0.7), st, (0, -2.45, 3.25), g, 0.1)
    for wx in (-1.3, 1.3):
        cube((1.0, 0.15, 1.0), M['glass'], (wx, -2.02, 2.2), g, 0.1)
        torus(0.62, 0.06, M['gold'], (wx, -2.08, 2.2), g, (math.pi / 2, 0, 0))
    cube((1.1, 0.2, 1.8), rm, (0, -2.02, 0.9), g, 0.15); sphere(0.08, M['gold'], (0.3, -2.15, 0.9), g, 16)
    cyl(3.6, 0.25, M['gold'], (0, 0, 0.06), g, r2=3.8)
    lp = bpy.data.lights.new('Lamp ' + id_, 'POINT'); lp.color = (1, 0.78, 0.45); lp.energy = 0; lp.shadow_soft_size = 0.6
    lo = link(bpy.data.objects.new('Lamp ' + id_, lp)); lo.parent = g; lo.location = (0, -3, 2.4)
    anchors[id_] = (x, y, 7.6 if kind == 'dome' else 6.9)
    return g
house('gigi', -15, 7, '#f3a3be', 'gable'); house('lulu', 15, 7, '#9fc0f2', 'flat')
house('fifi', -15, -9, '#f6cd7a', 'awning'); house('zaza', 15, -9, '#b39cf0', 'dome'); house('club', 0, -14, '#f6b19a', 'awning')

# palace
pal = empty('Coco Palace', (0, 0, 0)); pink, peach = roof('#f5c6dd'), roof('#f3bfa4')
cube((8, 6, 4.6), M['wall'], (0, 0, 2.3), pal, 0.4); half_sphere(3.2, pink, (0, 0, 4.6), pal)
cyl(0.35, 1.6, M['gold'], (0, 0, 8.6), pal, cone=True); cube((1.3, 0.05, 0.8), M['gold'], (0.7, 0, 9.6), pal, 0.02)
for x in (-4.6, 4.6):
    cyl(1.45, 7, M['wall'], (x, 0, 3.5), pal); cyl(1.9, 3, peach, (x, 0, 8.5), pal, cone=True)
    torus(1.5, 0.1, M['gold'], (x, 0, 7.0), pal); sphere(0.5, M['glass'], (x, -1.3, 5), pal, 24)
cube((1.8, 0.25, 2.6), pink, (0, -3.02, 1.3), pal, 0.4); torus(3.25, 0.12, M['gold'], (0, 0, 4.65), pal)
cyl(6.4, 0.35, M['gold'], (0, 0, 0.08), pal, r2=6.8)
lp = bpy.data.lights.new('Lamp coco', 'POINT'); lp.color = (1, 0.78, 0.45); lp.energy = 0; lo = link(bpy.data.objects.new('Lamp coco', lp)); lo.location = (0, -4, 3)
anchors['coco'] = (0, 0, 11.4)

# shared shelf
sh = empty('Shared Shelf', (0, -6, 0))
cube((4.4, 1.8, 1.2), M['wall'], (0, 0, 0.6), sh, 0.2)
o = cyl(1.6, 4.8, stripes('Shelf canopy', '#8fd3bd', '#fff6ef', 8), (0, 0, 2.6), sh); o.rotation_euler = (0, math.pi / 2, 0); o.scale = (0.8, 0.45, 1)
for x in (-1.5, 1.5): cyl(0.08, 2.4, M['gold'], (x, -0.8, 1.6), sh, v=12)
for i, c in enumerate(['#f3a3be', '#9fc0f2', '#f6cd7a', '#b39cf0']): cube((0.7, 0.7, 0.7), roof(c), (-1.35 + i * 0.9, 0, 1.55), sh, 0.12)
anchors['shelf'] = (0, -6, 4.4)

# ---------- characters ----------
def figure(color, s, loc, rot=0.0, crown=False, parcel=False):
    g = empty('Figure', loc); g.rotation_euler = (0, 0, rot); skin = mat('Skin ' + color, color, 0.35, coat=1, sheen=0.4)
    o = cyl(0.42 * s, 1.0 * s, skin, (0, 0, 0.75 * s), g); bevel(o, 0.3 * s, 6)
    sphere(0.55 * s, skin, (0, 0, 1.65 * s), g, 32)
    for ex in (-0.2, 0.2): sphere(0.075 * s, M['ink'], (ex * s, -0.5 * s, 1.72 * s), g, 12)
    for ex in (-0.33, 0.33):
        b = sphere(0.09 * s, M['blush'], (ex * s, -0.46 * s, 1.55 * s), g, 12); b.scale = (1, 0.3, 1)
    if crown: cyl(0.34 * s, 0.32 * s, M['gold'], (0, 0, 2.25 * s), g, v=6, r2=0.4 * s)
    if parcel: cube((0.6 * s, 0.45 * s, 0.45 * s), M['gold'], (0, 0, 2.15 * s), g, 0.06)
    return g
coco_fig = figure('#f3c3a8', 1.25, (0, -3.4, 4.7), crown=True)
helper_cols = ['#f3a3be', '#8fd3bd', '#9fc0f2', '#eec0e6', '#f6cd7a', '#f6b19a', '#c4d8a0', '#b39cf0', '#f2b8c8', '#f3d9a4']
idlers = [figure(c, 0.62, (-3.6 + i * 1.45, -17.6, 0.05), rot=(i - 2.5) * 0.12) for i, c in enumerate(helper_cols[:6])]
walkers = []
for i, (k, pts) in enumerate(roads.items()):
    (x0, y0), (x1, y1) = pts[1], pts[2]; t = 0.35 + 0.1 * (i % 3)
    w = figure(helper_cols[(i * 3) % 10], 0.7, (pts[1][0] + (x1 - pts[1][0]) * t, pts[1][1] + (y1 - pts[1][1]) * t, 0.1), rot=math.atan2(x1 - x0, -(y1 - y0)), parcel=True)
    walkers.append((w, pts, i / len(roads)))

# ---------- trees ----------
for i, (x, y) in enumerate([(-23, 1), (23, 1), (-8, -16), (8, -17), (-6, 11), (6, 11), (-22, -13), (22, -13), (-11, 14), (11, 14)]):
    t = empty('Tree', (x, y, 0)); cyl(0.22, 1.6, M['trunk'], (0, 0, 0.8), t, v=12, r2=0.3)
    if i % 2: sphere(1.3, M['leaf'], (0, 0, 2.4), t, 24)
    else: cyl(1.2, 2.8, M['leaf'], (0, 0, 2.9), t, v=24, cone=True)

# ---------- platform balloons ----------
plats = [('YouTube', '#f3a3be'), ('Play Store', '#8fd3bd'), ('Chrome Store', '#9fc0f2'), ('Roblox', '#b39cf0'), ('Website', '#f6cd7a'), ('Insta / FB', '#f6b19a')]
balloons = []
for i, (name, c) in enumerate(plats):
    a = i / len(plats) * math.tau + 0.3; loc = (math.cos(a) * 31, math.sin(a) * 26, 10 + (i % 2) * 1.5)
    b = empty('Balloon ' + name, loc); b.scale = (0.8, 0.8, 0.8); env = sphere(1.7, roof(c), (0, 0, 0), b, 40); env.scale = (1, 1, 1.22)
    torus(1.7, 0.07, M['gold'], (0, 0, 0), b); cube((0.9, 0.9, 0.6), M['basket'], (0, 0, -2.9), b, 0.1)
    for x in (-0.35, 0.35): cyl(0.02, 1.4, M['ink'], (x, 0, -2.1), b, v=6)
    anchors['p:' + name] = (loc[0], loc[1], loc[2] + 2.4)
    balloons.append((b, loc))

# ---------- light, sky, camera ----------
world = bpy.data.worlds.new('Sky'); scene.world = world; world.use_nodes = True
wn = world.node_tree.nodes; bg = wn['Background']; sky = wn.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'
world.node_tree.links.new(sky.outputs['Color'], bg.inputs['Color'])
sun_d = bpy.data.lights.new('Sun', 'SUN'); sun_d.angle = math.radians(4); sun = link(bpy.data.objects.new('Sun', sun_d))
sun.rotation_euler = (math.radians(48), 0, math.radians(35))
cam_d = bpy.data.cameras.new('Camera'); cam_d.lens = 40; cam = link(bpy.data.objects.new('Camera', cam_d)); scene.camera = cam
tgt = empty('Target', (0, 0, 2.5)); tr = cam.constraints.new('TRACK_TO'); tr.target = tgt; tr.track_axis = 'TRACK_NEGATIVE_Z'; tr.up_axis = 'UP_Y'

def set_time(night):
    if night:
        sky.sun_elevation = math.radians(-4); bg.inputs['Strength'].default_value = 0.0
        world_col = wn.new('ShaderNodeRGB') if 'Night' not in wn else wn['Night']; world_col.name = 'Night'
        world_col.outputs[0].default_value = hexc('#1b1736'); world.node_tree.links.new(world_col.outputs[0], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
        sun_d.energy = 0.9; sun_d.color = (0.62, 0.7, 1.0)
        M['glass'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 6.0
        for o in bpy.data.objects:
            if o.type == 'LIGHT' and o.name.startswith('Lamp'): o.data.energy = 380
        M['water'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = hexc('#24405e')
    else:
        world.node_tree.links.new(sky.outputs['Color'], bg.inputs['Color'])
        sky.sun_elevation = math.radians(32); sky.sun_rotation = math.radians(35); sky.air_density = 1.2; sky.dust_density = 0.6
        bg.inputs['Strength'].default_value = 0.22; sun_d.energy = 3.2; sun_d.color = (1, 0.95, 0.88)
        M['glass'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0
        for o in bpy.data.objects:
            if o.type == 'LIGHT' and o.name.startswith('Lamp'): o.data.energy = 0
        M['water'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = hexc('#7fc1e0')

# ---------- render settings ----------
scene.render.engine = 'BLENDER_EEVEE_NEXT'
ee = scene.eevee; ee.taa_render_samples = 64
for attr, val in (('use_raytracing', True), ('use_shadows', True), ('use_gtao', True), ('shadow_ray_count', 2), ('shadow_step_count', 8)):
    if hasattr(ee, attr): setattr(ee, attr, val)
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 86
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.film_transparent = False

MODE = argv[4] if len(argv) > 4 else 'turntable'

# ---------- film: a seamless loop of the team at work ----------
def film(N):
    """Keyframes N frames that loop perfectly: helpers walk the roads, parcels fly to the balloons."""
    scene.frame_start, scene.frame_end = 0, N - 1; scene.render.fps = 24
    TAU = math.tau
    def bez(p, t):
        (x0, y0), (x1, y1), (x2, y2) = p; u = 1 - t
        return (u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2)
    for f in range(0, N + 1, 2):
        ph = f / N
        for w, pts, off in walkers:
            q = (ph + off) % 1.0; t = 1 - abs(2 * q - 1)            # 0 → 1 → 0, loops cleanly
            x, y = bez(pts, t); ahead = bez(pts, min(1, t + 0.02)) if q < 0.5 else bez(pts, max(0, t - 0.02))
            w.location = (x, y, 0.1 + 0.16 * abs(math.sin(TAU * 6 * ph + off * 9)))
            w.rotation_euler = (0, 0, math.atan2(ahead[0] - x, -(ahead[1] - y)))
            w.keyframe_insert('location', frame=f); w.keyframe_insert('rotation_euler', frame=f)
        for i, d in enumerate(idlers):
            d.rotation_euler = (0, 0, (i - 2.5) * 0.12 + 0.35 * math.sin(TAU * 2 * ph + i))
            d.location.z = 0.05 + 0.08 * max(0, math.sin(TAU * 4 * ph + i * 1.3))
            d.keyframe_insert('rotation_euler', frame=f); d.keyframe_insert('location', frame=f)
        coco_fig.rotation_euler = (0, 0, 0.45 * math.sin(TAU * ph)); coco_fig.keyframe_insert('rotation_euler', frame=f)
        for i, (b, loc) in enumerate(balloons):
            b.location = (loc[0], loc[1], loc[2] + 0.7 * math.sin(TAU * ph + i)); b.rotation_euler = (0, 0, TAU * ph * (1 if i % 2 else -1))
            b.keyframe_insert('location', frame=f); b.keyframe_insert('rotation_euler', frame=f)
    # gold parcels launched from each House up to a platform balloon, twice per loop
    gold_parcel_routes = [('gigi', 0), ('lulu', 2), ('fifi', 4), ('zaza', 3), ('club', 5)]
    for j, (h, bi) in enumerate(gold_parcel_routes):
        p = cube((0.7, 0.7, 0.7), M['gold'], anchors[h], None, 0.1); start = Vector(anchors[h]); end = Vector(balloons[bi][1]) + Vector((0, 0, -2.6))
        for f in range(0, N + 1, 2):
            q = (2 * f / N + j / len(gold_parcel_routes)) % 1.0
            pos = start.lerp(end, q); pos.z += math.sin(math.pi * q) * 6
            s = math.sin(math.pi * q) ** 0.5
            p.location = pos; p.scale = (s, s, s); p.rotation_euler = (0, 0, TAU * q)
            for prop in ('location', 'scale', 'rotation_euler'): p.keyframe_insert(prop, frame=f)
    for o in bpy.data.objects:
        if o.animation_data and o.animation_data.action:
            for fc in o.animation_data.action.fcurves:
                for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    # camera: a fixed three-quarter view so the name plates stay put
    a = -math.pi / 2 + 0.55; cam.location = (math.cos(a) * 64, math.sin(a) * 64, 34); cam_d.lens = 42
    scene.frame_set(0); bpy.context.view_layer.update()
    spots = {k: [round(v.x, 4), round(1 - v.y, 4), round(v.z, 2)] for k, v in ((k, world_to_camera_view(scene, cam, Vector(p))) for k, p in anchors.items())}
    with open(os.path.join(OUT, 'motion_hotspots.json'), 'w') as fh: json.dump({'width': W, 'height': H, 'frames': N, 'fps': 24, 'hotspots': spots}, fh)
    set_time(False)
    scene.render.filepath = os.path.join(OUT, 'Estate in Motion poster.jpg'); bpy.ops.render.render(write_still=True)
    rs = scene.render; rs.image_settings.file_format = 'FFMPEG'; rs.ffmpeg.format = 'MPEG4'; rs.ffmpeg.codec = 'H264'
    rs.ffmpeg.constant_rate_factor = 'HIGH'; rs.ffmpeg.ffmpeg_preset = 'GOOD'; rs.ffmpeg.gopsize = 24; rs.ffmpeg.audio_codec = 'NONE'
    rs.filepath = os.path.join(OUT, 'Estate in Motion.mp4'); rs.use_file_extension = False
    bpy.ops.render.render(animation=True)
    print('FILM DONE', flush=True)

if MODE == 'film':
    ee.taa_render_samples = 32
    film(FRAMES)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Grand Estate in Motion.blend'))
    sys.exit(0)

# ---------- turntable ----------
data = {'frames': FRAMES, 'width': W, 'height': H, 'hotspots': {}}
dist, height = 74, 42
for night in (False, True):
    set_time(night); key = 'night' if night else 'day'
    for f in range(FRAMES):
        a = -math.pi / 2 + f / FRAMES * math.tau
        cam.location = (math.cos(a) * dist, math.sin(a) * dist, height)
        bpy.context.view_layer.update()
        if not night:
            spots = {}
            for k, p in anchors.items():
                v = world_to_camera_view(scene, cam, Vector(p))
                spots[k] = [round(v.x, 4), round(1 - v.y, 4), round(v.z, 2)]
            data['hotspots'][f] = spots
        scene.render.filepath = os.path.join(OUT, f'{key}_{f:02d}.jpg')
        bpy.ops.render.render(write_still=True)
        print(f'rendered {key} {f + 1}/{FRAMES}', flush=True)
with open(os.path.join(OUT, 'hotspots.json'), 'w') as fh: json.dump(data, fh)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Grand Estate.blend'))
print('DONE', OUT, flush=True)
