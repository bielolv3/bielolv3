import * as THREE from 'three';
import { Entidade } from './entidade.js';
import { Onda, Projetil } from './projeteis.js';
import { GRAVIDADE } from '../world/fisica.js';

// Relíquias (Códice, Livro VIII): "Relíquia não é objeto encantado. É memória tão densa
// que virou coisa." Cada uma é um fragmento arrancado de um Colosso, e LÊ QUEM A SEGURA:
// o efeito depende do macaco ativo na hora do uso.
//
//   Mapa: letra 'Y' na camada `coisas` (pedestal). Qual relíquia: campo da sala
//   `reliquia: 'disco'` (ou uma lista `['semente', 'perola']`, na ordem de leitura dos 'Y').
//   Progresso: jogo.progresso.reliquias (ids pegos) e jogo.progresso.reliquiaAtiva.
//   Teclas: R alterna a ativa ('reliquia'), U usa ('usarReliquia').
//   Eventos: 'reliquia' {id, nome, origem} ao pegar; 'reliquiaTroca' {id};
//            'reliquiaUsada' {id, macaco, efeito}; 'reliquiaFalha' {id, motivo}.

export const RELIQUIAS = {
  sismico: {
    nome: 'Coração Sísmico', origem: 'do Errante · veio Pedra', cor: 0xe0782a, recarga: 6,
    efeitos: { hugo: 'Onda sísmica', chico: 'Pulo sísmico triplo', orlando: 'Petrificar' },
  },
  disco: {
    nome: 'Disco Solar', origem: 'do Mênisco · Hora e Luz', cor: 0xffc94a, recarga: 4,
    efeitos: { hugo: 'Escudo solar', chico: 'Disco ricocheteante', orlando: 'Raio de luz' },
  },
  semente: {
    nome: 'Semente Primordial', origem: 'da Matriarca · veio Seiva', cor: 0x8fdc5a, recarga: 7,
    efeitos: { hugo: 'Raízes', chico: 'Broto', orlando: 'Bosque' },
  },
  perola: {
    nome: 'Pérola Abissal', origem: 'do Colosso das Águas · veio Maré', cor: 0x4fb0d8, recarga: 6,
    efeitos: { hugo: 'Vagalhão', chico: 'Correnteza', orlando: 'Bolha' },
  },
};
export const ORDEM_RELIQUIAS = Object.keys(RELIQUIAS);

// ------------------------------------------------------------------ modelos
// Nada de espada bonita: blocos lascados, entalhes gastos, veio que ainda brilha.

function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// desloca vértices (mesma posição = mesmo deslocamento: não rasga as faces)
function lascar(geo, amp, semente = 1) {
  const rnd = aleatorio(semente), mapa = new Map(), p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const chave = `${p.getX(k).toFixed(3)},${p.getY(k).toFixed(3)},${p.getZ(k).toFixed(3)}`;
    if (!mapa.has(chave)) mapa.set(chave, [(rnd() - .5) * amp, (rnd() - .5) * amp, (rnd() - .5) * amp]);
    const d = mapa.get(chave);
    p.setXYZ(k, p.getX(k) + d[0], p.getY(k) + d[1], p.getZ(k) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

const pedra = (cor) => new THREE.MeshLambertMaterial({ color: cor, flatShading: true });
const brilho = (cor) => new THREE.MeshBasicMaterial({ color: cor });
function malha(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ~0,5 de tamanho; centrado na origem
export function modeloReliquia(id) {
  const g = new THREE.Group();
  if (id === 'sismico') {
    // pedaço do peito do Errante: blocos entalhados em anel, núcleo laranja no meio
    const anel = new THREE.TorusGeometry(0.2, 0.08, 4, 9, Math.PI * 1.55);
    lascar(anel, 0.05, 3);
    const a = malha(anel, pedra(0x6d6258));
    a.rotation.z = 0.9;
    g.add(a);
    for (let k = 0; k < 5; k++) {   // blocos da alvenaria colossal
      const ang = k / 5 * Math.PI * 1.5 + 0.9;
      const b = malha(lascar(new THREE.BoxGeometry(0.11, 0.1, 0.16), 0.03, 10 + k), pedra(k % 2 ? 0x7a6e60 : 0x5a5248),
        Math.cos(ang) * 0.27, Math.sin(ang) * 0.27, 0);
      b.rotation.z = ang;
      g.add(b);
    }
    g.add(malha(new THREE.IcosahedronGeometry(0.1, 0), brilho(0xffb347)));
    const casca = malha(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0xc04a2c, transparent: true, opacity: 0.45, depthWrite: false }));
    g.add(casca);
    // veios rachados saindo do núcleo
    for (const [x, y, r] of [[0.14, 0.05, 0.3], [-0.1, -0.12, 2.1], [0.02, 0.16, 1.4]]) {
      const v = malha(new THREE.BoxGeometry(0.16, 0.018, 0.03), brilho(0xe0782a), x, y, 0.07);
      v.rotation.z = r;
      g.add(v);
    }
  } else if (id === 'disco') {
    // disco do Mênisco, quebrado: falta uma cunha; aro de latão, sulcos das horas
    const disco = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 14, 1, false, 0.3, Math.PI * 1.6);
    lascar(disco, 0.025, 7);
    const d = malha(disco, pedra(0x9a8a6a));
    d.rotation.x = Math.PI / 2;
    g.add(d);
    const aro = malha(new THREE.TorusGeometry(0.3, 0.03, 4, 16, Math.PI * 1.6), new THREE.MeshLambertMaterial({ color: 0xd09a2c, emissive: 0x4a3000, flatShading: true }));
    aro.rotation.z = 0.3 - Math.PI / 2;   // acompanha a parte inteira do disco
    g.add(aro);
    for (let k = 0; k < 7; k++) {   // sulcos radiais
      const ang = 0.3 - Math.PI / 2 + (k + 0.5) / 7 * Math.PI * 1.6;
      const s = malha(new THREE.BoxGeometry(0.13, 0.02, 0.09), pedra(0x5a4c34), Math.cos(ang) * 0.17, Math.sin(ang) * 0.17, 0);
      s.rotation.z = ang;
      g.add(s);
    }
    const centro = malha(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), brilho(0xffe07a));
    centro.rotation.x = Math.PI / 2;
    g.add(centro);
  } else if (id === 'semente') {
    // semente da Matriarca presa num pedaço de palma de pedra, com broto
    const palma = malha(lascar(new THREE.BoxGeometry(0.36, 0.1, 0.28, 2, 1, 2), 0.05, 5), pedra(0x6d6258), 0, -0.16, 0);
    g.add(palma);
    for (let k = 0; k < 3; k++) {   // dedos enormes, quebrados
      const dedo = malha(lascar(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 5), 0.02, 20 + k), pedra(0x7a6e60),
        -0.12 + k * 0.12, -0.02, -0.14);
      dedo.rotation.x = -0.5;
      g.add(dedo);
    }
    const semente = malha(lascar(new THREE.SphereGeometry(0.13, 7, 5), 0.03, 9), new THREE.MeshLambertMaterial({ color: 0x4d5a2e, emissive: 0x1a2a08, flatShading: true }), 0, 0.02, 0.02);
    semente.scale.set(0.9, 1.35, 0.9);
    g.add(semente);
    for (const [x, y, r] of [[0.06, 0.02, 0.3], [-0.05, -0.02, -0.4]]) {
      const v = malha(new THREE.BoxGeometry(0.018, 0.14, 0.02), brilho(0x8fdc5a), x, y, 0.13);
      v.rotation.z = r;
      g.add(v);
    }
    for (const r of [-0.6, 0.5]) {
      const f = malha(new THREE.ConeGeometry(0.04, 0.16, 4), brilho(0xb6ec7a), r * 0.08, 0.26, 0);
      f.rotation.z = r;
      g.add(f);
    }
  } else if (id === 'perola') {
    // olho do Colosso das Águas: pérola azul numa órbita de pedra com cracas
    const orbita = malha(lascar(new THREE.TorusGeometry(0.17, 0.08, 5, 10, Math.PI * 1.7), 0.04, 13), pedra(0x4d5a66));
    orbita.rotation.z = -0.4;
    g.add(orbita);
    const base = malha(lascar(new THREE.DodecahedronGeometry(0.16, 0), 0.05, 4), pedra(0x3a4450), 0.04, -0.16, -0.08);
    base.scale.set(1.4, 0.6, 1);
    g.add(base);
    g.add(malha(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x2a6a8a })));
    g.add(malha(new THREE.SphereGeometry(0.045, 8, 6), brilho(0xffffff), 0.03, 0.04, 0.1));
    const rnd = aleatorio(31);
    for (let k = 0; k < 6; k++) {
      const ang = rnd() * Math.PI * 2;
      g.add(malha(new THREE.SphereGeometry(0.025 + rnd() * 0.02, 5, 4), pedra(0xa8b4bc), Math.cos(ang) * 0.22, Math.sin(ang) * 0.22, 0.05));
    }
  }
  return g;
}

