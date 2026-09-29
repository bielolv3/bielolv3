// Valida as salas: grade retangular, 1 'P', >=1 'X', letras conhecidas e
// caminho do P até um X (BFS por tile) com a física aproximada dos três macacos.
// Uso: npm run check
import { SALAS } from '../src/levels/index.js';
import { TIPOS_CHAO, LEGENDA_COISAS } from '../src/world/tiles.js';

// letras que a Frente A vai registrar (aceitas mesmo antes de entrarem na legenda)
const LETRAS_FUTURAS = { V: 'drone vigia', K: 'drone construtor', W: 'andador' };

// números iguais a src/entities/jogador.js e src/world/fisica.js
const GRAVIDADE = 28, DEGRAU = 0.55;
const MACACOS = {
  hugo:    { velocidade: 3.6, pulo: 7.5, pulosNoAr: 0 },
  chico:   { velocidade: 5.0, pulo: 8.0, pulosNoAr: 1 },
  orlando: { velocidade: 4.2, pulo: 7.5, pulosNoAr: 0, planeio: true },
};
const FOLGA = 0.8; // usa só 80% do alcance horizontal teórico (margem de erro do jogador)

// simula o salto quadro a quadro, na mesma ordem do jogador.js + fisica.js
// (planeio fixa vy = -1.5 antes da gravidade, então o afundar depende do quadro:
// simulamos a 30 qps, o caso pessimista)
function trajetoria(m) {
  const pts = [];
  let y = 0, vy = m.pulo, t = 0, noAr = m.pulosNoAr;
  const dt = 1 / 30;
  while (y > -4 && t < 4) {
    if (noAr > 0 && vy <= 0) { vy = m.pulo * 0.9; noAr--; }  // segundo pulo no ápice
    if (m.planeio && vy < -1.5) vy = -1.5;
    vy -= GRAVIDADE * dt;
    y += vy * dt; t += dt;
    pts.push({ x: m.velocidade * t * FOLGA, y });
  }
  return pts;
}
const TRAJ = Object.fromEntries(Object.entries(MACACOS).map(([n, m]) => [n, trajetoria(m)]));

// o macaco `n` salta de um tile e alcança um tile a `vao` tiles vazios de distância
// com diferença de altura `dh` (positivo = mais alto)?
function alcanca(n, vao, dh) {
  // precisa passar da borda (vao + 0.25) com o pé até MARGEM abaixo do topo
  // (a física aceita até DEGRAU = 0.55; usamos só 0.3 de folga)
  const MARGEM = 0.3, alvoX = vao + 0.25;
  if (vao === 0) return TRAJ[n].some((p) => p.y >= dh - MARGEM);
  return TRAJ[n].some((p) => p.x >= alvoX && p.y >= dh - MARGEM);
}

const erros = [];
const avisos = [];
const conhecidas = new Set([...Object.keys(LEGENDA_COISAS), ...Object.keys(LETRAS_FUTURAS)]);

