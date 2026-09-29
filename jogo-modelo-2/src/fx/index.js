import * as THREE from 'three';
import { Particulas } from './particulas.js';
import { criarPosProcesso } from './pos.js';
import { criarTela } from './tela.js';
import { aproximarDaCamera } from '../world/visual.js';
import { fixo } from '../core/liberar.js';
import { animarMaterial } from '../entities/entidade.js';

// Frente B: efeitos visuais (partículas, flashes, pós-processamento) como sistema.
// Escuta jogo.eventos; para testar no console: jogo.eventos.emitir('morte', { alvo: jogo.jogador })

const COR = {
  osso: 0xe9e1cf, mostarda: 0xd09a2c, quanta: 0x4fa6ab, quantaClara: 0xa8ecea, brasa: 0xc04a2c,
  seiva: 0x7d9b52, legiao: 0x8b94a0, pedra: 0x6b604c, poeira: 0xa8946c,
};

// posição de mundo a partir do que o evento trouxer
function posDe(d) {
  if (!d) return null;
  const p = d.centro ?? d.pos ?? d.alvo?.pos ?? d.selo?.pos ?? d.porta?.pos ?? d.atacante?.pos ?? d.autor?.pos;
  return p ? new THREE.Vector3(p.x, p.y, p.z) : null;
}

const geoArco = new THREE.RingGeometry(0.35, 0.8, 18, 1, -1.15, 2.3).rotateX(-Math.PI / 2);
const geoAnel = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
fixo(geoArco, geoAnel);
const _tam = new THREE.Vector2();

