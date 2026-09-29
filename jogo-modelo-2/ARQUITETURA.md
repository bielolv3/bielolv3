# Primordia — modelo 2 (isométrico / câmera ortográfica)

Jogo de ação e exploração no navegador, feito com **Three.js + Vite**. O mundo é um
**tilemap 3D** de blocos com altura, visto por uma **câmera ortográfica em ângulo
isométrico** que gira em passos de 90° (Q/E). Os personagens são **sprites em pixel
art de pé no cenário** (billboards), no estilo "HD-2D".

A fonte de verdade da ficção é o **Códice de Primordia** (`referencias/`, com as pranchas
e os sprites originais). Os números de inimigos e habilidades saem de lá.

## Rodar

```bash
npm install
npm run dev          # servidor com recarga
npm run build        # gera dist/
node scripts/screenshot.mjs saida.png [sala] '[["tecla","KeyD",600],["eval","jogo.jogador.pos"]]'
```

O `screenshot.mjs` lê o build de `$DIST` (padrão `dist/`). Quando vários agentes
trabalham ao mesmo tempo, cada um usa o próprio: `npx vite build --outDir /tmp/x && DIST=/tmp/x node scripts/screenshot.mjs ...`

## Controles

| Ação | Teclado |
|---|---|
| Andar | WASD / setas (relativo à câmera) |
| Pular | Espaço (Chico: pulo duplo; Orlando: segurar = planar) |
| Golpe | J |
| Identidade | K (Hugo: Pulverizar · Chico: Tacar Banana · Orlando: Agarrão) |
| Recurso | L (Hugo: Guarda · Chico: — · Orlando: Ferramenta/interagir) |
| Trocar macaco | 1 Hugo · 2 Chico · 3 Orlando |
| Surto | F (quando a barra estiver cheia) |
| Girar câmera | Q / E |
| Pausa | Esc |

## Mapa do código

```
src/
  main.js                 cria o Jogo
  core/
    jogo.js               loop, cena, lista de entidades, troca de sala, sistemas
    input.js              teclado + toque -> ações ('pulo', 'golpe', ...) e eixo
    camera.js             câmera ortográfica isométrica girável, tremor
    eventos.js            barramento de eventos (dano, morte, golpe, troca, sala, vitoria, derrota, coleta, surto, pausa)
  world/
    tiles.js              legenda dos caracteres de mapa (chão e coisas)
    tilemap.js            parse da sala, alturaEm(x,z), bloqueios dinâmicos, malha
    fisica.js             gravidade, degrau, colisão contra alturas
    ambiente.js           luz, fundo, névoa
  entities/
    entidade.js           classe base (pos, vel, vida, sprite billboard, dano)
    jogador.js            os três macacos (stats em MACACOS)
    inimigos.js           Legião Cinzenta e Quanta
    objetos.js            saída, cacho, selo, alavanca, porta, caixa, memória
    registro.js           letra do mapa -> classe
  ui/                     HUD, menus, controles de toque, áudio
  levels/
    index.js              ordem das salas
    salaNN.js             { id, nome, chao: [...], coisas: [...] }
```

### Contratos

- **Coordenadas:** o tile (i, j) ocupa [i, i+1) × [j, j+1) no plano XZ. Y é altura, e 1 tile = 1 unidade.
- **Entidade:** implementa `atualizar(dt)`. Chama `this.fisica(dt)` se tiver corpo e `this.sincronizar(dt)` no fim. `time` pode ser `'jogador' | 'inimigo' | 'neutro'`. Para sair do jogo: `removido = true`.
- **Construtor do registro:** `new Classe(jogo, x, z, { letra, i, j })`.
- **Sistemas:** `jogo.adicionarSistema({ atualizar(dt, jogo), aoCarregarSala(jogo, sala) })`. Ficam fora do ciclo de vida das salas (HUD, áudio, efeitos).
- **Habilidades:** `jogo.habilidades.atualizarJogador(jogador, dt)` é chamado todo quadro, antes da física do jogador.
- **Salas:** `chao` e `coisas` são grades de mesmo tamanho. Espaço em `coisas` = nada.

## Regras para quem mexe no código

1. Cada agente só edita os arquivos da sua frente (ver `CONTROLE.md`). Em arquivo compartilhado (`registro.js`, `levels/index.js`, `tiles.js`), só **acrescenta** linhas.
2. Sem dependências novas sem necessidade real. Arte é gerada por código (canvas) ou fica em `public/`.
3. Antes de terminar: `npx vite build` sem erro e um screenshot conferido.
4. Português nos nomes e comentários, como no resto do código.

## Macacos quadro a quadro

