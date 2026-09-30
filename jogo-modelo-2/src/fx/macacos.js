import * as THREE from 'three';
import { faixasHumanoides } from './sprites.js';

// Hugo, Chico e Orlando desenhados por código, quadro a quadro, na MESMA densidade
// dos tiles (32 px = 1 unidade de mundo), com contorno de tinta de 1 px e sem
// anti-aliasing. Cada quadro é montado a partir de partes paramétricas (cabeça,
// tronco, braços, pernas, mãos, pés) posicionadas por um esqueleto simples
// (pose = deslocamentos + alvos das mãos e pés, com IK de dois ossos).
//
// Vistas: 'f' (3/4 de frente, virado para a direita da tela), 'c' (3/4 de costas,
// virado para a direita) e 'p' (perfil, virado para a direita). Esquerda = espelho no
// shader (animarMaterial).
// Luz: cada vista é desenhada com luz vindo da esquerda e da direita; o jogador
// escolhe a variante que, depois do espelho, bate com o lado do sol na tela.
//
// Uso: const a = atlasMacaco('hugo', 'normal');  a.tex (CanvasTexture)
//      a.quadro(tex, 'andar', i, 'f', -1)  ajusta offset/repeat da textura.

export const CEL_W = 80, CEL_H = 64, COLS = 8;
export const ANCORA_X = 32;          // x dos pés dentro da célula (sobra espaço à frente)
const CHAO = 62;

const TINTA = '#0c0b09';
const OSSO = '#e9e1cf';

// ---------------------------------------------------------------- paletas (escuro -> claro)
const PAL = {
  // pretos levantados um degrau: no tamanho real (32 px/tile, luz da sala multiplicando)
  // os tons de baixo viravam uma mancha só
  moletom: ['#15161c', '#24262e', '#343741', '#4a4e5a', '#666c79'],
  calca: ['#121318', '#1e2026', '#2b2e36', '#3b3e48'],
  pretoH: ['#111216', '#1c1d23', '#292b33', '#383b45', '#4d515c'],
  // Chico: preto quente (pardo), para não virar a mesma mancha do moletom do Hugo
  chicoPelo: ['#141112', '#221d1d', '#322a29', '#463b38', '#5f524c'],
  peito: ['#5f6874', '#8b95a1', '#b3bcc6', '#d6dce1'],
  tenis: ['#0f1013', '#1c1d22', '#2c2e35'],
  prata: ['#2a2d35', '#4a4f5a', '#77808c', '#9aa3ad'],
  chicoPele: ['#1f292b', '#2f4144', '#445c5f', '#5f7c7f', '#7f9c9e'],
  chicoPeito: ['#16171b', '#22242a', '#30333a', '#40444c'],
  laranja: ['#4e1604', '#8a2606', '#c43808', '#ee4f0c', '#ff7a2a', '#ffa060'],
  orlPele: ['#141c21', '#1f2d33', '#2e4249', '#445e65', '#5f7d84'],
  lingua: ['#5a1014', '#a0242a', '#d8483e', '#f08470'],
  mostarda: ['#5a3e0c', '#946814', '#d09a2c', '#f0c666'],
  brasa: ['#5a1a0e', '#c04a2c', '#ff7a4a', '#ffd0a0'],
  quanta: ['#1d3d40', '#2a6468', '#4fa6ab', '#a8ecea'],
};
const BOCA = '#2a0a0c';
const RIM = '#f4e8cc';   // luz de recorte (sol quente)
// força do recorte por macaco: os escuros precisam de mais para a silhueta ler
const FORCA_RECORTE = { hugo: 0.4, chico: 0.5, orlando: 0.28 };

// ---------------------------------------------------------------- tela de pixels
class Tela {
  constructor(w, h, luz) {
    this.w = w; this.h = h;
    this.px = new Array(w * h).fill(null);
    this.dono = new Int16Array(w * h).fill(-1);
    this.id = 0;
    // luz: -1 = vem da esquerda da tela, +1 = da direita. Sempre um pouco de cima e da frente.
    const L = [luz * 0.78, -0.6, 0.35], n = Math.hypot(...L);
    this.L = L.map((v) => v / n);
    this.luz = luz;
  }
  parte() { return ++this.id; }
  set(x, y, cor) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !cor) return;
    this.px[y * this.w + x] = cor; this.dono[y * this.w + x] = this.id;
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]; }
  // índice na rampa a partir da normal (nx, ny, nz)
  tom(rampa, nx, ny, nz, ajuste = 0) {
    const b = nx * this.L[0] + ny * this.L[1] + nz * this.L[2];
    const i = Math.round((rampa.length - 1) * (0.42 + b * 0.72) + ajuste);
    return rampa[Math.max(0, Math.min(rampa.length - 1, i))];
  }
  // elipse (ou superelipse, p > 2 = mais quadrada) sombreada como volume
  el(cx, cy, rx, ry, rampa, { p = 2, ajuste = 0, nova = true } = {}) {
    if (nova) this.parte();
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = Math.pow(Math.abs(nx), p) + Math.pow(Math.abs(ny), p);
      if (d > 1) continue;
      const e = Math.pow(d, 1 / p), m = Math.hypot(nx, ny) || 1;
      const qx = nx / m * e, qy = ny / m * e, qz = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy));
      this.set(x, y, this.tom(rampa, qx, qy, qz, ajuste));
    }
    return this.id;
  }
  // cápsula afunilada (membros)
  cap(x0, y0, x1, y1, r0, r1, rampa, { ajuste = 0, nova = true } = {}) {
    if (nova) this.parte();
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, R = Math.max(r0, r1);
    for (let y = Math.floor(Math.min(y0, y1) - R - 1); y <= Math.max(y0, y1) + R + 1; y++) for (let x = Math.floor(Math.min(x0, x1) - R - 1); x <= Math.max(x0, x1) + R + 1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
      const qx = x0 + dx * t, qy = y0 + dy * t, r = r0 + (r1 - r0) * t;
      const vx = (px - qx) / r, vy = (py - qy) / r, d = vx * vx + vy * vy;
      if (d > 1) continue;
      this.set(x, y, this.tom(rampa, vx, vy, Math.sqrt(1 - d), ajuste));
    }
    return this.id;
  }
  linha(x0, y0, x1, y1, cor) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, cor);
  }
  // triângulo chapado (pontas de pelo, cabelo)
  tri(ax, ay, bx, by, cx, cy, cor) {
    const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx));
    const y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
    const s = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.set(x, y, cor);
    }
  }
  // linha escura na borda da parte `id` onde ela encosta em algo desenhado antes (atrás)
  vinco(id, cor) {
    const { w, h } = this, marcar = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.dono[i] !== id) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const o = this.dono[Y * w + X];
        if (o >= 0 && o < id && this.px[Y * w + X] !== TINTA) { marcar.push(i); break; }
      }
    }
    for (const i of marcar) this.px[i] = cor;
  }
  // luz de recorte (rim light): 1 px claro na borda da silhueta do lado do sol e um toque
  // mais fraco no topo. Roda antes do contorno (a borda ainda encosta no vazio).
  recorte(forca = 0.4, cor = RIM) {
    const { w, h, luz } = this, marcar = [];
    const [rr, rg, rb] = rgb(cor);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = this.px[y * w + x];
      if (!c || c === TINTA || c === OSSO) continue;
      const lado = !this.get(x + luz, y), topo = !this.get(x, y - 1), diag = !this.get(x + luz, y - 1);
      const k = lado ? forca : topo ? forca * 0.55 : diag ? forca * 0.35 : 0;
      if (k) marcar.push([y * w + x, c, k]);
    }
    for (const [i, c, k] of marcar) {
      const [r, g, b] = rgb(c);
      const m = (a, z) => Math.round(a + (z - a) * k).toString(16).padStart(2, '0');
      this.px[i] = '#' + m(r, rr) + m(g, rg) + m(b, rb);
    }
  }
  contorno() {
    const { w, h } = this, fora = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (this.px[y * w + x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = this.get(x + dx, y + dy); return c && c !== TINTA; })) fora.push(y * w + x);
    }
    for (const i of fora) this.px[i] = TINTA;
  }
}

// IK de dois ossos iguais: junta entre a e b, dobrando para o lado `dir` (x) / `dirY`
function junta(ax, ay, bx, by, L, dir, dirY = 1) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.001;
  if (d > 2 * L) { bx = ax + dx / d * 2 * L; by = ay + dy / d * 2 * L; dx = bx - ax; dy = by - ay; d = 2 * L; }
  const h = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
  let px = -dy / d, py = dx / d;
  if (px * dir < 0 || (Math.abs(px) < 0.2 && py * dirY < 0)) { px = -px; py = -py; }
  return { jx: (ax + bx) / 2 + px * h, jy: (ay + by) / 2 + py * h, bx, by };
}

