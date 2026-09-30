import * as THREE from 'three';

// Sprites pixel art dos inimigos, desenhados em canvas (32 px = 1 tile, mesma
// densidade das texturas do chão). Contorno de tinta, luz vindo de cima/esquerda.
//
// Para a Frente A trocar o placeholder, no montarVisual() do inimigo:
//   import { aplicarSpriteInimigo } from '../fx/sprites.js';
//   montarVisual() { aplicarSpriteInimigo(this, 'guardiao'); }
// Tipos: guardiao, sentinela, bruto, drone, acolito, torre, construtor, andador.
// `aplicarSpriteInimigo` cria this.sprite (material próprio, ancorado nos pés) do
// mesmo jeito que definirPlaceholder, então o resto (piscar, espelhar) continua igual.

const TINTA = '#0c0b09';
const ACO = ['#2a2e35', '#3a3f47', '#5a626d', '#8b94a0', '#b4bcc6', '#d6dce2'];
const MANTO = ['#2a2014', '#3e2f1c', '#5a4428', '#76593a', '#93744c'];
const QUANTA = ['#1d3d40', '#2a6468', '#4fa6ab', '#a8ecea', '#e8fffe'];
const BRASA = ['#5a1a0e', '#c04a2c', '#ff7a4a', '#ffd0a0'];

const CORES_RELEVO = /^#[0-9a-f]{6}$/i;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

class Tela {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  set(x, y, cor) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = cor; }
  // elipse sombreada (luz de cima/esquerda)
  el(cx, cy, rx, ry, rampa, luz = 1) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
      if (d > 1) continue;
      const l = (-nx * 0.55 - ny * 0.8) * luz + (1 - d) * 0.5;
      this.set(x, y, rampa[Math.max(0, Math.min(rampa.length - 1, Math.round((rampa.length - 1) * 0.45 + l * 1.6 + bayer(x, y))))]);
    }
  }
  // retângulo com topo claro, borda esquerda clara e direita escura
  re(x0, y0, w, h, rampa, base = null) {
    const b = base ?? Math.floor((rampa.length - 1) / 2);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      let i = b;
      if (y === y0) i = b + 1;
      if (x === x0) i = b + 1;
      if (x === x0 + w - 1) i = b - 1;
      if (y === y0 + h - 1) i = Math.min(i, b - 1);
      this.set(x, y, rampa[Math.max(0, Math.min(rampa.length - 1, i))]);
    }
  }
  linha(x0, y0, x1, y1, cor) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, cor);
  }
  // relevo: mesma regra dos macacos (fx/macacos.js) — 1 px de luz de recorte na borda
  // de cima/esquerda da silhueta (luz quente) e a borda de baixo/direita puxada para a
  // sombra. Dá o 4º tom e separa a figura do chão com o mesmo peso dos jogáveis.
  relevo(forca = 0.34) {
    const { w, h } = this, luz = [], somb = [];
    const vazio = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !this.px[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = this.px[y * w + x];
      if (!c || c === TINTA || c === OSSO || !CORES_RELEVO.test(c)) continue;
      if (vazio(x - 1, y) || vazio(x, y - 1)) luz.push(y * w + x);
      else if (vazio(x + 1, y) || vazio(x, y + 1)) somb.push(y * w + x);
    }
    const mix = (c, alvo, k) => '#' + [1, 3, 5].map((o) => { const a = parseInt(c.slice(o, o + 2), 16), z = parseInt(alvo.slice(o, o + 2), 16); return Math.round(a + (z - a) * k).toString(16).padStart(2, '0'); }).join('');
    for (const i of luz) this.px[i] = mix(this.px[i], '#f4e8cc', forca);
    for (const i of somb) this.px[i] = mix(this.px[i], '#0c0b09', forca * 0.7);
  }
  // contorno de tinta em volta de tudo que foi pintado
  contorno() {
    const { w, h } = this, fora = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (this.px[y * w + x]) continue;
      const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < h && this.px[Y * w + X] && this.px[Y * w + X] !== TINTA; });
      if (viz) fora.push(y * w + x);
    }
    for (const i of fora) this.px[i] = TINTA;
  }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    this.px.forEach((cor, i) => { if (cor) { g.fillStyle = cor; g.fillRect(i % this.w, (i / this.w) | 0, 1, 1); } });
    return c;
  }
}

const DESENHOS = {
  guardiao: [30, 42, (t) => {
    t.re(9, 29, 4, 11, ACO, 1); t.re(15, 29, 4, 11, ACO, 1);            // pernas
    t.re(8, 38, 5, 3, ACO, 0); t.re(15, 38, 5, 3, ACO, 0);              // botas
    t.re(7, 15, 14, 15, ACO, 2);                                         // tronco
    t.el(14, 19, 5, 4, ACO); t.re(8, 27, 12, 2, ACO, 1);                 // peitoral e cinto
    t.el(6, 16, 4, 3, ACO); t.el(22, 16, 4, 3, ACO);                     // ombreiras
    t.re(3, 18, 4, 10, ACO, 2); t.re(21, 18, 4, 10, ACO, 2);             // braços
    t.el(14, 9, 5.5, 6, ACO);                                            // elmo
    t.re(10, 9, 9, 2, [BRASA[0], BRASA[1], BRASA[2]], 1); t.set(14, 9, BRASA[3]); t.set(15, 9, BRASA[3]);
    t.linha(26, 2, 26, 40, ACO[1]); t.linha(27, 2, 27, 40, ACO[2]);      // alabarda
    t.el(26.5, 4, 2.5, 4, ACO); t.set(26, 3, BRASA[2]);
  }],
  sentinela: [24, 44, (t) => {
    t.re(8, 32, 3, 11, ACO, 1); t.re(13, 32, 3, 11, ACO, 1);
    t.re(6, 12, 12, 21, ACO, 2); t.el(12, 18, 5, 5, ACO);
    t.el(12, 7, 4, 5, ACO); t.el(12, 7, 1.6, 1.6, [BRASA[1], BRASA[2], BRASA[3]]);
    t.re(3, 14, 3, 12, ACO, 2);
    t.re(17, 16, 7, 4, ACO, 3); t.set(23, 17, BRASA[2]); t.set(23, 18, BRASA[1]);     // canhão
    t.re(8, 24, 8, 2, ACO, 1);
  }],
  bruto: [44, 62, (t) => {
    t.re(12, 44, 8, 16, ACO, 1); t.re(24, 44, 8, 16, ACO, 1);
    t.el(22, 30, 15, 15, ACO);
    t.el(8, 22, 8, 7, ACO); t.el(36, 22, 8, 7, ACO);
    t.re(2, 26, 8, 16, ACO, 2); t.re(34, 26, 8, 16, ACO, 2);
    t.el(6, 45, 6, 5, ACO); t.el(38, 45, 6, 5, ACO);                      // punhos
    t.el(22, 14, 6, 6, ACO); t.re(18, 14, 9, 2, [BRASA[0], BRASA[1], BRASA[2]], 1);
    t.re(14, 36, 16, 3, ACO, 1);
  }],
  drone: [22, 22, (t) => {
    t.re(1, 9, 5, 2, ACO, 2); t.re(16, 9, 5, 2, ACO, 2);
    t.el(11, 11, 7.5, 7.5, ACO);
    t.el(11, 11, 3.5, 3.5, [BRASA[0], BRASA[1], BRASA[2], BRASA[3]]);
    t.linha(11, 1, 11, 3, ACO[2]); t.set(11, 0, BRASA[2]);
  }],
  acolito: [24, 44, (t) => {
    for (let y = 12; y < 42; y++) { const m = 5 + (y - 12) * 0.22; for (let x = Math.round(11 - m); x <= Math.round(11 + m); x++) t.set(x, y, MANTO[x < 11 - m + 2 ? 3 : x > 11 + m - 2 ? 1 : (y % 7 === 0 ? 1 : 2)]); }
    t.re(6, 26, 12, 2, [QUANTA[0], QUANTA[1], QUANTA[2]], 1);          // faixa teal
    t.el(11, 9, 5.5, 6, MANTO);                                         // capuz
    t.el(11, 10.5, 3.2, 3.5, ['#0c0b09', '#15120d', '#1d190f']);
    t.set(10, 10, QUANTA[3]); t.set(13, 10, QUANTA[3]);
    t.linha(20, 6, 20, 42, MANTO[1]);                                   // cajado
    t.el(20, 4, 2.6, 2.6, QUANTA); t.set(20, 4, QUANTA[4]);
  }],
  torre: [28, 58, (t) => {
    t.re(3, 48, 22, 9, ACO, 2); t.re(5, 44, 18, 5, ACO, 3);
    t.re(8, 14, 12, 31, ACO, 1);
    for (let y = 18; y < 42; y += 2) t.set(14, y, QUANTA[2 + (y % 4 ? 0 : 1)]);
    t.el(14, 30, 3, 5, QUANTA);
    t.re(4, 10, 20, 5, ACO, 3);
    t.el(14, 6, 5, 5, QUANTA); t.set(13, 5, QUANTA[4]); t.set(14, 5, QUANTA[4]);
  }],
  andador: [74, 82, (t) => {
    const pernas = [[14, -1], [28, -1], [46, 1], [60, 1]];
    for (const [x, s] of pernas) { t.linha(x, 42, x + s * 8, 30, ACO[2]); t.linha(x + 1, 42, x + 1 + s * 8, 30, ACO[3]); t.linha(x + s * 8, 30, x + s * 12, 80, ACO[1]); t.linha(x + s * 8 + 1, 30, x + s * 12 + 1, 80, ACO[2]); t.el(x + s * 12, 79, 3, 2, ACO); }
    t.el(37, 42, 26, 13, ['#1d2a2c', '#2d3e3f', '#465b5a', '#6a8583', '#8fb0ad']);
    t.re(22, 47, 30, 3, [QUANTA[1], QUANTA[2], QUANTA[3]], 1);
    t.el(37, 26, 9, 7, ['#1d2a2c', '#2d3e3f', '#465b5a', '#6a8583']);
    t.el(37, 27, 3.5, 3.5, QUANTA); t.set(37, 26, QUANTA[4]);
    t.linha(44, 20, 50, 8, ACO[2]); t.el(50, 7, 2, 2, QUANTA);
  }],
};

