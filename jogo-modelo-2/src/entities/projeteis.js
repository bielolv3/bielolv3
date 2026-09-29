import * as THREE from 'three';
import { Entidade } from './entidade.js';
import { GRAVIDADE } from '../world/fisica.js';
import { fixo } from '../core/liberar.js';

// Projéteis, efeitos passageiros e o controle de corpos agarrados/arremessados.

const geoBola = fixo(new THREE.SphereGeometry(1, 10, 8));

// Tiro reto (raio Quanta, bala de sentinela). Some ao bater no cenário.
export class Projetil extends Entidade {
  constructor(jogo, x, y, z, dir, { autor = null, alvo = 'jogador', dano = 1, velocidade = 8, cor = 0x7ff3ff, tamanho = 0.12, vidaUtil = 3, empurra = 3 } = {}) {
    super(jogo, x, z, { raio: tamanho });
    this.pos.y = y;
    this.vel.copy(dir).setY(0).normalize().multiplyScalar(velocidade);
    Object.assign(this, { autor, alvo, dano, vidaUtil, empurra });
    this.sombra.visible = false;
    this.montarVisual(cor, tamanho);
  }

  montarVisual(cor, tamanho) {
    const m = new THREE.Mesh(geoBola, new THREE.MeshBasicMaterial({ color: cor }));
    m.scale.setScalar(tamanho);
    this.objeto.add(m);
    this.malha = m;
  }

  atualizar(dt) {
    this.vidaUtil -= dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.vidaUtil <= 0 || this.jogo.mapa.alturaEm(this.pos.x, this.pos.z) > this.pos.y) this.removido = true;
    for (const e of this.jogo.entidades) {
      if (e.time !== this.alvo || e.removido) continue;
      if (this.distancia(e) < e.raio + this.raio + 0.1 && this.pos.y > e.pos.y - 0.2 && this.pos.y < e.pos.y + 1.6) {
        e.receberDano(this.dano, this, { empurra: this.empurra });
        this.removido = true;
        break;
      }
    }
    this.malha.scale.setScalar(this.raio * (1 + Math.sin(this.vidaUtil * 40) * 0.2));
    this.sincronizar(dt);
  }
}

// Banana do Chico: voa em arco; acerta inimigo (derrapa) ou vira casca no chão.
export class Banana extends Entidade {
  constructor(jogo, x, y, z, dir, autor) {
    super(jogo, x, z, { raio: 0.15 });
    this.pos.y = y;
    this.autor = autor;
    this.vel.set(dir.x * 9, 4, dir.z * 9);
    this.montarVisual();
  }

  montarVisual() {
    this.malha = malhaBanana();
    this.objeto.add(this.malha);
  }

  atualizar(dt) {
    this.vel.y -= GRAVIDADE * 0.6 * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.malha.rotation.z += dt * 18;
    for (const e of this.jogo.entidades) {
      if (e.time !== 'inimigo' || e.removido) continue;
      if (this.distancia(e) < e.raio + 0.35 && this.pos.y > e.pos.y - 0.3 && this.pos.y < e.pos.y + (e.altura ?? 1.4)) {
        e.derrapar?.(this.vel, 1);
        this.removido = true;
        return;
      }
    }
    const chao = this.jogo.mapa.alturaEm(this.pos.x, this.pos.z);
    if (this.pos.y <= chao) {
      this.removido = true;
      // bateu em parede (chão muito acima) ou caiu no abismo: some; senão vira casca
      if (!this.jogo.mapa.vazioEm(this.pos.x, this.pos.z) && chao < this.pos.y + 0.6) {
        this.jogo.adicionar(new Casca(this.jogo, this.pos.x, this.pos.z));
      }
    }
    this.sincronizar(dt);
  }
}

function malhaBanana() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xf2cf3a, emissive: 0x3a2a00 });
  for (let k = -1; k <= 1; k++) {
    const s = new THREE.Mesh(geoBola, mat);
    s.scale.set(0.09, 0.09, 0.09);
    s.position.set(k * 0.1, -Math.abs(k) * 0.05, 0);
    g.add(s);
  }
  g.position.y = 0.1;
  return g;
}

