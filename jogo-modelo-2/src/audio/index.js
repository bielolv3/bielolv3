// Frente C: sons procedurais (WebAudio) ligados aos eventos do jogo.
// Nada toca antes da primeira interação do usuário (política dos navegadores).
// A trilha musical (musica.js + faixas.js) tem volume próprio: tecla N liga/desliga só a música.
import { criarMusica } from './musica.js';

const CHAVE_MUDO = 'primordia.mudo';
// nota grave de cada sala (Hz) — a ruína "zumbe" diferente em cada câmara
const NOTAS = [55, 49, 58.27, 51.91, 46.25, 61.74, 41.2];

export function instalarAudio(jogo) {
  let ctx = null, mestre = null, bus = null, ruidoBuf = null, drone = null;
  let mudo = false;
  try { mudo = localStorage.getItem(CHAVE_MUDO) === '1'; } catch {}
  let salaAtual = null, salaIndice = 0;
  const musica = criarMusica(jogo);
  musica.mudo = mudo;

  function destravar() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    mestre = ctx.createGain();
    mestre.gain.value = mudo ? 0 : 0.7;
    bus = ctx.createGain();
    bus.connect(comp).connect(mestre).connect(ctx.destination);
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    musica.conectar(ctx, mestre, ruidoBuf);
    if (salaAtual) iniciarDrone(salaAtual, salaIndice);
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, destravar, { passive: true });

  // ---- blocos de som
  // tom com envelope e deslize de frequência
  function tom(freq, dur, { tipo = 'square', vol = 0.15, ate = null, atraso = 0, ataque = 0.005 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + atraso;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // ruído filtrado
  function ruido(dur, { freq = 1000, q = 1, tipo = 'bandpass', vol = 0.2, ate = null, atraso = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + atraso;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruidoBuf;
    f.type = tipo; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (ate) f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const arpejo = (notas, passo, opc) => notas.forEach((n, k) => tom(n, passo * 2.2, { ...opc, atraso: k * passo }));

  const SONS = {
    golpe: () => { ruido(0.09, { freq: 1400, ate: 500, q: 0.8, vol: 0.22 }); tom(160, 0.08, { tipo: 'triangle', ate: 70, vol: 0.2 }); },
    acerto: () => { tom(140, 0.12, { tipo: 'square', ate: 55, vol: 0.14 }); ruido(0.06, { freq: 2500, vol: 0.12 }); },
    danoJogador: () => { tom(260, 0.22, { tipo: 'sawtooth', ate: 90, vol: 0.14 }); ruido(0.15, { freq: 600, vol: 0.18, tipo: 'lowpass' }); },
    morte: () => { ruido(0.45, { freq: 900, ate: 120, tipo: 'lowpass', vol: 0.25 }); tom(110, 0.4, { tipo: 'sine', ate: 35, vol: 0.25 }); },
    derrota: () => arpejo([220, 174.6, 146.8, 110], 0.18, { tipo: 'triangle', vol: 0.14 }),
    pulo: () => tom(300, 0.12, { tipo: 'square', ate: 560, vol: 0.06 }),
    pouso: (f) => { ruido(0.09, { freq: 260, tipo: 'lowpass', vol: Math.min(0.2, 0.05 + f * 0.012) }); },
    troca: (m) => {
      const f = { hugo: 196, chico: 392, orlando: 294 }[m] ?? 300;
      tom(f, 0.07, { tipo: 'square', vol: 0.07 }); tom(f * 1.5, 0.09, { tipo: 'square', vol: 0.06, atraso: 0.06 });
    },
    coleta: () => arpejo([523, 659, 784, 1046], 0.05, { tipo: 'triangle', vol: 0.1 }),
    surto: () => {
      tom(55, 0.9, { tipo: 'sawtooth', ate: 165, vol: 0.18, ataque: 0.05 });
      ruido(0.8, { freq: 200, ate: 3000, tipo: 'lowpass', vol: 0.18 });
      tom(110, 0.9, { tipo: 'square', ate: 330, vol: 0.06, atraso: 0.05 });
    },
    porta: () => { ruido(0.9, { freq: 260, ate: 90, tipo: 'lowpass', q: 3, vol: 0.35 }); tom(70, 0.8, { tipo: 'triangle', ate: 50, vol: 0.2 }); },
    selo: () => { ruido(0.25, { freq: 4000, ate: 800, q: 2, vol: 0.2 }); tom(1320, 0.4, { tipo: 'sine', ate: 330, vol: 0.12 }); tom(1980, 0.25, { tipo: 'sine', ate: 660, vol: 0.06 }); },
    parry: () => { tom(1480, 0.35, { tipo: 'sine', vol: 0.14 }); tom(2220, 0.25, { tipo: 'sine', vol: 0.08 }); ruido(0.05, { freq: 5000, vol: 0.15 }); },
    alerta: () => { tom(880, 0.07, { tipo: 'square', vol: 0.06 }); tom(880, 0.07, { tipo: 'square', vol: 0.06, atraso: 0.11 }); },
    sala: () => arpejo([196, 293.7, 392], 0.12, { tipo: 'sine', vol: 0.09 }),
    memoria: () => { arpejo([659, 988, 1319], 0.07, { tipo: 'sine', vol: 0.08 }); tom(2637, 0.6, { tipo: 'sine', vol: 0.025, atraso: 0.15 }); },
    fimSurto: () => tom(330, 0.5, { tipo: 'triangle', ate: 82, vol: 0.1 }),
    seloVolta: () => tom(330, 0.5, { tipo: 'sine', ate: 1320, vol: 0.08 }),
    pulverizar: () => { tom(90, 0.45, { tipo: 'sine', ate: 30, vol: 0.35 }); ruido(0.35, { freq: 700, ate: 100, tipo: 'lowpass', vol: 0.35 }); },
    arremesso: () => ruido(0.16, { freq: 600, ate: 2400, q: 2, vol: 0.12 }),
    seco: () => tom(900, 0.03, { tipo: 'square', vol: 0.04 }),
    guarda: () => { tom(620, 0.12, { tipo: 'square', vol: 0.05 }); ruido(0.05, { freq: 3000, vol: 0.08 }); },
    comer: () => [0, 0.09, 0.18].forEach((a) => ruido(0.05, { freq: 1200, q: 3, vol: 0.12, atraso: a })),
    ferramenta: () => [0, 0.06, 0.12, 0.18].forEach((a) => ruido(0.03, { freq: 3500, q: 4, vol: 0.12, atraso: a })),
    cura: () => arpejo([392, 523, 659], 0.08, { tipo: 'sine', vol: 0.08 }),
    investida: () => { tom(80, 0.5, { tipo: 'sawtooth', ate: 140, vol: 0.12 }); ruido(0.4, { freq: 400, vol: 0.15, tipo: 'lowpass' }); },
    teleporte: () => { tom(1600, 0.25, { tipo: 'sine', ate: 200, vol: 0.08 }); tom(400, 0.25, { tipo: 'sine', ate: 1800, vol: 0.06, atraso: 0.12 }); },
    explosao: (forte) => { ruido(forte ? 1.2 : 0.6, { freq: 1500, ate: 60, tipo: 'lowpass', vol: 0.45 }); tom(60, forte ? 1 : 0.5, { tipo: 'sine', ate: 25, vol: 0.35 }); },
    chefe: () => { tom(41, 2.2, { tipo: 'sawtooth', vol: 0.14, ataque: 0.4 }); tom(61.7, 2.2, { tipo: 'sawtooth', vol: 0.08, ataque: 0.6 }); },
    quebra: () => { ruido(0.2, { freq: 900, q: 1.5, vol: 0.22 }); ruido(0.12, { freq: 300, vol: 0.2, tipo: 'lowpass', atraso: 0.04 }); },
    vitoria: () => arpejo([261.6, 329.6, 392, 523.3, 659.3, 784], 0.12, { tipo: 'triangle', vol: 0.12 }),
  };
  const tocar = (nome, ...a) => { if (ctx && !mudo) SONS[nome]?.(...a); };

  // ---- drone ambiente: dois senos desafinados + oitava abaixo, num passa-baixa que respira
  function iniciarDrone(sala, indice) {
    if (!ctx) return;
    pararDrone();
    if (musica.ligada) return;
    const base = sala.som?.nota ?? NOTAS[indice % NOTAS.length];
    const quanta = sala.som?.quanta ?? sala.chao.join('').split('=').length > 12;
    const t = ctx.currentTime;
    const saida = ctx.createGain();
    saida.gain.setValueAtTime(0.0001, t);
    saida.gain.exponentialRampToValueAtTime(0.09, t + 2.5);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 320; filtro.Q.value = 2;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(filtro.frequency);
    filtro.connect(saida).connect(bus);
    const oscs = [lfo];
    for (const [f, tipo, v] of [[base, 'sine', 0.6], [base * 1.005, 'sine', 0.5], [base / 2, 'triangle', 0.6], [base * 1.5, 'sine', 0.18]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = tipo; o.frequency.value = f; g.gain.value = v;
      o.connect(g).connect(filtro); oscs.push(o);
    }
    // salas Quanta: brilho agudo que pulsa devagar
    if (quanta) {
      const o = ctx.createOscillator(), g = ctx.createGain(), tr = ctx.createOscillator(), trG = ctx.createGain();
      o.type = 'sine'; o.frequency.value = base * 8;
      g.gain.value = 0.012; tr.frequency.value = 0.4; trG.gain.value = 0.01;
      tr.connect(trG).connect(g.gain);
      o.connect(g).connect(saida); oscs.push(o, tr);
    }
    oscs.forEach((o) => o.start(t));
    drone = { saida, oscs };
    abafar(jogo.pausado);
  }
  function pararDrone() {
    if (!drone || !ctx) return;
    const { saida, oscs } = drone, t = ctx.currentTime;
    saida.gain.cancelScheduledValues(t);
    saida.gain.setValueAtTime(Math.max(0.0001, saida.gain.value), t);
    saida.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    oscs.forEach((o) => o.stop(t + 1.3));
    drone = null;
  }
  function abafar(sim) {
    if (!drone || !ctx) return;
    const t = ctx.currentTime;
    drone.saida.gain.cancelScheduledValues(t);
    drone.saida.gain.setTargetAtTime(sim ? 0.03 : 0.09, t, 0.3);
  }

  // ---- eventos do jogo
  const ev = jogo.eventos;
  ev.on('golpe', () => tocar('golpe'));
  ev.on('dano', ({ alvo }) => tocar(alvo === jogo.jogador ? 'danoJogador' : 'acerto'));
  ev.on('morte', ({ alvo } = {}) => { if (alvo !== jogo.jogador) tocar('morte'); });
  ev.on('derrota', () => { if (!musica.ligada) tocar('derrota'); });
  ev.on('troca', ({ macaco } = {}) => tocar('troca', macaco));
  ev.on('coleta', (d) => tocar(d?.tipo === 'memoria' ? 'memoria' : 'coleta'));
  ev.on('surto', (d) => tocar(d?.ativo === false ? 'fimSurto' : 'surto'));
  ev.on('porta', () => tocar('porta'));
  ev.on('selo', (d) => tocar(d?.quebrado === false ? 'seloVolta' : 'selo'));
  ev.on('identidade', ({ tipo } = {}) => tocar({
    pulverizar: 'pulverizar', banana: 'arremesso', agarrao: 'arremesso', arremesso: 'arremesso', sem_banana: 'seco',
  }[tipo]));
  ev.on('recurso', ({ tipo, sucesso } = {}) => tocar(
    tipo === 'guarda' ? 'guarda' : tipo === 'comer' ? 'comer' : tipo === 'ferramenta' ? (sucesso === false ? 'seco' : 'ferramenta') : null));
  ev.on('cura', () => tocar('cura'));
  ev.on('investida', () => tocar('investida'));
  ev.on('teleporte', () => tocar('teleporte'));
  ev.on('explosao', (d) => tocar('explosao', (d?.raio ?? 0) > 4));
  ev.on('chefe', () => tocar('chefe'));
  ev.on('quebra', () => tocar('quebra'));
  ev.on('parry', () => tocar('parry'));
  ev.on('alerta', () => tocar('alerta'));
  ev.on('vitoria', () => { if (!musica.ligada) tocar('vitoria'); });
  ev.on('pulo', () => tocar('pulo'));
  ev.on('pouso', ({ forca = 0 } = {}) => { if (forca > 6) tocar('pouso', forca); });
  ev.on('pausa', ({ pausado }) => abafar(pausado));
  ev.on('sala', ({ sala, indice }) => {
    salaAtual = sala; salaIndice = indice;
    tocar('sala');
    iniciarDrone(sala, indice);
  });

  jogo.audio = {
    get mudo() { return mudo; },
    destravar,
    tocar,
    musica,
    alternarMusica() {
      musica.alternar();
      if (salaAtual) iniciarDrone(salaAtual, salaIndice);
      return musica.ligada;
    },
    alternarMudo() {
      mudo = !mudo;
      musica.mudo = mudo;
      try { localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0'); } catch {}
      if (ctx) mestre.gain.setTargetAtTime(mudo ? 0 : 0.7, ctx.currentTime, 0.05);
      ev.emitir('mudo', { mudo });
    },
  };
  ev.emitir('mudo', { mudo });
  addEventListener('keydown', (e) => { if (e.code === 'KeyN' && !e.repeat) jogo.audio.alternarMusica(); });
}
