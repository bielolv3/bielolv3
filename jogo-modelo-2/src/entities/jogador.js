import * as THREE from 'three';
import { Entidade } from './entidade.js';
import { GRAVIDADE } from '../world/fisica.js';

const BASE = import.meta.env.BASE_URL;

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
    this.trocar('hugo', true);
    this.jogo.habilidades?.prepararJogador(this);   // cria this.recursos (HUD)
  }

  // Guarda, parry, Massa e Surto filtram o dano (habilidades.js); null = anulado
  receberDano(qtd, origem, opts) {
    const h = this.jogo.habilidades;
    const f = h ? h.filtrarDano(this, qtd, origem, opts) : { qtd, opts };
    return f ? super.receberDano(f.qtd, origem, f.opts) : false;
  }

  get stats() { return MACACOS[this.atual]; }

  trocar(nome, forcar = false) {
    if (!forcar && (nome === this.atual || this.recarga.troca > 0 || this.surto.ativo > 0)) return;
    this.atual = nome;
    this.recarga.troca = 0.4;
    this.atualizarSprite();
    this.jogo.eventos.emitir('troca', { macaco: nome });
  }

  atualizarSprite() {
    const forma = this.surto.ativo > 0 ? 'surto' : 'normal';
    this.definirSprite(`${BASE}sprites/${this.atual}_${forma}.png`, this.stats.altura);
  }

  atualizar(dt) {
    const { input, camera } = this.jogo;
    for (const k in this.recarga) this.recarga[k] = Math.max(0, this.recarga[k] - dt);

    if (input.apertou('hugo')) this.trocar('hugo');
    if (input.apertou('chico')) this.trocar('chico');
    if (input.apertou('orlando')) this.trocar('orlando');

    // movimento relativo à câmera
    const s = this.stats;
    const mult = this.surto.ativo > 0 ? 1.15 : 1;
    const dir = camera.eixoParaMundo(input.eixo);
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
    this.fisica(dt);

    if (this.caiu) this.voltarAoUltimoChao();
    else if (this.noChao) this.ultimoChao = this.pos.clone();

    // espelha o sprite conforme o lado da tela para onde anda
    if (this.sprite) {
      const lado = new THREE.Vector3().copy(this.olhando).applyQuaternion(camera.cam.quaternion.clone().invert()).x;
      if (Math.abs(lado) > 0.2) this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (lado < 0 ? -1 : 1);
    }
    this.sincronizar(dt);
  }

  golpear() {
    if (this.recursos?.guardando) return;   // Guarda do Hugo não ataca
    const s = this.stats;
    const surto = this.surto.ativo > 0;
    this.recarga.golpe = 0.35;
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
