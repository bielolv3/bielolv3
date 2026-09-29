// Exporta a arte dos macacos gerada por código (src/fx/macacos.js) para conferência:
//   referencias/folha-macacos.png            folha de contato (todos os quadros, vistas f/c)
//   referencias/macacos/<nome>_<forma>.png   atlas usado no jogo (luz esq./dir. × vistas)
// Uso: node scripts/exportar-macacos.mjs [escala=3]
// Não precisa de build: serve a raiz do projeto e resolve 'three' por import map.
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(process.execPath, '../../lib/node_modules/playwright')); }

const escala = +(process.argv[2] ?? 3);
const raiz = path.resolve('.');
const pagina = `<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
<script type="module">
import { folhaDeContato, montarFolha } from '/src/fx/macacos.js';
window.pronto = (async () => {
  const out = { folha: folhaDeContato(${escala}).toDataURL() };
  for (const n of ['hugo', 'chico', 'orlando']) for (const f of ['normal', 'surto']) out[n + '_' + f] = montarFolha(n, f).canvas.toDataURL();
  return out;
})();
</script>`;
const tipos = { '.js': 'text/javascript', '.html': 'text/html' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(pagina); return; }
  fs.readFile(path.join(raiz, u), (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': tipos[path.extname(u)] || 'application/octet-stream' }); res.end(d);
  });
}).listen(0);
const nav = await pw.chromium.launch();
const pag = await nav.newPage();
pag.on('pageerror', (e) => console.error('erro:', e.message));
await pag.goto(`http://localhost:${srv.address().port}/`);
const imgs = await pag.evaluate(() => window.pronto);
fs.mkdirSync('referencias/macacos', { recursive: true });
for (const [k, url] of Object.entries(imgs)) {
  const arq = k === 'folha' ? 'referencias/folha-macacos.png' : `referencias/macacos/${k}.png`;
  fs.writeFileSync(arq, Buffer.from(url.split(',')[1], 'base64'));
  console.log('salvo', arq);
}
await nav.close(); srv.close();
