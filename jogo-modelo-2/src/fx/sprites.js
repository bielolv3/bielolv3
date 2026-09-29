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
  const olho = p.aviso ? [BRASA[1], BRASA[2], BRASA[3]] : [BRASA[0], BRASA[1], BRASA[2]];
  t.re(10, 9 + by, 9, 2, olho, 1); t.set(14, 9 + by, BRASA[3]); t.set(15, 9 + by, BRASA[3]);
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
  t.el(11, 9 + by, 5.5, 6, MANTO);                                            // capuz
  t.el(11, 10.5 + by, 3.2, 3.5, ['#0c0b09', '#15120d', '#1d190f']);
  const olho = p.brilho ? QUANTA[4] : QUANTA[3];
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

// tipo -> [largura, altura, centroX (px), { animação: [poses] }, desenho(t, pose)]
const ANIMADOS = {
  guardiao: [44, 42, 15, {
    andar: [{}, { by: -1, pes: [[-1, 1], [1, 0]], braco: 1 }, {}, { by: -1, pes: [[1, 0], [-1, 1]], braco: -1 }],
    preparo: [{ alabarda: 'alto', aviso: true, by: 1 }],
    golpe: [{ alabarda: 'golpe', aviso: true, by: 1, pes: [[2, 0], [-1, 0]] }],
  }, guardiaoPose],
  acolito: [24, 44, 12, {
    andar: [{}, { by: -1, passo: -1 }, {}, { by: -1, passo: 1 }],
    preparo: [{ conjura: true }, { conjura: true, brilho: true }],
  }, acolitoPose],
};
DESENHOS.guardiao[2] = (t) => guardiaoPose(t);
DESENHOS.acolito[2] = (t) => acolitoPose(t);

const cacheAnim = new Map();
function faixaAnimada(tipo) {
  if (cacheAnim.has(tipo)) return cacheAnim.get(tipo);
  const [w, h, cx, anims, desenho] = ANIMADOS[tipo];
  const lista = [], indice = {};
  for (const [an, ps] of Object.entries(anims)) ps.forEach((p) => { (indice[an] ??= []).push(lista.length); lista.push(p); });
  const c = document.createElement('canvas');
  c.width = w * lista.length; c.height = h;
  const g = c.getContext('2d');
  lista.forEach((p, k) => { const t = new Tela(w, h); desenho(t, p); t.contorno(); g.drawImage(t.canvas(), k * w, 0); });
  const f = { canvas: c, w, h, cx, n: lista.length, indice };
  cacheAnim.set(tipo, f);
  return f;
}

// faixas dos humanoides animados (para a folha de contato em fx/macacos.js)
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
  ent._animI = { f, tex, fase: 0, t: 0 };
  ent.quadros = true;   // Entidade.animarSprite atenua a deformação procedural
  return s;
}

const _dir = new THREE.Vector3();
// Escolhe o quadro do inimigo animado: golpe > preparo > andar (passo pela distância).
// Chamado por Inimigo.atualizarVisual. Vira o sprite para o lado do jogador ao atacar.
export function animarInimigo(ent, dt) {
  const A = ent._animI, s = ent.sprite;
  if (!A || !s) return;
  A.t += dt;
  const { f } = A;
  const h = Math.hypot(ent.vel.x, ent.vel.z);
  let an = 'andar', i = 0;
  if ((ent._anim?.golpe ?? 0) > 0 && f.indice.golpe) an = 'golpe';
  else if (ent.preparo > 0 && ent.atordoado <= 0) { an = 'preparo'; i = Math.floor(A.t * 8); }
  else if (h > 0.25 && ent.noChao !== false) { A.fase += h * dt / 1.1; i = Math.floor(A.fase * 4); }
  const lst = f.indice[an] ?? f.indice.andar;
  A.tex.offset.x = lst[i % lst.length] / f.n;
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
  // A Matriarca: colosso de pedra e raiz, com mata nos ombros e núcleo âmbar no peito
  matriarca: [150, 184, (t) => {
    const PED = ['#1e2418', '#2e3824', '#44503a', '#5c6a4c', '#78885e', '#96a676'];
    const RZ = ['#1a120b', '#2e2014', '#46321e', '#5e4428', '#7a5a36'];
    t.re(38, 132, 26, 50, PED, 2); t.re(88, 132, 26, 50, PED, 2);           // pernas-pilar
    for (let y = 138; y < 180; y += 8) { t.linha(39, y, 62, y, PED[1]); t.linha(89, y, 112, y, PED[1]); }
    t.el(75, 92, 52, 46, PED);                                              // tronco
    t.el(30, 60, 22, 18, PED); t.el(120, 60, 22, 18, PED);                  // ombros
    t.re(10, 66, 22, 70, PED, 2); t.re(118, 66, 22, 70, PED, 2);            // braços
    t.el(20, 138, 13, 10, PED); t.el(130, 138, 13, 10, PED);                // punhos
    for (let y = 70; y < 132; y += 10) { t.linha(11, y, 30, y, PED[1]); t.linha(119, y, 138, y, PED[1]); }
    for (let y = 60; y < 130; y += 11) t.linha(34, y, 116, y + 2, PED[1]);   // juntas dos blocos
    t.el(75, 44, 15, 12, PED);                                              // cabeça
    t.re(64, 42, 22, 3, [AMBAR[0], AMBAR[1], AMBAR[2]], 1);                 // olhos em fenda
    t.el(75, 86, 13, 13, PED.slice(0, 3));                                  // anel do núcleo
    t.el(75, 86, 8, 8, AMBAR); t.el(75, 86, 3, 3, [AMBAR[2], AMBAR[3]]);   // núcleo
    // raízes enroscadas pelo corpo todo
    const raiz = (x, y, n, dx) => { for (let k = 0; k < n; k++) { t.set(x, y, RZ[2 + (k % 2)]); t.set(x + 1, y, RZ[1]); y++; x += Math.round(Math.sin(k * 0.35 + dx) * 1.2); } };
    for (let k = 0; k < 16; k++) raiz(20 + ((k * 37) % 112), 48 + ((k * 23) % 50), 26 + ((k * 13) % 50), k);
    for (let k = 0; k < 8; k++) raiz(12 + ((k * 17) % 20) + (k > 3 ? 106 : 0), 120, 20 + k * 3, k);
    // cascatas escorrendo dos ombros
    for (const x of [48, 100]) for (let y = 58; y < 150; y++) { t.set(x, y, '#c8e8e0'); t.set(x + 1, y, '#90c8c0'); if (y % 5 === 0) t.set(x + 2, y, '#e8fffa'); }
    // mata nos ombros e na cabeça
    for (const [cx, cy, rx, ry] of [[28, 44, 18, 12], [122, 44, 18, 12], [75, 28, 16, 10], [50, 52, 10, 7], [100, 52, 10, 7], [14, 54, 8, 6], [136, 54, 8, 6]]) t.el(cx, cy, rx, ry, FOLHA);
    for (const [x, h] of [[24, 18], [70, 22], [84, 16], [118, 20], [36, 12]]) { t.linha(x, 40, x, 40 - h, RZ[3]); t.el(x, 40 - h, 6, 5, FOLHA); }
  }],
});
TIPOS_INIMIGO.push('javali', 'planta', 'sapo', 'aranha', 'tartaruga', 'inseto', 'ninho', 'matriarca');
