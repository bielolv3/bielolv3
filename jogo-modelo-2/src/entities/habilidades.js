import * as THREE from 'three';
import { Banana, Onda, Braco } from './projeteis.js';
import { SistemaReliquias } from './reliquias.js';

// Frente A: identidade (K), recurso (L) e Surto (F) dos três macacos.
// `atualizarJogador` roda todo quadro, antes da física do jogador.
// Estado persistente entre salas fica aqui; `jogador.recursos` aponta para ele (HUD lê).

const DURACAO_SURTO = 8;
const JANELA_PARRY = 0.2;
const ALCANCE_AGARRAO = 3.5;
const RAIO_PULVERIZAR = 2.8;
const FORMA_SURTO = { hugo: 'rugido', chico: 'frenesi', orlando: 'exoesqueleto' };

export class Habilidades {
  constructor(jogo) {
    this.jogo = jogo;
    this.recursos = { bananas: 3, bananasMax: 3, surtoCarga: 0, surtoAtivo: false, guardando: false, segurando: false };
    this.tGuarda = 0;         // tempo desde que apertou a Guarda
    this.mergulho = null;     // Pulverizar em andamento
    this.segurado = null;     // o que o Orlando está segurando
    this.reliquias = jogo.reliquias = new SistemaReliquias(jogo, this);   // R alterna, U usa
    // dano causado pelo jogador carrega o Surto
    jogo.eventos.on('dano', ({ alvo, qtd, origem }) => {
      const j = jogo.jogador;
      if (!j || alvo.time !== 'inimigo' || !(qtd > 0) || j.surto.ativo > 0) return;
      if (origem === j || origem?.autor === j) j.surto.carga = Math.min(1, j.surto.carga + qtd * 0.08);
    });
  }

  // chamado quando um Jogador é criado (cada sala cria um novo)
  prepararJogador(j) {
    j.recursos = this.recursos;
    this.segurado = null;
    this.mergulho = null;
    this.escudo = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.escudo.scale.y = 1.6;
    this.escudo.visible = false;
    j.objeto.add(this.escudo);
    this.reliquias.prepararJogador(j);
  }

  // Jogador.receberDano passa por aqui. null = dano anulado.
  filtrarDano(j, qtd, origem, opts = {}) {
    if (j.invulneravel > 0) return { qtd, opts };
    if (this.reliquias.anula(j, origem)) return null;   // escudo solar / bolha
    opts = { ...opts };
    const surto = j.surto.ativo > 0;
    if (surto) opts.atordoa = 0;
    if (j.atual === 'hugo') {
      if (this.recursos.guardando) {
        if (this.tGuarda <= JANELA_PARRY && origem) return this.parry(j, origem);
        qtd *= 0.5;
        opts.empurra = 0;
      } else opts.empurra = (opts.empurra ?? 0) * 0.3;   // Massa: quase não é empurrado
    }
    if (surto && j.atual === 'orlando') qtd *= 0.5;       // Exoesqueleto
    return { qtd, opts };
  }

  parry(j, origem) {
    const atacante = origem.autor ?? origem;
    if (origem.autor) origem.removido = true;   // projétil some
    atacante.atordoar?.(1.5);
    j.invulneravel = 0.3;
    this.escudo.material.opacity = 0.9;
    this.jogo.camera.tremer(0.25);
    this.jogo.eventos.emitir('parry', { atacante });
    return null;
  }

  atualizarJogador(j, dt) {
    if (j.recursos !== this.recursos) this.prepararJogador(j);
    const { input } = this.jogo;
    this.atualizarSurto(j, dt, input);
    const livre = j.atordoado <= 0;
    const surto = j.surto.ativo > 0;

    if (j.atual === 'hugo') this.hugo(j, dt, input, livre, surto);
    else { this.recursos.guardando = false; this.mergulho = null; }
    if (livre && input.apertou('identidade') && j.recarga.identidade <= 0 && !surto) this.identidade(j);
    if (livre && input.apertou('recurso')) this.recurso(j);
    this.atualizarSegurado(j, dt, surto);
    this.reliquias.atualizar(j, dt, input, livre);

    this.escudo.visible = this.recursos.guardando;
    this.escudo.material.opacity += (0.3 - this.escudo.material.opacity) * Math.min(1, dt * 6);
    const r = this.recursos;
    r.surtoCarga = j.surto.carga;
    r.surtoAtivo = surto;
    r.surtoRestante = j.surto.ativo;
    r.segurando = !!this.segurado;
  }

