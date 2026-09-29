import * as THREE from 'three';
import { atlasTiles, texturaSprite, texturaAgua, LINHA, COLS, LINHAS, rngSemente } from './texturas.js';
import { LEGENDA_DECO } from './tiles.js';
import { fixo } from '../core/liberar.js';

// Parte visual do tilemap: malha única do terreno (atlas pixel art, AO nos cantos,
// paredes da frente rebaixadas conforme o ângulo da câmera, recorte pontilhado em volta
// do jogador), decoração e poeira. A lógica (alturas, colisão) continua em tilemap.js.

// Uniformes compartilhados, atualizados uma vez por quadro em atualizarVisual()
export const U = {
  uTempo: { value: 0 },
  uJogador: { value: new THREE.Vector3(0, -99, 0) },   // centro do jogador (pés + 0.7)
  uVista: { value: new THREE.Vector3(0.6, 0.5, 0.6) },  // do alvo para a câmera, unitário
  uRaio: { value: 1.5 },                               // raio do recorte (em tiles de tela)
  uCorte: { value: new THREE.Vector4(1, 0, 1, 0) },    // peso do rebaixamento por direção (+x,-x,+z,-z)
  uCorNevoa: { value: new THREE.Color(0x6b4a1c) },
};

// aparência por tipo de chão: linha do atlas para topo, lado e (opcional) cornija
const APARENCIA = {
  pedra: { topo: LINHA.pedraTopo, lado: LINHA.pedraLado },
  musgo: { topo: LINHA.musgoTopo, lado: LINHA.pedraLado },
  parede: { topo: LINHA.paredeTopo, lado: LINHA.paredeLado, cornija: LINHA.paredeCornija },
  circuito: { topo: LINHA.circuitoTopo, lado: LINHA.circuitoLado },
  ornato: { topo: LINHA.ornatoTopo, lado: LINHA.pedraLado },
  coluna: { topo: LINHA.pedraTopo, lado: LINHA.pedraLado },
  // Ato II (bioma Seiva)
  terra: { topo: LINHA.terraTopo, lado: LINHA.terraLado },
  raiz: { topo: LINHA.raizTopo, lado: LINHA.raizLado },
  raizViva: { topo: LINHA.raizVivaTopo, lado: LINHA.raizLado },
  aguaRasa: { topo: LINHA.aguaRasaTopo, lado: LINHA.terraLado },
};
const ALTA = 2;           // blocos a partir desta altura podem ser rebaixados
const FUNDO_ABISMO = -3.5;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // mesma ordem de uCorte

