import * as THREE from 'three';
import { rngSemente } from './texturas.js';
import { U, atualizarVisual } from './visual.js';
import { renderizadorSoftware } from '../fx/pos.js';

// Luz, céu, névoa e fundo (Tartaruga-Mundo no horizonte) da sala. Cria `jogo.sol`
// (DirectionalLight com sombra), que o loop reposiciona para seguir o jogador.
// O céu é um quad de tela inteira desenhado antes de tudo; ele também dispara a
// atualização dos uniformes visuais do mundo uma vez por quadro.

const COR_NEVOA = 0x8a6630;

export function montarAmbiente(jogo) {
  const cena = jogo.cena;
  cena.background = new THREE.Color(0x3a2a14);
  cena.fog = new THREE.Fog(COR_NEVOA, 34, 80);
  U.uCorNevoa.value.set(0x6e5026);

  cena.add(new THREE.HemisphereLight(0xf6dcaa, 0x4a3822, 1.9));
  const sol = new THREE.DirectionalLight(0xffdca6, 3.4);
  sol.position.set(8, 16, 4);
  sol.castShadow = true;
  const res = renderizadorSoftware(jogo.renderer) ? 1024 : 2048;
  sol.shadow.mapSize.set(res, res);
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.02;
  Object.assign(sol.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 50 });
  cena.add(sol, sol.target);
  jogo.sol = sol;

  cena.add(criarCeu(jogo));
}

// ---------------- céu ----------------
let texCeu = null;
function texturasCeu() {
  if (texCeu) return texCeu;
  const fazer = (desenhar, semente) => {
    const c = document.createElement('canvas');
    c.width = 1440; c.height = 120;
    desenhar(c.getContext('2d'), rngSemente(semente));
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.wrapS = THREE.RepeatWrapping;
    // sem colorSpace: o shader trabalha em sRGB e converte para linear no fim
    return t;
  };
  texCeu = { longe: fazer(desenharLonge, 11), colosso: fazer(desenharColosso, 23) };
  return texCeu;
}

const ret = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// ilha flutuante: platô com cone invertido embaixo e umas árvores
function ilha(g, r, cx, cy, larg, cores) {
  const [corpo, luz, sombra, mata] = cores;
  for (let x = -larg; x <= larg; x++) {
    const f = 1 - Math.abs(x / larg);
    const fundo = Math.pow(f, 0.7) * larg * 0.9 + (r() * 2);
    ret(g, cx + x, cy, 1, fundo, x < 0 ? corpo : sombra);
    ret(g, cx + x, cy - 1, 1, 2, luz);
    if (r() < 0.3) { const h = 2 + r() * 5; ret(g, cx + x - 1, cy - h, 3, h, mata); }
  }
  if (r() < 0.6) ret(g, cx - 1, cy + larg * 0.9, 1, 6 + r() * 10, luz); // cascata
}

function desenharLonge(g, r) {
  const cores = ['#a8844c', '#bf9a5a', '#9a7844', '#9c8a50'];
  for (let k = 0; k < 14; k++) ilha(g, r, r() * 1440, 40 + r() * 50, 6 + r() * 16, cores);
  // agulhas de ruína muito ao longe
  for (let k = 0; k < 6; k++) { const x = r() * 1440, h = 20 + r() * 30; ret(g, x, 92 - h, 4, h, '#a8844c'); ret(g, x + 1, 92 - h - 4, 2, 4, '#a8844c'); }
}

