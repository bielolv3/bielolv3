// Playtest automático: um "bot" joga cada sala pelo jogo.input, com a física real,
// avançando o tempo com jogo.passo(1/60) (o Chromium headless é lento demais para tempo real).
// Uso: npx vite build --outDir /tmp/buildP && DIST=/tmp/buildP node scripts/playtest.mjs [salas] [modos]
//   salas: "1,2,7" (1-based; padrão todas)   modos: "luta,paz" (padrão os dois)
//   luta = inimigos ativos (o bot luta e se defende); paz = inimigos atordoados (só navegação)
// Cada rota é uma lista de ações (ver `executar` no bot):
//   {ir:[i,j]}                 anda até o centro do tile (pula sozinho degraus altos; {pular:true} pula vãos)
//   {m:'hugo'|'chico'|'orlando'} troca de macaco
//   {k:1, mira:[i,j]}  {l:1}  {j:1}  {f:1}   identidade / recurso / golpe / surto (mira vira para o tile)
//   {esperar:s}   {lutar:raio}  (luta até não restar inimigo no raio)   {chefe:1} (luta com o chefe)
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(process.execPath, '../../lib/node_modules/playwright')); }

// ---------------------------------------------------------------- rotas por sala
// coordenadas [i, j] = [coluna, linha] da grade da sala
export const ROTAS = {
  1: [
    { ir: [4, 5] }, { lutar: 6 },
    { ir: [8, 3] }, { ir: [9, 3] }, { ir: [10, 2] },
    { ir: [6, 9] }, { ir: [6, 11] }, { ir: [6, 12] },
  ],
  2: [
    { m: 'chico' }, { ir: [5, 7] }, { ir: [4, 7] }, { ir: [3, 6] },
    { ir: [6, 6] }, { ir: [9, 6] }, { ir: [11, 5] }, { ir: [14, 5], pular: true },
    { lutar: 5 }, { ir: [15, 6] }, { ir: [15, 10] }, { ir: [15, 11] },
  ],
  3: [
    { m: 'orlando' }, { ir: [9, 13] }, { lutar: 5 }, { ir: [15, 14] }, { k: 1, mira: [17, 14] },
    { ir: [5, 10] }, { ir: [5, 8] }, { ir: [3, 7] }, { ir: [3, 2] }, { ir: [5, 2] },
    { ir: [13, 2], pular: true }, { ir: [16, 1] }, { ir: [14, 3] },
  ],
  4: [
    { ir: [3, 5] }, { k: 1 }, { ir: [3, 7] }, { lutar: 6 }, { ir: [6, 11] }, { k: 1 }, { ir: [6, 13] },
    { ir: [6, 10] }, { lutar: 6 }, { ir: [11, 7] }, { k: 1 }, { ir: [11, 5] }, { ir: [12, 2] },
  ],
  5: [
    { ir: [5, 5] }, { ir: [8, 5] }, { lutar: 6 }, { ir: [12, 6] }, { lutar: 7 }, { ir: [14, 4] }, { lutar: 4 },
    { m: 'orlando' }, { ir: [15, 3] }, { k: 1, mira: [15, 1] }, { ir: [17, 4] }, { ir: [19, 2] },
  ],
  // teste negativo: o Chico não deveria passar por cima do selo
  '4-chico': [{ m: 'chico' }, { ir: [3, 4] }, { ir: [3, 8] }],
};