// ---------------------------------------------------------------- humanoides animados
// Guardião e Acólito ganham quadros (andar / preparo / golpe) desenhados pelo mesmo
// esqueleto simples dos macacos (src/fx/macacos.js): pose -> partes -> contorno.
function guardiaoPose(t, p = {}) {
  const by = p.by ?? 0, [a, b] = p.pes ?? [[0, 0], [0, 0]], sw = p.braco ?? 0;
  const perna = (x, [dx, lev]) => { const yT = 29 + by; t.re(x + dx, yT, 4, 39 - lev - yT + 1, ACO, 1); t.re(x + dx - 1, 38 - lev, 5, 3, ACO, 0); };
  perna(9, a); perna(15, b);
  t.re(7, 15 + by, 14, 15, ACO, 2);                                            // tronco
  t.el(14, 19 + by, 5, 4, ACO); t.re(8, 27 + by, 12, 2, ACO, 1);               // peitoral e cinto
  t.re(3, 18 + by + sw, 4, 10, ACO, 2);                                         // braço de trás
  t.el(6, 16 + by, 4, 3, ACO); t.el(22, 16 + by, 4, 3, ACO);                   // ombreiras
  t.el(14, 9 + by, 5.5, 6, ACO);                                               // elmo
  const olho = p.apagado ? [ACO[0], BRASA[0], BRASA[1]] : p.aviso ? [BRASA[1], BRASA[2], BRASA[3]] : [BRASA[0], BRASA[1], BRASA[2]];
  t.re(10, 9 + by, 9, 2, olho, 1);
  if (!p.apagado) { t.set(14, 9 + by, BRASA[3]); t.set(15, 9 + by, BRASA[3]); }
  t.linha(10, 7 + by, 18, 7 + by, ACO[4]);                                      // aba do elmo (lê o volume)
  t.set(9, 12 + by, ACO[1]); t.set(19, 12 + by, ACO[1]);
  const haste = (x0, y0, x1, y1) => { t.linha(x0, y0, x1, y1, ACO[1]); t.linha(x0 + 1, y0, x1 + 1, y1, ACO[2]); };
  if (p.alabarda === 'alto') {           // preparo: alabarda erguida para trás
    t.re(21, 13 + by, 4, 8, ACO, 2);
    haste(17, 38, 31, 2 + by); t.el(31, 3 + by, 3, 3.5, ACO); t.set(31, 2 + by, BRASA[2]);
  } else if (p.alabarda === 'golpe') {   // golpe: lâmina descendo à frente
    t.re(21, 19 + by, 9, 4, ACO, 2);
    haste(16, 14 + by, 41, 33); t.el(40, 32, 3.5, 2.5, ACO); t.set(41, 32, BRASA[2]); t.set(42, 33, BRASA[3]);
  } else {
    t.re(21, 18 + by - sw, 4, 10, ACO, 2);                                     // braço da frente
    haste(26, 2 + by - sw, 26, 40 - sw); t.el(26.5, 4 + by - sw, 2.5, 4, ACO); t.set(26, 3 + by - sw, BRASA[2]);
  }
}

function acolitoPose(t, p = {}) {
  const by = p.by ?? 0, passo = p.passo ?? 0;
  for (let y = 12 + by; y < 42; y++) {
    const m = 5 + (y - 12 - by) * 0.22 + (y > 38 ? passo * 0.5 : 0);
    const cx = 11 + (y > 36 ? passo : 0);
    for (let x = Math.round(cx - m); x <= Math.round(cx + m); x++) t.set(x, y, MANTO[x < cx - m + 2 ? 3 : x > cx + m - 2 ? 1 : ((y - by) % 7 === 0 ? 1 : 2)]);
  }
  if (passo) t.re(passo > 0 ? 13 : 6, 41, 3, 2, ['#15120d', '#2a2014', '#3e2f1c'], 1);   // pé aparecendo sob o manto
  t.re(6, 26 + by, 12, 2, [QUANTA[0], QUANTA[1], QUANTA[2]], 1);            // faixa teal
  // circuitos Quanta bordados no manto: descem da faixa e ramificam
  for (const [x0, y0, x1, y1] of [[9, 28, 9, 33], [9, 33, 7, 35], [13, 28, 13, 31], [13, 31, 15, 33], [15, 33, 15, 37]]) t.linha(x0, y0 + by, x1, y1 + by, QUANTA[1]);
  for (const [x, y] of [[7, 35], [15, 37], [11, 22]]) t.set(x, y + by, p.apagado ? QUANTA[1] : QUANTA[3]);
  t.el(11, 9 + by, 5.5, 6, MANTO);                                            // capuz
  t.el(11, 10.5 + by, 3.2, 3.5, ['#0c0b09', '#15120d', '#1d190f']);
  const olho = p.apagado ? QUANTA[1] : p.brilho ? QUANTA[4] : QUANTA[3];
  t.set(10, 10 + by, olho); t.set(13, 10 + by, olho);
  if (p.conjura) {                                                            // cajado erguido, orbe carregando
    t.el(17, 17 + by, 2.5, 3, MANTO);                                         // manga erguida
    t.linha(19, 3, 19, 36, MANTO[1]); t.linha(20, 3, 20, 36, MANTO[2]);
    const r = p.brilho ? 3.4 : 2.9;
    t.el(19.5, 3.2, r, r, QUANTA); t.set(19, 3, QUANTA[4]); t.set(20, 2, QUANTA[4]);
  } else {
    t.linha(20, 6 + by, 20, 42, MANTO[1]);                                    // cajado
    t.el(20, 4 + by, 2.6, 2.6, QUANTA); t.set(20, 4 + by, QUANTA[4]);
  }
}

// Sentinela: canhão no braço direito. Mira = canhão erguido e olho aceso; tiro = recuo + clarão.
function sentinelaPose(t, p = {}) {
  const by = p.by ?? 0, [a, b] = p.pes ?? [[0, 0], [0, 0]], rc = p.tiro ? -1 : 0;
  const perna = (x, [dx, lev]) => { const y0 = 32 + by; t.re(x + dx, y0, 3, 43 - lev - y0, ACO, 1); };
  perna(8, a); perna(13, b);
  t.re(3 + rc, 14 + by + (p.braco ?? 0), 3, 12, ACO, 2);                            // braço de trás
  t.re(6 + rc, 12 + by, 12, 21, ACO, 2); t.el(12 + rc, 18 + by, 5, 5, ACO);
  t.re(8 + rc, 24 + by, 8, 2, ACO, 1);
  t.el(12 + rc, 7 + by, 4, 5, ACO);
  const r = p.mira ? (p.brilho ? 2.2 : 1.9) : 1.6;
  t.el(12 + rc, 7 + by, r, r, p.apagado ? [ACO[0], BRASA[0], BRASA[1]] : p.mira ? [BRASA[2], BRASA[3], '#fff4e0'] : [BRASA[1], BRASA[2], BRASA[3]]);
  t.linha(8 + rc, 16 + by, 8 + rc, 22 + by, ACO[4]); t.set(12 + rc, 29 + by, BRASA[1]);   // quina do peito e luz de status
  if (p.mira || p.tiro) {                                                           // canhão erguido à frente
    t.re(16 + rc * 2, 14 + by, 9, 4, ACO, 3);
    const boca = p.brilho || p.tiro ? BRASA[3] : BRASA[2];
    t.set(24 + rc * 2, 15 + by, boca); t.set(24 + rc * 2, 16 + by, BRASA[1]);
    if (p.tiro) { t.el(26.5, 15.5 + by, 2.6, 2.6, [BRASA[1], BRASA[2], BRASA[3], '#fff4e0']); t.set(29, 15 + by, BRASA[2]); }
  } else {
    t.re(17, 16 + by - (p.braco ?? 0), 7, 4, ACO, 3); t.set(23, 17 + by - (p.braco ?? 0), BRASA[2]); t.set(23, 18 + by - (p.braco ?? 0), BRASA[1]);
  }
}