// ---------------------------------------------------------------- corpos
// Medidas em pixels acima do chão. `mao`/`pe` = raios; `L` = comprimento de cada osso.
const CORPOS = {
  hugo: {
    normal: {
      altura: 48, quadril: { x: 5, y: 13 }, perna: { L: 6.5, r0: 3.8, r1: 3.2, rampa: PAL.calca }, pe: { x: 5, rx: 4.5, ry: 2.2, rampa: PAL.tenis, sola: OSSO },
      tronco: { y: 25, rx: 14.5, ry: 12, p: 3.1, rampa: PAL.moletom },
      ombro: { x: 12, y: 33 }, braco: { L: 8, r0: 4, r1: 3.4, rampa: PAL.moletom }, mao: { r: 3, rampa: PAL.pretoH },
      cabeca: { y: 40 }, bolso: true, passo: 3,
    },
    surto: {
      altura: 56, quadril: { x: 6, y: 13 }, perna: { L: 6.5, r0: 4.6, r1: 3.8, rampa: PAL.pretoH }, pe: { x: 6, rx: 5, ry: 2.4, rampa: PAL.orlPele },
      tronco: { y: 29, rx: 17, ry: 14, p: 2.6, rampa: PAL.pretoH },
      ombro: { x: 16, y: 38 }, braco: { L: 10, r0: 5.6, r1: 4.6, rampa: PAL.pretoH }, mao: { r: 4.4, rampa: PAL.orlPele },
      cabeca: { y: 46 }, passo: 3.5, pesado: true,
    },
  },
  chico: {
    normal: {
      altura: 40, quadril: { x: 4, y: 11 }, perna: { L: 5.5, r0: 2.8, r1: 2.4, rampa: PAL.chicoPelo }, pe: { x: 4, rx: 3.5, ry: 1.8, rampa: PAL.chicoPele },
      tronco: { y: 19, rx: 7, ry: 9, p: 2.1, rampa: PAL.chicoPelo },
      ombro: { x: 7.5, y: 25 }, braco: { L: 8.6, r0: 2.6, r1: 2.2, rampa: PAL.chicoPelo }, mao: { r: 2.5, rampa: PAL.chicoPele },
      cabeca: { y: 32 }, passo: 3.5,
    },
    surto: {
      altura: 44, quadril: { x: 4, y: 11 }, perna: { L: 5.5, r0: 3, r1: 2.6, rampa: PAL.chicoPelo }, pe: { x: 4, rx: 3.7, ry: 1.9, rampa: PAL.chicoPele },
      tronco: { y: 20, rx: 8, ry: 9.5, p: 2.1, rampa: PAL.chicoPelo },
      ombro: { x: 8.5, y: 26 }, braco: { L: 9.6, r0: 2.9, r1: 2.4, rampa: PAL.chicoPelo }, mao: { r: 2.7, rampa: PAL.chicoPele },
      cabeca: { y: 33 }, passo: 4, juba: true,
    },
  },
  orlando: {
    normal: {
      altura: 46, quadril: { x: 6, y: 12 }, perna: { L: 6.2, r0: 3.8, r1: 3.2, rampa: PAL.laranja }, pe: { x: 6, rx: 4.3, ry: 2.2, rampa: PAL.orlPele },
      tronco: { y: 24, rx: 13, ry: 12, p: 2.4, rampa: PAL.laranja },
      ombro: { x: 12.5, y: 31 }, braco: { L: 11.2, r0: 4.2, r1: 3.4, rampa: PAL.laranja }, mao: { r: 3.4, rampa: PAL.orlPele },
      cabeca: { y: 38 }, passo: 3.2, franja: true,
    },
    surto: {
      altura: 50, quadril: { x: 7, y: 12 }, perna: { L: 6.5, r0: 4.2, r1: 3.6, rampa: PAL.laranja }, pe: { x: 7, rx: 4.8, ry: 2.4, rampa: PAL.orlPele },
      tronco: { y: 26, rx: 14.5, ry: 13, p: 2.4, rampa: PAL.laranja },
      ombro: { x: 14, y: 34 }, braco: { L: 12, r0: 4.8, r1: 4, rampa: PAL.laranja }, mao: { r: 4, rampa: PAL.orlPele },
      cabeca: { y: 41 }, passo: 3.4, franja: true, exo: true, pesado: true,
    },
  },
};

// ---------------------------------------------------------------- troncos e cabeças
// c = { nome, forma, vista, ns (lado do braço próximo), tx, ty, hx, hy, pose }
function tronco(t, d, c) {
  const { tx, ty, vista, pose } = c, T = d.tronco;
  const ry = T.ry + (pose.estica ?? 0);
  const id = t.el(tx, ty, T.rx, ry, T.rampa, { p: T.p });
  const frente = vista === 'f';
  if (c.nome === 'hugo' && c.forma === 'normal') {
    const M = PAL.moletom;
    if (frente) {
      // moletom aberto: peito claro, bordas do zíper, cordões do capuz, bolsos
      t.el(tx + 2, ty, 4.5, ry - 4, PAL.peito, { nova: false, ajuste: -0.5 });
      t.linha(tx - 4, ty - ry + 4, tx - 3, ty + ry - 3, M[0]); t.linha(tx + 8, ty - ry + 4, tx + 7, ty + ry - 3, M[0]);
      t.linha(tx - 3, ty - ry + 3, tx - 3, ty - ry + 7, OSSO); t.linha(tx + 6, ty - ry + 3, tx + 6, ty - ry + 7, PAL.peito[2]);
      for (let x = Math.round(tx - T.rx + 3); x <= tx + T.rx - 3; x++) t.set(x, ty + ry - 2, x % 2 ? M[1] : M[0]);   // barra canelada
      t.linha(tx - 10, ty + 4, tx - 6, ty + 5, M[0]); t.linha(tx + 9, ty + 4, tx + 11, ty + 3, M[0]);                  // bolsos
    } else {
      t.linha(tx, ty - ry + 3, tx, ty + ry - 3, M[1]);                                                                  // costura
      t.el(tx - 1, ty - ry + 4, 7, 4, M, { nova: false, ajuste: 0.4 });                                                   // capuz caído
      for (let x = Math.round(tx - T.rx + 3); x <= tx + T.rx - 3; x++) t.set(x, ty + ry - 2, x % 2 ? M[1] : M[0]);
    }
  } else if (c.nome === 'hugo') {
    if (frente) {
      // peitoral de costas-prateadas: dois peitorais claros e barriga
      t.el(tx - 1, ty - 4, 5.5, 4.5, PAL.peito, { nova: false }); t.el(tx + 6, ty - 4, 5, 4.5, PAL.peito, { nova: false });
      t.el(tx + 2, ty + 5, 7, 5, PAL.peito, { nova: false, ajuste: -0.4 });
      t.linha(tx + 2, ty - 7, tx + 2, ty + 9, PAL.peito[0]); t.linha(tx - 3, ty + 2, tx + 8, ty + 2, PAL.peito[1]);
    } else {
      for (let k = 0; k < 7; k++) t.linha(tx - 9 + k * 3, ty - 9 + (k % 2), tx - 7 + k * 3, ty + 4 - (k % 3), PAL.prata[1 + (k % 2)]);   // lombo prateado
      t.linha(tx, ty - ry + 2, tx, ty + ry - 4, PAL.pretoH[0]);
    }
  } else if (c.nome === 'chico') {
    if (frente) t.el(tx + 1.5, ty + 0.5, 4.5, 5.5, PAL.chicoPeito, { nova: false });
    else t.linha(tx, ty - ry + 2, tx, ty + ry - 2, PAL.chicoPelo[0]);
    if (d.juba) for (let k = -3; k <= 3; k++) t.tri(tx + k * 3 - 1.5, ty - ry + 3, tx + k * 3 + 1.5, ty - ry + 3, tx + k * 3 + (frente ? -1 : 1), ty - ry - 2 - (k % 2 ? 0 : 2), PAL.chicoPelo[k % 2 ? 1 : 2]);
  } else if (c.nome === 'orlando') {
    const L = PAL.laranja;
    if (frente) t.el(tx + 1.5, ty + 5, 9, 6.5, L, { nova: false, ajuste: 0.35 });   // barrigão
    // pelagem longa: mechas verticais na parte de baixo, gola em V
    for (let x = Math.round(tx - T.rx + 3); x < tx + T.rx - 2; x += 3) t.linha(x, ty + 2 + (x % 2), x + (frente ? 0 : 1), ty + ry - 2, L[1]);
    if (frente) {
      t.linha(tx - 7, ty - ry + 3, tx + 1, ty - 1, L[1]); t.linha(tx + 9, ty - ry + 3, tx + 2, ty - 1, L[1]);
      t.linha(tx + 1, ty - 1, tx + 1, ty + ry - 3, L[2]);
    } else t.linha(tx, ty - ry + 3, tx, ty + ry - 4, L[1]);
    if (d.exo) {   // exoesqueleto: placa de peito de bronze
      if (frente) { t.el(tx + 2, ty - 3, 6, 4, PAL.mostarda, { nova: false }); t.set(tx + 2, ty - 3, PAL.quanta[3]); t.set(tx + 3, ty - 3, PAL.quanta[2]); }
      else { t.linha(tx - 8, ty - 5, tx + 8, ty - 5, PAL.mostarda[1]); t.linha(tx - 8, ty - 4, tx + 8, ty - 4, PAL.mostarda[2]); }
    }
  }
  return id;
}

