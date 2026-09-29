# Controle de gasto e frentes

Orçamento: **US$ 79**. O custo real vem da própria sessão (`get_session → usage.cost_usd`)
e é anotado aqui a cada fase. Parada para fechamento: **US$ 70** (sobram ~US$ 9 de reserva).

## Plano

| Fase | Teto acumulado | Frentes |
|---|---|---|
| 1. Base | US$ 5 | Motor, câmera iso, tilemap, jogador, sala 1 (feito pela sessão principal) |
| 2. Núcleo em paralelo | US$ 30 | A: combate e inimigos · B: visual e mundo · C: interface, som e salas |
| 3. Integração e revisão | US$ 42 | Juntar, caçar bugs, testar jogabilidade ponta a ponta |
| 4. Expansão | US$ 62 | Mais salas, chefe (Andador Quanta), Colosso de fundo, polimento |
| 5. Fechamento | US$ 70 | Build final publicado, resumo para levar à conversa do GPT |

## Frentes (quem pode editar o quê)

| Frente | Arquivos |
|---|---|
| A · Combate | `src/entities/habilidades.js`, `inimigos.js`, `objetos.js`, `projeteis.js`, `registro.js` |
| B · Visual | `src/world/*` (exceto `tiles.js`: só acrescenta), `src/core/camera.js`, `src/fx/*`, `public/sprites/` (novos) |
| C · Interface e salas | `src/ui/*`, `src/audio/*`, `src/levels/*`, `index.html`, `src/main.js` |
| Principal | `src/core/jogo.js`, `input.js`, `jogador.js`, integração, commits |

## Publicação

Jogo publicado em https://claude.ai/artifact/A3hwdNjWcVuUuV6YmT9L3P (privado; compartilhar pelo menu Share).
Para republicar: `npm run build && node scripts/pagina-artifact.mjs` e publicar `dist/artifact.html` com `assets/` e `sprites/`.

## Registro

| Quando | Fase | Custo acumulado | Observação |
|---|---|---|---|
| 29/09 | 0 | US$ 0,96 | Leitura do Códice, escolha do estilo |
| 29/09 | 1 | ~US$ 2 | Esqueleto rodando: sala 1, Hugo andando/pulando, Guardião |
| 29/09 | 2 | US$ 17,45 | Frentes A, B, C integradas; 7 salas; publicado: https://claude.ai/artifact/A3hwdNjWcVuUuV6YmT9L3P |
