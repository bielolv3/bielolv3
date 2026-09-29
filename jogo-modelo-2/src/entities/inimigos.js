import * as THREE from 'three';
import { Entidade } from './entidade.js';
import { DEGRAU, moverCorpo } from '../world/fisica.js';
import { Projetil, Onda, controleExterno } from './projeteis.js';
import { aplicarSpriteInimigo } from '../fx/sprites.js';

// Legião Cinzenta (cinza-azulado) e Quanta (teal). Números do Códice.
const COR_LEGIAO = 0x8b94a0;
const COR_QUANTA = 0x4fa6ab;

// "!" que aparece sobre o inimigo quando ele prepara um ataque
let texAviso = null;
function spriteAviso() {
  if (!texAviso) {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#1d190f'; g.fillRect(2, 0, 4, 16);
    g.fillStyle = '#ffd24a'; g.fillRect(3, 1, 2, 9); g.fillRect(3, 12, 2, 3);
    texAviso = new THREE.CanvasTexture(c);
    texAviso.magFilter = THREE.NearestFilter;
    texAviso.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAviso, transparent: true, alphaTest: 0.5, depthTest: false }));
  s.center.set(0.5, 0);
  s.scale.set(0.2, 0.4, 1);
  s.visible = false;
  return s;
}

// devolve um vetor de rascunho (chamado todo quadro por inimigo): copie se for guardar
const _dir = new THREE.Vector3();
const EIXO_Y = new THREE.Vector3(0, 1, 0);
const dirPara = (de, ate) => {
  const d = _dir.set(ate.x - de.x, 0, ate.z - de.z);
  return d.lengthSq() > 1e-6 ? d.normalize() : d.set(1, 0, 0);
};

// Base dos inimigos: atordoamento, derrapar (banana), agarrão/arremesso,
// movimento que não se joga no abismo, telegrafia de ataque.
// Subclasses implementam `pensar(dt)` e devolvem a velocidade desejada {x, z}.
export class Inimigo extends Entidade {
  constructor(jogo, x, z, { vida, raio = 0.35, faccao = 'legiao', altura = 1.2, dano = 1 } = {}) {
    super(jogo, x, z, { raio, vida, time: 'inimigo' });
    Object.assign(this, { faccao, altura, dano });
    this.posto = this.pos.clone();
    this.recargaAtaque = 0;
    this.preparo = 0;         // >0: telegrafando ataque
    this.alertado = 0;        // >0: avisado pelo Drone Vigia
    this.derrapando = 0;
    this.agarravel = true;
    this.t = Math.random() * 10;
    this.montarVisual();
    this.aviso = spriteAviso();
    this.aviso.position.y = altura + 0.15;
    this.objeto.add(this.aviso);
  }

  // Frente B pode trocar por sprite definitivo
  montarVisual() { aplicarSpriteInimigo(this, 'guardiao'); }

  atordoar(t) {
    if (this.resisteAtordoar) t *= 0.4;
    this.atordoado = Math.max(this.atordoado, t);
    this.preparo = 0;
  }

  receberDano(qtd, origem, opts = {}) {
    if (opts.atordoa && this.resisteAtordoar) opts = { ...opts, atordoa: opts.atordoa * 0.4 };
    if (this.pesado && opts.empurra) opts = { ...opts, empurra: opts.empurra * 0.3 };
    const ok = super.receberDano(qtd, origem, opts);
    if (ok && opts.atordoa) this.preparo = 0;
    return ok;
  }

  // banana/casca: escorrega na direção `dir`. Legião fica sem ordem por mais tempo.
  derrapar(dir, t = 1) {
    this.atordoar(this.faccao === 'legiao' ? t * 2 : t);
    this.derrapando = 0.7;
    const d = new THREE.Vector3(dir.x, 0, dir.z);
    if (d.lengthSq() > 1e-6) d.normalize().multiplyScalar(this.pesado ? 2.5 : 5);
    this.vel.x += d.x; this.vel.z += d.z;
    this.jogo.eventos.emitir('derrapa', { alvo: this });
  }

  telegrafar(ativo) { this.aviso.visible = ativo; }

  // Vigia chama em quem está por perto
  alertar(t = 8) { this.alertado = Math.max(this.alertado, t); }

  pensar() { return { x: 0, z: 0 }; }

  // colide com o cenário usando no máximo 0,4 de raio (os grandes não entalam em corredor)
  fisica(dt) {
    const c = { pos: this.pos, vel: this.vel, raio: Math.min(this.raio, 0.4) };
    moverCorpo(this.jogo.mapa, c, dt);
    this.noChao = c.noChao;
    this.caiu = c.caiu;
  }

