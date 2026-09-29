// HUD: macacos (retratos 1/2/3), vida, Surto, bananas, nome da sala e dicas.
import { icones } from './pixel.js';
import { instalarHudReliquias } from './reliquias.js';

const BASE = import.meta.env.BASE_URL;
const ORDEM = [['hugo', '1'], ['chico', '2'], ['orlando', '3']];
const NOMES = { hugo: 'Hugo', chico: 'Chico', orlando: 'Orlando' };
const DURACAO_SURTO = 8;

const ICONE_SOM = '<svg viewBox="0 0 16 16"><path d="M2 5h3l4-3v12l-4-3H2z"/><path class="onda" d="M11 5h1v6h-1zM13 3h1v10h-1z"/></svg>';
const ICONE_MUDO = '<svg viewBox="0 0 16 16"><path d="M2 5h3l4-3v12l-4-3H2z"/><path d="M11 6h1v1h1v1h1V7h-1V6h1V5h-1v1h-1V5h-1zM11 10h1V9h1v1h1v1h-1v-1h-1v1h-1z"/></svg>';
const ICONE_PAUSA = '<svg viewBox="0 0 16 16"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>';

// lê os recursos do jogador aceitando o formato novo (recursos) e o antigo (surto)
export function lerRecursos(j) {
  const r = j.recursos;
  const carga = r?.surtoCarga ?? j.surto?.carga ?? 0;
  const bruto = r ? r.surtoAtivo : j.surto?.ativo;
  const ativo = typeof bruto === 'number' ? bruto > 0 : !!bruto;
  const restante = typeof bruto === 'number' ? Math.min(1, bruto / DURACAO_SURTO) : (ativo ? 1 : 0);
  return {
    carga: Math.max(0, Math.min(1, carga)), ativo, restante,
    bananas: r?.bananas, bananasMax: r?.bananasMax ?? 3,
  };
}

