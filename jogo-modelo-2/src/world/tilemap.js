import * as THREE from 'three';
import { TIPOS_CHAO } from './tiles.js';
import { construirTerreno, construirDeco } from './visual.js';

// Coordenadas: tile (i = coluna, j = linha) ocupa o quadrado [i, i+1) x [j, j+1)
// no plano XZ do mundo. Centro do tile = (i + .5, j + .5). Y é altura.


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

  // malha do terreno (atlas pixel art, rebaixamento, recorte) + decoração; ver visual.js
  construirMalha() {
    const grupo = new THREE.Group();
    this.terreno = construirTerreno(this);
    grupo.add(this.terreno.mesh);
    grupo.add(construirDeco(this, this.terreno));
    return grupo;
  }
}
