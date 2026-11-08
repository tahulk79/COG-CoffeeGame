"""Gedeo waterworks & mountain terrain pass (Blender 5.x): water, irrigation and hillside pieces in real-world metres.

  irrigation-channel  mương — 4 m earthen channel lined with flat stones, coping stones, water surface; tiles along x
  drip-line           ống tưới nhỏ giọt — 4 m black drip hose on short stakes, button emitters, drops, wet dark spots; tiles along x
  hill-cistern        bể nước trên đồi — 3 m Ø × 1.5 m stone/concrete cistern cut into a slope, ladder, inlet, overflow, moss
  stream              suối — 6 m mountain-stream segment, gravel bed, boulders, wet stones, foam, ferns + grass; *_water mesh; tiles along x
  wooden-bridge       cầu gỗ — 5 m log footbridge (span along y), bent plank deck, pole + rope handrails, stone abutments
  stone-pond          ao đá — 6 × 4 m pond, stone-edged rim, water surface, reeds + cattails, lily pads
  stone-steps         bậc đá — footpath stairs, 3 m rise over 4 m run, irregular flat stones, grass; origin at the foot, climbs toward -y
  dirt-ramp           dốc đất — 8.5 m packed-dirt road ramp, 3 m wide, rising 3 m toward -y, tyre ruts, stone-lined ditch on +x
  cliff-face          vách đá — 6 × 4 m layered basalt outcrop, ledges, moss, hanging grass; face toward +y (south / camera)
  mist-bank           sương mù — soft alpha-blended mist cards (~20 × 8 m), material gw_mist

Conventions: Blender z-up (glTF export turns it y-up), origin at ground level, modular pieces tile end to end along x
(periodic noise, identical end cross-sections, world-metre UVs with an integer number of repeats per segment).
Every water surface is its own mesh (object name ends in _water) with material gw_water (blue-green, low roughness, alpha).

Run:  Blender -b --factory-startup -P scripts/blender/gedeo_waterworks.py -- --export public/models/gedeo [--only stream,stone_pond]
"""
import os, sys, math, random, json
_here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/Users/macos/Desktop/COG/scripts/blender'
_GEDEO_LIB = globals().get('_GEDEO_LIB', 0) + 1
exec(open(os.path.join(_here, 'gedeo_environment.py')).read(), globals())
_GEDEO_LIB -= 1
from mathutils import Matrix, noise as mnoise

# ───────────────────────────── textures ─────────────────────────────

def tex_water(seed=601):
    """Ripples stretched along u (flow direction): blue-green with lighter crests."""
    rng = np.random.default_rng(seed); H = W = 512
    a = fbm(H, W, 16, 4, 4, rng); b = fbm(H, W, 32, 8, 3, rng)
    h = a * .65 + b * .35
    c = mix3(srgb((.06, .16, .15)), srgb((.16, .30, .27)), np.clip(h * 1.5 - .25, 0, 1))
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, h, 4.0

def tex_basalt(seed=602):
    """Layered highland basalt for close-ups (1024²): dark grey bands, crisp near-vertical joints and bedding planes,
    a painted network of sharp hairline fractures with lit lips, pale lichen, light rust. Strong height → normal map."""
    rng = np.random.default_rng(seed); H = W = 1024; prng = random.Random(seed)
    bands = fbm(H, W, 20, 2, 3, rng); n = fbm(H, W, 8, 8, 5, rng); fine = fbm(H, W, 96, 96, 2, rng)
    u = np.linspace(0, 1, W, endpoint=False)[None, :]; v = np.linspace(0, 1, H, endpoint=False)[:, None]
    colu = (u * 6 + (fbm(H, W, 3, 1, 2, rng) - .5) * .5) % 1                     # near-vertical cooling joints, broken
    joint = np.clip(1 - np.minimum(colu, 1 - colu) * 140, 0, 1) * np.clip((fbm(H, W, 6, 3, 2, rng) - .4) * 6, 0, 1)
    rowv = (v * 5 + (fbm(H, W, 1, 4, 2, rng) - .5) * .3) % 1                      # bedding planes
    bed = np.clip(1 - np.minimum(rowv, 1 - rowv) * 160, 0, 1) * .8
    c = mix3(srgb((.20, .195, .19)), srgb((.50, .48, .44)), np.clip(n * .9 + bands * .5 - .3, 0, 1))
    c *= (.8 + .4 * fine)[..., None]
    lich = np.clip((fbm(H, W, 24, 24, 3, rng) - .7) * 5, 0, 1); c = mix3(c, srgb((.58, .60, .50)), lich * .45)
    rust = np.clip((fbm(H, W, 5, 5, 3, rng) - .66) * 3, 0, .3); c = mix3(c, srgb((.38, .28, .21)), rust)
    cv = Canvas(W, H); cv.a[..., 3] = 0                                          # hairline fracture network (mask only)
    for _ in range(190):
        x, y = prng.random() * W, prng.random() * H; ang = prng.choice((math.pi / 2, 0)) + prng.gauss(0, .35)
        for seg in range(prng.randint(2, 5)):
            L = prng.uniform(15, 60); x2, y2 = x + math.cos(ang) * L, y + math.sin(ang) * L
            cv.line(x, y, x2, y2, prng.uniform(1.4, 3.2), (1, 1, 1)); x, y = x2, y2; ang += prng.gauss(0, .5)
    frac = cv.a[..., 3]
    crack = np.clip(joint + bed + frac, 0, 1)
    lip = np.clip(np.roll(crack, 2, 0) - crack, 0, 1)                            # lit upper lip of each crack
    c *= (1 - .78 * crack)[..., None]; c += (.10 * lip)[..., None]
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, n * .5 + fine * .35 + lich * .1 - crack * .9, 12.0

def tex_gravel(seed=603):
    """Stream bed: rounded pebbles in grey / brown over silty sand."""
    rng = np.random.default_rng(seed); H = W = 512; prng = random.Random(seed)
    n = fbm(H, W, 8, 8, 4, rng)
    cv = Canvas(W, H); cv.a[..., :3] = mix3(srgb((.30, .25, .19)), srgb((.45, .39, .30)), n); cv.a[..., 3] = 1
    for _ in range(1100):
        x, y = prng.random() * W, prng.random() * H; rr = prng.uniform(3, 13)
        col = np.array(prng.choice([(.52, .50, .47), (.42, .40, .38), (.60, .55, .48), (.35, .30, .26), (.66, .62, .56)])) * prng.uniform(.8, 1.15)
        for ox in (-W, 0, W):                                                    # wrap so the tile repeats
            for oy in (-H, 0, H):
                if -20 < x + ox < W + 20 and -20 < y + oy < H + 20:
                    cv.ellipse(x + ox, y + oy, rr, rr * prng.uniform(.6, .95), prng.random() * 3, col, shade=.6)
    lum = cv.a[..., :3].mean(2)
    return cv.a, lum * .9 + n * .2, 6.0

def tex_fern():
    """One pinnate fern frond, base at the bottom of the image, alpha cut."""
    rng = random.Random(604); W, H = 1024, 2048; cv = Canvas(W, H)
    cx = W / 2; npin = 21
    cv.line(cx, H - 2, cx, 40, 9, (.20, .26, .09), 3)
    for k in range(npin):
        s = (k + .5) / npin; y = H * (1 - .06 - s * .9)
        L = W * .46 * math.sin(math.pi * min(1, s * .85 + .15)) ** .8
        for side in (-1, 1):
            up = .35 + .5 * s                                                      # pinnae sweep up toward the tip
            ang = -up if side > 0 else math.pi + up
            base = np.array(rng.choice([(.20, .38, .10), (.24, .42, .12), (.18, .33, .09)])) * rng.uniform(.85, 1.1)
            prof = lambda t: (1 - np.clip(t, 0, 1)) ** .7 * np.clip(t * 8, 0, 1) * (.55 + .45 * np.abs(np.sin(t * np.pi * 6.5)))   # lobed pinnules
            colfn = lambda t, u, base=base: base * (.75 + .4 * np.abs(u))[..., None] * (1 - .4 * (np.abs(u) < .12))[..., None] * (1 + .25 * t)[..., None]
            cv.blade(cx + side * 3, y, ang, L, max(10, L * .19), prof, colfn)
    return cv.down2().a

def tex_foam(seed=605):
    rng = random.Random(seed); W = H = 512; cv = Canvas(W, H)
    for _ in range(900):
        r = abs(rng.gauss(0, .3)); a = rng.random() * TAU
        x = W / 2 + math.cos(a) * r * W * .5; y = H / 2 + math.sin(a) * r * H * .25
        if not (8 < x < W - 8 and 8 < y < H - 8): continue
        rr = rng.uniform(2, 9) * (1 - min(.8, r))
        cv.ellipse(x, y, rr * rng.uniform(1, 3.5), rr, rng.gauss(0, .15), np.array((.92, .95, .95)) * rng.uniform(.85, 1), shade=.3)
    return cv.a

def tex_rock(seed=608):
    """Single weathered stone surface (no mortar pattern): grey basalt / granite grain, pits, pale lichen, rust stains."""
    rng = np.random.default_rng(seed); H = W = 512
    n = fbm(H, W, 6, 6, 5, rng); grain = fbm(H, W, 96, 96, 2, rng); pits = vnoise(H, W, 70, 70, rng)
    c = mix3(srgb((.40, .38, .35)), srgb((.62, .60, .56)), np.clip(n * 1.3 - .15, 0, 1)) * (.82 + .3 * grain)[..., None]
    c *= (1 - .45 * np.clip((pits - .8) * 6, 0, 1))[..., None]
    lich = np.clip((fbm(H, W, 18, 18, 3, rng) - .62) * 5, 0, 1); c = mix3(c, srgb((.72, .74, .62)), lich * .7)
    rust = np.clip((fbm(H, W, 4, 4, 3, rng) - .62) * 3, 0, .45); c = mix3(c, srgb((.45, .32, .22)), rust)
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, n * .6 + grain * .3 - np.clip((pits - .8) * 6, 0, 1) * .3, 5.0