// halo aditivo (textura em cache; o liberar não mexe em texturas)
const texHalo = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();
function halo(cor, tam = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo(), color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  s.scale.setScalar(tam);
  return s;
}

// ------------------------------------------------------------------ pedestal (letra 'Y')
export class Reliquia extends Entidade {
  constructor(jogo, x, z, c = {}) {
    super(jogo, x, z, { raio: 0.45 });
    const sala = jogo.mapa.sala ?? {};
    const lista = [].concat(sala.reliquia ?? []);
    const meus = jogo.mapa.coisas.filter((k) => k.letra === c.letra);
    const n = Math.max(0, meus.findIndex((k) => k.i === c.i && k.j === c.j));
    this.id = lista[n] ?? lista[0];
    if (!RELIQUIAS[this.id]) {
      console.warn(`relíquia sem id válido na sala ${sala.id} (use o campo reliquia: '${ORDEM_RELIQUIAS.join("' | '")}')`);
      this.id = ORDEM_RELIQUIAS[0];
    }
    this.info = RELIQUIAS[this.id];
    this.ehReliquia = true;
    this.t = Math.random() * 6;
    this.jaPega = !!jogo.progresso?.reliquias?.includes(this.id);
    this.pego = false;
    this.montarVisual();
  }

  montarVisual() {
    const cor = this.info.cor;
    // toco de coluna colossal, lascado
    const toco = new THREE.Mesh(lascar(new THREE.CylinderGeometry(0.4, 0.48, 0.4, 7, 1), 0.06, 42), pedra(0x5a5248));
    toco.position.y = 0.2;
    toco.castShadow = toco.receiveShadow = true;
    const topo = new THREE.Mesh(lascar(new THREE.CylinderGeometry(0.33, 0.38, 0.1, 7), 0.04, 43), pedra(0x7a6e60));
    topo.position.y = 0.44;
    this.runa = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 7).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.8, depthWrite: false }));
    this.runa.position.y = 0.41;
    this.feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.feixe.position.y = 1.5;
    this.objeto.add(toco, topo, this.runa, this.feixe);

    this.visual = new THREE.Group();
    this.visual.position.y = 1.05;
    this.modelo = modeloReliquia(this.id);
    this.modelo.scale.setScalar(1.8);
    this.halo = halo(cor, 1.4);
    this.visual.add(this.modelo, this.halo);
    this.objeto.add(this.visual);
    if (this.jaPega) this.apagar();
  }

  // pedestal vazio (já pega)
  apagar() {
    this.visual.visible = false;
    this.feixe.visible = false;
    this.runa.material.opacity = 0.2;
  }

  atualizar(dt) {
    this.t += dt;
    const j = this.jogo.jogador;
    if (!this.jaPega && !this.pego) {
      this.visual.position.y = 1.05 + Math.sin(this.t * 2) * 0.08;
      // encara a câmera balançando (disco e anel não ficam de perfil)
      const a = this.jogo.camera.anguloAtual ?? Math.PI / 4;
      this.modelo.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)) + Math.sin(this.t * 1.3) * 0.7;
      this.halo.material.opacity = 0.55 + Math.sin(this.t * 3) * 0.15;
      this.feixe.material.opacity = 0.13 + Math.sin(this.t * 2.3) * 0.04;
      this.runa.rotation.y -= dt * 0.4;
      if (j && this.distancia(j) < 0.85 && Math.abs(j.pos.y - this.pos.y) < 1.4) this.pegar(j);
    } else if (this.pego) this.cerimonia(dt, j);
    this.sincronizar(dt);
    this.sombra.visible = false;
  }

  pegar(j) {
    this.pego = true;
    this.tc = 0;
    this.jogo.reliquias?.ganhar(this.id, j);
    this.jogo.adicionar(new Onda(this.jogo, this.pos.x, this.pos.z, { raioMax: 3.2, duracao: 0.7, cor: this.info.cor, y: this.pos.y + 0.45 }));
  }

  // a relíquia sobe sobre o macaco, gira, pulsa e entra nele
  cerimonia(dt, j) {
    this.tc += dt;
    const k = this.tc;
    const alvo = j.pos.clone().sub(this.pos);
    const sobe = Math.min(1, k / 0.5);
    this.visual.position.set(alvo.x * sobe, 1.05 + (alvo.y + 2.3 - 1.05) * sobe, alvo.z * sobe);
    this.modelo.rotation.y += dt * (4 + k * 10);
    this.halo.material.opacity = 0.8;
    this.halo.scale.setScalar(1.4 + Math.sin(k * 12) * 0.3 + k * 1.2);
    this.feixe.material.opacity = Math.max(0, 0.3 - k * 0.2);
    if (k > 1.1) {   // mergulha no macaco
      const f = Math.min(1, (k - 1.1) / 0.3);
      this.visual.position.y -= f * 1.6;
      this.visual.scale.setScalar(1 - f);
    }
    if (k > 1.4) { this.pego = false; this.jaPega = true; this.visual.scale.setScalar(1); this.apagar(); }
  }
}

