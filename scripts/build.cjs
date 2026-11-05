#!/usr/bin/env node
// Builds Long Shot from src/game.html and data/prompts.json.
//
//   index.html                      Standalone page. Open it in a browser or serve it with GitHub Pages.
//   dist/long-shot.artifact.html    Page body for publishing as a Claude artifact, which adds the
//                                   shared table, player names and the Claude pit boss.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const prompts = JSON.parse(read('data/prompts.json'));
const bank = prompts.map(p => {
  const o = {id: p.id, cat: p.cat, q: p.q, a: p.answers};
  if (p.strip) o.strip = p.strip;
  return o;
});

// Keep the inlined JSON safe inside a <script> tag.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const json = JSON.stringify(bank).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');

const template = read('src/game.html');
const marker = '/*@@BANK@@*/[]';
if (!template.includes(marker)) throw new Error(`src/game.html is missing the ${marker} placeholder`);
const fragment = template.replace(marker, () => json);

// Artifact body: claude.ai wraps it in its own document skeleton.
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'dist/long-shot.artifact.html'), fragment);

// Standalone document: move the title, meta and font links into <head>.
const cut = fragment.indexOf('<style>');
const head = fragment.slice(0, cut).trim();
const body = fragment.slice(cut);
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), page);

const answers = bank.reduce((n, p) => n + p.a.length, 0);
const kb = f => (fs.statSync(path.join(root, f)).size / 1024).toFixed(0) + ' KB';
console.log(`Built ${bank.length} prompts, ${answers.toLocaleString()} answers`);
console.log(`  index.html                    ${kb('index.html')}`);
console.log(`  dist/long-shot.artifact.html  ${kb('dist/long-shot.artifact.html')}`);