CISTERN = dict(R=1.5, Ri=1.34, Htop=1.5, WL=1.2, z0=.38, joints=[.42 + .27 * k for k in range(1, 4)], over_a=1.85, inlet_a=-1.75, ladder_a=.55)
def tex_cistern_wall(seed=609):
    """Unwrapped outer wall of the hill cistern (u = angle / 2π, v = height from the footing to the rim): rendered
    concrete with formwork lifts, crisp dark wet run-off streaks under the rim, white efflorescence from the joints,
    rust under the ladder hooks, a sharp-edged algae stain under the overflow, moss creeping up from the foot."""
    C = CISTERN; rng = np.random.default_rng(seed); prng = random.Random(seed); H, W = 512, 2048
    n = fbm(H, W, 8, 32, 5, rng); pores = fbm(H, W, 128, 512, 1, rng)
    c = srgb((.63, .62, .59)) * (.84 + .26 * n)[..., None] * (.92 + .12 * pores)[..., None]; h = n * .3 + pores * .25
    span = C['Htop'] - C['z0']
    def zrow(z): return int((1 - (z - C['z0']) / span) * (H - 1))
    for zj in C['joints']:                                                      # formwork lift lines + tie-rod holes
        r = zrow(zj); c[r - 1:r + 2] *= .5; h[r - 1:r + 2] -= .6
        for k in range(18):
            x = int((k + .5) / 18 * W); rr = zrow(zj + .13)
            c[rr - 3:rr + 4, x - 3:x + 4] *= .45; h[rr - 3:rr + 4, x - 3:x + 4] -= .4
    def streak(xc, r0, L, w, col, k, hd=0.0, grow=0.0, wob=3.0):
        r0 = max(0, int(r0)); r1 = min(H, int(r0 + L))
        if r1 <= r0: return
        wmax = w * (1 + grow) + wob + 3
        R_, X = np.meshgrid(np.arange(r0, r1), np.arange(int(xc - wmax), int(xc + wmax) + 1), indexing='ij')
        t = (R_ - r0) / max(1, L)
        cx = xc + wob * np.sin(R_ * .023 + xc * .1)
        ww = w * (1 - .45 * t + grow * t)
        m = np.clip((ww / 2 - np.abs(X - cx)) * 1.3, 0, 1) * k * np.clip((1 - t) * 6, 0, 1)   # 1-px edges, ragged stop
        Xi = X % W
        c[R_, Xi] = c[R_, Xi] * (1 - m[..., None]) + np.asarray(col, np.float32) * m[..., None]; h[R_, Xi] += m * hd
    for _ in range(150):                                                        # wet run-off under the rim lip
        streak(prng.random() * W, prng.randint(0, 8), prng.uniform(50, 430), prng.uniform(2, 13), np.array((.30, .31, .28)) * prng.uniform(.65, 1.1), prng.uniform(.4, .8), hd=-.05)
    for _ in range(45):                                                         # efflorescence from the lift joints
        zj = prng.choice(C['joints']); streak(prng.random() * W, zrow(zj) + 2, prng.uniform(25, 140), prng.uniform(1.5, 5), (.86, .84, .78), prng.uniform(.45, .8), hd=.15)
    xl = C['ladder_a'] % TAU / TAU * W; dx = .2 / (TAU * C['R']) * W
    for sx in (-1, 1):                                                          # rust under the ladder hooks
        streak(xl + sx * dx, 0, prng.uniform(180, 300), 7, (.50, .29, .13), .75, hd=.05); streak(xl + sx * dx + 4, 0, 120, 3, (.40, .22, .10), .6)
    xo = C['over_a'] % TAU / TAU * W; ro = zrow(1.38) + 10                       # overflow: calcite rim + dark algae stain
    streak(xo, ro, H - ro, 70, (.80, .78, .70), .7, hd=.2, grow=.9, wob=5)
    streak(xo, ro, H - ro, 52, (.10, .13, .07), .9, hd=-.1, grow=.9, wob=5)
    streak(xo - 3, ro, H - ro, 14, (.05, .07, .04), .8, grow=.4, wob=5)
    xi = C['inlet_a'] % TAU / TAU * W
    streak(xi, 0, 330, 26, (.20, .22, .17), .7, hd=-.05, wob=4); streak(xi + 18, 0, 200, 8, (.80, .78, .70), .5)
    bh = 25 + 70 * fbm(H, W, 1, 48, 3, rng)[0][None, :]                           # moss creeping up from the foot, crisp top edge
    fromb = (H - 1 - np.arange(H))[:, None]; mm = np.clip((bh - fromb) / 2.5, 0, 1) * (.65 + .35 * n)
    c = c * (1 - mm[..., None]) + srgb((.22, .30, .10)) * (.7 + .5 * pores)[..., None] * mm[..., None]; h += mm * .3
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.clip(c, 0, 1)
    return out, h, 6.0

def tex_wetspot(seed=607):
    """Soft dark wet-earth blob (alpha-blended decal): darkens whatever ground it lies on."""
    rng = np.random.default_rng(seed); H = W = 256
    n = fbm(H, W, 5, 5, 4, rng)
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32); u = (X + .5) / W * 2 - 1; v = (Y + .5) / H * 2 - 1
    r = np.sqrt(u * u + v * v) + (n - .5) * .5
    out = np.ones((H, W, 4), np.float32); out[..., :3] = np.array((.11, .075, .055)) * (.8 + .4 * n)[..., None]
    out[..., 3] = np.clip((1 - r) * 2.2, 0, 1) ** 1.2 * .82
    return out

def tex_mist(seed=606):
    rng = np.random.default_rng(seed); H, W = 256, 512
    n = fbm(H, W, 3, 6, 5, rng); m = fbm(H, W, 6, 12, 3, rng)
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (X + .5) / W * 2 - 1; v = (Y + .5) / H * 2 - 1
    r = np.sqrt(u ** 2 + v ** 2) + (n - .5) * .55
    a = np.clip(1 - r, 0, 1) ** 1.3 * np.clip(n * 1.6 + m * .6 - .55, 0, 1) * .85
    out = np.ones((H, W, 4), np.float32); out[..., :3] = (np.array((.93, .95, .97)) * (.92 + .08 * m)[..., None])
    out[..., 3] = np.clip(a, 0, .8)
    return out

# ───────────────────────────── materials ─────────────────────────────

