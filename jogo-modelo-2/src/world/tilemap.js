import * as THREE from 'three';
import { TIPOS_CHAO } from './tiles.js';

// Coordenadas: tile (i = coluna, j = linha) ocupa o quadrado [i, i+1) x [j, j+1)
// no plano XZ do mundo. Centro do tile = (i + .5, j + .5). Y é altura.

const CORES = {
  pedra: 0x6b604c, musgo: 0x5d6b3f, parede: 0x4a4234, circuito: 0x2f5f63, abismo: 0x000000,
};

export class Tilemap {
  constructor(sala) {
    this.sala = sala;
    this.chao = sala.chao.map((l) => l.padEnd(Math.max(...sala.chao.map((x) => x.length)), ' '));
    this.alt = this.chao.length;
    this.larg = this.chao[0].length;
    this.coisas = [];
    (sala.coisas || []).forEach((linha, j) => {
      [...linha].forEach((c, i) => { if (c !== ' ' && c !== '.') this.coisas.push({ letra: c, i, j }); });
    });
    // bloqueios dinâmicos (portas fechadas, selos): chave "i,j" -> altura extra
    this.bloqueios = new Map();
  }

  tipo(i, j) {
    if (j < 0 || j >= this.alt || i < 0 || i >= this.larg) return TIPOS_CHAO[' '];
    return TIPOS_CHAO[this.chao[j][i]] || TIPOS_CHAO['.'];
  }

  // altura do topo do tile na posição de mundo (x,z); considera bloqueios dinâmicos
  alturaEm(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    const extra = this.bloqueios.get(`${i},${j}`) || 0;
    return this.tipo(i, j).altura + extra;
  }

  vazioEm(x, z) { return !!this.tipo(Math.floor(x), Math.floor(z)).vazio; }

  bloquear(i, j, altura) { this.bloqueios.set(`${i},${j}`, altura); }
  desbloquear(i, j) { this.bloqueios.delete(`${i},${j}`); }

  // gera uma malha instanciada por tipo; blocos vão do fundo (-1) até o topo
  construirMalha() {
    const grupo = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const porTipo = new Map();
    for (let j = 0; j < this.alt; j++) {
      for (let i = 0; i < this.larg; i++) {
        const t = this.tipo(i, j);
        if (t.vazio) continue;
        if (!porTipo.has(t.nome)) porTipo.set(t.nome, []);
        porTipo.get(t.nome).push({ i, j, h: t.altura });
      }
    }
    const m = new THREE.Matrix4();
    for (const [nome, lista] of porTipo) {
      const mat = new THREE.MeshLambertMaterial({ color: CORES[nome] ?? 0x888888 });
      if (nome === 'circuito') mat.emissive = new THREE.Color(0x0d3538);
      const inst = new THREE.InstancedMesh(geo, mat, lista.length);
      const cor = new THREE.Color();
      lista.forEach(({ i, j, h }, k) => {
        const base = -1, altura = h - base;
        m.makeScale(1, altura, 1).setPosition(i + .5, base + altura / 2, j + .5);
        inst.setMatrixAt(k, m);
        // variação leve por tile para o chão não parecer liso
        const v = 0.9 + (((i * 73856093) ^ (j * 19349663)) & 255) / 255 * 0.2;
        inst.setColorAt(k, cor.set(CORES[nome] ?? 0x888888).multiplyScalar(v));
      });
      inst.receiveShadow = true;
      inst.castShadow = nome === 'parede' || lista.some((t) => t.h > 0);
      grupo.add(inst);
    }
    return grupo;
  }
}
