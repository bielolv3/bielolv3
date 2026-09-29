import * as THREE from 'three';
import { Particulas } from './particulas.js';
import { criarPosProcesso } from './pos.js';
import { aproximarDaCamera } from '../world/visual.js';

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

export function instalarEfeitos(jogo) {
  const faiscas = new Particulas(700, true);
  const poeira = new Particulas(700, false);
  const transientes = [];   // { obj, t, dur, fn(obj, k) }
  let pos = null;
  try { pos = criarPosProcesso(jogo); jogo.posProcesso = pos; } catch (e) { console.warn('pós-processamento desligado', e); }

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

  // entidade atingida pisca clara (a cor do sprite multiplica a textura)
  const piscando = new Map();
  function piscarSprite(ent) {
    const m = ent?.sprite?.material;
    if (!m?.color) return;
    if (!piscando.has(m)) piscando.set(m, { orig: m.color.clone(), t: 0 });
    piscando.get(m).t = 0.09;
    m.color.setRGB(3, 2.6, 2.2);
  }

  const ev = jogo.eventos;
  ev.on('dano', (d) => {
    const p = posDe(d); if (!p) return;
    const ehJogador = d.alvo && d.alvo === jogo.jogador;
    p.y += 0.6;
    faiscas.emitir({ pos: p, n: 14, cor: ehJogador ? COR.brasa : COR.osso, cor2: COR.mostarda, vel: 5, subir: 0.8, vida: 0.3, tam: 0.07, grav: 6 });
    poeira.emitir({ pos: p, n: 5, cor: COR.poeira, vel: 1.5, vida: 0.4, tam: 0.1, grav: -1 });
    piscarSprite(d.alvo);
    jogo.camera.tremer(ehJogador ? 0.25 : 0.15);
    if (ehJogador) pos?.piscar(COR.brasa, 0.35);
  });

  ev.on('morte', (d) => {
    const p = posDe(d); if (!p) return;
    const q = p.clone(); q.y += 0.5;
    poeira.emitir({ pos: q, n: 26, cor: COR.poeira, cor2: 0x6b5a40, vel: 2.2, espalha: 0.3, subir: 0.6, vida: 0.9, tam: 0.14, grav: -0.8, arrasto: 3 });
    poeira.emitir({ pos: q, n: 16, cor: COR.legiao, cor2: 0x4a5058, vel: 4.5, subir: 1.4, vida: 0.8, tam: 0.09, grav: 14, arrasto: 0.5 });
    faiscas.emitir({ pos: q, n: 10, cor: COR.mostarda, vel: 3, vida: 0.35, tam: 0.06 });
    anel(p, COR.poeira, 1.6, 0.35);
    jogo.camera.tremer(0.2);
  });

  ev.on('golpe', (d) => {
    const autor = d.autor;
    const base = autor?.pos ?? posDe(d); if (!base) return;
    if (d.tipo === 'pisao') { anel(base, COR.mostarda, 2.4, 0.35); poeira.emitir({ pos: base, n: 20, cor: COR.poeira, vel: 4, subir: 0.3, vida: 0.5, tam: 0.12, grav: 2 }); jogo.camera.tremer(0.2); return; }
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
    pos?.piscar(COR.mostarda, 0.4);
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
  ev.on('parry', (d) => { const p = posDe(d); if (p) { p.y += 0.6; faiscas.emitir({ pos: p, n: 20, cor: 0xffffff, cor2: COR.quantaClara, vel: 6, vida: 0.25, tam: 0.06 }); pos?.piscar(0xffffff, 0.2); } });
  ev.on('quebra', (d) => { const p = posDe(d); if (p) { p.y += 0.4; poeira.emitir({ pos: p, n: 22, cor: 0x7a5a34, cor2: COR.pedra, vel: 4, subir: 1.2, vida: 0.7, tam: 0.1, grav: 14, arrasto: 0.5 }); } });
  ev.on('cura', (d) => { const p = posDe(d); if (p) faiscas.emitir({ pos: p, n: 16, cor: COR.seiva, cor2: 0xc8e090, vel: 1, espalha: 0.35, subir: 1.5, vida: 0.9, tam: 0.07, grav: -2 }); });
  ev.on('coleta', () => { const p = jogo.jogador?.pos; if (p) { const q = p.clone(); q.y += 0.8; faiscas.emitir({ pos: q, n: 16, cor: COR.mostarda, cor2: COR.osso, vel: 2.5, vida: 0.5, tam: 0.06, grav: -1 }); } });
  ev.on('identidade', (d) => {
    if (d?.tipo === 'pulverizar') { const p = posDe(d); if (p) { anel(p, COR.mostarda, 2.8, 0.4); poeira.emitir({ pos: p, n: 30, cor: COR.poeira, vel: 5, subir: 0.4, vida: 0.6, tam: 0.13, grav: 3 }); jogo.camera.tremer(0.3); } }
  });

  jogo.adicionarSistema({
    aoCarregarSala(j) {
      faiscas.limpar(); poeira.limpar();
      for (const t of transientes) t.obj.removeFromParent();
      transientes.length = 0;
      j.cena.add(faiscas.pontos, poeira.pontos);
      surtoEvento = false;
    },
    atualizar(dt, j) {
      const esc = j.renderer.getDrawingBufferSize(new THREE.Vector2()).y / j.camera.tilesNaAltura;
      faiscas.material.uniforms.uEscala.value = poeira.material.uniforms.uEscala.value = esc;
      faiscas.atualizar(dt); poeira.atualizar(dt);
      for (let i = transientes.length - 1; i >= 0; i--) {
        const t = transientes[i];
        t.t += dt;
        const k = Math.min(1, t.t / t.dur);
        t.fn(t.obj, k);
        if (k >= 1) { t.obj.removeFromParent(); t.obj.material?.dispose(); transientes.splice(i, 1); }
      }
      for (const [m, s] of piscando) { s.t -= dt; if (s.t <= 0) { m.color.copy(s.orig); piscando.delete(m); } }
      // sprites das entidades: puxados para a câmera no depth (não entram na parede de trás)
      for (const e of j.entidades) if (e.sprite && !e.sprite.userData.aproximado) aproximarDaCamera(e.sprite, 0.6);
      // vinheta do surto segue o estado do jogador também
      if (pos) pos.surto = (surtoEvento || j.jogador?.surto?.ativo > 0) ? 1 : 0;
    },
  });
}
