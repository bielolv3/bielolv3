import * as THREE from 'three';
import { Entidade, animarMaterial } from './entidade.js';
import { GRAVIDADE } from '../world/fisica.js';
import { aproximarDaCamera } from '../world/visual.js';
import { fixo } from '../core/liberar.js';
import { atlasMacaco, preaquecerMacacos } from '../fx/macacos.js';

const _direita = new THREE.Vector3();
const _frenteTela = new THREE.Vector3();

// um ouvinte por jogo (o Jogador é recriado a cada sala): repassa ao jogador atual
const jogosOuvidos = new WeakSet();
function ouvirEventos(jogo) {
  if (jogosOuvidos.has(jogo)) return;
  jogosOuvidos.add(jogo);
  preaquecerMacacos();
  jogo.eventos.on('identidade', (d) => jogo.jogador?.animEvento?.('identidade', d));
  jogo.eventos.on('surto', (d) => jogo.jogador?.animEvento?.('surto', d));
}
const EIXO_NULO = { x: 0, y: 0 };

// anel no chão sob o jogador quando está no ar (ajuda a medir o pulo)
const geoMarca = new THREE.RingGeometry(0.2, 0.3, 24).rotateX(-Math.PI / 2);
const matMarca = new THREE.MeshBasicMaterial({ color: 0xd09a2c, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
fixo(geoMarca, matMarca);

// Números de cada macaco. Mecânica de identidade/recurso/surto fica em habilidades.js.
export const MACACOS = {
  hugo:    { nome: 'Hugo',    velocidade: 3.6, pulo: 7.5, pulosNoAr: 0, dano: 1.5, alcance: 0.9, empurra: 6, altura: 1.5 },
  chico:   { nome: 'Chico',   velocidade: 5.0, pulo: 8.0, pulosNoAr: 1, dano: 1,   alcance: 0.8, empurra: 3, altura: 1.25 },
  orlando: { nome: 'Orlando', velocidade: 4.2, pulo: 7.5, pulosNoAr: 0, dano: 1,   alcance: 1.3, empurra: 4, altura: 1.45, planeio: true },
};

export class Jogador extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.3, vida: 6, time: 'jogador' });
    this.atual = 'hugo';
    this.surto = { carga: 0, ativo: 0 };   // carga 0..1; ativo = segundos restantes
    this.recarga = { golpe: 0, identidade: 0, troca: 0 };
    this.pulosRestantes = 0;
    this.olhando = new THREE.Vector3(1, 0, 0);
    this.animQ = { t: 0, fase: 0, vista: 'f', timer: { dano: 0, golpe: 0, identidade: 0, impacto: 0, pouso: 0, rugido: 0 }, durId: 0.3, idIni: 0 };
    this.trocar('hugo', true);
    this.jogo.habilidades?.prepararJogador(this);   // cria this.recursos (HUD)
    this.marca = new THREE.Mesh(geoMarca, matMarca);
    this.marca.renderOrder = 5;
    this.marca.visible = false;
    this.objeto.add(this.marca);
    this.passada = 0;
    this.quadros = true;   // animação quadro a quadro (atenua a deformação procedural)
    ouvirEventos(jogo);
  }

  // silhueta cor de mostarda que só aparece onde algo está na frente do jogador
  montarSilhueta() {
    const m = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5, depthWrite: false, depthFunc: THREE.GreaterDepth, opacity: 0.8, fog: false });
    const u = animarMaterial(m);
    const c = new THREE.Color(0xd09a2c);
    u.uCorFixa.value.set(c.r, c.g, c.b, 1);
    u.uPontilhado.value = 1;
    this.silhueta = new THREE.Sprite(m);
    this.silhueta.center.set(0.5, 0);
    this.silhueta.renderOrder = 30;
    aproximarDaCamera(this.silhueta, 0.6);
    this.objeto.add(this.silhueta);
  }

  sincronizarSilhueta() {
    if (!this.sprite) return;
    if (!this.silhueta) this.montarSilhueta();
    const s = this.silhueta, m = s.material, orig = this.sprite.material;
    if (m.map !== orig.map) { m.map = orig.map; m.needsUpdate = true; }
    s.scale.copy(this.sprite.scale);
    s.center.copy(this.sprite.center);
    s.position.copy(this.sprite.position);
    const u = m.userData.anim, o = orig.userData.anim;
    if (o) {
      u.uDeform.value.copy(o.uDeform.value); u.uDesloc.value.copy(o.uDesloc.value);
      u.uInclina.value = o.uInclina.value; u.uEspelho.value = o.uEspelho.value;
    }
    m.rotation = orig.rotation;
    s.visible = this.sprite.visible && orig.opacity > 0.5;
  }

  // Guarda, parry, Massa e Surto filtram o dano (habilidades.js); null = anulado
  receberDano(qtd, origem, opts) {
    const h = this.jogo.habilidades;
    const f = h ? h.filtrarDano(this, qtd, origem, opts) : { qtd, opts };
    const ok = f ? super.receberDano(f.qtd, origem, f.opts) : false;
    if (ok && f.qtd > 0) this.animQ.timer.dano = 0.3;
    return ok;
  }

  get stats() { return MACACOS[this.atual]; }

  trocar(nome, forcar = false) {
    if (!forcar && (nome === this.atual || this.recarga.troca > 0 || this.surto.ativo > 0)) return;
    this.atual = nome;
    this.recarga.troca = 0.4;
    this.atualizarSprite();
    this.jogo.eventos.emitir('troca', { macaco: nome });
  }

  // atlas quadro a quadro do macaco/forma atual (src/fx/macacos.js), 32 px = 1 unidade
  atualizarSprite() {
    const forma = this.surto.ativo > 0 ? 'surto' : 'normal';
    const a = this.atlas = atlasMacaco(this.atual, forma);
    if (!this.sprite) {
      this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5 }));
      this.objeto.add(this.sprite);
    }
    const m = this.sprite.material;
    if (m.map !== a.tex) { m.map = a.tex; m.needsUpdate = true; }
    const sinal = this.sprite.scale.x < 0 ? -1 : 1;
    this.sprite.center.set(a.centroX, 0);
    this.sprite.scale.set(sinal * a.largura, a.altura, 1);
    this.escolherQuadro(0);
  }

  animEvento(tipo, d) {
    const T = this.animQ.timer;
    if (tipo === 'surto') { if (d?.ativo) T.rugido = 0.7; return; }
    if (d?.macaco !== this.atual) return;
    if (d.tipo === 'pulverizar') T.impacto = 0.3;
    else if (d.tipo === 'banana' || d.tipo === 'agarrao' || d.tipo === 'arremesso') {
      // a banana já saiu da mão: começa no quadro de preparo curto e vai ao lançamento
      this.animQ.durId = d.tipo === 'agarrao' ? 0.4 : 0.32;
      T.identidade = this.animQ.durId;
    }
  }

  // Máquina de estados da animação: escolhe (animação, quadro, vista, luz) a cada quadro.
  escolherQuadro(dt) {
    const a = this.atlas, A = this.animQ, T = A.timer;
    if (!a || !this.sprite) return;
    for (const k in T) T[k] = Math.max(0, T[k] - dt);
    A.t += dt;
    const h = Math.hypot(this.vel.x, this.vel.z);
    const rec = this.recursos ?? {}, hab = this.jogo.habilidades;
    const ciclo = (n, dist) => { A.fase += h * dt / dist; return Math.floor(A.fase * n) % n; };
    const passou = (k, dur, n) => Math.min(n - 1, Math.floor((1 - T[k] / dur) * n));
    let an = 'parado', i = 0;
    if (T.dano > 0) { an = 'dano'; i = T.dano > 0.15 ? 0 : 1; }
    else if (T.rugido > 0) { an = 'rugido'; i = T.rugido > 0.5 ? 0 : Math.floor(A.t * 7) % 2; }
    else if (this.atual === 'hugo' && hab?.mergulho) {
      const m = hab.mergulho;
      an = 'identidade'; i = m.t < 0.07 && m.subida > 0.1 ? 0 : m.t < m.subida ? 1 : 2;
    }
    else if (T.impacto > 0) { an = 'identidade'; i = 3; }
    else if (T.identidade > 0) { an = 'identidade'; i = passou('identidade', A.durId, 4); }
    else if (T.golpe > 0) { an = 'golpe'; const k = 1 - T.golpe / 0.3; i = k < 0.18 ? 0 : k < 0.45 ? 1 : k < 0.72 ? 2 : 3; }
    else if (!this.noChao) {
      const s = this.stats;
      if (s.planeio && this.vel.y < -0.5 && this.vel.y > -2.2 && this.jogo.input.segurando('pulo')) { an = 'planar'; i = Math.floor(A.t * 6) % 2; }
      else if (rec.segurando) { an = 'segurar'; i = 1; }
      else if (this.vel.y > 0) { an = 'pulo'; i = this.vel.y > s.pulo * 0.45 ? 0 : 1; }
      else { an = 'queda'; i = this.vel.y > -5 ? 0 : Math.floor(A.t * 8) % 2; }
    }
    else if (T.pouso > 0) { an = 'pouso'; i = T.pouso > 0.07 ? 0 : 1; }
    else if (rec.guardando) an = 'guarda';
    else if (rec.segurando) { an = 'segurar'; i = h > 0.4 ? ciclo(4, 1.6) : 0; }
    else if (h > 4.4) { an = 'correr'; i = ciclo(6, 2.3); }
    else if (h > 0.4) { an = 'andar'; i = ciclo(8, 1.8); }
    else { an = 'parado'; i = Math.floor(A.t * 2.6) % 4; A.fase = 0; }
    A.anim = an; A.quadro = i;

    // vista: de costas quando anda para o fundo da tela (a câmera gira de 90 em 90°)
    const cam = this.jogo.camera;
    const fr = cam.eixoParaMundo({ x: 0, y: 1 });
    const prof = this.olhando.x * fr.x + this.olhando.z * fr.z;
    if (prof > 0.3) A.vista = 'c';
    else if (prof < -0.3) A.vista = 'f';
    // luz: do mesmo lado do sol na tela (compensando o espelho)
    const dir = _direita.setFromMatrixColumn(cam.cam.matrixWorld, 0);
    const sol = this.jogo.sol;
    let ladoSol = -1;
    if (sol) ladoSol = Math.sign((sol.position.x - sol.target.position.x) * dir.x + (sol.position.z - sol.target.position.z) * dir.z) || -1;
    const espelho = this.sprite.scale.x < 0 ? -1 : 1;
    a.quadro(a.tex, an, i, A.vista, ladoSol * espelho);
  }

  atualizar(dt) {
    const { input, camera } = this.jogo;
    const bloqueado = !!this.jogo.transicao;   // transição de sala: sem controle
    for (const k in this.recarga) this.recarga[k] = Math.max(0, this.recarga[k] - dt);

    if (input.apertou('hugo')) this.trocar('hugo');
    if (input.apertou('chico')) this.trocar('chico');
    if (input.apertou('orlando')) this.trocar('orlando');

    // movimento relativo à câmera
    const s = this.stats;
    const mult = this.surto.ativo > 0 ? 1.15 : 1;
    const dir = camera.eixoParaMundo(bloqueado ? EIXO_NULO : input.eixo);
    const controle = this.noChao ? 1 : 0.6;
    if (this.atordoado <= 0) {
      const alvoX = dir.x * s.velocidade * mult, alvoZ = dir.z * s.velocidade * mult;
      const k = 1 - Math.exp(-dt * 14 * controle);
      this.vel.x += (alvoX - this.vel.x) * k;
      this.vel.z += (alvoZ - this.vel.z) * k;
      if (Math.hypot(dir.x, dir.z) > 0.1) this.olhando.set(dir.x, 0, dir.z).normalize();

      if (this.noChao) this.pulosRestantes = s.pulosNoAr;
      if (input.apertou('pulo')) {
        if (this.noChao) { this.vel.y = s.pulo; this.jogo.eventos.emitir('pulo', { macaco: this.atual }); }
        else if (this.pulosRestantes > 0) { this.pulosRestantes--; this.vel.y = s.pulo * 0.9; this.jogo.eventos.emitir('pulo', { macaco: this.atual, duplo: true }); }
      }
      // planeio do Orlando: segurar pulo caindo
      // compensa a gravidade que a física aplica neste passo: queda constante em qualquer qps
      if (s.planeio && !this.noChao && this.vel.y < -1.5 && input.segurando('pulo')) this.vel.y = -1.5 + GRAVIDADE * dt;

      if (input.apertou('golpe') && this.recarga.golpe <= 0) this.golpear();
    } else {
      this.vel.x *= 0.9; this.vel.z *= 0.9;
    }

    this.jogo.habilidades?.atualizarJogador(this, dt);
    const noChaoAntes = this.noChao, vyAntes = this.vel.y;
    this.fisica(dt);
    // poeira: pouso e passadas (fx escuta)
    if (this.noChao && !noChaoAntes && vyAntes < -3) { this.jogo.eventos.emitir('pouso', { alvo: this, forca: -vyAntes }); this.animQ.timer.pouso = vyAntes < -7 ? 0.16 : 0.1; }
    const h = Math.hypot(this.vel.x, this.vel.z);
    if (this.noChao && h > 2.5) {
      this.passada += h * dt;
      if (this.passada > 1.1) { this.passada = 0; this.jogo.eventos.emitir('passada', { alvo: this }); }
    } else this.passada = 0.8;

    if (this.caiu) this.voltarAoUltimoChao();
    // só guarda chão firme sob o centro (não a beirada com o centro sobre o abismo)
    else if (this.noChao && !this.jogo.mapa.vazioEm(this.pos.x, this.pos.z)) (this.ultimoChao ??= new THREE.Vector3()).copy(this.pos);

    // espelha o sprite conforme o lado da tela para onde anda
    if (this.sprite) {
      // componente "direita da tela" de onde olha (sem alocar por quadro)
      const lado = this.olhando.dot(_direita.setFromMatrixColumn(camera.cam.matrixWorld, 0));
      if (Math.abs(lado) > 0.2) this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (lado < 0 ? -1 : 1);
      this.escolherQuadro(dt);
    }
    this.sincronizar(dt);
    // marca no chão quando está no ar
    const mapa = this.jogo.mapa;
    const alturaChao = this.pos.y - (this.sombra.position.y + this.pos.y - 0.01);
    const noAr = !this.noChao && alturaChao > 0.35 && !mapa.vazioEm(this.pos.x, this.pos.z);
    this.marca.visible = noAr;
    if (noAr) {
      this.marca.position.y = this.sombra.position.y + 0.01;
      this.marca.scale.setScalar(1 + Math.min(1.2, alturaChao * 0.25));
    }
    this.sombra.scale.setScalar(this.raio * 1.2 * (1 - Math.min(0.45, Math.max(0, alturaChao) * 0.12)));
    this.sincronizarSilhueta();
  }

  golpear() {
    if (this.recursos?.guardando) return;   // Guarda do Hugo não ataca
    const s = this.stats;
    const surto = this.surto.ativo > 0;
    this.recarga.golpe = 0.35;
    this.animQ.timer.golpe = 0.3;
    const centro = this.pos.clone().addScaledVector(this.olhando, s.alcance * 0.7);
    this.jogo.eventos.emitir('golpe', { autor: this, centro });
    for (const e of this.jogo.entidades) {
      if ((e.time !== 'inimigo' && !e.ehCaixa) || e.removido) continue;
      const d = Math.hypot(e.pos.x - centro.x, e.pos.z - centro.z);
      if (d < s.alcance * 0.7 + e.raio && Math.abs(e.pos.y - this.pos.y) < 1.2) {
        e.receberDano(s.dano * (surto ? 2 : 1), this, { empurra: s.empurra * (surto ? 1.6 : 1) });
      }
    }
  }

  voltarAoUltimoChao() {
    this.receberDano(1, null);
    this.invulneravel = 1;
    this.pos.copy(this.ultimoChao ?? this.jogo.inicio);
    this.vel.set(0, 0, 0);
  }

  morrer() {
    this.jogo.eventos.emitir('derrota', {});
  }
}