// Bruto: passo pesado (afunda no apoio), preparo com os punhos erguidos, investida inclinada.
function brutoPose(t, p = {}) {
  const by = p.by ?? 0, [a, b] = p.pes ?? [[0, 0], [0, 0]], [pl, pr] = p.punho ?? [0, 0], ln = p.ln ?? 0;
  const perna = (x, [dx, lev]) => { const y0 = 44 + by; t.re(x + dx, y0, 8, 60 - lev - y0, ACO, 1); };
  perna(12, a); perna(24, b);
  const visor = p.apagado ? [ACO[0], BRASA[0], BRASA[1]] : p.aviso ? [BRASA[1], BRASA[2], BRASA[3]] : [BRASA[0], BRASA[1], BRASA[2]];
  if (p.erguer) {                                                                   // punhos acima da cabeça
    t.re(2, 12 + by, 8, 16, ACO, 2); t.re(34, 12 + by, 8, 16, ACO, 2);
    t.el(22, 30 + by, 15, 15, ACO);
    t.el(8, 22 + by, 8, 7, ACO); t.el(36, 22 + by, 8, 7, ACO);
    t.el(22, 16 + by, 6, 6, ACO); t.re(18, 16 + by, 9, 2, visor, 1);
    t.el(7, 9 + by, 6, 5, ACO); t.el(37, 9 + by, 6, 5, ACO);
  } else if (p.investida) {                                                         // corpo à frente, punhos adiante
    t.re(2 + ln, 28 + by, 8, 12, ACO, 2);
    t.el(22 + ln, 30 + by, 15, 14, ACO);
    t.el(10 + ln, 23 + by, 8, 7, ACO); t.el(36 + ln, 24 + by, 8, 7, ACO);
    t.el(29 + ln, 20 + by, 6, 6, ACO); t.re(26 + ln, 20 + by, 9, 2, visor, 1);
    t.re(34 + ln, 30 + by, 10, 8, ACO, 2); t.el(45, 35 + by, 5, 5, ACO); t.el(43, 42 + by, 5, 4.5, ACO);
  } else {
    t.el(22, 30 + by, 15, 15, ACO);
    t.el(8, 22 + by, 8, 7, ACO); t.el(36, 22 + by, 8, 7, ACO);
    t.re(2, 26 + by + pl, 8, 16, ACO, 2); t.re(34, 26 + by + pr, 8, 16, ACO, 2);
    t.el(6, 45 + by + pl, 6, 5, ACO); t.el(38, 45 + by + pr, 6, 5, ACO);
    t.el(22, 14 + by, 6, 6, ACO); t.re(18, 14 + by, 9, 2, visor, 1);
  }
  t.re(14 + ln, 36 + by, 16, 3, ACO, 1);
}

// Drone vigia: hélice girando (2 quadros) e olho que pulsa no preparo.
function dronePose(t, p = {}) {
  const h = p.helice ?? 0;
  t.re(1, 11, 5, 2, ACO, 2); t.re(16, 11, 5, 2, ACO, 2);
  t.el(11, 13, 7.5, 7.5, ACO);
  const r = p.aviso ? (p.brilho ? 4.2 : 3.8) : 3.5;
  t.el(11, 13, r, r, p.brilho ? [BRASA[1], BRASA[2], BRASA[3], '#fff4e0'] : [BRASA[0], BRASA[1], BRASA[2], BRASA[3]]);
  t.linha(11, 3, 11, 5, ACO[2]);
  if (h) { t.linha(8, 2, 14, 2, ACO[3]); t.set(11, 2, ACO[4]); }
  else { t.linha(3, 2, 19, 2, ACO[2]); t.linha(5, 1, 17, 1, ACO[4]); }
}

// Drone Construtor: hélice girando + flutuação (2 quadros); reerguendo selo: pinças
// abertas para baixo e feixe teal do núcleo até o chão (pulsa).
const LOUCA = ['#6a6f7a', '#9aa3ae', '#c8ced6', '#e9e1cf'];
function construtorPose(t, p = {}) {
  const b = p.by ?? 0, cy = 12 + b;
  if (p.feixe) {                                                                     // feixe até o selo
    for (let y = cy + 4; y < 24; y++) { t.set(10, y, QUANTA[2]); t.set(11, y, QUANTA[p.brilho ? 4 : 3]); t.set(12, y, QUANTA[2]); }
    for (const [x, y] of p.brilho ? [[8, 20], [14, 22], [7, 23], [15, 18]] : [[9, 22], [13, 19], [15, 23]]) t.set(x, y, QUANTA[3]);
    t.linha(5, cy + 3, 7, cy + 9, QUANTA[1]); t.linha(17, cy + 3, 15, cy + 9, QUANTA[1]);   // pinças para dentro
    t.set(8, cy + 9, '#b08bc4'); t.set(14, cy + 9, '#b08bc4');
  } else {
    t.linha(5, cy + 3, 2, cy + 9, QUANTA[1]); t.linha(17, cy + 3, 20, cy + 9, QUANTA[1]);
    t.set(2, cy + 10, '#b08bc4'); t.set(20, cy + 10, '#b08bc4');
  }
  t.el(11, cy, 7, 7, LOUCA);
  const r = p.feixe ? (p.brilho ? 3.6 : 3.2) : 3;
  t.el(11, cy, r, r, [QUANTA[1], QUANTA[2], QUANTA[3], QUANTA[4]]);
  t.linha(11, cy - 9, 11, cy - 7, ACO[2]);                                            // mastro + hélice
  if (p.helice) { t.linha(8, cy - 10, 14, cy - 10, ACO[3]); t.set(11, cy - 10, ACO[4]); }
  else { t.linha(3, cy - 10, 19, cy - 10, ACO[2]); t.linha(5, cy - 11, 17, cy - 11, ACO[4]); }
}

// Torre: núcleo teal que respira; na sobrecarga incha, solta faíscas e o orbe cresce.
function torrePose(t, p = {}) {
  const k = p.carga ?? 0, pulso = p.pulso ?? 0, X = 2;
  t.re(3 + X, 48, 22, 9, ACO, 2); t.re(5 + X, 44, 18, 5, ACO, 3);
  t.re(8 + X, 14, 12, 31, ACO, 1);
  for (let y = 18; y < 42; y += 2) t.set(14 + X, y, QUANTA[Math.min(4, 2 + (y % 4 ? 0 : 1) + (k && (y >> 1) % 3 === pulso % 3 ? 1 : 0))]);
  t.el(14 + X, 30, 3 + k * 0.6, 5 + k * 0.6, k ? QUANTA.slice(1) : QUANTA);
  t.re(4 + X, 10, 20, 5, ACO, 3);
  const r = 5 + k * 0.8;
  t.el(14 + X, 6, r, r, pulso % 2 ? QUANTA.slice(1) : QUANTA); t.set(13 + X, 5, QUANTA[4]); t.set(14 + X, 5, QUANTA[4]);
  if (k) {                                                                           // arcos de sobrecarga
    const faisca = [[1, 8, 3, 12], [27, 7, 30, 11], [2, 26, 5, 23], [26, 28, 29, 25], [4, 40, 1, 37], [25, 39, 29, 36]];
    faisca.forEach(([x0, y0, x1, y1], i) => { if ((i + pulso) % 2) t.linha(x0, y0, x1, y1, i % 3 ? QUANTA[3] : QUANTA[4]); });
  } else if (pulso) t.set(14 + X, 30, QUANTA[4]);
}

// Andador: quatro pernas em pares alternados; preparo agacha e acende o olho; no ar recolhe.
function andadorPose(t, p = {}) {
  const by = p.by ?? 0, lev = p.lev ?? [0, 0, 0, 0], abre = p.abre ?? 0;
  const pernas = [[14, -1], [28, -1], [46, 1], [60, 1]];
  pernas.forEach(([x, s], i) => {
    const l = lev[i], jx = x + s * (8 + abre), jy = 30 + by - Math.round(l * 0.4), px = x + s * (12 + abre) - s * Math.round(l * 0.3), py = 80 - l;
    t.linha(x, 42 + by, jx, jy, ACO[2]); t.linha(x + 1, 42 + by, jx + 1, jy, ACO[3]);
    t.linha(jx, jy, px, py, ACO[1]); t.linha(jx + 1, jy, px + 1, py, ACO[2]);
    t.el(px, py - 1, 3, 2, ACO);
  });
  t.el(37, 42 + by, 26, 13, ['#1d2a2c', '#2d3e3f', '#465b5a', '#6a8583', '#8fb0ad']);
  t.re(22, 47 + by, 30, 3, [QUANTA[1], QUANTA[2], QUANTA[3]], p.aviso ? 2 : 1);
  for (const [x0, y0, x1, y1] of [[24, 46, 24, 38], [24, 38, 30, 34], [50, 46, 50, 40], [50, 40, 45, 36], [37, 46, 37, 42]]) t.linha(x0, y0 + by, x1, y1 + by, QUANTA[1]);
  for (const [x, y] of [[30, 34], [45, 36], [37, 42]]) t.set(x, y + by, QUANTA[3]);
  t.el(37, 26 + by, 9, 7, ['#1d2a2c', '#2d3e3f', '#465b5a', '#6a8583']);
  const r = p.aviso ? 4.3 : 3.5;
  t.el(37, 27 + by, r, r, QUANTA); t.set(37, 26 + by, QUANTA[4]); if (p.brilho) t.el(37, 27 + by, 1.6, 1.6, [QUANTA[4]]);
  t.linha(44, 20 + by, 50, 8 + by, ACO[2]); t.el(50, 7 + by, p.aviso ? 2.6 : 2, p.aviso ? 2.6 : 2, QUANTA);
}

