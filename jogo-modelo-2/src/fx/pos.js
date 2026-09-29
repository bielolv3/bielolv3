import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Pós-processamento: bloom discreto (só o que brilha de verdade: Quanta, chamas),
// desfoque de miniatura em cima/embaixo (tilt-shift HD-2D), vinheta, vinheta do
// Surto e flash de dano. Liga em jogo.posProcesso; o loop chama render(dt).

const Final = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uVinheta: { value: 0.32 },
    uSurto: { value: 0 },
    uFlash: { value: 0 },
    uFlashCor: { value: new THREE.Color(0xc04a2c) },
    uTilt: { value: 1 },
    uTempo: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uVinheta, uSurto, uFlash, uTilt, uTempo; uniform vec3 uFlashCor;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // tilt-shift: borra de leve as faixas de cima e de baixo
      float b = smoothstep(0.28, 0.5, abs(vUv.y - 0.5)) * uTilt;
      if (b > 0.02) {
        vec2 p = b * 1.6 / uRes;
        vec4 s = c * 2.0;
        s += texture2D(tDiffuse, vUv + vec2(p.x, 0.0)) + texture2D(tDiffuse, vUv - vec2(p.x, 0.0));
        s += texture2D(tDiffuse, vUv + vec2(0.0, p.y)) + texture2D(tDiffuse, vUv - vec2(0.0, p.y));
        s += texture2D(tDiffuse, vUv + p) + texture2D(tDiffuse, vUv - p);
        s += texture2D(tDiffuse, vUv + vec2(p.x, -p.y)) + texture2D(tDiffuse, vUv + vec2(-p.x, p.y));
        c = s / 10.0;
      }
      vec2 d2 = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float d = length(d2);
      c.rgb *= 1.0 - uVinheta * smoothstep(0.45, 1.1, d);
      // Surto: borda escura/vermelha que pulsa
      float pulso = 0.85 + 0.15 * sin(uTempo * 6.0);
      float vs = smoothstep(0.35, 1.0, d) * uSurto * pulso;
      c.rgb = mix(c.rgb, vec3(0.16, 0.012, 0.004), vs * 0.85);
      c.rgb += vec3(0.05, 0.0, 0.0) * uSurto * smoothstep(0.2, 0.9, d);
      // flash (dano no jogador etc.)
      c.rgb = mix(c.rgb, uFlashCor, uFlash * (0.25 + 0.75 * smoothstep(0.2, 1.0, d)));
      gl_FragColor = c;
    }`,
};

export function criarPosProcesso(jogo) {
  const r = jogo.renderer;
  const composer = new EffectComposer(r);
  const passCena = new RenderPass(new THREE.Scene(), jogo.camera.cam);
  const tam = r.getSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(new THREE.Vector2(tam.x / 2, tam.y / 2), 0.45, 0.35, 0.82);
  const final = new ShaderPass(Final);
  composer.addPass(passCena);
  composer.addPass(bloom);
  composer.addPass(final);
  composer.addPass(new OutputPass());

  const redimensionar = () => {
    composer.setPixelRatio(r.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    final.uniforms.uRes.value.set(innerWidth, innerHeight);
  };
  addEventListener('resize', redimensionar);
  redimensionar();

  const u = final.uniforms;
  return {
    composer, bloom, final,
    surto: 0,        // alvo 0..1 da vinheta do surto
    flash: 0,
    ativo: true,
    render(dt = 1 / 60) {
      if (!this.ativo) { r.render(jogo.cena, jogo.camera.cam); return; }
      passCena.scene = jogo.cena;
      passCena.camera = jogo.camera.cam;
      u.uTempo.value += dt;
      u.uSurto.value += (this.surto - u.uSurto.value) * (1 - Math.exp(-dt * 5));
      this.flash = Math.max(0, this.flash - dt * 3);
      u.uFlash.value = this.flash;
      composer.render(dt);
    },
    piscar(cor = 0xc04a2c, forca = 0.35) { u.uFlashCor.value.set(cor); this.flash = Math.max(this.flash, forca); },
  };
}
