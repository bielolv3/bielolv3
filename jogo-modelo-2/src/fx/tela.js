// Camada DOM por cima do canvas: vinheta do Surto (pulsando) e flash de dano.
// Barata em qualquer GPU, independente do pós-processamento.
export function criarTela(jogo) {
  const pai = jogo.renderer.domElement.parentNode || document.body;
  const mk = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;' + css; pai.appendChild(d); return d; };
  const surto = mk('background:radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(70,6,2,.55) 72%, rgba(20,2,0,.92) 100%);mix-blend-mode:multiply;');
  const brasa = mk('background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(192,74,44,.35) 100%);');
  const flash = mk('');
  let vs = 0, alvoSurto = 0, fl = 0, t = 0;
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
    },
  };
}
