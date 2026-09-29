import * as THREE from 'three';
import { moverCorpo } from '../world/fisica.js';
import { fixo } from '../core/liberar.js';

const carregador = new THREE.TextureLoader();
const cacheTex = new Map();

// textura pixel art (sem filtro) com cache
export function texturaPixel(url) {
  if (!cacheTex.has(url)) {
    let ok;
    const pronta = new Promise((r) => { ok = r; });
    const t = carregador.load(url, () => ok(t));
    t.pronta = pronta;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    cacheTex.set(url, t);
  }
  return cacheTex.get(url);
}

const geoSombra = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const matSombra = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
fixo(geoSombra, matSombra);   // compartilhados: não liberar junto com a entidade

// ---- animação procedural do sprite (no shader do SpriteMaterial)
// Deforma o quadrado do billboard ancorado nos pés: escala (squash & stretch),
// cisalhamento (inclinação), deslocamento na tela, espelho e flash branco.
// `material.rotation` (inimigo tonto) continua valendo por cima disso.
export function animarMaterial(mat) {
  if (mat.userData.anim) return mat.userData.anim;
  const u = {
    uDeform: { value: new THREE.Vector2(1, 1) },
    uInclina: { value: 0 },
    uDesloc: { value: new THREE.Vector2() },
    uEspelho: { value: 1 },
    uBranco: { value: 0 },
    uCorFixa: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPontilhado: { value: 0 },   // 1 = xadrez (silhueta atrás das coisas)
    uLuz: { value: new THREE.Color(1, 1, 1) },   // luz da sala no sprite (Entidade.iluminar)
    uLuzAdd: { value: new THREE.Color(0, 0, 0) },   // brilho das PointLights somado (lê em sprites escuros)
  };
  mat.userData.anim = u;
  mat.side = THREE.DoubleSide;   // espelhado, o quadrado vira de costas
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform vec2 uDeform; uniform float uInclina; uniform vec2 uDesloc; uniform float uEspelho;\n'
      + sh.vertexShader.replace('vec2 rotatedPosition;',
        'alignedPosition *= uDeform;\n\talignedPosition.x = alignedPosition.x * uEspelho + alignedPosition.y * uInclina;\n\talignedPosition += uDesloc;\n\tvec2 rotatedPosition;');
    sh.fragmentShader = 'uniform float uBranco; uniform vec4 uCorFixa; uniform float uPontilhado; uniform vec3 uLuz; uniform vec3 uLuzAdd;\n'
      + sh.fragmentShader.replace('#include <tonemapping_fragment>',
        'if (uPontilhado > 0.5 && mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0) < 1.0) discard;\n\t' +
        'gl_FragColor.rgb = gl_FragColor.rgb * uLuz + uLuzAdd * (0.35 + gl_FragColor.rgb);\n\t' +
        'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.97, 0.9), uBranco);\n\tgl_FragColor.rgb = mix(gl_FragColor.rgb, uCorFixa.rgb, uCorFixa.a);\n\t#include <tonemapping_fragment>');
  };
  mat.customProgramCacheKey = () => 'spriteAnimado';
  mat.needsUpdate = true;
  return u;
}

const _dirTela = new THREE.Vector3();
const _dirSol = new THREE.Vector3();
const BRANCO = new THREE.Color(1, 1, 1);
const AMOSTRAS_SOMBRA = [0.5, 0.9, 1.4];
const _sombraCor = new THREE.Color();
const FORCA_PONTUAL = 0.34;     // PointLights (braseiros, cristais, cogumelos) no sprite
const SOMBRA_PAREDE = 0.82;     // sombra de parede = ambiente do bioma × isto
const LUZ_MIN_JOGADOR = 0.62;   // luminância mínima do jogador
const LUZ_MAX = 1.45;           // teto do uLuz (sem estourar)
const PONTUAL_SOMA = 0.14;      // fração das PointLights que também soma (uLuzAdd)
const SOMA_MAX = 0.16;
const amortecer = (atual, alvo, taxa, dt) => atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));

