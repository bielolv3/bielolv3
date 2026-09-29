import * as THREE from 'three';
import { Entidade } from './entidade.js';

// Saída da sala: quando o jogador pisa, o jogo carrega a próxima.
export class Saida extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.5 });
    this.sombra.visible = false;
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
