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
import { liberar, recursosEm } from './liberar.js';
import { U as UVISUAL } from '../world/visual.js';

const OFFSET_SOL = new THREE.Vector3(8, 16, 4);
const CHAVE_PROGRESSO = 'primordia.progresso';
const CHAVE_OPCOES = 'primordia.opcoes';
// transição entre salas (segundos): íris fecha, tela preta com o nome, íris abre
export const TRANSICAO = { fechar: 0.4, preto: 0.6, abrir: 0.5 };

function lerJSON(chave) {
  try { const v = JSON.parse(localStorage.getItem(chave) ?? 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; }
}
function gravarJSON(chave, v) {
  try { localStorage.setItem(chave, JSON.stringify(v)); } catch {}
}

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
    this.impacto = 0;           // hit-stop: segundos em que as entidades ficam paradas
    this.transicao = null;      // { fase: 'fechar'|'preto'|'abrir', t, alvo }
    // progresso salvo: maior sala alcançada e relíquias (a frente Relíquias usa .reliquias)
    this.progresso = { salaMax: 0, reliquias: [], ...lerJSON(CHAVE_PROGRESSO) };
    this.opcoes = { numerosDano: true, ...lerJSON(CHAVE_OPCOES) };
    // morrer e pisar na saída no mesmo quadro: a derrota vence
    this.eventos.on('derrota', () => { if (this.transicao?.fase === 'fechar') this.cancelarTransicao(); });

    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.redimensionar(innerWidth, innerHeight);
    });
  }

  adicionarSistema(s) { this.sistemas.push(s); return s; }

  salvarProgresso() { gravarJSON(CHAVE_PROGRESSO, this.progresso); }
  salvarOpcoes() { gravarJSON(CHAVE_OPCOES, this.opcoes); }
  get temProgresso() { return this.progresso.salaMax > 0 || (this.progresso.reliquias?.length ?? Object.keys(this.progresso.reliquias ?? {}).length) > 0; }

  // "Novo jogo": zera o progresso (mantém o mesmo objeto, outros módulos guardam referência)
  apagarProgresso() {
    for (const k of Object.keys(this.progresso)) delete this.progresso[k];
    Object.assign(this.progresso, { salaMax: 0, reliquias: [] });
    this.salvarProgresso();
    this.eventos.emitir('progresso', { apagado: true, progresso: this.progresso });
  }

  // hit-stop: congela as entidades por `seg` (o render e os efeitos seguem)
  pararImpacto(seg = 0.05) { this.impacto = Math.max(this.impacto, seg); }

  carregarSala(indice) {
    // carregamento direto (testes, reinício) cancela transição pendente
    if (!this._carregandoTransicao) this.transicao = null;
    this._trocando = false;
    this.impacto = 0;
    if (indice > (this.progresso.salaMax ?? 0)) { this.progresso.salaMax = indice; this.salvarProgresso(); }
    this.indiceSala = indice;
    const sala = SALAS[indice];
    const cenaAntiga = this.cena;
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
    else if (this.entrada?.indice === indice) {
      // reinício: Surto e bananas voltam ao que eram ao entrar na sala (vida cheia)
      this.jogador.surto.carga = this.entrada.carga;
      if (this.habilidades) this.habilidades.recursos.bananas = this.entrada.bananas;
    }
    this.entrada = { indice, carga: this.jogador.surto.carga, bananas: this.habilidades?.recursos.bananas };
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
    // libera a GPU da sala anterior (menos o que a nova reaproveita)
    if (cenaAntiga) liberar(cenaAntiga, recursosEm(this.cena));
  }

  adicionar(e) { this.entidades.push(e); this.cena.add(e.objeto); return e; }

  proximaSala() {
    if (this._trocando || this.transicao) return;
    if (!this.jogador || this.jogador.vida <= 0) return;   // já caído: a derrota vence
    this._trocando = true;
    this.transicao = { fase: 'fechar', t: 0, alvo: this.indiceSala + 1 < SALAS.length ? this.indiceSala + 1 : 'vitoria' };
  }

  cancelarTransicao() { this.transicao = null; this._trocando = false; }

  // avança a transição; durante 'fechar' e 'preto' as entidades ficam paradas
  atualizarTransicao(dt) {
    const tr = this.transicao;
    tr.t += dt;
    if (tr.fase === 'fechar' && tr.t >= TRANSICAO.fechar) {
      if (this.jogador?.vida <= 0) { this.cancelarTransicao(); return; }
      if (tr.alvo === 'vitoria') { this.transicao = null; this._trocando = false; this.eventos.emitir('vitoria', {}); return; }
      this._carregandoTransicao = true;
      try { this.carregarSala(tr.alvo); } finally { this._carregandoTransicao = false; }
      this.transicao = { fase: 'preto', t: 0, alvo: tr.alvo };
    } else if (tr.fase === 'preto' && tr.t >= TRANSICAO.preto) {
      this.transicao = { fase: 'abrir', t: 0, alvo: tr.alvo };
    } else if (tr.fase === 'abrir' && tr.t >= TRANSICAO.abrir) {
      this.transicao = null;
    }
  }

  // entra numa sala vindo de uma tela (título, seleção, reinício): começa no preto
  entrarComTransicao(indice) {
    this._carregandoTransicao = true;
    try { this.carregarSala(indice); } finally { this._carregandoTransicao = false; }
    this.transicao = { fase: 'preto', t: TRANSICAO.preto * 0.5, alvo: indice };
  }

  reiniciarSala() { this.jogador = null; this.entrarComTransicao(this.indiceSala); }

  // começa numa sala escolhida (Continuar / seleção de salas): vida e bananas cheias
  irParaSala(indice) {
    this.jogador = null;
    this.entrada = null;
    const r = this.habilidades?.recursos;
    if (r) r.bananas = r.bananasMax;
    this.entrarComTransicao(Math.max(0, Math.min(SALAS.length - 1, indice)));
  }

  // do zero (depois da vitória): vida e bananas cheias, Surto vazio
  novoJogo() {
    this.jogador = null;
    this.entrada = null;
    const r = this.habilidades?.recursos;
    if (r) r.bananas = r.bananasMax;
    this.entrarComTransicao(0);
  }

  passo(dt) {
    const { input } = this;
    // sem pausa no meio da transição (a tela está preta)
    if (input.apertou('pausa') && !this.transicao) { this.pausado = !this.pausado; this.eventos.emitir('pausa', { pausado: this.pausado }); }
    let guardarEntrada = false;
    if (!this.pausado) {
      if (input.apertou('girarEsq')) this.camera.girar(-1);
      if (input.apertou('girarDir')) this.camera.girar(1);
      const tr = this.transicao;
      if (tr) input.novas.clear();   // entrada bloqueada durante a transição
      const congelado = tr && tr.fase !== 'abrir';
      if (this.impacto > 0 && !congelado) {
        // hit-stop: entidades paradas; as teclas apertadas agora valem no próximo passo
        this.impacto -= dt;
        guardarEntrada = true;
      } else if (!congelado) {
        for (const e of this.entidades) if (!e.removido) e.atualizar(dt);
      }
      for (const e of this.entidades) if (e.removido) { this.cena.remove(e.objeto); liberar(e.objeto); }
      this.entidades = this.entidades.filter((e) => !e.removido);
      if (this.transicao) this.atualizarTransicao(dt);
      this.sistemas.forEach((s) => s.atualizar?.(dt, this));
      this.camera.atualizar(dt, this.jogador.pos);
      // sombra acompanha o jogador para caber em salas grandes
      this.sol.position.copy(this.jogador.pos).add(OFFSET_SOL);
      this.sol.target.position.copy(this.jogador.pos);
    }
    if (guardarEntrada) { for (const a of ['pausa', 'girarEsq', 'girarDir']) input.novas.delete(a); }
    else input.fimDoQuadro();
  }

  iniciar() {
    this.carregarSala(0);
    let anterior = performance.now();
    const quadro = (agora) => {
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      this.passo(dt);
      // pausado: o céu (world/ambiente.js) avança o tempo visual por conta própria no
      // onBeforeRender; aqui o tempo é devolvido depois de cada quadro para a
      // decoração, o céu e a poeira ficarem parados
      const congelar = this.pausado;
      if (congelar) this._tempoCongelado ??= UVISUAL.uTempo.value;
      else this._tempoCongelado = null;
      // pós-processamento (bloom, vinheta) instalado pela Frente B em src/fx
      if (this.posProcesso) this.posProcesso.render(congelar ? 0 : dt);
      else this.renderer.render(this.cena, this.camera.cam);
      if (congelar) UVISUAL.uTempo.value = this._tempoCongelado;
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }
}
