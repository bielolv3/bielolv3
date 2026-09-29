// Ícones em pixel art desenhados num canvas a partir de padrões de texto.
const cache = new Map();

export function iconePixel(padrao, cores) {
  const chave = padrao.join('|') + JSON.stringify(cores);
  if (cache.has(chave)) return cache.get(chave);
  const c = document.createElement('canvas');
  c.width = padrao[0].length; c.height = padrao.length;
  const g = c.getContext('2d');
  padrao.forEach((linha, y) => [...linha].forEach((ch, x) => {
    if (!cores[ch]) return;
    g.fillStyle = cores[ch]; g.fillRect(x, y, 1, 1);
  }));
  const url = c.toDataURL();
  cache.set(chave, url);
  return url;
}

// coração 7x6: x = cor, o = brilho, contorno some no fundo escuro
const CORACAO = [
  '.xx.xx.',
  'xoxxxxx',
  'xxxxxxx',
  '.xxxxx.',
  '..xxx..',
  '...x...',
];
const MEIO = CORACAO.map((l) => l.slice(0, 4).concat(l.slice(4).replace(/[xo]/g, 'e')));
export const icones = {
  cheio: () => iconePixel(CORACAO, { x: '#c04a2c', o: '#e9e1cf' }),
  meio: () => iconePixel(MEIO, { x: '#c04a2c', o: '#e9e1cf', e: '#3a332a' }),
  vazio: () => iconePixel(CORACAO, { x: '#3a332a', o: '#3a332a' }),
  banana: () => iconePixel([
    '......b',
    '.....xb',
    '....xx.',
    '...xxx.',
    '.xxxx..',
    'xxxo...',
    '.xx....',
  ], { x: '#d09a2c', o: '#e9e1cf', b: '#5a3d1a' }),
};