  // anula a direção se o próximo passo for abismo ou degrau alto
  passoSeguro(vx, vz) {
    if (this.voa || !this.noChao) return { x: vx, z: vz };
    const m = Math.hypot(vx, vz);
    if (m < 0.01) return { x: vx, z: vz };
    const mapa = this.jogo.mapa;
    const nx = this.pos.x + vx / m * (this.raio + 0.25), nz = this.pos.z + vz / m * (this.raio + 0.25);
    const h = mapa.alturaEm(nx, nz);
    if (mapa.vazioEm(nx, nz) || h > this.pos.y + DEGRAU || h < this.pos.y - 1.1) return { x: 0, z: 0 };
    return { x: vx, z: vz };
  }

  seguir(alvo, vel) {
    const d = dirPara(this.pos, alvo);
    return { x: d.x * vel, z: d.z * vel };
  }

  atualizar(dt) {
    if (controleExterno(this, dt)) return;
    this.t += dt;
    this.recargaAtaque = Math.max(0, this.recargaAtaque - dt);
    this.alertado = Math.max(0, this.alertado - dt);
    this.derrapando = Math.max(0, this.derrapando - dt);
    let desejo = { x: 0, z: 0 };
    if (this.atordoado <= 0) { const p = this.pensar(dt); desejo = this.passoSeguro(p.x, p.z); }
    else this.telegrafar(false);
    // derrapando quase não tem atrito
    const k = 1 - Math.exp(-dt * (this.derrapando > 0 ? 0.8 : this.atordoado > 0 ? 4 : this.aceleracao ?? 8));
    this.vel.x += (desejo.x - this.vel.x) * k;
    this.vel.z += (desejo.z - this.vel.z) * k;
    this.fisica(dt);
    if (this.caiu) { this.morrer(); return; }
    this.atualizarVisual(dt);
    this.sincronizar(dt);
  }

  atualizarVisual() {
    if (!this.sprite) return;
    // tonto: balança; preparando: avermelha pulsando
    this.sprite.material.rotation = this.atordoado > 0 ? Math.sin(this.t * 14) * 0.25 : 0;
    const pulso = this.preparo > 0 ? 0.5 + 0.5 * Math.sin(this.t * 30) : 0;
    this.sprite.material.color.setRGB(1, 1 - pulso * 0.55, 1 - pulso * 0.6);
  }

  ataqueCorpoACorpo(alvo, alcance) {
    return this.distancia(alvo) < this.raio + alvo.raio + alcance && Math.abs(alvo.pos.y - this.pos.y) < 1;
  }

  atirar(alvo, opts = {}, desvio = 0) {
    const d = dirPara(this.pos, alvo.pos);
    if (desvio) d.applyAxisAngle(EIXO_Y, desvio);
    const y = this.pos.y + Math.min(0.8, this.altura * 0.55);
    this.jogo.adicionar(new Projetil(this.jogo, this.pos.x + d.x * this.raio, y, this.pos.z + d.z * this.raio, d, { autor: this, dano: this.dano, ...opts }));
  }
}

// Guardião Cinzento (Livro IX): vida 2 a 4, dano 1. Patrulha o posto; persegue em
// raio 5; volta quando perde. Telegrafa o golpe com ~0,4 s de preparo.
export class Guardiao extends Inimigo {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 3, faccao: 'legiao', altura: 1.2 });
    this.pontoPatrulha = this.posto.clone();
  }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const d = this.distancia(alvo);
    if (this.preparo > 0) {
      this.preparo -= dt;
      if (this.preparo <= 0) {
        this.telegrafar(false);
        if (this.ataqueCorpoACorpo(alvo, 0.45)) alvo.receberDano(this.dano, this, { empurra: 5 });
        this.jogo.eventos.emitir('golpe', { autor: this, centro: this.pos.clone() });
        this.recargaAtaque = 1;
      }
      return { x: 0, z: 0 };
    }
    if (this.ataqueCorpoACorpo(alvo, 0.25) && this.recargaAtaque <= 0) {
      this.preparo = 0.4;
      this.telegrafar(true);
      return { x: 0, z: 0 };
    }
    const visao = this.alertado > 0 ? 9 : 5, coleira = this.alertado > 0 ? 12 : 7;
    const dPosto = Math.hypot(this.pos.x - this.posto.x, this.pos.z - this.posto.z);
    if (d < visao && dPosto < coleira) return this.seguir(alvo.pos, 2.2);
    // patrulha: pontos sorteados perto do posto
    const dp = Math.hypot(this.pos.x - this.pontoPatrulha.x, this.pos.z - this.pontoPatrulha.z);
    if (dp < 0.3 || this.t % 4 < dt) {
      const a = Math.random() * Math.PI * 2;
      this.pontoPatrulha.set(this.posto.x + Math.cos(a) * 1.5, 0, this.posto.z + Math.sin(a) * 1.5);
    }
    return dp > 0.3 ? this.seguir(this.pontoPatrulha, dPosto > 2 ? 2.2 : 1.1) : { x: 0, z: 0 };
  }
}