// ---------------------------------------------------------------- bot (roda na página)
function instalarBot() {
  const jogo = window.jogo;
  const input = jogo.input;
  if (!jogo.__passoReal) {
    jogo.__passoReal = jogo.passo.bind(jogo);
    jogo.passo = () => {};   // o laço do navegador só desenha; quem avança o tempo é o bot
  }
  const DT = 1 / 60;
  const V = (x, z) => ({ x, z });
  const centro = ([i, j]) => V(i + 0.5, j + 0.5);
  const tipoDe = (e) => !e ? 'queda' : e.ehChefe ? 'andador' : e.investida !== undefined ? 'bruto' : e.pontoPatrulha ? 'guardiao'
    : e.viu !== undefined ? 'vigia' : e.recargaTele !== undefined ? 'acolito' : e.anelRaio ? 'torre' : e.canal !== undefined ? 'construtor'
    : e.pesado ? 'sentinela' : e.autor ? tipoDe(e.autor) + (e.raioMax !== undefined ? '~onda' : '~tiro') : '?';
  const inimigos = () => jogo.entidades.filter((e) => e.time === 'inimigo' && !e.removido);

  function eixoPara(wx, wz) {
    const a = jogo.camera.anguloAtual;
    const fx = -Math.cos(a), fz = -Math.sin(a), rx = -fz, rz = fx;
    return { x: wx * rx + wz * rz, y: wx * fx + wz * fz };
  }

  async function rodar(indice, rota, modo) {
    jogo.jogador = null;
    jogo.habilidades.recursos.bananas = jogo.habilidades.recursos.bananasMax;
    jogo.carregarSala(indice);
    jogo.ui?.irPara?.('jogando');
    const sala = jogo.mapa.sala;
    const R = { sala: sala.id, modo, ok: false, tempo: 0, dano: 0, quedas: 0, mortes: 0, log: [], dicas: [], fontes: {}, inimigosVivos: 0, inimigosTotal: 0 };
    const paz = modo === 'paz';
    R.inimigosTotal = inimigos().length;
    const offs = [];
    offs.push(jogo.eventos.on('dano', ({ alvo, qtd, origem }) => {
      if (alvo !== jogo.jogador) return;
      R.dano += qtd;
      if (!origem) R.quedas++;
      const k = tipoDe(origem); R.fontes[k] = (R.fontes[k] ?? 0) + qtd;
    }));
    let memorias = 0;
    const totalMem = jogo.mapa.coisas.filter((c) => c.letra === 'M').length;
    offs.push(jogo.eventos.on('coleta', ({ tipo }) => { if (tipo === 'memoria') memorias++; }));
    let morreu = false;
    offs.push(jogo.eventos.on('derrota', () => { morreu = true; }));
    const dicasVistas = new Set();
    let t = 0, saiu = false;
    const segurar = new Set();
    let eixo = { x: 0, y: 0 };
    let apertar = [];

    function passo() {
      if (paz) for (const e of inimigos()) e.atordoado = 1e9;
      for (const a of ['cima', 'baixo', 'esq', 'dir']) input.soltar(a);
      for (const a of ['pulo', 'identidade', 'recurso', 'golpe', 'surto', 'hugo', 'chico', 'orlando']) {
        if (apertar.includes(a) || segurar.has(a)) input.pressionar(a); else input.soltar(a);
      }
      apertar = [];
      input.eixoToque = eixo;
      jogo.pausado = false;
      jogo.__passoReal(DT);
      t += DT;
      const j = jogo.jogador;
      for (const d of sala.dicas ?? []) if (d.em && Math.hypot(j.pos.x - d.em[0] - .5, j.pos.z - d.em[1] - .5) < (d.raio ?? 2.5)) dicasVistas.add(d.texto);
      if (morreu) {
        R.mortes++; morreu = false;
        R.log.push(`morreu em t=${t.toFixed(1)} (${j.pos.x.toFixed(1)},${j.pos.z.toFixed(1)})`);
        j.vida = j.vidaMax; j.removido = false;
        jogo.ui?.irPara?.('jogando');
      }
      if (jogo._trocando) saiu = true;
    }

    // ---- camada de defesa (vale durante qualquer ação, com inimigos ativos)
    function defesa(j) {
      if (paz) return false;
      // ondas de choque: pular quando a frente estiver chegando
      for (const e of jogo.entidades) {
        if (e.removido || !e.dano || e.raioMax === undefined || e.alvo !== 'jogador' || e.atingidos?.has(j)) continue;
        const r = e.raioMax * Math.min(1, e.t / e.duracao), vel = e.raioMax / e.duracao;
        const d = j.distancia(e);
        if (d > r && d - r < vel * 0.12 + 0.35 && d <= e.raioMax + 0.5 && j.noChao) { apertar.push('pulo'); return true; }
      }
      // tiros: Hugo apara com a Guarda; os outros ignoram (o golpe corta a maioria)
      if (j.atual === 'hugo' && j.noChao) {
        for (const e of jogo.entidades) {
          if (e.removido || e.alvo !== 'jogador' || !e.vel || e.raioMax !== undefined) continue;
          const dx = j.pos.x - e.pos.x, dz = j.pos.z - e.pos.z, d = Math.hypot(dx, dz);
          const aprox = (dx * e.vel.x + dz * e.vel.z) / (d || 1);
          if (d < 1.1 && aprox > 3) { segurar.add('recurso'); return 'guarda'; }
        }
      }
      segurar.delete('recurso');
      return false;
    }

    // ---- locomoção: anda até alvo; pula o que precisar
    function andar(j, alvo, opts = {}) {
      const dx = alvo.x - j.pos.x, dz = alvo.z - j.pos.z, d = Math.hypot(dx, dz);
      if (d < (opts.tol ?? 0.2)) { eixo = { x: 0, y: 0 }; return true; }
      const ux = dx / d, uz = dz / d;
      const mag = d < 0.5 ? Math.max(0.35, d / 0.5) : 1;
      eixo = eixoPara(ux * mag, uz * mag);
      const mapa = jogo.mapa;
      const ax = j.pos.x + ux * 0.42, az = j.pos.z + uz * 0.42;
      const hFrente = mapa.alturaEm(ax, az), vazioFrente = mapa.vazioEm(ax, az);
      const hAlvo = mapa.vazioEm(alvo.x, alvo.z) ? -9 : mapa.alturaEm(alvo.x, alvo.z);
      if (j.noChao) {
        if (hFrente > j.pos.y + 0.5 && hFrente < j.pos.y + 2.7 && !vazioFrente) apertar.push('pulo');
        else if (vazioFrente && opts.pular !== false && (opts.pular || hAlvo > j.pos.y - 3)) {
          const bx = j.pos.x + ux * 0.28, bz = j.pos.z + uz * 0.28;
          if (mapa.vazioEm(bx, bz) || opts.pular) apertar.push('pulo');
        }
      } else {
        // Chico: segundo pulo quando começa a cair e ainda precisa de altura/distância
        if (j.pulosRestantes > 0 && j.vel.y < 0.8) {
          const precisa = hFrente > j.pos.y + 0.3 || vazioFrente || mapa.vazioEm(j.pos.x, j.pos.z) || hAlvo > j.pos.y + 0.2;
          if (precisa && !opts.semDuplo) { segurar.delete('pulo'); apertar.push('pulo'); }
        }
        // Orlando plana sempre que estiver caindo (só atrasa a queda)
        if (j.atual === 'orlando' && opts.planar !== false) segurar.add('pulo');
      }
      if (j.noChao) segurar.delete('pulo');
      return false;
    }

    function olhar(j, alvo) {
      const dx = alvo.x - j.pos.x, dz = alvo.z - j.pos.z, d = Math.hypot(dx, dz) || 1;
      j.olhando.set(dx / d, 0, dz / d);
    }

    // ---- ataque: escolhe o inimigo mais próximo e bate; foge do telegrafado
    function atacar(j, alvo) {
      const d = j.distancia(alvo), s = j.stats;
      const alcance = s.alcance * 0.7 + alvo.raio + 0.25;
      const perigo = alvo.preparo > 0 && !alvo.voa && (alvo.pontoPatrulha || alvo.investida !== undefined);
      if (j.surto.carga >= 1 && j.surto.ativo <= 0 && d < 4) apertar.push('surto');
      if (alvo.ehChefe) return atacarChefe(j, alvo);
      if (alvo.investida !== undefined && (alvo.preparo > 0 || alvo.investida > 0)) {
        // sai da linha da investida
        const dx = j.pos.x - alvo.pos.x, dz = j.pos.z - alvo.pos.z, n = Math.hypot(dx, dz) || 1;
        return andar(j, V(j.pos.x - dz / n * 2, j.pos.z + dx / n * 2), { pular: false }), undefined;
      }
      if (j.atual === 'hugo' && d < 2.2 && j.recarga.identidade <= 0 && j.noChao && alvo.atordoado <= 0.2) {
        olhar(j, alvo.pos); apertar.push('identidade'); eixo = { x: 0, y: 0 }; return;
      }
      if (j.atual === 'chico' && d > 2 && d < 6 && jogo.habilidades.recursos.bananas > 0 && j.recarga.identidade <= 0 && alvo.atordoado <= 0 && !alvo.voa) {
        olhar(j, alvo.pos); apertar.push('identidade'); eixo = { x: 0, y: 0 }; return;
      }
      if (perigo && d < alcance + 0.6 && alvo.preparo > 0.12) {
        // recua do golpe telegrafado
        const dx = j.pos.x - alvo.pos.x, dz = j.pos.z - alvo.pos.z, n = Math.hypot(dx, dz) || 1;
        andar(j, V(j.pos.x + dx / n, j.pos.z + dz / n), { pular: false });
        return;
      }
      if (d > alcance - 0.15) { andar(j, alvo.pos, { pular: false, tol: 0 }); return; }
      eixo = { x: 0, y: 0 };
      olhar(j, alvo.pos);
      if (j.recarga.golpe <= 0) apertar.push('golpe');
    }

    function atacarChefe(j, w) {
      const d = j.distancia(w);
      const est = w.estado;
      // pisão marcado: sai do círculo
      if (est === 'pisaoPrep' || est === 'pisaoAr') {
        const dx = j.pos.x - w.alvoPisao.x, dz = j.pos.z - w.alvoPisao.z, n = Math.hypot(dx, dz) || 1;
        if (n < 3.2) { andar(j, V(w.alvoPisao.x + dx / n * 3.6, w.alvoPisao.z + dz / n * 3.6), { pular: false, tol: 0 }); return; }
        eixo = { x: 0, y: 0 }; return;
      }
      // rajada: anda de lado
      if (est === 'rajadaPrep' || est === 'rajada') {
        const dx = j.pos.x - w.pos.x, dz = j.pos.z - w.pos.z, n = Math.hypot(dx, dz) || 1;
        if (j.atual === 'hugo' && n < 5) { eixo = { x: 0, y: 0 }; return; }   // Guarda cuida
        andar(j, V(j.pos.x - dz / n * 1.5, j.pos.z + dx / n * 1.5), { pular: false, tol: 0 });
        return;
      }
      // selos intactos: Hugo quebra (ele se esconde atrás deles)
      const selo = j.atual === 'hugo' && jogo.entidades.filter((e) => e.ehSelo && !e.quebrado).sort((a, b) => j.distancia(a) - j.distancia(b))[0];
      if (selo && j.distancia(selo) < 7 && est === 'reposicionar' && d > 2.5) {
        if (j.distancia(selo) < 1.4 && j.recarga.identidade <= 0 && j.noChao) { apertar.push('identidade'); eixo = { x: 0, y: 0 }; return; }
        andar(j, selo.pos, { pular: false, tol: 1.1 }); return;
      }
      const alcance = j.stats.alcance * 0.7 + w.raio + 0.2;
      if (j.atual === 'hugo' && d < 2.8 && j.recarga.identidade <= 0 && j.noChao && est === 'reposicionar') { olhar(j, w.pos); apertar.push('identidade'); eixo = { x: 0, y: 0 }; return; }
      if (d > alcance - 0.1) { andar(j, w.pos, { pular: false, tol: 0 }); return; }
      eixo = { x: 0, y: 0 }; olhar(j, w.pos);
      if (j.recarga.golpe <= 0) apertar.push('golpe');
    }

    // ---- executa a rota
    const LIMITE = 40;
    for (let n = 0; n < rota.length && !saiu; n++) {
      const a = rota[n];
      if (a.so && a.so !== modo) continue;
      let ta = 0, ok = false;
      const alvo = a.ir ? V(a.ir[0] + 0.5 + (a.dx ?? 0), a.ir[1] + 0.5 + (a.dz ?? 0)) : null;
      const limite = a.limite ?? (a.chefe ? 180 : LIMITE);
      let fase = 0;
      while (ta < limite && !saiu) {
        const j = jogo.jogador;
        eixo = { x: 0, y: 0 };
        const def = defesa(j);
        if (a.ir) {
          if (def === 'guarda') eixo = { x: 0, y: 0 };
          else if (andar(j, alvo, a) && j.noChao) ok = true;
        } else if (a.m) {
          if (fase === 0) { apertar.push(a.m); fase = 1; } else if (j.atual === a.m) ok = true;
          else if (ta > 0.5) { apertar.push(a.m); }
        } else if (a.k || a.l || a.j || a.f) {
          if (a.mira) olhar(j, centro(a.mira));
          if (fase === 0) { apertar.push(a.k ? 'identidade' : a.l ? 'recurso' : a.j ? 'golpe' : 'surto'); fase = 1; }
          else if (ta > (a.duracao ?? 0.6)) ok = true;
        } else if (a.esperar !== undefined) {
          if (ta >= a.esperar) ok = true;
        } else if (a.lutar !== undefined || a.chefe) {
          const raio = a.lutar ?? 99;
          const alvos = inimigos().filter((e) => j.distancia(e) < raio)
            .sort((p, q) => (q.ehChefe ? 1 : 0) - (p.ehChefe ? 1 : 0) || j.distancia(p) - j.distancia(q));
          if (paz || !alvos.length) ok = true;
          else if (def !== 'guarda') atacar(j, a.chefe ? (alvos.find((e) => e.ehChefe) ?? alvos[0]) : alvos[0]);
        } else if (a.matarChefe) {
          for (const e of inimigos()) if (e.ehChefe) { e.invulneravel = 0; e.receberDano(999, j); }
          ok = true;
        } else ok = true;
        if (ok) break;
        passo();
        ta += DT;
        if ((Math.round(t / DT) % 600) === 0) await new Promise((r) => setTimeout(r, 0));
      }
      if (!ok && !saiu) {
        const j = jogo.jogador;
        R.log.push(`FALHOU passo ${n} ${JSON.stringify(a)} em (${j.pos.x.toFixed(2)},${j.pos.y.toFixed(2)},${j.pos.z.toFixed(2)}) ${j.atual}`);
        break;
      }
    }
    segurar.clear(); eixo = { x: 0, y: 0 };
    offs.forEach((f) => f());
    R.ok = saiu;
    R.tempo = +t.toFixed(1);
    R.dano = +R.dano.toFixed(1);
    R.inimigosVivos = inimigos().length;
    R.vidaFinal = jogo.jogador.vida;
    R.memorias = `${memorias}/${totalMem}`;
    R.dicas = (sala.dicas ?? []).filter((d) => d.em).map((d) => (dicasVistas.has(d.texto) ? '+' : '-') + d.texto.slice(0, 28));
    const j = jogo.jogador;
    R.fim = `(${j.pos.x.toFixed(1)},${j.pos.z.toFixed(1)})`;
    // espera a troca de sala acontecer para não vazar para o próximo teste
    await new Promise((r) => setTimeout(r, 20));
    return R;
  }
  window.__bot = { rodar };
}

