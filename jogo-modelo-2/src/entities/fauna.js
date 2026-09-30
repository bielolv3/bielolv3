import * as THREE from 'three';
import { Entidade } from './entidade.js';
import { Inimigo } from './inimigos.js';
import { Onda, Casca } from './projeteis.js';
import { aplicarSpriteInimigo, quadroFauna } from '../fx/sprites.js';
import { DEGRAU } from '../world/fisica.js';
import { fixo } from '../core/liberar.js';

// Fauna nativa do veio Seiva ("os que sempre estiveram lá"). Não pertence a facção
// nenhuma e NÃO ataca primeiro: fica neutra até ser ferida, até alguém entrar no
// território dela ou pisar num ninho / numa raiz protegida. Depois de um tempo sem
// ameaça, se acalma e volta ao que fazia. A Matriarca é a mesma regra em tamanho colosso.
//
// Letras (world/tiles.js): J javali · F planta · H sapo · E aranha · U tartaruga ·
// N ninho · I inseto-luz · Z Matriarca.

const _dir = new THREE.Vector3();
const _tela = new THREE.Vector3();
const dirPara = (de, ate) => {
  const d = _dir.set(ate.x - de.x, 0, ate.z - de.z);
  return d.lengthSq() > 1e-6 ? d.normalize() : d.set(1, 0, 0);
};
const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// provoca toda a fauna (e a Matriarca) num raio em volta de `centro`
export function provocar(jogo, centro, raio, motivo) {
  for (const e of jogo.entidades) {
    if (!e.ehFauna || e.removido) continue;
    if (distXZ(e.pos, centro) < raio + (e.raio ?? 0)) e.provocar(motivo, centro);
  }
}

// ---------------------------------------------------------------- base
class Fauna extends Inimigo {
  constructor(jogo, x, z, { calma = 8, territorio = 0, ...opts } = {}) {
    super(jogo, x, z, { faccao: 'seiva', ...opts });
    this.ehFauna = true;
    this.provocado = 0;          // >0: segundos de raiva que restam
    this.calma = calma;          // quanto tempo a raiva dura sem nova ameaça
    this.territorio = territorio;
    this.flashAviso = 0;
    this.destinoVagar = this.posto.clone();
    this.tVagar = Math.random() * 2;
    if (territorio) this.montarTerritorio(territorio);
  }

  get irritado() { return this.provocado > 0; }

  // anel discreto no chão marca o território (ensina onde não pisar)
  montarTerritorio(r) {
    this.anelTerritorio = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.12, r, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe8d090, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.anelTerritorio.position.copy(this.posto).setY(this.posto.y + 0.04);
    // fica parado no posto (não acompanha o bicho)
    this.jogo.cena.add(this.anelTerritorio);
    const anel = this.anelTerritorio;
    const tirar = () => { anel.parent?.remove(anel); };
    this._tirarAnel = tirar;
  }

  provocar(motivo) {
    const antes = this.irritado;
    this.provocado = this.calma;
    if (!antes) {
      this.flashAviso = 0.7;
      this.jogo.eventos.emitir('alerta', { inimigo: this, fauna: true, motivo });
    }
  }

  // o Drone Vigia não manda na fauna
  alertar() {}

  receberDano(qtd, origem, opts) {
    const ok = super.receberDano(qtd, origem, opts);
    if (ok) {
      this.provocar('ferida');
      // tudo faz parte: ferir um bicho perto da Matriarca também a provoca
      if (!this.ehMatriarca) for (const e of this.jogo.entidades) if (e.ehMatriarca && !e.removido && this.distancia(e) < 9) e.provocar('fauna');
    }
    return ok;
  }

  // banana na cara (t <= 1) é agressão; escorregar numa casca (t > 1) não
  derrapar(dir, t = 1) {
    super.derrapar(dir, t);
    if (t <= 1) this.provocar('banana');
  }

  morrer() { super.morrer(); this._tirarAnel?.(); }

  telegrafar(ativo) { this._tel = ativo; this.aviso.visible = ativo || this.flashAviso > 0; }

  atualizar(dt) {
    this.flashAviso = Math.max(0, this.flashAviso - dt);
    // a raiva só passa com o intruso longe
    const j = this.jogo.jogador;
    const longe = !j || distXZ(j.pos, this.posto) > Math.max(this.territorio, 2.5) + 3;
    if (this.provocado > 0 && longe) this.provocado = Math.max(0, this.provocado - dt);
    super.atualizar(dt);
  }

  // passeia devagar perto do posto
  vagar(dt, raio = 1.2, vel = 0.7) {
    this.tVagar -= dt;
    const d = distXZ(this.pos, this.destinoVagar);
    if (this.tVagar <= 0) {
      this.tVagar = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2, r = Math.random() * raio;
      this.destinoVagar.set(this.posto.x + Math.cos(a) * r, 0, this.posto.z + Math.sin(a) * r);
    }
    return d > 0.25 ? this.seguir(this.destinoVagar, vel) : { x: 0, z: 0 };
  }

  voltarAoPosto(vel = 1.6) {
    return distXZ(this.pos, this.posto) > 0.4 ? this.seguir(this.posto, vel) : { x: 0, z: 0 };
  }

  atualizarVisual(dt) {
    super.atualizarVisual(dt);
    this.aviso.visible = !!this._tel || this.flashAviso > 0;
    if (this.anelTerritorio) {
      const m = this.anelTerritorio.material;
      m.color.setHex(this.irritado ? 0xff6a4a : 0xe8d090);
      m.opacity = this.irritado ? 0.6 : 0.45;
    }
    // vira o sprite (desenhado para a esquerda) conforme o lado da tela para onde vai
    if (!this.sprite) return;
    const olhar = this.olharPara ?? this.vel;
    const lado = olhar.x * _tela.setFromMatrixColumn(this.jogo.camera.cam.matrixWorld, 0).x + olhar.z * _tela.z;
    if (Math.abs(lado) > 0.3) this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (lado > 0 ? -1 : 1);
  }
}