function cabeca(t, d, c) {
  const { hx, hy, vista, pose } = c;
  const frente = vista === 'f';
  const ex = pose.expr;
  const fx = hx + 2;   // o rosto fica deslocado para o lado em que olha (3/4)
  let id;
  if (c.nome === 'hugo' && c.forma === 'normal') {
    const M = PAL.moletom;
    if (frente) {
      t.el(hx - 1, hy - 1, 10, 9, M, { p: 2.2 });                           // capuz
      id = t.el(hx + 0.5, hy + 0.5, 7.5, 7, PAL.pretoH);                    // cabeça
      t.vinco(id, M[0]);
      rostoGorila(t, fx, hy, ex, PAL.peito, PAL.pretoH);
    } else {
      id = t.el(hx - 1, hy - 1, 10, 9, M, { p: 2.2 });
      t.linha(hx - 1, hy - 9, hx - 1, hy + 6, M[1]);
      t.el(hx - 1, hy + 6, 7, 2.5, M, { nova: false, ajuste: -0.6 });
    }
  } else if (c.nome === 'hugo') {
    // crista sagital e cabeça pequena projetada à frente
    id = t.el(hx + 1, hy, 7, 6.5, PAL.pretoH, { p: 2.2 });
    t.el(hx, hy - 5, 4, 3, PAL.pretoH, { nova: false, ajuste: 0.5 });
    if (frente) rostoGorila(t, fx + 1, hy, ex ?? 'bravo', PAL.orlPele, PAL.pretoH, true);
    else t.linha(hx - 3, hy - 4, hx + 4, hy - 4, PAL.prata[2]);
  } else if (c.nome === 'chico') {
    const P = PAL.chicoPele;
    if (d.juba) {   // juba espetada do Frenesi
      for (let k = 0; k < 13; k++) {
        const a = -Math.PI * 1.1 + k * Math.PI * 0.18, r = 11.5 + (k % 3) * 2;
        t.tri(hx + Math.cos(a - 0.3) * 6, hy + Math.sin(a - 0.3) * 6, hx + Math.cos(a + 0.3) * 6, hy + Math.sin(a + 0.3) * 6, hx + Math.cos(a) * r, hy + Math.sin(a) * r, PAL.chicoPelo[1 + (k % 3)]);
      }
    }
    t.el(hx - 8, hy + 1, 2.4, 2.8, P, { ajuste: -0.3 });                     // orelhas
    t.el(hx + 8, hy + 1, 2.4, 2.8, P, { ajuste: -0.3 });
    id = t.el(hx, hy - 0.5, 8, 7.5, PAL.chicoPelo);
    if (frente) {
      t.el(fx - 0.5, hy + 2, 5.5, 4.8, P, { nova: false });                  // cara
      // óculos de persiana: armação branca em dois triângulos, lentes pretas com frisos
      const g0 = fx - 6, g1 = fx + 5, gy = hy - 2;
      t.linha(g0, gy, g1, gy, OSSO);
      for (let x = g0; x <= g1; x++) {
        const lente = x !== fx && x !== fx - 1;
        t.set(x, gy + 1, x === g0 || x === g1 ? OSSO : lente ? TINTA : OSSO);
        if (Math.abs(x - (fx - 3.5)) < 2.1 || Math.abs(x - (fx + 3)) < 2.1) t.set(x, gy + 2, Math.abs(x - (fx - 3.5)) < 1.1 || Math.abs(x - (fx + 3)) < 1.1 ? TINTA : OSSO);
        if (lente && (x - g0) % 2 === 1) t.set(x, gy + 1, '#4a4f58');
      }
      t.set(fx - 3.5, gy + 3, OSSO); t.set(fx + 3, gy + 3, OSSO);
      // boca aberta com a língua de fora
      const by = hy + 4;
      if (ex === 'dor') { t.linha(fx - 2, by, fx + 2, by, BOCA); t.set(fx + 1, by + 1, PAL.lingua[2]); }
      else {
        t.linha(fx - 1, by, fx + 3, by, BOCA); t.linha(fx, by + 1, fx + 2, by + 1, BOCA);
        const lg = (d.juba ? 4 : 2) + (ex === 'grito' ? 1 : 0);
        for (let k = 0; k < lg; k++) { t.set(fx + 1 + (k > 1 ? 1 : 0), by + 1 + k, PAL.lingua[2]); t.set(fx + 2 + (k > 1 ? 1 : 0), by + 1 + k, PAL.lingua[1]); }
        t.set(fx + 1, by + 1, PAL.lingua[3]);
      }
      if (d.juba) { t.set(fx - 3, hy - 1, PAL.brasa[2]); t.set(fx + 3, hy - 1, PAL.brasa[2]); }   // olhos em brasa atrás das lentes
    } else {
      t.el(hx, hy - 1, 5, 4, PAL.chicoPelo, { nova: false, ajuste: -0.5 });
      t.linha(hx - 5, hy - 1, hx - 7, hy, OSSO); t.linha(hx + 5, hy - 1, hx + 7, hy, OSSO);                 // hastes dos óculos
    }
  } else if (c.nome === 'orlando') {
    const L = PAL.laranja, P = PAL.orlPele;
    if (frente) {
      t.el(hx, hy + 1, 11.5, 8.5, PAL.pretoH, { p: 2.4 });                  // bochechas (flanges)
      t.el(hx, hy - 5.5, 9, 4.5, L, { nova: false });                        // cabelo
      id = t.el(fx - 0.5, hy + 1.5, 5.5, 6.5, P);                            // cara
      t.vinco(id, P[0]);
      // óculos redondos
      for (const ox of [fx - 3, fx + 2]) {
        t.set(ox, hy - 2, OSSO); t.set(ox + 1, hy - 2, OSSO); t.set(ox - 1, hy - 1, OSSO); t.set(ox + 2, hy - 1, OSSO);
        t.set(ox - 1, hy, OSSO); t.set(ox + 2, hy, OSSO); t.set(ox, hy + 1, OSSO); t.set(ox + 1, hy + 1, OSSO);
        const vidro = ex === 'dor' ? TINTA : '#1c282e';
        t.set(ox, hy - 1, ex === 'dor' ? TINTA : '#cfe6e4'); t.set(ox + 1, hy - 1, vidro); t.set(ox, hy, vidro); t.set(ox + 1, hy, vidro);
      }
      t.set(fx, hy - 1, OSSO); t.set(fx + 1, hy - 1, OSSO);
      if (d.exo || ex === 'bravo') { t.linha(fx - 4, hy - 4, fx - 1, hy - 3, TINTA); t.linha(fx + 5, hy - 4, fx + 2, hy - 3, TINTA); }
      // boca: sorriso aberto (normal) / rugido (surto, grito)
      const by = hy + 4, larga = d.exo || ex === 'grito';
      if (ex === 'dor') t.linha(fx - 2, by, fx + 1, by, BOCA);
      else {
        t.el(fx - 0.5, by + (larga ? 0.5 : 0), larga ? 3 : 2.6, larga ? 2.2 : 1.4, [BOCA, BOCA, PAL.lingua[0]], { nova: false });
        t.linha(fx - 2, by - 1, fx + 1, by - 1, OSSO);
        if (larga) { t.linha(fx - 2, by + 2, fx + 1, by + 2, OSSO); t.set(fx - 1, by + 1, PAL.lingua[2]); }
        else t.set(fx, by, PAL.lingua[1]);
      }
    } else {
      t.el(hx, hy + 1, 10.5, 7, PAL.pretoH, { p: 2.4 });
      id = t.el(hx - 0.5, hy - 1, 7.5, 7.5, L);
      for (let k = -2; k <= 2; k++) t.linha(hx + k * 2, hy - 4, hx + k * 2 + (k > 0 ? 1 : 0), hy + 4, L[2]);
      t.linha(hx - 7, hy, hx - 9, hy + 1, OSSO); t.linha(hx + 7, hy, hx + 9, hy + 1, OSSO);
    }
  }
  return id;
}

function rostoGorila(t, fx, hy, ex, focinho, pelo, brasa = false) {
  t.linha(fx - 5, hy - 2, fx + 4, hy - 2, pelo[4]);                         // arco da sobrancelha
  if (ex === 'bravo') { t.set(fx - 4, hy - 3, pelo[4]); t.set(fx + 3, hy - 3, pelo[4]); }
  const olho = brasa ? PAL.brasa[2] : OSSO;
  if (ex === 'dor') { t.linha(fx - 4, hy - 1, fx - 2, hy - 1, pelo[0]); t.linha(fx + 1, hy - 1, fx + 3, hy - 1, pelo[0]); }
  else {
    t.set(fx - 3, hy - 1, olho); t.set(fx - 4, hy - 1, TINTA); t.set(fx + 2, hy - 1, olho); t.set(fx + 1, hy - 1, TINTA);
    if (brasa) { t.set(fx - 3, hy - 2, PAL.brasa[1]); t.set(fx + 2, hy - 2, PAL.brasa[1]); }
  }
  t.el(fx - 0.5, hy + 3, 4.2, 2.7, focinho, { nova: false, ajuste: -0.3 }); // focinho
  t.set(fx - 2, hy + 2, TINTA); t.set(fx + 1, hy + 2, TINTA);               // narinas
  if (ex === 'grito' || ex === 'bravo') {
    t.el(fx - 0.5, hy + 4, 2.6, 1.6, [BOCA, BOCA, PAL.lingua[0]], { nova: false });
    t.set(fx - 2, hy + 3, OSSO); t.set(fx + 1, hy + 3, OSSO);
  } else t.linha(fx - 2, hy + 4, fx + 1, hy + 4, focinho[0]);
}