function desenharColosso(g, r) {
  const CORPO = '#6b5433', LUZ = '#8c6e42', SOMBRA = '#56432a', MATA = '#5c5a30', MATA_L = '#707040', AGUA = '#c9b98a';
  // Tartaruga-Mundo: casco em cúpula, patas, cabeça à esquerda
  const cx = 300, base = 92, rx = 150, ry = 50;
  for (let x = -rx; x <= rx; x++) {
    const h = Math.sqrt(1 - (x / rx) ** 2) * ry;
    ret(g, cx + x, base - h, 1, h + 4, x > rx * 0.35 ? SOMBRA : CORPO);
    ret(g, cx + x, base - h, 1, 2, LUZ);
    // placas do casco
    if ((x + 400) % 38 < 2) ret(g, cx + x, base - h * 0.8, 1, h * 0.6, SOMBRA);
  }
  for (let x = -rx + 10; x < rx - 10; x += 2) if (Math.abs(Math.sin(x * 0.05)) < 0.1) ret(g, cx + x, base - 25, 2, 2, SOMBRA);
  ret(g, cx - rx + 8, base, rx * 2 - 16, 5, SOMBRA);
  // patas
  for (const px of [-120, -55, 40, 100]) { ret(g, cx + px, base, 24, 28, SOMBRA); ret(g, cx + px, base, 3, 28, CORPO); }
  // pescoço e cabeça
  for (let k = 0; k < 44; k++) { const x = cx - rx + 6 - k, y = base - 8 - Math.sin(k / 44 * Math.PI * 0.6) * 16; ret(g, x, y, 1, 14 - k * 0.05, k > 30 ? CORPO : SOMBRA); ret(g, x, y, 1, 1, LUZ); }
  const hx = cx - rx - 46, hy = base - 28;
  for (let y = -8; y <= 8; y++) for (let x = -13; x <= 11; x++) if ((x / 13) ** 2 + (y / 8) ** 2 < 1) ret(g, hx + x, hy + y, 1, 1, y < -6 ? LUZ : CORPO);
  ret(g, hx - 7, hy - 3, 2, 2, '#f0c050'); // olho aceso
  // ruínas e mata sobre o casco
  for (let k = 0; k < 20; k++) {
    const x = cx + (r() - 0.5) * rx * 1.6, topo = base - Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * ry;
    if (r() < 0.45) {
      const w = 4 + r() * 7, h = 6 + r() * 22;
      ret(g, x, topo - h, w, h + 3, r() < 0.5 ? CORPO : SOMBRA); ret(g, x, topo - h, 1, h, LUZ);
      for (let a = 0; a < w; a += 3) ret(g, x + a, topo - h - 2, 2, 2, CORPO); // ameias
      if (r() < 0.5) ret(g, x + w / 2, topo - h * 0.6, 1, 2, '#e0b050');   // janela acesa
      if (r() < 0.3) { ret(g, x + w / 2, topo - h - 10, 1, 8, CORPO); }
    } else {
      const w = 6 + r() * 12;
      for (let a = 0; a < w; a++) { const hh = Math.sin(a / w * Math.PI) * (6 + r() * 3); ret(g, x + a, topo - hh - 2, 1, hh + 3, a < w / 2 ? MATA_L : MATA); }
    }
  }
  // cascatas escorrendo do casco
  for (const k of [-90, -20, 60, 115]) { const x = cx + k, topo = base - Math.sqrt(1 - (k / rx) ** 2) * ry * 0.4; ret(g, x, topo, 2, 120 - topo, AGUA); ret(g, x + 2, topo, 1, 120 - topo, '#b0a070'); }
  // núcleo Quanta pulsando no flanco
  ret(g, cx + 20, base - 30, 5, 5, '#4fa6ab'); ret(g, cx + 21, base - 29, 3, 3, '#bff0ee');

  // mais ilhas pelo resto do horizonte
  const cores = ['#7e6440', '#977a4e', '#6a5436', '#6e6a3c'];
  for (let k = 0; k < 9; k++) ilha(g, r, 700 + r() * 700, 30 + r() * 60, 8 + r() * 22, cores);
  // Andador Quanta distante: corpo baixo, quatro pernas articuladas, olho teal
  const ax = 1100, ay = 52, AND = '#766043';
  for (let y = -9; y <= 7; y++) for (let x = -26; x <= 26; x++) if ((x / 26) ** 2 + (y / 9) ** 2 < 1) ret(g, ax + x, ay + y, 1, 1, y < -6 ? LUZ : AND);
  ret(g, ax - 34, ay - 6, 12, 8, AND); ret(g, ax - 36, ay - 4, 3, 3, '#4fa6ab');
  for (const [p, s] of [[-20, -1], [-8, -1], [8, 1], [20, 1]]) {
    for (let k = 0; k < 16; k++) ret(g, ax + p + s * k * 0.5, ay + 4 - k, 2, 1, AND);       // coxa subindo
    for (let k = 0; k < 44; k++) ret(g, ax + p + s * 8 + s * k * 0.12, ay - 12 + k * 1.5, 2, 2, SOMBRA); // canela descendo
  }
  for (let k = 0; k < 18; k++) ret(g, ax + 4, ay - 9 - k, 1, 1, AND);   // antena
  ret(g, ax + 3, ay - 28, 3, 3, '#4fa6ab');
}