// ---------------------------------------------------------------- Javali-raiz
// Pasta perto do posto. Quem entra no território (anel no chão) ou bate nele leva uma
// investida em linha reta, telegrafada. Bate na parede = fica tonto.
export class Javali extends Fauna {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 4, raio: 0.45, altura: 0.95, dano: 1, territorio: 2.6, calma: 7 });
    this.investida = 0;
    this.dirInvestida = new THREE.Vector3();
  }
  montarVisual() { this.especie = 'javali'; aplicarSpriteInimigo(this, 'javali'); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const d = this.distancia(alvo);
    this.aceleracao = this.investida > 0 ? 20 : 8;
    if (!this.irritado) {
      this.olharPara = null;
      if (distXZ(alvo.pos, this.posto) < this.territorio && Math.abs(alvo.pos.y - this.pos.y) < 1) this.provocar('territorio');
      else return this.vagar(dt, 1.2, 0.6);
    }
    if (this.investida > 0) return this.investir(dt, alvo);
    if (this.preparo > 0) {
      this.preparo -= dt;
      this.dirInvestida.copy(dirPara(this.pos, alvo.pos));
      this.olharPara = this.dirInvestida;
      if (this.preparo <= 0) { this.telegrafar(false); this.investida = 1.0; this.jogo.eventos.emitir('investida', { autor: this }); }
      return { x: 0, z: 0 };
    }
    if (d < 6 && this.recargaAtaque <= 0 && Math.abs(alvo.pos.y - this.pos.y) < 1) { this.preparo = 0.7; this.telegrafar(true); return { x: 0, z: 0 }; }
    // não persegue longe do território: bufa e volta
    if (d > 7) return this.voltarAoPosto();
    return { x: 0, z: 0 };
  }

  investir(dt, alvo) {
    this.investida -= dt;
    const vel = 7.5;
    if (this.investida < 0.85 && Math.hypot(this.vel.x, this.vel.z) < vel * 0.3) {
      this.investida = 0; this.recargaAtaque = 1.8; this.atordoar(1.1); this.jogo.camera.tremer(0.2);
      return { x: 0, z: 0 };
    }
    for (const e of this.jogo.entidades) if (e.ehCaixa && !e.removido && this.distancia(e) < this.raio + 0.8) e.quebrar();
    if (this.ataqueCorpoACorpo(alvo, 0.2)) { alvo.receberDano(this.dano, this, { empurra: 8 }); this.investida = 0; }
    if (this.investida <= 0) this.recargaAtaque = 1.8;
    const s = this.passoSeguro(this.dirInvestida.x * vel, this.dirInvestida.z * vel);
    if (s.x === 0 && s.z === 0) { this.investida = 0; this.recargaAtaque = 1.5; }
    return s;
  }

  atordoar(t) { super.atordoar(t); this.investida = 0; }
}

// ---------------------------------------------------------------- Planta-carnívora
// Parada. Morde quem chega perto (telegrafado). Banana distrai: casca no chão perto
// dela ou banana na boca = alguns segundos mastigando, sem morder.
export class Planta extends Fauna {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 3, raio: 0.4, altura: 1.25, dano: 1 });
    this.pesado = true;
    this.agarravel = false;
    this.mastigando = 0;
    this.alcance = 1.3;
  }
  montarVisual() { this.especie = 'planta'; aplicarSpriteInimigo(this, 'planta'); }
  fisica() { this.vel.set(0, 0, 0); this.noChao = true; this.caiu = false; }

  comer(t = 4.5) {
    this.mastigando = t;
    this.preparo = 0; this.telegrafar(false);
    this.jogo.eventos.emitir('identidade', { macaco: 'chico', tipo: 'distrai', alvo: this });
  }
  // banana acertou: come em vez de escorregar (e não se ofende)
  derrapar() { this.comer(); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    if (this.mastigando > 0) { this.mastigando -= dt; return { x: 0, z: 0 }; }
    // casca de banana ao alcance: vai nela
    for (const e of this.jogo.entidades) {
      if (e instanceof Casca && !e.removido && this.distancia(e) < this.alcance + 0.8) { e.removido = true; this.comer(); return { x: 0, z: 0 }; }
    }
    if (this.preparo > 0) {
      this.preparo -= dt;
      if (this.preparo <= 0) {
        this.telegrafar(false);
        this.jogo.eventos.emitir('golpe', { autor: this, centro: this.pos.clone() });
        if (this.distancia(alvo) < this.alcance + 0.25 && Math.abs(alvo.pos.y - this.pos.y) < 1.1) alvo.receberDano(this.dano, this, { empurra: 5 });
        this.recargaAtaque = 0.9;
      }
      return { x: 0, z: 0 };
    }
    if (this.distancia(alvo) < this.alcance && Math.abs(alvo.pos.y - this.pos.y) < 1.1 && this.recargaAtaque <= 0) {
      this.preparo = 0.45; this.telegrafar(true);
    }
    this.olharPara = dirPara(this.pos, alvo.pos).clone();
    return { x: 0, z: 0 };
  }

  atualizarVisual(dt) {
    super.atualizarVisual(dt);
    // mastigando: balança de satisfação
    if (this.sprite && this.mastigando > 0) this.sprite.material.rotation = Math.sin(this.t * 16) * 0.12;
  }
}

