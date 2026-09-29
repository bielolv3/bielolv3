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
// o jogo roda desde já (a sala 1 aparece por trás da tela de título, congelada);
// a interface solta a pausa quando o jogador clica em Jogar
jogo.iniciar();
// acesso pelo console para testar: window.jogo
window.jogo = jogo;
