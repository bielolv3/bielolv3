import * as THREE from 'three';

// Texturas pixel art geradas em canvas (nada de imagem externa).
// Atlas dos tiles: células de 32x32, 4 variações por linha, uma linha por "face".
// Um segundo atlas, com o mesmo layout, guarda o brilho (emissivo) dos circuitos Quanta.

export const CEL = 32;
export const COLS = 4;
export const LINHA = {
  pedraTopo: 0, pedraLado: 1, musgoTopo: 2, paredeTopo: 3, paredeLado: 4, paredeCornija: 5,
  circuitoTopo: 6, circuitoLado: 7, ornatoTopo: 8, colunaLado: 9, rocha: 10, colunaTopo: 11,
};
export const LINHAS = 12;

// ---------- utilidades ----------
export function rngSemente(s) {
  return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// ruído de valor periódico (emenda nas bordas da célula)
function ruido(rng, per = 4) {
  const v = Array.from({ length: per * per }, rng);
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / CEL) * per, fy = (y / CEL) * per;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = s(fx - x0), ty = s(fy - y0);
    const g = (i, j) => v[((j + per) % per) * per + ((i + per) % per)];
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}

// pinta um pixel com índice de rampa, com pontilhado ordenado
function tom(g, rampa, x, y, v) {
  const i = Math.max(0, Math.min(rampa.length - 1, Math.floor(v + bayer(x, y) - 0.5 + 0.5)));
  g.fillStyle = rampa[i]; g.fillRect(x, y, 1, 1);
}
function px(g, x, y, cor) { g.fillStyle = cor; g.fillRect(x, y, 1, 1); }

// ---------- paletas (Códice: pedra, osso, mostarda, quanta, seiva...) ----------
const PEDRA = ['#2e281f', '#463d30', '#5f5442', '#786b55', '#91846a', '#aa9d80', '#c4b797'];
const PAREDE = ['#241f18', '#393126', '#4f4535', '#655845', '#7c6d56', '#948468', '#ada07f'];
const MUSGO = ['#1f2a14', '#2f3f1c', '#415826', '#577131', '#6d8a3d', '#86a44c', '#a2bd62'];
const ROCHA = ['#1a1612', '#28221b', '#382f25', '#4a3f31', '#5c4f3d'];
const CIRC = ['#141b1c', '#1c2627', '#243233', '#2d3e3f', '#384b4b', '#465b5a'];
const QUANTA = '#4fa6ab', QUANTA_CLARO = '#a8ecea', QUANTA_ESC = '#2a6468';
const MOSTARDA = '#d09a2c', MOSTARDA_ESC = '#7a5a1c';

// ---------- desenhos por face ----------
function pedraTopo(g, r, v) {
  const n = ruido(r, 4), n2 = ruido(r, 8);
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) tom(g, PEDRA, x, y, 3.2 + (n(x, y) - 0.5) * 1.6 + (n2(x, y) - 0.5) * 0.9);
  for (let k = 0; k < 10; k++) px(g, (r() * CEL) | 0, (r() * CEL) | 0, r() < 0.5 ? PEDRA[2] : PEDRA[5]);
  if (v === 1) { // seixos
    for (let k = 0; k < 3; k++) { const x = 3 + (r() * 25) | 0, y = 3 + (r() * 25) | 0; px(g, x, y, PEDRA[5]); px(g, x + 1, y, PEDRA[4]); px(g, x, y + 1, PEDRA[1]); px(g, x + 1, y + 1, PEDRA[1]); }
  } else if (v === 2) { // rachadura
    let x = (r() * 10 + 4) | 0, y = 0;
    while (y < CEL && x > 0 && x < CEL - 1) { px(g, x, y, PEDRA[0]); px(g, x + 1, y, PEDRA[5]); y++; if (r() < 0.45) x += r() < 0.5 ? -1 : 1; }
  } else if (v === 3) { // desgaste circular (marca Precursora)
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; px(g, (16 + Math.cos(t) * 8) | 0, (16 + Math.sin(t) * 8) | 0, PEDRA[2]); }
  }
}