// ---------------------------------------------------------------- Sapo-bombástico
// Pula à toa perto do posto. Assustado (ferido, ou alguém chega a menos de 2), pula
// atrás do intruso, incha e explode em área (pular esquiva). Morto = explode também;
// o Orlando pode arremessá-lo como bomba.
export class Sapo extends Fauna {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 1, raio: 0.28, altura: 0.6, dano: 1, calma: 6 });
    this.tPulo = 1 + Math.random() * 2;
    this.inflando = 0;
    this.explodiu = false;
  }
  montarVisual() { this.especie = 'sapo'; aplicarSpriteInimigo(this, 'sapo'); }

  pular(alvoX, alvoZ, velH, velY) {
    const mapa = this.jogo.mapa;
    const d = Math.hypot(alvoX - this.pos.x, alvoZ - this.pos.z) || 1;
    const T = 2 * velY / 28;
    const px = this.pos.x + (alvoX - this.pos.x) / d * Math.min(d, velH * T);
    const pz = this.pos.z + (alvoZ - this.pos.z) / d * Math.min(d, velH * T);
    const h = mapa.alturaEm(px, pz);
    if (mapa.vazioEm(px, pz) || mapa.tipo(Math.floor(px), Math.floor(pz)).solido || Math.abs(h - this.pos.y) > DEGRAU + 0.3) return false;
    this.vel.set((px - this.pos.x) / T, velY, (pz - this.pos.z) / T);
    this.olharPara = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    return true;
  }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const d = this.distancia(alvo);
    if (!this.noChao) return { x: this.vel.x, z: this.vel.z };
    if (!this.irritado && d < 2 && Math.abs(alvo.pos.y - this.pos.y) < 1) this.provocar('susto');
    if (this.inflando > 0) {
      this.inflando -= dt;
      if (this.inflando <= 0) this.explodir();
      return { x: 0, z: 0 };
    }
    this.tPulo -= dt;
    if (this.irritado) {
      if (d < 1.6) { this.inflando = 0.8; this.preparo = 0.8; this.telegrafar(true); return { x: 0, z: 0 }; }
      if (this.tPulo <= 0) { this.tPulo = 0.8; if (this.pular(alvo.pos.x, alvo.pos.z, 3.5, 5.5)) return { x: this.vel.x, z: this.vel.z }; }
      return { x: 0, z: 0 };
    }
    if (this.tPulo <= 0) {
      this.tPulo = 1.8 + Math.random() * 2;
      const a = Math.random() * Math.PI * 2;
      const r = distXZ(this.pos, this.posto) > 1.5 ? 0 : 1;
      const tx = r ? this.pos.x + Math.cos(a) : this.posto.x, tz = r ? this.pos.z + Math.sin(a) : this.posto.z;
      if (this.pular(tx, tz, 1.6, 4.5)) return { x: this.vel.x, z: this.vel.z };
    }
    return { x: 0, z: 0 };
  }

  explodir() {
    if (this.explodiu) return;
    this.explodiu = true;
    const { jogo } = this, R = 2.2;
    jogo.adicionar(new Onda(jogo, this.pos.x, this.pos.z, { raioMax: R, duracao: 0.35, cor: 0xff8a3a, dano: this.dano, autor: this, y: this.pos.y }));
    for (const e of jogo.entidades) {
      if (e === this || e.removido) continue;
      if (e.ehCaixa && this.distancia(e) < 1.6) e.quebrar();
      else if (e.time === 'inimigo' && this.distancia(e) < R + e.raio && Math.abs(e.pos.y - this.pos.y) < 1.5) e.receberDano(1, this.arremessadoPor ?? this, { empurra: 5 });
    }
    jogo.camera.tremer(0.3);
    jogo.eventos.emitir('explosao', { autor: this, raio: R, centro: this.pos.clone() });
    if (!this.removido) super.morrer();
  }

  // bombástico até o fim: morrer = explodir
  morrer() { this.explodir(); if (!this.removido) super.morrer(); }

  // arremessado pelo Orlando: explode onde cair
  aoAgarrar() { this.arremessadoPor = this.jogo.jogador; }
  aoPousar() { this.explodir(); }

  atualizarVisual(dt) {
    super.atualizarVisual(dt);
    if (!this.sprite) return;
    const k = this.inflando > 0 ? 1 + (0.8 - this.inflando) * 0.6 : 1;
    this.sprite.scale.set(Math.sign(this.sprite.scale.x || 1) * (26 / 32) * k, (20 / 32) * k, 1);
  }
}

// ---------------------------------------------------------------- Aranha-gigante
// Guarda os ninhos. Provocada: cospe teia (prende por um instante e deixa uma poça
// grudenta que lenta) e morde de perto. Não vai longe dos ninhos.
export class Aranha extends Fauna {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 4, raio: 0.42, altura: 0.9, dano: 1, calma: 7 });
    this.tiro = false;
  }
  montarVisual() { this.especie = 'aranha'; aplicarSpriteInimigo(this, 'aranha'); }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    const d = this.distancia(alvo);
    if (!this.irritado) { this.olharPara = null; return this.vagar(dt, 0.8, 0.5); }
    this.olharPara = dirPara(this.pos, alvo.pos).clone();
    if (this.preparo > 0) {
      this.preparo -= dt;
      if (this.preparo <= 0) {
        this.telegrafar(false);
        if (this.tiro) {
          const dir = dirPara(this.pos, alvo.pos);
          this.jogo.adicionar(new Teia(this.jogo, this.pos.x + dir.x * 0.4, this.pos.y + 0.45, this.pos.z + dir.z * 0.4, dir.clone(), this));
          this.recargaAtaque = 2.4;
        } else {
          this.jogo.eventos.emitir('golpe', { autor: this, centro: this.pos.clone() });
          if (this.ataqueCorpoACorpo(alvo, 0.45)) alvo.receberDano(this.dano, this, { empurra: 5 });
          this.recargaAtaque = 1.1;
        }
      }
      return { x: 0, z: 0 };
    }
    const coleira = distXZ(this.pos, this.posto) > 6;
    if (this.ataqueCorpoACorpo(alvo, 0.3) && this.recargaAtaque <= 0) { this.tiro = false; this.preparo = 0.4; this.telegrafar(true); return { x: 0, z: 0 }; }
    if (d > 2.4 && d < 8 && this.recargaAtaque <= 0) { this.tiro = true; this.preparo = 0.6; this.telegrafar(true); return { x: 0, z: 0 }; }
    if (coleira || d > 9) return this.voltarAoPosto(2);
    return d > 1 ? this.seguir(alvo.pos, 2.4) : { x: 0, z: 0 };
  }
}