def water_mat():
    c, n = tex_pair('ww_water', tex_water)
    m = material('gw_water', c, .05, normal=n, normal_strength=.45, spec=.9)
    bsdf = next(x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED'); bsdf.inputs['Alpha'].default_value = .72
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m

def blend_mat(name, img_name, fn, rough, spec, emission=None):
    """Alpha-BLEND material (texture alpha straight into the BSDF → glTF alphaMode BLEND)."""
    if name in bpy.data.materials:
        if bpy.data.materials[name].users: return bpy.data.materials[name]
        bpy.data.materials.remove(bpy.data.materials[name])
    img = to_image(img_name, fn)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    bsdf = next(x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = spec
    if emission and 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = emission; bsdf.inputs['Emission Strength'].default_value = 1.0
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    m.use_backface_culling = False
    return m

def ww_mats():
    M = env_mats()
    for key, fn, rough in (('lawn', lambda: tex_grass_tile(611, 1024), .95), ('soil', lambda: tex_soil_tile(612, 1024), .95),
                           ('road', lambda: tex_road_tile(613, 1024), .95), ('gravel', tex_gravel, .8), ('basalt', tex_basalt, .9)):
        c, n = tex_pair('ww_' + key, fn); M[key] = material('gw_' + key, c, rough, normal=n, spec=.3)
    M['masonry'] = M['stone']                                      # mortared rubble (cistern footing)
    st, stn = tex_pair('ww_rock', tex_rock)
    M['stone'] = material('gw_rock', st, .85, normal=stn, spec=.3)
    M['wetstone'] = material('gw_wetrock', st, .3, normal=stn, spec=.65)
    sc, sn = tex_pair('ww_soil', lambda: tex_soil_tile(612, 1024))
    M['wetsoil'] = material('gw_wetsoil', sc, .3, normal=sn, spec=.6)
    M['water'] = water_mat()
    M['foam'] = material('gw_foam', to_image('T_ww_foam', tex_foam), .45, alpha=True, two_sided=True, spec=.5)
    M['fern'] = material('gw_fern', to_image('T_ww_fern', tex_fern), .75, alpha=True, two_sided=True, spec=.3)
    M['rubber'] = material('gw_rubber', None, .45, spec=.45)
    M['steel'] = material('gw_steel', None, .4, spec=.6)
    M['mist'] = blend_mat('gw_mist', 'T_ww_mist', tex_mist, 1.0, 0.0, emission=(.55, .57, .60, 1))
    M['wetspot'] = blend_mat('gw_wetspot', 'T_ww_wetspot', tex_wetspot, .3, .6)
    M['wetspot'].use_backface_culling = True
    bsdf = next(x for x in M['steel'].node_tree.nodes if x.type == 'BSDF_PRINCIPLED'); bsdf.inputs['Metallic'].default_value = .35; bsdf.inputs['Roughness'].default_value = .55
    return M

# ───────────────────────────── shared builders ─────────────────────────────

MOSS = (.20, .30, .08, 1)
def ss(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def mixc(a, b, t): return tuple(a[i] * (1 - t) + b[i] * t for i in range(3)) + (1,)
def lsp(a, b, n): return [a + (b - a) * i / n for i in range(n + 1)]

def pnoise(x, y, L, f, seed=0.0, z=0.0):
    """3D Perlin sampled on a circle in x: periodic with period L along x (tileable modules)."""
    a = TAU * x / L; R = L * f / TAU
    return mnoise.noise(Vector((math.cos(a) * R + seed * 7.13, math.sin(a) * R - seed * 3.31, y * f + z + seed)))

def heightfield(mb, xs, ys, hfn, uvs=2.0, colfn=None, keep=None):
    """Grid surface z = hfn(x, y), faces up, world-metre UVs / uvs. keep(xc, yc) filters cells (shared edges stay exact)."""
    cache = {}
    def vid(i, j):
        if (i, j) not in cache:
            x, y = xs[i], ys[j]; z = hfn(x, y)
            cache[(i, j)] = mb.add((x, y, z), (x / uvs, y / uvs), colfn(x, y, z) if colfn else (1, 1, 1, 1))
        return cache[(i, j)]
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            if keep and not keep((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2): continue
            mb.face((vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)))

def skirt(mb, pts, zbot, outward, uvs=2.0, col=(1, 1, 1, 1)):
    """Vertical earth face under a profile polyline down to zbot, oriented to face `outward`."""
    out = Vector(outward)
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        q = [Vector((a.x, a.y, zbot)), Vector((b.x, b.y, zbot)), b, a]
        if (q[1] - q[0]).cross(q[3] - q[0]).dot(out) < 0: q = [q[1], q[0], q[3], q[2]]
        ids = [mb.add(p, (((p.x + p.y) if abs(out.x) < .5 else p.y) / uvs, p.z / uvs), col) for p in q]
        mb.face(ids)

def rock(mb, c, s, rng, col, rz=None, amp=.22, e=.75, seg=10, rings=6):
    """Environment stone() with a controllable heading (rz) and displacement amplitude (amp: flatter slabs)."""
    s0 = len(mb.v)
    superellipsoid(mb, Vector(c), s, e=e, seg=seg, rings=rings, rz=rng.random() * TAU if rz is None else rz, col=col, uv_scale=(2, 1))
    o = Vector((rng.random() * 50, rng.random() * 50, rng.random() * 50)); cc = Vector(c)
    for i in range(s0, len(mb.v)):
        d = Vector(mb.v[i]) - cc
        q = cc + d * (1 + amp * mnoise.noise(o + d * 3.5) + amp * .36 * mnoise.noise(o + d * 9))
        q.z = max(q.z, cc.z - s[2] * .38); mb.v[i] = tuple(q)

STONE = (.95, .92, .87, 1)
def mstone(mb, c, s, rng, col=STONE, moss=0.0, wet_below=None, seg=8, rings=5, var=.1, rz=None, amp=.22, e=.75):
    """rock() + moss on the upward-facing top and a dark algae band below a water line."""
    s0 = len(mb.v); base = tint(rng, tuple(min(1.0, k * 1.5) for k in col[:3]) + (1,), var) if col is not STONE else tint(rng, col, var)
    rock(mb, c, s, rng, base, rz=rz, amp=amp, e=e, seg=seg, rings=rings)
    o = rng.random() * 40; cz = c[2]
    for i in range(s0, len(mb.v)):
        x, y, z = mb.v[i]; col_i = base
        if moss > 0:
            t = ss((z - cz) / (s[2] * .5) * 1.4 - .2) * moss * ss(.5 + .9 * mnoise.noise(Vector((x * 3 + o, y * 3, z * 3))))
            col_i = mixc(col_i, MOSS, t)
        if wet_below is not None and z < wet_below:
            col_i = mixc(col_i, (.16, .17, .10), ss((wet_below - z) / .08) * .55)
        mb.col[i] = col_i

def tuft(mb, base, rng, s=.5, n=6, flowers=False, hang=0.0, out=None, col=None):
    """Grass clump from the shared grass-card atlas; hang > 0 droops the blades outward (overhanging banks / ledges)."""
    base = Vector(base)
    for i in range(n):
        a = i * TAU / n + rng.random() * .6
        d = Vector((math.cos(a), math.sin(a), 0))
        if out is not None: d = (Vector(out) + d * .6).normalized()
        h = s * rng.uniform(.7, 1.15); cell = GRASS_CELLS[1 if flowers and i % 3 == 0 else 0]
        c = col or tint(rng, (1, 1, 1, 1), .12)
        ids = []
        for z in (0, .5, 1):
            for x in (-.5, .5):
                p = base + d.cross(UP) * x * h + UP * z * h * (1 - hang * .6) + d * z * h * (.15 + hang * .9) - UP * z * z * h * hang * 1.3
                ids.append(mb.add(p, (cell[0] + (x + .5) * (cell[2] - cell[0]), z), c))
        mb.face((ids[0], ids[1], ids[3], ids[2])); mb.face((ids[2], ids[3], ids[5], ids[4]))

def fern(mb, base, rng, s=.6, n=7, col=(1, 1, 1, 1)):
    base = Vector(base)
    for i in range(n):
        a = i * TAU / n + rng.uniform(-.3, .3); out = Vector((math.cos(a), math.sin(a), 0))
        d = (out * rng.uniform(.7, 1.1) + UP * rng.uniform(.9, 1.5)).normalized(); L = s * rng.uniform(.75, 1.15)
        leaf(mb, base, d, UP, L, L * .5, (0, 0, 1, 1), tint(rng, col, .1), lambda t: 1.0, segs=4, droop=.55, fold=.1, rng=rng)

def foam_patch(mb, c, rng, L=.7, W=.35, rz=0.0):
    c = Vector(c); R = Matrix.Rotation(rz, 3, 'Z')
    ids = [mb.add(c + R @ Vector((x * L, y * W, 0)), (x + .5, y + .5), (1, 1, 1, 1)) for (x, y) in ((-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5))]
    mb.face(ids)

def plank(mb, c, length, width, thick, rng, rz=0.0, bow=.0, along='x', board=None):
    """Hand-sawn plank: 6 sections along its length with a bow, small twist and ragged ends; grain runs along the plank."""
    c = Vector(c); R = Matrix.Rotation(rz + (0 if along == 'x' else math.pi / 2), 3, 'Z'); n = 6
    twist = rng.gauss(0, .04); u0 = (board if board is not None else rng.randrange(5)) / 5
    secs = []
    for i in range(n + 1):
        t = i / n; x = (t - .5) * length + (rng.gauss(0, .012) if i in (0, n) else 0)
        z = bow * (1 - (2 * t - 1) ** 2); tw = twist * (2 * t - 1)
        hw = width / 2 * (1 + rng.gauss(0, .03)); ht = thick / 2
        ring = [Vector((x, -hw, z - ht - tw * hw)), Vector((x, hw, z - ht + tw * hw)), Vector((x, hw, z + ht + tw * hw)), Vector((x, -hw, z + ht - tw * hw))]
        secs.append([c + R @ p for p in ring])
    # faces: bottom, +side, top, -side (u across the board, v along the grain)
    for k in range(4):
        k2 = (k + 1) % 4
        for i in range(n):
            a, b = secs[i], secs[i + 1]
            v0, v1 = i / n * length / 1.2, (i + 1) / n * length / 1.2
            ids = [mb.add(a[k], (u0, v0)), mb.add(a[k2], (u0 + .2, v0)), mb.add(b[k2], (u0 + .2, v1)), mb.add(b[k], (u0, v1))]
            mb.face(ids)
    for sec, flip in ((secs[0], True), (secs[-1], False)):
        ids = [mb.add(p, (u0 + .2 * (j in (1, 2)), .02 * (j in (2, 3))), (.75, .7, .65, 1)) for j, p in enumerate(sec)]
        mb.face(ids if not flip else ids[::-1])

# ───────────────────────────── 1. irrigation channel (mương) ─────────────────────────────

def irrigation_channel(seed=21, L=4.0):
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('soil', 'lawn', 'stone', 'water', 'grass')}
    # Built up on the ground (no terrain cut needed): earthen banks to +0.34 m, bed just above 0, water at +0.15 m.
    WL = .15
    def h(x, y):
        ay = abs(y) + .025 * pnoise(x, y, L, 1.6, 1)
        if ay < .2: z = .015 + .012 * abs(pnoise(x, y, L, 3, 2))
        elif ay < .32: z = .015 + .3 * ss((ay - .2) / .12)
        elif ay < .62: z = .315 + .03 * pnoise(x, y, L, 2, 3)
        else: z = (.315 + .03 * pnoise(x, y, L, 2, 3)) * (1 - ss((ay - .62) / .45)) + .012
        return z
    xs = lsp(-L / 2, L / 2, 40)
    ys = sorted(set([round(v, 4) for v in lsp(-1.3, -.5, 10) + lsp(-.5, .5, 25) + lsp(.5, 1.3, 10)]))
    heightfield(P['soil'], xs, ys, h, 2.0, keep=lambda x, y: abs(y) < .64, colfn=lambda x, y, z: mixc((1, 1, 1), (.62, .55, .5), ss((WL + .05 - z) / .15)))
    heightfield(P['lawn'], xs, ys, h, 2.0, keep=lambda x, y: abs(y) >= .64)
    heightfield(P['water'], lsp(-L / 2, L / 2, 16), lsp(-.3, .3, 4), lambda x, y: WL + .004 * pnoise(x, y, L, 4, 5), 2.0)
    for side in (-1, 1):                                           # stone lining: upright slabs along both walls + coping
        x = -L / 2
        while x < L / 2 - .06:
            w = min(rng.uniform(.24, .4), L / 2 - x)
            mstone(P['stone'], (x + w / 2, side * (.27 + rng.uniform(-.015, .015)), .15), (w * 1.02, .13, .34), rng, moss=.3, wet_below=WL + .04, seg=8, rings=5, rz=rng.gauss(0, .05), amp=.15)
            x += w * .97
        x = -L / 2 + rng.uniform(0, .1)
        while x < L / 2 - .08:
            w = min(rng.uniform(.28, .5), L / 2 - x)
            if rng.random() < .85:
                mstone(P['stone'], (x + w / 2, side * (.41 + rng.uniform(-.02, .03)), .33), (w, rng.uniform(.22, .3), .1), rng, moss=.5, seg=8, rings=4, rz=rng.gauss(0, .08), amp=.15)
            x += w * 1.02
    for _ in range(14):                                            # pebbles on the bed
        mstone(P['stone'], (rng.uniform(-L / 2 + .1, L / 2 - .1), rng.uniform(-.15, .15), .03), (rng.uniform(.06, .14),) * 2 + (.06,), rng, col=(.5, .46, .4, 1), wet_below=1, seg=6, rings=3)
    for _ in range(30):                                            # grass on the banks hides the soil / lawn seam
        side = rng.choice((-1, 1)); y = side * rng.uniform(.6, 1.2); x = rng.uniform(-L / 2 + .15, L / 2 - .15)
        tuft(P['grass'], (x, y, h(x, y) - .02), rng, s=rng.uniform(.25, .45), n=5, flowers=rng.random() < .2)
    for _ in range(12):                                            # blades drooping over the channel edge
        side = rng.choice((-1, 1)); x = rng.uniform(-L / 2 + .15, L / 2 - .15)
        tuft(P['grass'], (x, side * .55, h(x, side * .55)), rng, s=.32, n=3, hang=.6, out=(0, -side, 0))
    return group('irrigation_channel', P, M)

# ───────────────────────────── 2. drip line ─────────────────────────────

def drip_line(seed=22, L=4.0):
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('rubber', 'pole', 'water', 'wetspot')}
    BLACK = (.025, .025, .027, 1)
    zt, zs = .16, .11                                              # hose height at the stakes / mid-sag
    def hose_z(x): return zs + (zt - zs) * math.cos(math.pi * (x + 1.6) / .8) ** 2
    def hose_y(x): return .012 * math.sin(TAU * x / L * 2)
    pts = [Vector((x, hose_y(x), hose_z(x))) for x in lsp(-L / 2, L / 2, 48)]
    tube(P['rubber'], pts, [.008] * len(pts), 8, col=BLACK)
    for k in range(5):                                             # short split eucalyptus stakes with a wire tie
        x = -1.6 + .8 * k; y = hose_y(x) - .022
        pole(P['pole'], rng, (x, y, -.02), (x + rng.gauss(0, .01), y, zt + .07), .016, 5, wob=.004, segs=2)
        ring = [Vector((x, y + .022 + math.cos(a) * .028, zt + math.sin(a) * .014)) for a in lsp(0, TAU, 10)]
        tube(P['rubber'], ring, [.002] * len(ring), 4, col=(.30, .30, .32, 1))
    for k in range(10):                                            # button emitters under the hose, a drop, and the wet spot
        x = -1.8 + .4 * k; y = hose_y(x); z = hose_z(x)
        cyl(P['rubber'], Vector((x, y, z - .012)), .011, .014, (0, 0, 1), (.05, .05, .055, 1), segs=10)
        cyl(P['rubber'], Vector((x, y, z - .022)), .004, .01, (0, 0, 1), (.15, .12, .08, 1), segs=6)
        ellipsoid(P['water'], Vector((x, y, z - .034)), UP, .006, .0045, (1, 1, 1, 1), 6, 4)
        ellipsoid(P['water'], Vector((x, y, z * .5)), UP, .007, .003, (1, 1, 1, 1), 5, 3)
        # wet spot: soft alpha-blended dark decal (darkens whatever soil it lies on) + a thin glossy puddle film
        R0 = rng.uniform(.15, .21); rz = rng.random() * TAU; Rm = Matrix.Rotation(rz, 3, 'Z')
        ids = [P['wetspot'].add(Vector((x, y, .006)) + Rm @ Vector((u * R0 * 1.3, v * R0, 0)), ((u + 1) / 2, (v + 1) / 2)) for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        P['wetspot'].face(ids)
        lathe(P['water'], [(.03 + .012 * rng.random(), .008), (.001, .0085)], 10, center=(x + .01, y, 0), wobble=lambda a, z: .25 * math.sin(a * 3 + x))
    return group('drip_line', P, M)

# ───────────────────────────── 3. hill cistern ─────────────────────────────

def hill_cistern(seed=23):
    rng = random.Random(seed); M = ww_mats()
    P = {k: MB() for k in ('lawn', 'soil', 'stone', 'masonry', 'cwall', 'concrete', 'water', 'steel', 'rubber', 'grass', 'fern', 'plain', 'foam')}
    R, Ri, Htop, WL, segs = CISTERN['R'], CISTERN['Ri'], CISTERN['Htop'], CISTERN['WL'], 64
    def ground(x, y):
        r = math.hypot(x / 1.05, y)
        # bank rising behind (uphill, -y) up to ~0.6 m, flat apron in front; never below the surrounding ground
        bank = max(0.0, -y - .2) * .45 * (1 - ss((r - 2.4) / 1.6))
        return .012 + bank + .06 * abs(mnoise.noise(Vector((x * .9, y * .9, 3)))) * ss((r - 1.6) / .5) * (1 - ss((r - 3.5) / .6))
    # hillside patch (polar grid round the tank, lawn outside, worn soil apron at the foot)
    rings_r = [1.52, 1.62, 1.8, 2.05, 2.35, 2.7, 3.1, 3.55, 4.1]; asg = 48; grid = {}
    def gv(mb, i, j):
        key = (id(mb), i, j)
        if key not in grid:
            a = TAU * j / asg; r = rings_r[i]
            x, y = math.cos(a) * r * (1.05 if i else 1), math.sin(a) * r
            grid[key] = mb.add((x, y, ground(x, y)), (x / 2, y / 2), (1, 1, 1, 1))
        return grid[key]
    for i in range(len(rings_r) - 1):
        for j in range(asg):
            a = TAU * (j + .5) / asg; mb = P['soil'] if (i < 2 and math.sin(a) > -.2) or (i < 4 and abs(a - 1.75) < .45) else P['lawn']
            mb.face((gv(mb, i, j), gv(mb, i + 1, j), gv(mb, i + 1, j + 1), gv(mb, i, j + 1)))
    # tank: rubble-stone footing band, rendered walls, rim, inner wall, water
    def wob(a, z): return .006 * mnoise.noise(Vector((math.cos(a) * 3, math.sin(a) * 3, z * 3)))
    lathe(P['masonry'], [(R + .06, -.45), (R + .05, .38)], segs, col=(.9, .85, .78, 1), u_len=1.2, v_len=1.2, wobble=lambda a, z: wob(a, z) * 2)
    # outer wall: one unwrap of the painted wall texture (u = angle / 2π, v = footing → rim), joints recessed
    c_, n_ = tex_pair('ww_cistern_wall', tex_cistern_wall); M['cwall'] = material('gw_cistern_wall', c_, .85, normal=n_, spec=.3)
    prof = [(R + .05, CISTERN['z0']), (R, CISTERN['z0'] + .001)]
    for zj in CISTERN['joints']: prof += [(R, zj - .012), (R - .004, zj), (R, zj + .012)]
    prof += [(R, Htop - .04), (R + .02, Htop)]
    rings = lathe(P['cwall'], prof, segs, wobble=wob)
    for ring in rings:                                                                          # exact unwrap UVs
        for j, vi in enumerate(ring): P['cwall'].uv[vi] = (j / segs, (P['cwall'].v[vi][2] - CISTERN['z0']) / (Htop - CISTERN['z0']))
    lathe(P['concrete'], [(R + .02, Htop), (R + .02, Htop + .05), (Ri, Htop + .05)], segs, u_len=1.5, v_len=1.5)
    lathe(P['concrete'], [(Ri, Htop + .05), (Ri, .25)], segs, u_len=1.5, v_len=1.5)    # top→bottom: faces inward
    over_a, inlet_a, ladder_a = CISTERN['over_a'], CISTERN['inlet_a'], CISTERN['ladder_a']
    for i, (x, y, z) in enumerate(P['concrete'].v):               # weathering: moss at the foot, dark run-off streaks, overflow stain
        a = math.atan2(y, x); r = math.hypot(x, y); col = (1, 1, 1, 1)
        if z > Htop + .02:
            col = mixc(col, MOSS, .35 * ss(mnoise.noise(Vector((x * 3, y * 3, 2))) * 2 + .3))
        elif r < Ri + .01:
            col = mixc(col, (.30, .33, .22), ss((WL + .12 - z) / .12) * .7)
        P['concrete'].col[i] = col
    lathe(P['water'], [(Ri + .01, WL), (.001, WL)], segs, u_len=2, v_len=2)
    # rubble footing stones round the downhill half
    for k in range(24):
        a = -.25 + k * (math.pi + .5) / 24 + rng.uniform(-.04, .04); r = R + .14
        x, y = math.cos(a) * r, math.sin(a) * r
        mstone(P['stone'], (x, y, ground(x, y) + .05), (.32, .26, .2), rng, col=(.62, .58, .52, 1), moss=.6, seg=7, rings=4)
    # galvanised ladder over the rim
    t = Vector((-math.sin(ladder_a), math.cos(ladder_a), 0)); o = Vector((math.cos(ladder_a), math.sin(ladder_a), 0))
    zg = ground(*(o * (R + .45)).xy)
    for sgn in (-1, 1):
        rail = [o * (R + .45) + t * sgn * .2 + Vector((0, 0, zg - .05)), o * (R + .08) + t * sgn * .2 + Vector((0, 0, Htop + .15)),
                o * (R - .02) + t * sgn * .2 + Vector((0, 0, Htop + .32)), o * (Ri - .12) + t * sgn * .2 + Vector((0, 0, Htop + .2)), o * (Ri - .18) + t * sgn * .2 + Vector((0, 0, WL + .3))]
        tube(P['steel'], rail, [.018] * len(rail), 6, col=(.34, .35, .35, 1))
    for k in range(6):
        f = (k + .7) / 6.2; p = (o * (R + .45) + Vector((0, 0, zg - .05))).lerp(o * (R + .08) + Vector((0, 0, Htop + .15)), f)
        tube(P['steel'], [p - t * .2, p + t * .2], [.013, .013], 5, col=(.32, .33, .33, 1))
    # inlet: black HDPE pipe down the slope from the spring, over the rim, pouring into the tank
    o_in = Vector((math.cos(inlet_a), math.sin(inlet_a), 0)); ip = []
    for r in lsp(4.0, R + .25, 7):
        q = o_in * r + Vector((.25 * math.sin(r * 1.7), 0, 0)); ip.append(Vector((q.x, q.y, ground(q.x, q.y) + .05)))
    ip += [o_in * (R + .05) + Vector((0, 0, Htop + .12)), o_in * (Ri - .25) + Vector((0, 0, Htop + .14)), o_in * (Ri - .45) + Vector((0, 0, Htop - .02))]
    tube(P['rubber'], ip, [.03] * len(ip), 8, col=(.03, .03, .035, 1))
    for k in range(2):                                             # pipe clamps / stones holding it down
        q = ip[2 + k * 2]; mstone(P['stone'], (q.x + .1, q.y, q.z - .02), (.22, .18, .12), rng, col=(.6, .56, .5, 1), moss=.5, seg=6, rings=3)
    pour = o_in * (Ri - .47)
    tube(P['water'], [Vector((pour.x, pour.y, Htop - .03)), Vector((pour.x * 1.01, pour.y * 1.01, (Htop + WL) / 2)), Vector((pour.x * 1.02, pour.y * 1.02, WL))], [.022, .019, .024], 8)
    foam_patch(P['foam'], (pour.x, pour.y, WL + .006), rng, .45, .4, rng.random())
    # overflow pipe out of the downhill wall, stained run-off and a stone splash apron below
    o_ov = Vector((math.cos(over_a), math.sin(over_a), 0))
    lathe_axis(P['steel'], [(.04, -.2), (.04, .3), (.048, .3), (.048, .33), (.035, .33)], 10, (.5, .5, .48, 1), o_ov * (R - .05) + Vector((0, 0, 1.38)), o_ov)
    tube(P['water'], [o_ov * (R + .3) + Vector((0, 0, 1.37)), o_ov * (R + .42) + Vector((0, 0, 1.1)), o_ov * (R + .5) + Vector((0, 0, .6)), o_ov * (R + .52) + Vector((0, 0, ground(*(o_ov * (R + .52)).xy)))], [.012, .01, .009, .012], 6)
    for k in range(7):
        q = o_ov * (R + .45 + k * .18) + t * 0 + Vector((rng.uniform(-.15, .15), rng.uniform(-.1, .1), 0))
        mstone(P['stone'], (q.x, q.y, ground(q.x, q.y) + .03), (.26, .22, .1), rng, col=(.5, .48, .42, 1), moss=.8, seg=7, rings=3)
    # brass tap at the foot (front)
    tap_a = 1.35; ot = Vector((math.cos(tap_a), math.sin(tap_a), 0))
    lathe_axis(P['steel'], [(.025, 0), (.025, .16)], 8, (.55, .42, .18, 1), ot * (R + .02) + Vector((0, 0, .35)), ot)
    tube(P['steel'], [ot * (R + .17) + Vector((0, 0, .35)), ot * (R + .2) + Vector((0, 0, .35)), ot * (R + .22) + Vector((0, 0, .27))], [.02] * 3, 8, col=(.55, .42, .18, 1))
    cyl(P['plain'], ot * (R + .16) + Vector((0, 0, .41)), .03, .015, (0, 0, 1), (.55, .08, .06, 1), segs=8)
    # moss cushions, grass and ferns round the base
    for k in range(18):
        a = rng.uniform(0, TAU); r = R + rng.uniform(.08, .25); x, y = math.cos(a) * r, math.sin(a) * r
        superellipsoid(P['plain'], (x, y, ground(x, y) + .02), (rng.uniform(.15, .3), rng.uniform(.12, .25), .09), e=.6, seg=8, rings=4, col=tint(rng, MOSS, .2))
    for k in range(60):
        a = rng.uniform(0, TAU); r = R + rng.uniform(.25, 2.5); x, y = math.cos(a) * r, math.sin(a) * r
        if abs(a - ladder_a) < .25: continue
        tuft(P['grass'], (x, y, ground(x, y) - .02), rng, s=rng.uniform(.3, .55), n=6, flowers=rng.random() < .3)
    for k in range(5):
        a = rng.uniform(-2.8, -.4); r = R + rng.uniform(.25, .6); x, y = math.cos(a) * r, math.sin(a) * r
        fern(P['fern'], (x, y, ground(x, y) - .02), rng, s=rng.uniform(.5, .75))
    return group('hill_cistern', P, M)

# ───────────────────────────── 4. mountain stream ─────────────────────────────

def stream(seed=24, L=6.0):
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('gravel', 'lawn', 'stone', 'wetstone', 'water', 'foam', 'grass', 'fern')}
    # Built up on the ground (no terrain cut): banks ~0.35–0.45 m, bed just above 0, water surface at +0.18 m.
    WL = .18
    def y0(x): return .22 * math.sin(TAU * x / L) + .06 * math.sin(2 * TAU * x / L + 1)
    def wid(x): return .9 + .12 * pnoise(x, 0, L, .6, 4)
    def h(x, y):
        dy = y - y0(x); w = wid(x); a = abs(dy) / w
        if a < 1: z = .02 + .3 * ss((a - .5) / .5) + .03 * abs(pnoise(x, y, L, 2.5, 5))
        else: z = .32 + .1 * ss((a - 1) * 2.5) + .05 * pnoise(x, y, L, 1.5, 6) * ss((a - 1) * 3)
        return .012 + (z - .012) * (1 - ss((abs(y) - 1.4) / .8))
    xs = lsp(-L / 2, L / 2, 48); ys = lsp(-2.2, 2.2, 44)
    def is_bed(x, y): return abs(y - y0(x)) < wid(x) + .12
    heightfield(P['gravel'], xs, ys, h, 2.0, keep=is_bed, colfn=lambda x, y, z: mixc((1, 1, 1), (.55, .5, .42), ss((WL + .05 - z) / .25)))
    heightfield(P['lawn'], xs, ys, h, 2.0, keep=lambda x, y: not is_bed(x, y))
    heightfield(P['water'], lsp(-L / 2, L / 2, 24), lsp(-1.25, 1.25, 10), lambda x, y: WL + .012 * pnoise(x, y, L, 3, 7), 2.0)
    # boulders in the current (some break the surface → foam trail downstream, +x)
    for k, (x, dy, s) in enumerate([(-2.1, .25, (.75, .6, .55)), (-.7, -.35, (.55, .45, .42)), (.4, .3, (.45, .4, .5)), (1.6, -.15, (.85, .65, .6)), (2.4, .45, (.4, .35, .3))]):
        y = y0(x) + dy; z = h(x, y) + s[2] * .25
        mstone(P['wetstone'], (x, y, z), s, rng, col=(.55, .52, .48, 1), moss=.35, wet_below=WL + .03, seg=12, rings=7)
        if z + s[2] * .5 > WL + .05:
            foam_patch(P['foam'], (x + s[0] * .55, y, WL + .008), rng, s[0] * 1.3, s[1] * .9, rng.gauss(0, .1))
    for _ in range(40):                                            # pebbles and cobbles on the bed
        x = rng.uniform(-L / 2 + .2, L / 2 - .2); y = y0(x) + rng.uniform(-.8, .8) * wid(x); s = rng.uniform(.08, .22)
        mstone(P['wetstone'], (x, y, h(x, y) + s * .15), (s, s * .8, s * .5), rng, col=(.6, .55, .48, 1), wet_below=WL + .03, seg=6, rings=4, var=.2)
    for _ in range(22):                                            # wet stones at the water's edge, mossy bank stones above
        side = rng.choice((-1, 1)); x = rng.uniform(-L / 2 + .3, L / 2 - .3); y = y0(x) + side * wid(x) * rng.uniform(.8, 1.15); s = rng.uniform(.18, .42)
        mstone(P['wetstone'] if h(x, y) < WL + .12 else P['stone'], (x, y, h(x, y) + s * .12), (s, s * .8, s * .55), rng, col=(.6, .57, .52, 1), moss=.6, wet_below=WL + .05, seg=8, rings=5)
    for _ in range(36):
        side = rng.choice((-1, 1)); x = rng.uniform(-L / 2 + .2, L / 2 - .2); y = y0(x) + side * (wid(x) + rng.uniform(.1, 1.2))
        if abs(y) > 2.0: continue
        near = abs(y - y0(x)) < wid(x) + .3
        tuft(P['grass'], (x, y, h(x, y) - .02), rng, s=rng.uniform(.3, .6), n=6 if not near else 4, flowers=rng.random() < .15,
             hang=.5 if near else 0, out=(0, -side, 0) if near else None)
    for _ in range(7):
        side = rng.choice((-1, 1)); x = rng.uniform(-L / 2 + .4, L / 2 - .4); y = y0(x) + side * (wid(x) + rng.uniform(.2, .7))
        fern(P['fern'], (x, y, h(x, y) - .02), rng, s=rng.uniform(.55, .85), n=rng.randint(6, 9))
    return group('stream', P, M)

# ───────────────────────────── 5. wooden footbridge ─────────────────────────────

def wooden_bridge(seed=25, span=5.0):
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('stone', 'pole', 'wood', 'jute', 'grass')}
    hs = span / 2; zlog = .27
    for sy in (-1, 1):                                             # dry-stone abutments
        for k in range(9):
            x = rng.uniform(-.75, .75); y = sy * (hs - .1 + rng.uniform(-.25, .25)); s = rng.uniform(.3, .5)
            mstone(P['stone'], (x, y, s * .2), (s, s * .85, s * .55), rng, col=(.6, .56, .5, 1), moss=.5, seg=8, rings=5)
        for x in (-.42, .42):
            mstone(P['stone'], (x, sy * (hs - .05), .07), (.4, .38, .22), rng, col=(.58, .55, .5, 1), moss=.3, seg=8, rings=4)
        for _ in range(5): tuft(P['grass'], (rng.uniform(-.9, .9), sy * (hs + rng.uniform(.05, .4)), 0), rng, s=rng.uniform(.3, .5), n=6, flowers=rng.random() < .3)
    for x, r in ((-.42, .15), (0.0, .12), (.42, .15)):             # log stringers, slightly bowed
        pts = [Vector((x + rng.gauss(0, .015), y, zlog + .03 * (1 - (y / hs) ** 2) + (r - .15))) for y in lsp(-hs - .15, hs + .15, 8)]
        tube(P['pole'], pts, [r * (1.04 - .08 * i / 8) for i in range(9)], 9, v_scale=1 / (TAU * r * 4), cap=True)
        for end in (pts[0], pts[-1]):                              # sawn log ends
            ax = (pts[-1] - pts[0]).normalized() * (1 if end is pts[-1] else -1)
            lathe_axis(P['wood'], [(r * .98, 0), (.001, .002)], 9, (.85, .75, .6, 1), end, ax)
            lathe_axis(P['wood'], [(.001, .002), (r * .98, 0)], 9, (.85, .75, .6, 1), end, ax)
    n = 25; step = (span - .1) / n                                 # deck: hand-sawn planks across the logs, small gaps
    for k in range(n):
        y = -hs + .05 + step * (k + .5); z = zlog + .15 + .03 * (1 - (y / hs) ** 2) + .022
        plank(P['wood'], (rng.gauss(0, .03), y, z), rng.uniform(1.18, 1.3), step * rng.uniform(.84, .92), .045, rng, rz=rng.gauss(0, .025), bow=rng.uniform(-.012, .006), along='x')
    posts = lsp(-hs + .15, hs - .15, 4)
    for sx in (-1, 1):                                             # handrails: posts lashed to the outer logs, pole rail on top, rope below
        tops = []
        for y in posts:
            x = sx * .6; zb = zlog - .1; zt = 1.25 + (.08 if abs(y) > hs - .3 else 0)
            pole(P['pole'], rng, (x, y, zb), (x + rng.gauss(0, .01), y, zt), .048, 6, wob=.008, segs=3); tops.append(Vector((x, y, 1.12)))
            for zz in (zlog + .02, 1.12):
                ring = [Vector((x + math.cos(a) * .06, y + math.sin(a) * .06, zz + .012 * math.sin(a * 3))) for a in lsp(0, TAU, 12)]
                tube(P['jute'], ring, [.011] * len(ring), 5, v_scale=3)
        pole(P['pole'], rng, (sx * .63, -hs + .05, 1.16), (sx * .63, hs - .05, 1.16), .04, 6, wob=.012, segs=6)
        for a, b in zip(posts, posts[1:]):                         # sagging rope between posts at knee height
            rope = [Vector((sx * .62, a + (b - a) * t, .72 - .1 * math.sin(math.pi * t))) for t in lsp(0, 1, 8)]
            tube(P['jute'], rope, [.014] * len(rope), 6, v_scale=3)
        for y0_, y1_ in ((posts[0], posts[1]), (posts[-1], posts[-2])):   # diagonal braces at the ends
            pole(P['pole'], rng, (sx * .61, y0_, .45), (sx * .61, y0_ + (y1_ - y0_) * .55, 1.1), .03, 5, wob=.005, segs=2)
    return group('wooden_bridge', P, M)