// ---------------------------------------------------------------- perfil (vista 'p', virado para a direita)
function troncoPerfil(t, d, c) {
  const { tx, ty, pose } = c, T = d.tronco;
  const ry = T.ry + (pose.estica ?? 0), rx = Math.round(T.rx * 0.72);
  const id = t.el(tx, ty, rx, ry, T.rampa, { p: T.p });
  const fr = tx + rx, tr = tx - rx;   // borda da frente / das costas
  if (c.nome === 'hugo' && c.forma === 'normal') {
    const M = PAL.moletom;
    t.el(fr - 1.5, ty + 2, 2, ry - 6, PAL.peito, { nova: false, ajuste: -0.8 });      // peito na abertura do zíper
    t.linha(fr - 4, ty - ry + 4, fr - 4, ty + ry - 3, M[0]);
    t.linha(fr - 3, ty - ry + 3, fr - 3, ty - ry + 7, OSSO);                           // cordão do capuz
    t.el(tr + 3, ty - ry + 4, 4, 4.5, M, { nova: false, ajuste: 0.4 });                // capuz caído nas costas
    t.linha(tr + 3, ty - ry + 8, tr + 6, ty - ry + 9, M[0]);
    for (let x = Math.round(tr + 2); x <= fr - 2; x++) t.set(x, ty + ry - 2, x % 2 ? M[1] : M[0]);   // barra canelada
    t.linha(tx - 1, ty + 4, fr - 5, ty + 5, M[0]);                                      // bolso
  } else if (c.nome === 'hugo') {
    t.el(fr - 3, ty - 3, 3.5, 5, PAL.peito, { nova: false });                          // peitoral
    t.el(fr - 3, ty + 5, 3.5, 4.5, PAL.peito, { nova: false, ajuste: -0.4 });
    for (let k = 0; k < 4; k++) t.linha(tr + 2 + k * 2, ty - 9 + k, tr + 3 + k * 2, ty + 3 - (k % 2), PAL.prata[1 + (k % 2)]);   // lombo prateado
  } else if (c.nome === 'chico') {
    t.el(fr - 2, ty + 0.5, 2.5, 5, PAL.chicoPeito, { nova: false });
    if (d.juba) for (let k = 0; k < 5; k++) { const x = tr + 2 + k * 3; t.tri(x - 1.5, ty - ry + 3, x + 1.5, ty - ry + 3, x - 3, ty - ry - 1 - (k % 2 ? 0 : 2), PAL.chicoPelo[k % 2 ? 1 : 2]); }
  } else if (c.nome === 'orlando') {
    const L = PAL.laranja;
    t.el(fr - 1, ty + 4, 4, 6.5, L, { nova: false, ajuste: 0.2 });                     // barriga saltando à frente
    for (let x = Math.round(tr + 2); x < fr - 1; x += 3) t.linha(x, ty + 2 + (x % 2), x - 1, ty + ry - 2, L[1]);   // mechas
    t.linha(fr - 3, ty - ry + 3, fr - 1, ty, L[1]);
    if (d.exo) { t.el(fr - 2.5, ty - 3, 3, 4, PAL.mostarda, { nova: false }); t.set(fr - 2, ty - 3, PAL.quanta[3]); t.linha(tr + 1, ty - 5, fr - 4, ty - 5, PAL.mostarda[1]); }
  }
  return id;
}

// rosto de gorila de lado: sobrancelha, um olho, focinho saltado para a frente
function rostoGorilaLado(t, fx, hy, ex, focinho, pelo, brasa = false) {
  t.linha(fx, hy - 3, fx + 4, hy - 3, pelo[4]);
  if (ex === 'bravo') t.set(fx + 3, hy - 4, pelo[4]);
  const olho = brasa ? PAL.brasa[2] : OSSO;
  if (ex === 'dor') t.linha(fx + 1, hy - 1, fx + 3, hy - 1, pelo[0]);
  else { t.set(fx + 2, hy - 1, olho); t.set(fx + 3, hy - 1, olho); t.set(fx + 3, hy - 2, TINTA); t.set(fx + 1, hy - 1, TINTA); if (brasa) t.set(fx + 2, hy - 2, PAL.brasa[1]); }
  t.el(fx + 4, hy + 3.5, 3.6, 2.7, focinho, { nova: false, ajuste: -0.3 });
  t.set(fx + 6, hy + 2, TINTA);                                                           // narina
  if (ex === 'grito' || ex === 'bravo') {
    t.el(fx + 4.5, hy + 4.2, 2.2, 1.5, [BOCA, BOCA, PAL.lingua[0]], { nova: false });
    t.set(fx + 5, hy + 3, OSSO); t.set(fx + 3, hy + 3, OSSO);
  } else t.linha(fx + 3, hy + 4, fx + 6, hy + 4, focinho[0]);
}

function cabecaPerfil(t, d, c) {
  const { hx, hy, pose } = c, ex = pose.expr;
  let id;
  if (c.nome === 'hugo' && c.forma === 'normal') {
    const M = PAL.moletom;
    t.el(hx - 2, hy - 1, 9.5, 9, M, { p: 2.2 });                                          // capuz (aberto na frente)
    t.linha(hx - 6, hy - 7, hx - 9, hy + 2, M[1]);
    id = t.el(hx + 3, hy + 0.5, 6.5, 7, PAL.pretoH, { ajuste: -1.2 });                // rosto bem mais escuro que o capuz
    t.vinco(id, M[4]);                                                                     // borda do capuz em volta do rosto
    rostoGorilaLado(t, hx + 3.5, hy, ex, PAL.peito, PAL.pretoH);
  } else if (c.nome === 'hugo') {
    id = t.el(hx + 1.5, hy, 6.5, 6.5, PAL.pretoH, { p: 2.2 });
    t.el(hx - 1, hy - 5, 4.5, 3, PAL.pretoH, { nova: false, ajuste: 0.5 });              // crista sagital
    t.linha(hx - 4, hy - 4, hx - 1, hy - 6, PAL.prata[2]);
    rostoGorilaLado(t, hx + 3, hy, ex ?? 'bravo', PAL.orlPele, PAL.pretoH, true);
  } else if (c.nome === 'chico') {
    const P = PAL.chicoPele;
    if (d.juba) for (let k = 0; k < 9; k++) {   // juba espetada para trás
      const a = Math.PI * 0.45 + k * Math.PI * 0.16, r = 11.5 + (k % 3) * 2;
      t.tri(hx + Math.cos(a - 0.3) * 6, hy - Math.sin(a - 0.3) * 6, hx + Math.cos(a + 0.3) * 6, hy - Math.sin(a + 0.3) * 6, hx + Math.cos(a) * r, hy - Math.sin(a) * r, PAL.chicoPelo[1 + (k % 3)]);
    }
    id = t.el(hx, hy - 0.5, 7.5, 7.5, PAL.chicoPelo);
    t.el(hx + 4.5, hy + 2, 3.8, 4.5, P, { nova: false });                                 // cara
    // óculos de persiana de lado: uma lente na frente, haste até a orelha
    const gy = hy - 2;
    t.linha(hx - 2, gy + 1, hx + 4, gy, OSSO);
    t.linha(hx + 4, gy, hx + 8, gy, OSSO);
    for (let x = hx + 5; x <= hx + 7; x++) t.set(x, gy + 1, x === hx + 6 ? '#4a4f58' : TINTA);
    t.set(hx + 8, gy + 1, OSSO); t.set(hx + 5, gy + 2, OSSO); t.set(hx + 6, gy + 2, TINTA); t.set(hx + 7, gy + 2, OSSO);
    if (d.juba) t.set(hx + 6, gy + 1, PAL.brasa[2]);
    const by = hy + 4;
    if (ex === 'dor') t.linha(hx + 5, by, hx + 8, by, BOCA);
    else {
      t.linha(hx + 5, by, hx + 8, by, BOCA); t.set(hx + 8, by - 1, BOCA);
      const lg = (d.juba ? 4 : 2) + (ex === 'grito' ? 1 : 0);
      for (let k = 0; k < lg; k++) { t.set(hx + 8 + (k > 1 ? 1 : 0), by + 1 + k, PAL.lingua[2]); t.set(hx + 7 + (k > 1 ? 1 : 0), by + 1 + k, PAL.lingua[1]); }
    }
    const ore = t.el(hx - 2, hy + 1, 2.2, 2.8, P, { ajuste: -0.3 });                      // orelha
    t.vinco(ore, P[0]);
  } else if (c.nome === 'orlando') {
    const L = PAL.laranja, P = PAL.orlPele;
    id = t.el(hx - 1.5, hy - 1, 7.5, 7.5, L);                                             // cabelo / nuca
    for (let k = 0; k < 3; k++) t.linha(hx - 6 + k * 2, hy - 4, hx - 7 + k * 2, hy + 4, L[2]);
    t.el(hx + 1, hy + 1, 2.6, 8, PAL.pretoH, { p: 2.4 });                                 // bochecha (flange) de quina
    const idc = t.el(hx + 4, hy + 1.5, 4.2, 6.2, P);                                      // cara
    t.vinco(idc, P[0]);
    const ox = hx + 5;                                                                     // óculos redondos
    t.set(ox, hy - 2, OSSO); t.set(ox + 1, hy - 2, OSSO); t.set(ox - 1, hy - 1, OSSO); t.set(ox + 2, hy - 1, OSSO);
    t.set(ox - 1, hy, OSSO); t.set(ox + 2, hy, OSSO); t.set(ox, hy + 1, OSSO); t.set(ox + 1, hy + 1, OSSO);
    const vidro = ex === 'dor' ? TINTA : '#1c282e';
    t.set(ox, hy - 1, ex === 'dor' ? TINTA : '#cfe6e4'); t.set(ox + 1, hy - 1, vidro); t.set(ox, hy, vidro); t.set(ox + 1, hy, vidro);
    t.linha(ox - 2, hy - 1, hx - 1, hy, OSSO);                                             // haste
    if (d.exo || ex === 'bravo') t.linha(ox - 1, hy - 4, ox + 2, hy - 3, TINTA);
    const by = hy + 4, larga = d.exo || ex === 'grito';
    if (ex === 'dor') t.linha(hx + 5, by, hx + 7, by, BOCA);
    else {
      t.el(hx + 6, by + (larga ? 0.5 : 0), larga ? 2.2 : 1.8, larga ? 2.2 : 1.4, [BOCA, BOCA, PAL.lingua[0]], { nova: false });
      t.linha(hx + 5, by - 1, hx + 7, by - 1, OSSO);
      if (larga) t.linha(hx + 5, by + 2, hx + 7, by + 2, OSSO);
    }
  }
  return id;
}