// ------------------------------------------------------------------ efeitos passageiros

// lascas de pedra voando (impactos)
class Estilhacos extends Entidade {
  constructor(jogo, x, y, z, { n = 12, cor = 0x7a6e60, forca = 5, brilhoCor = null } = {}) {
    super(jogo, x, z, { raio: 0.1 });
    this.pos.y = y;
    this.sombra.visible = false;
    this.t = 0;
    this.pecas = [];
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = pedra(cor), matB = brilhoCor ? brilho(brilhoCor) : mat;
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo, k % 4 === 0 ? matB : mat);
      const a = Math.random() * Math.PI * 2, v = forca * (0.5 + Math.random() * 0.6);
      m.userData.v = new THREE.Vector3(Math.cos(a) * v, 3 + Math.random() * 4, Math.sin(a) * v);
      m.scale.setScalar(0.6 + Math.random() * 1.2);
      this.pecas.push(m);
      this.objeto.add(m);
    }
  }
  atualizar(dt) {
    this.t += dt;
    for (const m of this.pecas) {
      m.userData.v.y -= GRAVIDADE * dt;
      m.position.addScaledVector(m.userData.v, dt);
      m.rotation.x += dt * 8; m.rotation.z += dt * 6;
      if (m.position.y < -0.1) { m.position.y = -0.1; m.userData.v.set(0, 0, 0); }
    }
    if (this.t > 0.9) this.objeto.scale.setScalar(Math.max(0.01, 1 - (this.t - 0.9) * 3));
    if (this.t > 1.2) this.removido = true;
    this.sincronizar(dt);
  }
}

// traço de luz reto (Raio de luz do Orlando)
class Feixe extends Entidade {
  constructor(jogo, de, ate, cor) {
    super(jogo, de.x, de.z, { raio: 0.1 });
    this.pos.copy(de);
    this.sombra.visible = false;
    this.t = 0;
    const comp = de.distanceTo(ate);
    const geo = new THREE.BoxGeometry(0.16, 0.16, comp).translate(0, 0, comp / 2);
    this.mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, this.mat);
    const miolo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, comp).translate(0, 0, comp / 2), brilho(0xffffff));
    m.add(miolo);
    m.lookAt(ate.clone().sub(de));
    this.objeto.add(m);
    const ponta = halo(cor, 1.2);
    ponta.position.copy(ate).sub(de);
    this.objeto.add(ponta);
    this.ponta = ponta;
  }
  atualizar(dt) {
    this.t += dt;
    const f = 1 - this.t / 0.4;
    this.mat.opacity = Math.max(0, f);
    this.ponta.material.opacity = Math.max(0, f);
    if (f <= 0) this.removido = true;
    this.objeto.position.copy(this.pos);
  }
}

// Disco Solar lançado pelo Chico: ricocheteia entre até 4 inimigos e volta
class DiscoSolar extends Entidade {
  constructor(jogo, autor) {
    super(jogo, autor.pos.x, autor.pos.z, { raio: 0.25 });
    this.autor = autor;
    this.pos.y = autor.pos.y + 0.8;
    this.atingidos = new Set();
    this.saltos = 4;
    this.t = 0;
    this.voltando = false;
    this.alvo = this.procurar(autor.pos, 8, autor.olhando);
    this.dir = autor.olhando.clone();
    this.sombra.scale.setScalar(0.25);
    const m = modeloReliquia('disco');
    m.scale.setScalar(0.8);
    m.rotation.x = -Math.PI / 2;
    this.giro = new THREE.Group();
    this.giro.add(m, halo(0xffc94a, 1));
    this.objeto.add(this.giro);
  }
  procurar(de, alcance, cone = null) {
    let melhor = null, dm = alcance;
    for (const e of this.jogo.entidades) {
      if (e.time !== 'inimigo' || e.removido || this.atingidos.has(e)) continue;
      const dx = e.pos.x - de.x, dz = e.pos.z - de.z, d = Math.hypot(dx, dz);
      if (d > dm || Math.abs(e.pos.y - this.pos.y) > 2.5) continue;
      if (cone && d > 0.5 && (dx * cone.x + dz * cone.z) / d < 0.35) continue;
      melhor = e; dm = d;
    }
    return melhor;
  }
  atualizar(dt) {
    this.t += dt;
    const v = 13;
    let destino = null;
    if (this.voltando) destino = this.autor.pos;
    else if (this.alvo && !this.alvo.removido) destino = this.alvo.pos;
    if (destino) {
      this.dir.set(destino.x - this.pos.x, 0, destino.z - this.pos.z);
      if (this.dir.lengthSq() > 1e-4) this.dir.normalize();
      this.pos.y += ((destino.y + 0.8) - this.pos.y) * Math.min(1, dt * 8);
    } else if (this.t > 0.55) this.voltando = true;   // sem alvo: vai reto e volta
    this.pos.addScaledVector(this.dir, v * dt);
    this.giro.rotation.y += dt * 20;

    if (!this.voltando) {
      // parede: volta
      if (this.jogo.mapa.alturaEm(this.pos.x, this.pos.z) > this.pos.y) this.voltando = true;
      for (const e of this.jogo.entidades) {
        if (e.removido || this.atingidos.has(e) || this.distancia(e) > (e.raio ?? 0.3) + this.raio + 0.1) continue;
        if (Math.abs(e.pos.y + 0.6 - this.pos.y) > 1.3) continue;
        if (e.time === 'inimigo') {
          this.atingidos.add(e);
          e.receberDano(1.5, this.autor, { atordoa: 0.6, empurra: 3 });
          this.jogo.audio?.tocar('acerto');
          this.saltos--;
          this.alvo = this.saltos > 0 ? this.procurar(this.pos, 6) : null;
          if (!this.alvo) this.voltando = true;
          break;
        }
        if (e.acionavel && !e.ligada) { e.acionar(); this.atingidos.add(e); }
        else if (e.aoLuz) { e.aoLuz(this.autor); this.atingidos.add(e); }
      }
    } else if (this.distancia(this.autor) < 0.6 || this.t > 5) this.removido = true;
    this.sincronizar(dt);
  }
}