// fio de teia: voa reto; no jogador prende (atordoa) por 0,8 s; onde parar vira poça
let texTeia = null;
function texturaTeia() {
  if (texTeia) return texTeia;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e4d8';
  for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; for (let r = 0; r < 15; r++) g.fillRect(Math.round(16 + Math.cos(t) * r), Math.round(16 + Math.sin(t) * r), 1, 1); }
  for (const r of [4, 8, 12, 15]) for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; g.fillRect(Math.round(16 + Math.cos(t) * r), Math.round(16 + Math.sin(t) * r), 1, 1); }
  texTeia = new THREE.CanvasTexture(c);
  texTeia.magFilter = texTeia.minFilter = THREE.NearestFilter;
  texTeia.colorSpace = THREE.SRGBColorSpace;
  return texTeia;
}
const geoFio = fixo(new THREE.SphereGeometry(0.1, 6, 4));
const matFio = fixo(new THREE.MeshBasicMaterial({ color: 0xf0ece0 }));

export class Teia extends Entidade {
  constructor(jogo, x, y, z, dir, autor) {
    super(jogo, x, z, { raio: 0.15 });
    this.pos.y = y;
    this.vel.copy(dir).multiplyScalar(6.5);
    this.autor = autor;
    this.alvo = 'jogador';
    this.dano = 0;
    this.tempo = 1.4;
    this.sombra.visible = false;
    this.malha = new THREE.Mesh(geoFio, matFio);
    this.objeto.add(this.malha);
  }
  atualizar(dt) {
    this.tempo -= dt;
    this.pos.addScaledVector(this.vel, dt);
    const j = this.jogo.jogador;
    const mapa = this.jogo.mapa;
    if (j && distXZ(j.pos, this.pos) < j.raio + 0.2 && this.pos.y > j.pos.y - 0.2 && this.pos.y < j.pos.y + 1.5) {
      // Guarda do Hugo segura a teia
      if (!this.jogo.habilidades?.recursos.guardando || j.atual !== 'hugo') j.atordoado = Math.max(j.atordoado, 0.8);
      this.fim(j.pos.x, j.pos.z);
      return;
    }
    if (this.tempo <= 0 || mapa.alturaEm(this.pos.x, this.pos.z) > this.pos.y) { this.fim(this.pos.x - this.vel.x * dt, this.pos.z - this.vel.z * dt); return; }
    this.sincronizar(dt);
  }
  fim(x, z) {
    this.removido = true;
    if (!this.jogo.mapa.vazioEm(x, z)) this.jogo.adicionar(new TeiaChao(this.jogo, x, z));
  }
}

// poça de teia: quem pisa anda na metade da velocidade
export class TeiaChao extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.75 });
    this.sombra.visible = false;
    this.tempo = 6;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: texturaTeia(), transparent: true, alphaTest: 0.3, depthWrite: false }));
    m.position.y = 0.03;
    m.rotation.y = Math.random() * 3;
    this.malha = m;
    this.objeto.add(m);
  }
  atualizar(dt) {
    this.tempo -= dt;
    if (this.tempo <= 0) { this.removido = true; return; }
    const j = this.jogo.jogador;
    if (j && distXZ(j.pos, this.pos) < this.raio && j.pos.y < this.pos.y + 0.3) {
      const k = Math.exp(-dt * 12);
      j.vel.x *= k; j.vel.z *= k;
    }
    this.malha.material.opacity = Math.min(1, this.tempo);
    this.sincronizar(dt);
  }
}

// ---------------------------------------------------------------- Ninho
// Ovos no chão. Pisar em cima provoca toda a fauna num raio de 7 (e a Matriarca).
export class Ninho extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.45 });
    this.ehNinho = true;
    this.recarga = 0;
    aplicarSpriteInimigo(this, 'ninho');   // ovos mexendo (fx/sprites.js)
    this.sombra.scale.setScalar(0.5);
    this.t = 0;
  }
  atualizar(dt) {
    this.t += dt;
    this.recarga = Math.max(0, this.recarga - dt);
    const j = this.jogo.jogador;
    if (j && this.recarga <= 0 && distXZ(j.pos, this.pos) < 0.55 && j.pos.y < this.pos.y + 0.4) {
      this.recarga = 2;
      this.balanco = 0.6;
      provocar(this.jogo, this.pos, 7, 'ninho');
      this.jogo.eventos.emitir('fauna', { tipo: 'ninho', alvo: this });
    }
    this.balanco = Math.max(0, (this.balanco ?? 0) - dt);
    this.sprite.material.rotation = this.balanco > 0 ? Math.sin(this.t * 40) * 0.08 : 0;
    quadroFauna(this, this.balanco > 0 ? 'golpe' : 'parado', this.t, this.balanco > 0 ? 12 : undefined);
    this.sincronizar(dt);
  }
}

// ---------------------------------------------------------------- Tartaruga-menor
// Não é inimiga. Em terra, dá para empurrar (o Hugo empurra mais rápido). Na água ela
// nada sozinha em linha reta, ida e volta, e carrega quem estiver no casco.
// (Se existe uma pequena, a grande também já foi pequena.)
const NIVEL_AGUA = -0.3;       // mesmo nível da superfície desenhada em visual.js
const CASCO_ALTO = 0.6;        // altura do casco acima do chão/água
const TEMPO_TILE = 0.75;       // segundos para nadar um tile
const PAUSA_MARGEM = 1.4;      // parada na margem antes de voltar