  // ---------- Surto ----------
  atualizarSurto(j, dt, input) {
    const s = j.surto;
    if (s.ativo > 0) {
      s.ativo -= dt;
      j.atordoado = 0;
      if (j.atual === 'chico') j.recarga.golpe = Math.min(j.recarga.golpe, 0.15);   // Frenesi
      if (s.ativo <= 0) {
        s.ativo = 0;
        j.atualizarSprite();
        this.jogo.eventos.emitir('surto', { ativo: false, macaco: j.atual });
      }
      return;
    }
    if (!input.apertou('surto') || s.carga < 1) return;
    s.ativo = DURACAO_SURTO;
    s.carga = 0;
    this.soltar(j);
    this.mergulho = null;
    j.atualizarSprite();
    if (j.atual === 'hugo') {
      // Rugido: atordoa e afasta quem está perto
      for (const e of this.inimigos()) {
        const d = j.distancia(e);
        if (d >= 4) continue;
        e.atordoar?.(1);
        e.vel.x += (e.pos.x - j.pos.x) / (d || 1) * 6;
        e.vel.z += (e.pos.z - j.pos.z) / (d || 1) * 6;
      }
      this.jogo.camera.tremer(0.4);
    }
    this.jogo.eventos.emitir('surto', { ativo: true, macaco: j.atual, forma: FORMA_SURTO[j.atual] });
  }

  // ---------- Hugo ----------
  hugo(j, dt, input, livre, surto) {
    // Guarda: segurar L
    const guardando = livre && j.noChao && input.segurando('recurso');
    if (guardando && !this.recursos.guardando) { this.tGuarda = 0; this.jogo.eventos.emitir('recurso', { macaco: 'hugo', tipo: 'guarda' }); }
    else this.tGuarda += dt;
    this.recursos.guardando = guardando;
    if (guardando) {
      const v = Math.hypot(j.vel.x, j.vel.z), max = 1.2;
      if (v > max) { j.vel.x *= max / v; j.vel.z *= max / v; }
    }

    // Massa: cair em cima de inimigo machuca
    if (j.vel.y < -4 && !this.mergulho) {
      for (const e of this.inimigos()) {
        if (Math.hypot(e.pos.x - j.pos.x, e.pos.z - j.pos.z) < e.raio + j.raio + 0.1
          && j.pos.y > e.pos.y + 0.3 && j.pos.y < e.pos.y + (e.altura ?? 1.2) + 0.3) {
          e.receberDano(1, j, { atordoa: 0.6 });
          j.vel.y = 6;
          this.jogo.eventos.emitir('golpe', { autor: j, centro: e.pos.clone(), tipo: 'pisao' });
          break;
        }
      }
    }

    // Pulverizar em andamento: sobe (se começou no chão), mergulha, bate
    const m = this.mergulho;
    if (m) {
      if (surto) { this.mergulho = null; return; }
      m.t += dt;
      if (m.t > m.subida) { j.vel.y = Math.min(j.vel.y, -18); j.vel.x *= 0.8; j.vel.z *= 0.8; }
      if (j.noChao && m.t > m.subida + 0.02) this.impactoPulverizar(j);
      else if (m.t > 3) this.mergulho = null;
    }
  }

  impactoPulverizar(j) {
    this.mergulho = null;
    const { jogo } = this;
    jogo.adicionar(new Onda(jogo, j.pos.x, j.pos.z, { raioMax: RAIO_PULVERIZAR, duracao: 0.35, cor: 0xffe2a8, y: j.pos.y }));
    for (const e of jogo.entidades) {
      if (e.removido) continue;
      const d = j.distancia(e);
      if (e.time === 'inimigo' && d <= RAIO_PULVERIZAR + e.raio && Math.abs(e.pos.y - j.pos.y) < 1.8) {
        e.receberDano(2, j, { atordoa: 1.6, empurra: 3 });
        e.atordoar?.(1.6);
      } else if (e.ehSelo && d <= RAIO_PULVERIZAR) e.quebrar();
      else if (e.ehCaixa && d < 1.6) e.quebrar();
    }
    jogo.camera.tremer(0.6);
    j.recarga.identidade = 2;
    jogo.eventos.emitir('identidade', { macaco: 'hugo', tipo: 'pulverizar', centro: j.pos.clone() });
  }