// raízes que prendem um inimigo no lugar (Semente, Hugo)
class Raizes extends Entidade {
  constructor(jogo, alvo, duracao) {
    super(jogo, alvo.pos.x, alvo.pos.z, { raio: 0.1 });
    this.alvo = alvo;
    this.duracao = duracao;
    this.t = 0;
    this.sombra.visible = false;
    const mat = new THREE.MeshLambertMaterial({ color: 0x5a4a2a, flatShading: true });
    const matP = brilho(0x8fdc5a);
    const r = (alvo.raio ?? 0.35) + 0.12;
    this.garras = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 4).translate(0, 0.45, 0), k % 2 ? matP : mat);
      c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      c.rotation.set(Math.sin(a) * -0.45, 0, Math.cos(a) * 0.45);
      this.garras.add(c);
    }
    this.objeto.add(this.garras);
  }
  atualizar(dt) {
    this.t += dt;
    const e = this.alvo;
    if (e.removido || this.t > this.duracao) {
      this.garras.scale.y = Math.max(0.01, this.garras.scale.y - dt * 4);
      if (this.garras.scale.y <= 0.02 || e.removido) this.removido = true;
    } else {
      this.garras.scale.y = Math.min(1, this.t / 0.2);
      this.pos.copy(e.pos);
      e.vel.x = 0; e.vel.z = 0;
      if (e.vel.y > 0) e.vel.y = 0;
      e.atordoado = Math.max(e.atordoado, 0.12);
      e.preparo = 0;
      e.telegrafar?.(false);
    }
    this.sincronizar(dt);
  }
}

// cipó/plataforma que brota num tile (Semente, Chico). Sobre abismo vira ponte.
class Broto extends Entidade {
  constructor(jogo, i, j, topo, duracao = 10) {
    super(jogo, i + .5, j + .5, { raio: 0.45 });
    Object.assign(this, { i, j, topo, duracao, t: 0 });
    this.base = jogo.mapa.tipo(i, j).altura;
    this.pos.y = this.base;
    this.sombra.visible = false;
    this.ehBroto = true;
    const mat = new THREE.MeshLambertMaterial({ color: 0x4d6a2a, flatShading: true });
    this.cipos = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + 0.4;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1, 5).translate(0, 0.5, 0), mat);
      c.position.set(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28);
      c.rotation.set(Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1);
      c.castShadow = true;
      this.cipos.add(c);
    }
    this.folhas = new THREE.Mesh(lascar(new THREE.BoxGeometry(0.96, 0.14, 0.96, 3, 1, 3), 0.06, 77),
      new THREE.MeshLambertMaterial({ color: 0x6f9a3a, emissive: 0x16300a, flatShading: true }));
    this.folhas.castShadow = this.folhas.receiveShadow = true;
    this.flores = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), brilho(k % 2 ? 0xb6ec7a : 0xe0ffb0));
      f.position.set(Math.cos(k * 2.4) * 0.3, 0.12, Math.sin(k * 2.4) * 0.3);
      this.flores.add(f);
    }
    this.folhas.add(this.flores);
    this.objeto.add(this.cipos, this.folhas);
    this.aplicar(0.01);
  }
  aplicar(k) {
    const h = Math.max(0.01, (this.topo - this.base) * k);
    this.jogo.mapa.bloquear(this.i, this.j, h);
    this.cipos.scale.y = h;
    this.folhas.position.y = h - 0.07;
  }
  atualizar(dt) {
    this.t += dt;
    if (this.t < 0.45) this.aplicar(this.t / 0.45);
    else if (this.t < 0.5) this.aplicar(1);
    const resta = this.duracao - this.t;
    this.folhas.visible = resta > 1.5 || Math.floor(resta * 8) % 2 === 0;
    if (resta <= 0) {
      this.jogo.mapa.desbloquear(this.i, this.j);
      this.jogo.eventos.emitir('quebra', { alvo: this });
      this.removido = true;
    }
    this.sincronizar(dt);
    this.sombra.visible = false;
  }
}