export class Tartaruga extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.45, time: 'neutro' });
    this.ehTartaruga = true;
    this.agarravel = false;
    this.empurrando = 0;
    this.passo = null;         // { de, para, t, i, j }
    this.dir = null;           // direção de nado [di, dj]
    this.pausa = 0;
    aplicarSpriteInimigo(this, 'tartaruga');   // parado / nadar / recolher (fx/sprites.js)
    this.recolhida = 0;
    this.i = Math.floor(x); this.j = Math.floor(z);
    this.ocupar(this.i, this.j);
    this.pos.set(this.i + 0.5, this.topo(this.i, this.j) - CASCO_ALTO, this.j + 0.5);
    if (this.naAgua(this.i, this.j)) this.dir = this.primeiraDirecao();
  }

  naAgua(i, j) { const t = this.jogo.mapa.tipo(i, j); return !!(t.agua || t.lento); }
  topo(i, j) { const t = this.jogo.mapa.tipo(i, j); return (t.agua ? NIVEL_AGUA : t.altura) + CASCO_ALTO; }
  ocupar(i, j) { const t = this.jogo.mapa.tipo(i, j); this.jogo.mapa.bloquear(i, j, this.topo(i, j) - t.altura); }
  soltar(i, j) { this.jogo.mapa.desbloquear(i, j); }
  livre(i, j) { return !this.jogo.mapa.bloqueios.has(`${i},${j}`); }

  // nado: a linha que liga duas margens pisáveis (senão, a mais comprida)
  primeiraDirecao() {
    let melhor = null, nota = 0;
    const margem = (i, j) => { const t = this.jogo.mapa.tipo(i, j); return !t.solido && !t.vazio; };
    for (const d of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      let k = 0;
      while (k < 30 && this.naAgua(this.i + d[0] * (k + 1), this.j + d[1] * (k + 1))) k++;
      let v = 0;
      while (v < 30 && this.naAgua(this.i - d[0] * (v + 1), this.j - d[1] * (v + 1))) v++;
      const pontas = margem(this.i + d[0] * (k + 1), this.j + d[1] * (k + 1)) + margem(this.i - d[0] * (v + 1), this.j - d[1] * (v + 1));
      const n = pontas * 100 + k + v + (k > 0 ? 0.5 : 0);
      if (n > nota) { nota = n; melhor = k > 0 ? d : [-d[0], -d[1]]; }
    }
    return melhor;
  }

  // o jogador está em pé no casco?
  cavaleiro() {
    const j = this.jogo.jogador;
    if (!j) return null;
    const topo = this.pos.y + CASCO_ALTO;
    if (Math.abs(j.pos.x - this.pos.x) < 0.62 && Math.abs(j.pos.z - this.pos.z) < 0.62 && j.pos.y > topo - 0.2 && j.pos.y < topo + 0.35) return j;
    return null;
  }

  mover(ni, nj) {
    this.ocupar(ni, nj);
    this.passo = { de: this.pos.clone(), para: new THREE.Vector3(ni + 0.5, this.topo(ni, nj) - CASCO_ALTO, nj + 0.5), t: 0, i: this.i, j: this.j };
    this.i = ni; this.j = nj;
    this.olhar = [ni - this.passo.i, nj - this.passo.j];
    this.jogo.eventos.emitir('empurrao', { alvo: this });
  }

  atualizar(dt) {
    if (this.passo) {
      const p = this.passo, rider = this.cavaleiro();
      const antes = this.pos.clone();
      p.t = Math.min(1, p.t + dt / (this.dir ? TEMPO_TILE : 0.3));
      this.pos.lerpVectors(p.de, p.para, p.t);
      if (rider) { rider.pos.x += this.pos.x - antes.x; rider.pos.z += this.pos.z - antes.z; rider.pos.y = Math.max(rider.pos.y, this.pos.y + CASCO_ALTO); }
      if (p.t >= 1) {
        this.soltar(p.i, p.j);
        this.passo = null;
        if (!this.dir && this.naAgua(this.i, this.j)) { this.dir = this.olhar; this.pausa = 0.3; this.jogo.eventos.emitir('fauna', { tipo: 'tartaruga', alvo: this }); }
      }
    } else if (this.dir) {
      // nadando: segue reto; na margem, espera e volta
      this.pausa -= dt;
      if (this.pausa <= 0) {
        const [di, dj] = this.dir, ni = this.i + di, nj = this.j + dj;
        if (this.naAgua(ni, nj) && this.livre(ni, nj)) this.mover(ni, nj);
        else if (this.naAgua(this.i - di, this.j - dj) && this.livre(this.i - di, this.j - dj)) { this.dir = [-di, -dj]; this.pausa = PAUSA_MARGEM; }
        else this.pausa = 0.5;
      }
    } else this.checarEmpurrao(dt);
    this.atualizarVisual(dt);
    this.sincronizar(dt);
  }

  // qualquer macaco empurra encostado numa face; o Hugo precisa de menos tempo
  checarEmpurrao(dt) {
    const j = this.jogo.jogador;
    const dir = this.jogo.camera.eixoParaMundo(this.jogo.input.eixo);
    const dx = j.pos.x - this.pos.x, dz = j.pos.z - this.pos.z;
    let passo = null;
    if (j.noChao && j.pos.y < this.pos.y + CASCO_ALTO - 0.3) {
      if (Math.abs(dx) > Math.abs(dz) && Math.abs(dx) < 0.95 && Math.abs(dz) < 0.45 && dir.x * -Math.sign(dx) > 0.6) passo = [-Math.sign(dx), 0];
      if (Math.abs(dz) > Math.abs(dx) && Math.abs(dz) < 0.95 && Math.abs(dx) < 0.45 && dir.z * -Math.sign(dz) > 0.6) passo = [0, -Math.sign(dz)];
    }
    this.empurrando = passo ? this.empurrando + dt : 0;
    if (this.empurrando < (j.atual === 'hugo' ? 0.25 : 0.6)) return;
    this.empurrando = 0;
    const ni = this.i + passo[0], nj = this.j + passo[1], m = this.jogo.mapa, t = m.tipo(ni, nj);
    if (!this.livre(ni, nj) || t.solido || (t.vazio && !t.agua)) return;
    if (!t.agua && t.altura > m.tipo(this.i, this.j).altura + 0.05) return;   // não sobe degrau
    this.mover(ni, nj);
  }

  atualizarVisual() {
    if (!this.sprite) return;
    const o = this.olhar ?? [1, 0];
    const r = _tela.setFromMatrixColumn(this.jogo.camera.cam.matrixWorld, 0);
    const lado = o[0] * r.x + o[1] * r.z;
    if (Math.abs(lado) > 0.3) this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (lado > 0 ? -1 : 1);
    // quadro: empurrada (ou alguém forçando) recolhe no casco e demora a pôr a cabeça para fora
    const agora = performance.now() / 1000;
    if ((this.passo && !this.dir) || this.empurrando > 0.08) this.recolhida = 0.9;
    this.recolhida = Math.max(0, this.recolhida - (agora - (this._tv ?? agora)));
    this._tv = agora;
    quadroFauna(this, this.dir ? 'nadar' : this.recolhida > 0 ? 'recolher' : 'parado', agora, this.dir ? 6 : undefined);
    // nadando: balança devagar na água
    this.sprite.position.y = this.dir ? CASCO_ALTO * 0.35 + Math.sin(performance.now() / 400) * 0.03 : 0;
    this.sombra.visible = !this.dir;
  }
}

