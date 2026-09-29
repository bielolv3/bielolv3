// Controle (Gamepad API, layout padrão): alimenta o mesmo Input do teclado.
const BOTOES = {
  0: 'pulo',        // A
  2: 'golpe',       // X
  3: 'identidade',  // Y
  1: 'recurso',     // B
  7: 'surto',       // RT
  6: 'surto',       // LT
  4: 'girarEsq',    // LB
  5: 'girarDir',    // RB
  9: 'pausa',       // Start
  14: 'hugo',       // direcional esq
  12: 'chico',      // direcional cima
  15: 'orlando',    // direcional dir
};
const ZONA_MORTA = 0.2;

export function criarGamepad(jogo, { aoPrincipal } = {}) {
  const { input } = jogo;
  const antes = new Map();   // "idx:botão" -> apertado
  let usandoEixo = false;

  return {
    atualizar(emTela) {
      const pads = navigator.getGamepads?.() ?? [];
      for (const p of pads) {
        if (!p) continue;
        p.buttons.forEach((b, k) => {
          const chave = `${p.index}:${k}`, agora = b.pressed, eraa = antes.get(chave);
          if (agora === !!eraa) return;
          antes.set(chave, agora);
          // em tela cheia: A ou Start acionam o botão principal
          if (emTela && agora && (k === 0 || (k === 9 && emTela !== 'pausa'))) { aoPrincipal?.(); return; }
          const a = BOTOES[k];
          if (!a) return;
          if (agora) input.pressionar(a); else input.soltar(a);
        });
        let x = p.axes[0] ?? 0, y = p.axes[1] ?? 0;
        if (Math.hypot(x, y) < ZONA_MORTA) { x = 0; y = 0; }
        if (x || y) { input.eixoToque.x = x; input.eixoToque.y = -y; usandoEixo = true; }
        else if (usandoEixo) { input.eixoToque.x = input.eixoToque.y = 0; usandoEixo = false; }
      }
    },
  };
}