const hash = (i, j, s = 0) => {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------- material do terreno ----------------
const GLSL_COMUM = /* glsl */`
uniform float uTempo; uniform vec3 uJogador; uniform vec3 uVista; uniform float uRaio;
uniform vec4 uCorte; uniform vec3 uCorNevoa;
varying vec3 vPosM; varying vec3 vNorM; varying float vTopo; varying vec4 vCel; varying vec4 vBorda;
float bayer4(vec2 p) {
  int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[i] / 16.0;
}
`;

let materialTerreno = null;
function criarMaterialTerreno() {
  if (materialTerreno) return materialTerreno;
  const { mapa, emissivo } = atlasTiles();
  const mat = new THREE.MeshLambertMaterial({ map: mapa, emissiveMap: emissivo, emissive: 0xffffff, emissiveIntensity: 2.2, vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = GLSL_COMUM + `
attribute vec4 aCel; attribute vec4 aCorteD; attribute float aBaixa; attribute float aTopo; attribute vec4 aBorda; attribute vec3 aDin;
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float fCorte = max(max(aCorteD.x * uCorte.x, aCorteD.y * uCorte.y), max(aCorteD.z * uCorte.z, aCorteD.w * uCorte.w));
      // paredes sólidas também baixam quando o jogador passa atrás delas
      vec2 hz = normalize(uVista.xz);
      vec2 dP = uJogador.xz - aDin.xy;
      float al = dot(dP, hz), lat = length(dP - hz * al);
      float fDin = aDin.z * smoothstep(2.4, 1.4, lat) * smoothstep(0.1, 0.8, -al) * smoothstep(6.5, 5.0, -al);
      float topoEf = mix(aTopo, min(aTopo, aBaixa), max(fCorte, fDin));
      transformed.y = min(transformed.y, topoEf);
      vTopo = topoEf; vCel = aCel; vBorda = aBorda; vNorM = normal;
      vPosM = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = GLSL_COMUM + sh.fragmentShader
      .replace('#include <map_fragment>', /* glsl */`
      // recorte: o que fica entre a câmera e o jogador some em pontilhado
      {
        vec3 dJ = vPosM - uJogador; float ao = dot(dJ, uVista);
        float r = length(dJ - uVista * ao);
        if (ao > 0.35 && vPosM.y > uJogador.y - 0.45 && r < uRaio) {
          float f = smoothstep(uRaio, uRaio * 0.55, r);
          if (bayer4(gl_FragCoord.xy) < f * 0.82) discard;
        }
      }
      vec3 an = abs(vNorM);
      vec2 uvl; float linha = vCel.y; float col = vCel.x; float realce = 1.0;
      if (an.y > 0.5) {
        uvl = fract(vPosM.xz);
        // borda do topo onde o vizinho é mais baixo
        float e = 1.0 / ${(32).toFixed(1)};
        float d = min(min(vBorda.x > 0.5 ? uvl.x : 1.0, vBorda.y > 0.5 ? 1.0 - uvl.x : 1.0),
                      min(vBorda.z > 0.5 ? uvl.y : 1.0, vBorda.w > 0.5 ? 1.0 - uvl.y : 1.0));
        realce = d < e ? 1.3 : d < 2.0 * e ? 1.1 : 1.0;
      } else {
        float t = max(vTopo - vPosM.y, 0.0);
        float u = an.x > 0.5 ? vPosM.z * sign(-vNorM.x) : vPosM.x * sign(vNorM.z);
        uvl = vec2(fract(u), 1.0 - fract(t));
        col = mod(col + floor(t + 0.001), ${COLS.toFixed(1)});
        if (vPosM.y < -0.02) linha = vCel.w;
        else if (t < 1.0 && vCel.z >= 0.0) linha = vCel.z;
        realce = t < 1.0 / 32.0 ? 1.28 : 1.0;
      }
      uvl = clamp(uvl, 0.5 / 32.0, 1.0 - 0.5 / 32.0);
      vec2 auv = (vec2(col, linha) + uvl) / vec2(${COLS.toFixed(1)}, ${LINHAS.toFixed(1)});
      vec4 texel = texture2D(map, auv);
      diffuseColor *= texel;
      diffuseColor.rgb *= realce;
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
      {
        vec3 em = texture2D(emissiveMap, auv).rgb;
        float pulso = 0.75 + 0.25 * sin(uTempo * 2.4 - (vPosM.x + vPosM.z) * 0.9);
        totalEmissiveRadiance *= em * pulso;
      }`)
      .replace('#include <fog_fragment>', /* glsl */`
      // névoa de altura: o que desce para o abismo se perde nas nuvens
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uCorNevoa, smoothstep(-0.3, -3.6, vPosM.y) * 0.8);
      #include <fog_fragment>`);
  };
  materialTerreno = fixo(mat);
  return mat;
}

// ---------------- geometria ----------------
class Construtor {
  constructor() {
    this.pos = []; this.nor = []; this.cor = []; this.cel = []; this.corte = []; this.baixa = []; this.topo = []; this.borda = []; this.uv = []; this.din = [];
    this.idx = [];
  }
  // quad a,b,c,d (em qualquer sentido); corrige a ordem para a normal n
  quad(v, n, cores, attrs) {
    const [a, b, c] = v;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const ok = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0;
    const base = this.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      this.pos.push(...v[k]); this.nor.push(...n); this.cor.push(cores[k], cores[k], cores[k]);
      this.cel.push(...attrs.cel); this.corte.push(...attrs.corte); this.baixa.push(attrs.baixa); this.topo.push(attrs.topo);
      this.borda.push(...(attrs.borda || [0, 0, 0, 0])); this.din.push(...(attrs.din || [0, 0, 0])); this.uv.push(k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0);
    }
    if (ok) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  // face lateral no lado d do retângulo [x0,x1]x[z0,z1], de y0 a y1
  lado(d, x0, x1, z0, z1, y0, y1, cBaixo, cTopo, attrs) {
    const [dx, dz] = DIRS[d];
    let v;
    if (dx) { const x = dx > 0 ? x1 : x0; v = [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]]; }
    else { const z = dz > 0 ? z1 : z0; v = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]; }
    this.quad(v, [dx, 0, dz], [cBaixo, cBaixo, cTopo, cTopo], attrs);
  }
  // caixa sem a face de baixo (usada pelas colunas)
  caixa(x0, x1, y0, y1, z0, z1, ap, col, tint) {
    const attrs = { cel: [col, ap.lado, -1, LINHA.rocha], corte: [0, 0, 0, 0], baixa: 99, topo: y1 };
    for (let d = 0; d < 4; d++) this.lado(d, x0, x1, z0, z1, y0, y1, 0.7 * tint, tint, attrs);
    this.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], [tint, tint, tint, tint],
      { ...attrs, cel: [col, ap.topo, -1, LINHA.rocha], borda: [1, 1, 1, 1] });
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    const f = (a, n) => new THREE.Float32BufferAttribute(a, n);
    g.setAttribute('position', f(this.pos, 3)); g.setAttribute('normal', f(this.nor, 3)); g.setAttribute('color', f(this.cor, 3));
    g.setAttribute('uv', f(this.uv, 2)); g.setAttribute('aCel', f(this.cel, 4)); g.setAttribute('aCorteD', f(this.corte, 4));
    g.setAttribute('aBaixa', f(this.baixa, 1)); g.setAttribute('aTopo', f(this.topo, 1)); g.setAttribute('aBorda', f(this.borda, 4)); g.setAttribute('aDin', f(this.din, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// direções em que o bloco alto pode ser rebaixado: só atravessa blocos altos até o vazio
function mascaraCorte(mapa, i, j, t) {
  if (t.vazio || t.altura < ALTA || t.forma) return [0, 0, 0, 0];
  const baixo = (n) => !n.vazio && n.altura < ALTA;
  let interior8 = false;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (baixo(mapa.tipo(i + di, j + dj))) interior8 = true;
  return DIRS.map(([dx, dz]) => {
    // vazio colado na frente e piso em volta: ponta de parede virada para a câmera
    if (mapa.tipo(i + dx, j + dz).vazio && interior8) return 1;
    // parede de 1 ou 2 de espessura: piso atrás (sentido oposto) e vazio logo à frente
    let interior = false;
    for (let k = 1; k <= 2; k++) {
      const n = mapa.tipo(i - dx * k, j - dz * k);
      if (n.vazio) break;
      if (baixo(n)) { interior = true; break; }
    }
    if (!interior) return 0;
    for (let k = 1; k <= 4; k++) {
      const n = mapa.tipo(i + dx * k, j + dz * k);
      if (n.vazio) return 1;
      if (baixo(n)) return 0;
    }
    return 0;
  });
}

const ehDinamico = (t) => (t.solido && !t.forma && t.altura >= ALTA ? 1 : 0);

function alturaRebaixada(mapa, i, j) {
  let h = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const n = mapa.tipo(i + di, j + dj);
    if (!n.vazio && n.altura < ALTA) h = Math.max(h, n.altura);
  }
  return h + 0.3;
}

function variacao(i, j, nome) {
  const r = hash(i, j, 3);
  if (nome === 'pedra' || nome === 'ornato') return r < 0.55 ? 0 : r < 0.72 ? 1 : r < 0.86 ? 2 : 3;
  return (r * COLS) | 0;
}

export function construirTerreno(mapa) {
  const b = new Construtor();
  const info = []; // por tile: { t, corte, baixa }
  for (let j = 0; j < mapa.alt; j++) for (let i = 0; i < mapa.larg; i++) {
    const t = mapa.tipo(i, j);
    info[j * mapa.larg + i] = { t, corte: mascaraCorte(mapa, i, j, t), baixa: alturaRebaixada(mapa, i, j), din: ehDinamico(t) };
  }
  const infoEm = (i, j) => (i < 0 || j < 0 || i >= mapa.larg || j >= mapa.alt) ? { t: mapa.tipo(i, j), corte: [0, 0, 0, 0], baixa: 0, din: 0 } : info[j * mapa.larg + i];

  for (let j = 0; j < mapa.alt; j++) for (let i = 0; i < mapa.larg; i++) {
    const { t, corte, baixa, din } = infoEm(i, j);
    if (t.vazio) continue;
    const ap = APARENCIA[t.nome] || APARENCIA.pedra;
    const coluna = t.forma === 'coluna';
    const h = coluna ? 0 : t.altura;             // coluna: piso no chão + fuste por cima
    const col = variacao(i, j, t.nome);
    const tint = 0.94 + hash(i, j, 9) * 0.1;
    const attrs = { cel: [col, ap.lado, ap.cornija ?? -1, LINHA.rocha], corte, baixa, topo: h, din: [i + 0.5, j + 0.5, din] };

    // topo, com oclusão nos cantos (vizinhos mais altos escurecem)
    const alto = (di, dj) => { const n = infoEm(i + di, j + dj).t; return !n.vazio && n.altura > h + 0.3 && !(n.forma && n.altura < h + 1) ? 1 : 0; };
    const aoCanto = (sx, sz) => {
      const s1 = alto(sx, 0), s2 = alto(0, sz), d = alto(sx, sz);
      return tint * (s1 && s2 ? 0.55 : 1 - (s1 + s2 + d) * 0.14);
    };
    const borda = DIRS.map(([dx, dz]) => { const n = infoEm(i + dx, j + dz).t; return n.vazio || n.altura < h - 0.05 ? 1 : 0; });
    const topoAp = coluna ? APARENCIA.pedra : ap;
    b.quad([[i, h, j], [i + 1, h, j], [i + 1, h, j + 1], [i, h, j + 1]], [0, 1, 0],
      [aoCanto(-1, -1), aoCanto(1, -1), aoCanto(1, 1), aoCanto(-1, 1)],
      { ...attrs, cel: [col, topoAp.topo, -1, LINHA.rocha], borda });

    // lados: só o trecho que fica acima do vizinho
    DIRS.forEach(([dx, dz], d) => {
      const n = infoEm(i + dx, j + dz);
      let base;
      if (n.t.vazio) base = FUNDO_ABISMO;
      else {
        base = n.t.forma ? 0 : n.t.altura;
        // vizinho rebaixável com máscara diferente: a face pode ficar exposta
        if (n.din || (n.corte.some((c) => c) && n.corte.join() !== corte.join())) base = Math.min(base, n.baixa);
      }
      if (base >= h - 0.001) return;
      const cBaixo = (n.t.vazio ? 0.4 : 0.66) * tint;
      b.lado(d, i, i + 1, j, j + 1, base, h, cBaixo, tint, { ...attrs, cel: [col, (coluna ? APARENCIA.pedra : ap).lado, ap.cornija ?? -1, LINHA.rocha] });
    });

    if (coluna) {
      const H = t.altura, cc = hash(i, j, 5) < 0.3 ? 2 : hash(i, j, 6) < 0.3 ? 3 : 0;
      const colAp = { topo: LINHA.colunaTopo, lado: LINHA.colunaLado }, pAp = { topo: LINHA.pedraTopo, lado: LINHA.pedraLado };
      b.caixa(i + 0.06, i + 0.94, 0, 0.28, j + 0.06, j + 0.94, pAp, 0, tint);
      if (H > 2) {
        b.caixa(i + 0.2, i + 0.8, 0.28, H - 0.3, j + 0.2, j + 0.8, colAp, cc, tint);
        b.caixa(i + 0.08, i + 0.92, H - 0.3, H, j + 0.08, j + 0.92, pAp, 1, tint);
      } else {
        b.caixa(i + 0.2, i + 0.8, 0.28, H, j + 0.2, j + 0.8, colAp, 3, tint);
      }
    }
  }
  const mesh = new THREE.Mesh(b.geometria(), criarMaterialTerreno());
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'terreno';
  return { mesh, info, infoEm };
}

// ---------------- decoração ----------------
const animaveis = [];   // funções (dt, t) da sala atual
const decoAlta = [];    // deco sobre paredes que baixam quando o jogador passa atrás
let poeira = null;

const matSprite = new Map();
function spriteDeco(nome, larg, { cor = 0xd8ccb4, profundidade = 0.25, aditivo = false } = {}) {
  const chave = nome + cor + aditivo;
  if (!matSprite.has(chave)) {
    matSprite.set(chave, fixo(new THREE.SpriteMaterial({
      map: texturaSprite(nome), color: cor, alphaTest: aditivo ? 0 : 0.5, transparent: aditivo,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !aditivo, fog: true,
    })));
  }
  const s = new THREE.Sprite(matSprite.get(chave));
  const tex = s.material.map;
  s.center.set(0.5, 0);
  s.scale.set(larg, larg / tex.proporcao, 1);
  if (profundidade) aproximarDaCamera(s, profundidade);
  return s;
}

// Puxa um sprite na direção da câmera só no depth (câmera ortográfica: a posição na
// tela não muda). Evita que o billboard "entre" na parede de trás ou no chão.
const _v = new THREE.Vector3();
export function aproximarDaCamera(obj, dist = 0.6) {
  if (obj.userData.aproximado) { obj.userData.aproximado = dist; return; }
  obj.userData.aproximado = dist;
  obj.onBeforeRender = (r, s, cam) => {
    _v.set(0, 0, 1).applyQuaternion(cam.quaternion).multiplyScalar(obj.userData.aproximado);
    const e = obj.matrixWorld.elements; e[12] += _v.x; e[13] += _v.y; e[14] += _v.z;
    obj.modelViewMatrix.multiplyMatrices(cam.matrixWorldInverse, obj.matrixWorld);
  };
  obj.onAfterRender = () => {
    const e = obj.matrixWorld.elements; e[12] -= _v.x; e[13] -= _v.y; e[14] -= _v.z;
  };
}

const geoPedrinha = new THREE.DodecahedronGeometry(0.12, 0);
const matPedrinha = new THREE.MeshLambertMaterial({ color: 0x8a7d65, flatShading: true });
const geoCristal = new THREE.OctahedronGeometry(0.16, 0).scale(1, 2.2, 1);
const matCristal = new THREE.MeshLambertMaterial({ color: 0x2c6c70, emissive: 0x4fa6ab, emissiveIntensity: 1.6, flatShading: true });
const matPedestal = new THREE.MeshLambertMaterial({ color: 0x3a4646, flatShading: true });
const matBronze = new THREE.MeshLambertMaterial({ color: 0x5a4020, flatShading: true });
fixo(geoPedrinha, matPedrinha, geoCristal, matCristal, matPedestal, matBronze);   // reaproveitados entre salas
// Ato II: raízes, cogumelos, vitória-régia, água funda
const geoRaiz = new THREE.CylinderGeometry(0.09, 0.11, 1, 6);
const matRaiz = new THREE.MeshLambertMaterial({ color: 0x5a3e22, flatShading: true });
const geoPeCog = new THREE.CylinderGeometry(0.025, 0.035, 0.2, 5);
const matPeCog = new THREE.MeshLambertMaterial({ color: 0xd8d0b0 });
const geoChapeu = new THREE.SphereGeometry(0.09, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const matChapeu = new THREE.MeshLambertMaterial({ color: 0x3a8a40, emissive: 0x7fe050, emissiveIntensity: 1.4, flatShading: true });
const geoVitoria = new THREE.CircleGeometry(0.28, 9, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2);
const matVitoria = new THREE.MeshLambertMaterial({ color: 0x4a7a2a, side: THREE.DoubleSide });
fixo(geoRaiz, matRaiz, geoPeCog, matPeCog, geoChapeu, matChapeu, geoVitoria, matVitoria);
const NIVEL_AGUA = -0.3;   // superfície da água funda
// altura local da água para deco (vitória-régia): água funda boia em NIVEL_AGUA, rasa no próprio piso
function t_agua(ctx, x, z) { const t = ctx.mapa.tipo(Math.floor(x), Math.floor(z)); return (t.agua ? NIVEL_AGUA : 0) + 0.03; }

// superfície da água funda: um quad por tile `agua` (vazio), textura rolando devagar
function construirAgua(mapa) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < mapa.alt; j++) for (let i = 0; i < mapa.larg; i++) {
    if (!mapa.tipo(i, j).agua) continue;
    const b = pos.length / 3;
    pos.push(i, NIVEL_AGUA, j, i + 1, NIVEL_AGUA, j, i + 1, NIVEL_AGUA, j + 1, i, NIVEL_AGUA, j + 1);
    uv.push(i, -j, i + 1, -j, i + 1, -j - 1, i, -j - 1);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(idx);
  const tex = texturaAgua();
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x0c2a28, transparent: true, opacity: 0.93 });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.name = 'agua';
  animaveis.push((dt, t) => { tex.offset.set(Math.sin(t * 0.3) * 0.08, t * 0.05); });
  return m;
}

