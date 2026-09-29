import { Jogo } from './core/jogo.js';
import { Habilidades } from './entities/habilidades.js';
import { instalarEfeitos } from './fx/index.js';
import { instalarInterface } from './ui/index.js';
import { instalarAudio } from './audio/index.js';

const jogo = new Jogo(document.getElementById('jogo'));
jogo.habilidades = new Habilidades(jogo);
instalarEfeitos(jogo);
instalarInterface(jogo);
instalarAudio(jogo);
jogo.iniciar();
// acesso pelo console para testar: window.jogo
window.jogo = jogo;