// círculo de cura lenta (Semente, Orlando)
class Bosque extends Entidade {
  constructor(jogo, x, z, y, { raio = 2.6, duracao = 8 } = {}) {
    super(jogo, x, z, { raio: 0.1 });
    this.pos.y = y;
    Object.assign(this, { raioBosque: raio, duracao, t: 0, tCura: 0.6, curado: 0 });
    this.sombra.visible = false;
    const anel = new THREE.Mesh(new THREE.RingGeometry(raio - 0.15, raio, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x8fdc5a, transparent: true, opacity: 0.7, depthWrite: false }));
    const miolo = new THREE.Mesh(new THREE.CircleGeometry(raio, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x4d7a2a, transparent: true, opacity: 0.18, depthWrite: false }));
    anel.position.y = miolo.position.y = 0.04;
    this.brotos = new THREE.Group();
    const mat = brilho(0xb6ec7a);
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4).translate(0, 0.15, 0), mat);
      c.position.set(Math.cos(a) * (raio - 0.3), 0, Math.sin(a) * (raio - 0.3));
      this.brotos.add(c);
    }
    this.objeto.add(anel, miolo, this.brotos);
    this.anel = anel;
  }
  atualizar(dt) {
    this.t += dt;
    const j = this.jogo.jogador;
    this.brotos.scale.y = Math.min(1, this.t / 0.4) * (1 + Math.sin(this.t * 4) * 0.1);
    this.anel.rotation.y += dt * 0.3;
    if (j && this.distancia(j) < this.raioBosque && j.vida < j.vidaMax && j.vida > 0) {
      this.tCura -= dt;
      if (this.tCura <= 0) {
        this.tCura = 1.2;
        j.vida = Math.min(j.vidaMax, j.vida + 0.5);
        this.curado += 0.5;
        this.jogo.eventos.emitir('cura', { alvo: j, qtd: 0.5 });
      }
    }
    if (this.t > this.duracao - 0.5) this.objeto.scale.setScalar(Math.max(0.01, (this.duracao - this.t) * 2));
    if (this.t >= this.duracao) this.removido = true;
    this.sincronizar(dt);
  }
}

// bloco de pedra colossal que cai e esmaga (Coração Sísmico, Orlando). Fica como degrau.
class PedraColossal extends Entidade {
  constructor(jogo, i, j, { autor, dano = 3, duracao = 14 } = {}) {
    super(jogo, i + .5, j + .5, { raio: 0.45 });
    Object.assign(this, { i, j, autor, dano, duracao, t: 0, pousou: false });
    this.base = jogo.mapa.alturaEm(i + .5, j + .5);
    this.pos.y = Math.max(this.base, autor?.pos.y ?? this.base) + 3.4;
    this.vel.y = -3;
    this.ehPedra = true;
    const bloco = new THREE.Mesh(lascar(new THREE.BoxGeometry(0.96, 1, 0.96, 2, 2, 2), 0.07, 99 + i * 7 + j), pedra(0x6d6258));
    bloco.position.y = 0.5;
    bloco.castShadow = bloco.receiveShadow = true;
    // olho entalhado de estátua, ainda aceso
    const olho = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.0), brilho(0xe0782a));
    olho.position.y = 0.62;
    const sobrancelha = new THREE.Mesh(lascar(new THREE.BoxGeometry(1.02, 0.14, 1.02), 0.04, 5), pedra(0x5a5248));
    sobrancelha.position.y = 0.8;
    this.visual = new THREE.Group();
    this.visual.add(bloco, olho, sobrancelha);
    this.objeto.add(this.visual);
  }
  atualizar(dt) {
    this.t += dt;
    const m = this.jogo.mapa;
    if (!this.pousou) {
      this.vel.y -= GRAVIDADE * 1.4 * dt;
      this.pos.y += this.vel.y * dt;
      const vazio = m.tipo(this.i, this.j).vazio;
      if (!vazio && this.pos.y <= this.base) this.pousar();
      else if (vazio && this.pos.y < -5) this.removido = true;
    } else {
      const resta = this.duracao - (this.t - this.tPouso);
      if (resta < 0.5) this.visual.scale.set(1, Math.max(0.02, resta * 2), 1);
      if (resta <= 0) {
        m.desbloquear(this.i, this.j);
        this.jogo.eventos.emitir('quebra', { alvo: this });
        this.removido = true;
      }
    }
    this.sincronizar(dt);
    this.sombra.visible = !this.pousou;
  }
  pousar() {
    this.pousou = true;
    this.tPouso = this.t;
    this.pos.y = this.base;
    const { jogo } = this;
    for (const e of jogo.entidades) {
      if (e.removido || e === this) continue;
      const perto = Math.abs(e.pos.x - this.pos.x) < 0.5 + (e.raio ?? 0.3) && Math.abs(e.pos.z - this.pos.z) < 0.5 + (e.raio ?? 0.3);
      if (!perto) continue;
      if (e.time === 'inimigo' && Math.abs(e.pos.y - this.base) < 1.6) e.receberDano(this.dano, this.autor, { atordoa: 1.5, empurra: 5 });
      else if (e.ehCaixa) e.quebrar();
    }
    // o bloco vira degrau (+1) no tile
    jogo.mapa.bloquear(this.i, this.j, (jogo.mapa.bloqueios.get(`${this.i},${this.j}`) ?? 0) + 1);
    this.base = jogo.mapa.tipo(this.i, this.j).altura;
    this.pos.y = this.base;
    jogo.camera.tremer(0.45);
    jogo.adicionar(new Onda(jogo, this.pos.x, this.pos.z, { raioMax: 1.8, duracao: 0.3, cor: 0xe0782a, y: this.base }));
    jogo.adicionar(new Estilhacos(jogo, this.pos.x, this.base + 0.3, this.pos.z, { n: 10, forca: 3 }));
    jogo.eventos.emitir('quebra', { alvo: this });
  }
}

// rastro de água (Correnteza)
class Gota extends Entidade {
  constructor(jogo, pos) {
    super(jogo, pos.x, pos.z, { raio: 0.1 });
    this.pos.copy(pos); this.pos.y += 0.4;
    this.sombra.visible = false;
    this.t = 0;
    this.m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: 0x7fd0f0, transparent: true, opacity: 0.6, depthWrite: false }));
    this.objeto.add(this.m);
  }
  atualizar(dt) {
    this.t += dt;
    this.m.scale.setScalar(1 + this.t * 2);
    this.m.material.opacity = Math.max(0, 0.6 - this.t * 1.5);
    this.pos.y -= dt * 0.5;
    if (this.t > 0.4) this.removido = true;
    this.sincronizar(dt);
  }
}

// ------------------------------------------------------------------ sistema (equipar, usar)
// Criado por Habilidades (jogo.reliquias). atualizar() roda dentro de atualizarJogador.
export class SistemaReliquias {
  constructor(jogo, habilidades) {
    this.jogo = jogo;
    this.hab = habilidades;
    this.recarga = {};
    this.sismo = null; this.correnteza = null; this.escudoSolar = 0; this.bolha = null;
  }

