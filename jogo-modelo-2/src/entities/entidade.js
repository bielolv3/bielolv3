import * as THREE from 'three';
import { moverCorpo } from '../world/fisica.js';

const carregador = new THREE.TextureLoader();
const cacheTex = new Map();

// textura pixel art (sem filtro) com cache
export function texturaPixel(url) {
  if (!cacheTex.has(url)) {
    let ok;
    const pronta = new Promise((r) => { ok = r; });
    const t = carregador.load(url, () => ok(t));
    t.pronta = pronta;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    cacheTex.set(url, t);
  }
  return cacheTex.get(url);
}

const geoSombra = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const matSombra = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

// Base de tudo que se move/interage. Contrato usado pelo jogo:
//   atualizar(dt)            chamado todo quadro enquanto !removido
//   receberDano(qtd, origem, { atordoa, empurra })
//   removido = true          o jogo tira da cena no fim do quadro
//   time: 'jogador' | 'inimigo' | 'neutro'
export class Entidade {
  constructor(jogo, x, z, { raio = 0.3, vida = 1, time = 'neutro' } = {}) {
    this.jogo = jogo;
    this.pos = new THREE.Vector3(x, jogo.mapa.alturaEm(x, z), z);
    this.vel = new THREE.Vector3();
    this.raio = raio;
    this.vida = this.vidaMax = vida;
    this.time = time;
    this.noChao = false;
    this.atordoado = 0;
    this.invulneravel = 0;
    this.removido = false;
    this.objeto = new THREE.Group();
    this.sombra = new THREE.Mesh(geoSombra, matSombra);
    this.sombra.scale.setScalar(raio * 1.2);
    this.objeto.add(this.sombra);
  }

  // sprite "de pé" que sempre encara a câmera; ancorado nos pés
  definirSprite(url, altura = 1.4) {
    if (!this.sprite) {
      this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5 }));
      this.sprite.center.set(0.5, 0);
      this.objeto.add(this.sprite);
    }
    const tex = texturaPixel(url);
    this.sprite.material.map = tex;
    this.sprite.material.needsUpdate = true;
    const ajustar = () => {
      const img = tex.image;
      this.sprite.scale.set(altura * img.width / img.height, altura, 1);
    };
    this.sprite.scale.set(altura * 0.8, altura, 1);
    tex.pronta.then(ajustar);
    this._alturaSprite = altura;
    return this.sprite;
  }

  // sprite placeholder colorido (para inimigos sem arte ainda)
  definirPlaceholder(cor, larg = 0.7, alt = 1.2) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 24;
    const g = c.getContext('2d');
    g.fillStyle = '#' + new THREE.Color(cor).getHexString();
    g.fillRect(2, 2, 12, 22);
    g.fillStyle = '#e9e1cf'; g.fillRect(4, 6, 3, 3); g.fillRect(9, 6, 3, 3);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    this.sprite.center.set(0.5, 0);
    this.sprite.scale.set(larg, alt, 1);
    this.objeto.add(this.sprite);
  }

  fisica(dt) {
    moverCorpo(this.jogo.mapa, this, dt);
  }

  receberDano(qtd, origem, { atordoa = 0, empurra = 0 } = {}) {
    if (this.invulneravel > 0 || this.removido) return false;
    this.vida -= qtd;
    this.invulneravel = 0.35;
    if (atordoa) this.atordoado = Math.max(this.atordoado, atordoa);
    if (empurra && origem) {
      const d = new THREE.Vector3().subVectors(this.pos, origem.pos ?? origem).setY(0).normalize();
      this.vel.x += d.x * empurra; this.vel.z += d.z * empurra; this.vel.y = Math.max(this.vel.y, 3);
    }
    this.jogo.eventos.emitir('dano', { alvo: this, qtd, origem });
    if (this.vida <= 0) this.morrer();
    return true;
  }

  morrer() { this.removido = true; this.jogo.eventos.emitir('morte', { alvo: this }); }

  // sincroniza o objeto 3D; subclasses chamam no fim do atualizar()
  sincronizar(dt) {
    this.invulneravel = Math.max(0, this.invulneravel - dt);
    this.atordoado = Math.max(0, this.atordoado - dt);
    this.objeto.position.copy(this.pos);
    // sombra fica no chão, mesmo com o corpo no ar
    this.sombra.position.y = this.jogo.mapa.alturaEm(this.pos.x, this.pos.z) - this.pos.y + 0.01;
    if (this.sprite) this.sprite.material.opacity = this.invulneravel > 0 && Math.floor(this.invulneravel * 20) % 2 ? 0.4 : 1;
  }

  distancia(outra) { return Math.hypot(this.pos.x - outra.pos.x, this.pos.z - outra.pos.z); }
}
