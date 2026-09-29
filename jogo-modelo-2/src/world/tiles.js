// Legenda dos mapas. Cada sala é uma grade de texto (ver src/levels/).
// Camada `chao`: um caractere por tile define o tipo e a altura do bloco.
// Camada `coisas`: entidades posicionadas sobre o tile (mesma grade).

// altura em unidades de tile; `solido` = bloqueia passagem mesmo se der para subir
export const TIPOS_CHAO = {
  '.': { nome: 'pedra', altura: 0 },
  ',': { nome: 'musgo', altura: 0 },
  '1': { nome: 'pedra', altura: 0.5 },
  '2': { nome: 'pedra', altura: 1 },
  '3': { nome: 'pedra', altura: 1.5 },
  '4': { nome: 'pedra', altura: 2 },
  '#': { nome: 'parede', altura: 3, solido: true },
  '=': { nome: 'circuito', altura: 0 },          // piso Quanta (brilha)
  '~': { nome: 'abismo', altura: -4, vazio: true },
  ' ': { nome: 'nada', altura: -4, vazio: true },
};

// Coisas: o jogo cria a entidade registrada com essa letra (ver src/entities/registro.js)
export const LEGENDA_COISAS = {
  'P': 'inicio',        // spawn do jogador
  'G': 'guardiao',      // Guardião Cinzento
  'T': 'sentinela',     // Sentinela Cinzenta
  'R': 'bruto',         // Bruto Cinzento
  'A': 'acolito',       // Acólito Quanta
  'Q': 'torre',         // Torre Quanta
  'B': 'cacho',         // cacho de bananas (recarrega Chico)
  'S': 'selo',          // selo Quanta: só o Pulverizar do Hugo quebra
  'L': 'alavanca',      // Orlando puxa: abre porta ligada
  'D': 'porta',         // porta fechada; abre com alavanca da mesma sala
  'X': 'saida',         // passa para a próxima sala
  'C': 'caixa',         // caixa empurrável/arremessável
  'M': 'memoria',       // fragmento de memória (carrega o Surto)
};