  get progresso() {
    const p = (this.jogo.progresso ??= {});
    p.reliquias ??= [];
    return p;
  }
  get lista() { return this.progresso.reliquias; }
  get ativa() { return this.progresso.reliquiaAtiva ?? null; }

  // estado para o HUD
  estado() {
    const id = this.ativa, j = this.jogo.jogador;
    const r = id ? RELIQUIAS[id] : null;
    const total = r ? r.recarga : 1;
    return {
      ativa: id, lista: this.lista, info: r,
      efeito: r && j ? r.efeitos[j.atual] : '',
      recarga: id ? Math.max(0, (this.recarga[id] ?? 0) / total) : 0,
    };
  }

  ganhar(id, j) {
    const p = this.progresso;
    if (!p.reliquias.includes(id)) p.reliquias.push(id);
    p.reliquiaAtiva = id;
    this.recarga[id] = 0;
    const { jogo } = this;
    jogo.salvarProgresso?.();
    if (j) { j.atordoado = Math.max(j.atordoado, 1.2); j.invulneravel = Math.max(j.invulneravel, 1.8); j.vel.set(0, j.vel.y, 0); }
    jogo.camera.tremer(0.7);
    jogo.audio?.tocar('surto');
    jogo.audio?.tocar('memoria');
    const r = RELIQUIAS[id];
    jogo.eventos.emitir('reliquia', { id, nome: r.nome, origem: r.origem });
  }

  alternar() {
    const l = this.lista;
    if (l.length < 2) return;
    const p = this.progresso;
    p.reliquiaAtiva = l[(l.indexOf(p.reliquiaAtiva) + 1) % l.length];
    this.jogo.salvarProgresso?.();
    this.jogo.audio?.tocar('troca', 'orlando');
    this.jogo.eventos.emitir('reliquiaTroca', { id: p.reliquiaAtiva });
  }

