// HUD das relíquias: espaço da relíquia ativa (ícone pixel art + recarga), as outras
// que o time carrega, e a cerimônia (nome em destaque) quando uma é pega.
// Instalado por hud.js: instalarHudReliquias(jogo, elementoDoHud).
import { iconePixel } from './pixel.js';
import { RELIQUIAS } from '../entities/reliquias.js';

// 12x12, lido por iconePixel ('.' = transparente)
const ICONES = {
  sismico: [[
    '....ssss....',
    '..ssSSSSss..',
    '.sSSdddSSSs.',
    '.sSdoooodSs.',
    'sSdoOyyOodSs',
    'sSdoyWWyodSs',
    'sSdoyWWyodSs',
    'sSdoOyyOodSs',
    '.sSdoooodSs.',
    '.sSSdddSSs..',
    '..ssSSSs.s..',
    '....sss.....',
  ], { s: '#3a332a', S: '#7a6e60', d: '#2a2018', o: '#c04a2c', O: '#e0782a', y: '#ffb347', W: '#fff0c0' }],
  disco: [[
    '....gggg....',
    '..ggSSSSg...',
    '.gSSsSSs....',
    '.gSsyyyS..g.',
    'gSSyWWyySSg.',
    'gSsyWWWySsSg',
    'gSsyWWyysSSg',
    'gSSsyyysSSg.',
    '.gSSsSSsSSg.',
    '.ggSSSSSSgg.',
    '..gggSSggg..',
    '....gggg....',
  ], { g: '#d09a2c', S: '#9a8a6a', s: '#5a4c34', y: '#ffc94a', W: '#fff4c8' }],
  semente: [[
    '.....ll.....',
    '....lLl.....',
    '.....l.ll...',
    '....pppLl...',
    '...pPgPpp...',
    '...pgGgPp...',
    '...pPgGgp...',
    's..ppgPpp..s',
    'sS..ppp...Ss',
    'sSSs....sSSs',
    '.sSSSSSSSSs.',
    '..ssssssss..',
  ], { l: '#8fdc5a', L: '#c8f090', p: '#4d5a2e', P: '#6d7b3e', g: '#8fdc5a', G: '#e0ffb0', s: '#3a332a', S: '#6d6258' }],
  perola: [[
    '..ssssssss..',
    '.sSSSSSSSSs.',
    'sSSddddddSSs',
    'sSdbbbbbbdSs',
    'sdbBBwBBbbds',
    'sdbBwWwBBbds',
    'sdbBBwBBBbds',
    'sSdbbbbbbdSs',
    'sSSddddddSSs',
    '.sSSSSSSSs..',
    '..sss.ssss..',
    '............',
  ], { s: '#2e3640', S: '#4d5a66', d: '#1a2230', b: '#2a6a8a', B: '#4fb0d8', w: '#bfe8ff', W: '#ffffff' }],
};
export const iconeReliquia = (id) => (ICONES[id] ? iconePixel(...ICONES[id]) : '');
const corCss = (id) => '#' + (RELIQUIAS[id]?.cor ?? 0xd09a2c).toString(16).padStart(6, '0');

const CSS = `
.hud-reliquia{position:absolute;left:16px;top:100px;display:none;align-items:center;gap:8px;
  background:rgba(12,11,9,.72);border:2px solid rgba(58,51,42,.9);padding:5px 10px 5px 5px}
.hud-reliquia.tem{display:flex}
.hud-reliquia .slot{position:relative;width:44px;height:44px;padding:0;background:var(--tinta);
  border:2px solid var(--cor,var(--mostarda));pointer-events:auto;overflow:hidden}
.hud-reliquia .slot img{width:36px;height:36px;display:block;margin:2px}
.hud-reliquia .slot .recarga{position:absolute;left:0;right:0;top:0;height:0;background:rgba(12,11,9,.72)}
.hud-reliquia .slot.pronta{box-shadow:0 0 8px var(--cor,var(--mostarda))}
.hud-reliquia .slot.falha{animation:treme .25s steps(3)}
.hud-reliquia .tecla{position:absolute;right:-2px;bottom:-2px;background:var(--tinta);color:var(--osso2);
  font-size:10px;line-height:12px;padding:0 3px;border:1px solid var(--apagado)}
.hud-reliquia .info{display:flex;flex-direction:column;gap:3px;min-width:0}
.hud-reliquia .nome{font-family:var(--serifa);font-weight:700;font-size:12px;letter-spacing:.1em;color:var(--cor,var(--mostarda));
  text-shadow:0 2px 0 var(--tinta);white-space:nowrap}
.hud-reliquia .efeito{font-size:10px;letter-spacing:.12em;color:var(--osso2);text-transform:uppercase;white-space:nowrap}
.hud-reliquia .outras{display:flex;gap:3px;align-items:center}
.hud-reliquia .outras button{width:20px;height:20px;padding:1px;background:var(--tinta);border:1px solid var(--apagado);pointer-events:auto;opacity:.6}
.hud-reliquia .outras button.ativa{border-color:var(--cor,var(--mostarda));opacity:1}
.hud-reliquia .outras img{width:16px;height:16px;display:block}
.hud-reliquia .outras .tecla{position:static;margin-left:2px}
.cerimonia-reliquia{position:absolute;left:0;right:0;top:26%;text-align:center;opacity:0;transition:opacity .5s;pointer-events:none;
  padding:16px;background:radial-gradient(ellipse at center,rgba(12,11,9,.8) 0%,rgba(12,11,9,.55) 45%,transparent 72%);
  text-shadow:0 2px 0 var(--tinta),0 0 18px rgba(12,11,9,.9)}
.cerimonia-reliquia.visivel{opacity:1}
.cerimonia-reliquia img{width:72px;height:72px;margin:0 auto 6px;display:block;filter:drop-shadow(0 0 10px var(--cor))}
.cerimonia-reliquia .rotulo{font-size:11px;letter-spacing:.45em;color:var(--osso2)}
.cerimonia-reliquia h2{font-family:var(--serifa);font-weight:700;font-size:clamp(26px,5.4vw,48px);letter-spacing:.12em;margin:4px 0;
  color:var(--cor);text-transform:uppercase}
.cerimonia-reliquia .origem{font-family:var(--texto);font-style:italic;font-size:17px;color:var(--osso)}
.cerimonia-reliquia .lema{font-family:var(--texto);font-style:italic;font-size:14px;color:var(--osso2);margin-top:6px}
.cerimonia-reliquia .teclas{font-size:11px;letter-spacing:.2em;color:var(--mostarda);margin-top:10px}
body.toque .cerimonia-reliquia .teclas{display:none}
@media (max-height:500px){.hud-reliquia{top:84px}.cerimonia-reliquia{top:16%}}
`;

