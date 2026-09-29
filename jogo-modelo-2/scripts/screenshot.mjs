// Uso: node scripts/screenshot.mjs [saida.png] [sala] [acoes-json]
// Sobe o build (dist/) num servidor local, abre no Chromium e tira screenshot.
// acoes: [["tecla","KeyD",600], ["espera",500], ["eval","jogo.carregarSala(1)"]]
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(process.execPath, '../../lib/node_modules/playwright')); }

const [saida = 'shot.png', sala = '0', acoesJson = '[]'] = process.argv.slice(2);
const raiz = path.resolve(process.env.DIST || 'dist');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const srv = http.createServer((req, res) => {
  let f = path.join(raiz, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const porta = srv.address().port;
const nav = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const erros = [];
pag.on('pageerror', (e) => erros.push(e.message));
pag.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erros.push(`[${m.type()}] ${m.text()}`); });
await pag.goto(`http://localhost:${porta}/index.html`);
await pag.waitForTimeout(1200);
if (sala !== '0') { await pag.evaluate((s) => window.jogo.carregarSala(+s), sala); await pag.waitForTimeout(600); }
for (const [tipo, a, b] of JSON.parse(acoesJson)) {
  if (tipo === 'tecla') { await pag.keyboard.down(a); await pag.waitForTimeout(b ?? 100); await pag.keyboard.up(a); }
  else if (tipo === 'espera') await pag.waitForTimeout(a);
  else if (tipo === 'eval') console.log('eval:', JSON.stringify(await pag.evaluate(a)));
}
await pag.waitForTimeout(300);
await pag.screenshot({ path: saida });
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros no console');
await nav.close(); srv.close();
