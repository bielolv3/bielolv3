// Barramento simples: sistemas (HUD, áudio, partículas) escutam sem acoplar.
// Eventos emitidos hoje: dano, morte, golpe, troca, derrota, vitoria, sala, coleta, surto
export class Eventos {
  constructor() { this.ouvintes = new Map(); }
  on(nome, fn) {
    if (!this.ouvintes.has(nome)) this.ouvintes.set(nome, new Set());
    this.ouvintes.get(nome).add(fn);
    return () => this.ouvintes.get(nome).delete(fn);
  }
  emitir(nome, dados) { this.ouvintes.get(nome)?.forEach((fn) => fn(dados)); }
  limpar() { this.ouvintes.clear(); }
}
