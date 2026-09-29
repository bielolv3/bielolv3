import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Pós-processamento: bloom discreto (só o que brilha de verdade: Quanta, chamas),
// desfoque de miniatura em cima/embaixo (tilt-shift HD-2D) e vinheta.
// Liga em jogo.posProcesso; o loop chama render(dt). Em renderizador por software
// (SwiftShader/llvmpipe) começa desligado, por custo; `?pos=1` na URL força ligar.
// Surto e flash de dano ficam numa camada DOM (tela.js), que funciona sempre.

const Final = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uVinheta: { value: 0.32 },
    uTilt: { value: 1 },
    uTempo: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uVinheta, uTilt, uTempo;
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
  const forcar = new URLSearchParams(location.search).get('pos');
  return {
    composer, bloom, final,
    ativo: forcar ? forcar !== '0' : !renderizadorSoftware(r),
    render(dt = 1 / 60) {
      if (!this.ativo) { r.render(jogo.cena, jogo.camera.cam); return; }
      passCena.scene = jogo.cena;
      passCena.camera = jogo.camera.cam;
      u.uTempo.value += dt;
      composer.render(dt);
    },
  };
}

export function renderizadorSoftware(r) {
  try {
    const gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const nome = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return /swiftshader|llvmpipe|software/i.test(nome);
  } catch { return false; }
}
