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
  construtor: [22, 22, (t) => {
    t.linha(4, 14, 1, 20, QUANTA[1]); t.linha(18, 14, 21, 20, QUANTA[1]);
    t.el(11, 10, 7, 7, ['#6a6f7a', '#9aa3ae', '#c8ced6', '#e9e1cf']);
    t.el(11, 10, 3, 3, [QUANTA[1], QUANTA[2], QUANTA[3], QUANTA[4]]);
    t.set(1, 21, '#b08bc4'); t.set(21, 21, '#b08bc4');
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

// tamanho de mundo (largura, altura) = pixels / 32
const cache = new Map();
export function texturaInimigo(tipo) {
  if (!cache.has(tipo)) {
    const d = DESENHOS[tipo] ?? DESENHOS.guardiao;
    const t = new Tela(d[0], d[1]);
    d[2](t);
    t.contorno();
    const tex = new THREE.CanvasTexture(t.canvas());
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
  ent.sprite = criarSpriteInimigo(tipo, escala);
  ent.objeto.add(ent.sprite);
  return ent.sprite;
}