// ---------------------------------------------------------------- Inseto-luz
// Vaga-lume inofensivo: ronda o posto e se afasta de quem chega perto.
let texBrilhoInseto = null;
export class InsetoLuz extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.1, time: 'neutro' });
    this.sombra.visible = false;
    this.posto = this.pos.clone();
    this.t = Math.random() * 10;
    aplicarSpriteInimigo(this, 'inseto');   // asas batendo (fx/sprites.js)
    this.semLuz = true;   // brilha sozinho
    if (!texBrilhoInseto) {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5) / 8; if (d < 1) { g.fillStyle = `rgba(140,220,255,${(1 - d) * 0.8})`; g.fillRect(x, y, 1, 1); } }
      texBrilhoInseto = new THREE.CanvasTexture(c);
    }
    this.brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilhoInseto, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.brilho.scale.setScalar(0.9);
    this.objeto.add(this.brilho);
  }
  atualizar(dt) {
    this.t += dt;
    const j = this.jogo.jogador;
    let ox = Math.cos(this.t * 0.7) * 1.2 + Math.sin(this.t * 1.9) * 0.3, oz = Math.sin(this.t * 0.9) * 1.2;
    if (j && distXZ(j.pos, this.posto) < 2) { const d = dirPara(j.pos, this.posto); ox += d.x * 1.5; oz += d.z * 1.5; }
    const alvoX = this.posto.x + ox, alvoZ = this.posto.z + oz;
    this.pos.x += (alvoX - this.pos.x) * Math.min(1, dt * 2);
    this.pos.z += (alvoZ - this.pos.z) * Math.min(1, dt * 2);
    this.pos.y = this.jogo.mapa.alturaEm(this.pos.x, this.pos.z) + 1.2 + Math.sin(this.t * 3) * 0.2;
    if (this.jogo.mapa.vazioEm(this.pos.x, this.pos.z)) this.pos.y = this.posto.y + 1.2;
    this.brilho.material.opacity = 0.6 + Math.sin(this.t * 5) * 0.35;
    this.brilho.position.y = 0.15;
    quadroFauna(this, 'parado', this.t);
    this.sincronizar(dt);
  }
}

// ---------------------------------------------------------------- A Matriarca
// Colosso do veio Seiva. Não ataca primeiro: fica enraizada no fundo da clareira e só
// reage a quem pisa nas raízes vivas (tiles `protegido`), fere a fauna perto dela, pisa
// num ninho ou bate nela. Irritada, alterna pisão sísmico (onda: pule), chicote de
// raízes em linha (saia da linha) e nuvem de esporos (saia da nuvem). Depois de um
// tempo sem nova ameaça, volta a dormir.
const COR_AVISO = 0xff5a4a;
export class Matriarca extends Fauna {
  constructor(jogo, x, z) {
    super(jogo, x, z, { vida: 60, raio: 1.3, altura: 6.8, dano: 1, calma: 9 });
    this.ehMatriarca = true;
    this.pesado = true;
    this.resisteAtordoar = true;
    this.agarravel = false;
    this.nome = 'A Matriarca';
    this.estado = 'calma';
    this.tEstado = 0;
    this.indice = 0;
    this.alvoChicote = new THREE.Vector3();
    this.pisouRaiz = 0;
    this.linhas = [];
  }
  montarVisual() { this.especie = 'matriarca'; aplicarSpriteInimigo(this, 'matriarca', 1.25); }
  fisica() { this.vel.set(0, 0, 0); this.noChao = true; this.caiu = false; }

  provocar(motivo, centro) {
    const antes = this.irritado;
    super.provocar(motivo, centro);
    if (!antes && !this.ehChefe) { this.ehChefe = true; this.jogo.eventos.emitir('chefe', { alvo: this }); }
    if (!antes && this.estado === 'calma') this.mudar('despertar', 1.0);
  }

  mudar(e, t) { this.estado = e; this.tEstado = t; }

  atualizar(dt) {
    // a raiva dela passa com o tempo, perto ou longe (a clareira é dela)
    this.flashAviso = Math.max(0, this.flashAviso - dt);
    this.tGolpe = Math.max(0, (this.tGolpe ?? 0) - dt);
    if (this.provocado > 0 && this.estado === 'pausa') this.provocado = Math.max(0, this.provocado - dt);
    Inimigo.prototype.atualizar.call(this, dt);
    for (const l of this.linhas) l.atualizar(dt);
    this.linhas = this.linhas.filter((l) => !l.fim);
  }

