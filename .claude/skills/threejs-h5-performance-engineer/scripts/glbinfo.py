import json, struct, sys, os
tot = {'geo':0,'img':0}
for p in sys.argv[1:]:
    b = open(p,'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20+jl])
    imgs = j.get('images', []); bv = j.get('bufferViews', [])
    img_bytes = sum(bv[i['bufferView']]['byteLength'] for i in imgs if 'bufferView' in i)
    dims = []
    for i in imgs:
        v = bv[i['bufferView']]; off = 20 + jl + 8 + v.get('byteOffset', 0); d = b[off:off+32]
        if d[:4] == b'\x89PNG': dims.append('png%dx%d' % struct.unpack('>II', d[16:24]))
        elif d[:2] == b'\xff\xd8': dims.append('jpg')
        elif d[:4] == b'RIFF': dims.append('webp')
        else: dims.append(i.get('mimeType'))
    tris = 0
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            a = pr.get('indices'); tris += (j['accessors'][a]['count'] if a is not None else j['accessors'][pr['attributes']['POSITION']]['count']) // 3
    size = os.path.getsize(p); tot['img'] += img_bytes; tot['geo'] += size - img_bytes
    print(f"{p.split('models/')[1]:32} {size/1024:7.0f}KB img {img_bytes/1024:6.0f}KB tris {tris:7} meshes {len(j.get('meshes',[])):3} mats {len(j.get('materials',[])):3} anim {len(j.get('animations',[])):2} ext {j.get('extensionsUsed',[])} {sorted(set(dims))[:4]}")
print(f"TOTAL images {tot['img']/1048576:.1f}MB, geometry/other {tot['geo']/1048576:.1f}MB")
