import * as THREE from 'three';
import { Input } from './input.js';
import { CameraIso } from './camera.js';
import { Eventos } from './eventos.js';
import { Tilemap } from '../world/tilemap.js';
import { LEGENDA_COISAS } from '../world/tiles.js';
import { Jogador } from '../entities/jogador.js';
import { REGISTRO } from '../entities/registro.js';
import { SALAS } from '../levels/index.js';
import { montarAmbiente } from '../world/ambiente.js';

// Dono do loop, da cena e da lista de entidades. Sistemas extras (HUD, áudio,
// habilidades, efeitos) se penduram em `jogo.eventos` e em `jogo.sistemas`.
export class Jogo {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.input = new Input();
    this.camera = new CameraIso(14);
    this.eventos = new Eventos();
    this.sistemas = [];         // objetos com atualizar(dt) opcional e aoCarregarSala(jogo) opcional
    this.entidades = [];
    this.indiceSala = 0;
    this.pausado = false;

    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.redimensionar(innerWidth, innerHeight);
    });
  }

  adicionarSistema(s) { this.sistemas.push(s); return s; }

  carregarSala(indice) {
    this.indiceSala = indice;
    const sala = SALAS[indice];
    this.cena = new THREE.Scene();
    montarAmbiente(this);
    this.mapa = new Tilemap(sala);
    this.cena.add(this.mapa.construirMalha());
    this.entidades = [];

    const inicio = this.mapa.coisas.find((c) => LEGENDA_COISAS[c.letra] === 'inicio') ?? { i: 1, j: 1 };
    this.inicio = new THREE.Vector3(inicio.i + .5, this.mapa.alturaEm(inicio.i + .5, inicio.j + .5), inicio.j + .5);
    const antigo = this.jogador;
    this.jogador = new Jogador(this, this.inicio.x, this.inicio.z);
    if (antigo) { this.jogador.vida = antigo.vida; this.jogador.surto = antigo.surto; this.jogador.trocar(antigo.atual, true); }
    this.adicionar(this.jogador);

    for (const c of this.mapa.coisas) {
      const tipo = LEGENDA_COISAS[c.letra];
      const Classe = REGISTRO[tipo];
      if (Classe) this.adicionar(new Classe(this, c.i + .5, c.j + .5, c));
      else if (tipo !== 'inicio') console.warn(`sem entidade para '${c.letra}' (${tipo})`);
    }
    this.camera.alvo.copy(this.jogador.pos);
    this.sistemas.forEach((s) => s.aoCarregarSala?.(this, sala));
    this.eventos.emitir('sala', { sala, indice });
  }

  adicionar(e) { this.entidades.push(e); this.cena.add(e.objeto); return e; }

  proximaSala() {
    if (this._trocando) return;
    this._trocando = true;
    queueMicrotask(() => {
      this._trocando = false;
      if (this.indiceSala + 1 < SALAS.length) this.carregarSala(this.indiceSala + 1);
      else this.eventos.emitir('vitoria', {});
    });
  }

  reiniciarSala() { this.jogador = null; this.carregarSala(this.indiceSala); }

  passo(dt) {
    const { input } = this;
    if (input.apertou('pausa')) { this.pausado = !this.pausado; this.eventos.emitir('pausa', { pausado: this.pausado }); }
    if (!this.pausado) {
      if (input.apertou('girarEsq')) this.camera.girar(-1);
      if (input.apertou('girarDir')) this.camera.girar(1);
      for (const e of this.entidades) if (!e.removido) e.atualizar(dt);
      for (const e of this.entidades) if (e.removido) this.cena.remove(e.objeto);
      this.entidades = this.entidades.filter((e) => !e.removido);
      this.sistemas.forEach((s) => s.atualizar?.(dt, this));
      this.camera.atualizar(dt, this.jogador.pos);
      // sombra acompanha o jogador para caber em salas grandes
      this.sol.position.copy(this.jogador.pos).add(new THREE.Vector3(8, 16, 4));
      this.sol.target.position.copy(this.jogador.pos);
    }
    input.fimDoQuadro();
  }

  iniciar() {
    this.carregarSala(0);
    let anterior = performance.now();
    const quadro = (agora) => {
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      this.passo(dt);
      this.renderer.render(this.cena, this.camera.cam);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }
}
