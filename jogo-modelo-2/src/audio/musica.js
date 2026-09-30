// Trilha musical procedural (WebAudio puro, sem arquivos): sequenciador com lookahead,
// instrumentos sintetizados, faixas por contexto com camadas dinâmicas, crossfade,
// jingles, efeito do Surto e abafado na pausa. As partituras ficam em faixas.js.
//
// Cadeia: faixas -> duck -> [pausa: passa-baixa + ganho] -> [surto: seco/distorcido + filtro]
//         -> saída (tecla N) -> mestre (tecla M, em index.js). Jingles entram depois da pausa.
import { FAIXAS, JINGLES } from './faixas.js';

const CHAVE = 'primordia.musica';
const VOLUME = 0.55;          // música abaixo dos efeitos
const LOOKAHEAD = 0.12;       // s agendados à frente
const TICK = 50;              // ms entre rodadas do agendador (setTimeout)
const FADE = 2.2;             // s de crossfade entre faixas

// ---------------------------------------------------------------- notação
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(n) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error(`nota inválida: ${n}`);
  return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const PERC = { x: 0.7, X: 1, o: 0.35 };

// texto -> { len, passos: Array(len) de listas de eventos {dur, notas, vel} }
export function compilar(seq) {
  const partes = Array.isArray(seq) ? seq : [seq];
  const ev = []; let p = 0;
  for (const parte of partes) {
    const [txt, trans = 0] = Array.isArray(parte) ? parte : [parte, 0];
    for (const tok of txt.trim().split(/\s+/)) {
      if (tok === '|' || !tok) continue;
      const [corpo, d] = tok.split('*');
      const dur = d ? +d : 1;
      if (corpo in PERC) ev.push({ p, dur, notas: [0], vel: PERC[corpo] });
      else if (corpo !== '.') ev.push({ p, dur, notas: corpo.split('+').map((n) => midi(n) + trans), vel: 1 });
      p += dur;
    }
  }
  const passos = Array.from({ length: p }, () => []);
  for (const e of ev) passos[e.p].push(e);
  return { len: p, passos };
}
const CACHE = new Map();
const compilado = (c) => { if (!CACHE.has(c)) CACHE.set(c, compilar(c.seq)); return CACHE.get(c); };

