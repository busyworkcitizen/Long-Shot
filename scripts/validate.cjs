#!/usr/bin/env node
// Checks data/prompts.json: shape, weights, duplicate ids, and that no two names
// in a prompt collide after the game's answer normalization.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'prompts.json');
let prompts;
try { prompts = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('data/prompts.json does not parse: ' + e.message); process.exit(1); }

// Same normalization the game uses (see src/game.html: norm, keyOf, forms).
function norm(s){
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ø/g, 'o').replace(/&/g, ' and ').replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an) /, '');
}
function keyOf(p, s){
  let n = norm(s);
  if (p.strip){
    const t = n.replace(new RegExp('\\b(?:' + p.strip + ')(?:e?s)?\\b', 'g'), ' ').replace(/\s+/g, ' ').trim();
    if (t) n = t;
  }
  return n;
}
function forms(n){
  const out = new Set();
  const add = s => { if (s){ out.add(s); out.add(s.replace(/ /g, '')); } };
  add(n);
  const m = n.match(/^(.*?)([a-z]+)$/);
  if (m && m[2].length > 3){
    const pre = m[1], w = m[2];
    if (w.endsWith('ies')){ add(pre + w.slice(0, -3) + 'y'); add(pre + w.slice(0, -1)); }
    if (w.endsWith('es')) add(pre + w.slice(0, -2));
    if (w.endsWith('s') && !w.endsWith('ss')) add(pre + w.slice(0, -1));
  }
  return out;
}

let problems = 0;
const fail = msg => { problems++; console.log('  ' + msg); };
const ids = new Set();
let total = 0;

for (const p of prompts){
  if (!p || typeof p.id !== 'string' || typeof p.q !== 'string' || typeof p.cat !== 'string' || !Array.isArray(p.answers)){
    fail(`bad prompt: ${JSON.stringify(p).slice(0, 80)}`); continue;
  }
  if (ids.has(p.id)) fail(`${p.id}: duplicate prompt id`);
  ids.add(p.id);
  const seen = new Map();
  p.answers.forEach((e, i) => {
    if (!Array.isArray(e) || typeof e[0] !== 'string' || !(typeof e[1] === 'number' && e[1] > 0) || (e[2] !== undefined && !Array.isArray(e[2]))){
      fail(`${p.id}[${i}]: entries must be [label, weight > 0] or [label, weight, [aliases]]: ${JSON.stringify(e)}`); return;
    }
    for (const name of [e[0], ...(e[2] || [])]){
      const k = keyOf(p, name);
      if (!k){ fail(`${p.id}: "${name}" normalizes to nothing`); continue; }
      for (const f of forms(k)){
        const prev = seen.get(f);
        if (prev !== undefined && prev !== i) fail(`${p.id}: "${name}" (${e[0]}) collides with "${p.answers[prev][0]}"`);
        else seen.set(f, i);
      }
    }
  });
  total += p.answers.length;
}

console.log(`${prompts.length} prompts, ${total.toLocaleString()} answers`);
if (prompts.length < 7) fail('need at least 7 prompts for a daily card');
if (problems){ console.log(`${problems} problem(s)`); process.exit(1); }
console.log('OK');
