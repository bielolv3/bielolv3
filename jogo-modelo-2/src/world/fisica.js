// Física de corpo simples sobre o tilemap: cilindro (raio) com pés em pos.y.
export const GRAVIDADE = 28;
export const DEGRAU = 0.55;   // sobe sozinho até meio tile

// alturas do chão nos 4 cantos do círculo (aprox. por caixa)
function alturaMaxSob(mapa, x, z, r) {
  return Math.max(
    mapa.alturaEm(x - r, z - r), mapa.alturaEm(x + r, z - r),
    mapa.alturaEm(x - r, z + r), mapa.alturaEm(x + r, z + r),
  );
}

// move `corpo` ({pos, vel, raio, noChao}) um passo, resolvendo colisão eixo a eixo
export function moverCorpo(mapa, corpo, dt) {
  const { pos, vel, raio } = corpo;
  vel.y -= GRAVIDADE * dt;

  // só a borda da frente do movimento bloqueia: quem ficou encostado/entalado num
  // bloco (beirada, selo reerguido, caixa) consegue sair andando para longe dele
  for (const eixo of ['x', 'z']) {
    const passo = vel[eixo] * dt;
    if (!passo) continue;
    const antes = pos[eixo];
    pos[eixo] += passo;
    const s = passo > 0 ? raio : -raio;
    const chao = eixo === 'x'
      ? Math.max(mapa.alturaEm(pos.x + s, pos.z - raio), mapa.alturaEm(pos.x + s, pos.z + raio))
      : Math.max(mapa.alturaEm(pos.x - raio, pos.z + s), mapa.alturaEm(pos.x + raio, pos.z + s));
    if (chao > pos.y + DEGRAU) { pos[eixo] = antes; vel[eixo] = 0; }
  }

  pos.y += vel.y * dt;
  const chao = alturaMaxSob(mapa, pos.x, pos.z, raio * 0.6);
  corpo.noChao = false;
  if (pos.y <= chao) {
    // degrau: se subiu um pouco, acompanha suavemente
    pos.y = chao;
    if (vel.y < 0) vel.y = 0;
    corpo.noChao = true;
  }
  corpo.caiu = pos.y < -3;
}
