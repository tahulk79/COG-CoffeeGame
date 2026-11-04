// CDP daemon: holds one page session; HTTP POST /  {method,params} -> result. POST /eval {expr} -> value.
import http from 'node:http';
const port = process.argv[2] || 9333;
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const events = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) { if (d.method === 'Runtime.consoleAPICalled' || d.method === 'Runtime.exceptionThrown' || d.method==='Log.entryAdded') events.push({t:Date.now(), m:d.method, p: JSON.stringify(d.params).slice(0,600)}); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const j = body ? JSON.parse(body) : {};
  let out;
  if (req.url === '/console') out = events.splice(0);
  else if (req.url === '/eval') { const r = await send('Runtime.evaluate', { expression: j.expr, awaitPromise: true, returnByValue: true }); out = r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text } : r.result?.result?.value; }
  else if (req.url === '/shot') { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); (await import('node:fs')).writeFileSync(j.path, Buffer.from(r.result.data, 'base64')); out = 'ok'; }
  else out = (await send(j.method, j.params)).result ?? 'err';
  res.end(JSON.stringify(out));
}).listen(9334, () => console.log('ready'));