  // ---------- K ----------
  identidade(j) {
    const { jogo } = this;
    if (j.atual === 'hugo') {
      if (this.mergulho) return;
      const noChao = j.noChao;
      if (noChao) j.vel.y = 7;
      this.mergulho = { t: 0, subida: noChao ? 0.22 : 0.05 };
      j.recarga.identidade = 0.3;
    } else if (j.atual === 'chico') {
      const r = this.recursos;
      if (r.bananas <= 0) { jogo.eventos.emitir('identidade', { macaco: 'chico', tipo: 'sem_banana' }); return; }
      r.bananas--;
      const o = j.olhando;
      jogo.adicionar(new Banana(jogo, j.pos.x + o.x * 0.3, j.pos.y + 0.8, j.pos.z + o.z * 0.3, o, j));
      j.recarga.identidade = 0.35;
      jogo.eventos.emitir('identidade', { macaco: 'chico', tipo: 'banana' });
    } else if (j.atual === 'orlando') {
      j.recarga.identidade = 0.35;
      if (this.segurado) this.arremessar(j);
      else this.agarrao(j);
    }
  }

  // ---------- L ----------
  recurso(j) {
    const { jogo } = this;
    if (j.atual === 'chico') {
      // comer banana: +1 de vida
      const r = this.recursos;
      if (r.bananas <= 0 || j.vida >= j.vidaMax) return;
      r.bananas--;
      j.vida = Math.min(j.vidaMax, j.vida + 1);
      jogo.eventos.emitir('recurso', { macaco: 'chico', tipo: 'comer' });
      jogo.eventos.emitir('cura', { alvo: j, qtd: 1 });
    } else if (j.atual === 'orlando') {
      // Ferramenta: aciona mecanismo perto; desliga máquina Quanta por um tempo
      let feito = false;
      for (const e of jogo.entidades) {
        if (e.removido || j.distancia(e) > 1.6) continue;
        if (e.acionavel && e.acionar()) feito = true;
        else if (e.time === 'inimigo' && e.faccao === 'quanta' && e.pesado && !e.ehChefe) { e.atordoar(3); feito = true; }
      }
      jogo.eventos.emitir('recurso', { macaco: 'orlando', tipo: 'ferramenta', sucesso: feito });
    }
  }

  // ---------- Orlando ----------
  agarrao(j) {
    const { jogo } = this;
    const o = j.olhando;
    let alvo = null, melhor = Infinity;
    for (const e of jogo.entidades) {
      if (e.removido || e === j || !(e.agarravel || (e.acionavel && !e.ligada))) continue;
      const dx = e.pos.x - j.pos.x, dz = e.pos.z - j.pos.z, d = Math.hypot(dx, dz);
      if (d > ALCANCE_AGARRAO + e.raio || Math.abs(e.pos.y - j.pos.y) > 1.6) continue;
      if (d > 0.5 && (dx * o.x + dz * o.z) / d < 0.5) continue;   // só à frente
      if (d < melhor) { melhor = d; alvo = e; }
    }
    const de = j.pos.clone().setY(j.pos.y + 0.9);
    const ate = alvo ? alvo.pos.clone().setY(alvo.pos.y + 0.5) : de.clone().addScaledVector(o, ALCANCE_AGARRAO);
    jogo.adicionar(new Braco(jogo, de, ate));
    if (alvo?.acionavel) alvo.acionar();
    else if (alvo) {
      alvo.preso = j;
      alvo.aoAgarrar?.();
      alvo.telegrafar?.(false);
      alvo.preparo = 0;
      this.segurado = alvo;
      this.tSegurado = 0;
    }
    jogo.eventos.emitir('identidade', { macaco: 'orlando', tipo: 'agarrao', alvo });
  }

  arremessar(j) {
    const e = this.segurado;
    this.segurado = null;
    e.preso = null;
    e.arremessado = { autor: j, t: 0 };
    e.vel.set(j.olhando.x * 11, 3, j.olhando.z * 11);
    this.jogo.eventos.emitir('identidade', { macaco: 'orlando', tipo: 'arremesso', alvo: e });
  }

  // larga no lugar (troca de macaco, surto, fuga)
  soltar(j) {
    const e = this.segurado;
    if (!e) return;
    this.segurado = null;
    e.preso = null;
    e.arremessado = { autor: j, t: 0 };
    e.vel.set(j.olhando.x * 2, 1, j.olhando.z * 2);
  }

  atualizarSegurado(j, dt, surto) {
    const e = this.segurado;
    if (!e) return;
    this.tSegurado += dt;
    if (e.removido) { this.segurado = null; return; }
    if (j.atual !== 'orlando' || surto || (e.time === 'inimigo' && this.tSegurado > 3)) { this.soltar(j); return; }
    e.pos.set(j.pos.x + j.olhando.x * 0.9, j.pos.y + 0.9, j.pos.z + j.olhando.z * 0.9);
  }

  inimigos() { return this.jogo.entidades.filter((e) => e.time === 'inimigo' && !e.removido); }
}
