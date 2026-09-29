// CSS da interface (injetado uma vez). Paleta do Códice.
export const CSS = `
:root{
  --tinta:#0c0b09; --tinta2:#17140f; --osso:#e9e1cf; --osso2:#a89f8c;
  --mostarda:#d09a2c; --quanta:#4fa6ab; --brasa:#c04a2c; --apagado:#3a332a;
  --serifa:'Cinzel',Georgia,serif; --texto:'Spectral',Georgia,serif; --mono:'IBM Plex Mono',ui-monospace,monospace;
}
#hud{position:fixed;inset:0;pointer-events:none;color:var(--osso);font-family:var(--mono);
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;z-index:2}
#hud *{box-sizing:border-box}
#hud button{font:inherit;color:inherit;cursor:pointer}
.px{image-rendering:pixelated;image-rendering:crisp-edges}
body.em-tela .hud-jogo{opacity:0;visibility:hidden}
.hud-jogo{transition:opacity .3s}

/* canto superior esquerdo: macacos, vida, surto */
.hud-canto{position:absolute;left:16px;top:14px;display:flex;gap:10px;align-items:flex-start;
  background:rgba(12,11,9,.72);border:2px solid rgba(58,51,42,.9);padding:6px 12px 6px 6px}
.retratos{display:flex;gap:4px;align-items:flex-end}
.retrato{position:relative;width:30px;height:30px;background:var(--tinta);border:2px solid var(--apagado);
  background-repeat:no-repeat;background-size:auto 170%;background-position:50% 6%;opacity:.55;
  pointer-events:auto;padding:0;filter:saturate(.4)}
.retrato.ativo{width:52px;height:52px;border-color:var(--mostarda);opacity:1;filter:none;
  box-shadow:0 0 0 2px var(--tinta)}
.retrato.surto{border-color:var(--brasa);animation:pulso .5s steps(2) infinite}
.retrato .tecla{position:absolute;right:-2px;bottom:-2px;background:var(--tinta);color:var(--osso2);
  font-size:10px;line-height:12px;padding:0 3px;border:1px solid var(--apagado)}
.retrato.ativo .tecla{color:var(--mostarda);border-color:var(--mostarda)}
.status{display:flex;flex-direction:column;gap:5px;padding-top:2px}
.status .nome{font-family:var(--serifa);font-weight:700;font-size:15px;letter-spacing:.14em;
  text-shadow:0 2px 0 var(--tinta)}
.vida{display:flex;gap:3px;height:18px}
.vida img{width:21px;height:18px}
.vida.dano{animation:treme .25s steps(3)}
.surto{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.2em;color:var(--osso2)}
.surto .barra{width:112px;height:8px;background:var(--tinta);border:2px solid var(--apagado);position:relative}
.surto .barra i{position:absolute;left:0;top:0;bottom:0;background:var(--mostarda);width:0}
.surto.cheio .barra{border-color:var(--mostarda)}
.surto.cheio span{color:var(--mostarda);animation:pulso .8s steps(2) infinite}
.surto.ativo .barra{border-color:var(--brasa)}
.surto.ativo .barra i{background:var(--brasa)}
.surto.ativo span{color:var(--brasa)}
.bananas{display:flex;gap:2px;align-items:center;height:21px}
.bananas img{width:21px;height:21px}
.bananas img.vazia{opacity:.25;filter:grayscale(1)}

/* canto superior direito */
.hud-topo{position:absolute;right:16px;top:14px;display:flex;gap:6px;align-items:center}
.hud-topo .sala{font-size:11px;letter-spacing:.18em;color:var(--osso2);text-transform:uppercase;margin-right:4px;
  background:rgba(12,11,9,.72);padding:8px 10px;line-height:12px;
  text-shadow:0 1px 0 var(--tinta)}
.botao-icone{pointer-events:auto;width:32px;height:32px;background:rgba(12,11,9,.7);border:2px solid var(--apagado);
  display:grid;place-items:center;padding:0}
.botao-icone:hover{border-color:var(--mostarda)}
.botao-icone svg{width:16px;height:16px;fill:var(--osso);shape-rendering:crispEdges}

/* título da sala */
.titulo-sala{position:absolute;left:0;right:0;top:16%;text-align:center;opacity:0;transition:opacity .8s;padding:18px 16px;
  background:linear-gradient(90deg,transparent,rgba(12,11,9,.75) 30%,rgba(12,11,9,.75) 70%,transparent);
  text-shadow:0 2px 0 var(--tinta),0 0 18px rgba(12,11,9,.9)}
.titulo-sala.visivel{opacity:1}
.titulo-sala .num{font-size:11px;letter-spacing:.4em;color:var(--mostarda)}
.titulo-sala h2{font-weight:700;font-family:var(--serifa);font-weight:700;font-size:clamp(26px,5vw,44px);letter-spacing:.12em;
  margin:6px 0 4px;text-transform:uppercase}
.titulo-sala p{font-family:var(--texto);font-style:italic;font-size:17px;margin:0;color:var(--osso2)}
.titulo-sala .fio{width:160px;height:2px;margin:10px auto 0;background:linear-gradient(90deg,transparent,var(--mostarda),transparent)}

/* chefe */
.chefe{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);width:min(70vw,420px);text-align:center;
  opacity:0;transition:opacity .5s}
.chefe.visivel{opacity:1}
.chefe .rotulo{font-family:var(--serifa);font-weight:700;font-size:13px;letter-spacing:.3em;text-transform:uppercase;
  color:var(--quanta);margin-bottom:4px;text-shadow:0 2px 0 var(--tinta)}
.chefe .barra{height:10px;background:var(--tinta);border:2px solid var(--quanta);position:relative;box-shadow:0 0 0 2px var(--tinta)}
.chefe .barra i{position:absolute;left:0;top:0;bottom:0;background:var(--quanta);transition:width .2s}
body.toque .chefe{bottom:auto;top:132px}

/* dica */
.dica{position:absolute;left:50%;bottom:28px;transform:translate(-50%,8px);max-width:min(92vw,560px);
  background:rgba(12,11,9,.88);border:2px solid var(--apagado);border-left:4px solid var(--mostarda);
  padding:8px 14px;font-size:13px;line-height:1.4;opacity:0;transition:opacity .35s,transform .35s}
.dica.visivel{opacity:1;transform:translate(-50%,0)}
.dica b{color:var(--mostarda);font-weight:600}
body.toque .dica{bottom:auto;top:84px}

/* telas (título, pausa, derrota, vitória) */
.tela{position:absolute;inset:0;display:none;place-items:center;pointer-events:auto;padding:16px;overflow:auto;
  background:radial-gradient(ellipse at 50% 45%,rgba(12,11,9,.55),rgba(12,11,9,.93) 70%)}
.tela.visivel{display:grid;animation:surge .4s ease-out}
.tela .caixa{text-align:center;max-width:620px;width:100%}
.tela h1{font-family:var(--serifa);font-weight:700;font-size:clamp(40px,10vw,84px);letter-spacing:.14em;margin:0;
  line-height:1;text-shadow:0 4px 0 var(--tinta)}
.tela h1.menor{font-size:clamp(32px,7vw,56px)}
.tela .marca{font-size:12px;letter-spacing:.5em;color:var(--mostarda);margin:14px 0 0;text-transform:uppercase}
.tela .lema{font-family:var(--texto);font-style:italic;font-size:18px;color:var(--osso2);margin:18px auto 0;max-width:460px;line-height:1.45}
.tela .fio{width:200px;height:2px;margin:22px auto;background:linear-gradient(90deg,transparent,var(--mostarda),transparent)}
.tela .acoes{display:flex;flex-direction:column;gap:8px;align-items:center;margin-top:8px}
#hud .botao{pointer-events:auto;width:250px;max-width:100%;padding:10px 18px;background:var(--tinta);border:2px solid var(--osso2);
  font-family:var(--serifa)!important;font-weight:700;font-size:17px;letter-spacing:.2em;text-transform:uppercase}
#hud .botao.principal{border-color:var(--mostarda);color:var(--mostarda);box-shadow:4px 4px 0 var(--apagado)}
#hud .botao:hover,#hud .botao:focus-visible{background:var(--mostarda);color:var(--tinta);border-color:var(--mostarda);outline:none}
.controles{display:grid;grid-template-columns:auto auto;gap:3px 16px;justify-content:center;margin-top:24px;
  font-size:12px;color:var(--osso2);text-align:left}
.controles kbd{font-family:var(--mono);color:var(--osso);border:1px solid var(--apagado);padding:0 4px;margin-right:2px;font-size:11px}
.tela .dica-tecla{font-size:11px;color:var(--osso2);margin-top:14px;letter-spacing:.1em}
.tela-derrota h1{color:var(--brasa)}
.tela-vitoria h1{color:var(--quanta)}
body.toque .so-teclado{display:none}
body:not(.toque) .so-toque{display:none}

/* controles de toque */
.toque-camada{display:none}
body.toque .toque-camada{display:block}
.joystick{position:absolute;left:0;bottom:0;width:45%;height:60%;pointer-events:auto;touch-action:none}
.joystick .base{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border:2px solid rgba(233,225,207,.35);
  border-radius:50%;background:rgba(12,11,9,.35);left:100px;top:calc(100% - 110px);transition:opacity .2s;opacity:.6}
.joystick .pino{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;
  background:rgba(233,225,207,.55);border:2px solid var(--osso)}
.joystick.ativo .base{opacity:1}
.botoes-toque{position:absolute;right:14px;bottom:18px;width:210px;height:190px;pointer-events:none}
.bt{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;border:2px solid rgba(233,225,207,.45);
  background:rgba(12,11,9,.55);color:var(--osso);display:grid;place-items:center;font-size:8px;letter-spacing:0;overflow:hidden;
  padding:0;font-family:var(--mono)}
.bt.apertado{background:var(--mostarda);color:var(--tinta);border-color:var(--mostarda)}
.bt.pulo{width:78px;height:78px;right:0;bottom:0;font-size:11px;border-color:var(--osso)}
.bt.golpe{width:62px;height:62px;right:88px;bottom:6px}
.bt.identidade{width:58px;height:58px;right:12px;bottom:88px}
.bt.recurso{width:54px;height:54px;right:82px;bottom:78px}
.bt.surto{width:50px;height:50px;right:148px;bottom:92px;opacity:.45}
.bt.surto.pronto{opacity:1;border-color:var(--brasa);color:var(--brasa)}
.bt.girar{width:38px;height:38px;border-radius:0;top:56px;font-size:18px;letter-spacing:0}
.bt.girar-esq{right:58px}
.bt.girar-dir{right:16px}

@keyframes pulso{50%{opacity:.45}}
@keyframes treme{33%{transform:translateX(-2px)}66%{transform:translateX(2px)}}
@keyframes surge{from{opacity:0}}
@media (max-height:480px){
  .tela h1{font-size:44px}
  .tela h1.menor{font-size:36px}
  .tela .lema{font-size:15px;margin-top:8px}
  .tela .fio{margin:10px auto}
  .controles{margin-top:10px}
  .titulo-sala{top:22%}
}
@media (max-width:560px){
  .hud-topo .sala{display:none}
  .surto .barra{width:80px}
}
`;