// ---- fauna (virada para a ESQUERDA da tela)
// Javali: trote (patas em diagonal), preparo (cabeça baixa, cavando), investida (galope esticado).
function javaliPose(t, p = {}) {
  const by = p.by ?? 0, pt = p.patas ?? [[0, 0], [0, 0], [0, 0], [0, 0]], cb = p.cab ?? 0;
  if (p.galope) {                                                                  // patas em tesoura
    const g = p.galope > 1;
    for (const [x0, x1] of g ? [[11, 6], [18, 14], [29, 35], [35, 41]] : [[11, 9], [18, 20], [29, 26], [35, 37]]) {
      t.linha(x0, 20 + by, x1, 28, PELO[2]); t.linha(x0 + 1, 20 + by, x1 + 1, 28, PELO[3]); t.linha(x0 + 2, 20 + by, x1 + 2, 28, PELO[2]);
    }
  } else {
    [[10, 20], [17, 21], [28, 21], [34, 20]].forEach(([x, y], i) => { const [dx, lev] = pt[i]; t.re(x + dx, y + by, 4, 29 - lev - y - by, PELO, 1); });
  }
  t.el(24, 16 + by, 16, 9, PELO);                                                   // corpo
  t.el(9, 17 + by + cb, 8, 6.5, PELO);                                               // cabeça
  t.el(3, 19 + by + cb, 3, 2.5, ['#5a3828', '#7a4a38', '#9a6a58']);                  // focinho
  t.set(2, 19 + by + cb, TINTA); t.set(4, 19 + by + cb, TINTA);
  t.linha(5, 21 + by + cb, 2, 16 + by + cb, OSSO); t.linha(6, 21 + by + cb, 3, 17 + by + cb, OSSO);   // presa
  const olho = p.aviso ? '#ff5a3a' : '#ffd24a';
  t.set(9, 14 + by + cb, olho); t.set(10, 14 + by + cb, olho);
  t.el(12, 10 + by + cb, 2, 3, PELO);                                               // orelha
  for (let x = 14; x < 38; x += 3) t.linha(x, 8 + by + ((x * 7) % 3), x + 1, 3 + by + ((x * 5) % 4), FOLHA[2 + (x % 3)]);
  t.el(24, 9 + by, 10, 2.5, FOLHA);                                                 // musgo no lombo
  t.linha(40, 14 + by, 43, 12 + by - (p.rabo ?? 0), PELO[2]);                       // rabo
  if (p.poeira) for (const [x, y] of [[p.poeira > 1 ? 16 : 14, 28], [19, 27], [p.poeira > 1 ? 13 : 21, 26]]) t.set(x, y, '#9a8a6a');
}

// Sapo: papo que respira, pulo esticado, papo inflado no preparo (a escala faz o resto).
function sapoPose(t, p = {}) {
  const pp = p.papo ?? 0;
  if (p.ar) {                                                                       // no ar: corpo esticado, pernas para trás
    t.linha(17, 12, 24, 17, PELE[2]); t.linha(18, 12, 25, 16, PELE[3]); t.linha(16, 13, 22, 18, PELE[1]);
    t.el(5, 13, 3, 1.5, PELE);
    t.el(12, 9, 9, 5.5, CARNE); t.el(14, 7, 6.5, 2.8, PELE);
    t.el(7, 11, 3.5, 2.2, ['#c07a3a', '#e8b060', '#ffd890']);
    t.el(6, 4, 3, 3, CARNE); t.el(12, 3, 3, 3, CARNE);
    t.set(6, 4, TINTA); t.set(12, 3, TINTA); t.set(5, 3, OSSO); t.set(11, 2, OSSO);
    for (const [x, y] of [[15, 6], [19, 8], [12, 8]]) t.set(x, y, '#ffd24a');
    return;
  }
  t.el(19, 16, 5, 3, PELE); t.el(6, 17, 4, 2.5, PELE);                              // patas
  t.el(13, 12, 10, 7, p.aviso ? CARNE.slice(1) : CARNE);                            // corpo
  t.el(15, 9, 7, 3.5, PELE);                                                        // costas verdes
  t.el(7, 15 - pp * 0.5, 4.5 + pp, 3 + pp * 0.7, ['#c07a3a', '#e8b060', '#ffd890']);   // papo
  t.el(6, 6, 3, 3, CARNE); t.el(12, 5, 3, 3, CARNE);                                // olhos saltados
  t.set(6, 6, TINTA); t.set(12, 5, TINTA); t.set(5, 5, OSSO); t.set(11, 4, OSSO);
  for (const [x, y] of [[16, 8], [20, 10], [13, 10]]) t.set(x, y, p.aviso && p.brilho ? '#fff0b0' : '#ffd24a');
}

// Aranha: patas em dois grupos alternados; preparo ergue as patas da frente; bote avança as quelíceras.
function aranhaPose(t, p = {}) {
  const ga = p.ga ?? 0, gb = p.gb ?? 0, er = p.ergue ?? 0, bote = p.bote ? -2 : 0;
  const PATAS = [[16, 16, 6, 6, 1, 28, 0, 1], [18, 17, 10, 8, 7, 29, 1, 0], [26, 17, 34, 8, 38, 29, 0, 0], [28, 16, 40, 6, 45, 28, 1, 0],
    [17, 18, 9, 14, 3, 22, 1, 1], [27, 18, 36, 14, 43, 22, 0, 0], [20, 18, 14, 20, 12, 29, 0, 0], [24, 18, 30, 20, 32, 29, 1, 0]];
  for (const [x0, y0, x1, y1, x2, y2, g, frente] of PATAS) {
    const d = g ? gb : ga, lev = Math.abs(d) > 1 ? 2 : 0;
    let X2 = x2 + d, Y2 = y2 - lev, Y1 = y1 - lev;
    if (frente && er) { X2 = x2 - 1 + bote; Y2 = y2 - 12 - (frente && x2 < 5 ? 2 : 0); Y1 = y1 - 4; }
    t.linha(x0 + bote, y0, x1 + bote, Y1, QUITINA[2]); t.linha(x1 + bote, Y1, X2, Y2, QUITINA[1]); t.linha(x1 + 1 + bote, Y1, X2 + 1, Y2, QUITINA[3]);
  }
  t.el(31, 13 - (er ? 1 : 0), 10, 8, QUITINA);                                     // abdômen
  for (let x = 25; x < 40; x += 4) t.linha(x, 7 - (er ? 1 : 0), x + 1, 20 - (er ? 1 : 0), QUITINA[5]);
  t.el(17 + bote, 16, 6, 5, QUITINA);                                              // cefalotórax
  const ol = p.aviso ? '#ff8a6a' : '#ff4a3a';
  t.set(13 + bote, 14, ol); t.set(15 + bote, 13, ol); t.set(14 + bote, 16, ol); t.set(12 + bote, 16, '#c02a20');
  if (p.bote) { t.linha(11 + bote, 19, 8 + bote, 23, QUITINA[0]); t.linha(14 + bote, 19, 12 + bote, 24, QUITINA[0]); t.set(8 + bote, 24, OSSO); t.set(12 + bote, 25, OSSO); }
  else { t.linha(11, 19, 10, 22, QUITINA[0]); t.linha(14, 19, 14, 22, QUITINA[0]); }
}

// Planta: balança parada; preparo abre a boca (mandíbula de cima sobe); mordida fecha avançando.
function plantaPose(t, p = {}) {
  const sw = p.sw ?? 0, ab = p.abre ?? 0, av = p.morde ? -4 : 0, hx = 15 + sw + av;
  t.linha(15, 39, 15 + Math.round((sw + av) * 0.5), 26, FOLHA[3]); t.linha(16, 39, 16 + Math.round((sw + av) * 0.5), 26, FOLHA[2]);
  t.linha(15 + Math.round((sw + av) * 0.5), 26, hx, 18, FOLHA[3]); t.linha(16 + Math.round((sw + av) * 0.5), 26, hx + 1, 18, FOLHA[2]);
  t.el(8, 34, 7, 3, FOLHA); t.el(23, 32, 7, 3, FOLHA);                              // folhas no pé
  if (ab) {                                                                          // boca aberta
    t.el(hx, 17, 12, 6, CARNE);                                                      // mandíbula de baixo
    t.el(hx, 7 - ab, 12, 7, CARNE);                                                  // de cima
    for (let x = hx - 9; x <= hx + 9; x++) for (let y = 12 - ab; y <= 14; y++) if (Math.abs(x - hx) < 10 - (y > 13 ? 1 : 0)) t.set(x, y, y < 13 - ab + 1 ? CARNE[0] : '#2a0608');
    for (let x = hx - 9; x <= hx + 9; x += 3) { t.set(x, 13 - ab, OSSO); t.set(x + 1, 14 - ab, OSSO); t.set(x + 1, 14, OSSO); t.set(x, 13, OSSO); }
    for (const [x, y] of [[-6, 3 - ab], [3, 2 - ab], [7, 5 - ab], [-3, 18], [5, 18]]) { t.set(hx + x, y, OSSO); t.set(hx + x + 1, y, '#f0d0c0'); }
  } else {
    t.el(hx, 12, 12, 10, CARNE);                                                     // cabeça fechada
    for (let x = hx - 10; x <= hx + 10; x += 3) { t.set(x, 12, OSSO); t.set(x + 1, 13, OSSO); }
    t.linha(hx - 11, 12, hx + 11, 12, CARNE[0]);
    for (const [x, y] of [[-6, 6], [3, 5], [7, 9], [-3, 18], [5, 17]]) { t.set(hx + x, y, OSSO); t.set(hx + x + 1, y, '#f0d0c0'); }
  }
  t.el(hx, 23, 5, 2, FOLHA);                                                         // colarinho
}