export function instalarHudReliquias(jogo, raiz) {
  const estilo = document.createElement('style');
  estilo.textContent = CSS;
  document.head.appendChild(estilo);

  const el = document.createElement('div');
  el.className = 'hud-reliquia';
  el.innerHTML = `
    <button class="slot px" aria-label="Usar relíquia (U)"><img class="px" alt=""><div class="recarga"></div><span class="tecla">U</span></button>
    <div class="info"><div class="nome"></div><div class="efeito"></div><div class="outras"></div></div>`;
  raiz.appendChild(el);
  const cer = document.createElement('div');
  cer.className = 'cerimonia-reliquia';
  cer.innerHTML = `<img class="px" alt=""><div class="rotulo">RELÍQUIA</div><h2></h2><div class="origem"></div>
    <div class="lema">memória tão densa que virou coisa — lê quem a segura</div>
    <div class="teclas">U usa · R alterna</div>`;
  raiz.appendChild(cer);

  const $ = (s) => el.querySelector(s);
  const slot = $('.slot'), img = $('.slot img'), recarga = $('.recarga');
  const nome = $('.nome'), efeito = $('.efeito'), outras = $('.outras');

  // toque: tocar no espaço usa, tocar numa das outras alterna
  const apertar = (acao) => { jogo.input.pressionar(acao); setTimeout(() => jogo.input.soltar(acao), 60); };
  slot.addEventListener('pointerdown', (e) => { e.preventDefault(); apertar('usarReliquia'); });
  outras.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) { e.preventDefault(); apertar('reliquia'); } });

  let timer;
  jogo.eventos.on('reliquia', ({ id, nome: n, origem }) => {
    cer.style.setProperty('--cor', corCss(id));
    cer.querySelector('img').src = iconeReliquia(id);
    cer.querySelector('h2').textContent = n;
    cer.querySelector('.origem').textContent = `fragmento ${origem}`;
    cer.classList.add('visivel');
    clearTimeout(timer);
    timer = setTimeout(() => cer.classList.remove('visivel'), 3800);
  });
  jogo.eventos.on('reliquiaFalha', () => { slot.classList.remove('falha'); void slot.offsetWidth; slot.classList.add('falha'); });

  let ant = '';
  // logo abaixo do quadro dos macacos (a altura dele muda com as bananas do Chico)
  const canto = raiz.querySelector('.hud-canto');
  const posicionar = () => { if (canto) el.style.top = `${Math.round(canto.offsetTop + canto.offsetHeight + 6)}px`; };
  if (canto && typeof ResizeObserver !== 'undefined') new ResizeObserver(posicionar).observe(canto);
  jogo.adicionarSistema({
    atualizar() {
      const s = jogo.reliquias?.estado();
      if (!s || !s.ativa) { if (ant) { el.classList.remove('tem'); ant = ''; } return; }
      const chave = `${s.ativa}|${s.lista.join(',')}|${s.efeito}`;
      if (chave !== ant) {
        ant = chave;
        el.classList.add('tem');
        posicionar();
        el.style.setProperty('--cor', corCss(s.ativa));
        img.src = iconeReliquia(s.ativa);
        nome.textContent = s.info.nome;
        efeito.textContent = s.efeito;
        outras.innerHTML = s.lista.length > 1
          ? s.lista.map((id) => `<button class="px${id === s.ativa ? ' ativa' : ''}" aria-label="${RELIQUIAS[id]?.nome}"><img class="px" src="${iconeReliquia(id)}" alt=""></button>`).join('') + '<span class="tecla">R</span>'
          : '';
      }
      recarga.style.height = `${s.recarga * 100}%`;
      slot.classList.toggle('pronta', s.recarga <= 0);
    },
  });
}
