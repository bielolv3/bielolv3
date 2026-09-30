// Partituras da trilha (dados puros; o motor está em musica.js).
//
// Notação de um padrão: tokens separados por espaço, cada token ocupa `*n` passos (padrão 1).
//   'D4'  nota · 'D3+F3+A3' acorde · '.' pausa · 'x' golpe de percussão · 'X' acento · 'o' fantasma
//   '|' só separa compassos para leitura.
// Camada: { inst, seq, vol, grupo?, trans?, prob?, filtro?: [tipo, freq, q], distorcer? }
//   `seq` é texto ou lista de textos/[texto, transposição] concatenados; cada camada repete no
//   próprio comprimento (camadas de tamanhos diferentes formam variações longas).
// Grupos: 'base' sempre soa; 'tensao' (inimigo alertado/perto), 'calma' e 'ira' (Matriarca)
//   entram e saem com fade pelo motor.
//
// Tema principal (8 compassos, Ré dórico — o Si natural é a cor do modo):
//   D  A  G F E F | G . A C A | B A G F E D | E . . . | D A C D E | F . E D C | B G A F E | D . . .

const TEMA = [
  'D4*4 A4*4 G4*2 F4*2 E4*2 F4*2', 'G4*6 A4*2 C5*4 A4*4', 'B4*4 A4*2 G4*2 F4*4 E4*2 D4*2', 'E4*12 .*4',
  'D4*4 A4*4 C5*2 D5*2 E5*4', 'F5*6 E5*2 D5*4 C5*4', 'B4*4 G4*2 A4*2 F4*4 E4*4', 'D4*12 .*4',
].join(' | ');
const TEMA_A = TEMA.split(' | ').slice(0, 4).join(' | ');

// arpejo: cada acorde (lista de notas) percorrido na ordem dada, `dur` passos por nota
const arp = (acordes, ordem, dur = 2) => acordes.map((a) => ordem.map((k) => `${a[k % a.length]}*${dur}`).join(' ')).join(' | ');
const rep = (txt, n) => Array(n).fill(txt).join(' | ');

