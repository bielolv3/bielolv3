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
| 29/09 | 3 | US$ 27,71 | Revisão (10 bugs), playtest com bot (8 salas ok), sala 8 nova, chefe rebalanceado; republicado v2 |
| 29/09 | 4 | US$ 46,52 | Relíquias (4×3), Ato II (salas 9–12, fauna, bioma Seiva), polimento (animação procedural, hit-stop, progresso salvo) |
| 29/09 | 4b | US$ 54,10 | Macacos redesenhados na escala dos tiles com 43 quadros × 2 direções × 2 formas; Guardião e Acólito animados; 12 salas ok no bot; republicado v3 |
| 29/09 | 5 | US$ 57,49 | Luz da sala nos sprites, 9 inimigos/fauna animados, 12 salas ok, resumo para o GPT; publicado v4 (final desta rodada) |
| 29/09 | 6 | US$ 62,66 | Vista de perfil dos macacos, Matriarca e Drone Construtor animados, luz mais forte nos sprites; 12 salas ok; publicado v5 |
| 30/09 | 7 | US$ 75,18 | Trilha musical procedural (5 faixas + jingles), todos os personagens polidos (rim light, silhuetas, idle, tonto, fauna animada, retratos novos); 12 salas ok; publicado v6. **Fim do orçamento.** |
