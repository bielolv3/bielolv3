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
