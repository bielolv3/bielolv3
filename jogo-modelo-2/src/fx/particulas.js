import * as THREE from 'three';

// Pool de partículas quadradas (pixel) num único THREE.Points.
// emitir({ pos, n, cor, vel, espalha, subir, vida, tam, grav, arrasto })
export class Particulas {
  constructor(max = 600, aditivo = false) {
    this.max = max;
    this.vivas = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.a = new Float32Array(max);        // alfa atual
    this.s = new Float32Array(max);        // tamanho (tiles)
    this.vida = new Float32Array(max);
    this.vidaMax = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.arrasto = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr(this.p, 3));
    g.setAttribute('cor', attr(this.c, 3));
    g.setAttribute('alfa', attr(this.a, 1));
    g.setAttribute('tam', attr(this.s, 1));
    g.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uEscala: { value: 50 } },
      vertexShader: /* glsl */`
        attribute vec3 cor; attribute float alfa; attribute float tam; uniform float uEscala;
        varying vec3 vCor; varying float vAlfa;
        void main() {
          vCor = cor; vAlfa = alfa;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          mv.z += 0.8;   // um pouco à frente, para não entrar no chão
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.0, floor(tam * uEscala + 0.5));
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCor; varying float vAlfa;
        void main() { if (vAlfa < 0.01) discard; gl_FragColor = vec4(vCor, vAlfa);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pontos = new THREE.Points(g, this.material);
    this.pontos.frustumCulled = false;
    this.pontos.renderOrder = 10;
  }

  emitir({ pos, n = 10, cor = 0xffffff, cor2 = null, vel = 3, espalha = 0.2, subir = 1, vida = 0.5, tam = 0.08, grav = 8, arrasto = 2, dir = null }) {
    const c1 = new THREE.Color(cor), c2 = new THREE.Color(cor2 ?? cor), cc = new THREE.Color();
    for (let k = 0; k < n; k++) {
      if (this.vivas >= this.max) return;
      const i = this.vivas++;
      const ang = Math.random() * Math.PI * 2, el = Math.random();
      this.p[i * 3] = pos.x + (Math.random() - 0.5) * espalha * 2;
      this.p[i * 3 + 1] = pos.y + (Math.random() - 0.5) * espalha;
      this.p[i * 3 + 2] = pos.z + (Math.random() - 0.5) * espalha * 2;
      const vv = vel * (0.4 + Math.random() * 0.6);
      let vx = Math.cos(ang) * vv * (1 - el * 0.5), vz = Math.sin(ang) * vv * (1 - el * 0.5);
      if (dir) { vx = vx * 0.4 + dir.x * vv; vz = vz * 0.4 + dir.z * vv; }
      this.v[i * 3] = vx; this.v[i * 3 + 1] = subir * vv * (0.3 + el); this.v[i * 3 + 2] = vz;
      cc.copy(c1).lerp(c2, Math.random());
      this.c[i * 3] = cc.r; this.c[i * 3 + 1] = cc.g; this.c[i * 3 + 2] = cc.b;
      this.s[i] = tam * (0.6 + Math.random() * 0.8);
      this.vida[i] = this.vidaMax[i] = vida * (0.6 + Math.random() * 0.6);
      this.grav[i] = grav; this.arrasto[i] = arrasto; this.a[i] = 1;
    }
  }

  // move a última partícula viva para o lugar da que morreu
  matar(i) {
    const u = --this.vivas;
    if (i === u) return;
    for (const arr of [this.p, this.v, this.c]) { arr[i * 3] = arr[u * 3]; arr[i * 3 + 1] = arr[u * 3 + 1]; arr[i * 3 + 2] = arr[u * 3 + 2]; }
    for (const arr of [this.a, this.s, this.vida, this.vidaMax, this.grav, this.arrasto]) arr[i] = arr[u];
  }

  atualizar(dt) {
    for (let i = this.vivas - 1; i >= 0; i--) {
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) { this.matar(i); continue; }
      const k = Math.exp(-this.arrasto[i] * dt);
      this.v[i * 3] *= k; this.v[i * 3 + 2] *= k;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * k - this.grav[i] * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const t = this.vida[i] / this.vidaMax[i];
      this.a[i] = Math.min(1, t * 2.5);
    }
    const g = this.pontos.geometry;
    g.setDrawRange(0, this.vivas);
    for (const nome of ['position', 'cor', 'alfa', 'tam']) g.attributes[nome].needsUpdate = true;
  }

  limpar() { this.vivas = 0; this.pontos.geometry.setDrawRange(0, 0); }
}
