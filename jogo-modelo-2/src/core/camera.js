import * as THREE from 'three';

// Câmera ortográfica em ângulo isométrico, girável em passos de 90°.
// `zoom` = quantos tiles cabem na altura da tela.
export class CameraIso {
  constructor(tilesNaAltura = 14) {
    this.tilesNaAltura = tilesNaAltura;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    this.alvo = new THREE.Vector3();
    this.quadrante = 0;          // 0..3, girado com Q/E
    this.anguloAtual = Math.PI / 4;
    this.tremor = 0;
    this.redimensionar(innerWidth, innerHeight);
  }

  get anguloAlvo() { return Math.PI / 4 + this.quadrante * Math.PI / 2; }

  girar(passo) { this.quadrante = (this.quadrante + passo + 4) % 4; }

  tremer(forca = 0.3) { this.tremor = Math.max(this.tremor, forca); }

  redimensionar(w, h) {
    const meiaAlt = this.tilesNaAltura / 2;
    const meiaLarg = meiaAlt * (w / h);
    Object.assign(this.cam, { left: -meiaLarg, right: meiaLarg, top: meiaAlt, bottom: -meiaAlt });
    this.cam.updateProjectionMatrix();
  }

  // converte eixo da tela (x direita, y cima) em direção no chão (x,z do mundo)
  eixoParaMundo({ x, y }) {
    const a = this.anguloAtual;
    // "cima da tela" aponta do olho para o alvo, projetado no chão
    const fx = -Math.cos(a), fz = -Math.sin(a);
    const rx = -fz, rz = fx; // direita = frente girada -90°
    return { x: rx * x + fx * y, z: rz * x + fz * y };
  }

  atualizar(dt, alvo) {
    this.alvo.lerp(alvo, 1 - Math.exp(-dt * 8));
    // interpola o ângulo pelo caminho mais curto
    let d = this.anguloAlvo - this.anguloAtual;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.anguloAtual += d * (1 - Math.exp(-dt * 10));
    const dist = 30, alt = dist * Math.tan(Math.PI / 6); // elevação ~30° (dimétrico clássico)
    const off = new THREE.Vector3(Math.cos(this.anguloAtual) * dist, alt, Math.sin(this.anguloAtual) * dist);
    this.cam.position.copy(this.alvo).add(off);
    if (this.tremor > 0) {
      this.cam.position.x += (Math.random() - .5) * this.tremor;
      this.cam.position.y += (Math.random() - .5) * this.tremor;
      this.tremor = Math.max(0, this.tremor - dt * 1.5);
    }
    this.cam.lookAt(this.alvo);
  }
}