// Sentinela Cinzenta: vida 3, dano 1. Parada; atira a até 12 unidades.
export class Sentinela extends Inimigo {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 3, faccao: 'legiao', altura: 1.3 });
    this.pesado = true;
    this.recargaAtaque = 1;
  }
  montarVisual() { aplicarSpriteInimigo(this, 'sentinela'); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const alcance = this.alertado > 0 ? 14 : 12;
    if (this.preparo > 0) {
      this.preparo -= dt;
      if (this.preparo <= 0) {
        this.telegrafar(false);
        this.atirar(alvo, { velocidade: 7, cor: 0xffc36b, vidaUtil: 2.2 });
        this.recargaAtaque = 2;
      }
    } else if (this.distancia(alvo) < alcance && this.recargaAtaque <= 0) {
      this.preparo = 0.5;
      this.telegrafar(true);
    }
    return { x: 0, z: 0 };
  }
}

// Bruto Cinzento: vida 8, dano 2. Investida em linha reta, telegrafada;
// quebra caixas no caminho e fica tonto se bater na parede.
export class Bruto extends Inimigo {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 8, raio: 0.55, faccao: 'legiao', altura: 1.9, dano: 2 });
    this.pesado = true;
    this.agarravel = false;
    this.investida = 0;
    this.dirInvestida = new THREE.Vector3();
  }
  montarVisual() { aplicarSpriteInimigo(this, 'bruto'); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const d = this.distancia(alvo);
    this.aceleracao = this.investida > 0 ? 20 : 8;
    if (this.investida > 0) return this.investir(dt, alvo);
    if (this.preparo > 0) {
      this.preparo -= dt;
      this.dirInvestida.copy(dirPara(this.pos, alvo.pos));
      if (this.preparo <= 0) { this.telegrafar(false); this.investida = 1.2; this.jogo.eventos.emitir('investida', { autor: this }); }
      return { x: 0, z: 0 };
    }
    if (d < 6 && this.recargaAtaque <= 0) { this.preparo = 0.8; this.telegrafar(true); return { x: 0, z: 0 }; }
    if (d < (this.alertado > 0 ? 11 : 8)) return this.seguir(alvo.pos, 1.3);
    return { x: 0, z: 0 };
  }

  investir(dt, alvo) {
    this.investida -= dt;
    const vel = 8;
    // parou de andar (parede ou borda): fica tonto
    if (this.investida < 1.05 && Math.hypot(this.vel.x, this.vel.z) < vel * 0.3) {
      this.investida = 0;
      this.recargaAtaque = 2;
      this.atordoar(1.2);
      this.jogo.camera.tremer(0.3);
      return { x: 0, z: 0 };
    }
    for (const e of this.jogo.entidades) {
      if (e.ehCaixa && !e.removido && this.distancia(e) < this.raio + 0.8) e.quebrar();
    }
    if (this.ataqueCorpoACorpo(alvo, 0.2)) {
      alvo.receberDano(this.dano, this, { empurra: 9 });
      this.investida = 0;
    }
    if (this.investida <= 0) this.recargaAtaque = 2;
    const s = this.passoSeguro(this.dirInvestida.x * vel, this.dirInvestida.z * vel);
    if (s.x === 0 && s.z === 0) { this.investida = 0; this.recargaAtaque = 1.5; }
    return s;
  }

  atordoar(t) { super.atordoar(t); this.investida = 0; }
}