// tipo -> [largura, altura, centroX (px), { animação: [poses] }, desenho(t, pose), opções]
// Animações: andar (passo pela distância), parado (tempo, `fps`), preparo (ent.preparo > 0),
// golpe (animarGolpe ou logo após o preparo), investida (ent.investida > 0), ar (fora do chão).
// opções.esquerda: desenhado para a esquerda (fauna; quem vira o sprite é Fauna.atualizarVisual).
const ANIMADOS = {
  guardiao: [44, 42, 15, {
    andar: [{}, { by: -1, pes: [[-1, 1], [1, 0]], braco: 1 }, {}, { by: -1, pes: [[1, 0], [-1, 1]], braco: -1 }],
    preparo: [{ alabarda: 'alto', aviso: true, by: 1 }],
    golpe: [{ alabarda: 'golpe', aviso: true, by: 1, pes: [[2, 0], [-1, 0]] }],
    tonto: [1, 2, 3, 4].map((k) => ({ by: 2, braco: 2, tonto: k, apagado: true, pes: [[k % 2, 0], [0, 0]] })),
  }, guardiaoPose, { cabeca: [14, 4] }],
  acolito: [24, 44, 12, {
    andar: [{}, { by: -1, passo: -1 }, {}, { by: -1, passo: 1 }],
    preparo: [{ conjura: true }, { conjura: true, brilho: true }],
    tonto: [1, 2, 3, 4].map((k) => ({ by: 2, tonto: k, apagado: true, passo: k % 2 ? 1 : 0 })),
  }, acolitoPose, { cabeca: [11, 4] }],
  sentinela: [30, 44, 12, {
    andar: [{}, { by: -1, pes: [[-1, 2], [1, 0]], braco: 1 }, {}, { by: -1, pes: [[1, 0], [-1, 2]], braco: -1 }],
    preparo: [{ mira: true }, { mira: true, brilho: true }],
    golpe: [{ tiro: true, mira: true }],
    tonto: [1, 2, 3, 4].map((k) => ({ by: 2, braco: 2, tonto: k, apagado: true })),
  }, sentinelaPose, { cabeca: [12, 3] }],
  bruto: [50, 62, 22, {
    andar: [{ by: 1 }, { pes: [[-1, 3], [0, 0]], punho: [-2, 2] }, { by: 1 }, { pes: [[0, 0], [1, 3]], punho: [2, -2] }],
    preparo: [{ erguer: true, aviso: true, by: 2 }, { erguer: true, aviso: true, by: 1 }],
    investida: [{ investida: true, aviso: true, ln: 4, by: 1, pes: [[-2, 0], [3, 3]] }, { investida: true, aviso: true, ln: 4, by: 2, pes: [[2, 3], [-2, 0]] }],
    tonto: [1, 2, 3, 4].map((k) => ({ by: 3, punho: [2, 3], tonto: k, apagado: true })),
  }, brutoPose, { cabeca: [22, 9] }],
  drone: [22, 24, 11, {
    parado: [{}, { helice: 1 }],
    preparo: [{ aviso: true }, { aviso: true, helice: 1, brilho: true }],
  }, dronePose, { fps: 14 }],
  construtor: [22, 24, 11, {
    parado: [{}, { helice: 1, by: 1 }, { by: 1 }, { helice: 1 }],
    preparo: [{ feixe: true }, { feixe: true, helice: 1, brilho: true }],
  }, construtorPose, { fps: 12 }],
  torre: [32, 58, 16, {
    parado: [{}, { pulso: 1 }],
    preparo: [{ carga: 1, pulso: 0 }, { carga: 1, pulso: 1 }, { carga: 2, pulso: 2 }],
  }, torrePose, { fps: 2 }],
  andador: [74, 82, 37, {
    andar: [{}, { by: -1, lev: [5, 0, 0, 5] }, {}, { by: -1, lev: [0, 5, 5, 0] }],
    preparo: [{ by: 4, aviso: true }, { by: 4, aviso: true, brilho: true }],
    ar: [{ by: -2, lev: [10, 10, 10, 10], abre: -2 }],
  }, andadorPose],
  javali: [44, 30, 22, {
    andar: [{}, { by: -1, patas: [[-1, 2], [0, 0], [0, 0], [-1, 2]], rabo: 1 }, {}, { by: -1, patas: [[0, 0], [-1, 2], [-1, 2], [0, 0]], rabo: 1 }],
    preparo: [{ cab: 2, aviso: true, patas: [[0, 0], [2, 1], [0, 0], [0, 0]], poeira: 1 }, { cab: 2, aviso: true, patas: [[0, 0], [-1, 0], [0, 0], [0, 0]], poeira: 2, rabo: 2 }],
    investida: [{ galope: 1, cab: 1, aviso: true }, { galope: 2, cab: 1, by: -1, aviso: true, rabo: 2 }],
  }, javaliPose, { esquerda: true }],
  sapo: [26, 20, 13, {
    parado: [{}, { papo: 1 }],
    preparo: [{ papo: 2, aviso: true }, { papo: 2.5, aviso: true, brilho: true }],
    ar: [{ ar: true }],
  }, sapoPose, { esquerda: true, fps: 2.5 }],
  aranha: [46, 30, 23, {
    andar: [{}, { ga: -2, gb: 1 }, {}, { ga: 1, gb: -2 }],
    preparo: [{ ergue: 1, aviso: true }, { ergue: 1, aviso: true, ga: 1 }],
    golpe: [{ ergue: 1, bote: true, aviso: true }],
  }, aranhaPose, { esquerda: true }],
  planta: [30, 40, 15, {
    parado: [{}, { sw: 1 }, {}, { sw: -1 }],
    preparo: [{ abre: 3 }, { abre: 4, sw: 1 }],
    golpe: [{ morde: true }],
  }, plantaPose, { esquerda: true, fps: 2 }],
};

// atordoado: três estrelinhas girando em volta da cabeça (fase 1..4)
function estrelas(t, [cx, cy], fase) {
  for (let k = 0; k < 3; k++) {
    const a = (fase - 1) * Math.PI / 2 + k * Math.PI * 2 / 3;
    const x = Math.round(cx + Math.cos(a) * 6), y = Math.round(cy + Math.sin(a) * 2);
    const cor = k === 0 ? '#fff0b0' : '#f0c666';
    t.set(x, y, cor); t.set(x - 1, y, '#d09a2c'); t.set(x + 1, y, '#d09a2c'); t.set(x, y - 1, '#d09a2c'); t.set(x, y + 1, '#d09a2c');
    t.set(x, y, cor);
  }
}

const cacheAnim = new Map();
function faixaAnimada(tipo) {
  if (cacheAnim.has(tipo)) return cacheAnim.get(tipo);
  const [w, h, cx, anims, desenho, op = {}] = ANIMADOS[tipo];
  const lista = [], indice = {};
  for (const [an, ps] of Object.entries(anims)) ps.forEach((p) => { (indice[an] ??= []).push(lista.length); lista.push(p); });
  const c = document.createElement('canvas');
  c.width = w * lista.length; c.height = h;
  const g = c.getContext('2d');
  lista.forEach((p, k) => {
    const t = new Tela(w, h); desenho(t, p);
    if (p.tonto) estrelas(t, op.cabeca ?? [w / 2, 4], p.tonto);
    t.relevo(op.relevo); t.contorno(); g.drawImage(t.canvas(), k * w, 0);
  });
  const f = { canvas: c, w, h, cx, n: lista.length, indice, esquerda: !!op.esquerda, fps: op.fps ?? 3 };
  cacheAnim.set(tipo, f);
  return f;
}

// faixas dos inimigos/fauna animados (para a folha de contato em fx/macacos.js)
export function faixasHumanoides() { return Object.keys(ANIMADOS).map((tipo) => ({ tipo, ...faixaAnimada(tipo) })); }

// Sprite animado: textura própria (clone que compartilha a imagem) para trocar o quadro.
function criarSpriteAnimado(ent, tipo, escala) {
  const f = faixaAnimada(tipo);
  if (!f.tex) {
    f.tex = new THREE.CanvasTexture(f.canvas);
    f.tex.magFilter = THREE.NearestFilter; f.tex.minFilter = THREE.NearestFilter; f.tex.generateMipmaps = false;
    f.tex.colorSpace = THREE.SRGBColorSpace;
  }
  const tex = f.tex.clone();
  tex.repeat.set(1 / f.n, 1);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  s.center.set(f.cx / f.w, 0);
  s.scale.set(f.w / 32 * escala, f.h / 32 * escala, 1);
  ent._animI = { f, tex, fase: 0, t: 0, tipo };
  ent.quadros = true;   // Entidade.animarSprite atenua a deformação procedural
  return s;
}

const _dir = new THREE.Vector3();
// Escolhe o quadro do inimigo animado: golpe > investida > preparo > ar > andar > parado.
// "golpe" vale no animarGolpe ou logo depois de o preparo acabar (tiro, mordida, bote).
// Chamado por Inimigo.atualizarVisual. Vira o sprite para o lado do jogador ao atacar
// (fauna, desenhada para a esquerda, é virada por Fauna.atualizarVisual).
export function animarInimigo(ent, dt) {
  const A = ent._animI, s = ent.sprite;
  if (!A || !s) return;
  A.t += dt;
  const { f } = A;
  // quem tem máquina de estados própria escolhe o quadro: ent.quadroAnimado() -> [animação, i]
  const q = ent.quadroAnimado?.(A.t);
  if (q && f.indice[q[0]]) { const l = f.indice[q[0]]; A.tex.offset.x = l[q[1] % l.length] / f.n; return; }
  if ((A.prep ?? 0) > 0 && ent.preparo <= 0 && ent.atordoado <= 0) A.pos = 0.22;
  A.prep = ent.preparo;
  A.pos = Math.max(0, (A.pos ?? 0) - dt);
  const h = Math.hypot(ent.vel.x, ent.vel.z);
  let an = 'andar', i = 0;
  if (ent.atordoado > 0 && f.indice.tonto) { an = 'tonto'; i = Math.floor(A.t * 6); }
  else if (((ent._anim?.golpe ?? 0) > 0 || A.pos > 0) && f.indice.golpe) an = 'golpe';
  else if (ent.mastigando > 0 && f.indice.golpe) an = Math.floor(A.t * 7) % 2 ? 'golpe' : 'parado';
  else if (ent.investida > 0 && f.indice.investida) { an = 'investida'; i = Math.floor(A.t * 10); }
  else if (ent.preparo > 0 && ent.atordoado <= 0) { an = 'preparo'; i = Math.floor(A.t * 8); }
  else if (f.indice.ar && ent.noChao === false && !ent.voa) an = 'ar';
  else if (f.indice.andar && h > 0.25 && ent.noChao !== false) { A.fase += h * dt / 1.1; i = Math.floor(A.fase * 4); }
  else if (f.indice.parado) { an = 'parado'; i = Math.floor(A.t * f.fps); }
  const lst = f.indice[an] ?? f.indice.andar ?? f.indice.parado;
  A.tex.offset.x = lst[i % lst.length] / f.n;
  if (f.esquerda) return;
  // lado: para onde anda ou, atacando, para o jogador
  const cam = ent.jogo.camera?.cam, j = ent.jogo.jogador;
  if (!cam) return;
  const r = _dir.setFromMatrixColumn(cam.matrixWorld, 0);
  let lado = ent.vel.x * r.x + ent.vel.z * r.z;
  if ((an !== 'andar' || h < 0.25) && j) lado = (j.pos.x - ent.pos.x) * r.x + (j.pos.z - ent.pos.z) * r.z;
  if (Math.abs(lado) > 0.15) s.scale.x = Math.abs(s.scale.x) * (lado < 0 ? -1 : 1);
}

