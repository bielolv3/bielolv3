import * as THREE from 'three';
import { Entidade } from './entidade.js';
import { controleExterno } from './projeteis.js';

const TEAL = 0x4fa6ab;

// tile (i, j) de uma posição de mundo
const tileDe = (x, z) => ({ i: Math.floor(x), j: Math.floor(z) });

// Saída da sala: quando o jogador pisa, o jogo carrega a próxima.
export class Saida extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.5 });
    this.sombra.visible = false;
    this.montarVisual();
  }
  montarVisual() {
    const anel = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.45, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xd09a2c, transparent: true, opacity: 0.8 }),
    );
    anel.position.y = 0.02;
    this.objeto.add(anel);
    this.anel = anel;
  }
  atualizar(dt) {
    this.anel.rotation.y += dt;
    if (this.distancia(this.jogo.jogador) < 0.6) this.jogo.proximaSala();
    this.sincronizar(dt);
  }
}

// Base de itens que flutuam e são pegos ao encostar.
class Coletavel extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.4 });
    this.t = Math.random() * 6;
    this.visual = new THREE.Group();
    this.objeto.add(this.visual);
    this.montarVisual();
  }
  // true = foi pego
  aoPegar() { return true; }
  atualizar(dt) {
    this.t += dt;
    this.visual.position.y = 0.5 + Math.sin(this.t * 3) * 0.1;
    this.visual.rotation.y += dt * 1.5;
    const j = this.jogo.jogador;
    if (this.visual.visible && this.distancia(j) < 0.7 && Math.abs(j.pos.y - this.pos.y) < 1.2 && this.aoPegar(j)) this.pego();
    this.sincronizar(dt);
  }
  pego() { this.removido = true; }
}

// Cacho de bananas: enche as cargas do Chico. Volta depois de um tempo.
export class Cacho extends Coletavel {
  montarVisual() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xf2cf3a, emissive: 0x2a1f00 });
    const geo = new THREE.CapsuleGeometry(0.06, 0.22, 3, 6);
    for (let k = 0; k < 5; k++) {
      const b = new THREE.Mesh(geo, mat);
      const a = k / 5 * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
      b.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5 + 0.3);
      this.visual.add(b);
    }
  }
  aoPegar(j) {
    const r = j.recursos;
    if (!r || r.bananas >= r.bananasMax) return false;
    r.bananas = r.bananasMax;
    this.jogo.eventos.emitir('coleta', { tipo: 'banana' });
    return true;
  }
  pego() { this.visual.visible = false; this.sombra.visible = false; this.volta = 15; }
  atualizar(dt) {
    if (this.volta > 0 && (this.volta -= dt) <= 0) { this.visual.visible = true; this.sombra.visible = true; }
    super.atualizar(dt);
  }
}

// Fragmento de memória: carrega o Surto.
export class Memoria extends Coletavel {
  montarVisual() {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    m.scale.y = 1.5;
    this.visual.add(m);
  }
  aoPegar(j) {
    j.surto.carga = Math.min(1, j.surto.carga + 0.35);
    this.jogo.eventos.emitir('coleta', { tipo: 'memoria' });
    return true;
  }
}