# ───────────────────────────── 6. stone pond ─────────────────────────────

def stone_pond(seed=26, A=3.0, B=2.0):
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('soil', 'lawn', 'stone', 'water', 'plain', 'grass')}
    WL = .12                                                       # built up: earth rim to +0.22 m, bed just above 0
    def rr(a): return 1 + .05 * mnoise.noise(Vector((math.cos(a) * 2, math.sin(a) * 2, 8)))
    def zr(r):
        if r < .93: return .015 + .15 * ss((r - .55) / .38)
        if r < 1.02: return .165 + .055 * ss((r - .93) / .09)
        return .012 + .208 * (1 - ss((r - 1.02) / .4))
    rs = [.0001, .2, .4, .6, .75, .85, .92, .97, 1.02, 1.08, 1.16, 1.25, 1.35, 1.45]; asg = 56; cache = {}
    def gv(mb, i, j):
        key = (id(mb), i, j % asg)
        if key not in cache:
            a = TAU * (j % asg) / asg; r = rs[i] * rr(a)
            x, y = math.cos(a) * r * A, math.sin(a) * r * B
            cache[key] = mb.add((x, y, zr(rs[i]) + .012 * abs(mnoise.noise(Vector((x * 2, y * 2, 1)))) * (rs[i] < 1.4)), (x / 2, y / 2), mixc((1, 1, 1), (.55, .5, .45), ss((WL - zr(rs[i])) / .1)))
        return cache[key]
    for i in range(len(rs) - 1):
        mb = P['soil'] if rs[i] < 1.0 else P['lawn']
        for j in range(asg): mb.face((gv(mb, i, j), gv(mb, i + 1, j), gv(mb, i + 1, j + 1), gv(mb, i, j + 1)))
    s0 = len(P['water'].v); wr = []
    for i, r in enumerate((.0001, .5, .99)):
        wr.append([P['water'].add((math.cos(TAU * j / asg) * r * rr(TAU * j / asg) * A, math.sin(TAU * j / asg) * r * rr(TAU * j / asg) * B, WL), (math.cos(TAU * j / asg) * r * A / 2, math.sin(TAU * j / asg) * r * B / 2)) for j in range(asg)])
    for i in range(2):
        for j in range(asg): P['water'].face((wr[i][j], wr[i + 1][j], wr[i + 1][(j + 1) % asg], wr[i][(j + 1) % asg]))
    # rim: a ring of flat mossy stones with a few bigger ones behind
    nrim = 46
    for k in range(nrim):
        a = TAU * (k + rng.uniform(-.15, .15)) / nrim; r = 1.0 * rr(a)
        x, y = math.cos(a) * r * A, math.sin(a) * r * B
        tg = math.atan2(math.cos(a) * B, -math.sin(a) * A)
        s0 = len(P['stone'].v)
        mstone(P['stone'], (x, y, .24), (rng.uniform(.38, .5), rng.uniform(.3, .38), rng.uniform(.14, .2)), rng, col=(.62, .58, .53, 1), moss=.55, wet_below=WL + .06, seg=8, rings=4, rz=tg + rng.gauss(0, .15), amp=.18)
        if rng.random() < .3:
            r2 = 1.12 * rr(a); mstone(P['stone'], (math.cos(a) * r2 * A, math.sin(a) * r2 * B, zr(1.12) + .05), (rng.uniform(.3, .55),) * 2 + (rng.uniform(.2, .32),), rng, col=(.58, .55, .5, 1), moss=.7, seg=8, rings=5)
    # reeds + cattails in the shallows at the west end
    for _ in range(70):
        a = math.pi + rng.gauss(0, .32); r = rng.uniform(.72, .95); x, y = math.cos(a) * r * A, math.sin(a) * r * B
        d = (Vector((rng.gauss(0, .12), rng.gauss(0, .12), 1))).normalized(); Lr = rng.uniform(.8, 1.5)
        leaf(P['plain'], Vector((x, y, WL - .05)), d, Vector((rng.gauss(0, 1), rng.gauss(0, 1), 0)).normalized(), Lr, .035, (0, 0, 1, 1),
             tint(rng, rng.choice([(.24, .40, .10, 1), (.32, .45, .12, 1), (.45, .48, .20, 1)]), .1), lambda t: (1 - t) ** .5, segs=4, droop=rng.uniform(.05, .25), fold=.3, rng=rng)
    for _ in range(9):
        a = math.pi + rng.gauss(0, .25); r = rng.uniform(.75, .92); x, y = math.cos(a) * r * A, math.sin(a) * r * B
        top = Vector((x + rng.gauss(0, .05), y + rng.gauss(0, .05), WL + rng.uniform(1.1, 1.5)))
        tube(P['plain'], [Vector((x, y, WL - .05)), top], [.007, .005], 4, col=(.30, .40, .14, 1))
        ellipsoid(P['plain'], top - Vector((0, 0, .14)), UP, .09, .022, (.22, .12, .06, 1), 8, 4)
        tube(P['plain'], [top - Vector((0, 0, .05)), top + Vector((0, 0, .12))], [.003, .002], 3, col=(.35, .38, .18, 1))
    # lily pads (notched discs) and two water-lily flowers on the east half
    for k in range(11):
        a = rng.gauss(.2, .8); r = rng.uniform(.25, .8); x, y = math.cos(a) * r * A, math.sin(a) * r * B; pr = rng.uniform(.12, .22); rot = rng.random() * TAU
        lathe(P['plain'], [(pr, WL + .006), (.001, WL + .008)], 14, col=tint(rng, (.07, .17, .04, 1), .2), a0=rot + .3, a1=rot + TAU - .05, center=(x, y, 0))
        if k in (2, 6):
            for p in range(10):
                pa = p * TAU / 10 + (.3 if p >= 5 else 0)
                d = Vector((math.cos(pa), math.sin(pa), .9 if p >= 5 else .45)).normalized()
                leaf(P['plain'], Vector((x, y, WL + .02)), d, UP, .08 if p >= 5 else .1, .045, (0, 0, 1, 1), (.95, .78, .82, 1) if p < 5 else (.98, .9, .92, 1), lambda t: math.sin(math.pi * min(1, t * .9 + .1)), segs=2, droop=.0, fold=.2, rng=rng)
            ellipsoid(P['plain'], Vector((x, y, WL + .04)), UP, .015, .02, (.95, .75, .1, 1), 6, 3)
    for _ in range(40):
        a = rng.uniform(0, TAU); r = rng.uniform(1.08, 1.4) * rr(a); x, y = math.cos(a) * r * A, math.sin(a) * r * B
        tuft(P['grass'], (x, y, zr(r) - .02), rng, s=rng.uniform(.3, .55), n=6, flowers=rng.random() < .25)
    return group('stone_pond', P, M)