// tamanho de mundo (largura, altura) = pixels / 32
const cache = new Map();
export function texturaInimigo(tipo) {
  if (!cache.has(tipo)) {
    const d = DESENHOS[tipo] ?? DESENHOS.guardiao;
    const t = new Tela(d[0], d[1]);
    d[2](t);
    const tex = new THREE.CanvasTexture((t.relevo(), t.contorno(), t.canvas()));
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.tamanho = [d[0] / 32, d[1] / 32];
    cache.set(tipo, tex);
  }
  return cache.get(tipo);
}

export const TIPOS_INIMIGO = Object.keys(DESENHOS);

// Sprite de pé (ancorado nos pés). `escala` multiplica o tamanho natural.
export function criarSpriteInimigo(tipo, escala = 1) {
  const tex = texturaInimigo(tipo);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  s.center.set(0.5, 0);
  s.scale.set(tex.tamanho[0] * escala, tex.tamanho[1] * escala, 1);
  return s;
}

export function aplicarSpriteInimigo(ent, tipo, escala = 1) {
  if (ent.sprite) ent.objeto.remove(ent.sprite);
  ent.sprite = ANIMADOS[tipo] ? criarSpriteAnimado(ent, tipo, escala) : criarSpriteInimigo(tipo, escala);
  ent.objeto.add(ent.sprite);
  return ent.sprite;
}

// ---------------------------------------------------------------- Ato II: fauna do veio Seiva
// (src/entities/fauna.js). Todos desenhados virados para a ESQUERDA da tela.
const PELO = ['#1f140c', '#3a2414', '#5a381e', '#7a5028', '#9a6a36', '#b88a4c'];
const FOLHA = ['#1c2a12', '#2c4018', '#415826', '#577131', '#6d8a3d', '#8fb055'];
const CASCO = ['#2a2012', '#43321a', '#5e4624', '#7a5c30', '#94733e'];
const PELE = ['#243a1a', '#35542a', '#4a7038', '#62904a', '#82b060'];
const CARNE = ['#4a0e14', '#7a1a20', '#b0302c', '#e0503c', '#ff8a6a'];
const QUITINA = ['#2a140a', '#4a2410', '#703a18', '#9a5420', '#c47a30', '#e8a850'];
const OSSO = '#e9e1cf';
const AMBAR = ['#5a2a0a', '#b05a20', '#f0a040', '#fff0b0'];

Object.assign(DESENHOS, {
  // Javali-raiz: dorso com raízes e musgo, presas de osso
  javali: [44, 30, (t) => {
    t.re(10, 20, 4, 9, PELO, 1); t.re(17, 21, 4, 8, PELO, 1); t.re(28, 21, 4, 8, PELO, 1); t.re(34, 20, 4, 9, PELO, 1);   // patas
    t.el(24, 16, 16, 9, PELO);                                              // corpo
    t.el(9, 17, 8, 6.5, PELO);                                              // cabeça
    t.el(3, 19, 3, 2.5, ['#5a3828', '#7a4a38', '#9a6a58']);                 // focinho
    t.set(2, 19, TINTA); t.set(4, 19, TINTA);
    t.linha(5, 21, 2, 16, OSSO); t.linha(6, 21, 3, 17, OSSO);               // presa
    t.set(9, 14, '#ffd24a'); t.set(10, 14, '#ffd24a');                      // olho
    t.el(12, 10, 2, 3, PELO);                                               // orelha
    for (let x = 14; x < 38; x += 3) t.linha(x, 8 + ((x * 7) % 3), x + 1, 3 + ((x * 5) % 4), FOLHA[2 + (x % 3)]);   // raízes/brotos no dorso
    t.el(24, 9, 10, 2.5, FOLHA);                                            // musgo no lombo
    t.linha(40, 14, 43, 12, PELO[2]);                                       // rabo
  }],
  // Planta-carnívora: haste, folhas e cabeça-boca vermelha com dentes
  planta: [30, 40, (t) => {
    t.linha(15, 39, 15, 18, FOLHA[3]); t.linha(16, 39, 16, 18, FOLHA[2]);
    t.el(8, 34, 7, 3, FOLHA); t.el(23, 32, 7, 3, FOLHA);                    // folhas no pé
    t.el(15, 12, 12, 10, CARNE);                                            // cabeça
    for (let x = 5; x <= 25; x += 3) { t.set(x, 12, OSSO); t.set(x + 1, 13, OSSO); }   // dentes
    t.linha(4, 12, 26, 12, CARNE[0]);                                       // boca
    for (const [x, y] of [[9, 6], [18, 5], [22, 9], [12, 18], [20, 17]]) { t.set(x, y, OSSO); t.set(x + 1, y, '#f0d0c0'); }   // pintas
    t.el(15, 23, 5, 2, FOLHA);                                              // colarinho
  }],
  // Sapo-bombástico: vermelho com costas verdes e papo que incha
  sapo: [26, 20, (t) => {
    t.el(19, 16, 5, 3, PELE); t.el(6, 17, 4, 2.5, PELE);                    // patas
    t.el(13, 12, 10, 7, CARNE);                                             // corpo
    t.el(15, 9, 7, 3.5, PELE);                                              // costas verdes
    t.el(7, 15, 4.5, 3, ['#c07a3a', '#e8b060', '#ffd890']);                 // papo
    t.el(6, 6, 3, 3, CARNE); t.el(12, 5, 3, 3, CARNE);                      // olhos saltados
    t.set(6, 6, TINTA); t.set(12, 5, TINTA); t.set(5, 5, OSSO); t.set(11, 4, OSSO);
    for (const [x, y] of [[16, 8], [20, 10], [13, 10]]) t.set(x, y, '#ffd24a');   // verrugas de veneno
  }],
  // Aranha-gigante: abdômen listrado, oito patas, olhos vermelhos
  aranha: [46, 30, (t) => {
    for (const [x0, y0, x1, y1, x2, y2] of [[16, 16, 6, 6, 1, 28], [18, 17, 10, 8, 7, 29], [26, 17, 34, 8, 38, 29], [28, 16, 40, 6, 45, 28],
      [17, 18, 9, 14, 3, 22], [27, 18, 36, 14, 43, 22], [20, 18, 14, 20, 12, 29], [24, 18, 30, 20, 32, 29]]) {
      t.linha(x0, y0, x1, y1, QUITINA[2]); t.linha(x1, y1, x2, y2, QUITINA[1]); t.linha(x1 + 1, y1, x2 + 1, y2, QUITINA[3]);
    }
    t.el(31, 13, 10, 8, QUITINA);                                           // abdômen
    for (let x = 25; x < 40; x += 4) t.linha(x, 7, x + 1, 20, QUITINA[5]);  // listras
    t.el(17, 16, 6, 5, QUITINA);                                            // cefalotórax
    t.set(13, 14, '#ff4a3a'); t.set(15, 13, '#ff4a3a'); t.set(14, 16, '#ff4a3a'); t.set(12, 16, '#c02a20');
    t.linha(11, 19, 10, 22, QUITINA[0]); t.linha(14, 19, 14, 22, QUITINA[0]);   // quelíceras
  }],
  // Tartaruga-menor: casco de placas com um broto (e uma ruinazinha) em cima
  tartaruga: [40, 26, (t) => {
    t.el(8, 22, 4, 3, PELE); t.el(30, 22, 4, 3, PELE);                      // patas
    t.el(20, 16, 15, 8, CASCO);                                             // casco
    for (let x = 9; x < 32; x += 6) t.linha(x, 11, x + 2, 22, CASCO[0]);    // placas
    t.linha(6, 19, 34, 19, CASCO[1]);
    t.el(4, 16, 4.5, 3.5, PELE); t.set(2, 15, TINTA); t.set(3, 14, OSSO);   // cabeça, olho
    t.re(16, 5, 3, 5, ['#4f4535', '#655845', '#7c6d56', '#948468']);         // ruína em miniatura
    t.set(17, 6, '#e0b050');
    t.linha(24, 9, 24, 3, FOLHA[2]); t.el(24, 3, 3, 2, FOLHA);              // arvorezinha
    t.linha(36, 18, 39, 19, PELE[2]);                                       // rabo
  }],
  // Inseto-luz
  inseto: [12, 10, (t) => {
    t.el(6, 5, 3, 2.5, ['#1a2a4a', '#2a4a8a', '#4a7ad0']);
    t.el(9, 6, 2.5, 2, ['#60c0ff', '#a0e8ff', '#f0ffff']);
    t.el(5, 2, 2, 1.5, ['#90b0d0', '#d0e8f8']);
  }],
  // Ninho: tigela de gravetos com ovos
  ninho: [32, 16, (t) => {
    t.el(16, 11, 15, 4.5, CASCO);
    for (let x = 2; x < 30; x += 2) t.linha(x, 8 + (x % 3), x + 3, 14 - (x % 2), CASCO[(x >> 1) % 2 ? 1 : 3]);
    t.el(11, 7, 3.5, 4, ['#b0a890', '#d8d0b8', '#f4eedc']); t.el(18, 6, 3.5, 4.5, ['#b0a890', '#d8d0b8', '#f4eedc']); t.el(24, 8, 3, 3.5, ['#b0a890', '#d8d0b8', '#f4eedc']);
    t.set(18, 4, '#7a9a5a'); t.set(11, 6, '#7a9a5a');
  }],
});