  pensar(dt) {
    const alvo = this.jogo.jogador;
    // pisar na raiz viva: ela sente
    const t = this.jogo.mapa.tipo(Math.floor(alvo.pos.x), Math.floor(alvo.pos.z));
    if (t.protegido && alvo.noChao && alvo.pos.y < t.altura + 0.15) {
      this.pisouRaiz = 1.2;
      this.alvoChicote.copy(alvo.pos);
      this.provocar('raiz');
    }
    this.pisouRaiz = Math.max(0, this.pisouRaiz - dt);
    this.tEstado -= dt;
    switch (this.estado) {
      case 'calma': this.telegrafar(false); break;
      case 'despertar':
        if (this.tEstado <= 0) this.mudar('pausa', 0.2);
        break;
      case 'pausa':
        if (!this.irritado) { this.mudar('calma', 0); this.preparo = 0; break; }
        if (this.tEstado <= 0) this.escolherAtaque(alvo);
        break;
      case 'pisaoPrep':
        if (this.tEstado <= 0) {
          this.jogo.adicionar(new Onda(this.jogo, this.pos.x, this.pos.z, { raioMax: 8, duracao: 1.1, cor: 0xb0e060, dano: this.dano, autor: this, y: this.pos.y }));
          this.jogo.camera.tremer(0.7);
          this.jogo.eventos.emitir('explosao', { autor: this, raio: 8 });
          this.fimAtaque();
        }
        break;
      case 'chicotePrep':
        if (this.tEstado <= 0) { this.linhaAtual?.disparar(); this.jogo.camera.tremer(0.35); this.fimAtaque(); }
        break;
      case 'esporosPrep':
        if (this.tEstado <= 0) {
          for (let k = 0; k < 3; k++) {
            const a = (k - 1) * 0.5, d = dirPara(this.pos, alvo.pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
            this.jogo.adicionar(new NuvemEsporos(this.jogo, this.pos.x + d.x * 1.6, this.pos.z + d.z * 1.6, d.clone(), this));
          }
          this.jogo.eventos.emitir('explosao', { autor: this, raio: 2 });
          this.fimAtaque();
        }
        break;
    }
    return { x: 0, z: 0 };
  }

  escolherAtaque(alvo) {
    this.preparo = 1; this.telegrafar(true);
    // quem está na raiz leva o chicote; senão alterna os três
    let p = this.pisouRaiz > 0 ? 'chicote' : ['pisao', 'chicote', 'esporos'][this.indice++ % 3];
    if (p === 'pisao' && this.distancia(alvo) > 8.5) p = 'esporos';
    if (this.pisouRaiz <= 0 && this.distancia(alvo) < 3.5 && Math.random() < 0.5) p = 'pisao';   // colado nela: pisa
    if (p === 'chicote') {
      if (this.pisouRaiz <= 0) this.alvoChicote.copy(alvo.pos);
      this.linhaAtual = new ChicoteRaizes(this.jogo, this.pos, this.alvoChicote, this);
      this.linhas.push(this.linhaAtual);
      this.mudar('chicotePrep', 1.0);
    } else if (p === 'pisao') {
      // aviso: anel vermelho mostrando até onde o pisão chega
      this.jogo.adicionar(new Onda(this.jogo, this.pos.x, this.pos.z, { raioMax: 8, duracao: 1.2, cor: COR_AVISO, y: this.pos.y }));
      this.mudar('pisaoPrep', 1.2);
    } else this.mudar('esporosPrep', 0.9);
  }

  // quadro da animação (fx/sprites.js, ANIMADOS.matriarca) pelo estado da IA
  quadroAnimado(t) {
    if (this.tGolpe > 0) return [this.ultimoGolpe, 0];
    switch (this.estado) {
      case 'despertar': return ['despertar', this.tEstado > 0.5 ? 0 : 1];
      case 'pisaoPrep': return ['pisaoPrep', this.tEstado > 0.6 ? 0 : 1];
      case 'chicotePrep': return ['chicotePrep', Math.floor(t * 6)];
      case 'esporosPrep': return ['esporosPrep', Math.floor(t * 5)];
      case 'pausa': if (this.irritado) return ['ira', Math.floor(t * 2.5)];
    }
    return ['calma', Math.floor(t * 1.6)];
  }

  fimAtaque() {
    this.ultimoGolpe = this.estado.replace('Prep', ''); this.tGolpe = 0.5;
    this.preparo = 0; this.telegrafar(false); this.mudar('pausa', this.vida < this.vidaMax / 2 ? 1.0 : 1.6);
  }

  // não é derrubada no meio de um golpe; só interrompe o preparo
  atordoar(t) { super.atordoar(t * 0.3); }

  morrer() {
    for (const l of this.linhas) l.limpar();
    super.morrer();
  }

  atualizarVisual(dt) {
    super.atualizarVisual(dt);
    if (!this.sprite) return;
    this.sprite.scale.x = Math.abs(this.sprite.scale.x);     // sempre de frente
    const ira = this.irritado ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0;
    if (this.preparo <= 0) this.sprite.material.color.setRGB(1, 1 - ira * 0.25, 1 - ira * 0.3);
  }
}

// chicote de raízes: faixa vermelha no chão (aviso) e depois espinhos de raiz ao longo
// da linha. Pular não adianta (as raízes sobem alto): saia de lado.
const geoEspinho = fixo(new THREE.ConeGeometry(0.22, 1.3, 5));
const matEspinho = fixo(new THREE.MeshLambertMaterial({ color: 0x5a3e22, flatShading: true }));
class ChicoteRaizes {
  constructor(jogo, de, ate, autor) {
    this.jogo = jogo; this.autor = autor;
    const d = new THREE.Vector3(ate.x - de.x, 0, ate.z - de.z);
    if (d.lengthSq() < 1e-4) d.set(0, 0, 1);
    d.normalize();
    this.dir = d;
    this.ini = new THREE.Vector3(de.x + d.x * 1.2, 0, de.z + d.z * 1.2);
    this.comp = 11;
    this.largura = 0.55;
    this.fase = 'aviso';
    this.t = 0;
    this.grupo = new THREE.Group();
    const y = jogo.mapa.alturaEm(this.ini.x, this.ini.z) + 0.05;
    const faixa = new THREE.Mesh(new THREE.PlaneGeometry(this.largura * 2, this.comp).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: COR_AVISO, transparent: true, opacity: 0.35, depthWrite: false }));
    faixa.position.set(this.ini.x + d.x * this.comp / 2, y, this.ini.z + d.z * this.comp / 2);
    faixa.rotation.y = Math.atan2(d.x, d.z);
    this.faixa = faixa;
    this.grupo.add(faixa);
    jogo.cena.add(this.grupo);
  }
  disparar() {
    this.fase = 'raizes'; this.t = 0;
    this.faixa.visible = false;
    this.espinhos = [];
    for (let k = 0; k < this.comp / 0.6; k++) {
      const x = this.ini.x + this.dir.x * k * 0.6 + (Math.random() - 0.5) * 0.3, z = this.ini.z + this.dir.z * k * 0.6 + (Math.random() - 0.5) * 0.3;
      if (this.jogo.mapa.tipo(Math.floor(x), Math.floor(z)).solido) break;
      const m = new THREE.Mesh(geoEspinho, matEspinho);
      m.position.set(x, this.jogo.mapa.alturaEm(x, z) - 1.3, z);
      m.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
      m.userData.base = m.position.y; m.userData.atraso = k * 0.02;
      this.grupo.add(m); this.espinhos.push(m);
    }
    // quem está na linha agora leva o golpe
    const j = this.jogo.jogador;
    const rx = j.pos.x - this.ini.x, rz = j.pos.z - this.ini.z;
    const ao = rx * this.dir.x + rz * this.dir.z, lat = Math.abs(rx * this.dir.z - rz * this.dir.x);
    const chao = this.jogo.mapa.alturaEm(j.pos.x, j.pos.z);
    if (ao > -0.3 && ao < this.comp && lat < this.largura + j.raio && j.pos.y < chao + 1.4) j.receberDano(1, this.autor, { empurra: 7 });
  }
  atualizar(dt) {
    this.t += dt;
    if (this.fase === 'aviso') this.faixa.material.opacity = 0.25 + 0.25 * (Math.sin(this.t * 25) > 0 ? 1 : 0);
    else {
      for (const m of this.espinhos) {
        const k = Math.max(0, this.t - m.userData.atraso);
        const sobe = k < 0.12 ? k / 0.12 : k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
        m.position.y = m.userData.base + sobe * 1.3;
      }
      if (this.t > 1.2) this.limpar();
    }
  }
  limpar() {
    if (this.fim) return;
    this.fim = true;
    this.jogo.cena.remove(this.grupo);
    this.faixa.geometry.dispose(); this.faixa.material.dispose();
  }
}

