# Top self-time JS functions from a Chrome trace (performance_stop_trace filePath). Usage: tracetop.py trace.json [startSec endSec]
import json, sys, collections
ev = json.load(open(sys.argv[1])); ev = ev['traceEvents'] if isinstance(ev, dict) else ev
nodes, self_us, samples = {}, collections.Counter(), []
for e in ev:
    if e.get('name') not in ('Profile', 'ProfileChunk'): continue
    d = e['args']['data']; c = d.get('cpuProfile', {})
    for n in c.get('nodes', []):
        f = n['callFrame']; nodes[n['id']] = f"{f.get('functionName') or '(anon)'} {f.get('url','').split('/')[-1].split('?')[0]}:{f.get('lineNumber',-1)+1}"
    samples += list(zip(c.get('samples', []), d.get('timeDeltas', [])))
t, lo, hi = 0, (float(sys.argv[2]) * 1e6 if len(sys.argv) > 3 else 0), (float(sys.argv[3]) * 1e6 if len(sys.argv) > 3 else 1e18)
for s, dt in samples:
    t += dt
    if lo <= t <= hi: self_us[nodes.get(s, '?')] += dt
total = sum(self_us.values()) or 1
for k, v in self_us.most_common(25): print(f'{v/1000:8.1f}ms {v/total*100:5.1f}%  {k}')