// ---------------------------------------------------------------- faixas
export const FAIXAS = {
  // 1. Título — Ré dórico, 92 bpm, 16 compassos: tema na ocarina, depois nos sinos uma oitava acima
  titulo: {
    bpm: 92, ppb: 4, compasso: 16,
    camadas: [
      { inst: 'pad', vol: 0.08, filtro: ['lowpass', 1300, 0.7],
        seq: 'D3+F3+A3+C4*16 C3+E3+G3+D4*16 B2+D3+G3+A3*16 A2+C3+E3+G3*16 D3+F3+A3+E4*16 F2+C3+F3+A3*16 G2+B2+D3+F3*16 D3+F3+A3+D4*16' },
      { inst: 'baixo', vol: 0.16,
        seq: 'D2*6 D2*2 A2*8 | C2*6 C2*2 G2*8 | G1*6 G1*2 D2*8 | A1*6 A1*2 E2*8 | D2*6 D2*2 A2*8 | F1*6 F1*2 C2*8 | G1*6 G1*2 D2*8 | D2*6 D2*2 A2*8' },
      { inst: 'ocarina', vol: 0.11, seq: [[TEMA, 12], '.*128'] },
      { inst: 'sino', vol: 0.07, seq: ['D6*16 .*48 A5*16 .*48', [TEMA, 24]] },
      { inst: 'kalimba', vol: 0.06, prob: 0.55,
        seq: arp([['D4', 'F4', 'A4', 'E5'], ['C4', 'E4', 'G4', 'D5'], ['B3', 'D4', 'G4', 'A4'], ['A3', 'C4', 'E4', 'G4'], ['D4', 'F4', 'A4', 'E5'], ['F3', 'A3', 'C4', 'F4'], ['G3', 'B3', 'D4', 'F4'], ['D4', 'F4', 'A4', 'D5']], [0, 1, 2, 3, 2, 1, 2, 3]) },
      { inst: 'madeira', vol: 0.05, seq: '. . . . x . . o . . . . x . o .' },
    ],
  },

  // 2. Ato I — Santuário: Ré dórico/eólio, 76 bpm; pad quente, pulso "coração" no baixo,
  //    cabeça do tema aumentada nos sinos. Camada 'tensao': madeira, pedra, tambor e baixo em colcheias.
  santuario: {
    bpm: 76, ppb: 4, compasso: 16, grupos: { base: 1, tensao: 0 },
    camadas: [
      { inst: 'pad', vol: 0.088, filtro: ['lowpass', 1000, 0.7],
        seq: 'D3+F3+A3+E4*32 Bb2+F3+A3+D4*32 C3+G3+D4+E4*32 A2+E3+G3+C4*32' },
      { inst: 'baixo', vol: 0.14, seq: 'D2*2 D2*14 | D2*2 D2*14 | Bb1*2 Bb1*14 | Bb1*2 Bb1*14 | C2*2 C2*14 | C2*2 C2*14 | A1*2 A1*14 | A1*2 A1*14' },
      { inst: 'sino', vol: 0.07,
        seq: 'D5*8 A5*8 | G5*4 F5*4 E5*8 | G5*12 A5*4 | E5*16 | .*64 | A5*8 C6*8 | D6*4 C6*4 A5*8 | G5*8 F5*8 | E5*16 | .*64' },
      { inst: 'kalimba', vol: 0.05, prob: 0.35,
        seq: arp([['D4', 'A4', 'E5', 'F5'], ['D4', 'A4', 'E5', 'F5'], ['Bb3', 'F4', 'A4', 'D5'], ['Bb3', 'F4', 'A4', 'D5'], ['C4', 'G4', 'D5', 'E5'], ['C4', 'G4', 'D5', 'E5'], ['A3', 'E4', 'G4', 'C5'], ['A3', 'E4', 'G4', 'C5']], [0, 1, 2, 3, 2, 1, 3, 2]) },
      { inst: 'tambor', grupo: 'tensao', vol: 0.22, seq: 'X . . . . . x . . . X . . . . .' },
      { inst: 'pedra', grupo: 'tensao', vol: 0.12, seq: '. . . . x . . . . . . . x . . o' },
      { inst: 'madeira', grupo: 'tensao', vol: 0.07, seq: '. . x . . . x . . . x . . x . .' },
      { inst: 'baixo', grupo: 'tensao', vol: 0.09,
        seq: [rep('D2*2 . . D3*2 D2*2 . . D2*2 D3*2 D2*2', 2), rep('Bb1*2 . . Bb2*2 Bb1*2 . . Bb1*2 Bb2*2 Bb1*2', 2), rep('C2*2 . . C3*2 C2*2 . . C2*2 C3*2 C2*2', 2), rep('A1*2 . . A2*2 A1*2 . . A1*2 A2*2 A1*2', 2)] },
    ],
  },

  // 3. Circuito Quanta — Ré dórico, 104 bpm; arpejo "teal" em onda quadrada com filtro ressonante,
  //    baixo serrilhado, chimbal/pedra; primeira metade do tema nos sinos a cada 8 compassos.
  circuito: {
    bpm: 104, ppb: 4, compasso: 16, grupos: { base: 1, tensao: 0 },
    camadas: [
      { inst: 'arp', vol: 0.05, filtro: ['lowpass', 1500, 7],
        seq: arp([['D4', 'F4', 'A4', 'E5'], ['C4', 'E4', 'G4', 'D5'], ['B3', 'D4', 'G4', 'A4'], ['A3', 'C4', 'E4', 'G4']], [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2, 1], 1) },
      { inst: 'baixoSerra', vol: 0.09, filtro: ['lowpass', 520, 3],
        seq: 'D2*3 D2 D2*2 D3*2 D2*2 D2*2 D3*2 D2*2 | C2*3 C2 C2*2 C3*2 C2*2 C2*2 C3*2 C2*2 | G1*3 G1 G1*2 G2*2 G1*2 G1*2 G2*2 G1*2 | A1*3 A1 A1*2 A2*2 A1*2 A1*2 A2*2 A1*2' },
      { inst: 'pad', vol: 0.056, filtro: ['lowpass', 900, 0.7], seq: 'D3+A3+E4*16 C3+G3+D4*16 B2+G3+D4*16 A2+E3+C4*16' },
      { inst: 'chimbal', vol: 0.05, seq: '. . x . . . x . . . x . . . x x' },
      { inst: 'tambor', vol: 0.16, seq: 'X . . . . . . . X . . x . . . .' },
      { inst: 'pedra', vol: 0.08, seq: '. . . . X . . . . . . . X . . .' },
      { inst: 'sino', vol: 0.06, seq: [[TEMA_A, 12], '.*64'] },
      { inst: 'chimbal', grupo: 'tensao', vol: 0.04, seq: 'x o x o x o x o x o x o x o x o' },
      { inst: 'tambor', grupo: 'tensao', vol: 0.14, seq: '. . . . . . x . . . . . . . x x' },
    ],
  },

  // 4. Chefe — Andador Quanta: Ré frígio (Mi bemol), 132 bpm; baixo em semicolcheias com
  //    pedal em Ré, tambores, tema em menor no "metal" (serra + sub), sino grave dobrando.
  chefe: {
    bpm: 132, ppb: 4, compasso: 16,
    camadas: [
      { inst: 'baixoSerra', vol: 0.1, filtro: ['lowpass', 700, 4],
        seq: 'D2 D2 D3 D2 Eb2 D2 D3 D2 D2 D2 D3 D2 C2 C2 Bb1 C2 | D2 D2 D3 D2 Eb2 D2 D3 D2 F2 F2 Eb2 Eb2 D2 D2 C2 Bb1' },
      { inst: 'tambor', vol: 0.26, seq: 'X . . x . . X . X . . x . . x .' },
      { inst: 'pedra', vol: 0.13, seq: '. . . . X . . . . . . . X . x o' },
      { inst: 'chimbal', vol: 0.045, seq: 'x . x . x . x . x . x . x . x x' },
      { inst: 'pad', vol: 0.072, filtro: ['lowpass', 1100, 1], seq: 'D3+A3+D4*32 Eb3+Bb3+Eb4*32 D3+A3+D4*32 C3+G3+C4*16 Bb2+F3+Bb3*16' },
      { inst: 'metal', vol: 0.07, filtro: ['lowpass', 2200, 1.5],
        seq: 'D4*4 A4*4 G4*2 F4*2 Eb4*2 F4*2 | G4*6 A4*2 C5*4 A4*4 | Bb4*4 A4*2 G4*2 F4*4 Eb4*2 D4*2 | D4*12 .*4 | .*64' },
      { inst: 'sino', vol: 0.05, seq: 'D4*32 .*32 Eb4*32 .*32' },
    ],
  },

  // 5. Ato II — Raiz da Matriarca: Sol dórico, 6/8 (colcheia pontuada = 58), marimba em ostinato,
  //    flauta com o tema em 6/8, kalimba, chocalho e pássaros. 'ira': tambores graves + tema da
  //    floresta frígio numa serra distorcida; 'calma' (flauta/kalimba) recua.
  seiva: {
    bpm: 58, ppb: 6, compasso: 12, grupos: { base: 1, calma: 1, tensao: 0, ira: 0 }, passaros: true,
    camadas: [
      { inst: 'marimba', vol: 0.1,
        seq: 'G3*2 D4*2 Bb3*2 D4*2 A3*2 D4*2 | F3*2 C4*2 A3*2 C4*2 G3*2 C4*2 | C3*2 G3*2 E4*2 G3*2 D4*2 G3*2 | G3*2 D4*2 Bb3*2 D4*2 A3*2 D4*2' },
      { inst: 'baixo', vol: 0.13, seq: 'G2*6 D2*6 | F2*6 C2*6 | C2*6 G1*6 | G2*6 D2*6' },
      { inst: 'pad', vol: 0.056, filtro: ['lowpass', 900, 0.7], seq: 'G3+Bb3+D4*12 F3+A3+C4*12 E3+G3+C4*12 G3+Bb3+D4*12' },
      { inst: 'shaker', vol: 0.025, seq: 'x . o . x . x . o . o .' },
      { inst: 'flauta', grupo: 'calma', vol: 0.09,
        seq: ['G4*3 D5*3 C5*2 Bb4*2 A4*2 | C5*6 D5*2 F5*4 | E5*3 D5*3 C5*2 Bb4*2 A4*2 | G4*9 .*3 | G4*3 D5*3 F5*2 G5*2 A5*2 | Bb5*6 A5*2 G5*4 | E5*3 C5*3 D5*2 Bb4*2 A4*2 | G4*9 .*3', '.*96'] },
      { inst: 'kalimba', grupo: 'calma', vol: 0.05, prob: 0.4,
        seq: arp([['G4', 'Bb4', 'D5'], ['F4', 'A4', 'C5'], ['E4', 'G4', 'C5'], ['G4', 'Bb4', 'D5']], [2, 1, 0, 1, 2, 0], 2) },
      { inst: 'madeira', grupo: 'tensao', vol: 0.06, seq: 'x . . x . . x . x . x .' },
      { inst: 'tambor', grupo: 'ira', vol: 0.3, seq: 'X . . x . . X . x x . .' },
      { inst: 'pedra', grupo: 'ira', vol: 0.12, seq: '. . . . . . X . . . . o' },
      { inst: 'serra', grupo: 'ira', vol: 0.06, distorcer: true, filtro: ['lowpass', 1600, 2],
        seq: 'G3*3 D4*3 C4*2 Bb3*2 Ab3*2 | C4*6 Db4*2 F4*4 | Eb4*3 D4*3 C4*2 Bb3*2 Ab3*2 | G3*9 .*3' },
    ],
  },
};