export function instalarEfeitos(jogo) {
  const faiscas = new Particulas(700, true);
  const poeira = new Particulas(700, false);
  // os pontos passam de sala em sala
  fixo(faiscas.pontos.geometry, faiscas.material, poeira.pontos.geometry, poeira.material);
  const transientes = [];   // { obj, t, dur, fn(obj, k) }
  let pos = null;
  const tela = criarTela(jogo);
  try { pos = criarPosProcesso(jogo); jogo.posProcesso = pos; } catch (e) { console.warn('pós-processamento desligado', e); }

  // acesso para testes/console
  jogo.fx = { faiscas, poeira, tela };

  const addTransiente = (obj, dur, fn) => { jogo.cena.add(obj); transientes.push({ obj, t: 0, dur, fn }); };

  function arco(centro, dir, cor = COR.osso, escala = 1) {
    const m = new THREE.Mesh(geoArco, new THREE.MeshBasicMaterial({
      color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    m.position.copy(centro); m.position.y += 0.55;
    m.rotation.y = Math.atan2(-dir.z, dir.x);
    m.renderOrder = 11;
    addTransiente(m, 0.18, (o, k) => { o.scale.setScalar(escala * (0.7 + k * 0.6)); o.material.opacity = (1 - k) * 0.9; o.rotation.y += 0.02; });
  }

  function anel(centro, cor, raio = 1.5, dur = 0.4) {
    const m = new THREE.Mesh(geoAnel, new THREE.MeshBasicMaterial({
      color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    m.position.copy(centro); m.position.y += 0.05;
    m.renderOrder = 11;
    addTransiente(m, dur, (o, k) => { o.scale.setScalar(0.2 + k * raio); o.material.opacity = (1 - k) * 0.8; });
  }

  // ---- números de dano (discretos; desligáveis na pausa: jogo.opcoes.numerosDano)
  const texNumeros = new Map();
  function texNumero(txt, cor) {
    const chave = txt + cor;
    if (!texNumeros.has(chave)) {
      const c = document.createElement('canvas');
      const g = c.getContext('2d');
      g.font = 'bold 10px monospace';
      const w = Math.ceil(g.measureText(txt).width) + 4;
      c.width = w; c.height = 13;
      g.font = 'bold 10px monospace';
      g.textBaseline = 'top';
      g.fillStyle = '#0c0b09';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) g.fillText(txt, 2 + dx, 1 + dy);
      g.fillStyle = cor; g.fillText(txt, 2, 1);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
      t.proporcao = w / 13;
      texNumeros.set(chave, fixo(t));
    }
    return texNumeros.get(chave);
  }
  function numeroDano(p, qtd, forte) {
    if (jogo.opcoes?.numerosDano === false) return;
    const txt = String(+qtd.toFixed(1)).replace('.', ',');
    const tex = texNumero(txt, forte ? '#d09a2c' : '#e9e1cf');
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    const alt = forte ? 0.34 : 0.26;
    s.scale.set(alt * tex.proporcao, alt, 1);
    s.center.set(0.5, 0);
    s.renderOrder = 40;
    s.position.set(p.x + (Math.random() - 0.5) * 0.3, p.y, p.z);
    const y0 = p.y;
    addTransiente(s, 0.65, (o, k) => {
      o.position.y = y0 + Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.55;
      o.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    });
  }

  // entidade atingida pisca branca (shader do sprite, ver Entidade.piscar)
  const doJogador = (o) => o && (o === jogo.jogador || o.autor === jogo.jogador);

  const ev = jogo.eventos;
  ev.on('dano', (d) => {
    const p = posDe(d); if (!p) return;
    const ehJogador = d.alvo && d.alvo === jogo.jogador;
    p.y += 0.6;
    faiscas.emitir({ pos: p, n: 14, cor: ehJogador ? COR.brasa : COR.osso, cor2: COR.mostarda, vel: 5, subir: 0.8, vida: 0.3, tam: 0.07, grav: 6 });
    poeira.emitir({ pos: p, n: 5, cor: COR.poeira, vel: 1.5, vida: 0.4, tam: 0.1, grav: -1 });
    d.alvo?.piscar?.(ehJogador ? 0.06 : 0.09);
    jogo.camera.tremer(ehJogador ? 0.25 : 0.15);
    if (ehJogador) tela.piscar('#c04a2c', 0.35);
    if (d.alvo?.time === 'inimigo' && d.qtd > 0) {
      const forte = d.qtd >= 1.5;
      numeroDano({ x: d.alvo.pos.x, y: d.alvo.pos.y + (d.alvo.altura ?? 1.2) + 0.1, z: d.alvo.pos.z }, d.qtd, forte);
      // hit-stop no golpe forte do jogador
      if (forte && doJogador(d.origem)) jogo.pararImpacto?.(0.055);
      // poeira no rastro do empurrão
      poeira.emitir({ pos: d.alvo.pos, n: 6, cor: COR.poeira, vel: 1.2, espalha: 0.25, subir: 0.3, vida: 0.45, tam: 0.1, grav: -0.5 });
    }
  });

  ev.on('morte', (d) => {
    const p = posDe(d); if (!p) return;
    const q = p.clone(); q.y += 0.5;
    poeira.emitir({ pos: q, n: 26, cor: COR.poeira, cor2: 0x6b5a40, vel: 2.2, espalha: 0.3, subir: 0.6, vida: 0.9, tam: 0.14, grav: -0.8, arrasto: 3 });
    poeira.emitir({ pos: q, n: 16, cor: COR.legiao, cor2: 0x4a5058, vel: 4.5, subir: 1.4, vida: 0.8, tam: 0.09, grav: 14, arrasto: 0.5 });
    faiscas.emitir({ pos: q, n: 10, cor: COR.mostarda, vel: 3, vida: 0.35, tam: 0.06 });
    anel(p, COR.poeira, 1.6, 0.35);
    jogo.camera.tremer(0.2);
    if (d.alvo?.time === 'inimigo') jogo.pararImpacto?.(0.045);
  });

  // ---- poeira dos pés
  ev.on('pouso', ({ alvo, forca }) => {
    const p = alvo?.pos; if (!p) return;
    const k = Math.min(1, (forca - 3) / 9);
    poeira.emitir({ pos: p, n: 6 + Math.round(k * 10), cor: COR.poeira, cor2: 0x8a7a58, vel: 1.6 + k * 2, espalha: 0.15, subir: 0.25, vida: 0.45, tam: 0.1, grav: -0.3, arrasto: 4 });
    if (k > 0.6) jogo.camera.tremer(0.08);
  });
  ev.on('passada', ({ alvo }) => {
    const p = alvo?.pos; if (!p) return;
    const v = alvo.vel, m = Math.hypot(v.x, v.z) || 1;
    poeira.emitir({ pos: p, n: 3, cor: COR.poeira, cor2: 0x8a7a58, vel: 0.8, espalha: 0.1, subir: 0.35, vida: 0.4, tam: 0.08, grav: -0.4, arrasto: 3, dir: { x: -v.x / m * 0.6, z: -v.z / m * 0.6 } });
  });

  // ---- rastro do pulo duplo (Chico): fantasmas do sprite que se apagam
  let rastro = 0, proxFantasma = 0;
  ev.on('pulo', (d) => {
    const j = jogo.jogador; if (!j) return;
    if (d?.duplo) {
      rastro = 0.3; proxFantasma = 0;
      anel(j.pos, COR.osso, 0.9, 0.25);
      poeira.emitir({ pos: j.pos, n: 10, cor: COR.osso, cor2: COR.poeira, vel: 2.2, espalha: 0.1, subir: -0.2, vida: 0.35, tam: 0.08, grav: 2, arrasto: 3 });
    } else if (j.noChao !== false) {
      poeira.emitir({ pos: j.pos, n: 5, cor: COR.poeira, vel: 1.2, espalha: 0.12, subir: 0.2, vida: 0.35, tam: 0.09, grav: -0.3, arrasto: 4 });
    }
  });
  function fantasma(j) {
    const orig = j.sprite; if (!orig?.material.map) return;
    const m = new THREE.SpriteMaterial({ map: orig.material.map, transparent: true, depthWrite: false, opacity: 0.45, fog: false });
    const u = animarMaterial(m), o = orig.material.userData.anim;
    const co = new THREE.Color(COR.osso); u.uCorFixa.value.set(co.r, co.g, co.b, 0.6);
    if (o) { u.uDeform.value.copy(o.uDeform.value); u.uInclina.value = o.uInclina.value; u.uEspelho.value = o.uEspelho.value; }
    const s = new THREE.Sprite(m);
    s.center.copy(orig.center);
    s.scale.copy(orig.scale);
    s.position.copy(j.pos);
    s.renderOrder = 9;
    aproximarDaCamera(s, 0.5);
    addTransiente(s, 0.28, (obj, k) => { obj.material.opacity = 0.45 * (1 - k); });
  }


  ev.on('golpe', (d) => {
    const autor = d.autor;
    const base = autor?.pos ?? posDe(d); if (!base) return;
    if (d.tipo === 'pisao') { anel(base, COR.mostarda, 2.4, 0.35); poeira.emitir({ pos: base, n: 20, cor: COR.poeira, vel: 4, subir: 0.3, vida: 0.5, tam: 0.12, grav: 2 }); jogo.camera.tremer(0.2); return; }
    autor?.animarGolpe?.();
    const dir = autor?.olhando ? autor.olhando.clone().setY(0).normalize() : new THREE.Vector3(1, 0, 0);
    const surto = autor?.surto?.ativo > 0;
    arco(base.clone().addScaledVector(dir, 0.35), dir, surto ? COR.brasa : COR.osso, surto ? 1.3 : 1);
  });

  let surtoEvento = false;
  ev.on('surto', (d) => {
    surtoEvento = d?.ativo !== false;
    if (d?.ativo === false) return;
    const p = jogo.jogador?.pos; if (!p) return;
    const q = p.clone(); q.y += 0.7;
    faiscas.emitir({ pos: q, n: 50, cor: COR.brasa, cor2: COR.mostarda, vel: 6, subir: 0.6, vida: 0.6, tam: 0.08, grav: 2 });
    anel(p, COR.brasa, 3, 0.5);
    tela.piscar('#d09a2c', 0.4);
    jogo.camera.tremer(0.3);
  });

  const teal = (d, forte) => {
    const p = posDe(d); if (!p) return;
    const q = p.clone(); q.y += 0.5;
    faiscas.emitir({ pos: q, n: forte ? 40 : 18, cor: COR.quanta, cor2: COR.quantaClara, vel: forte ? 5 : 2, espalha: 0.4, subir: 1, vida: forte ? 0.8 : 1.1, tam: 0.07, grav: forte ? 4 : -2, arrasto: 2 });
    if (forte) { anel(p, COR.quanta, 2, 0.45); jogo.camera.tremer(0.2); }
  };
  ev.on('selo', (d) => teal(d, d?.quebrado !== false));
  ev.on('porta', (d) => teal(d, false));
  ev.on('parry', (d) => { jogo.pararImpacto?.(0.065); const p = posDe(d); if (p) { p.y += 0.6; faiscas.emitir({ pos: p, n: 20, cor: 0xffffff, cor2: COR.quantaClara, vel: 6, vida: 0.25, tam: 0.06 }); tela.piscar('#ffffff', 0.2); } });
  ev.on('quebra', (d) => { const p = posDe(d); if (p) { p.y += 0.4; poeira.emitir({ pos: p, n: 22, cor: 0x7a5a34, cor2: COR.pedra, vel: 4, subir: 1.2, vida: 0.7, tam: 0.1, grav: 14, arrasto: 0.5 }); } });
  ev.on('cura', (d) => { const p = posDe(d); if (p) faiscas.emitir({ pos: p, n: 16, cor: COR.seiva, cor2: 0xc8e090, vel: 1, espalha: 0.35, subir: 1.5, vida: 0.9, tam: 0.07, grav: -2 }); });
  ev.on('coleta', () => { const p = jogo.jogador?.pos; if (p) { const q = p.clone(); q.y += 0.8; faiscas.emitir({ pos: q, n: 16, cor: COR.mostarda, cor2: COR.osso, vel: 2.5, vida: 0.5, tam: 0.06, grav: -1 }); } });
  ev.on('identidade', (d) => {
    if (d?.tipo === 'pulverizar') { jogo.pararImpacto?.(0.07); const p = posDe(d); if (p) { anel(p, COR.mostarda, 2.8, 0.4); poeira.emitir({ pos: p, n: 30, cor: COR.poeira, vel: 5, subir: 0.4, vida: 0.6, tam: 0.13, grav: 3 }); jogo.camera.tremer(0.3); } }
  });

  jogo.adicionarSistema({
    aoCarregarSala(j) {
      faiscas.limpar(); poeira.limpar();
      for (const t of transientes) { t.obj.removeFromParent(); t.obj.material?.dispose(); }
      transientes.length = 0;
      j.cena.add(faiscas.pontos, poeira.pontos);
      surtoEvento = false;
      rastro = 0;
    },
    atualizar(dt, j) {
      const esc = j.renderer.getDrawingBufferSize(_tam).y / j.camera.tilesNaAltura;
      faiscas.material.uniforms.uEscala.value = poeira.material.uniforms.uEscala.value = esc;
      faiscas.atualizar(dt); poeira.atualizar(dt);
      for (let i = transientes.length - 1; i >= 0; i--) {
        const t = transientes[i];
        t.t += dt;
        const k = Math.min(1, t.t / t.dur);
        t.fn(t.obj, k);
        if (k >= 1) { t.obj.removeFromParent(); t.obj.material?.dispose(); transientes.splice(i, 1); }
      }
      if (rastro > 0 && j.jogador) {
        rastro -= dt; proxFantasma -= dt;
        if (proxFantasma <= 0) { proxFantasma = 0.045; fantasma(j.jogador); }
      }
      // sprites das entidades: puxados para a câmera no depth (não entram na parede de trás)
      for (const e of j.entidades) if (e.sprite && !e.sprite.userData.aproximado) aproximarDaCamera(e.sprite, 0.6);
      // vinheta do surto segue o estado do jogador também
      tela.surto = (surtoEvento || j.jogador?.surto?.ativo > 0) ? 1 : 0;
      tela.atualizar(dt);
    },
  });
}