# ───────────────────────────── 7. stone steps ─────────────────────────────

def stone_steps(seed=27, rise=3.0, run=4.0, nsteps=14, half=1.0):
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('soil', 'lawn', 'stone', 'grass')}
    r_, t_ = rise / nsteps, run / nsteps
    def h(x, y):
        t = max(0.0, min(float(nsteps), -y / t_)); k = min(nsteps - 1, int(t)); f = t - k
        z = r_ * (k + ss(f / .22)) if t < nsteps else rise
        return z - .05 * (abs(x) < .72) + .02 * mnoise.noise(Vector((x * 3, y * 3, 2)))
    xs = sorted(set([round(v, 4) for v in lsp(-half, half, 12) + [-.72, -.66, .66, .72]])); ys = lsp(-run, 0, nsteps * 6)
    heightfield(P['soil'], xs, ys, h, 2.0, keep=lambda x, y: abs(x) < .72)
    heightfield(P['lawn'], xs, ys, h, 2.0, keep=lambda x, y: abs(x) >= .72)
    for sx in (-1, 1):
        skirt(P['soil'], [(sx * half, y, h(sx * half, y)) for y in ys], 0, (sx, 0, 0))
    skirt(P['soil'], [(x, -run, h(x, -run)) for x in xs], 0, (0, -1, 0))
    for k in range(nsteps):                                       # treads (1–2 flat stones each) + a riser stone in front
        y0 = -k * t_; ztop = (k + 1) * r_
        cut = rng.uniform(-.25, .25) if rng.random() < .7 else None
        pieces = [(-.66, cut), (cut, .66)] if cut is not None else [(-.66, .66)]
        for a, b in pieces:
            w = b - a
            mstone(P['stone'], ((a + b) / 2, y0 - t_ / 2 - .02, ztop - .06), (w * 1.0, t_ * 1.05, .16), rng, col=(.5, .48, .45, 1), moss=.25, seg=9, rings=5, var=.12, rz=rng.gauss(0, .04), amp=.1, e=.5)
        x = -.66
        while x < .64:
            w = min(rng.uniform(.3, .5), .68 - x)
            mstone(P['stone'], (x + w / 2, y0 - .06, k * r_ + r_ * .45), (w, .14, r_ * .95), rng, col=(.46, .44, .41, 1), moss=.4, seg=8, rings=4, rz=rng.gauss(0, .04), amp=.12, e=.55)
            x += w * .98
    for sx in (-1, 1):                                            # kerb stones along both edges
        for k in range(nsteps):
            y = -k * t_ - t_ * .5
            mstone(P['stone'], (sx * .8, y, h(sx * .8, y) + .04), (.2, t_ * 1.0, .16), rng, col=(.58, .55, .5, 1), moss=.7, seg=7, rings=4, rz=rng.gauss(0, .1), amp=.18)
    for k in range(nsteps):                                       # grass at tread joints and along the banks
        for _ in range(2):
            x = rng.choice((-1, 1)) * rng.uniform(.6, .75); y = -k * t_ - rng.uniform(.05, .25)
            tuft(P['grass'], (x, y, h(x, y)), rng, s=rng.uniform(.18, .3), n=4)
        x = rng.choice((-1, 1)) * rng.uniform(.85, .98); y = -k * t_ - rng.uniform(0, t_)
        tuft(P['grass'], (x, y, h(x, y) - .02), rng, s=rng.uniform(.3, .5), n=6, flowers=rng.random() < .3)
    return group('stone_steps', P, M)