function pedraLado(g, r, v) {
  const n = ruido(r, 4);
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) {
    const estrato = Math.sin((y + n(x, y) * 6) * 0.9) * 0.35;
    tom(g, PEDRA, x, y, 2.6 + (n(x, y) - 0.5) * 1.3 + estrato + (CEL - y) / CEL * 0.6);
  }
  for (let x = 0; x < CEL; x++) { px(g, x, 0, PEDRA[5]); px(g, x, 1, PEDRA[4]); }
  if (v === 2) { let x = (r() * 20 + 6) | 0; for (let y = 3; y < CEL; y++) { px(g, x, y, PEDRA[0]); if (r() < 0.3) x += r() < 0.5 ? -1 : 1; } }
  if (v === 3) for (let k = 0; k < 6; k++) { const x = (r() * CEL) | 0; for (let y = 2; y < 2 + r() * 8; y++) px(g, x, y | 0, MUSGO[3 + (r() * 2 | 0)]); }
}

function musgoTopo(g, r, v) {
  const n = ruido(r, 4), n2 = ruido(r, 8);
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) tom(g, MUSGO, x, y, 3 + (n(x, y) - 0.5) * 2 + (n2(x, y) - 0.5) * 1.2);
  for (let k = 0; k < 40; k++) { const x = (r() * CEL) | 0, y = (r() * (CEL - 1)) | 0; px(g, x, y, MUSGO[5 + (r() < 0.3 ? 1 : 0)]); px(g, x, y + 1, MUSGO[2]); }
  if (v === 2) for (let k = 0; k < 5; k++) { const x = (r() * 30) | 0, y = (r() * 30) | 0; px(g, x, y, PEDRA[4]); px(g, x + 1, y, PEDRA[3]); }
  if (v === 3) for (let k = 0; k < 4; k++) { const x = (r() * 30) | 0, y = (r() * 30) | 0; px(g, x, y, '#e9e1cf'); px(g, x + 1, y + 1, MOSTARDA); }
}

function paredeTopo(g, r, v) {
  pedraTopo(g, r, 0);
  // mato e musgo tomando o topo das ruínas
  const n = ruido(r, 4);
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) {
    const m = n(x, y) + (v === 0 ? -0.25 : v === 1 ? 0.05 : 0.15);
    if (m > 0.55) tom(g, MUSGO, x, y, 2.5 + (m - 0.55) * 8);
  }
  for (let x = 0; x < CEL; x++) { px(g, x, 0, PAREDE[5]); px(g, x, CEL - 1, PAREDE[2]); }
  for (let y = 0; y < CEL; y++) { px(g, 0, y, PAREDE[5]); px(g, CEL - 1, y, PAREDE[2]); }
}

// relevo entalhado: sulco escuro com borda clara embaixo (luz vem de cima)
function sulco(g, x, y) { px(g, x, y, PAREDE[0]); px(g, x, y + 1, PAREDE[5]); }

function paredeLado(g, r, v) {
  const n = ruido(r, 4);
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) tom(g, PAREDE, x, y, 3 + (n(x, y) - 0.5) * 1.2 + (CEL - y) / CEL * 0.5);
  if (v === 1) { // faixa de meandro Precursor
    for (let x = 0; x < CEL; x++) { sulco(g, x, 9); sulco(g, x, 22); }
    for (let x = 0; x < CEL; x += 8) { for (let y = 12; y < 20; y++) sulco(g, x + 1, y); for (let k = 1; k < 5; k++) sulco(g, x + k, 12); for (let y = 12; y < 17; y++) sulco(g, x + 5, y); }
  } else if (v === 2) { // disco solar entalhado
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; sulco(g, (16 + Math.cos(t) * 9) | 0, (15 + Math.sin(t) * 9) | 0); }
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; px(g, (16 + Math.cos(t) * 3) | 0, (16 + Math.sin(t) * 3) | 0, PAREDE[1]); }
  } else if (v === 3) { // rachado, com musgo escorrendo
    let x = (r() * 16 + 8) | 0; for (let y = 0; y < CEL; y++) { px(g, x, y, PAREDE[0]); px(g, x + 1, y, PAREDE[4]); if (r() < 0.35) x += r() < 0.5 ? -1 : 1; }
    for (let k = 0; k < 8; k++) { const xx = (r() * CEL) | 0; const h = 3 + r() * 10; for (let y = 0; y < h; y++) px(g, xx, y, MUSGO[2 + ((r() * 3) | 0)]); }
  } else {
    for (let x = 0; x < CEL; x++) if (r() < 0.1) px(g, x, (r() * CEL) | 0, PAREDE[1]);
  }
}