function brilho(cor, tam) {
  const s = spriteDeco('brilho', tam, { cor, profundidade: 0.8, aditivo: true });
  s.center.set(0.5, 0.5);
  s.material.opacity = 0.5;
  return s;
}

function criarDeco(tipo, x, y, z, r, ctx) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  switch (tipo) {
    case 'samambaia': g.add(spriteDeco('samambaia', 0.8 + r() * 0.4)); break;
    case 'capim': {
      const n = 1 + (r() * 2 | 0);
      for (let k = 0; k < n; k++) { const s = spriteDeco('capim', 0.4 + r() * 0.25); s.position.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); g.add(s); }
      break;
    }
    case 'elmo': g.add(spriteDeco('elmo', 0.6, { cor: 0xc8c8c8 })); break;
    case 'cipo': {
      // pendurado do topo da parede, na face virada para a câmera (o billboard resolve)
      const s = spriteDeco('cipo', 0.38, { profundidade: 0.9 });
      s.center.set(0.5, 1); s.scale.multiplyScalar(1.4); s.position.y = 0.02; g.add(s);
      break;
    }
    // ---- Ato II (bioma Seiva)
    case 'arbusto': g.add(spriteDeco('arbusto', 1 + r() * 0.4)); break;
    case 'flores': g.add(spriteDeco('flores', 0.5 + r() * 0.2)); break;
    case 'raizArco': {
      // raiz retorcida que sai do chão e volta a entrar (arco de cilindros)
      const n = 7, ang = r() * Math.PI, alt = 0.5 + r() * 0.5, comp = 0.8 + r() * 0.3;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const p0 = new THREE.Vector3((t0 - 0.5) * comp * 2, Math.sin(t0 * Math.PI) * alt, 0);
        const p1 = new THREE.Vector3((t1 - 0.5) * comp * 2, Math.sin(t1 * Math.PI) * alt, 0);
        const m = new THREE.Mesh(geoRaiz, matRaiz);
        m.position.copy(p0).add(p1).multiplyScalar(0.5);
        m.scale.set(1 - Math.abs(t0 - 0.5) * 0.6, p0.distanceTo(p1), 1 - Math.abs(t0 - 0.5) * 0.6);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
        m.castShadow = true; g.add(m);
      }
      g.rotation.y = ang;
      break;
    }
    case 'cogumelo': {
      for (let k = 0; k < 3 + (r() * 3 | 0); k++) {
        const s = 0.5 + r() * 0.7, x = (r() - 0.5) * 0.6, z = (r() - 0.5) * 0.6;
        const pe = new THREE.Mesh(geoPeCog, matPeCog); pe.position.set(x, 0.1 * s, z); pe.scale.setScalar(s); g.add(pe);
        const ch = new THREE.Mesh(geoChapeu, matChapeu); ch.position.set(x, 0.2 * s, z); ch.scale.setScalar(s); g.add(ch);
      }
      const b = brilho(0x8ff060, 1.1); b.position.y = 0.25; g.add(b);
      ctx.luzes.push({ g, cor: 0x9fe060, y: 0.5, forca: 1.8, prio: 1 });
      break;
    }
    case 'vitoria': {
      const m = new THREE.Mesh(geoVitoria, matVitoria);
      m.position.set((r() - 0.5) * 0.3, t_agua(ctx, x, z), (r() - 0.5) * 0.3); m.rotation.y = r() * 6; m.scale.setScalar(0.7 + r() * 0.5);
      g.add(m);
      if (r() < 0.5) { const f = spriteDeco('flores', 0.3, { profundidade: 0.3 }); f.position.copy(m.position); g.add(f); }
      break;
    }
    case 'entulho':
      for (let k = 0; k < 4 + r() * 4; k++) ctx.pedrinhas.push([x + (r() - 0.5) * 0.7, y + 0.04, z + (r() - 0.5) * 0.7, 0.5 + r() * 1.1, r() * 6]);
      break;
    case 'cristal': {
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(geoCristal, matCristal);
        m.position.set((r() - 0.5) * 0.35, 0.2, (r() - 0.5) * 0.35);
        m.scale.setScalar(0.6 + r() * 0.6); m.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
        m.castShadow = true; g.add(m);
      }
      const b = brilho(0x4fa6ab, 1.2); b.position.y = 0.35; g.add(b);
      ctx.luzes.push({ g, cor: 0x4fa6ab, y: 0.6, forca: 2.2, prio: 1 });
      break;
    }
    case 'altar': {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), matPedestal);
      p.position.y = 0.35; p.castShadow = p.receiveShadow = true; g.add(p);
      const topo = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.72), matPedestal); topo.position.y = 0.72; g.add(topo);
      const c = new THREE.Mesh(geoCristal, matCristal); c.position.y = 1.15; g.add(c);
      const b = brilho(0x4fa6ab, 1.5); b.position.y = 1.15; g.add(b);
      const fase = r() * 6;
      animaveis.push((dt, t) => { c.position.y = 1.15 + Math.sin(t * 1.8 + fase) * 0.08; c.rotation.y = t * 0.9; });
      ctx.luzes.push({ g, cor: 0x4fa6ab, y: 1.2, forca: 3, prio: 2 });
      break;
    }
    case 'braseiro': {
      const perna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.45, 6), matBronze); perna.position.y = 0.22; g.add(perna);
      const cuba = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.2, 8), matBronze); cuba.position.y = 0.52; cuba.castShadow = true; g.add(cuba);
      const chama = spriteDeco('chama', 0.4, { cor: 0xffffff, profundidade: 0.3, aditivo: true });
      chama.position.y = 0.58; g.add(chama);
      const b = brilho(0xd07a2c, 1.6); b.position.y = 0.75; g.add(b);
      const luz = { g, cor: 0xffa040, y: 1.0, forca: 3.2, prio: 3 };
      ctx.luzes.push(luz);
      const fase = r() * 10, base = chama.scale.clone();
      animaveis.push((dt, t) => {
        const f = 0.85 + Math.sin(t * 13 + fase) * 0.08 + Math.sin(t * 7.3 + fase * 2) * 0.07;
        chama.scale.set(base.x * (2 - f), base.y * f, 1);
        if (luz.luz) luz.luz.intensity = luz.forca * (0.85 + (f - 0.85) * 1.5);
      });
      break;
    }
  }
  return g;
}