// ---------------------------------------------------------------- montagem de um quadro
function desenharQuadro(t, nome, forma, pose, vista, ox, oy) {
  const d = CORPOS[nome][forma];
  const perfil = vista === 'p';            // perfil: virado para a direita, membro perto à esquerda da pilha
  const ns = vista === 'c' ? 1 : -1;       // lado da tela do braço/perna mais perto da câmera
  const vs = vista === 'f' ? 1 : vista === 'c' ? -1 : 0;   // passo à frente: desce (frente), sobe (costas), nada (perfil)
  const cx = ox + ANCORA_X, chao = oy + CHAO;
  const bx = pose.bx ?? 0, by = pose.by ?? 0;
  const B = d.braco, Pn = d.perna;

  const quadY = chao - d.quadril.y + by;
  const pes = pose.pes ?? [[0, 0, 0], [0, 0, 0]];
  let qN, qF, peN, peF, oN, oF;
  const oyv = chao - d.ombro.y + by;
  if (perfil) {
    // de lado: quadris e ombros empilhados; a passada abre em x (mais larga que na 3/4)
    const k = 2, qx = cx + Math.round(bx / 2);
    qN = [qx - 1, quadY]; qF = [qx + 1, quadY - 1];
    peN = [cx - 1 + pes[0][0] * k, chao - pes[0][2]];
    peF = [cx + 1 + pes[1][0] * k, chao - 1 - pes[1][2]];
    oN = [cx + bx - 1, oyv]; oF = [cx + bx + 2, oyv - 1];
  } else {
    qN = [cx + ns * d.quadril.x + Math.round(bx / 2), quadY]; qF = [cx - ns * d.quadril.x + Math.round(bx / 2), quadY - 1];
    peN = [cx + ns * d.pe.x + pes[0][0], chao + pes[0][1] * vs - pes[0][2]];
    peF = [cx - ns * (d.pe.x - 1) + pes[1][0], chao - 1 + pes[1][1] * vs - pes[1][2]];
    oN = [cx + ns * d.ombro.x + bx, oyv]; oF = [cx - ns * (d.ombro.x - 1) + bx, oyv - 1];
  }
  const R = 2 * B.L;
  let mN, mF;
  // pose.lider: maos[0] é o braço do lado para onde olha (o de trás na vista de frente)
  const troca = pose.lider && vista === 'f';
  if (pose.bolso && d.bolso) {
    if (perfil) { mN = [cx + 5 + bx, chao - d.tronco.y + 5 + by]; mF = [cx + 6 + bx, chao - d.tronco.y + 4 + by]; }
    else { mN = [cx + ns * 9 + bx, chao - d.tronco.y + 5 + by]; mF = [cx - ns * 8 + bx, chao - d.tronco.y + 4 + by]; }
  } else {
    const m0 = pose.maos ?? [[1, R * 0.88], [1, R * 0.88]];
    const m = troca ? [m0[1], m0[0]] : m0;
    // {fora: n} = para fora do corpo; de perfil "para fora" é profundidade: vira pouco x (perto à frente, longe atrás)
    // (braço erguido de perfil abre mais: um à frente, outro atrás, senão some atrás da cabeça)
    // ({fora: -n} = para dentro, na frente da barriga: de perfil vira "à frente do corpo")
    const lado = (v, s, dy) => (typeof v === 'object' ? (perfil ? (v.fora < 0 ? -v.fora * 0.45 : -v.fora * s * (dy < 0 ? 0.75 : 0.35)) : v.fora * s) : v);
    mN = [oN[0] + lado(m[0][0], ns, m[0][1]), oN[1] + m[0][1]];
    mF = [oF[0] + lado(m[1][0], -ns, m[1][1]), oF[1] + m[1][1]];
  }

  const c = {
    nome, forma, vista, ns, pose,
    tx: cx + bx + 1, ty: chao - d.tronco.y + by,
    hx: cx + bx + 1 + (pose.hx ?? 0) + (d.pesado ? 1 : 0) + (perfil ? 2 : 0), hy: chao - d.cabeca.y + by + (pose.hy ?? 0),
  };

  // membros do lado de longe ficam mais escuros (menos se o sol vem do lado deles)
  const longe = t.luz === ns ? -0.9 : -0.35;
  const aj = (perto) => (perto ? 0 : longe);
  const membro = (a, b, L, r0, r1, rampa, dir, estica = 1, ajuste = 0) => {
    const j = junta(a[0], a[1], b[0], b[1], L * estica, dir);
    t.cap(a[0], a[1], j.jx, j.jy, r0, (r0 + r1) / 2, rampa, { ajuste });
    const id = t.cap(j.jx, j.jy, j.bx, j.by, (r0 + r1) / 2, r1, rampa, { nova: false, ajuste });
    return { ...j, id };
  };
  const braco = (o, m, perto, estica = 1) => {
    const rampa = B.rampa;
    const j = membro(o, m, B.L, B.r0, B.r1, rampa, -1, estica, aj(perto));
    if (d.franja) {   // pelos longos pendurados no antebraço
      for (let k = 0; k < 4; k++) { const u = 0.3 + k * 0.18; const x = j.jx + (j.bx - j.jx) * u, y = j.jy + (j.by - j.jy) * u; t.linha(x - 1 + k % 2, y + B.r1 - 1, x - 2 + k % 2, y + B.r1 + 2, rampa[1]); }
    }
    if (d.exo) { const x = j.jx + (j.bx - j.jx) * 0.75, y = j.jy + (j.by - j.jy) * 0.75; t.el(x, y, B.r1 + 0.4, B.r1 * 0.7, PAL.mostarda, { nova: false }); }
    if (pose.bolso && d.bolso) return j.id;
    const idm = t.el(j.bx, j.by, d.mao.r, d.mao.r * 0.95, d.mao.rampa, { p: 2.3, ajuste: aj(perto) });
    if (perto) t.vinco(idm, d.mao.rampa[0]);
    return j.id;
  };
  const perna = (q, p, perto) => {
    const j = membro(q, [p[0], p[1] - d.pe.ry], Pn.L, Pn.r0, Pn.r1, Pn.rampa, 1, 1, aj(perto));
    const pr = d.pe.rampa;
    const idp = t.el(j.bx + 1.5, p[1] - d.pe.ry * 0.6, d.pe.rx, d.pe.ry, pr, { p: 2.6, ajuste: aj(perto) });
    if (d.pe.sola) t.linha(j.bx + 1.5 - d.pe.rx + 1, Math.round(p[1] - d.pe.ry * 0.6 + d.pe.ry - 0.5), j.bx + 1.5 + d.pe.rx - 1, Math.round(p[1] - d.pe.ry * 0.6 + d.pe.ry - 0.5), d.pe.sola);
    else for (let k = -1; k <= 1; k++) t.set(j.bx + 2.5 + k * 1.5, p[1] - 0.5, pr[0]);   // dedos
    t.vinco(idp, pr[0]);
    return j.id;
  };

  const costas = vista === 'c';
  const bracosAtras = costas && ((pose.bolso && d.bolso) || pose.item === 'chave');   // mãos na frente da barriga: de costas somem atrás do tronco
  const esticaLider = pose.estica ?? 1;
  const item = () => {
    if (pose.item === 'banana') { const m = troca ? mF : mN; banana(t, m[0], m[1] - d.mao.r - 1); }
    else if (pose.item === 'chave' && vista !== 'c') chave(t, (mN[0] + mF[0]) / 2, Math.min(mN[1], mF[1]) - 2, pose.giro ?? 0);
  };
  // 1) braço de trás (se for o que golpeia, vem por cima do tronco, mais adiante)
  if (!troca) braco(oF, mF, false);
  if (bracosAtras) braco(oN, mN, true);
  // 2) pernas
  perna(qF, peF, false);
  const idPn = perna(qN, peN, true);
  t.vinco(idPn, Pn.rampa[0]);
  // 3) tronco
  const idT = perfil ? troncoPerfil(t, d, c) : tronco(t, d, c);
  t.vinco(idT, d.tronco.rampa[0]);
  // 4) braço da frente e cabeça (de costas, braço erguido fica atrás da cabeça)
  const bracoAlto = mN[1] < oN[1] - 4;
  const frenteBraco = () => {
    if (bracosAtras) return;
    const id = braco(oN, mN, true, troca ? 1 : esticaLider);
    t.vinco(id, B.rampa[0]);
  };
  const lider = () => { if (!troca) return; const id = braco(oF, mF, true, esticaLider); t.vinco(id, B.rampa[0]); };
  if (perfil && bracoAlto) { const idH = cabecaPerfil(t, d, c); if (idH) t.vinco(idH, TINTA); lider(); frenteBraco(); }   // braço erguido passa à frente da cabeça
  else if (perfil) { lider(); frenteBraco(); const idH = cabecaPerfil(t, d, c); if (idH) t.vinco(idH, TINTA); }   // de lado a cabeça fica à frente do ombro
  else if (costas && bracoAlto) { frenteBraco(); cabeca(t, d, c); }
  else { const idH = cabeca(t, d, c); if (idH) t.vinco(idH, TINTA); lider(); frenteBraco(); }
  if (costas && bracoAlto) lider();
  item();
}

