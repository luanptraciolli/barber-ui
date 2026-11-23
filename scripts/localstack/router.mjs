// Roteador mínimo no lugar do Kong do Supabase: /rest/v1 → PostgREST, /auth/v1 → GoTrue.
// Como o Kong, copia o `apikey` para Authorization quando não há Authorization.
import http from 'node:http'

const routes = [
  ['/rest/v1', 'http://127.0.0.1:3001'],
  ['/auth/v1', 'http://127.0.0.1:9999'],
]

http.createServer((req, res) => {
  const hit = routes.find(([p]) => req.url.startsWith(p))
  if (!hit) { res.writeHead(404).end(); return }
  const target = new URL(req.url.slice(hit[0].length) || '/', hit[1])
  const headers = { ...req.headers, host: target.host }
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`
  const up = http.request(target, { method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers)
    r.pipe(res)
  })
  up.on('error', (e) => { res.writeHead(502).end(String(e)) })
  req.pipe(up)
}).listen(54321, () => console.log('router :54321'))