function vizinhoAlto(mapa, i, j, h) {
  for (const [dx, dz] of DIRS) { const n = mapa.tipo(i + dx, j + dz); if (!n.vazio && n.altura >= h + 1.5) return true; }
  return false;
}

export function construirDeco(mapa, terreno) {
  animaveis.length = 0; decoAlta.length = 0;
  const grupo = new THREE.Group();
  grupo.name = 'deco';
  const sala = mapa.sala;
  const ctx = { pedrinhas: [], luzes: [], mapa };
  const agua = construirAgua(mapa);
  if (agua) grupo.add(agua);
  const ocupado = new Set(mapa.coisas.map((c) => `${c.i},${c.j}`));
  const explicitos = new Set();

  (sala.deco || []).forEach((linha, j) => [...linha].forEach((ch, i) => {
    const tipo = LEGENDA_DECO[ch];
    if (!tipo) return;
    explicitos.add(`${i},${j}`);
    const t = mapa.tipo(i, j);
    const r = rngSemente(i * 911 + j * 37 + 1);
    const g = criarDeco(tipo, i + 0.5, t.vazio ? 0 : t.altura, j + 0.5, r, ctx);
    grupo.add(g);
    if (terreno.infoEm(i, j).din) decoAlta.push({ g, x: i + 0.5, z: j + 0.5 });
  }));

  if (sala.decoAuto !== false) {
    for (let j = 0; j < mapa.alt; j++) for (let i = 0; i < mapa.larg; i++) {
      const k = `${i},${j}`;
      if (explicitos.has(k)) continue;
      const t = mapa.tipo(i, j);
      if (t.vazio || t.forma) continue;
      const { corte } = terreno.infoEm(i, j);
      const r = rngSemente(i * 7919 + j * 104729 + 5), p = r();
      let tipo = null;
      if (t.altura >= ALTA) {
        if (corte.some((c) => c)) continue;          // topo que some no rebaixamento
        tipo = p < 0.28 ? 'capim' : p < 0.4 ? 'samambaia' : null;
        if (!tipo && p > 0.9) { // cipó descendo da borda para dentro da sala
          const frente = DIRS.find(([dx, dz]) => { const n = mapa.tipo(i + dx, j + dz); return !n.vazio && n.altura < ALTA; });
          if (frente) { const g = criarDeco('cipo', i + 0.5 + frente[0] * 0.5, t.altura, j + 0.5 + frente[1] * 0.5, r, ctx); grupo.add(g); decoAlta.push({ g, x: i + 0.5, z: j + 0.5 }); }
          continue;
        }
      } else if (!ocupado.has(k)) {
        if (t.nome === 'musgo') tipo = p < 0.5 ? 'capim' : p < 0.6 ? 'samambaia' : null;
        else if (t.nome === 'terra' && vizinhoAlto(mapa, i, j, t.altura)) tipo = p < 0.22 ? 'samambaia' : p < 0.36 ? 'arbusto' : p < 0.5 ? 'capim' : null;
        else if (t.nome === 'terra') tipo = p < 0.12 ? 'capim' : p < 0.16 ? 'flores' : p < 0.19 ? 'samambaia' : null;
        else if (t.nome === 'pedra' && vizinhoAlto(mapa, i, j, t.altura)) tipo = p < 0.13 ? 'samambaia' : p < 0.24 ? 'entulho' : p < 0.3 ? 'capim' : null;
        else if (t.nome === 'pedra') tipo = p < 0.025 ? 'entulho' : p < 0.05 ? 'capim' : null;
      }
      if (tipo) {
        const jit = tipo === 'entulho' ? 0 : 0.25;
        const g = criarDeco(tipo, i + 0.5 + (r() - 0.5) * jit, t.altura, j + 0.5 + (r() - 0.5) * jit, r, ctx);
        grupo.add(g);
        if (terreno.infoEm(i, j).din) decoAlta.push({ g, x: i + 0.5, z: j + 0.5 });
      }
    }
  }

  // pedrinhas de entulho numa malha instanciada só
  if (ctx.pedrinhas.length) {
    const inst = new THREE.InstancedMesh(geoPedrinha, matPedrinha, ctx.pedrinhas.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cor = new THREE.Color();
    ctx.pedrinhas.forEach(([x, y, z, s, rot], k) => {
      q.setFromEuler(e.set(rot, rot * 1.7, rot * 0.3));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * 0.7, s));
      inst.setMatrixAt(k, m);
      inst.setColorAt(k, cor.setHSL(0.1, 0.12, 0.35 + (rot % 1) * 0.2));
    });
    inst.castShadow = inst.receiveShadow = true;
    grupo.add(inst);
  }

  // no máximo 4 luzes pontuais por sala (as mais importantes)
  ctx.luzes.sort((a, b) => b.prio - a.prio).slice(0, 4).forEach((l) => {
    const luz = new THREE.PointLight(l.cor, l.forca, 5, 1.6);
    luz.position.y = l.y; l.g.add(luz); l.luz = luz;
  });

  poeira = criarPoeira(mapa);
  grupo.add(poeira.pontos);
  return grupo;
}

