// Entrada unificada. O resto do jogo só lê `input.eixo`, `input.segurando(acao)` e
// `input.apertou(acao)`; teclado e toque alimentam o mesmo estado.

const MAPA_TECLAS = {
  KeyW: 'cima', ArrowUp: 'cima',
  KeyS: 'baixo', ArrowDown: 'baixo',
  KeyA: 'esq', ArrowLeft: 'esq',
  KeyD: 'dir', ArrowRight: 'dir',
  Space: 'pulo',
  KeyJ: 'golpe',
  KeyK: 'identidade',
  KeyL: 'recurso',
  KeyQ: 'girarEsq',
  KeyE: 'girarDir',
  Digit1: 'hugo', Digit2: 'chico', Digit3: 'orlando',
  KeyF: 'surto',
  Escape: 'pausa',
};

export class Input {
  constructor() {
    this.ativas = new Set();
    this.novas = new Set();
    // eixo analógico vindo do toque; teclado sobrescreve quando há tecla
    this.eixoToque = { x: 0, y: 0 };
    addEventListener('keydown', (e) => {
      const a = MAPA_TECLAS[e.code];
      if (!a) return;
      e.preventDefault();
      if (!this.ativas.has(a)) this.novas.add(a);
      this.ativas.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = MAPA_TECLAS[e.code];
      if (a) this.ativas.delete(a);
    });
    addEventListener('blur', () => this.ativas.clear());
  }

  // usado pelos controles de toque
  pressionar(acao) { if (!this.ativas.has(acao)) this.novas.add(acao); this.ativas.add(acao); }
  soltar(acao) { this.ativas.delete(acao); }

  segurando(acao) { return this.ativas.has(acao); }
  apertou(acao) { return this.novas.has(acao); }

  // x: direita positiva, y: "para cima da tela" positiva. Magnitude <= 1.
  get eixo() {
    let x = (this.segurando('dir') ? 1 : 0) - (this.segurando('esq') ? 1 : 0);
    let y = (this.segurando('cima') ? 1 : 0) - (this.segurando('baixo') ? 1 : 0);
    if (x === 0 && y === 0) { x = this.eixoToque.x; y = this.eixoToque.y; }
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }

  // chamar no fim de cada quadro
  fimDoQuadro() { this.novas.clear(); }
}
