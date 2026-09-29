// Gera dist/artifact.html: o index.html do build sem <html>/<head>/<body>,
// no formato que a publicação como Artifact espera (ela põe o esqueleto).
import fs from 'fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const cabeca = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const corpo = html.match(/<body>([\s\S]*?)<\/body>/)[1];
// o jogo usa :root escuro; o esqueleto do Artifact pinta :root claro
const extra = '<style>:root{color-scheme:dark;background:#0c0b09;padding:0!important}</style>';
fs.writeFileSync('dist/artifact.html', cabeca.trim() + '\n' + extra + '\n' + corpo.trim() + '\n');
console.log(fs.readdirSync('dist/assets').map((f) => 'assets/' + f).join('\n'));