// chave inglesa do Orlando (ocioso): cabo prata e boca aberta; giro 0..3
function chave(t, x, y, giro) {
  const P = PAL.prata;
  t.parte();
  const [dx, dy] = [[1, -1], [1, 0], [1, 1], [0, -1]][giro % 4];
  t.linha(x - dx * 3, y - dy * 3, x + dx * 3, y + dy * 3, P[3]);
  t.linha(x - dx * 3 + dy, y - dy * 3 + dx, x + dx * 2 + dy, y + dy * 2 + dx, P[1]);
  const hx = x + dx * 4, hy = y + dy * 4;
  t.set(hx - dy, hy - dx, P[2]); t.set(hx + dy, hy + dx, P[2]); t.set(hx + dx - dy, hy + dy - dx, P[3]); t.set(hx + dx + dy, hy + dy + dx, P[3]);
}

function banana(t, x, y) {
  const M = PAL.mostarda;
  t.parte();
  t.linha(x - 3, y, x - 2, y + 1, M[2]); t.linha(x - 1, y + 1, x + 2, y + 1, M[3]); t.linha(x - 1, y + 2, x + 2, y + 2, M[2]);
  t.set(x + 3, y, M[1]); t.set(x - 3, y - 1, M[0]);
}

// ---------------------------------------------------------------- animações (poses)
// Pose: bx/by (inclina/abaixa o corpo), hx/hy (cabeça), pes [[dx, dy, levanta] perto, longe],
// maos [[dx, dy] perto, longe] relativas ao ombro ({fora: n} = para fora do corpo),
// bolso (Hugo com as mãos no bolso), expr ('dor' | 'grito' | 'bravo'), item, estica.
const r = Math.round;
function ciclo(i, n, passo, lev, balanco, extra = {}) {
  const ph = i / n * Math.PI * 2, s = Math.sin(ph), co = Math.cos(ph);
  return {
    by: r(0.5 - 0.5 * Math.cos(2 * ph) + (extra.byExtra ?? 0)),
    bx: extra.bx ?? 1,
    pes: [[r(passo * s), r(passo * s * 0.35), r(Math.max(0, co) * lev)], [r(-passo * s), r(-passo * s * 0.35), r(Math.max(0, -co) * lev)]],
    balanco: [r(-balanco * s), r(balanco * s)],
  };
}

