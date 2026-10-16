// Serve ./dist on a local port (used by the PDF step and screenshots).
import path from 'node:path';
export function serveDist(port = 8787, dir = path.resolve(import.meta.dir, '..', 'dist')) {
  return Bun.serve({ port, async fetch(req) {
    let p = decodeURIComponent(new URL(req.url).pathname); if (p.endsWith('/')) p += 'index.html';
    const f = Bun.file(path.join(dir, p)); return (await f.exists()) ? new Response(f, { headers: { 'access-control-allow-origin': '*' } }) : new Response('not found', { status: 404 }); // CORS like GitHub Pages
  } });
}
if (import.meta.main) { const s = serveDist(Number(process.env.PORT ?? 8787)); console.log(`http://localhost:${s.port}/`); }