// A Matriarca: colosso de pedra e raiz, com mata nos ombros e núcleo âmbar no peito.
// Pose: by (tronco desce: respiração/peso), sw (mata balança), olho (0 apagado, 1 aceso,
// 2 em brasa), perna (ergue a perna esquerda), impacto (poeira e rachaduras no pé),
// braco ('alto' = braço direito erguido, 'golpe' = punho enterrado com raízes brotando),
// esporos (1 = mata incha e pulsa, 2 = nuvem solta dos ombros).
const PED = ['#1e2418', '#2e3824', '#44503a', '#5c6a4c', '#78885e', '#96a676'];
const RZ = ['#1a120b', '#2e2014', '#46321e', '#5e4428', '#7a5a36'];
const ESPORO = ['#4a7a28', '#7cc048', '#c8f080', '#f0ffc0'];
function matriarcaPose(t, p = {}) {
  const sw = p.sw ?? 0, olho = p.olho ?? 0, pl = p.perna ?? 0, esp = p.esporos ?? 0;
  const by = (p.by ?? 0) - Math.round(pl * 0.25);
  // pernas-pilar (a esquerda pode subir)
  t.re(38, 132 - pl, 26, 50, PED, 2); t.re(88, 132, 26, 50, PED, 2);
  for (let y = 138; y < 180; y += 8) { t.linha(39, y - pl, 62, y - pl, PED[1]); t.linha(89, y, 112, y, PED[1]); }
  t.el(75, 92 + by, 52, 46, PED);                                                   // tronco
  t.el(30, 60 + by, 22, 18, PED); t.el(120, 60 + by, 22, 18, PED);                  // ombros
  t.re(10, 66 + by, 22, 70, PED, 2); t.el(20, 138 + by, 13, 10, PED);               // braço esquerdo
  for (let y = 70; y < 132; y += 10) t.linha(11, y + by, 30, y + by, PED[1]);
  if (p.braco === 'alto') {                                                          // braço direito erguido
    t.re(118, 8 + by, 22, 60, PED, 2); t.el(129, 8 + by, 13, 10, PED);
    for (let y = 14; y < 62; y += 10) t.linha(119, y + by, 138, y + by, PED[1]);
  } else if (p.braco === 'golpe') {                                                 // punho enterrado no chão
    t.re(118, 66 + by, 22, 104 - by, PED, 2); t.el(129, 172, 15, 10, PED);
    for (let y = 72; y < 164; y += 10) t.linha(119, y + by, 138, y + by, PED[1]);
  } else {
    t.re(118, 66 + by, 22, 70, PED, 2); t.el(130, 138 + by, 13, 10, PED);
    for (let y = 70; y < 132; y += 10) t.linha(119, y + by, 138, y + by, PED[1]);
  }
  for (let y = 60; y < 130; y += 11) t.linha(34, y + by, 116, y + 2 + by, PED[1]);  // juntas dos blocos
  t.el(75, 44 + by, 15, 12, PED);                                                   // cabeça
  // olhos em fenda: apagados / acesos / em brasa
  if (olho === 0) t.re(64, 42 + by, 22, 3, [AMBAR[0], AMBAR[1], AMBAR[2]], 1);
  else {
    t.re(63, 41 + by, 24, 4, olho > 1 ? [AMBAR[1], AMBAR[2], AMBAR[3]] : [AMBAR[0], AMBAR[1], AMBAR[2], AMBAR[3]], olho > 1 ? 1 : 2);
    t.linha(66, 42 + by, 84, 42 + by, AMBAR[3]);
    if (olho > 1) {   // brasa escorrendo dos olhos, sobrancelha de pedra baixa
      t.linha(58, 38 + by, 64, 41 + by, AMBAR[2]); t.linha(92, 38 + by, 86, 41 + by, AMBAR[2]);
      t.linha(62, 38 + by, 74, 40 + by, PED[0]); t.linha(88, 38 + by, 76, 40 + by, PED[0]);
      t.set(68, 46 + by, AMBAR[1]); t.set(68, 47 + by, AMBAR[1]); t.set(82, 46 + by, AMBAR[1]);
    }
  }
  if (olho > 1) for (const [dx, dy] of [[-22, -14], [20, -16], [-24, 8], [24, 10], [-8, 24], [10, 22], [0, -26]]) {   // rachaduras em brasa
    t.linha(75, 86 + by, 75 + dx, 86 + dy + by, AMBAR[1]); t.linha(75, 87 + by, 75 + dx * 0.7, 87 + dy * 0.7 + by, AMBAR[2]);
  }
  t.el(75, 86 + by, 13, 13, PED.slice(0, 3));                                       // anel do núcleo
  const rn = olho > 1 ? 9.5 : olho ? 8.8 : 8;
  t.el(75, 86 + by, rn, rn, olho ? AMBAR.slice(1) : AMBAR); t.el(75, 86 + by, 3 + (olho > 1), 3 + (olho > 1), [AMBAR[2], AMBAR[3]]);
  // raízes enroscadas pelo corpo todo
  const raiz = (x, y, n, dx, s = 0) => { for (let k = 0; k < n; k++) { t.set(x + Math.round(s * k / n), y, RZ[2 + (k % 2)]); t.set(x + 1 + Math.round(s * k / n), y, RZ[1]); y++; x += Math.round(Math.sin(k * 0.35 + dx) * 1.2); } };
  for (let k = 0; k < 16; k++) raiz(20 + ((k * 37) % 112), 48 + ((k * 23) % 50) + by, 26 + ((k * 13) % 50), k);
  // raízes pendendo das mãos (balançam com a mata)
  for (let k = 0; k < 8; k++) { if (k > 3 && p.braco) continue; raiz(12 + ((k * 17) % 20) + (k > 3 ? 106 : 0), 120 + by, 20 + k * 3, k, sw * 2); }
  // cascatas escorrendo dos ombros
  for (const x of [48, 100]) for (let y = 58 + by; y < 150; y++) { t.set(x, y, '#c8e8e0'); t.set(x + 1, y, '#90c8c0'); if ((y + (p.agua ?? 0)) % 5 === 0) t.set(x + 2, y, '#e8fffa'); }
  // mata nos ombros e na cabeça (incha soltando esporos)
  const inc = esp === 1 ? 2 : 0;
  for (const [cx, cy, rx, ry, m] of [[28, 44, 18, 12, 1], [122, 44, 18, 12, 1], [75, 28, 16, 10, 0.5], [50, 52, 10, 7, 0.5], [100, 52, 10, 7, 0.5], [14, 54, 8, 6, 1], [136, 54, 8, 6, 1]]) {
    if (p.braco === 'alto' && cx > 110) { t.el(cx - 4, cy + by + 2, rx * 0.7, ry * 0.8, FOLHA); continue; }
    t.el(cx + Math.round(sw * m), cy + by, rx + inc, ry + inc, FOLHA);
  }
  for (const [x, h] of [[24, 18], [70, 22], [84, 16], [118, 20], [36, 12]]) {
    const tx = x + sw * 2;
    t.linha(x, 40 + by, tx, 40 - h + by, RZ[3]); t.el(tx, 40 - h + by, 6 + inc * 0.5, 5 + inc * 0.5, FOLHA);
  }
  if (esp === 1) for (let k = 0; k < 22; k++) t.set(12 + ((k * 53) % 126), 30 + ((k * 29) % 30) + by, ESPORO[2 + (k % 2)]);
  if (esp === 2) for (const [cx, cy, r] of [[28, 24, 9], [122, 22, 10], [75, 10, 8], [48, 12, 6], [104, 8, 6], [10, 36, 5], [140, 34, 5]]) {
    t.el(cx, cy + by, r, r * 0.8, ESPORO);
    for (let k = 0; k < 5; k++) t.set(cx - r + ((k * 7) % (2 * r)), cy + by - r + ((k * 5) % r), ESPORO[3]);
  }
  // pisão: poeira e rachaduras em volta do pé
  if (p.impacto) {
    for (const [cx, cy, rx, ry] of [[20, 176, 20, 8], [84, 175, 18, 9], [10, 164, 10, 6], [70, 164, 10, 6], [128, 178, 16, 6], [40, 158, 7, 4]]) t.el(cx, cy, rx, ry, ['#6a5a40', '#8a7a5a', '#b0a07a', '#d0c098']);
    t.linha(50, 182, 30, 183, TINTA); t.linha(52, 182, 70, 180, TINTA); t.linha(44, 183, 36, 176, '#3a2e20');
    for (let k = 0; k < 8; k++) t.set(8 + k * 17, 150 + ((k * 11) % 16), '#b0a07a');
  }
  // chicote: raízes brotando do chão em volta do punho
  if (p.braco === 'golpe') for (const [x, h] of [[100, 22], [108, 34], [114, 26], [146, 30], [140, 40], [122, 18], [96, 14]]) { t.linha(x, 183, x + 2, 183 - h, RZ[3]); t.linha(x + 1, 183, x + 3, 183 - h, RZ[2]); t.set(x + 2, 182 - h, RZ[4]); }
  if (p.braco === 'alto' && olho > 1) for (let k = 0; k < 6; k++) t.set(118 + k * 4, 2 + (k % 2) * 2 + by, AMBAR[2]);   // raízes crispando no punho
}
ANIMADOS.matriarca = [150, 184, 75, {
  calma: [{ olho: 0 }, { by: 1, sw: 1, agua: 1 }, { by: 2, sw: 2, agua: 2 }, { by: 1, sw: -1, agua: 3 }],
  despertar: [{ olho: 1, by: 1 }, { olho: 2, by: -1, sw: 1 }],
  ira: [{ olho: 2, by: 1, sw: 1, agua: 1 }, { olho: 1, by: 0, sw: -1, agua: 3 }],
  pisaoPrep: [{ olho: 2, perna: 10, sw: -1 }, { olho: 2, perna: 14, sw: 1 }],
  pisao: [{ olho: 2, by: 3, impacto: 1, sw: 2 }],
  chicotePrep: [{ olho: 2, braco: 'alto', sw: -1 }, { olho: 2, braco: 'alto', by: -1, sw: 1 }],
  chicote: [{ olho: 2, braco: 'golpe', by: 2, sw: 2 }],
  esporosPrep: [{ olho: 1, esporos: 1, sw: 1 }, { olho: 2, esporos: 1, by: 1, sw: -1 }],
  esporos: [{ olho: 2, esporos: 2, by: -1 }],
}, matriarcaPose, { esquerda: true, fps: 1.6 }];
// Tartaruga-menor: parado (pisca), andar (patas alternadas), nadar (nadadeiras e marola),
// recolher (cabeça e patas para dentro do casco quando empurrada).
const AGUA = ['#4a8a9a', '#7ab8c4', '#b8e4ea'];
function tartarugaPose(t, p = {}) {
  const [a, b] = p.patas ?? [0, 0], by = p.by ?? 0, rc = p.recolhe;
  if (p.nada) { t.el(6 + a, 21, 5, 1.6, PELE); t.el(33 + b, 21, 5, 1.6, PELE); }
  else if (rc) { t.el(10, 22, 2.5, 1.5, PELE.slice(0, 3)); t.el(29, 22, 2.5, 1.5, PELE.slice(0, 3)); }
  else { t.el(8 + a, 22 - (a < 0 ? 1 : 0), 4, 3, PELE); t.el(30 + b, 22 - (b < 0 ? 1 : 0), 4, 3, PELE); }
  t.el(20, 16 + by, 15, 8, CASCO);                                                    // casco
  for (let x = 9; x < 32; x += 6) t.linha(x, 11 + by, x + 2, 22 + by, CASCO[0]);      // placas
  for (let x = 11; x < 32; x += 6) t.set(x, 13 + by, CASCO[4]);                        // brilho das placas
  t.linha(6, 19 + by, 34, 19 + by, CASCO[1]); t.linha(8, 20 + by, 32, 20 + by, CASCO[3]);
  if (rc) { t.el(6, 18 + by, 2, 2, ['#0c0b09', '#1a150c']); t.set(6, 17 + by, OSSO); }   // só o olho no escuro do casco
  else {
    const hx = 4 + (p.cab ?? 0);
    t.el(hx, 16 + by, 4.5, 3.5, PELE); t.set(hx - 2, 15 + by, p.pisca ? PELE[1] : TINTA); if (!p.pisca) t.set(hx - 1, 14 + by, OSSO);
    t.linha(hx - 3, 18 + by, hx - 1, 18 + by, PELE[0]);                                 // boca
  }
  t.re(16, 5 + by, 3, 5, ['#4f4535', '#655845', '#7c6d56', '#948468']);                // ruína em miniatura
  t.set(17, 6 + by, '#e0b050');
  t.linha(24, 9 + by, 24 + (p.sw ?? 0), 3 + by, FOLHA[2]); t.el(24 + (p.sw ?? 0), 3 + by, 3, 2, FOLHA);   // arvorezinha
  if (!rc) t.linha(36, 18 + by, 39, 19 + by + (p.rabo ?? 0), PELE[2]);                  // rabo
  if (p.nada) for (let x = 2; x < 40; x++) if ((x + (p.onda ?? 0)) % 5 < 3) t.set(x, 24, AGUA[(x + (p.onda ?? 0)) % 5 === 1 ? 2 : 1]);
}