// Selo Quanta: pilar que bloqueia o tile. Só o Pulverizar do Hugo quebra;
// o Drone Construtor reergue.
export class Selo extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.5 });
    Object.assign(this, tileDe(x, z));
    this.ehSelo = true;
    this.quebrado = false;
    this.pos.y = jogo.mapa.tipo(this.i, this.j).altura;
    this.montarVisual();
    // +3 como a porta: com +2 o pulo duplo do Chico (+2,07) mais o degrau passava por cima
    jogo.mapa.bloquear(this.i, this.j, 3);
  }
  montarVisual() {
    this.mat = new THREE.MeshLambertMaterial({ color: TEAL, emissive: 0x1a5559 });
    this.pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 2, 6), this.mat);
    this.pilar.position.y = 1;
    this.pilar.castShadow = true;
    this.entulho = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.25, 6), new THREE.MeshLambertMaterial({ color: 0x3b5b5c }));
    this.entulho.position.y = 0.12;
    this.entulho.visible = false;
    this.objeto.add(this.pilar, this.entulho);
  }
  quebrar() {
    if (this.quebrado) return;
    this.quebrado = true;
    this.pilar.visible = false; this.entulho.visible = true;
    this.jogo.mapa.desbloquear(this.i, this.j);
    this.jogo.eventos.emitir('selo', { quebrado: true, selo: this });
  }
  // false se algo está em cima do tile
  reerguer() {
    // qualquer corpo encostando no tile (não só com o centro nele) impede
    const ocupado = this.jogo.entidades.some((e) => e.time !== 'neutro' && !e.voa && !e.removido
      && Math.abs(e.pos.x - (this.i + .5)) < 0.5 + e.raio && Math.abs(e.pos.z - (this.j + .5)) < 0.5 + e.raio);
    if (!this.quebrado || ocupado) return false;
    this.quebrado = false;
    this.pilar.visible = true; this.entulho.visible = false;
    this.jogo.mapa.bloquear(this.i, this.j, 3);
    this.jogo.eventos.emitir('selo', { quebrado: false, selo: this });
    return true;
  }
  atualizar(dt) {
    this.mat.emissive.setHex(0x1a5559).multiplyScalar(0.8 + Math.sin(performance.now() / 300) * 0.2);
    this.sincronizar(dt);
    this.sombra.visible = false;
  }
}

// Porta: bloqueia o tile até uma alavanca da sala ser acionada.
export class Porta extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.5 });
    Object.assign(this, tileDe(x, z));
    this.ehPorta = true;
    this.aberta = false;
    this.base = jogo.mapa.tipo(this.i, this.j).altura;
    this.pos.y = this.base;
    this.montarVisual();
    jogo.mapa.bloquear(this.i, this.j, 3);
  }
  montarVisual() {
    this.folha = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.6, 0.96), new THREE.MeshLambertMaterial({ color: 0x7a5a2e, emissive: 0x1a1006 }));
    this.folha.position.y = 1.3;
    this.folha.castShadow = true;
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), new THREE.MeshBasicMaterial({ color: TEAL }));
    faixa.position.y = 0.5;
    this.folha.add(faixa);
    this.objeto.add(this.folha);
  }
  abrir() {
    if (this.aberta) return;
    this.aberta = true;
    this.jogo.mapa.desbloquear(this.i, this.j);
    this.jogo.eventos.emitir('porta', { aberta: true, porta: this });
  }
  atualizar(dt) {
    // afunda no chão ao abrir
    if (this.aberta && this.folha.position.y > -1.4) this.folha.position.y -= dt * 3;
    this.sincronizar(dt);
    this.sombra.visible = false;
  }
}

// Alavanca: Orlando aciona (Ferramenta de perto ou Agarrão de longe); abre as portas da sala.
export class Alavanca extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.35 });
    this.acionavel = true;
    this.ligada = false;
    this.montarVisual();
  }
  montarVisual() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x4a4234 }));
    base.position.y = 0.1;
    this.haste = new THREE.Group();
    this.haste.position.y = 0.2;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
    h.position.y = 0.3;
    this.pomo = new THREE.Mesh(new THREE.SphereGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xc0392b }));
    this.pomo.position.y = 0.6;
    this.haste.add(h, this.pomo);
    this.haste.rotation.z = 0.6;
    this.objeto.add(base, this.haste);
  }
  acionar() {
    if (this.ligada) return false;
    this.ligada = true;
    this.pomo.material.color.setHex(TEAL);
    for (const e of this.jogo.entidades) if (e.ehPorta) e.abrir();
    return true;
  }
  atualizar(dt) {
    const alvo = this.ligada ? -0.6 : 0.6;
    this.haste.rotation.z += (alvo - this.haste.rotation.z) * Math.min(1, dt * 10);
    this.sincronizar(dt);
  }
}