function poses(nome, forma) {
  const d = CORPOS[nome][forma];
  const R = 2 * d.braco.L, P = d.passo;
  const pend = R * 0.88;
  const A = {};
  A.parado = [0, 1, 2, 3].map((i) => ({ by: [0, 0, 1, 1][i], hy: [0, 0, 0, 1][i] - [0, 0, 1, 1][i] + [0, 0, 1, 1][i], bolso: true, maos: [[1, pend - [0, 0, 1, 1][i]], [1, pend - [0, 0, 1, 1][i]]] }));
  if (nome === 'chico') A.parado = [0, 1, 2, 3].map((i) => ({   // inquieto: troca o peso de pé, cabeça não para
    by: [0, 1, 0, 1][i], bx: [0, 1, 1, 0][i], hx: [0, 0, 1, 0][i], hy: [0, 0, 0, -1][i],
    pes: [[0, 0, [0, 0, 1, 0][i]], [0, 0, [0, 0, 0, 1][i]]], maos: [[1, pend - [0, 1, 0, 1][i]], [2, pend - 1 - [0, 1, 0, 1][i]]],
  }));
  else if (nome === 'orlando') A.parado = [0, 1, 2, 3].map((i) => ({   // pesado: respira com a barriga, braços pendurados
    by: [0, 0, 1, 1][i], hy: [0, 0, 0, 1][i],
    maos: [[2, pend - [0, 0, 1, 1][i]], [2, pend - [0, 0, 1, 1][i]]],
  }));
  A.andar = [...Array(8)].map((_, i) => {
    const q = ciclo(i, 8, P, 2, 3);
    return { ...q, bolso: true, maos: [[1 + q.balanco[0], pend - Math.abs(q.balanco[0]) * 0.4], [1 + q.balanco[1], pend - Math.abs(q.balanco[1]) * 0.4]], hy: i % 4 === 0 ? 0 : 0 };
  });
  A.correr = [...Array(6)].map((_, i) => {
    const q = ciclo(i, 6, P * 1.5, 4, 6, { bx: 3 });
    return { ...q, by: q.by - (i % 3 === 1 ? 1 : 0), hy: 1, maos: [[3 + q.balanco[0], R * 0.6], [3 + q.balanco[1], R * 0.6]] };
  });
  A.pulo = [
    { by: -1, estica: 1, pes: [[1, 0, 2], [-1, 0, 1]], maos: [[3, -R * 0.55], [1, -R * 0.45]] },
    { by: 0, pes: [[2, 0, 5], [0, 0, 4]], maos: [[4, -R * 0.2], [2, -R * 0.1]] },
  ];
  A.queda = [
    { by: 0, pes: [[2, 0, 1], [-2, 0, 2]], maos: [[{ fora: 6 }, -R * 0.3], [{ fora: 6 }, -R * 0.25]], expr: 'grito' },
    { by: 0, pes: [[1, 0, 2], [-1, 0, 1]], maos: [[{ fora: 7 }, -R * 0.4], [{ fora: 5 }, -R * 0.15]], expr: 'grito' },
  ];
  A.pouso = [
    { by: 4, bx: 1, hy: 1, pes: [[2, 1, 0], [-2, -1, 0]], maos: [[{ fora: 4 }, R * 0.55], [{ fora: 4 }, R * 0.55]] },
    { by: 2, bx: 1, pes: [[1, 0, 0], [-1, 0, 0]], bolso: true, maos: [[2, R * 0.7], [2, R * 0.7]] },
  ];
  A.golpe = [
    { bx: -1, by: 1, pes: [[-1, 0, 0], [1, 0, 0]], maos: [[-1, R * 0.5], [2, R * 0.6]], expr: 'bravo', lider: true },
    { bx: 3, by: 1, lider: true, pes: [[3, 1, 0], [-2, 0, 0]], maos: [[R * 0.98, 1], [-3, R * 0.55]], expr: 'grito' },
    { bx: 2, by: 1, pes: [[3, 1, 0], [-2, 0, 0]], maos: [[R * 0.85, 4], [-2, R * 0.6]], expr: 'grito' },
    { bx: 1, by: 0, pes: [[1, 0, 0], [-1, 0, 0]], maos: [[R * 0.4, R * 0.6], [1, R * 0.75]] },
  ];
  A.dano = [
    { bx: -2, by: 1, hx: -1, hy: -1, pes: [[-1, 0, 0], [1, 0, 1]], maos: [[{ fora: 5 }, R * 0.25], [{ fora: 5 }, R * 0.3]], expr: 'dor' },
    { bx: -1, by: 2, hx: -1, pes: [[-1, 0, 0], [1, 0, 0]], maos: [[{ fora: 3 }, R * 0.5], [{ fora: 3 }, R * 0.55]], expr: 'dor' },
  ];
  A.guarda = [
    { by: 2, bx: 1, pes: [[2, 1, 0], [-2, -1, 0]], maos: [[6, -1], [7, 0]], expr: 'bravo' },
  ];
  A.segurar = [...Array(4)].map((_, i) => {
    const q = ciclo(i * 2, 8, P * 0.8, 2, 0);
    return { ...q, maos: [[2, -R * 0.85], [1, -R * 0.8]], hy: 0 };
  });
  A.planar = [
    { by: 0, pes: [[1, 0, 2], [-1, 0, 1]], maos: [[{ fora: R * 0.85 }, -R * 0.3], [{ fora: R * 0.8 }, -R * 0.35]], expr: 'grito' },
    { by: 0, pes: [[1, 0, 1], [-1, 0, 2]], maos: [[{ fora: R * 0.85 }, -R * 0.15], [{ fora: R * 0.8 }, -R * 0.2]], expr: 'grito' },
  ];
  A.rugido = [
    { by: 2, hy: -1, pes: [[2, 1, 0], [-2, -1, 0]], maos: [[{ fora: R * 0.7 }, R * 0.2], [{ fora: R * 0.7 }, R * 0.15]], expr: 'grito' },
    { by: 1, hy: -2, pes: [[2, 1, 0], [-2, -1, 0]], maos: [[5, R * 0.3], [4, R * 0.3]], expr: 'grito' },
  ];
  // ocioso: gesto ocasional depois de um tempo parado (Jogador.escolherQuadro)
  if (nome === 'hugo') A.ocioso = [   // impaciente: bate o pé, bufa olhando para cima
    { bolso: true, pes: [[1, 0, 2], [0, 0, 0]] }, { bolso: true }, { bolso: true, pes: [[1, 0, 2], [0, 0, 0]] }, { bolso: true },
    { bolso: true, pes: [[1, 0, 2], [0, 0, 0]] }, { bolso: true, by: -1, hy: -1, hx: 1 }, { bolso: true, by: -1, hy: -1, hx: 1, expr: 'bravo' }, { bolso: true, by: 1 },
  ];
  else if (nome === 'chico') A.ocioso = [   // coça a cabeça e olha em volta
    { maos: [[{ fora: -4 }, -R * 0.5], [1, pend]], hx: -1 }, { maos: [[{ fora: -3 }, -R * 0.58], [1, pend]], hx: -1, hy: 1 },
    { maos: [[{ fora: -4 }, -R * 0.5], [1, pend]], hx: -1 }, { maos: [[{ fora: -3 }, -R * 0.58], [1, pend]], hx: -1, hy: 1 },
    { maos: [[1, pend], [1, pend]], hx: 2 }, { maos: [[1, pend], [1, pend]], hx: 2, by: 1 },
    { maos: [[1, pend], [1, pend]], hx: -2 }, { maos: [[1, pend], [1, pend]], hx: -2, by: 1 },
  ];
  else A.ocioso = [0, 1, 2, 3, 0, 1, 2, 3].map((g, i) => ({   // mexe na chave inglesa, cabeça baixa
    by: i % 2, hy: 1, item: 'chave', giro: g,
    maos: [[{ fora: -10 }, R * 0.34 - (g % 2)], [{ fora: -10 }, R * 0.3 + (g % 2)]],
  }));
  // identidade
  if (nome === 'hugo') A.identidade = [   // Pulverizar: agacha, sobe com os punhos no alto, mergulha, esmaga
    { by: 4, bx: 1, pes: [[2, 1, 0], [-2, -1, 0]], maos: [[2, -R * 0.8], [1, -R * 0.75]], expr: 'bravo' },
    { by: -1, estica: 1, pes: [[1, 0, 3], [-1, 0, 2]], maos: [[2, -R * 0.95], [0, -R * 0.9]], expr: 'grito' },
    { by: 0, bx: 2, hy: 1, pes: [[1, 0, 5], [-1, 0, 5]], maos: [[5, R * 0.95], [4, R * 0.95]], expr: 'grito' },
    { by: 5, bx: 2, hy: 1, pes: [[3, 1, 0], [-3, -1, 0]], maos: [[7, R * 0.95], [6, R * 0.95]], expr: 'grito' },
  ];
  else if (nome === 'chico') A.identidade = [   // Tacar Banana
    { bx: -1, by: 1, pes: [[-1, 0, 0], [1, 0, 0]], maos: [[-2, -R * 0.45], [3, R * 0.6]], item: 'banana' },
    { bx: 0, by: 0, pes: [[0, 0, 0], [0, 0, 0]], maos: [[-1, -R * 0.85], [3, R * 0.5]], item: 'banana' },
    { bx: 3, by: 1, pes: [[3, 1, 0], [-2, 0, 0]], maos: [[R * 0.9, -3], [-2, R * 0.6]], expr: 'grito' },
    { bx: 2, by: 1, pes: [[2, 1, 0], [-1, 0, 0]], maos: [[R * 0.6, R * 0.5], [-1, R * 0.75]] },
  ];
  else A.identidade = [   // Agarrão: prepara, estica o braço longe, segura, recolhe
    { bx: -1, by: 1, pes: [[-1, 0, 0], [1, 0, 0]], maos: [[-2, R * 0.5], [2, R * 0.7]], expr: 'bravo' },
    { bx: 3, by: 1, pes: [[3, 1, 0], [-2, 0, 0]], maos: [[R * 1.08, 0], [-2, R * 0.6]], estica: 1.15, expr: 'grito' },
    { bx: 3, by: 1, pes: [[3, 1, 0], [-2, 0, 0]], maos: [[R * 0.98, 1], [-2, R * 0.6]], estica: 1.05, expr: 'grito' },
    { bx: 1, by: 0, pes: [[1, 0, 0], [-1, 0, 0]], maos: [[R * 0.6, R * 0.3], [1, R * 0.75]] },
  ];
  // golpe e arremessos usam o braço do lado para onde olha
  for (const p of [...A.golpe, ...(nome === 'hugo' ? [] : A.identidade)]) p.lider = true;
  return A;
}

export const VISTAS = ['f', 'c', 'p'];
export const ANIMACOES = ['parado', 'andar', 'correr', 'pulo', 'queda', 'pouso', 'golpe', 'identidade', 'dano', 'guarda', 'segurar', 'planar', 'rugido', 'ocioso'];

// ---------------------------------------------------------------- atlas
// Layout: blocos [luz esquerda: vistas f, c, p][luz direita: vistas f, c, p];
// dentro do bloco as animações vêm em sequência, 8 por linha.
const cacheAtlas = new Map();
const cacheCor = new Map();
function rgb(hex) {
  let c = cacheCor.get(hex);
  if (!c) { const n = parseInt(hex.slice(1), 16); c = [n >> 16, (n >> 8) & 255, n & 255]; cacheCor.set(hex, c); }
  return c;
}

// gerador: desenha um bloco (luz × vista) por passo, para a geração em segundo plano não travar
function* gerarFolha(nome, forma) {
  const A = poses(nome, forma);
  const lista = [];
  for (const an of ANIMACOES) A[an].forEach((p, i) => lista.push({ an, i, p }));
  const porBloco = Math.ceil(lista.length / COLS);
  const linhas = porBloco * 2 * VISTAS.length;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CEL_W; canvas.height = linhas * CEL_H;
  const g = canvas.getContext('2d');
  const img = g.createImageData(canvas.width, canvas.height), D = img.data;
  const indice = {};   // an -> [células dentro do bloco]
  lista.forEach((q, k) => { (indice[q.an] ??= []).push(k); });
  let bloco = 0;
  for (const luz of [-1, 1]) for (const vista of VISTAS) {
    lista.forEach((q, k) => {
      const cel = bloco * porBloco * COLS + k;
      const t = new Tela(CEL_W, CEL_H, luz);
      desenharQuadro(t, nome, forma, q.p, vista, 0, 0);
      t.recorte(FORCA_RECORTE[nome]);
      t.contorno();
      const ox = (cel % COLS) * CEL_W, oy = Math.floor(cel / COLS) * CEL_H;
      t.px.forEach((cor, i) => {
        if (!cor) return;
        const [r, gg, b] = rgb(cor), o = ((oy + ((i / CEL_W) | 0)) * canvas.width + ox + (i % CEL_W)) * 4;
        D[o] = r; D[o + 1] = gg; D[o + 2] = b; D[o + 3] = 255;
      });
    });
    bloco++;
    yield bloco;
  }
  g.putImageData(img, 0, 0);
  return { canvas, indice, porBloco, linhas, total: lista.length, lista };
}