function checar(sala, idx) {
  const nome = `${sala.id ?? '?'} (${idx})`;
  const err = (m) => erros.push(`${nome}: ${m}`);
  const { chao, coisas = [] } = sala;
  if (!Array.isArray(chao) || !chao.length) return err('sem chao');
  const larg = chao[0].length, alt = chao.length;
  chao.forEach((l, j) => { if (l.length !== larg) err(`chao linha ${j} tem ${l.length} (esperado ${larg})`); });
  if (coisas.length !== alt) err(`coisas tem ${coisas.length} linhas (chao tem ${alt})`);
  coisas.forEach((l, j) => { if (l.length !== larg) err(`coisas linha ${j} tem ${l.length} (esperado ${larg})`); });
  for (const l of chao) for (const c of l) if (!TIPOS_CHAO[c]) err(`chão desconhecido '${c}'`);

  const itens = [];
  coisas.forEach((l, j) => [...l].forEach((c, i) => {
    if (c === ' ' || c === '.') return;
    if (!conhecidas.has(c)) err(`coisa desconhecida '${c}' em ${i},${j}`);
    else if (!LEGENDA_COISAS[c]) avisos.push(`${nome}: '${c}' (${LETRAS_FUTURAS[c]}) ainda não está na legenda`);
    itens.push({ c, i, j });
  }));
  const ps = itens.filter((x) => x.c === 'P'), xs = itens.filter((x) => x.c === 'X');
  if (ps.length !== 1) err(`precisa de exatamente 1 'P' (tem ${ps.length})`);
  if (!xs.length) err(`precisa de ao menos 1 'X'`);
  if (itens.some((x) => x.c === 'D') && !itens.some((x) => x.c === 'L')) err(`tem porta 'D' sem alavanca 'L'`);
  if (erros.some((e) => e.startsWith(nome)) || ps.length !== 1) return;

  // coisas não podem ficar em parede/vazio
  for (const x of itens) {
    const t = TIPOS_CHAO[chao[x.j][x.i]];
    if (t.solido || t.vazio) err(`'${x.c}' em ${x.i},${x.j} está sobre ${t.nome}`);
  }

  const tipo = (i, j) => (i < 0 || j < 0 || i >= larg || j >= alt) ? TIPOS_CHAO[' '] : TIPOS_CHAO[chao[j][i]];
  const letra = (i, j) => coisas[j]?.[i] ?? ' ';
  const pisavel = (i, j) => { const t = tipo(i, j); return !t.solido && !t.vazio; };

  // BFS com um conjunto de macacos; portas fecham até alguma alavanca ser alcançada;
  // selos só passam com o Hugo no time
  function busca(time) {
    let portasAbertas = false;
    for (;;) {
      const visto = new Set([`${ps[0].i},${ps[0].j}`]);
      const fila = [[ps[0].i, ps[0].j]];
      let achouAlavanca = false, achouSaida = false;
      while (fila.length) {
        const [i, j] = fila.shift();
        if (letra(i, j) === 'X') achouSaida = true;
        const h = tipo(i, j).altura;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          // alavanca: basta chegar ao lado (Agarrão tem alcance)
          if (letra(i + di, j + dj) === 'L' && time.includes('orlando')) achouAlavanca = true;
          for (let vao = 0; vao <= 10; vao++) {
            const ni = i + di * (vao + 1), nj = j + dj * (vao + 1);
            if (vao > 0 && !tipo(i + di * vao, j + dj * vao).vazio) break;
            if (!pisavel(ni, nj)) continue;
            if (letra(ni, nj) === 'D' && !portasAbertas) break;
            if (letra(ni, nj) === 'S' && !time.includes('hugo')) break;   // só o Pulverizar quebra
            const dh = tipo(ni, nj).altura - h;
            const ok = (vao === 0 && dh <= DEGRAU) || time.some((n) => alcanca(n, vao, dh));
            const k = `${ni},${nj}`;
            if (ok && !visto.has(k)) { visto.add(k); fila.push([ni, nj]); }
            break;
          }
        }
        if (letra(i, j) === 'L' && time.includes('orlando')) achouAlavanca = true;
      }
      if (achouSaida) return true;
      if (achouAlavanca && !portasAbertas) { portasAbertas = true; continue; }
      return false;
    }
  }

  const todos = ['hugo', 'chico', 'orlando'];
  if (!busca(todos)) return err('sem caminho do P até um X');
  // quem é indispensável (informativo)
  const precisa = todos.filter((n) => !busca(todos.filter((o) => o !== n)));
  console.log(`ok  ${nome.padEnd(16)} ${larg}x${alt}  ${sala.nome ?? ''}${precisa.length ? '  · precisa: ' + precisa.join(', ') : ''}`);
}

SALAS.forEach(checar);
avisos.forEach((a) => console.log('aviso ' + a));
if (erros.length) {
  console.error('\nERROS:\n' + erros.join('\n'));
  process.exit(1);
}
console.log(`\n${SALAS.length} salas ok`);