function paredeCornija(g, r, v) {
  paredeLado(g, r, 0);
  for (let x = 0; x < CEL; x++) {
    px(g, x, 0, PAREDE[6]); px(g, x, 1, PAREDE[6]); px(g, x, 2, PAREDE[5]); px(g, x, 3, PAREDE[4]); px(g, x, 4, PAREDE[1]);
    // dentículos
    const dente = (x % 6) < 4;
    for (let y = 6; y < 10; y++) px(g, x, y, dente ? (y === 6 ? PAREDE[5] : PAREDE[4]) : PAREDE[1]);
    px(g, x, 10, PAREDE[0]);
  }
  // vegetação pendurada da borda
  const q = v === 3 ? 10 : v === 1 ? 5 : 2;
  for (let k = 0; k < q; k++) { const x = (r() * CEL) | 0, h = 2 + r() * 12; for (let y = 0; y < h; y++) px(g, x, y, MUSGO[2 + ((r() * 4) | 0)]); }
}

// circuitos: linhas cruzam o meio de cada borda, para emendar com o vizinho
function circuitoBase(g, r) {
  const n = ruido(r, 4);
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) tom(g, CIRC, x, y, 2.4 + (n(x, y) - 0.5) * 1.4);
  // moldura do painel
  for (let k = 0; k < CEL; k++) { px(g, k, 0, CIRC[5]); px(g, 0, k, CIRC[5]); px(g, k, CEL - 1, CIRC[0]); px(g, CEL - 1, k, CIRC[0]); }
}
function tracos(v) {
  // retorna lista de segmentos [x0,y0,x1,y1] para cada variação
  const M = 15;
  if (v === 0) return [[0, M, 31, M]];
  if (v === 1) return [[0, M, 31, M], [M, 0, M, 31]];
  if (v === 2) return [[0, M, M, M], [M, M, M, 31], [M, 4, 26, 4], [26, 4, 26, 10]];
  return [[M, 0, M, 9], [M, 22, M, 31], [0, M, 9, M], [22, M, 31, M]];
}
function circuitoTopo(g, r, v, emi) {
  circuitoBase(g, r);
  if (emi) { g.fillStyle = '#000'; g.fillRect(0, 0, CEL, CEL); }
  const linha = (x0, y0, x1, y1, cor, corClara) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { px(g, x, y, cor); px(g, x + (y0 === y1 ? 0 : 1), y + (y0 === y1 ? 1 : 0), corClara); }
  };
  for (const [a, b, c, d] of tracos(v)) linha(a, b, c, d, emi ? QUANTA : QUANTA_ESC, emi ? QUANTA_ESC : CIRC[5]);
  // nós
  const nos = v === 3 ? [[15, 15, 6]] : [[15, 15, 2]];
  for (const [cx, cy, rr] of nos) for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
    const d = Math.hypot(x, y);
    if (d <= rr) px(g, cx + x, cy + y, emi ? (d < rr - 1.5 ? QUANTA_CLARO : QUANTA) : (d < rr - 1 ? '#6fc4c6' : QUANTA_ESC));
  }
  if (v === 3 && !emi) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) < 3) px(g, 15 + x, 15 + y, CIRC[1]);
  if (v === 3 && emi) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) < 2.5) px(g, 15 + x, 15 + y, '#000');
}
function circuitoLado(g, r, v, emi) {
  circuitoBase(g, r);
  if (emi) { g.fillStyle = '#000'; g.fillRect(0, 0, CEL, CEL); }
  const cor = emi ? QUANTA : QUANTA_ESC;
  for (const x of v % 2 ? [8, 23] : [15]) for (let y = 3; y < CEL; y++) px(g, x, y, cor);
  for (let x = 0; x < CEL; x++) px(g, x, 2, emi ? QUANTA_ESC : CIRC[5]);
}

