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
  // Frente B (visual): tipos novos
  '+': { nome: 'ornato', altura: 0 },            // piso Precursor com incrustação de latão
  '%': { nome: 'circuito', altura: 0.5 },        // plataforma Quanta baixa
  'c': { nome: 'coluna', altura: 2.5, solido: true, forma: 'coluna' },   // coluna Precursora inteira
  'k': { nome: 'coluna', altura: 1.25, forma: 'coluna' },                // coluna quebrada (dá para subir pulando)
  // Ato II (bioma Seiva): floresta, raízes e água
  'r': { nome: 'terra', altura: 0 },                                     // chão de terra e folhas
  'u': { nome: 'terra', altura: 1 },                                     // barranco de terra (sobe pulando)
  'y': { nome: 'terra', altura: 2 },                                     // barranco alto (Chico: pulo duplo)
  't': { nome: 'raiz', altura: 3, solido: true },                        // raiz colossal: parede do bioma
  'z': { nome: 'raizViva', altura: 0.2, protegido: true },               // raiz viva da Matriarca: pisar provoca
  'w': { nome: 'aguaRasa', altura: -0.2, lento: 0.55 },                  // água rasa: anda mais devagar
  'o': { nome: 'aguaFunda', altura: -4, vazio: true, agua: true },       // água funda: cai = volta (como o abismo)
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
  // Frente A: inimigos sem letra
  'V': 'droneVigia',    // Drone Vigia (Legião): voa, alerta os outros
  'K': 'droneConstrutor', // Drone Construtor (Quanta): reergue selos
  'W': 'andador',       // Andador Quanta (chefe)
  // Relíquias: pedestal; qual relíquia vem do campo `reliquia` da sala ('sismico' | 'disco' | 'semente' | 'perola')
  'Y': 'reliquia',
  // Ato II: fauna nativa do veio Seiva (src/entities/fauna.js). Não ataca primeiro.
  'J': 'javali',        // Javali-raiz: investe em linha se provocado ou se entrarem no território
  'F': 'planta',        // Planta-carnívora: parada, morde quem chega perto; banana distrai
  'H': 'sapo',          // Sapo-bombástico: pula e explode em área quando provocado
  'E': 'aranha',        // Aranha-gigante: guarda ninhos, tece teia que prende
  'U': 'tartaruga',     // Tartaruga-menor: neutra, empurrável, nada na água (plataforma móvel)
  'N': 'ninho',         // ninho: pisar provoca a fauna em volta
  'I': 'insetoLuz',     // Inseto-luz: vaga-lume inofensivo (ilumina)
  'Z': 'matriarca',     // A Matriarca (colosso do veio Seiva): só reage
};

// Camada opcional `deco` (Frente B): só visual, sem colisão. Mesma grade de `chao`.
// Espaço ou '.' = nada. Sem `deco`, a sala recebe decoração automática leve
// (capim no musgo, entulho e samambaias junto às paredes, mato no topo das ruínas);
// `decoAuto: false` na sala desliga isso.
export const LEGENDA_DECO = {
  'f': 'samambaia',     // samambaia (sprite)
  'g': 'capim',         // tufo de capim (sprite)
  'e': 'entulho',       // pedras soltas (3D)
  'q': 'cristal',       // cristal Quanta que brilha (3D, luz teal)
  'a': 'altar',         // pedestal Quanta com cristal flutuando (3D, luz teal)
  'b': 'braseiro',      // braseiro aceso (3D, luz quente, chama animada)
  'h': 'elmo',          // destroço da Legião Cinzenta (sprite)
  'v': 'cipo',          // cipó pendurado (use em tile de parede; cai pela face da frente)
  // Ato II (bioma Seiva)
  'i': 'raizArco',      // raiz retorcida saindo do chão (3D)
  'j': 'arbusto',       // arbusto de folhas largas (sprite)
  'm': 'cogumelo',      // cogumelos luminosos (3D, luz verde)
  'y': 'flores',        // flores (sprite)
  'x': 'vitoria',       // vitória-régia (use sobre água)
};