  // cada Jogador novo (sala nova) ganha escudo e bolha próprios
  prepararJogador(j) {
    this.sismo = null; this.correnteza = null; this.escudoSolar = 0; this.bolha = null;
    const disco = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    disco.add(face, aro);
    disco.visible = false;
    this.meshEscudo = disco;
    this.meshBolha = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0x7fd0f0, transparent: true, opacity: 0.25, depthWrite: false }));
    this.meshBolha.position.y = 0.7;
    this.meshBolha.visible = false;
    j.objeto.add(disco, this.meshBolha);
  }

  // true = dano anulado (escudo solar pela frente, bolha)
  anula(j, origem) {
    if (this.escudoSolar > 0 && j.atual === 'hugo' && origem?.pos) {
      const dx = origem.pos.x - j.pos.x, dz = origem.pos.z - j.pos.z, d = Math.hypot(dx, dz) || 1;
      if ((dx * j.olhando.x + dz * j.olhando.z) / d > 0.1) {
        this.jogo.audio?.tocar('parry');
        j.invulneravel = 0.25;
        return true;
      }
    }
    if (this.bolha) {
      this.bolha.cargas--;
      this.meshBolha.material.opacity = 0.7;
      j.invulneravel = 0.5;
      this.jogo.audio?.tocar('parry');
      if (this.bolha.cargas <= 0) this.estourarBolha(j);
      return true;
    }
    return false;
  }

  atualizar(j, dt, input, livre) {
    for (const k in this.recarga) this.recarga[k] = Math.max(0, this.recarga[k] - dt);
    if (input.apertou('reliquia')) this.alternar();
    if (livre && input.apertou('usarReliquia')) this.usar(j);
    this.atualizarSismo(j, dt);
    this.atualizarCorrenteza(j, dt);
    this.atualizarEscudo(j, dt);
    this.atualizarBolha(j, dt);
  }

  usar(j) {
    const id = this.ativa;
    if (!id) { this.jogo.eventos.emitir('reliquiaFalha', { id, motivo: 'nenhuma' }); return; }
    if ((this.recarga[id] ?? 0) > 0) { this.jogo.audio?.tocar('seco'); this.jogo.eventos.emitir('reliquiaFalha', { id, motivo: 'recarga' }); return; }
    const ok = this[`${id}_${j.atual}`]?.(j);
    if (ok === false) { this.jogo.audio?.tocar('seco'); this.jogo.eventos.emitir('reliquiaFalha', { id, motivo: 'lugar' }); return; }
    this.recarga[id] = RELIQUIAS[id].recarga;
    this.jogo.eventos.emitir('reliquiaUsada', { id, macaco: j.atual, efeito: RELIQUIAS[id].efeitos[j.atual] });
  }

  inimigosEm(centro, raio, dy = 2) {
    return this.jogo.entidades.filter((e) => e.time === 'inimigo' && !e.removido
      && Math.hypot(e.pos.x - centro.x, e.pos.z - centro.z) <= raio + e.raio && Math.abs(e.pos.y - centro.y) < dy);
  }

  // tile à frente (nunca o do próprio jogador)
  tileFrente(j) {
    const i0 = Math.floor(j.pos.x), j0 = Math.floor(j.pos.z);
    for (const d of [1, 1.5]) {
      const i = Math.floor(j.pos.x + j.olhando.x * d), k = Math.floor(j.pos.z + j.olhando.z * d);
      if (i !== i0 || k !== j0) return { i, j: k };
    }
    return { i: i0 + Math.round(j.olhando.x), j: j0 + Math.round(j.olhando.z) };
  }
  tileUsavel(i, j) {
    const m = this.jogo.mapa;
    if (m.tipo(i, j).solido || m.bloqueios.has(`${i},${j}`)) return false;
    return !(i < 0 || j < 0 || i >= m.larg || j >= m.alt);
  }

  // ---------------- Coração Sísmico
  sismico_hugo(j) {
    const { jogo } = this, R = 5;
    jogo.adicionar(new Onda(jogo, j.pos.x, j.pos.z, { raioMax: R, duracao: 0.6, cor: 0xe0782a, y: j.pos.y }));
    jogo.adicionar(new Onda(jogo, j.pos.x, j.pos.z, { raioMax: R * 0.55, duracao: 0.35, cor: 0xffd08a, y: j.pos.y }));
    jogo.adicionar(new Estilhacos(jogo, j.pos.x, j.pos.y + 0.2, j.pos.z, { n: 18, forca: 6, brilhoCor: 0xe0782a }));
    for (const e of jogo.entidades) {
      if (e.removido) continue;
      const d = j.distancia(e);
      if (e.time === 'inimigo' && d <= R + e.raio && Math.abs(e.pos.y - j.pos.y) < 2.2) {
        e.receberDano(2, j, { atordoa: 2, empurra: 5 });
        e.atordoar?.(2);
        if (!e.voa || e.atordoado > 0.3) e.vel.y = Math.max(e.vel.y, 6);   // derruba
      } else if (e.ehSelo && d <= R) e.quebrar();
      else if (e.ehCaixa && d <= 2.2) e.quebrar();
    }
    jogo.camera.tremer(0.9);
    jogo.audio?.tocar('explosao', true);
  }

  sismico_chico(j) {
    this.sismo = { restantes: 3, noAr: !j.noChao, t: 0 };
    if (j.noChao) this.saltoSismico(j);
    else j.vel.y = -16;   // no ar: desce batendo, e a série começa do impacto
  }
  saltoSismico(j) {
    j.vel.y = 10.5;
    j.vel.x += j.olhando.x * 1.5; j.vel.z += j.olhando.z * 1.5;
    this.jogo.eventos.emitir('pulo', { macaco: 'chico', sismico: true });
  }
  atualizarSismo(j, dt) {
    const s = this.sismo;
    if (!s) return;
    s.t += dt;
    if (j.atual !== 'chico' || s.t > 7) { this.sismo = null; return; }
    if (!j.noChao) {
      s.noAr = true;
      if (j.vel.y < 0) j.vel.y -= GRAVIDADE * 0.7 * dt;   // desce pesado
      return;
    }
    if (!s.noAr) return;
    // impacto
    const { jogo } = this;
    jogo.adicionar(new Onda(jogo, j.pos.x, j.pos.z, { raioMax: 2.4, duracao: 0.3, cor: 0xe0782a, y: j.pos.y }));
    jogo.adicionar(new Estilhacos(jogo, j.pos.x, j.pos.y + 0.1, j.pos.z, { n: 8, forca: 3 }));
    for (const e of this.inimigosEm(j.pos, 2.4, 1)) e.receberDano(1, j, { atordoa: 1.2, empurra: 4 });
    for (const e of jogo.entidades) if (e.ehCaixa && !e.removido && j.distancia(e) < 1.2) e.quebrar();
    jogo.camera.tremer(0.35);
    jogo.audio?.tocar('pulverizar');
    s.restantes--;
    s.noAr = false;
    if (s.restantes > 0) this.saltoSismico(j);
    else this.sismo = null;
  }

  sismico_orlando(j) {
    const alvo = this.tileFrente(j);
    if (!this.tileUsavel(alvo.i, alvo.j)) return false;
    // o que o Orlando segura vira pedra: a caixa some na pedra; o inimigo é petrificado e esfarela
    const seg = this.hab.segurado;
    let dano = 3;
    if (seg) {
      this.hab.segurado = null;
      seg.preso = null;
      if (seg.ehCaixa) { seg.removido = true; dano = 5; }
      else if (seg.time === 'inimigo') { seg.receberDano(5, j, { atordoa: 2 }); dano = 4; }
    }
    this.jogo.adicionar(new PedraColossal(this.jogo, alvo.i, alvo.j, { autor: j, dano, duracao: seg?.ehCaixa ? 30 : 14 }));
    this.jogo.audio?.tocar('arremesso');
  }

  // ---------------- Disco Solar
  disco_chico(j) {
    this.jogo.adicionar(new DiscoSolar(this.jogo, j));
    this.jogo.audio?.tocar('arremesso');
  }

  disco_hugo() {
    this.escudoSolar = 3.5;
    this.jogo.audio?.tocar('guarda');
  }
  atualizarEscudo(j, dt) {
    const m = this.meshEscudo;
    if (!m) return;
    if (this.escudoSolar > 0 && j.atual !== 'hugo') this.escudoSolar = 0;
    this.escudoSolar = Math.max(0, this.escudoSolar - dt);
    m.visible = this.escudoSolar > 0 && (this.escudoSolar > 0.6 || Math.floor(this.escudoSolar * 10) % 2 === 0);
    if (this.escudoSolar <= 0) return;
    m.position.set(j.olhando.x * 0.6, 0.8, j.olhando.z * 0.6);
    m.lookAt(j.objeto.position.clone().add(new THREE.Vector3(j.olhando.x * 5, 0.8, j.olhando.z * 5)));
    m.rotateZ(performance.now() / 400);
    // anda mais devagar com o disco erguido
    const v = Math.hypot(j.vel.x, j.vel.z), max = 2.4;
    if (v > max) { j.vel.x *= max / v; j.vel.z *= max / v; }
    // devolve projéteis que chegam pela frente
    for (const e of this.jogo.entidades) {
      if (!(e instanceof Projetil) || e.removido || e.alvo !== 'jogador') continue;
      const dx = e.pos.x - j.pos.x, dz = e.pos.z - j.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.4 || (dx * j.olhando.x + dz * j.olhando.z) / (d || 1) < 0.1) continue;
      const vel = e.vel.length() * 1.3;
      const atirador = e.autor && !e.autor.removido ? e.autor : null;
      const dir = atirador ? new THREE.Vector3(atirador.pos.x - e.pos.x, 0, atirador.pos.z - e.pos.z).normalize() : e.vel.clone().negate().normalize();
      e.vel.copy(dir).multiplyScalar(vel);
      e.alvo = 'inimigo';
      e.autor = j;
      e.vidaUtil = 3;
      e.dano = Math.max(e.dano, 1.5);
      e.malha.material.color?.setHex(0xffc94a);
      this.jogo.audio?.tocar('parry');
      this.jogo.eventos.emitir('reflexo', { alvo: e, centro: e.pos.clone() });
    }
  }

  disco_orlando(j) {
    const { jogo } = this, m = jogo.mapa;
    const de = j.pos.clone(); de.y += 0.9;
    const dir = j.olhando.clone().setY(0).normalize();
    const p = de.clone();
    const tocados = new Set();
    let dist = 0;
    for (; dist < 12; dist += 0.2) {
      p.copy(de).addScaledVector(dir, dist);
      for (const e of jogo.entidades) {
        if (e.removido || e === j || tocados.has(e)) continue;
        if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > (e.raio ?? 0.3) + 0.35) continue;
        if (p.y < e.pos.y - 0.9 || p.y > e.pos.y + 2.6) continue;   // alcança o topo de um degrau/pilar
        tocados.add(e);
        if (e.acionavel && !e.ligada) e.acionar();
        else if (e.aoLuz) e.aoLuz(j);
        else if (e.ehPorta && !e.aberta && m.sala?.portasDeLuz) e.abrir();
        else if (e.time === 'inimigo') {
          if (e.faccao === 'quanta' && e.pesado && !e.ehChefe) e.atordoar(3);   // desliga a máquina, como a Ferramenta
          else e.atordoar?.(1.2);                                                // ofusca
        }
      }
      if (m.alturaEm(p.x, p.z) > p.y) break;   // parede, porta, selo: a luz para
    }
    jogo.adicionar(new Feixe(jogo, de, p.clone(), 0xffc94a));
    jogo.audio?.tocar('teleporte');
  }

  // ---------------- Semente Primordial
  semente_hugo(j) {
    const { jogo } = this;
    jogo.adicionar(new Onda(jogo, j.pos.x, j.pos.z, { raioMax: 4.5, duracao: 0.5, cor: 0x8fdc5a, y: j.pos.y }));
    for (const e of this.inimigosEm(j.pos, 4.5, 2.2)) {
      if (e.voa && !(e.atordoado > 0.3)) { e.atordoar?.(1.5); continue; }   // voador: só ofusca
      e.receberDano(1, j, {});
      if (!e.removido) jogo.adicionar(new Raizes(jogo, e, e.ehChefe ? 1.5 : 3.5));
    }
    jogo.camera.tremer(0.3);
    jogo.audio?.tocar('ferramenta');
  }

  semente_chico(j) {
    const { i, j: k } = this.tileFrente(j);
    if (!this.tileUsavel(i, k)) return false;
    const m = this.jogo.mapa, t = m.tipo(i, k);
    // sobre abismo: ponte no nível do Chico; sobre chão: coluna de 1,5 para escalar
    const nivel = m.vazioEm(j.pos.x, j.pos.z) ? (j.ultimoChao?.y ?? j.pos.y) : m.alturaEm(j.pos.x, j.pos.z);
    const topo = t.vazio ? nivel : Math.max(t.altura, nivel) + 1.5;
    this.jogo.adicionar(new Broto(this.jogo, i, k, topo));
    this.jogo.audio?.tocar('cura');
  }

  semente_orlando(j) {
    this.jogo.adicionar(new Bosque(this.jogo, j.pos.x, j.pos.z, j.pos.y));
    this.jogo.audio?.tocar('cura');
  }

  // ---------------- Pérola Abissal
  perola_hugo(j) {
    const { jogo } = this, R = 4.5;
    jogo.adicionar(new Onda(jogo, j.pos.x, j.pos.z, { raioMax: R, duracao: 0.45, cor: 0x4fb0d8, y: j.pos.y }));
    jogo.adicionar(new Onda(jogo, j.pos.x, j.pos.z, { raioMax: R * 0.7, duracao: 0.6, cor: 0xbfe8ff, y: j.pos.y }));
    for (const e of this.inimigosEm(j.pos, R, 2.2)) {
      e.receberDano(1, j, {});
      const d = Math.max(0.3, j.distancia(e));
      const f = e.pesado ? 5 : 12;
      e.vel.x += (e.pos.x - j.pos.x) / d * f;
      e.vel.z += (e.pos.z - j.pos.z) / d * f;
      e.vel.y = Math.max(e.vel.y, 4);
      e.atordoar?.(0.9);
      e.derrapando = Math.max(e.derrapando ?? 0, 0.6);   // pouco atrito: a maré carrega
    }
    // a maré apaga tiros
    for (const e of jogo.entidades) if (e instanceof Projetil && e.alvo === 'jogador' && j.distancia(e) < R) e.removido = true;
    jogo.camera.tremer(0.4);
    jogo.audio?.tocar('porta');
  }

  perola_chico(j) {
    this.correnteza = { t: 0.42, dir: j.olhando.clone().setY(0).normalize(), atingidos: new Set(), gota: 0 };
    j.invulneravel = Math.max(j.invulneravel, 0.55);
    this.jogo.audio?.tocar('investida');
  }
  atualizarCorrenteza(j, dt) {
    const c = this.correnteza;
    if (!c) return;
    c.t -= dt;
    if (c.t <= 0 || j.atual !== 'chico') {
      j.vel.x = c.dir.x * 5; j.vel.z = c.dir.z * 5;
      this.correnteza = null;
      return;
    }
    j.vel.x = c.dir.x * 13; j.vel.z = c.dir.z * 13;
    j.vel.y = GRAVIDADE * dt;   // desliza sobre a água: nem sobe nem cai
    if ((c.gota -= dt) <= 0) { c.gota = 0.035; this.jogo.adicionar(new Gota(this.jogo, j.pos)); }
    for (const e of this.inimigosEm(j.pos, 0.9, 1.4)) {
      if (c.atingidos.has(e)) continue;
      c.atingidos.add(e);
      e.receberDano(1, j, {});
      e.derrapar?.(c.dir, 1);
    }
  }

  perola_orlando(j) {
    this.bolha = { cargas: 3, t: 10 };
    this.meshBolha.visible = true;
    this.jogo.audio?.tocar('cura');
  }
  atualizarBolha(j, dt) {
    const b = this.bolha, m = this.meshBolha;
    if (!b || !m) return;
    b.t -= dt;
    m.material.opacity += (0.22 - m.material.opacity) * Math.min(1, dt * 5);
    m.scale.setScalar(1 + Math.sin(b.t * 5) * 0.04);
    m.visible = b.t > 1.5 || Math.floor(b.t * 8) % 2 === 0;
    if (b.t <= 0) this.estourarBolha(j);
  }
  estourarBolha(j) {
    this.bolha = null;
    if (this.meshBolha) this.meshBolha.visible = false;
    this.jogo.adicionar(new Onda(this.jogo, j.pos.x, j.pos.z, { raioMax: 1.4, duracao: 0.25, cor: 0x7fd0f0, y: j.pos.y + 0.4 }));
  }
}