// Base de voadores: flutua a `alturaVoo` acima do chão; cai se arremessado.
class Voador extends Inimigo {
  constructor(jogo, x, z, opts) {
    super(jogo, x, z, opts);
    this.voa = true;
    this.alturaVoo = 1.1;
    this.pos.y += this.alturaVoo;
  }
  fisica(dt) {
    if (this.arremessado || this.atordoado > 0.3) { this.voa = false; super.fisica(dt); this.voa = true; return; }
    const mapa = this.jogo.mapa;
    for (const eixo of ['x', 'z']) {
      const antes = this.pos[eixo];
      this.pos[eixo] += this.vel[eixo] * dt;
      if (mapa.alturaEm(this.pos.x, this.pos.z) > this.pos.y - 0.3) { this.pos[eixo] = antes; this.vel[eixo] = 0; }
    }
    // flutua sobre o chão; sobre o abismo mantém a altura
    const chao = mapa.vazioEm(this.pos.x, this.pos.z) ? this.pos.y - this.alturaVoo : mapa.alturaEm(this.pos.x, this.pos.z);
    const alvoY = chao + this.alturaVoo + Math.sin(this.t * 3) * 0.08;
    this.pos.y += (alvoY - this.pos.y) * Math.min(1, dt * 4);
    this.vel.y = 0;
    this.noChao = false;
    this.caiu = false;
  }
}

// Drone Vigia: vida 2, dano 1. Patrulha voando; vê a 8, alerta os outros, depois ataca.
export class DroneVigia extends Voador {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 2, raio: 0.3, faccao: 'legiao', altura: 0.6 });
    this.viu = false;
  }
  montarVisual() { aplicarSpriteInimigo(this, 'drone'); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const d = this.distancia(alvo);
    if (this.preparo > 0) {
      this.preparo -= dt;
      if (this.preparo <= 0) {
        this.telegrafar(false);
        if (!this.viu) this.darAlerta();
        else { this.atirar(alvo, { velocidade: 7, cor: 0xffc36b, vidaUtil: 2 }); this.recargaAtaque = 1.6; }
      }
      return { x: 0, z: 0 };
    }
    if (d < 8 && (!this.viu || this.recargaAtaque <= 0)) { this.preparo = this.viu ? 0.4 : 0.8; this.telegrafar(true); return { x: 0, z: 0 }; }
    if (this.viu && d < 12) {
      // mantém ~3,5 de distância do alvo
      const dir = dirPara(this.pos, alvo.pos), s = d > 3.8 ? 2 : d < 3.2 ? -2 : 0;
      return { x: dir.x * s, z: dir.z * s };
    }
    // patrulha em círculo ao redor do posto
    const a = this.t * 0.6;
    return this.seguir({ x: this.posto.x + Math.cos(a) * 2, z: this.posto.z + Math.sin(a) * 2 }, 1.6);
  }

  darAlerta() {
    this.viu = true;
    this.recargaAtaque = 0.8;
    for (const e of this.jogo.entidades) if (e.time === 'inimigo' && e !== this && this.distancia(e) < 12) e.alertar?.(8);
    this.jogo.eventos.emitir('alerta', { inimigo: this });
  }
}

// Acólito Quanta: vida 2, dano 1. Canaliza raio de longe; teleporta quando o jogador chega perto.
export class Acolito extends Inimigo {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 2, faccao: 'quanta', altura: 1.3 });
    this.recargaTele = 0;
    this.recargaAtaque = 1.5;
  }
  montarVisual() { aplicarSpriteInimigo(this, 'acolito'); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const d = this.distancia(alvo);
    this.recargaTele = Math.max(0, this.recargaTele - dt);
    if (d < 2.5 && this.recargaTele <= 0 && this.teleportar(alvo)) return { x: 0, z: 0 };
    if (this.preparo > 0) {
      this.preparo -= dt;
      if (this.preparo <= 0) {
        this.telegrafar(false);
        this.atirar(alvo, { velocidade: 9, cor: 0x7ff3ff, vidaUtil: 1.6 });
        this.recargaAtaque = 2.5;
      }
      return { x: 0, z: 0 };
    }
    if (d < 9 && this.recargaAtaque <= 0) { this.preparo = 0.7; this.telegrafar(true); return { x: 0, z: 0 }; }
    // mantém distância 4..7
    const dir = dirPara(this.pos, alvo.pos);
    if (d < 4) return { x: -dir.x * 2, z: -dir.z * 2 };
    if (d > 7 && d < 11) return { x: dir.x * 1.5, z: dir.z * 1.5 };
    return { x: 0, z: 0 };
  }

  // tile livre a 5..7 do jogador
  teleportar(alvo) {
    const mapa = this.jogo.mapa;
    for (let n = 0; n < 30; n++) {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 2;
      const x = alvo.pos.x + Math.cos(a) * r, z = alvo.pos.z + Math.sin(a) * r;
      const i = Math.floor(x), j = Math.floor(z), t = mapa.tipo(i, j);
      if (t.vazio || t.solido || mapa.bloqueios.has(`${i},${j}`)) continue;
      if (Math.abs(mapa.alturaEm(x, z) - this.pos.y) > 1.1) continue;
      const de = this.pos.clone();
      this.pos.set(i + .5, mapa.alturaEm(i + .5, j + .5), j + .5);
      this.vel.set(0, 0, 0);
      this.recargaTele = 3;
      this.preparo = 0; this.telegrafar(false);
      this.recargaAtaque = Math.max(this.recargaAtaque, 0.8);
      this.jogo.eventos.emitir('teleporte', { autor: this, de, para: this.pos.clone() });
      return true;
    }
    return false;
  }
}