// ---------------- poeira flutuando ----------------
function criarPoeira(mapa) {
  const N = Math.min(140, Math.round(mapa.larg * mapa.alt * 0.35));
  const pos = new Float32Array(N * 3), fase = new Float32Array(N);
  const r = rngSemente(42);
  for (let k = 0; k < N; k++) {
    pos[k * 3] = r() * mapa.larg; pos[k * 3 + 1] = r() * 3.5; pos[k * 3 + 2] = r() * mapa.alt; fase[k] = r() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTempo: U.uTempo, uTam: { value: 3 * Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */`
      uniform float uTempo; uniform float uTam; attribute float aFase; varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTempo * 0.3 + aFase) * 0.6; p.z += cos(uTempo * 0.23 + aFase * 1.3) * 0.6;
        p.y = mod(p.y + uTempo * 0.12 + aFase, 4.0);
        vA = (0.5 + 0.5 * sin(uTempo * 1.7 + aFase * 3.0)) * smoothstep(0.0, 0.8, p.y) * smoothstep(4.0, 3.0, p.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uTam * (0.6 + 0.4 * fract(aFase));
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * 1.3, vA * 0.55); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pontos = new THREE.Points(g, mat);
  pontos.frustumCulled = false;
  return { pontos };
}

// ---------------- atualização por quadro ----------------
const ELEV = Math.PI / 6;
export function atualizarVisual(jogo, dt) {
  U.uTempo.value += dt;
  const t = U.uTempo.value;
  const cam = jogo.camera, a = cam.anguloAtual;
  U.uVista.value.set(Math.cos(a) * Math.cos(ELEV), Math.sin(ELEV), Math.sin(a) * Math.cos(ELEV));
  const w = (c) => THREE.MathUtils.smoothstep(c, 0.12, 0.55);
  U.uCorte.value.set(w(Math.cos(a)), w(-Math.cos(a)), w(Math.sin(a)), w(-Math.sin(a)));
  const j = jogo.jogador;
  if (j && !j.removido) U.uJogador.value.set(j.pos.x, j.pos.y + 0.7, j.pos.z);
  for (const f of animaveis) f(dt, t);
  // mesma regra do shader: some a deco do topo das paredes que baixaram
  const hx = Math.cos(a), hz = Math.sin(a), p = U.uJogador.value;
  for (const d of decoAlta) {
    const dx = p.x - d.x, dz = p.z - d.z, al = dx * hx + dz * hz, lat = Math.hypot(dx - hx * al, dz - hz * al);
    d.g.visible = !(lat < 2.3 && al < -0.2 && al > -6.3);
  }
}
