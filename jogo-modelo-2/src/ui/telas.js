// Telas cheias: título, pausa, derrota e vitória. Cada uma tem um botão principal
// (Enter / A do controle aciona).
const CONTROLES = `
  <div class="controles so-teclado">
    <span><kbd>WASD</kbd></span><span>andar</span>
    <span><kbd>Espaço</kbd></span><span>pular (Chico: duplo · Orlando: segurar plana)</span>
    <span><kbd>J</kbd></span><span>golpe</span>
    <span><kbd>K</kbd></span><span>identidade — Pulverizar · Banana · Agarrão</span>
    <span><kbd>L</kbd></span><span>recurso — Guarda · — · Ferramenta</span>
    <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></span><span>Hugo · Chico · Orlando</span>
    <span><kbd>F</kbd></span><span>Surto (barra cheia)</span>
    <span><kbd>Q</kbd><kbd>E</kbd></span><span>girar câmera</span>
    <span><kbd>Esc</kbd></span><span>pausa · <kbd>M</kbd> som</span>
  </div>
  <div class="controles so-toque">
    <span>esquerda</span><span>joystick para andar</span>
    <span>direita</span><span>pulo, golpe, identidade, recurso, surto</span>
    <span>retratos</span><span>trocar de macaco</span>
  </div>`;

const MODELOS = {
  titulo: `
    <div class="caixa">
      <h1>PRIMORDIA</h1>
      <div class="marca">Hills Co</div>
      <p class="lema">Três macacos de rua procuravam Atlântida. Acharam um santuário de embarque — e uma máquina que ainda funciona.</p>
      <div class="fio"></div>
      <div class="acoes"><button class="botao principal" data-acao="jogar">Jogar</button></div>
      ${CONTROLES}
      <div class="dica-tecla so-teclado">Enter para começar</div>
    </div>`,
  pausa: `
    <div class="caixa">
      <h1 class="menor">PAUSA</h1>
      <p class="lema">a ruína espera</p>
      <div class="fio"></div>
      <div class="acoes">
        <button class="botao principal" data-acao="continuar">Continuar</button>
        <button class="botao" data-acao="reiniciar">Reiniciar sala</button>
        <button class="botao" data-acao="som">Som</button>
      </div>
      ${CONTROLES}
    </div>`,
  derrota: `
    <div class="caixa">
      <h1 class="menor">CAÍDOS</h1>
      <p class="lema">A ruína lembra de quem tentou. Levantem — ela lembra do caminho também.</p>
      <div class="fio"></div>
      <div class="acoes"><button class="botao principal" data-acao="tentar">Tentar de novo</button></div>
    </div>`,
  vitoria: `
    <div class="caixa">
      <h1 class="menor">EMBARQUE</h1>
      <p class="lema">A máquina reconhece os três. Atlântida não era um lugar para achar — era uma partida para fazer.</p>
      <div class="fio"></div>
      <div class="acoes"><button class="botao principal" data-acao="denovo">Jogar de novo</button></div>
    </div>`,
};

export function criarTelas(raiz, aoAcionar) {
  const telas = {};
  for (const [nome, html] of Object.entries(MODELOS)) {
    const t = document.createElement('div');
    t.className = `tela tela-${nome}`;
    t.innerHTML = html;
    t.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]');
      if (b) aoAcionar(b.dataset.acao);
    });
    raiz.appendChild(t);
    telas[nome] = t;
  }
  let atual = null;
  return {
    get atual() { return atual; },
    mostrar(nome) {
      for (const [n, t] of Object.entries(telas)) t.classList.toggle('visivel', n === nome);
      atual = nome;
      document.body.classList.toggle('em-tela', !!nome);
      telas[nome]?.querySelector('.principal')?.focus({ preventScroll: true });
    },
    esconder() { this.mostrar(null); },
    // aciona o botão principal da tela visível
    principal() { telas[atual]?.querySelector('.principal')?.click(); },
    rotuloSom(mudo) {
      const b = telas.pausa.querySelector('[data-acao="som"]');
      b.textContent = mudo ? 'Som: desligado' : 'Som: ligado';
    },
  };
}