// Torre Quanta: vida 5, dano 2. Parada; se o jogador entra no raio 6, sobrecarrega
// (pisca) e solta uma onda de choque. Pular esquiva a onda.
export class Torre extends Inimigo {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 5, raio: 0.45, faccao: 'quanta', altura: 1.8, dano: 2 });
    this.pesado = true;
    this.agarravel = false;
    this.recargaAtaque = 1;
  }
  montarVisual() {
    aplicarSpriteInimigo(this, 'torre');
    // anel no chão marca o raio de defesa
    this.anelRaio = new THREE.Mesh(
      new THREE.RingGeometry(5.9, 6, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: COR_QUANTA, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.anelRaio.position.y = 0.03;
    this.objeto.add(this.anelRaio);
  }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    if (this.preparo > 0) {
      this.preparo -= dt;
      this.anelRaio.material.opacity = 0.25 + 0.5 * (Math.sin(this.t * 25) > 0 ? 1 : 0);
      if (this.preparo <= 0) {
        this.telegrafar(false);
        this.anelRaio.material.opacity = 0.25;
        this.jogo.adicionar(new Onda(this.jogo, this.pos.x, this.pos.z, { raioMax: 6, duracao: 0.9, cor: 0x7ff3ff, dano: this.dano, autor: this, y: this.pos.y }));
        this.jogo.eventos.emitir('explosao', { autor: this, raio: 6 });
        this.recargaAtaque = 3;
      }
    } else if (this.distancia(alvo) < 6 && this.recargaAtaque <= 0) {
      this.preparo = 1.4;
      this.telegrafar(true);
    }
    return { x: 0, z: 0 };
  }
}

// Drone Construtor Quanta: vida 3, não luta. Reergue selos quebrados.
export class DroneConstrutor extends Voador {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 3, raio: 0.3, faccao: 'quanta', altura: 0.6 });
    this.canal = 0;
  }
  montarVisual() { aplicarSpriteInimigo(this, 'construtor'); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    let selo = null, melhor = Infinity;
    for (const e of this.jogo.entidades) {
      if (!e.ehSelo || !e.quebrado) continue;
      const d = this.distancia(e);
      if (d < melhor) { melhor = d; selo = e; }
    }
    if (selo) {
      if (melhor > 0.4) { this.canal = 0; this.telegrafar(false); return this.seguir(selo.pos, 2); }
      this.canal += dt;
      this.preparo = 1;   // pisca enquanto canaliza
      this.telegrafar(true);
      if (this.canal > 3 && selo.reerguer()) { this.canal = 0; this.preparo = 0; this.telegrafar(false); }
      return { x: 0, z: 0 };
    }
    this.preparo = 0;
    this.telegrafar(false);
    // foge do jogador; senão volta ao posto
    if (this.distancia(alvo) < 3) { const d = dirPara(alvo.pos, this.pos); return { x: d.x * 2.4, z: d.z * 2.4 }; }
    const dp = Math.hypot(this.pos.x - this.posto.x, this.pos.z - this.posto.z);
    return dp > 0.4 ? this.seguir(this.posto, 1.4) : { x: 0, z: 0 };
  }
}