// ---------------------------------------------------------------- jingles (tocam uma vez)
export const JINGLES = {
  // relíquia pega: cabeça do tema nos sinos, resolvendo em Ré maior
  reliquia: {
    bpm: 120, ppb: 4, compasso: 16,
    camadas: [
      { inst: 'sino', vol: 0.12, seq: 'D5*2 A5*2 G5*2 A5*2 D6*12' },
      { inst: 'kalimba', vol: 0.07, seq: '. D5 F#5 A5 . D6 . A5 . . . . . . . . . . . .' },
      { inst: 'pad', vol: 0.096, seq: 'D3+F#3+A3+D4*20' },
    ],
  },
  // chefe vencido
  vitoriaSala: {
    bpm: 110, ppb: 4, compasso: 16,
    camadas: [
      { inst: 'ocarina', vol: 0.12, seq: 'D5*2 A5*2 G5*2 F#5*2 E5*2 F#5*2 D5*12' },
      { inst: 'pad', vol: 0.096, seq: 'G2+B2+D3+G3*12 D3+F#3+A3+D4*12' },
      { inst: 'baixo', vol: 0.15, seq: 'G1*12 D2*12' },
      { inst: 'tambor', vol: 0.2, seq: 'X*8 .*4 x*2 x*2 X*8' },
    ],
  },
  // derrota: tema descendo, lento, termina em Ré menor
  derrota: {
    bpm: 64, ppb: 4, compasso: 16,
    camadas: [
      { inst: 'ocarina', vol: 0.1, seq: 'A4*4 G4*4 F4*4 E4*4 D4*16' },
      { inst: 'pad', vol: 0.096, filtro: ['lowpass', 800, 0.7], seq: 'Bb2+D3+F3*16 D3+F3+A3*16' },
      { inst: 'baixo', vol: 0.12, seq: 'Bb1*16 D2*16' },
    ],
  },
  // vitória final: o tema em Ré maior, com fanfarra
  vitoriaFinal: {
    bpm: 100, ppb: 4, compasso: 16,
    camadas: [
      { inst: 'ocarina', vol: 0.12, seq: 'D5*4 A5*4 G5*2 F#5*2 E5*2 F#5*2 | G5*6 A5*2 B5*4 A5*4 | D6*16' },
      { inst: 'pad', vol: 0.096, seq: 'D3+F#3+A3+D4*16 G2+B2+D3+G3*16 D3+F#3+A3+D4*16' },
      { inst: 'baixo', vol: 0.15, seq: 'D2*16 G1*16 D2*16' },
      { inst: 'sino', vol: 0.08, seq: 'D6*16 .*16 D6*4 A6*4 D7*8' },
      { inst: 'tambor', vol: 0.2, seq: 'X*4 x*4 x*4 x*4 X*4 x*4 x*4 x*4 X*16' },
    ],
  },
};
