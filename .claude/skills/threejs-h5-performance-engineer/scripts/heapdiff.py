import json, sys, collections
def load(p):
    d = json.load(open(p)); m = d['snapshot']['meta']; f = m['node_fields']; n = len(f)
    ti, ni, si = f.index('type'), f.index('name'), f.index('self_size')
    types = m['node_types'][0]; s = d['strings']; nodes = d['nodes']
    cnt = collections.Counter(); size = collections.Counter(); total = 0
    for i in range(0, len(nodes), n):
        t = types[nodes[i+ti]]; sz = nodes[i+si]; total += sz
        key = s[nodes[i+ni]] if t in ('object', 'native') else '(' + t + ')'
        if key.startswith('Detached'): key = 'Detached*'
        cnt[key] += 1; size[key] += sz
    return total, cnt, size
ta, ca, sa = load(sys.argv[1]); tb, cb, sb = load(sys.argv[2])
print(f'total A={ta/1048576:.1f}MB B={tb/1048576:.1f}MB diff={(tb-ta)/1048576:+.2f}MB')
keys = set(ca) | set(cb)
for k in sorted(keys, key=lambda k: -(sb[k]-sa[k]))[:15]: print(f'{k[:40]:40} count {ca[k]:>7}->{cb[k]:<7} size {(sb[k]-sa[k])/1024:+9.1f}KB')
for k in ['Mesh','BufferGeometry','BufferAttribute','MeshStandardMaterial','Texture','CanvasTexture','Object3D','Group','SkinnedMesh','AnimationMixer','Detached*','HTMLCanvasElement']:
    print(f'  {k:22} {ca[k]:>6} -> {cb[k]}')