function ornatoTopo(g, r, v, emi) {
  pedraTopo(g, r, 0);
  if (emi) { g.fillStyle = '#000'; g.fillRect(0, 0, CEL, CEL); }
  // incrustação de latão/mostarda: losango e cantos
  const cor = emi ? '#3a2a0a' : MOSTARDA, esc = emi ? '#000' : MOSTARDA_ESC;
  for (let k = 0; k < 12; k++) { px(g, 16 + k, 4 + k, cor); px(g, 16 - k, 4 + k, cor); px(g, 16 + k, 28 - k, cor); px(g, 16 - k, 28 - k, cor); px(g, 16 + k, 5 + k, esc); px(g, 16 - k, 5 + k, esc); }
  if (v % 2) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.abs(x) + Math.abs(y) <= 2) px(g, 16 + x, 16 + y, emi ? '#5a4010' : '#e9c46a');
}

function colunaLado(g, r, v) {
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) {
    const canelura = (x % 8);
    const base = canelura === 0 ? 1.4 : canelura === 1 ? 4.6 : canelura < 5 ? 3.6 : 2.8;
    tom(g, PEDRA, x, y, base + (r() - 0.5) * 0.5);
  }
  if (v === 2) for (let k = 0; k < 10; k++) { const x = (r() * CEL) | 0; for (let y = 0; y < 6 + r() * 20; y++) px(g, x, y | 0, MUSGO[2 + ((r() * 3) | 0)]); }
  if (v === 3) { let x = 12; for (let y = 0; y < CEL; y++) { px(g, x, y, PEDRA[0]); if (r() < 0.3) x += r() < 0.5 ? -1 : 1; } }
}

function rocha(g, r, v) {
  const n = ruido(r, 4), n2 = ruido(r, 8);
  for (let y = 0; y < CEL; y++) for (let x = 0; x < CEL; x++) tom(g, ROCHA, x, y, 2.3 + (n(x, y) - 0.5) * 2 + (n2(x, y) - 0.5) + Math.sin(y * 0.7 + n(x, y) * 4) * 0.4);
  // raízes penduradas
  const q = v === 0 ? 1 : v === 1 ? 3 : 2;
  for (let k = 0; k < q; k++) { let x = (r() * CEL) | 0; for (let y = 0; y < CEL; y++) { px(g, x, y, '#3b3020'); if (r() < 0.25) x = (x + (r() < 0.5 ? -1 : 1) + CEL) % CEL; } }
}

function colunaTopo(g, r, v) { pedraTopo(g, r, 3); }

const DESENHOS = {
  pedraTopo, pedraLado, musgoTopo, paredeTopo, paredeLado, paredeCornija,
  circuitoTopo, circuitoLado, ornatoTopo, colunaLado, rocha, colunaTopo,
};
const EMISSIVOS = new Set(['circuitoTopo', 'circuitoLado', 'ornatoTopo']);

function texturaDeCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let atlasCache = null;
// { mapa, emissivo } — gerado uma vez e reaproveitado entre salas
export function atlasTiles() {
  if (atlasCache) return atlasCache;
  const cor = document.createElement('canvas'), emi = document.createElement('canvas');
  cor.width = emi.width = CEL * COLS; cor.height = emi.height = CEL * LINHAS;
  const gc = cor.getContext('2d'), ge = emi.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, emi.width, emi.height);
  for (const [nome, linha] of Object.entries(LINHA)) {
    for (let v = 0; v < COLS; v++) {
      // canvas: linha 0 fica no topo; a textura (flipY) inverte, então o shader conta de baixo
      const oy = (LINHAS - 1 - linha) * CEL, ox = v * CEL;
      for (const [g, eh] of [[gc, false], [ge, true]]) {
        if (eh && !EMISSIVOS.has(nome)) continue;
        g.save(); g.translate(ox, oy);
        g.beginPath(); g.rect(0, 0, CEL, CEL); g.clip();
        DESENHOS[nome](g, rngSemente(linha * 131 + v * 17 + 7), v, eh);
        g.restore();
      }
    }
  }
  atlasCache = { mapa: texturaDeCanvas(cor), emissivo: texturaDeCanvas(emi), canvas: cor };
  return atlasCache;
}

// ---------- sprites de decoração (billboards) ----------
const cacheSprites = new Map();
export function texturaSprite(nome) {
  if (cacheSprites.has(nome)) return cacheSprites.get(nome);
  const d = SPRITES[nome];
  const c = document.createElement('canvas');
  c.width = d.w; c.height = d.h;
  d.desenhar(c.getContext('2d'), rngSemente(nome.length * 97 + 3));
  const t = texturaDeCanvas(c);
  t.proporcao = d.w / d.h;
  cacheSprites.set(nome, t);
  return t;
}

