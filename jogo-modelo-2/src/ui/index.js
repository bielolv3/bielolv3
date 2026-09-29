// Frente C: HUD, menus e controles de toque.
// Estados: titulo -> jogando <-> pausa; jogando -> derrota | vitoria.
import { CSS } from './estilo.js';
import { criarHud, lerRecursos } from './hud.js';
import { criarTelas } from './telas.js';
import { criarToque } from './toque.js';
import { criarGamepad } from './gamepad.js';

export function instalarInterface(jogo) {
  const estilo = document.createElement('style');
  estilo.textContent = CSS;
  document.head.appendChild(estilo);
  let raiz = document.getElementById('hud');
  if (!raiz) { raiz = document.createElement('div'); raiz.id = 'hud'; document.body.appendChild(raiz); }

  const hud = criarHud(jogo, raiz);
  const toque = criarToque(jogo, raiz);
  const telas = criarTelas(raiz, acionar);
  const gamepad = criarGamepad(jogo, { aoPrincipal: () => telas.principal() });

  // testes automáticos (Playwright) e ?jogar pulam a tela de título
  const pularTitulo = navigator.webdriver || new URLSearchParams(location.search).has('jogar');
  let estado = pularTitulo ? 'jogando' : 'titulo';
  let quadros = 0;
  if (estado === 'titulo') telas.mostrar('titulo');

  const pausar = (sim) => {
    if (jogo.pausado === sim) return;
    jogo.pausado = sim;
    jogo.eventos.emitir('pausa', { pausado: sim });
  };

  function irPara(novo) {
    estado = novo;
    if (novo === 'jogando') { telas.esconder(); pausar(false); }
    else { telas.mostrar(novo); pausar(true); }
  }

  function tentarDeNovo() {
    const atual = jogo.jogador?.atual;
    jogo.reiniciarSala();   // jogador novo = vida cheia
    if (atual && atual !== jogo.jogador.atual) jogo.jogador.trocar(atual, true);
    irPara('jogando');
  }

  function acionar(acao) {
    jogo.audio?.destravar?.();
    if (acao === 'jogar') { irPara('jogando'); hud.reexibirTitulo(); jogo.eventos.emitir('comecar', {}); }
    else if (acao === 'continuar') irPara('jogando');
    else if (acao === 'reiniciar' || acao === 'tentar') tentarDeNovo();
    else if (acao === 'som') jogo.audio?.alternarMudo();
    else if (acao === 'denovo') { jogo.novoJogo(); irPara('jogando'); }
  }

  // Esc do jogo (evento 'pausa'): abre/fecha a tela de pausa; nas outras telas o jogo fica parado
  jogo.eventos.on('pausa', ({ pausado }) => {
    if (estado === 'jogando' && pausado) { estado = 'pausa'; telas.mostrar('pausa'); }
    else if (estado === 'pausa' && !pausado) { estado = 'jogando'; telas.esconder(); }
    else if (estado !== 'jogando' && estado !== 'pausa' && !pausado) jogo.pausado = true;
  });
  jogo.eventos.on('derrota', () => { if (estado === 'jogando' || estado === 'pausa') irPara('derrota'); });
  jogo.eventos.on('vitoria', () => irPara('vitoria'));
  jogo.eventos.on('mudo', ({ mudo }) => telas.rotuloSom(mudo));
  telas.rotuloSom(false);

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) jogo.audio?.alternarMudo();
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && telas.atual && telas.atual !== 'pausa') {
      e.preventDefault();
      telas.principal();
    }
  });
  // botões do HUD não guardam foco (senão Enter/Espaço os acionariam de novo)
  raiz.addEventListener('click', (e) => e.target.closest('.hud-jogo button')?.blur());

  let anterior = performance.now();
  const quadro = (agora) => {
    const dt = Math.min(0.05, (agora - anterior) / 1000);
    anterior = agora;
    // deixa o jogo rodar 2 quadros (câmera se posiciona) antes de congelar sob a tela
    if (++quadros === 3 && estado !== 'jogando') jogo.pausado = true;
    gamepad.atualizar(telas.atual);
    hud.atualizar(dt, estado === 'jogando' && !jogo.pausado);
    if (jogo.jogador) toque.atualizar(lerRecursos(jogo.jogador));
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);

  jogo.ui = {
    get estado() { return estado; },
    alternarPausa() { if (estado === 'jogando') irPara('pausa'); else if (estado === 'pausa') irPara('jogando'); },
    mostrarTitulo() { irPara('titulo'); },
    irPara,
  };
}