// Casca no chão: armadilha. Inimigo que pisa escorrega.
export class Casca extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.3 });
    this.sombra.visible = false;
    this.tempo = 20;
    this.montarVisual();
  }

  montarVisual() {
    const m = malhaBanana();
    m.scale.set(1.3, 0.5, 1.3);
    m.position.y = 0.04;
    m.children.forEach((c) => { c.material = c.material.clone(); c.material.color.set(0xb89a2a); });
    this.objeto.add(m);
  }

  atualizar(dt) {
    this.tempo -= dt;
    if (this.tempo <= 0) this.removido = true;
    for (const e of this.jogo.entidades) {
      if (e.time !== 'inimigo' || e.removido || e.voa || !e.noChao) continue;
      if (this.distancia(e) < e.raio + this.raio) {
        const dir = e.vel.lengthSq() > 0.1 ? e.vel : new THREE.Vector3().subVectors(e.pos, this.pos);
        e.derrapar?.(dir, 1.2);
        this.jogo.eventos.emitir('identidade', { macaco: 'chico', tipo: 'casca' });
        this.removido = true;
        break;
      }
    }
    this.sincronizar(dt);
  }
}

// Anel que se expande no chão. Se `dano`, fere o time `alvo` quando a frente
// da onda passa por ele e ele está no chão (pular esquiva).
export class Onda extends Entidade {
  constructor(jogo, x, z, { raioMax = 3, duracao = 0.4, cor = 0xffe2a8, dano = 0, alvo = 'jogador', autor = null, y = null } = {}) {
    super(jogo, x, z, { raio: 0.1 });
    if (y !== null) this.pos.y = y;
    this.sombra.visible = false;
    Object.assign(this, { raioMax, duracao, dano, alvo, autor, t: 0, atingidos: new Set() });
    this.montarVisual(cor);
  }

  montarVisual(cor) {
    this.anel = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.anel.position.y = 0.05;
    this.objeto.add(this.anel);
  }

  atualizar(dt) {
    this.t += dt;
    const f = Math.min(1, this.t / this.duracao);
    const r = Math.max(0.05, this.raioMax * f);
    this.anel.scale.setScalar(r);
    this.anel.material.opacity = 0.9 * (1 - f * f);
    if (this.dano) {
      for (const e of this.jogo.entidades) {
        if (e.time !== this.alvo || e.removido || this.atingidos.has(e)) continue;
        const d = this.distancia(e);
        const noChao = e.pos.y < this.jogo.mapa.alturaEm(e.pos.x, e.pos.z) + 0.35;
        if (d <= r && d > r - 0.9 && noChao) {
          this.atingidos.add(e);
          e.receberDano(this.dano, this.autor ?? this, { empurra: 6 });
        }
      }
    }
    if (f >= 1) this.removido = true;
    this.sincronizar(dt);
  }
}

// Braço do Orlando (traço rápido entre dois pontos).
export class Braco extends Entidade {
  constructor(jogo, de, ate) {
    super(jogo, de.x, de.z, { raio: 0.1 });
    this.sombra.visible = false;
    this.pos.y = de.y;
    this.t = 0.18;
    this.montarVisual(de, ate);
  }

  montarVisual(de, ate) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3().subVectors(ate, de)]);
    this.objeto.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc87a3a })));
  }

  atualizar(dt) {
    this.t -= dt;
    if (this.t <= 0) this.removido = true;
    this.sincronizar(dt);
  }
}

// Corpo agarrado pelo Orlando (`preso`) ou arremessado (`arremessado`).
// Inimigos e caixas chamam no começo do atualizar; true = já tratado neste quadro.
export function controleExterno(e, dt) {
  if (e.preso) {
    e.vel.set(0, 0, 0);
    e.sincronizar(dt);
    return true;
  }
  const a = e.arremessado;
  if (!a) return false;
  a.t += dt;
  e.fisica(dt);
  const { jogo } = e;
  // bate em outro inimigo (ou caixa): dano nos dois
  for (const o of jogo.entidades) {
    if (o === e || o.removido || !(o.time === 'inimigo' || o.ehCaixa)) continue;
    if (e.distancia(o) < e.raio + o.raio + 0.15 && Math.abs(o.pos.y - e.pos.y) < 1.2) {
      o.receberDano(2, a.autor, { empurra: 6, atordoa: 0.8 });
      e.receberDano(2, a.autor, { atordoa: 0.8 });
      e.vel.x *= -0.3; e.vel.z *= -0.3;
      e.arremessado = null;
      e.aoPousar?.(true);
      if (!e.removido) e.sincronizar(dt);
      return true;
    }
  }
  const parado = Math.hypot(e.vel.x, e.vel.z) < 0.5;
  if (e.caiu) { e.morrer(); return true; }
  if (a.t > 0.15 && (e.noChao || parado)) {
    e.arremessado = null;
    e.aoPousar?.(parado && !e.noChao);
  }
  e.sincronizar(dt);
  return true;
}