export function montarFolha(nome, forma, gen = gerarFolha(nome, forma)) {
  for (;;) { const r = gen.next(); if (r.done) return r.value; }
}
const emAndamento = new Map();   // chave -> gerador parcial (preaquecerMacacos)

export function atlasMacaco(nome, forma) {
  const chave = nome + '_' + forma;
  if (cacheAtlas.has(chave)) return cacheAtlas.get(chave);
  const f = montarFolha(nome, forma, emAndamento.get(chave));
  emAndamento.delete(chave);
  const tex = new THREE.CanvasTexture(f.canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / COLS, 1 / f.linhas);
  const a = {
    ...f, tex, nome, forma,
    largura: CEL_W / 32, altura: CEL_H / 32, centroX: ANCORA_X / CEL_W,
    quadros(an) { return f.indice[an]?.length ?? 0; },
    // seleciona o quadro na textura (ou numa cópia dela)
    quadro(textura, an, i, vista, luz) {
      const lst = f.indice[an] ?? f.indice.parado;
      const k = lst[((i % lst.length) + lst.length) % lst.length];
      const bloco = (luz < 0 ? 0 : VISTAS.length) + Math.max(0, VISTAS.indexOf(vista));
      const cel = bloco * f.porBloco * COLS + k;
      const col = cel % COLS, lin = Math.floor(cel / COLS);
      textura.offset.set(col / COLS, 1 - (lin + 1) / f.linhas);
    },
  };
  cacheAtlas.set(chave, a);
  return a;
}

// gera os atlas restantes aos poucos, sem travar a troca de macaco/surto depois
export function preaquecerMacacos() {
  const fila = [];
  for (const n of ['hugo', 'chico', 'orlando']) for (const f of ['normal', 'surto']) fila.push([n, f]);
  // um bloco (~1/6 do atlas) por vez; se o jogo pedir o atlas antes, atlasMacaco termina o resto
  const prox = () => {
    const x = fila[0]; if (!x) return;
    const chave = x[0] + '_' + x[1];
    if (cacheAtlas.has(chave)) { fila.shift(); setTimeout(prox, 30); return; }
    let gen = emAndamento.get(chave);
    if (!gen) emAndamento.set(chave, gen = gerarFolha(...x));
    const r = gen.next();
    if (r.done) { emAndamento.set(chave, (function* () { return r.value; })()); atlasMacaco(...x); fila.shift(); }   // folha pronta: vira textura
    setTimeout(prox, 60);
  };
  setTimeout(prox, 400);
}

// ---------------------------------------------------------------- folha de contato (conferência)
// Um canvas com todos os quadros de todos os macacos/formas (vistas frente e costas, luz da
// esquerda), quebrados em linhas de `porLinha`, e no fim os humanoides animados da Legião/Quanta.
export function folhaDeContato(escala = 2, porLinha = 15) {
  const nomes = ['hugo', 'chico', 'orlando'], formas = ['normal', 'surto'];
  const folhas = [];
  for (const n of nomes) for (const f of formas) folhas.push({ n, f, ...montarFolha(n, f) });
  const hum = faixasHumanoides();
  const rotulo = 76, cab = 16, gap = 10;
  const faixas = folhas.reduce((s, F) => s + Math.ceil(F.total / porLinha), 0);
  const W = rotulo + porLinha * CEL_W;
  const NV = VISTAS.length;
  // faixas largas (Matriarca) quebram em várias linhas, sem sobrepor células
  for (const x of hum) { x.passo = Math.max(CEL_W, x.w + 2); x.porLinha = Math.max(1, Math.floor(porLinha * CEL_W / x.passo)); x.linhas = Math.ceil(x.n / x.porLinha); }
  const H = 24 + faixas * (cab + NV * CEL_H + gap) + folhas.length * 6 + 24 + hum.reduce((s, x) => s + (x.h + cab) * x.linhas + gap, 0);
  const c = document.createElement('canvas');
  c.width = W * escala; c.height = H * escala;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#2f2f38'; g.fillRect(0, 0, c.width, c.height);
  g.font = `${10 * escala}px monospace`; g.textBaseline = 'top';
  const texto = (s, x, y, cor) => { g.fillStyle = cor; g.fillText(s, x * escala, y * escala); };
  const celula = (img, sx, sy, w, h, dx, dy, par) => {
    g.fillStyle = par ? '#474754' : '#50505e';
    g.fillRect(dx * escala, dy * escala, w * escala, h * escala);
    g.drawImage(img, sx, sy, w, h, dx * escala, dy * escala, w * escala, h * escala);
  };
  texto('Primordia: macacos quadro a quadro, 32 px = 1 tile. Linhas: 3/4 frente / 3/4 costas / perfil (luz da esquerda; direita = espelho).', 4, 6, '#e9e1cf');
  let y = 24;
  for (const F of folhas) {
    for (let ini = 0; ini < F.total; ini += porLinha) {
      const fim = Math.min(F.total, ini + porLinha);
      let ant = ini > 0 ? F.lista[ini - 1].an : '';
      for (let k = ini; k < fim; k++) {
        const q = F.lista[k], x = rotulo + (k - ini) * CEL_W;
        if (q.an !== ant) { texto(q.an, x + 2, y + 3, '#d09a2c'); ant = q.an; }
        else texto(String(q.i + 1), x + 2, y + 3, '#7a7466');
      }
      texto(F.n, 4, y + cab + 8, '#e9e1cf'); texto(F.f, 4, y + cab + 20, '#b0a890');
      for (let v = 0; v < NV; v++) {
        texto(['frente', 'costas', 'perfil'][v], 4, y + cab + v * CEL_H + 40, '#7a7466');
        for (let k = ini; k < fim; k++) {
          const cel = v * F.porBloco * COLS + k;
          celula(F.canvas, (cel % COLS) * CEL_W, Math.floor(cel / COLS) * CEL_H, CEL_W, CEL_H, rotulo + (k - ini) * CEL_W, y + cab + v * CEL_H, (k + v) % 2);
        }
      }
      y += cab + NV * CEL_H + gap;
    }
    y += 6;
  }
  texto('Inimigos e fauna animados (fx/sprites.js): andar, parado, preparo, golpe, investida, ar, tonto; tartaruga nadar/recolher, ninho, inseto.', 4, y + 6, '#e9e1cf');
  y += 24;
  for (const Hm of hum) {
    const nomeDe = {};
    for (const [an, l] of Object.entries(Hm.indice)) l.forEach((k, i) => { nomeDe[k] = i ? String(i + 1) : an; });
    texto(Hm.tipo, 4, y + cab + 10, '#e9e1cf');
    for (let k = 0; k < Hm.n; k++) {
      const col = k % Hm.porLinha, yy = y + Math.floor(k / Hm.porLinha) * (Hm.h + cab);
      texto(nomeDe[k], rotulo + col * Hm.passo + 2, yy + 3, isNaN(+nomeDe[k]) ? '#d09a2c' : '#7a7466');
      celula(Hm.canvas, k * Hm.w, 0, Hm.w, Hm.h, rotulo + col * Hm.passo, yy + cab, k % 2);
    }
    y += (Hm.h + cab) * Hm.linhas + gap;
  }
  return c;
}

// ---------------------------------------------------------------- retratos (HUD e título)
// Busto pixel art (cabeça e ombros) tirado do mesmo gerador: pose parada de 3/4 de frente,
// luz da esquerda, recorte e contorno iguais aos do jogo, sobre um fundo chapado.
// S×S px (28 = 1× nos retratos pequenos, 2× no ativo do HUD). Devolve dataURL (cacheado).
const cacheRetrato = new Map();
const FUNDO_RETRATO = { normal: ['#5a4c36', '#6e5d42'], surto: ['#4e1a10', '#6a2616'] };
export function retratoMacaco(nome, forma = 'normal', S = 28) {
  const chave = `${nome}_${forma}_${S}`;
  if (cacheRetrato.has(chave)) return cacheRetrato.get(chave);
  const d = CORPOS[nome][forma], A = poses(nome, forma);
  const pose = { ...A.parado[0], expr: forma === 'surto' ? 'grito' : undefined };
  const t = new Tela(CEL_W, CEL_H, -1);
  desenharQuadro(t, nome, forma, pose, 'f', 0, 0);
  t.recorte(FORCA_RECORTE[nome]);
  t.contorno();
  const hx = ANCORA_X + 3 + (d.pesado ? 1 : 0), hy = CHAO - d.cabeca.y;
  const x0 = Math.round(hx - S / 2), y0 = Math.round(hy - 13);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const [f0, f1] = FUNDO_RETRATO[forma] ?? FUNDO_RETRATO.normal;
  g.fillStyle = f0; g.fillRect(0, 0, S, S);
  g.fillStyle = f1; for (let y = 0; y < S; y += 2) g.fillRect(0, y, S, 1);   // tramado de fundo
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cor = t.get(x0 + x, y0 + y);
    if (cor) { g.fillStyle = cor; g.fillRect(x, y, 1, 1); }
  }
  const url = c.toDataURL();
  cacheRetrato.set(chave, url);
  return url;
}