Hugo, Chico e Orlando (normal e Surto) são desenhados por código em `src/fx/macacos.js`, na
mesma densidade dos tiles (32 px = 1 unidade), com contorno de tinta de 1 px. Cada quadro sai de
um esqueleto simples (pose -> tronco, cabeça, braços e pernas com IK de dois ossos) e vai para
um atlas `CanvasTexture` (células 80×64, pés em x=32): vistas 3/4 de frente, 3/4 de costas e
perfil (6 blocos = 3 vistas × luz da esquerda/direita); a esquerda da tela é espelho no shader.
A vista sai da direção na tela: eixo vertical dominante → frente/costas, horizontal → perfil, com
histerese de 1,35× para não piscar na diagonal. `preaquecerMacacos` gera um bloco por vez em segundo plano.
Animações: `parado, andar, correr, pulo, queda, pouso, golpe, identidade, dano, guarda,
segurar, planar, rugido`. A máquina de estados fica em `Jogador.escolherQuadro` (vista pela
direção relativa à câmera, luz pelo lado do sol na tela). Com `this.quadros = true` a
deformação procedural de `Entidade.animarSprite` só tempera (squash leve, sem bob).
Inimigos e fauna também têm quadros (`ANIMADOS` / `animarInimigo` em `fx/sprites.js`): Guardião,
Acólito, Sentinela, Bruto, Drone, Torre, Andador, Javali, Sapo, Aranha e Planta (andar/parado,
preparo, golpe logo após o preparo, investida, ar).
Luz nos sprites: `Entidade.iluminar` (chamado em `sincronizar`) multiplica o sprite pelo uniform
`uLuz` = sol ou sombra do bioma (`jogo.luzSprites`, montado em `world/ambiente.js`; sombra = parede
alta entre a entidade e o sol, 3 amostras no tilemap) + PointLights da sala com a mesma queda.
Vem antes do flash branco e da cor fixa (silhueta); `semLuz = true` desliga (vaga-lume).
Conferência: `node scripts/exportar-macacos.mjs` gera `referencias/folha-macacos.png` e os
atlas em `referencias/macacos/`. Os PNGs de `public/sprites/` seguem como retratos do HUD.

## Relíquias

"Relíquia não é objeto encantado. É memória tão densa que virou coisa." (Códice, Livro VIII)
Cada relíquia é um fragmento de Colosso e **lê quem a segura**: o efeito depende do macaco
ativo na hora do uso. Código: `src/entities/reliquias.js` (catálogo, modelos 3D, pedestal,
efeitos, `SistemaReliquias`) e `src/ui/reliquias.js` (HUD e cerimônia, instalado por `hud.js`).

**Controles:** R alterna a relíquia ativa (ação `reliquia`) · U usa (ação `usarReliquia`), com
recarga por relíquia. No toque: tocar no ícone da relíquia usa; tocar nas miniaturas alterna.

**Colocar numa sala:** letra `Y` na camada `coisas` (pedestal com brilho) + campo da sala
`reliquia: 'semente'`. Com mais de um `Y`, use lista (`reliquia: ['semente', 'perola']`), na
ordem de leitura da grade. Ao pegar: cerimônia curta (câmera treme, macaco para ~1 s, nome em
destaque) e evento `reliquia` {id, nome, origem}. O pedestal fica vazio se a relíquia já foi pega.

**Progresso:** `jogo.progresso.reliquias` (ids, na ordem em que foram pegos) e
`jogo.progresso.reliquiaAtiva`; persistem entre salas (e no save de `jogo.salvarProgresso`).
`jogo.reliquias` é o sistema (`estado()`, `ganhar(id)`, `recarga[id]`).

| id | Relíquia (origem) | Recarga | Hugo | Chico | Orlando |
|---|---|---|---|---|---|
| `sismico` | Coração Sísmico (Errante, veio Pedra) | 6 s | Onda sísmica r=5: 2 de dano, derruba/atordoa 2 s, **quebra selos** e caixas | Pulo sísmico triplo: 3 saltos altos (~1,9) com impacto r=2,4 | O que segura (caixa/inimigo) vira bloco de pedra que cai no tile da frente, esmaga (3–5) e fica como degrau +1 por 14 s (30 s se era caixa) |
| `disco` | Disco Solar (Mênisco, Hora e Luz) | 4 s | Escudo solar frontal 3,5 s: anula dano pela frente e **devolve projéteis** ao atirador | Disco que ricocheteia entre até 4 inimigos (1,5 cada) e volta | Raio de luz (12 tiles): aciona alavancas/`acionavel` de longe, desliga máquina Quanta, ofusca; chama `e.aoLuz(jogador)` se existir; abre portas se a sala tiver `portasDeLuz: true` |
| `semente` | Semente Primordial (Matriarca, Seiva) | 7 s | Raízes r=4,5 prendem inimigos no lugar 3,5 s (chefe 1,5 s) | Broto no tile da frente por 10 s: coluna +1,5 para escalar, ou **ponte** no nível do Chico sobre abismo | Bosque r=2,6 por 8 s: cura 0,5 a cada 1,2 s |
| `perola` | Pérola Abissal (Colosso das Águas, Maré) | 6 s | Vagalhão r=4,5: empurra forte (joga no abismo), apaga tiros | Correnteza: desliza ~5 tiles em 0,4 s sem cair, invulnerável, derruba quem passa | Bolha que absorve os próximos 3 golpes (10 s) |

Distribuição atual: **Disco Solar** na sala04 (atrás do selo da memória) e **Coração Sísmico** na
sala08 (no alto da muralha que o Chico sobe). **Semente** e **Pérola** estão livres para as salas
novas (frente Conteúdo): basta `Y` + `reliquia: 'semente'` / `'perola'`.

Eventos novos: `reliquia` {id, nome, origem} · `reliquiaTroca` {id} · `reliquiaUsada` {id, macaco, efeito}
· `reliquiaFalha` {id, motivo: 'nenhuma'|'recarga'|'lugar'} · `reflexo` {alvo, centro} (projétil devolvido).
Para criar outra relíquia: entrada em `RELIQUIAS`, um ramo em `modeloReliquia(id)`, um ícone 12×12
em `ICONES` (ui/reliquias.js) e três métodos `<id>_hugo/_chico/_orlando(j)` no `SistemaReliquias`
(devolver `false` = não deu para usar ali, sem gastar a recarga).