# ───────────────────────────── 8. dirt ramp ─────────────────────────────

def dirt_ramp(seed=28, run=8.5, rise=3.0):
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('road', 'soil', 'stone', 'grass', 'lawn')}
    def zc(y): t = max(0.0, min(1.0, -y / run)); return rise * (t - .5 * math.sin(TAU * t) / TAU)
    def endfade(y):
        """0 at both ends → the surface is exactly z = 0 at the foot and z = rise at the tier top (clean joins)."""
        t = max(0.0, min(1.0, -y / run)); return ss(min(t, 1 - t) * run / 1.1)
    def ditch_depth(y): return min(.24 * endfade(y), zc(y))                                  # never cut below the ground (z = 0)
    def h(x, y):
        z0 = zc(y); e = endfade(y); z = 0.0
        if x < 1.52:
            z += .03 * (1 - (x / 1.5) ** 2)                                                       # crown
            for rx in (-.78, .72): z -= .085 * math.exp(-((x - rx) / .17) ** 2)                 # tyre ruts
            z += .015 * mnoise.noise(Vector((x * 2.5, y * 2.5, 1)))
            if x < -1.5: z -= .03 * ss((-1.5 - x) / .25)
            z *= e
        elif x < 2.08: return max(0.0, z0 - ditch_depth(y) * math.sin(math.pi * (x - 1.52) / .56) ** .8)   # drainage ditch
        else: z += (.03 + .015 * mnoise.noise(Vector((x * 3, y * 3, 2)))) * e
        return max(0.0, z0 + z)
    xs = sorted(set([round(v, 4) for v in lsp(-1.75, 1.52, 26) + lsp(1.52, 2.08, 6) + [2.25]])); ys = lsp(-run, 0, 60)
    heightfield(P['road'], xs, ys, h, 3.0, keep=lambda x, y: -1.62 < x < 1.52,
                colfn=lambda x, y, z: mixc((1, 1, 1), (.62, .55, .5), max(math.exp(-((x + .78) / .16) ** 2), math.exp(-((x - .72) / .16) ** 2))))
    heightfield(P['soil'], xs, ys, h, 2.0, keep=lambda x, y: 1.52 <= x < 2.08)
    heightfield(P['lawn'], xs, ys, h, 2.0, keep=lambda x, y: x >= 2.08 or x <= -1.62)
    skirt(P['soil'], [(-1.75, y, h(-1.75, y)) for y in ys], 0, (-1, 0, 0))
    skirt(P['soil'], [(2.25, y, h(2.25, y)) for y in ys], 0, (1, 0, 0))
    skirt(P['soil'], [(x, -run, h(x, -run)) for x in xs], 0, (0, -1, 0))
    for side, xw in ((0, 1.6), (1, 2.0)):                         # ditch lining stones down both banks + a few on the bottom
        y = 0
        while y > -run:
            w = rng.uniform(.2, .32)
            if ditch_depth(y - w / 2) < .08: y -= w; continue             # lining only where the ditch is cut
            mstone(P['stone'], (xw + rng.uniform(-.02, .02), y - w / 2, h(xw, y - w / 2) + .02), (.16, w, .16), rng, col=(.6, .56, .5, 1), moss=.4, seg=6, rings=4)
            y -= w * .95
    for _ in range(20):
        y = rng.uniform(-run + 1.2, -1.2); mstone(P['stone'], (1.8 + rng.uniform(-.06, .06), y, h(1.8, y) + .02), (.13, .15, .08), rng, col=(.5, .46, .4, 1), seg=6, rings=3)
    for _ in range(45):                                           # loose gravel on the track
        x = rng.uniform(-1.4, 1.4); y = rng.uniform(-run + .2, -.2); s = rng.uniform(.04, .09)
        mstone(P['stone'], (x, y, h(x, y) + .005), (s, s * .8, s * .5), rng, col=(.7, .62, .52, 1), seg=5, rings=3, var=.2)
    for _ in range(40):
        x = rng.choice((rng.uniform(-1.75, -1.52), rng.uniform(2.1, 2.25))); y = rng.uniform(-run + .2, -.15)
        tuft(P['grass'], (x, y, h(x, y) - .02), rng, s=rng.uniform(.25, .5), n=5, flowers=rng.random() < .25)
    for _ in range(14):                                           # grass in the centre strip between the ruts
        x = rng.uniform(-.25, .2); y = rng.uniform(-run + .3, -.3)
        tuft(P['grass'], (x, y, h(x, y) - .015), rng, s=rng.uniform(.12, .22), n=4)
    return group('dirt_ramp', P, M)

