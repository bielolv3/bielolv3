import * as THREE from 'three';
import { TRANSICAO } from '../core/jogo.js';

// Camada DOM por cima do canvas: vinheta do Surto (pulsando), flash de dano e a
// íris preta da transição entre salas. Barata em qualquer GPU, independente do
// pós-processamento. Fica abaixo do #hud (o cartão com o nome da sala aparece sobre o preto).
const _p = new THREE.Vector3();
const suave = (k) => k * k * (3 - 2 * k);

export function criarTela(jogo) {
  const pai = jogo.renderer.domElement.parentNode || document.body;
  const mk = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;' + css; pai.appendChild(d); return d; };
  const surto = mk('background:radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(70,6,2,.55) 72%, rgba(20,2,0,.92) 100%);mix-blend-mode:multiply;');
  const brasa = mk('background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(192,74,44,.35) 100%);');
  const flash = mk('');
  const iris = mk('opacity:1;display:none;');
  let vs = 0, alvoSurto = 0, fl = 0, t = 0, irisAberta = true;

  // raio da íris (0 = tudo preto, 1 = aberta) conforme a fase da transição
  function aberturaIris() {
    const tr = jogo.transicao;
    if (!tr) return 1;
    if (tr.fase === 'fechar') return 1 - suave(Math.min(1, tr.t / TRANSICAO.fechar));
    if (tr.fase === 'preto') return 0;
    return suave(Math.min(1, tr.t / TRANSICAO.abrir));
  }

  function desenharIris() {
    const k = aberturaIris();
    if (k >= 1) { if (!irisAberta) { iris.style.display = 'none'; irisAberta = true; } return; }
    irisAberta = false;
    iris.style.display = 'block';
    const w = pai.clientWidth || innerWidth, h = pai.clientHeight || innerHeight;
    // centro no jogador (na tela)
    let cx = w / 2, cy = h / 2;
    const j = jogo.jogador;
    if (j) {
      _p.copy(j.pos); _p.y += 0.7;
      _p.project(jogo.camera.cam);
      if (Math.abs(_p.x) <= 1 && Math.abs(_p.y) <= 1) { cx = (_p.x + 1) / 2 * w; cy = (1 - _p.y) / 2 * h; }
    }
    const rMax = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 4;
    const r = Math.max(0, k * rMax);
    iris.style.background = r < 1 ? '#0c0b09'
      : `radial-gradient(circle at ${cx.toFixed(0)}px ${cy.toFixed(0)}px, transparent ${r.toFixed(1)}px, #0c0b09 ${(r + 1.5).toFixed(1)}px)`;
  }

  return {
    set surto(v) { alvoSurto = v; },
    piscar(cor = '#c04a2c', forca = 0.35) {
      flash.style.background = `radial-gradient(ellipse at center, ${cor}44 20%, ${cor} 110%)`;
      fl = Math.max(fl, forca);
    },
    atualizar(dt) {
      t += dt;
      vs += (alvoSurto - vs) * (1 - Math.exp(-dt * 5));
      const pulso = 0.85 + 0.15 * Math.sin(t * 6);
      surto.style.opacity = (vs * pulso).toFixed(3);
      brasa.style.opacity = (vs * (0.6 + 0.4 * Math.sin(t * 6))).toFixed(3);
      fl = Math.max(0, fl - dt * 3);
      flash.style.opacity = fl.toFixed(3);
      desenharIris();
    },
    desenharIris,
  };
}