// Inseto-luz: asas batendo (alto / meio / baixo), abdômen aceso.
function insetoPose(t, p = {}) {
  const asa = p.asa ?? 0;
  t.el(6, 5, 3, 2.5, ['#1a2a4a', '#2a4a8a', '#4a7ad0']);
  t.el(9, 6, 2.5, 2, ['#60c0ff', '#a0e8ff', '#f0ffff']);
  const W = ['#90b0d0', '#d0e8f8', '#f4fbff'];
  if (asa === 0) { t.el(5, 1.8, 2, 1.6, W); t.el(7, 1.6, 1.6, 1.4, W); }
  else if (asa === 1) { t.el(4, 3, 2.6, 1, W); t.el(7.5, 3, 2, 1, W); }
  else { t.el(5, 7.6, 2.2, 1.2, W); }
  t.set(4, 4, OSSO);                                                                   // olho
}

// Ninho: ovos que mexem de leve e um deles pulsando (vida lá dentro); pisado = sacode.
const OVO = ['#b0a890', '#d8d0b8', '#f4eedc'];
function ninhoPose(t, p = {}) {
  const [o1, o2, o3] = p.ov ?? [0, 0, 0];
  t.el(16, 11, 15, 4.5, CASCO);
  t.el(11 + o1, 7, 3.5, 4, OVO); t.el(18 + o2, 6 - (p.pula ?? 0), 3.5, 4.5, p.pulso ? ['#c0b890', '#e8e0b8', '#fffbe6'] : OVO); t.el(24 + o3, 8, 3, 3.5, OVO);
  t.set(18 + o2, 4 - (p.pula ?? 0), '#7a9a5a'); t.set(11 + o1, 6, '#7a9a5a');
  if (p.pulso) { t.set(17 + o2, 6 - (p.pula ?? 0), '#fff0b0'); t.set(19 + o2, 8 - (p.pula ?? 0), AMBAR[2]); }
  if (p.racha) { t.linha(17 + o2, 5, 19 + o2, 7, CASCO[1]); t.set(18 + o2, 8, CASCO[1]); }
  for (let x = 2; x < 30; x += 2) t.linha(x, 10 + (x % 3), x + 3, 14 - (x % 2), CASCO[(x >> 1) % 2 ? 1 : 3]);   // gravetos na frente dos ovos
}

Object.assign(ANIMADOS, {
  tartaruga: [40, 26, 20, {
    parado: [{}, {}, {}, { pisca: true }, {}, { cab: -1 }],
    andar: [{ patas: [0, 0] }, { patas: [-2, 1], cab: -1, by: -1 }, { patas: [0, 0] }, { patas: [1, -2], cab: -1, by: -1, rabo: 1 }],
    nadar: [0, 1, 2, 3].map((k) => ({ nada: true, patas: [[0, -2, 0, 2][k], [0, 2, 0, -2][k]], onda: k * 2, cab: -1, sw: k % 2 })),
    recolher: [{ recolhe: true, by: 1 }, { recolhe: true }],
  }, tartarugaPose, { esquerda: true, fps: 2 }],
  inseto: [12, 10, 6, {
    parado: [{ asa: 0 }, { asa: 1 }, { asa: 2 }, { asa: 1 }],
  }, insetoPose, { esquerda: true, fps: 16, relevo: 0 }],
  ninho: [32, 16, 16, {
    parado: [{}, { ov: [1, 0, 0] }, {}, { pulso: true }, { ov: [0, 0, -1] }, { pulso: true, pula: 1 }],
    golpe: [{ ov: [-1, 1, 1], pula: 1, racha: true }, { ov: [1, -1, 0], racha: true }],
  }, ninhoPose, { fps: 3 }],
});

// Para quem não é Inimigo (tartaruga, inseto, ninho): escolhe o quadro pela animação e
// pelo tempo (fps da faixa, ou `fps` dado).
export function quadroFauna(ent, an, tempo, fps) {
  const A = ent._animI;
  if (!A) return;
  const l = A.f.indice[an] ?? A.f.indice.parado ?? A.f.indice.andar;
  A.tex.offset.x = l[Math.floor(tempo * (fps ?? A.f.fps)) % l.length] / A.f.n;
}

TIPOS_INIMIGO.push('javali', 'planta', 'sapo', 'aranha', 'tartaruga', 'inseto', 'ninho', 'matriarca');
// quadro 0 dos animados também serve de sprite estático (mesmas medidas)
for (const [tipo, [w, h, , , desenho]] of Object.entries(ANIMADOS)) DESENHOS[tipo] = [w, h, (t) => desenho(t)];
