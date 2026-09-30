# Primordia: modelo 2 (resumo para continuar em outra conversa)

**Jogar:** https://claude.ai/artifact/A3hwdNjWcVuUuV6YmT9L3P
**Código:** repositório `bielolv3/bielolv3`, branch `claude/eloquent-euler-dhu4ub`, pasta `jogo-modelo-2/`

## O que é
É um jogo de ação e exploração que roda no navegador, ambientado no mundo do **Códice de Primordia** (Hills Co, cânone v2).
- **Visual:** estilo **HD-2D**. O mundo é feito de blocos 3D em grade com altura (tilemap) e visto por uma **câmera ortográfica isométrica** que gira de 90 em 90 graus (Q/E).
- **Personagens:** sprites em pixel art em pé no cenário, com 32 px por tile, na mesma escala dos blocos. Os macacos têm vista de frente, de costas e de perfil, e recebem a luz de cada sala.
- **Tecnologia:** Three.js + Vite. Toda a arte de blocos, inimigos e macacos é gerada por código.

## Conteúdo
- **Protagonistas:** Hugo (gorila), Chico (chimpanzé) e Orlando (orangotango). Troca com as teclas 1, 2 e 3.
  - Hugo: Pulverizar quebra selos; Guarda com parry.
  - Chico: pulo duplo; Tacar Banana, que derruba a Legião; Cacho de 3 bananas.
  - Orlando: planeio; Agarrão, que puxa e arremessa; Ferramenta, que aciona mecanismos Quanta.
- **Surto:** a barra enche com dano e fragmentos de memória. Dá 8 s de força dobrada, e o macaco perde a habilidade própria.
- **Relíquias:** a relíquia lê quem a segura, então cada uma tem um efeito diferente por macaco. São quatro: Coração Sísmico, Disco Solar, Semente Primordial e Pérola Abissal. R alterna e U usa.
- **Ato I, "Santuário de Embarque" (8 salas):** tutoriais de cada macaco, a sala 8 (um quebra-cabeça dos três) e a arena do chefe **Andador Quanta**.
- **Ato II, "Raiz da Matriarca" (salas 9 a 12):** bioma Seiva com fauna neutra, que só ataca se provocada: javali, planta-carnívora, sapo-bombástico, aranha e a tartaruga-menor, que serve de balsa. Termina no encontro com a **Matriarca**, que só luta se você pisar no que ela protege.
- **Inimigos:** os 8 do bestiário, da Legião Cinzenta e da Quanta, com números tirados do Códice.
- **Interface:**
  - HUD, telas de título, pausa, derrota e vitória;
  - progresso salvo, com Continuar e seleção de salas;
  - controles de toque para celular e gamepad;
  - trilha musical procedural (tema em ré dórico com variações por ato, camadas de tensão, chefe, Surto, vinhetas; tecla N) e efeitos sonoros.

## Decisões de design tomadas aqui (para manter coerência)
- **A memória é a física do mundo.** Selos, portas e alavancas são "escrita" Quanta. A banana desliga a Legião porque ela não tem protocolo para fruta.
- **Três métodos para lidar com a memória:** Hugo força, Chico testa e Orlando escuta. Por isso cada sala de ensino é de um macaco e as salas combinadas exigem os três.
- **O Surto é incorporação em miniatura**, a mesma coisa que foi feita com os Colossos: por isso o macaco perde justamente a habilidade própria.
- **A fauna não ataca primeiro**, porque é o veio Seiva sem administração. A Matriarca segue a mesma regra em tamanho colosso.
- **Invenção nossa, fora do Códice:** a origem da Pérola Abissal foi apresentada como "Colosso das Águas, veio Maré". Validar.

## Ferramentas de qualidade
- `npm run check`: confere que cada sala pode ser completada e aponta atalhos que pulam o quebra-cabeça.
- `node scripts/playtest.mjs`: um robô joga as 12 salas com a física real. Hoje todas passam.
- `referencias/folha-macacos.png`: todos os quadros de animação dos macacos.

## Pendências e ideias para o próximo passo
- Colossos restantes do Códice como atos futuros: Errante, Mênisco, Latente, Devorador, Coroado, Fundo, Serpente, Céu, Adormecido e Carcereiro.
- Faltam 8 das 12 relíquias previstas.
- Fauna opcional ainda não feita: lagarto-espião, arara-de-fogo, macaco selvagem e serpente-escama.
- Balanceamento feito só com o robô; falta alguém jogar de verdade (vida da Matriarca 60, do Andador 36).
- Detalhes do código: `ARQUITETURA.md`. Custos e fases: `CONTROLE.md`.