// Andador Quanta (chefe de território): máquina de 4 m. Alterna pisão, rajada e
// onda; entre ataques procura cobertura atrás de selos intactos.
export class Andador extends Inimigo {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 20, raio: 0.9, faccao: 'quanta', altura: 2.5, dano: 2 });
    this.pesado = true;
    this.resisteAtordoar = true;
    this.agarravel = false;
    this.ehChefe = true;
    this.nome = 'Andador Quanta';
    this.padroes = ['pisao', 'rajada', 'onda'];
    this.indice = 0;
    this.estado = 'reposicionar';
    this.tEstado = 1.5;
    this.alvoPisao = new THREE.Vector3();
    this.aceleracao = 4;
    jogo.eventos.emitir('chefe', { alvo: this });
  }
  // a queda do chefe abre as portas da arena
  morrer() {
    super.morrer();
    for (const e of this.jogo.entidades) if (e.ehPorta) e.abrir();
  }

  montarVisual() { aplicarSpriteInimigo(this, 'andador'); }

  mudar(estado, t) { this.estado = estado; this.tEstado = t; }

  // ponto atrás do selo intacto mais próximo, do lado oposto ao jogador
  cobertura(alvo) {
    let melhor = null, dm = Infinity;
    for (const e of this.jogo.entidades) {
      if (!e.ehSelo || e.quebrado) continue;
      const d = this.distancia(e);
      if (d < dm) { dm = d; melhor = e; }
    }
    if (!melhor) return null;
    const d = dirPara(alvo.pos, melhor.pos);
    return new THREE.Vector3(melhor.pos.x + d.x * 1.6, 0, melhor.pos.z + d.z * 1.6);
  }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    this.tEstado -= dt;
    switch (this.estado) {
      case 'reposicionar': {
        if (this.tEstado <= 0) {
          const p = this.padroes[this.indice++ % this.padroes.length];
          this.telegrafar(true);
          this.preparo = 1;
          if (p === 'pisao') { this.alvoPisao.copy(alvo.pos); this.jogo.adicionar(new Onda(this.jogo, alvo.pos.x, alvo.pos.z, { raioMax: 2, duracao: 0.9, cor: 0xff5a4a, y: alvo.pos.y })); }
          this.mudar(p + 'Prep', p === 'onda' ? 1.1 : 0.9);
          return { x: 0, z: 0 };
        }
        const c = this.cobertura(alvo);
        const destino = c ?? alvo.pos;
        const d = Math.hypot(destino.x - this.pos.x, destino.z - this.pos.z);
        if (c ? d > 0.3 : d > 4) return this.seguir(destino, 1.6);
        return { x: 0, z: 0 };
      }
      case 'pisaoPrep':
        if (this.tEstado <= 0) {
          // salta até o ponto marcado
          const T = 0.7;
          this.vel.set((this.alvoPisao.x - this.pos.x) / T, 0.5 * 28 * T, (this.alvoPisao.z - this.pos.z) / T);
          this.mudar('pisaoAr', 2);
        }
        return { x: 0, z: 0 };
      case 'pisaoAr':
        if ((this.noChao && this.tEstado < 1.8) || this.tEstado <= 0) {
          this.jogo.adicionar(new Onda(this.jogo, this.pos.x, this.pos.z, { raioMax: 2.4, duracao: 0.35, cor: 0x7ff3ff, dano: this.dano, autor: this, y: this.pos.y }));
          this.jogo.camera.tremer(0.5);
          this.jogo.eventos.emitir('explosao', { autor: this, raio: 2.4 });
          this.fimAtaque();
          return { x: 0, z: 0 };
        }
        return { x: this.vel.x, z: this.vel.z };
      case 'rajadaPrep':
        if (this.tEstado <= 0) { this.rajadas = 3; this.mudar('rajada', 0); }
        return { x: 0, z: 0 };
      case 'rajada':
        if (this.tEstado <= 0) {
          for (const a of [-0.35, 0, 0.35]) this.atirar(alvo, { velocidade: 7, cor: 0x7ff3ff, vidaUtil: 2.5, tamanho: 0.16 }, a);
          this.tEstado = 0.45;
          if (--this.rajadas <= 0) this.fimAtaque();
        }
        return { x: 0, z: 0 };
      case 'ondaPrep':
        if (this.tEstado <= 0) {
          this.jogo.adicionar(new Onda(this.jogo, this.pos.x, this.pos.z, { raioMax: 7, duracao: 1.1, cor: 0x7ff3ff, dano: this.dano, autor: this, y: this.pos.y }));
          this.jogo.eventos.emitir('explosao', { autor: this, raio: 7 });
          this.fimAtaque();
        }
        return { x: 0, z: 0 };
    }
    return { x: 0, z: 0 };
  }

  fimAtaque() {
    this.telegrafar(false);
    this.preparo = 0;
    // mais rápido quando ferido
    this.mudar('reposicionar', this.vida < this.vidaMax / 2 ? 1.2 : 2);
  }

  atordoar(t) { super.atordoar(t); if (this.estado !== 'reposicionar') this.fimAtaque(); }
}
