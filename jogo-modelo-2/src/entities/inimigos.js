import { Entidade } from './entidade.js';

// Guardião Cinzento (Códice, Livro IX): vida 2 a 4, dano 1.
// Patrulha o posto; persegue quem entra em 5 unidades de raio; volta quando perde.
export class Guardiao extends Entidade {
  constructor(jogo, x, z) {
    super(jogo, x, z, { raio: 0.35, vida: 3, time: 'inimigo' });
    this.definirPlaceholder(0x8b94a0);
    this.posto = this.pos.clone();
    this.recargaAtaque = 0;
  }

  atualizar(dt) {
    const alvo = this.jogo.jogador;
    this.recargaAtaque = Math.max(0, this.recargaAtaque - dt);
    let vx = 0, vz = 0;
    if (this.atordoado <= 0) {
      const dAlvo = this.distancia(alvo);
      const dPosto = Math.hypot(this.pos.x - this.posto.x, this.pos.z - this.posto.z);
      let destino = null;
      if (dAlvo < 5 && dPosto < 7) destino = alvo.pos;
      else if (dPosto > 0.3) destino = this.posto;
      if (destino) {
        const dx = destino.x - this.pos.x, dz = destino.z - this.pos.z, m = Math.hypot(dx, dz) || 1;
        vx = dx / m * 2.2; vz = dz / m * 2.2;
      }
      if (dAlvo < this.raio + alvo.raio + 0.25 && this.recargaAtaque <= 0) {
        alvo.receberDano(1, this, { empurra: 5 });
        this.recargaAtaque = 1;
      }
    }
    const k = 1 - Math.exp(-dt * 8);
    this.vel.x += (vx - this.vel.x) * k;
    this.vel.z += (vz - this.vel.z) * k;
    this.fisica(dt);
    if (this.caiu) this.morrer();
    this.sincronizar(dt);
  }
}
