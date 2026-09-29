// Liga a letra do mapa (ver LEGENDA_COISAS em world/tiles.js) a um construtor.
// Para adicionar uma entidade nova: crie o arquivo e registre aqui.
import { Guardiao, Sentinela, Bruto, DroneVigia, Acolito, Torre, DroneConstrutor, Andador } from './inimigos.js';
import { Saida, Cacho, Selo, Alavanca, Porta, Caixa, Memoria } from './objetos.js';

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
};

// para testes pelo console: jogo.adicionar(new REGISTRO.bruto(jogo, 5.5, 5.5))
if (typeof window !== 'undefined') window.REGISTRO = REGISTRO;