// Base de tudo que se move/interage. Contrato usado pelo jogo:
//   atualizar(dt)            chamado todo quadro enquanto !removido
//   receberDano(qtd, origem, { atordoa, empurra })
//   removido = true          o jogo tira da cena no fim do quadro
//   time: 'jogador' | 'inimigo' | 'neutro'
export class Entidade {
  constructor(jogo, x, z, { raio = 0.3, vida = 1, time = 'neutro' } = {}) {
    this.jogo = jogo;
    this.pos = new THREE.Vector3(x, jogo.mapa.alturaEm(x, z), z);
    this.vel = new THREE.Vector3();
    this.raio = raio;
    this.vida = this.vidaMax = vida;
    this.time = time;
    this.noChao = false;
    this.atordoado = 0;
    this.invulneravel = 0;
    this.removido = false;
    this.objeto = new THREE.Group();
    this.sombra = new THREE.Mesh(geoSombra, matSombra);
    this.sombra.scale.setScalar(raio * 1.2);
    this.objeto.add(this.sombra);
  }

  // sprite "de pé" que sempre encara a câmera; ancorado nos pés
  definirSprite(url, altura = 1.4) {
    if (!this.sprite) {
      this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5 }));
      this.sprite.center.set(0.5, 0);
      this.objeto.add(this.sprite);
    }
    const tex = texturaPixel(url);
    this.sprite.material.map = tex;
    this.sprite.material.needsUpdate = true;
    const ajustar = () => {
      const img = tex.image;
      this.sprite.scale.set(altura * img.width / img.height, altura, 1);
    };
    this.sprite.scale.set(altura * 0.8, altura, 1);
    tex.pronta.then(ajustar);
    this._alturaSprite = altura;
    return this.sprite;
  }

  // sprite placeholder colorido (para inimigos sem arte ainda)
  definirPlaceholder(cor, larg = 0.7, alt = 1.2) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 24;
    const g = c.getContext('2d');
    g.fillStyle = '#' + new THREE.Color(cor).getHexString();
    g.fillRect(2, 2, 12, 22);
    g.fillStyle = '#e9e1cf'; g.fillRect(4, 6, 3, 3); g.fillRect(9, 6, 3, 3);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    this.sprite.center.set(0.5, 0);
    this.sprite.scale.set(larg, alt, 1);
    this.objeto.add(this.sprite);
  }

  fisica(dt) {
    moverCorpo(this.jogo.mapa, this, dt);
  }

  receberDano(qtd, origem, { atordoa = 0, empurra = 0 } = {}) {
    if (this.invulneravel > 0 || this.removido) return false;
    this.vida -= qtd;
    this.invulneravel = 0.35;
    if (this._anim) this._anim.golpeado = 0.22;
    if (atordoa) this.atordoado = Math.max(this.atordoado, atordoa);
    if (empurra && origem) {
      const d = new THREE.Vector3().subVectors(this.pos, origem.pos ?? origem).setY(0).normalize();
      this.vel.x += d.x * empurra; this.vel.z += d.z * empurra; this.vel.y = Math.max(this.vel.y, 3);
      if (this._anim) this._anim.dirGolpe = Math.sign(d.dot(_dirTela.setFromMatrixColumn(this.jogo.camera.cam.matrixWorld, 0))) || 1;
    }
    this.jogo.eventos.emitir('dano', { alvo: this, qtd, origem });
    if (this.vida <= 0) this.morrer();
    return true;
  }

  morrer() { this.removido = true; this.jogo.eventos.emitir('morte', { alvo: this }); }

  // sincroniza o objeto 3D; subclasses chamam no fim do atualizar()
  sincronizar(dt) {
    this.invulneravel = Math.max(0, this.invulneravel - dt);
    this.atordoado = Math.max(0, this.atordoado - dt);
    this.objeto.position.copy(this.pos);
    // sombra fica no chão, mesmo com o corpo no ar
    this.sombra.position.y = this.jogo.mapa.alturaEm(this.pos.x, this.pos.z) - this.pos.y + 0.01;
    if (this.sprite) this.sprite.material.opacity = this.invulneravel > 0 && Math.floor(this.invulneravel * 20) % 2 ? 0.4 : 1;
    this.animarSprite(dt);
    this.iluminar(dt);
  }

  // Luz da sala no sprite: sol ou sombra (parede alta entre a entidade e o sol, 3
  // amostras no tilemap) + PointLights próximas (braseiros, cristais, cogumelos) com a
  // mesma queda da PointLight. Vai para o uniform uLuz (antes do flash e da cor fixa).
  iluminar(dt) {
    const L = this.jogo.luzSprites, s = this.sprite;
    if (!L || !s || this.semLuz) return;
    const u = animarMaterial(s.material);
    if (!L.pontos) {
      L.pontos = [];
      L.cena.traverse((o) => { if (o.isPointLight) L.pontos.push({ luz: o, p: o.getWorldPosition(new THREE.Vector3()) }); });
    }
    const sol = this.jogo.sol, mapa = this.jogo.mapa;
    let sombra = 0;
    if (sol && mapa) {
      _dirSol.subVectors(sol.position, sol.target.position);
      const hz = Math.hypot(_dirSol.x, _dirSol.z) || 1, tg = _dirSol.y / hz, y0 = this.pos.y + 0.5;
      for (const d of AMOSTRAS_SOMBRA) if (mapa.alturaEm(this.pos.x + _dirSol.x / hz * d, this.pos.z + _dirSol.z / hz * d) > y0 + tg * d) sombra += 1 / AMOSTRAS_SOMBRA.length;
    }
    this._sombraSol = dt > 0 && this._sombraSol !== undefined ? amortecer(this._sombraSol, sombra, 8, dt) : sombra;
    // sombra de parede: um pouco abaixo do ambiente do bioma (mais legível que só o tom)
    _sombraCor.copy(L.ambiente).multiplyScalar(SOMBRA_PAREDE);
    const c = u.uLuz.value.copy(L.sol).lerp(_sombraCor, this._sombraSol);
    const cy = this.pos.y + 0.6, add = u.uLuzAdd.value.setRGB(0, 0, 0);
    for (const { luz, p } of L.pontos) {
      if (!luz.visible || luz.intensity <= 0 || !luz.distance) continue;
      const d = Math.max(0.55, Math.hypot(p.x - this.pos.x, p.y - cy, p.z - this.pos.z));
      if (d >= luz.distance) continue;
      const k = (1 - (d / luz.distance) ** 4) ** 2 / d ** luz.decay * luz.intensity * FORCA_PONTUAL;
      c.r += luz.color.r * k; c.g += luz.color.g * k; c.b += luz.color.b * k;
      add.r += luz.color.r * k; add.g += luz.color.g * k; add.b += luz.color.b * k;
    }
    if (this.surto?.ativo > 0) c.lerp(BRANCO, 0.5);   // Surto brilha por conta própria
    // jogador nunca afunda demais (leitura em sala escura)
    if (this.time === 'jogador') {
      const lum = c.r * 0.3 + c.g * 0.55 + c.b * 0.15;
      if (lum < LUZ_MIN_JOGADOR) c.multiplyScalar(LUZ_MIN_JOGADOR / Math.max(lum, 0.05));
    }
    // parte somada: pequena e com teto (não lava o sprite)
    add.multiplyScalar(PONTUAL_SOMA);
    const ma = Math.max(add.r, add.g, add.b);
    if (ma > SOMA_MAX) add.multiplyScalar(SOMA_MAX / ma);
    // teto suave: comprime acima de 1 e corta em LUZ_MAX, mantendo o tom
    const m = Math.max(c.r, c.g, c.b);
    if (m > 1) c.multiplyScalar(Math.min(LUZ_MAX, 1 + (m - 1) / (1 + (m - 1) * 1.2)) / m);
  }

  // flash branco (entidade atingida)
  piscar(t = 0.08) {
    if (!this.sprite) return;
    animarMaterial(this.sprite.material);
    (this._anim ??= this.novoEstadoAnim()).flash = t;
  }

  // golpe: avanço curto na direção em que olha + deformação
  animarGolpe() {
    const a = this._anim;
    if (!a) return;
    a.golpe = 1;
    const j = this.jogo.jogador;
    const dir = this.olhando ?? (j && j !== this ? { x: j.pos.x - this.pos.x, z: j.pos.z - this.pos.z } : { x: 1, z: 0 });
    const r = _dirTela.setFromMatrixColumn(this.jogo.camera.cam.matrixWorld, 0);
    a.ladoGolpe = Math.sign(dir.x * r.x + dir.z * r.z) || 1;
  }

  get animado() { return this.time === 'jogador' || this.time === 'inimigo'; }

  novoEstadoAnim() {
    return { t: Math.random() * 10, fase: 0, sq: 0, sqVel: 0, inclina: 0, noChao: true, vy: 0, golpe: 0, golpeado: 0, dirGolpe: 1, flash: 0, andar: 0 };
  }

  // animação procedural: caminhada (bob + squash no passo), pulo (antecipação e
  // esticada), aterrissagem (squash), inclinação no movimento, respiração parada,
  // golpe (avanço) e reação ao dano. Chamado por sincronizar().
  animarSprite(dt) {
    const s = this.sprite;
    if (!s) return;
    const a = this._anim ??= this.novoEstadoAnim();
    const u = animarMaterial(s.material);
    a.flash = Math.max(0, a.flash - dt);
    u.uBranco.value = a.flash > 0 ? 0.85 : 0;
    u.uEspelho.value = s.scale.x < 0 ? -1 : 1;
    if (!this.animado || dt <= 0) return;
    a.t += dt;
    const leve = this.pesado || this.ehChefe ? 0.5 : 1;
    // com animação quadro a quadro, a deformação só tempera (squash leve, sem bob nem respiração)
    const q = this.quadros ? 0.45 : 1, semQuadros = this.quadros ? 0 : 1;
    const noChao = this.noChao || this.voa;
    const cam = this.jogo.camera.cam;
    const direitaTela = _dirTela.setFromMatrixColumn(cam.matrixWorld, 0);
    const vTelaX = this.vel.x * direitaTela.x + this.vel.z * direitaTela.z;
    const h = Math.hypot(this.vel.x, this.vel.z);

    // mola do squash & stretch (sq > 0 estica, < 0 achata)
    if (!this.voa) {
      if (a.noChao && !this.noChao && this.vel.y > 2) { a.sq = -0.22 * leve * q; a.sqVel = 9 * leve * q; }       // saiu do chão: antecipação -> esticada
      else if (!a.noChao && this.noChao && a.vy < -2) { a.sqVel -= Math.min(7, -a.vy * 0.7) * leve * q; }   // aterrissou
    }
    a.noChao = this.noChao; a.vy = this.vel.y;
    let alvoSq = 0;
    if (!noChao) alvoSq = THREE.MathUtils.clamp(Math.abs(this.vel.y) * 0.018, 0, 0.14) * leve * q;
    a.sqVel += ((alvoSq - a.sq) * 260 - a.sqVel * 16) * dt;
    a.sq += a.sqVel * dt;
    a.sq = THREE.MathUtils.clamp(a.sq, -0.35, 0.35);

    let sy = 1 + a.sq, dy = 0;
    // caminhada: quica a cada passo, achata no contato
    a.andar = amortecer(a.andar, noChao && h > 0.4 && this.atordoado <= 0 ? Math.min(1, h / 3) : 0, 10, dt);
    if (noChao) a.fase += dt * (4 + h * 2.2);
    const passo = Math.abs(Math.sin(a.fase));
    dy += passo * 0.07 * a.andar * leve * semQuadros;
    sy += (passo - 0.6) * 0.07 * a.andar * leve * semQuadros;
    // respiração parada
    const resp = Math.sin(a.t * 2.3) * 0.022 * (1 - a.andar) * (noChao ? 1 : 0);
    sy += resp * leve * semQuadros;
    // voadores flutuam
    if (this.voa) dy += Math.sin(a.t * 3) * 0.05;

    // inclinação na direção do movimento (e para trás quando apanha)
    let alvoInc = THREE.MathUtils.clamp(vTelaX * 0.03, -0.16, 0.16) * (noChao ? 1 : 0.5) * q * q;
    a.golpeado = Math.max(0, a.golpeado - dt);
    const g = a.golpeado / 0.22;
    if (g > 0) { alvoInc += a.dirGolpe * 0.25 * g * q; sy -= 0.12 * g * leve * q; }
    a.inclina = amortecer(a.inclina, alvoInc, 16, dt);

    // golpe: avanço curto e esticada horizontal
    let dx = 0, sxGolpe = 1, inc = a.inclina;
    if (a.golpe > 0) {
      a.golpe = Math.max(0, a.golpe - dt / 0.2);
      const k = Math.sin(a.golpe * Math.PI) * (a.golpe > 0.6 ? 1 : 0.7);
      const lado = a.ladoGolpe ?? 1;
      dx = lado * 0.14 * k * q;
      sxGolpe = 1 + 0.14 * k * semQuadros;
      sy -= 0.07 * k * semQuadros;
      inc += lado * 0.1 * k * semQuadros;
    }

    const sx = (1 / Math.sqrt(Math.max(0.5, sy))) * sxGolpe;
    const alt = Math.abs(s.scale.y) || 1;
    u.uDeform.value.set(sx, sy);
    u.uInclina.value = inc;
    u.uDesloc.value.set(dx, dy * alt * 0.6);
  }

  distancia(outra) { return Math.hypot(this.pos.x - outra.pos.x, this.pos.z - outra.pos.z); }
}