function folha(g, x0, y0, ang, comp, cores, r) {
  // folha de samambaia: haste curva com folíolos
  let x = x0, y = y0;
  for (let k = 0; k < comp; k++) {
    const t = k / comp, a = ang + t * 0.9 * Math.sign(Math.cos(ang) || 1);
    x += Math.cos(a) * 1; y -= Math.sin(a) * 1;
    px(g, Math.round(x), Math.round(y), cores[1]);
    const lado = Math.max(1, Math.round((1 - t) * 4));
    if (k % 2 === 0) for (let s = 1; s <= lado; s++) {
      px(g, Math.round(x - Math.sin(a) * s), Math.round(y - Math.cos(a) * s), cores[s < 2 ? 2 : 3]);
      px(g, Math.round(x + Math.sin(a) * s), Math.round(y + Math.cos(a) * s), cores[s < 2 ? 1 : 0]);
    }
  }
}

const SPRITES = {
  samambaia: { w: 32, h: 24, desenhar(g, r) {
    const cores = ['#2f3f1c', '#4d6a2a', '#6d8a3d', '#8fb055'];
    const angs = [0.35, 0.8, 1.25, 1.57, 1.9, 2.35, 2.8];
    for (const a of angs) folha(g, 16, 23, a, 12 + r() * 8, cores, r);
  } },
  capim: { w: 16, h: 12, desenhar(g, r) {
    const cores = ['#415826', '#577131', '#6d8a3d', '#86a44c', '#a2bd62'];
    for (let k = 0; k < 14; k++) {
      let x = 2 + r() * 12, y = 11; const inc = (r() - 0.5) * 0.8, h = 4 + r() * 7;
      for (let s = 0; s < h; s++) { px(g, Math.round(x), Math.round(y), cores[Math.min(4, (s / h * 4 + r()) | 0)]); x += inc; y -= 1; }
    }
    if (r() < 0.6) { px(g, 5, 4, '#e9e1cf'); px(g, 11, 3, '#d09a2c'); }
  } },
  cipo: { w: 12, h: 32, desenhar(g, r) {
    const cores = ['#2f3f1c', '#415826', '#577131', '#6d8a3d'];
    for (let k = 0; k < 3; k++) { let x = 2 + k * 4; for (let y = 0; y < 18 + r() * 14; y++) { px(g, x, y, cores[1]); if (y % 3 === 0) px(g, x + (r() < .5 ? -1 : 1), y, cores[2 + (r() * 2 | 0)]); if (r() < 0.2) x += r() < 0.5 ? -1 : 1; } }
  } },
  elmo: { w: 20, h: 14, desenhar(g, r) {
    // destroço da Legião Cinzenta: elmo caído e placa
    const c = ['#3a3f47', '#5a626d', '#8b94a0', '#b4bcc6'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) { const d = Math.hypot(x - 5, (y - 7) * 1.3); if (d < 5.5) px(g, 2 + x, 5 + y, c[d < 2 ? 3 : d < 4 ? 2 : 1]); }
    for (let x = 3; x < 11; x++) px(g, x, 10, c[0]);
    px(g, 5, 9, '#c04a2c'); px(g, 8, 9, '#c04a2c');
    for (let y = 8; y < 13; y++) for (let x = 12; x < 19; x++) px(g, x, y, (x + y) % 5 ? c[1] : c[2]);
  } },
  chama: { w: 8, h: 12, desenhar(g, r) {
    const c = ['#c04a2c', '#d07a2c', '#e0b040', '#fff0b0'];
    for (let y = 0; y < 12; y++) { const larg = Math.max(0, Math.round(Math.sin((y / 12) * Math.PI) * 3.5 * (y / 12 + 0.3))); for (let x = -larg; x <= larg; x++) px(g, 4 + x, y, c[Math.min(3, Math.max(0, 3 - Math.abs(x) - (y < 4 ? 1 : 0)))]); }
  } },
  brilho: { w: 16, h: 16, desenhar(g) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5) / 8; if (d < 1 && bayer(x, y) < (1 - d) * 0.9) px(g, x, y, '#ffffff'); }
  } },
};