export function criarHud(jogo, raiz) {
  const el = document.createElement('div');
  el.className = 'hud-jogo';
  el.innerHTML = `
    <div class="hud-canto">
      <div class="retratos">${ORDEM.map(([n, t]) => `
        <button class="retrato px" data-macaco="${n}" aria-label="${NOMES[n]} (${t})"
          style="background-image:url('${BASE}sprites/${n}_normal.png')"><span class="tecla">${t}</span></button>`).join('')}
      </div>
      <div class="status">
        <div class="nome"></div>
        <div class="vida"></div>
        <div class="surto"><div class="barra"><i></i></div><span>SURTO</span></div>
        <div class="bananas"></div>
      </div>
    </div>
    <div class="hud-topo">
      <span class="sala"></span>
      <button class="botao-icone som" aria-label="Som"></button>
      <button class="botao-icone pausa" aria-label="Pausa">${ICONE_PAUSA}</button>
    </div>
    <div class="titulo-sala"><div class="num"></div><h2></h2><p></p><div class="fio"></div></div>
    <div class="chefe"><div class="rotulo"></div><div class="barra"><i></i></div></div>
    <div class="dica"></div>`;
  raiz.appendChild(el);
  instalarHudReliquias(jogo, el);   // relíquia ativa, recarga e cerimônia

  const $ = (s) => el.querySelector(s);
  const retratos = [...el.querySelectorAll('.retrato')];
  const vida = $('.vida'), surto = $('.surto'), barra = $('.surto i'), bananas = $('.bananas');
  const nome = $('.nome'), salaEl = $('.sala'), tituloSala = $('.titulo-sala'), dicaEl = $('.dica');
  const botaoSom = $('.som');
  const chefeEl = $('.chefe'), chefeBarra = $('.chefe i');
  let chefe = null;
  // o chefe avisa ao nascer ('chefe'); ao entrar na sala também procura um
  jogo.eventos.on('chefe', ({ alvo }) => { chefe = alvo; });

  // trocar tocando no retrato (usa a mesma ação do teclado)
  retratos.forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const a = b.dataset.macaco;
    jogo.input.pressionar(a);
    setTimeout(() => jogo.input.soltar(a), 60);
  }));
  $('.pausa').addEventListener('click', () => jogo.ui?.alternarPausa());
  botaoSom.addEventListener('click', () => jogo.audio?.alternarMudo());
  const atualizarSom = () => { botaoSom.innerHTML = jogo.audio?.mudo ? ICONE_MUDO : ICONE_SOM; };
  jogo.eventos.on('mudo', atualizarSom);
  atualizarSom();

  // estado anterior, para só mexer no DOM quando muda
  let ant = {};
  jogo.eventos.on('dano', ({ alvo }) => {
    if (alvo !== jogo.jogador) return;
    vida.classList.remove('dano'); void vida.offsetWidth; vida.classList.add('dano');
  });

  // ---- título da sala e dicas
  let dicas = [], filaDicas = [], dicaAtual = null, tempoDica = 0, tempoSala = 0, timerTitulo;
  jogo.eventos.on('sala', ({ sala, indice }) => {
    salaEl.textContent = sala.nome ?? '';
    $('.titulo-sala .num').textContent = `SALA ${String(indice + 1).padStart(2, '0')}`;
    $('.titulo-sala h2').textContent = sala.nome ?? '';
    $('.titulo-sala p').textContent = sala.subtitulo ?? '';
    tituloSala.classList.add('visivel');
    clearTimeout(timerTitulo);
    timerTitulo = setTimeout(() => tituloSala.classList.remove('visivel'), 3200);
    chefe = jogo.entidades.find((e) => e.ehChefe && !e.removido) ?? null;
    dicas = (sala.dicas ?? []).map((d) => ({ ...d, feita: false }));
    filaDicas = []; dicaAtual = null; tempoSala = 0;
    dicaEl.classList.remove('visivel');
  });
  // o título reaparece quando o jogo começa de fato (depois da tela inicial)
  function reexibirTitulo() {
    tituloSala.classList.add('visivel');
    clearTimeout(timerTitulo);
    timerTitulo = setTimeout(() => tituloSala.classList.remove('visivel'), 3200);
    tempoSala = 0;
  }

  function mostrarDica(texto) {
    // "Chico (2): Espaço duas vezes" -> o prefixo antes de ':' fica destacado
    const i = texto.indexOf(':');
    dicaEl.innerHTML = '';
    if (i > 0 && i < 24) {
      const b = document.createElement('b'); b.textContent = texto.slice(0, i + 1);
      dicaEl.append(b, texto.slice(i + 1));
    } else dicaEl.textContent = texto;
    dicaEl.classList.add('visivel');
  }

  function atualizarDicas(dt) {
    const j = jogo.jogador;
    tempoSala += dt;
    for (const d of dicas) {
      if (d.feita) continue;
      const perto = d.em
        ? Math.hypot(j.pos.x - (d.em[0] + .5), j.pos.z - (d.em[1] + .5)) < (d.raio ?? 2.5)
        : tempoSala > (d.atraso ?? 2.5);
      if (perto) { d.feita = true; filaDicas.push(d.texto); }
    }
    if (dicaAtual) {
      tempoDica -= dt;
      if (tempoDica <= 0) { dicaAtual = null; dicaEl.classList.remove('visivel'); tempoDica = -0.4; }
    } else if (filaDicas.length && (tempoDica += dt) >= 0) {
      dicaAtual = filaDicas.shift();
      tempoDica = 4.5;
      mostrarDica(dicaAtual);
    }
  }

  // ---- quadro a quadro
  function atualizar(dt, ativo) {
    const j = jogo.jogador;
    if (!j) return;
    const r = lerRecursos(j);

    if (j.atual !== ant.atual || r.ativo !== ant.surtoAtivo) {
      retratos.forEach((b) => {
        const n = b.dataset.macaco, eAtivo = n === j.atual;
        b.classList.toggle('ativo', eAtivo);
        b.classList.toggle('surto', eAtivo && r.ativo);
        b.style.backgroundImage = `url('${BASE}sprites/${n}_${eAtivo && r.ativo ? 'surto' : 'normal'}.png')`;
      });
      nome.textContent = (j.stats?.nome ?? NOMES[j.atual] ?? '').toUpperCase();
    }

    const vmax = Math.max(1, j.vidaMax ?? 6), v = Math.max(0, Math.ceil(j.vida * 2) / 2);
    if (v !== ant.vida || vmax !== ant.vmax) {
      // cada coração vale 2 de vida
      const n = Math.ceil(vmax / 2);
      vida.innerHTML = '';
      for (let k = 0; k < n; k++) {
        const resto = v - k * 2;
        const img = document.createElement('img');
        img.className = 'px';
        img.src = resto >= 2 ? icones.cheio() : resto >= 1 ? icones.meio() : icones.vazio();
        vida.appendChild(img);
      }
    }

    barra.style.width = `${(r.ativo ? r.restante : r.carga) * 100}%`;
    surto.classList.toggle('ativo', r.ativo);
    surto.classList.toggle('cheio', !r.ativo && r.carga >= 1);

    const mostraBananas = j.atual === 'chico' && r.bananas != null;
    const chaveB = mostraBananas ? `${r.bananas}/${r.bananasMax}` : '';
    if (chaveB !== ant.bananas) {
      bananas.innerHTML = '';
      if (mostraBananas) for (let k = 0; k < r.bananasMax; k++) {
        const img = document.createElement('img');
        img.className = 'px' + (k < r.bananas ? '' : ' vazia');
        img.src = icones.banana();
        bananas.appendChild(img);
      }
    }
    bananas.style.display = mostraBananas ? '' : 'none';

    // barra do chefe
    // chefe reativo (Matriarca) só mostra a barra enquanto está irritado
    const vivo = chefe && !chefe.removido && chefe.vida > 0 && jogo.entidades.includes(chefe) && chefe.irritado !== false;
    chefeEl.classList.toggle('visivel', !!vivo);
    if (vivo) {
      chefeEl.querySelector('.rotulo').textContent = chefe.nome ?? 'Chefe';
      chefeBarra.style.width = `${Math.max(0, chefe.vida / (chefe.vidaMax || 1)) * 100}%`;
    }

    ant = { atual: j.atual, surtoAtivo: r.ativo, vida: v, vmax, bananas: chaveB };
    if (ativo) atualizarDicas(dt);
  }

  return { atualizar, reexibirTitulo, atualizarSom };
}
