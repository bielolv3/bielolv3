// Liberação de memória de GPU (geometrias, materiais, mapas de sombra).
// Recursos reaproveitados entre entidades/salas são marcados com `fixo()` e nunca
// são liberados; texturas ficam de fora (todas vêm de caches).
const FIXOS = new WeakSet();

export function fixo(...recursos) {
  for (const r of recursos) FIXOS.add(r);
  return recursos[0];
}

// libera tudo sob `raiz`, menos o que está em `manter` (Set) ou marcado como fixo
export function liberar(raiz, manter = null) {
  const pode = (r) => r && !FIXOS.has(r) && !manter?.has(r);
  raiz.traverse((o) => {
    // a geometria dos Sprites é única e global no three.js
    if (!o.isSprite && pode(o.geometry)) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (pode(m)) m.dispose();
    if ((o.isLight && o.shadow) || o.isInstancedMesh) o.dispose();   // mapa de sombra / matrizes
  });
}

// geometrias e materiais em uso sob `raiz` (para não liberar o que a sala nova usa)
export function recursosEm(raiz) {
  const s = new Set();
  raiz.traverse((o) => {
    if (o.geometry && !o.isSprite) s.add(o.geometry);
    if (Array.isArray(o.material)) o.material.forEach((m) => s.add(m));
    else if (o.material) s.add(o.material);
  });
  return s;
}