// ---------------------------------------------------------------- motor
export function criarMusica(jogo) {
  let ligada = true;
  try { ligada = localStorage.getItem(CHAVE) !== '0'; } catch {}
  let ctx = null, ruidoBuf = null, mudo = false;
  let saida, duck, pausaF, pausaG, surtoEntrada, seco, molhado, surtoF, jingleBus, vib, curva;
  const vozes = new Set();  // fontes vivas (osciladores e ruídos)
  let timer = null, tickN = 0;
  const faixas = [];          // tocando (inclusive as que estão saindo)
  let atual = null;           // faixa principal
  const est = {
    titulo: !(navigator.webdriver || new URLSearchParams(location.search).has('jogar')),
    fim: false,               // derrota/vitória: silêncio até a próxima sala ou o título
    sala: null, quanta: false,
    tensaoAte: 0, surto: false, abafado: false, chefeVivo: false,
    transpor: 1, tempo: 1,
  };
  const agora = () => performance.now() / 1000;

  // ---- vozes (contadas para conferir que nada acumula)
  function osc(tipo, f, t, fim, destino, detune = 0, vibrato = false) {
    const o = ctx.createOscillator();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    if (vibrato) vib.connect(o.detune);
    o.connect(destino); o.start(t); o.stop(fim);
    vozes.add(o); o.onended = () => { if (!vozes.delete(o)) return; o.disconnect(); if (vibrato) vib.disconnect(o.detune); };
    return o;
  }
  function ruido(t, fim, destino) {
    const s = ctx.createBufferSource();
    s.buffer = ruidoBuf; s.connect(destino);
    s.start(t, Math.random() * 0.5); s.stop(fim);
    vozes.add(s); s.onended = () => { if (vozes.delete(s)) s.disconnect(); };
    return s;
  }
  function ganho(destino, v = 0) { const g = ctx.createGain(); g.gain.value = v; g.connect(destino); return g; }
  function filtro(destino, tipo, f, q = 1) {
    const b = ctx.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q; b.connect(destino); return b;
  }
  // envelope: sobe até `v` em `a` s, segura até `fim` e solta com constante `r`
  function env(destino, t, v, a, fim, r) {
    const g = ganho(destino);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setTargetAtTime(0, Math.max(t + a, fim), r);
    return g;
  }
  // percussivo: ataque instantâneo, decaimento exponencial
  function perc(destino, t, v, tau) {
    const g = ganho(destino);
    g.gain.setValueAtTime(v, t);
    g.gain.setTargetAtTime(0, t + 0.002, tau);
    return g;
  }

  // ---- instrumentos: (t, f, dur em s, vel, destino)
  const INST = {
    pad(t, f, d, v, out) {
      const a = Math.min(0.9, d * 0.35), g = env(out, t, v, a, t + d, 0.35);
      // uma serra por nota, desafinada para um lado ou outro: o acorde faz o coro (metade das vozes)
      osc('sawtooth', f, t, t + d + 1.4, g, (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5));
    },
    baixo(t, f, d, v, out) {
      const g = ganho(out);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012);
      g.gain.setTargetAtTime(v * 0.55, t + 0.012, 0.18); g.gain.setTargetAtTime(0, t + d * 0.92, 0.06);
      osc('triangle', f, t, t + d + 0.4, g); osc('sine', f, t, t + d + 0.4, g);
    },
    baixoSerra(t, f, d, v, out) {
      const g = ganho(out);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006);
      g.gain.setTargetAtTime(v * 0.4, t + 0.006, 0.08); g.gain.setTargetAtTime(0, t + d * 0.85, 0.03);
      osc('sawtooth', f, t, t + d + 0.2, g); osc('square', f / 2, t, t + d + 0.2, ganho(g, 0.4));
    },
    sino(t, f, d, v, out) {
      osc('sine', f, t, t + 2.6, perc(out, t, v, 0.75));
      osc('sine', f * 2.76, t, t + 1.2, perc(out, t, v * 0.3, 0.22));
    },
    kalimba(t, f, d, v, out) {
      osc('sine', f, t, t + 1.4, perc(out, t, v, 0.38));
      osc('sine', f * 5.9, t, t + 0.35, perc(out, t, v * 0.22, 0.05));
    },
    marimba(t, f, d, v, out) {
      osc('sine', f, t, t + 1.2, perc(out, t, v, 0.26));
      osc('sine', f * 4, t, t + 0.25, perc(out, t, v * 0.28, 0.035));
    },
    flauta(t, f, d, v, out) {
      const g = env(out, t, v, 0.07, t + d * 0.95, 0.07);
      osc('sine', f, t, t + d + 0.6, g, 0, true);
      osc('triangle', f * 2, t, t + d + 0.6, ganho(g, 0.07));
      ruido(t, t + 0.12, perc(filtro(out, 'bandpass', Math.min(8000, f * 3), 1.5), t, v * 0.25, 0.04));
    },
    ocarina(t, f, d, v, out) {
      const g = env(out, t, v, 0.04, t + d * 0.92, 0.08);
      osc('triangle', f, t, t + d + 0.6, g, 0, true);
      osc('sine', f, t, t + d + 0.6, ganho(g, 0.6));
    },
    arp(t, f, d, v, out) { osc('square', f, t, t + 0.32, perc(out, t, v, 0.07)); },
    serra(t, f, d, v, out) {
      const g = env(out, t, v, 0.02, t + d * 0.9, 0.1);
      osc('sawtooth', f, t, t + d + 0.7, g, -12); osc('sawtooth', f, t, t + d + 0.7, g, 12);
    },
    metal(t, f, d, v, out) {
      const g = env(out, t, v, 0.015, t + d * 0.9, 0.08);
      osc('sawtooth', f, t, t + d + 0.6, g); osc('square', f / 2, t, t + d + 0.6, ganho(g, 0.5));
    },
    tambor(t, f, d, v, out) {
      const o = osc('sine', 110, t, t + 0.6, perc(out, t, v, 0.17));
      o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
      ruido(t, t + 0.3, perc(filtro(out, 'lowpass', 380, 1), t, v * 0.45, 0.05));
    },
    pedra(t, f, d, v, out) {
      ruido(t, t + 0.25, perc(filtro(out, 'bandpass', 1100 + Math.random() * 300, 2.5), t, v, 0.04));
      const o = osc('sine', 230, t, t + 0.2, perc(out, t, v * 0.4, 0.03));
      o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    },
    madeira(t, f, d, v, out) {
      const o = osc('sine', 860, t, t + 0.18, perc(out, t, v, 0.028));
      o.frequency.exponentialRampToValueAtTime(760, t + 0.05);
    },
    chimbal(t, f, d, v, out) { ruido(t, t + 0.12, perc(filtro(out, 'highpass', 7000, 0.8), t, v, 0.02)); },
    shaker(t, f, d, v, out) {
      const g = ganho(filtro(out, 'bandpass', 6000, 1));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.025); g.gain.setTargetAtTime(0, t + 0.03, 0.035);
      ruido(t, t + 0.25, g);
    },
  };
  const PERCUSSAO = new Set(['tambor', 'pedra', 'madeira', 'chimbal', 'shaker']);

  // pássaros: dois ou três piados curtos e agudos, bem baixos
  function passaro(t, out) {
    const n = 2 + (Math.random() * 2 | 0), base = 2600 + Math.random() * 1400;
    for (let k = 0; k < n; k++) {
      const tk = t + k * (0.09 + Math.random() * 0.05);
      const o = osc('sine', base, tk, tk + 0.12, perc(out, tk, 0.018, 0.035));
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), tk + 0.06);
    }
  }

  // ---- faixa: camadas agrupadas, cada grupo com seu ganho (fade independente)
  class Faixa {
    constructor(nome, def, destino, { unica = false, fadeIn = FADE } = {}) {
      Object.assign(this, { nome, def, unica });
      const t = ctx.currentTime;
      this.saida = ganho(destino);
      this.saida.gain.setValueAtTime(0.0001, t);
      if (fadeIn > 0.05) this.saida.gain.linearRampToValueAtTime(1, t + fadeIn); else this.saida.gain.setValueAtTime(1, t);
      this.grupos = {}; this.alvos = {}; this.zeroDesde = {};
      for (const [g, v] of Object.entries(def.grupos ?? { base: 1 })) {
        this.grupos[g] = ganho(this.saida, v); this.alvos[g] = v; this.zeroDesde[g] = v > 0 ? Infinity : -Infinity;
      }
      this.camadas = def.camadas.map((c) => {
        const grupo = this.grupos[c.grupo ?? 'base'] ?? this.grupos.base;
        let no = grupo;
        if (c.distorcer) { const s = ctx.createWaveShaper(); s.curve = curva; s.oversample = 'none'; s.connect(no); no = s; }
        if (c.filtro) no = filtro(no, ...c.filtro);
        return { ...c, grupo: c.grupo ?? 'base', entrada: ganho(no, 1), pad: compilado(c) };
      });
      this.len = Math.max(...this.camadas.map((c) => c.pad.len));
      this.passo = 0;
      this.prox = t + 0.08;
      this.saindo = false;
      this.fimEm = Infinity;
    }
    duracaoPasso() { return 60 / (this.def.bpm * (this.unica ? 1 : est.tempo)) / this.def.ppb; }
    grupo(nome, alvo, tau = 1.2) {
      const g = this.grupos[nome];
      if (!g || this.alvos[nome] === alvo) return;
      this.alvos[nome] = alvo;
      this.zeroDesde[nome] = alvo > 0 ? Infinity : ctx.currentTime;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(alvo, ctx.currentTime, tau);
    }
    agendar(ate) {
      while (this.prox < ate && !this.acabou) {
        if (this.unica && this.passo >= this.len) { this.acabou = true; this.fimEm = this.prox + 3.5; break; }
        const t = this.prox, dp = this.duracaoPasso();
        for (const c of this.camadas) {
          // grupo em silêncio há mais de 3 s: nem agenda (CPU)
          if (this.alvos[c.grupo] === 0 && t - this.zeroDesde[c.grupo] > 3) continue;
          const evs = c.pad.passos[this.passo % c.pad.len];
          for (const e of evs) {
            if (c.prob && Math.random() > c.prob) continue;
            const v = c.vol * e.vel * (0.88 + Math.random() * 0.12);
            const tr = PERCUSSAO.has(c.inst) ? 1 : (this.unica ? 1 : est.transpor);
            for (const n of e.notas) INST[c.inst](t, hz(n + (c.trans ?? 0)) * tr, e.dur * dp, v, c.entrada);
          }
        }
        // pássaros no começo de alguns compassos
        if (this.def.passaros && this.passo % this.def.compasso === 0 && Math.random() < 0.3) passaro(t + Math.random() * 1.5, this.saida);
        this.passo++;
        this.prox += dp;
      }
    }
    parar(fade = FADE) {
      if (this.saindo) return;
      this.saindo = true;
      const t = ctx.currentTime;
      this.saida.gain.cancelScheduledValues(t);
      this.saida.gain.setValueAtTime(Math.max(0.0001, this.saida.gain.value), t);
      this.saida.gain.linearRampToValueAtTime(0.0001, t + fade);
      this.fimEm = t + fade + 0.1;
    }
    liberar() { this.saida.disconnect(); }
  }

  // ---- conexão (chamada por index.js quando o contexto de áudio nasce)
  function conectar(c, destino, buf) {
    ctx = c; ruidoBuf = buf;
    saida = ganho(destino, ativa() ? VOLUME : 0);
    // Surto: seco + ramo distorcido, passando por um passa-baixa que "respira"
    surtoF = filtro(saida, 'lowpass', 20000, 0.7);
    seco = ganho(surtoF, 1);
    curva = new Float32Array(1024);
    for (let k = 0; k < 1024; k++) { const x = k / 511.5 - 1; curva[k] = Math.tanh(x * 4); }
    const shaper = ctx.createWaveShaper(); shaper.curve = curva; shaper.oversample = 'none';
    molhado = ganho(surtoF, 0);
    shaper.connect(molhado);
    surtoEntrada = ganho(seco, 1); surtoEntrada.connect(shaper);
    // pausa
    pausaG = ganho(surtoEntrada, 1);
    pausaF = filtro(pausaG, 'lowpass', 20000, 0.8);
    duck = ganho(pausaF, 1);
    jingleBus = ganho(surtoEntrada, 1);
    // vibrato compartilhado (um único LFO para todas as flautas/ocarinas)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    vib = ctx.createGain(); vib.gain.value = 9;
    lfo.connect(vib); lfo.start();
    avaliar();
    if (!timer) timer = setTimeout(tick, TICK);
  }

  function tick() {
    timer = setTimeout(tick, TICK);
    if (!ctx || ctx.state !== 'running') return;
    if (++tickN % 5 === 0) avaliar();
    const ate = ctx.currentTime + LOOKAHEAD, t = ctx.currentTime;
    for (let k = faixas.length - 1; k >= 0; k--) {
      const f = faixas[k];
      if (t > f.fimEm) { f.liberar(); faixas.splice(k, 1); if (atual === f) atual = null; continue; }
      if (!f.saindo || t < f.fimEm - 0.2) f.agendar(ate);
      else f.agendar(t); // saindo: só avança o relógio
    }
  }

  const ativa = () => ligada && !mudo;

  function trocar(nome) {
    if (!ctx) return;
    if (atual && atual.nome === nome && !atual.saindo) return;
    atual?.parar();
    atual = null;
    if (nome && FAIXAS[nome]) { atual = new Faixa(nome, FAIXAS[nome], duck); faixas.push(atual); }
  }

  function jingle(nome) {
    if (!ctx || !ativa() || !JINGLES[nome]) return;
    const f = new Faixa(nome, JINGLES[nome], jingleBus, { unica: true, fadeIn: 0 });
    faixas.push(f);
    const dur = f.len * f.duracaoPasso(), t = ctx.currentTime;
    duck.gain.cancelScheduledValues(t);
    duck.gain.setTargetAtTime(0.2, t, 0.08);
    duck.gain.setTargetAtTime(1, t + dur, 0.8);
  }

  // ---- escolha da faixa e das camadas pelo estado do jogo (4x por segundo)
  function tituloVisivel() {
    const el = document.querySelector('.acoes-titulo');
    return !!el?.closest('.visivel');
  }
  function avaliar() {
    if (!ctx) return;
    // título: tela de título visível (submenus de salas/confirmar mantêm)
    if (tituloVisivel()) { est.titulo = true; est.fim = false; }
    else if (est.titulo && !document.body.classList.contains('em-tela')) est.titulo = false;

    const j = jogo.jogador;
    let chefe = null, matriarca = null, perto = false, faunaBrava = false;
    for (const e of jogo.entidades ?? []) {
      if (e.removido || !(e.vida > 0) || e.time !== 'inimigo') continue;
      if (e.ehMatriarca) { matriarca = e; continue; }
      if (e.ehChefe) { chefe = e; continue; }
      if (e.ehFauna) { if (e.irritado) faunaBrava = true; continue; }
      if (e.alertado > 0) perto = true;
      else if (j && !(e.atordoado > 0)) {
        const dx = e.pos.x - j.pos.x, dz = e.pos.z - j.pos.z;
        if (dx * dx + dz * dz < 36) perto = true;
      }
    }
    // chefe vencido: fanfarra curta
    if (est.chefeVivo && !chefe && !est.fim && !est.titulo) jingle('vitoriaSala');
    est.chefeVivo = !!chefe;

    let nome = null;
    if (!ativa() || est.fim) nome = null;
    else if (est.forcada) nome = est.forcada;
    else if (est.titulo) nome = 'titulo';
    else if (est.sala?.musica) nome = est.sala.musica;
    else if (chefe) nome = 'chefe';
    else if (est.sala?.bioma === 'seiva') nome = 'seiva';
    else if (est.quanta) nome = 'circuito';
    else if (est.sala) nome = 'santuario';
    trocar(nome);

    if (atual) {
      const tenso = perto || faunaBrava || agora() < est.tensaoAte;
      atual.grupo('tensao', tenso && !est.titulo ? 1 : 0, tenso ? 0.4 : 1.5);
      const ira = !!matriarca?.irritado;
      atual.grupo('ira', ira ? 1 : 0, ira ? 0.3 : 2);
      atual.grupo('calma', ira ? 0.25 : 1, 1);
    }
    // pausa (fora do título): abaixa e abafa
    const abafar = !!jogo.pausado && !est.titulo && !est.fim;
    if (abafar !== est.abafado) {
      est.abafado = abafar;
      const t = ctx.currentTime;
      pausaF.frequency.setTargetAtTime(abafar ? 650 : 20000, t, 0.25);
      pausaG.gain.setTargetAtTime(abafar ? 0.4 : 1, t, 0.25);
    }
  }

  // ---- Surto: distorção, filtro que respira, andamento +12% e meio tom acima
  let surtoLfo = null;
  function surto(sim) {
    if (est.surto === sim || !ctx) { est.surto = sim; return; }
    est.surto = sim;
    const t = ctx.currentTime;
    est.tempo = sim ? 1.12 : 1; est.transpor = sim ? 2 ** (1 / 12) : 1;
    seco.gain.setTargetAtTime(sim ? 0.55 : 1, t, 0.2);
    molhado.gain.setTargetAtTime(sim ? 0.22 : 0, t, 0.2);
    surtoF.frequency.cancelScheduledValues(t);
    if (sim) {
      surtoF.frequency.setTargetAtTime(2400, t, 0.3); surtoF.Q.setTargetAtTime(6, t, 0.3);
      surtoLfo = ctx.createOscillator(); surtoLfo.frequency.value = 0.9;
      const lg = ganho(surtoF.frequency, 1500);
      surtoLfo.connect(lg); surtoLfo.start(t);
      surtoLfo.onended = () => lg.disconnect();
    } else {
      surtoLfo?.stop(t + 0.05); surtoLfo = null;
      surtoF.frequency.setTargetAtTime(20000, t, 0.4); surtoF.Q.setTargetAtTime(0.7, t, 0.3);
    }
  }

  // ---- eventos
  const ev = jogo.eventos;
  ev.on('sala', ({ sala }) => {
    est.sala = sala; est.fim = false; est.chefeVivo = false; surto(false);
    const quantas = (jogo.entidades ?? []).filter((e) => e.faccao === 'quanta' && !e.ehChefe).length;
    est.quanta = sala.som?.quanta ?? (sala.chao.join('').split('=').length > 12 || quantas >= 3);
    avaliar();
  });
  ev.on('comecar', () => { est.titulo = false; est.fim = false; avaliar(); });
  ev.on('alerta', () => { est.tensaoAte = Math.max(est.tensaoAte, agora() + 8); avaliar(); });
  ev.on('dano', ({ alvo, origem } = {}) => {
    if (alvo === jogo.jogador || alvo?.time === 'inimigo' || origem?.time === 'inimigo') est.tensaoAte = Math.max(est.tensaoAte, agora() + 5);
  });
  ev.on('chefe', () => avaliar());
  ev.on('surto', (d) => surto(d?.ativo !== false));
  ev.on('pausa', () => avaliar());
  ev.on('reliquia', () => jingle('reliquia'));
  ev.on('derrota', () => { est.fim = true; surto(false); avaliar(); jingle('derrota'); });
  ev.on('vitoria', () => { est.fim = true; surto(false); avaliar(); jingle('vitoriaFinal'); });

  function aplicarVolume() {
    if (!ctx) return;
    saida.gain.setTargetAtTime(ativa() ? VOLUME : 0, ctx.currentTime, 0.3);
    if (!ativa()) { for (const f of faixas) f.parar(0.6); atual = null; }
    avaliar();
  }

  return {
    conectar,
    get ligada() { return ligada; },
    get faixa() { return atual?.nome ?? null; },
    get vozes() { return vozes.size; },
    get faixasAtivas() { return faixas.length; },
    get estado() { return { ...est, sala: est.sala?.nome }; },
    grupos() { return atual ? { ...atual.alvos } : {}; },
    alternar() {
      ligada = !ligada;
      try { localStorage.setItem(CHAVE, ligada ? '1' : '0'); } catch {}
      aplicarVolume();
      ev.emitir('musica', { ligada });
      return ligada;
    },
    set mudo(v) { mudo = v; aplicarVolume(); },
    jingle,
    // para testes: força uma faixa (null volta à escolha automática no próximo ciclo)
    forcar(nome) { est.forcada = nome; avaliar(); },
  };
}
