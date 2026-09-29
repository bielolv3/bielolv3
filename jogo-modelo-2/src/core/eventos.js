// Barramento simples: sistemas (HUD, áudio, partículas) escutam sem acoplar.
// Eventos: dano, morte, golpe, troca, derrota, vitoria, sala, pausa, coleta, surto,
// identidade, recurso, porta, selo, parry, alerta, cura, derrapa, quebra, empurrao,
// investida, teleporte, explosao, chefe
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