# ───────────────────────────── 9. cliff face ─────────────────────────────

def cliff_face(seed=29, Wd=6.0, Ht=4.0):
    """Face follows a plan path: straight along x (facing +y), then each end turns back into the hill through a quarter
    arc and a short return leg — the same layered / jointed basalt continues round the corners (no flat side caps)."""
    rng = random.Random(seed); M = ww_mats(); P = {k: MB() for k in ('basalt', 'lawn', 'grass', 'fern', 'plain')}
    Rw, back = 1.0, -2.6; a_ = Wd / 2 - Rw; arc = Rw * math.pi / 2; leg = -Rw - back; S = a_ + arc + leg
    def path(s):
        sg = 1 if s >= 0 else -1; t = abs(s)
        if t <= a_: return Vector((s, 0, 0)), Vector((0, 1, 0))
        if t <= a_ + arc:
            th = (t - a_) / Rw
            return Vector((sg * (a_ + Rw * math.sin(th)), -Rw + Rw * math.cos(th), 0)), Vector((sg * math.sin(th), math.cos(th), 0))
        return Vector((sg * (a_ + Rw), -Rw - (t - a_ - arc), 0)), Vector((sg, 0, 0))
    bounds = [0.0]
    while bounds[-1] < Ht - .3: bounds.append(bounds[-1] + rng.uniform(.38, .7))
    bounds[-1] = Ht
    setback = [-.13 * (bounds[i] + bounds[i + 1]) / 2 + rng.uniform(-.32, .3) for i in range(len(bounds) - 1)]
    def disp(s, z):
        """Offset along the outward normal: strata setbacks (ledges), noise, blocky jointing (stronger round the corners)."""
        zb = z + .12 * mnoise.noise(Vector((s * .35, 3, 0)))
        d = setback[0]
        for i in range(1, len(setback)): d += (setback[i] - setback[i - 1]) * ss((zb - bounds[i]) / .06 + .5)
        d += .06 * mnoise.noise(Vector((s * 1.3, z * 1.3, 5))) + .035 * mnoise.noise(Vector((s * 5, z * 5, 6)))
        li = sum(1 for b in bounds[1:-1] if zb > b)
        xc = s + .12 * mnoise.noise(Vector((z * .6, li * 1.7, 11))); ci = math.floor(xc / .52); u = xc / .52 - ci
        hb = random.Random(ci * 7919 + li * 104729 + seed); k = 1 + .8 * ss((abs(s) - a_ + .4) / .8)
        d += k * (hb.uniform(-.09, .09) + hb.uniform(-.07, .07) * (u - .5)) - .07 * math.exp(-(min(u, 1 - u) / .05) ** 2)
        return d
    def at(s, z, extra=0.0):
        p, n = path(s); return p + n * (disp(s, z) + extra) + Vector((0, 0, z)), n
    ns, nz = 106, 44; ss_ = lsp(-S, S, ns); zs = lsp(0, Ht, nz)
    G = [[at(s, z)[0] for z in zs] for s in ss_]
    idx = {}
    for i in range(ns + 1):
        for j in range(nz + 1):
            p = G[i][j]
            ts = G[min(ns, i + 1)][j] - G[max(0, i - 1)][j]; tz = G[i][min(nz, j + 1)] - G[i][max(0, j - 1)]
            nrm = tz.cross(ts).normalized()                                                      # outward
            o = mnoise.noise(Vector((ss_[i] * 2.5, p.z * 2.5, 9)))
            col = (.95, .93, .9, 1)
            col = mixc(col, MOSS, ss((nrm.z - .25) * 3) * ss(.3 + o * 1.5))
            col = mixc(col, (.35, .36, .30), ss((-nrm.z - .3) * 3) * .6)                        # shadowed overhang undersides
            col = mixc(col, (.38, .40, .34), ss(mnoise.noise(Vector((ss_[i] * 3, 1, 4))) * 2 - .3) * ss((p.z - .2) / 2) * .35)   # seep streaks
            idx[(i, j)] = P['basalt'].add(p, (ss_[i] / 2.5, p.z / 2.5), col)
    for i in range(ns):
        for j in range(nz): P['basalt'].face((idx[(i, j)], idx[(i, j + 1)], idx[(i + 1, j + 1)], idx[(i + 1, j)]))
    tops = []                                                                                    # grassy top, rounded lip, fanned to the spine
    for i in range(ns + 1):
        p = G[i][nz]; q = Vector((max(-a_, min(a_, p.x)), back, Ht)); row = []
        for k, f in enumerate((0, .06, .2, .45, .7, 1.0)):
            x, y = p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f
            z = Ht + .08 * math.sin(min(1, f * 4) * math.pi / 2) + .04 * mnoise.noise(Vector((x, y, 3)))
            row.append(P['lawn'].add((x, y, z), (x / 2, y / 2)))
        tops.append(row)
    for i in range(ns):
        for k in range(5): P['lawn'].face((tops[i][k], tops[i + 1][k], tops[i + 1][k + 1], tops[i][k + 1])[::-1])
    # hanging grass from ledges and the lip (all round, corners included), grass + ferns in corner cracks, scree
    for b in bounds[1:]:
        for _ in range(int(S * 3.2)):
            s = rng.uniform(-S + .5, S - .5); z = min(Ht, b + .04)
            p, n = at(s, z, -.06)
            tuft(P['grass'], (p.x, p.y, z + (.05 if b >= Ht else 0)), rng, s=rng.uniform(.45, .85), n=3, hang=rng.uniform(.85, 1.0), out=n, col=tint(rng, (.95, .95, .8, 1), .15))
    for _ in range(16):                                                                           # tufts in the corner joints
        s = rng.choice((-1, 1)) * rng.uniform(a_ - .3, S - .4); z = rng.uniform(.3, Ht - .3)
        p, n = at(s, z, -.08); tuft(P['grass'], p, rng, s=rng.uniform(.25, .45), n=4, hang=.4, out=n)
    for _ in range(14):
        x = rng.uniform(-a_, a_); y = rng.uniform(-.4, back + .3)
        tuft(P['grass'], (x, y, Ht + .02), rng, s=rng.uniform(.35, .6), n=6, flowers=rng.random() < .3)
    for k in range(6):
        s = rng.uniform(-2, 2) if k < 2 else rng.choice((-1, 1)) * rng.uniform(a_, a_ + arc + .6)
        b = rng.choice(bounds[1:-1]); p, n = at(s, b + .05, -.12); fern(P['fern'], (p.x, p.y, b), rng, s=.45, n=5)
    for _ in range(26):
        s_ = rng.uniform(-a_ - arc * .8, a_ + arc * .8); sz = rng.uniform(.12, .5)
        p, n = at(s_, 0, rng.uniform(.1, .9) * (1.2 - sz))
        stone(P['basalt'], (p.x, p.y, sz * .25), (sz, sz * .8, sz * .6), rng, col=tint(rng, (.8, .78, .74, 1), .12), seg=7, rings=4)
    for _ in range(8):
        s_ = rng.uniform(-a_, a_); p, n = at(s_, 0, rng.uniform(.3, 1.2)); tuft(P['grass'], (p.x, p.y, 0), rng, s=rng.uniform(.3, .5), n=6)
    return group('cliff_face', P, M)

