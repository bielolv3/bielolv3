// Liga a letra do mapa (ver LEGENDA_COISAS em world/tiles.js) a um construtor.
// Para adicionar uma entidade nova: crie o arquivo e registre aqui.
import { Guardiao, Sentinela, Bruto, DroneVigia, Acolito, Torre, DroneConstrutor, Andador } from './inimigos.js';
import { Saida, Cacho, Selo, Alavanca, Porta, Caixa, Memoria } from './objetos.js';
import { Javali, Planta, Sapo, Aranha, Tartaruga, Ninho, InsetoLuz, Matriarca } from './fauna.js';
import { Reliquia } from './reliquias.js';

export const REGISTRO = {
  guardiao: Guardiao,
  sentinela: Sentinela,
  bruto: Bruto,
  droneVigia: DroneVigia,
  acolito: Acolito,
  torre: Torre,
  droneConstrutor: DroneConstrutor,
  andador: Andador,
  saida: Saida,
  cacho: Cacho,
  selo: Selo,
  alavanca: Alavanca,
  porta: Porta,
  caixa: Caixa,
  memoria: Memoria,
  reliquia: Reliquia,   // pedestal de relíquia (qual: campo `reliquia` da sala)
  // Ato II: fauna do veio Seiva (fauna.js)
  javali: Javali,
  planta: Planta,
  sapo: Sapo,
  aranha: Aranha,
  tartaruga: Tartaruga,
  ninho: Ninho,
  insetoLuz: InsetoLuz,
  matriarca: Matriarca,
};

// para testes pelo console: jogo.adicionar(new REGISTRO.bruto(jogo, 5.5, 5.5))
if (typeof window !== 'undefined') window.REGISTRO = REGISTRO;