// nuvem de esporos: deriva devagar; dentro dela, 1 de dano a cada 1,5 s
let texEsporo = null;
function texturaEsporo() {
  if (texEsporo) return texEsporo;
  const c = document.createElement('canvas'); c.width = c.height = 24;
  const g = c.getContext('2d');
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const d = Math.hypot(x - 11.5, y - 11.5) / 12;
    if (d < 1 && ((x * 7 + y * 13) % 5) / 5 < (1 - d) * 1.2) { g.fillStyle = d < 0.5 ? '#c8f080' : '#7cc048'; g.fillRect(x, y, 1, 1); }
  }
  texEsporo = new THREE.CanvasTexture(c);
  texEsporo.magFilter = texEsporo.minFilter = THREE.NearestFilter;
  texEsporo.colorSpace = THREE.SRGBColorSpace;
  return texEsporo;
}
export class NuvemEsporos extends Entidade {
  constructor(jogo, x, z, dir, autor) {
    super(jogo, x, z, { raio: 1.1 });
    this.sombra.visible = false;
    this.autor = autor;
    this.vel.copy(dir).multiplyScalar(1.7);
    this.tempo = 6;
    this.tique = 0.4;
    this.bolhas = [];
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaEsporo(), transparent: true, opacity: 0.7, depthWrite: false }));
      s.position.set((Math.random() - 0.5) * 1.4, 0.4 + Math.random() * 1.1, (Math.random() - 0.5) * 1.4);
      s.scale.setScalar(0.7 + Math.random() * 0.6);
      s.userData.fase = Math.random() * 6;
      this.objeto.add(s); this.bolhas.push(s);
    }
  }
  atualizar(dt) {
    this.tempo -= dt;
    if (this.tempo <= 0) { this.removido = true; return; }
    const m = this.jogo.mapa;
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (!m.tipo(Math.floor(nx), Math.floor(nz)).solido) { this.pos.x = nx; this.pos.z = nz; }
    this.vel.multiplyScalar(Math.exp(-dt * 0.35));
    this.pos.y = m.vazioEm(this.pos.x, this.pos.z) ? this.pos.y : m.alturaEm(this.pos.x, this.pos.z);
    const j = this.jogo.jogador;
    this.tique -= dt;
    if (j && this.tique <= 0 && distXZ(j.pos, this.pos) < this.raio && j.pos.y < this.pos.y + 2) {
      this.tique = 1.5;
      j.receberDano(1, this, {});
    }
    const f = Math.min(1, this.tempo);
    for (const s of this.bolhas) {
      s.userData.fase += dt;
      s.position.y += Math.sin(s.userData.fase * 2) * dt * 0.2;
      s.material.opacity = 0.65 * f;
    }
    this.sincronizar(dt);
  }
}