# ───────────────────────────── 10. mist bank ─────────────────────────────

def mist_bank(seed=30):
    rng = random.Random(seed); M = ww_mats(); P = {'mist': MB()}
    def sheet(c, Lx, Ly, dome, rz=0.0, tilt=0.0, nx=10, ny=4):
        c = Vector(c); R = Matrix.Rotation(rz, 3, 'Z') @ Matrix.Rotation(tilt, 3, 'X'); g = []
        for i in range(nx + 1):
            row = []
            for j in range(ny + 1):
                u, v = i / nx, j / ny; x, y = (u - .5) * Lx, (v - .5) * Ly
                z = dome * (1 - (2 * u - 1) ** 2) * (1 - (2 * v - 1) ** 2) + .25 * mnoise.noise(Vector((x * .2, y * .2, c.z)))
                row.append(P['mist'].add(c + R @ Vector((x, y, z)), (u, v)))
            g.append(row)
        for i in range(nx):
            for j in range(ny): P['mist'].face((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]))
    sheet((0, 0, 1.2), 20, 8, 1.2)
    sheet((3, -1, 2.6), 14, 6, .9, rz=.15)
    sheet((-2.5, 1.2, .45), 16, 5, .5, rz=-.1)
    sheet((-4, -1.5, 3.4), 10, 4, .6, rz=.3)
    sheet((1, 2.2, 1.6), 18, 3.6, 0, tilt=1.15, ny=2)                        # leaning wisps so the bank reads from low angles too
    sheet((-1, -2.6, 2.2), 16, 3.2, 0, tilt=-1.2, rz=.1, ny=2)
    return group('mist_bank', P, M)

# ───────────────────────────── export ─────────────────────────────

WATERWORKS = {'irrigation_channel': irrigation_channel, 'drip_line': drip_line, 'hill_cistern': hill_cistern, 'stream': stream,
              'wooden_bridge': wooden_bridge, 'stone_pond': stone_pond, 'stone_steps': stone_steps, 'dirt_ramp': dirt_ramp,
              'cliff_face': cliff_face, 'mist_bank': mist_bank}
LABELS_VI = {'irrigation_channel': 'Mương dẫn nước', 'drip_line': 'Ống tưới nhỏ giọt', 'hill_cistern': 'Bể nước trên đồi', 'stream': 'Suối',
             'wooden_bridge': 'Cầu gỗ', 'stone_pond': 'Ao đá', 'stone_steps': 'Bậc đá', 'dirt_ramp': 'Dốc đất', 'cliff_face': 'Vách đá',
             'mist_bank': 'Sương mù'}

def export_waterworks(out_dir, only=None):
    for name, fn in WATERWORKS.items():
        if only and name not in only: continue
        purge(); root = fn()
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in root.children_recursive if o.type == 'MESH')
        print(f'waterworks {name}: {tris} tris')
        export_glb(root.name, os.path.join(out_dir, f'{name.replace("_", "-")}.glb'))

if __name__ == '__main__' and '--export' in sys.argv and not globals().get('_GEDEO_LIB'):
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    export_waterworks(sys.argv[sys.argv.index('--export') + 1], only)
