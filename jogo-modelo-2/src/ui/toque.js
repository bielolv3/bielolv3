// Controles de toque: joystick à esquerda (-> input.eixoToque) e botões de ação à
// direita (-> input.pressionar/soltar). Só aparecem em dispositivo de toque.
const ROTULOS_ID = { hugo: 'Pulv.', chico: 'Banana', orlando: 'Agarrar' };
const ROTULOS_REC = { hugo: 'Guarda', chico: '—', orlando: 'Ferram.' };

export function ehToque() {
  return new URLSearchParams(location.search).has('toque')
    || matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function criarToque(jogo, raiz) {
  const { input } = jogo;
  const el = document.createElement('div');
  el.className = 'toque-camada hud-jogo';
  el.innerHTML = `
    <div class="joystick"><div class="base"><div class="pino"></div></div></div>
    <button class="bt girar girar-esq" data-acao="girarEsq" aria-label="Girar câmera">⟲</button>
    <button class="bt girar girar-dir" data-acao="girarDir" aria-label="Girar câmera">⟳</button>
    <div class="botoes-toque">
      <button class="bt surto" data-acao="surto">Surto</button>
      <button class="bt recurso" data-acao="recurso">Guarda</button>
      <button class="bt identidade" data-acao="identidade">Pulv.</button>
      <button class="bt golpe" data-acao="golpe">Golpe</button>
      <button class="bt pulo" data-acao="pulo">Pulo</button>
    </div>`;
  raiz.appendChild(el);
  if (ehToque()) document.body.classList.add('toque');
  addEventListener('touchstart', () => document.body.classList.add('toque'), { once: true, passive: true });

  // botões: cada dedo segura a ação enquanto estiver no botão
  for (const b of el.querySelectorAll('[data-acao]')) {
    const a = b.dataset.acao;
    const soltar = () => { input.soltar(a); b.classList.remove('apertado'); };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch {}
      input.pressionar(a); b.classList.add('apertado');
      navigator.vibrate?.(8);
    });
    b.addEventListener('pointerup', soltar);
    b.addEventListener('pointercancel', soltar);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // joystick flutuante: a base nasce onde o dedo tocou
  const zona = el.querySelector('.joystick'), base = zona.querySelector('.base'), pino = zona.querySelector('.pino');
  const RAIO = 50;
  let dedo = null, cx = 0, cy = 0;
  const repouso = () => { base.style.left = '100px'; base.style.top = 'calc(100% - 110px)'; };
  zona.addEventListener('pointerdown', (e) => {
    if (dedo !== null) return;
    e.preventDefault();
    dedo = e.pointerId;
    try { zona.setPointerCapture(e.pointerId); } catch {}
    const r = zona.getBoundingClientRect();
    cx = e.clientX; cy = e.clientY;
    base.style.left = `${cx - r.left}px`; base.style.top = `${cy - r.top}px`;
    zona.classList.add('ativo');
  });
  zona.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dedo) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const m = Math.hypot(dx, dy);
    if (m > RAIO) { dx *= RAIO / m; dy *= RAIO / m; }
    pino.style.transform = `translate(${dx}px,${dy}px)`;
    // zona morta pequena; y da tela cresce para baixo
    const f = m < 8 ? 0 : 1;
    input.eixoToque.x = f * dx / RAIO;
    input.eixoToque.y = f * -dy / RAIO;
  });
  const fim = (e) => {
    if (e.pointerId !== dedo) return;
    dedo = null;
    input.eixoToque.x = input.eixoToque.y = 0;
    pino.style.transform = '';
    zona.classList.remove('ativo');
    repouso();
  };
  zona.addEventListener('pointerup', fim);
  zona.addEventListener('pointercancel', fim);

  const btId = el.querySelector('.identidade'), btRec = el.querySelector('.recurso'), btSurto = el.querySelector('.surto');
  let ultimo = '';
  return {
    atualizar(recursos) {
      const j = jogo.jogador;
      if (!j) return;
      if (j.atual !== ultimo) {
        ultimo = j.atual;
        btId.textContent = ROTULOS_ID[j.atual] ?? 'Ident.';
        btRec.textContent = ROTULOS_REC[j.atual] ?? 'Recurso';
      }
      btSurto.classList.toggle('pronto', recursos.carga >= 1 && !recursos.ativo);
    },
  };
}