function criarCeu(jogo) {
  const { longe, colosso } = texturasCeu();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLonge: { value: longe }, uColosso: { value: colosso },
      uAspecto: { value: 1 }, uAltTela: { value: 720 },
      uGiro: { value: 0 }, uDesloc: { value: 0 }, uTempo: U.uTempo,
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uLonge, uColosso; uniform float uAspecto, uAltTela, uGiro, uDesloc, uTempo;
      varying vec2 vUv;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * ruido(p); p *= 2.03; a *= 0.5; } return s; }
      float bayer4(vec2 p) { int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i] / 16.0; }
      void main() {
        // grade de "pixels" do céu (3 px de tela)
        float px = 3.0 / uAltTela;
        vec2 q = floor(vUv / vec2(px / uAspecto, px)) * vec2(px / uAspecto, px);
        float y = q.y;
        vec2 cel = floor(vUv * vec2(uAltTela * uAspecto, uAltTela) / 3.0);
        float d = bayer4(cel);
        // gradiente: mostarda escura em cima, brilho no horizonte, mar de nuvens embaixo
        vec3 c;
        vec3 topo = vec3(0.16, 0.11, 0.05), meio = vec3(0.42, 0.29, 0.12), hor = vec3(0.80, 0.58, 0.24);
        vec3 nuvem = vec3(0.62, 0.46, 0.22), fundo = vec3(0.20, 0.14, 0.07);
        float H = 0.56;
        if (y > H) c = mix(hor, mix(meio, topo, smoothstep(0.75, 1.0, y)), smoothstep(H, 0.8, y));
        else c = mix(fundo, nuvem, smoothstep(0.0, H, y));
        // faixas de pontilhado para o gradiente ficar "pixel art"
        c = floor(c * 18.0 + d) / 18.0;
        float u = q.x * uAspecto;
        // nuvens altas deslizando
        float n = fbm(vec2(u * 3.0 + uGiro * 2.0 + uTempo * 0.01, y * 7.0));
        float faixa = smoothstep(0.62, 0.95, y) * step(0.58 + d * 0.12, n);
        c = mix(c, vec3(0.62, 0.45, 0.2), faixa * 0.5);
        // camadas do horizonte (texturas panorâmicas de 1440 x 120 texels)
        // camadas do horizonte (texturas panorâmicas de 1440 x 120 texels)
        float vl = (y - 0.47) / 0.45;
        if (vl > 0.0 && vl < 1.0) {
          vec4 l = texture2D(uLonge, vec2(u * 120.0 / 0.45 / 1440.0 - uGiro * 0.7 - uDesloc * 0.4, vl));
          c = mix(c, l.rgb, l.a * 0.55);
        }
        float vc = (y - 0.55) / 0.45;
        if (vc > 0.0 && vc < 1.0) {
          vec4 k = texture2D(uColosso, vec2(u * 120.0 / 0.45 / 1440.0 - uGiro - uDesloc + 0.17, vc));
          c = mix(c, k.rgb, k.a * 0.85);
        }
        // mar de nuvens na base do horizonte, cobrindo pés do colosso
        float m = fbm(vec2(u * 5.0 - uGiro * 3.0 + uTempo * 0.015, y * 14.0));
        float mar = (1.0 - smoothstep(0.42, 0.56, y + (m - 0.5) * 0.12));
        float cr = step(0.5 + d * 0.15, m);
        vec3 corMar = mix(vec3(0.56, 0.42, 0.21), vec3(0.78, 0.62, 0.34), cr);
        c = mix(c, mix(corMar, fundo, smoothstep(0.35, 0.0, y)), mar);
        gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
        #include <colorspace_fragment>
      }`,
    depthWrite: false, depthTest: false, fog: false,
  });
  const ceu = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  ceu.frustumCulled = false;
  ceu.renderOrder = -1000;
  let anterior = performance.now();
  ceu.onBeforeRender = (renderer) => {
    const agora = performance.now();
    const dt = Math.min(0.05, (agora - anterior) / 1000); anterior = agora;
    atualizarVisual(jogo, dt);
    const tam = renderer.getSize(new THREE.Vector2());
    mat.uniforms.uAspecto.value = tam.x / tam.y;
    mat.uniforms.uAltTela.value = tam.y;
    const cam = jogo.camera, a = cam.anguloAtual;
    mat.uniforms.uGiro.value = a / (Math.PI * 2);
    mat.uniforms.uDesloc.value = (-Math.sin(a) * cam.alvo.x + Math.cos(a) * cam.alvo.z) * 0.0015;
  };
  return ceu;
}