// ---------------------------------------------------------------- servidor + navegador
const raiz = path.resolve(process.env.DIST || 'dist');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const srv = http.createServer((req, res) => {
  let f = path.join(raiz, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const nav = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pag = await nav.newPage({ viewport: { width: 480, height: 270 } });
const erros = [];
pag.on('pageerror', (e) => erros.push(e.message));
pag.on('console', (m) => { if (m.type() === 'error') erros.push(`[console] ${m.text()}`); });
await pag.goto(`http://localhost:${srv.address().port}/index.html`);
await pag.waitForTimeout(1500);
await pag.evaluate(`(${instalarBot.toString()})()`);

const [salasArg, modosArg = 'luta,paz'] = process.argv.slice(2);
const total = await pag.evaluate(() => window.jogo && (window.jogo.indiceSala, 99));
const salas = salasArg ? salasArg.split(',') : Object.keys(ROTAS).filter((k) => /^\d+$/.test(k));
const modos = modosArg.split(',');
const repeticoes = +(process.env.REPETIR || 1);
let falhas = 0;
for (const s of salas) {
  if (!ROTAS[s]) { console.log(`sala ${s}: sem rota`); continue; }
  for (const modo of modos) {
    for (let r = 0; r < repeticoes; r++) {
      const R = await pag.evaluate(({ s, rota, modo }) => window.__bot.rodar(parseInt(s) - 1, rota, modo), { s, rota: ROTAS[s], modo });
      if (!R.ok) falhas++;
      console.log(`${R.ok ? 'OK  ' : 'FALHA'} sala${String(s).padStart(2, '0').padEnd(8)} ${modo.padEnd(4)} t=${String(R.tempo).padStart(5)}s dano=${R.dano} quedas=${R.quedas} mortes=${R.mortes} vida=${R.vidaFinal} mem=${R.memorias} inimigos ${R.inimigosVivos}/${R.inimigosTotal} fim=${R.fim}`);
      if (R.dano) console.log('      dano por fonte: ' + JSON.stringify(R.fontes));
      for (const l of R.log) console.log('      ' + l);
      if (r === 0 && modo === modos[0]) console.log('      dicas: ' + R.dicas.join(' | '));
    }
  }
}
if (erros.length) console.log('ERROS NA PÁGINA:\n' + [...new Set(erros)].slice(0, 10).join('\n'));
void total;
await nav.close(); srv.close();
process.exit(falhas ? 1 : 0);
