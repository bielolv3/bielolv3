import * as THREE from 'three';

// Luz, fundo e névoa da sala. Deve criar `jogo.sol` (DirectionalLight com sombra),
// que o loop reposiciona para seguir o jogador.
export function montarAmbiente(jogo) {
  const cena = jogo.cena;
  cena.background = new THREE.Color(0x0c0b09);
  cena.add(new THREE.HemisphereLight(0xe9e1cf, 0x1d190f, 1.1));
  const sol = new THREE.DirectionalLight(0xffe2a8, 1.6);
  sol.position.set(8, 16, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
  cena.add(sol, sol.target);
  jogo.sol = sol;
}
