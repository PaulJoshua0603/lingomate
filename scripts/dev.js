// Local dev server: serves the app and runs the api/ functions like Vercel does, without the Vercel CLI.
// Reads keys from .env.local (same variables as Vercel). Usage: npm run dev  → http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PORT = Number(process.env.PORT) || 5173;

// The small part of Vercel's req/res helpers the api/ functions use
function vercelRes(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  res.send = body => res.end(body);
  return res;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
      const file = join(root, 'api', `${name}.js`);
      if (!name || !existsSync(file)) return vercelRes(res).status(404).json({ error: 'Not found' });
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
      const { default: handler } = await import(pathToFileURL(file).href);
      return await handler(req, vercelRes(res));
    }
    const path = normalize(join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!path.startsWith(root) || /(^|[\\/])(api|scripts|node_modules|\.)/.test(path.slice(root.length))) { res.statusCode = 404; return res.end(); }
    const body = await readFile(path);
    res.setHeader('Content-Type', TYPES[extname(path)] || 'application/octet-stream');
    res.end(body);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(e);
    if (!res.headersSent) res.statusCode = e.code === 'ENOENT' ? 404 : 500;
    res.end();
  }
}).listen(PORT, () => console.log(`Lingomate running at http://localhost:${PORT}${existsSync(envFile) ? '' : '  (no .env.local: AI features stay offline)'}`));