// Caixa: ocupa um tile (dá para subir). Hugo empurra, Orlando agarra e arremessa,
// Pulverizar e Bruto quebram.
export class Caixa extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.45, vida: 2 });
    this.ehCaixa = true;
    this.agarravel = true;
    this.empurrando = 0;
    this.ocupar(Math.floor(x), Math.floor(z));
    this.montarVisual();
  }
  montarVisual() {
    this.caixa = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.94, 0.94), new THREE.MeshLambertMaterial({ color: 0x8a6a3a }));
    this.caixa.position.y = 0.47;
    this.caixa.castShadow = true;
    const aresta = new THREE.LineSegments(new THREE.EdgesGeometry(this.caixa.geometry), new THREE.LineBasicMaterial({ color: 0x3d2c14 }));
    this.caixa.add(aresta);
    this.objeto.add(this.caixa);
  }
  ocupar(i, j) {
    this.i = i; this.j = j;
    this.pos.set(i + .5, this.jogo.mapa.tipo(i, j).altura, j + .5);
    this.jogo.mapa.bloquear(i, j, 1);
  }
  soltarTile() { if (this.i !== null) this.jogo.mapa.desbloquear(this.i, this.j); this.i = this.j = null; }

  // tile livre para receber a caixa (sem bloqueio, sem abismo, sem degrau acima de `ate`)
  tileLivre(i, j, ate) {
    const m = this.jogo.mapa;
    return !m.bloqueios.has(`${i},${j}`) && !m.tipo(i, j).vazio && !m.tipo(i, j).solido && m.tipo(i, j).altura <= ate + 0.01;
  }

  // Orlando: agarrar tira do tile
  aoAgarrar() { this.soltarTile(); }

  // arremesso terminou: encaixa no tile se couber, senão quebra
  aoPousar(bateu) {
    const i = Math.floor(this.pos.x), j = Math.floor(this.pos.z);
    if (bateu || !this.tileLivre(i, j, this.pos.y + 0.6)) this.quebrar();
    else { this.ocupar(i, j); this.vel.set(0, 0, 0); }
  }

  receberDano(qtd) { if (qtd >= 1.5) this.quebrar(); return true; }
  morrer() { this.quebrar(); }
  quebrar() {
    if (this.removido) return;
    this.soltarTile();
    this.removido = true;
    this.jogo.eventos.emitir('quebra', { alvo: this });
  }

  atualizar(dt) {
    if (controleExterno(this, dt)) return;
    // deslizando para o próximo tile
    if (this.deslize) {
      const d = this.deslize;
      d.t = Math.min(1, d.t + dt * 5);
      this.objeto.position.lerpVectors(d.de, this.pos, d.t);
      if (d.t >= 1) this.deslize = null;
      this.sombra.position.y = 0.01;
      return;
    }
    this.checarEmpurrao(dt);
    this.sincronizar(dt);
  }

  // Hugo encostado numa face e empurrando para dentro dela
  checarEmpurrao(dt) {
    const j = this.jogo.jogador;
    const dir = this.jogo.camera.eixoParaMundo(this.jogo.input.eixo);
    const dx = j.pos.x - this.pos.x, dz = j.pos.z - this.pos.z;
    let passo = null;
    if (j.atual === 'hugo' && j.noChao && j.pos.y < this.pos.y + 0.5) {
      if (Math.abs(dx) > Math.abs(dz) && Math.abs(dx) < 0.9 && Math.abs(dz) < 0.4 && dir.x * -Math.sign(dx) > 0.6) passo = [-Math.sign(dx), 0];
      if (Math.abs(dz) > Math.abs(dx) && Math.abs(dz) < 0.9 && Math.abs(dx) < 0.4 && dir.z * -Math.sign(dz) > 0.6) passo = [0, -Math.sign(dz)];
    }
    this.empurrando = passo ? this.empurrando + dt : 0;
    if (this.empurrando < 0.25) return;
    this.empurrando = 0;
    const ni = this.i + passo[0], nj = this.j + passo[1];
    const m = this.jogo.mapa;
    const de = this.pos.clone();
    if (m.tipo(ni, nj).vazio && !m.bloqueios.has(`${ni},${nj}`)) {
      // empurrada no abismo
      this.soltarTile(); this.removido = true;
      this.jogo.eventos.emitir('quebra', { alvo: this });
      return;
    }
    if (!this.tileLivre(ni, nj, m.tipo(this.i, this.j).altura)) return;
    this.soltarTile();
    this.ocupar(ni, nj);
    this.deslize = { de, t: 0 };
    this.jogo.eventos.emitir('empurrao', { alvo: this });
  }
}
