/* Long Shot engine: rules, daily card, answer matching and odds.
   Shared by the page (scripts/build.cjs inlines it) and the table server (worker/index.ts imports it),
   so both always judge answers and price them the same way. */

export const RACES = 7, CLOCK = 30, MAX_BUSTS = 3;
export const K_PRIOR = 50;          // weight of the house list against real player picks
export const COVER = 0.95;          // share of picks the house list expects to cover
export const UNLISTED_P = 0.002;    // opening probability for an answer that isn't listed
export const FIRST_CALL_LINE = 33;  // first-call credit needs 33/1 or longer
export const LAUNCH = '2026-11-04';
export const BETS = [
  {id:'fav',  name:'Favorite',   line:0,   mult:1, terms:'Any accepted answer', short:'Any answer'},
  {id:'dark', name:'Dark Horse', line:10,  mult:2, terms:'10/1 or longer',      short:'10/1+'},
  {id:'long', name:'Long Shot',  line:33,  mult:3, terms:'33/1 or longer',      short:'33/1+'},
  {id:'moon', name:'Moonshot',   line:100, mult:5, terms:'100/1 or longer',     short:'100/1+'}
];
export const BET = Object.fromEntries(BETS.map(b => [b.id, b]));
export const LADDER = [[0.2,'1/5'],[0.25,'1/4'],[1/3,'1/3'],[0.4,'2/5'],[0.5,'1/2'],[4/6,'4/6'],[0.8,'4/5'],[1,'Evens'],[1.2,'6/5'],[1.5,'6/4'],[1.75,'7/4'],[2,'2/1'],[2.5,'5/2'],[3,'3/1'],[3.5,'7/2'],[4,'4/1'],[4.5,'9/2'],[5,'5/1'],[6,'6/1'],[7,'7/1'],[8,'8/1'],[9,'9/1'],[10,'10/1'],[12,'12/1'],[14,'14/1'],[16,'16/1'],[20,'20/1'],[25,'25/1'],[33,'33/1'],[40,'40/1'],[50,'50/1'],[66,'66/1'],[80,'80/1'],[100,'100/1'],[150,'150/1'],[200,'200/1'],[250,'250/1'],[500,'500/1'],[1000,'1000/1']];

/* ---------------- Dates and the daily card ---------------- */
export function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffled(arr, seed){ const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function dayNum(s){ const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); }
export function makeCard(bank, date){
  const n = dayNum(date), per = Math.floor(bank.length / RACES);
  const cycle = Math.floor(n / per), pos = ((n % per) + per) % per;
  const order = shuffled(bank.map((_, i) => i), 1009 + cycle * 7919);
  return order.slice(pos * RACES, pos * RACES + RACES).map(i => bank[i]);
}

/* ---------------- Matching typed answers against the house list ---------------- */
export function norm(s){
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/[đð]/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ß/g, 'ss').replace(/ı/g, 'i').replace(/ħ/g, 'h').replace(/&/g, ' and ').replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an) /, '');
}
export function keyOf(p, s){
  let n = norm(s);
  if (p.strip){
    p._re = p._re || new RegExp('\\b(?:' + p.strip + ')(?:e?s)?\\b', 'g');
    const t = n.replace(p._re, ' ').replace(/\s+/g, ' ').trim();
    if (t) n = t;
  }
  return n;
}
export function forms(n){
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
export function dist(a, b){
  const m = a.length, n = b.length, d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++){
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
export const labelOf = s => s.charAt(0).toUpperCase() + s.slice(1);
export function weightSum(p){ if (p._ws == null){ let s = 0; for (const a of p.a) s += a[1]; p._ws = s; } return p._ws; }
/* House probability of the listed answer at position i (cheap: no index needed). */
export function houseP0(p, i){ return COVER * p.a[i][1] / weightSum(p); }
export function indexOf(p){
  if (p._idx) return p._idx;
  const entries = [], sum = weightSum(p);
  p.a.forEach(([label, w, aliases], i) => {
    entries.push({i, k: keyOf(p, label), l: labelOf(label), w, names: [label, ...(aliases || [])]});
  });
  const byKey = new Map(), exact = new Map(), fuzzy = [];
  for (const e of entries){
    e.p0 = COVER * e.w / sum;
    if (!byKey.has(e.k)) byKey.set(e.k, e);
    for (const nm of e.names){
      const n = keyOf(p, nm);
      for (const f of forms(n)) if (!exact.has(f)) exact.set(f, e);
      fuzzy.push([n.replace(/ /g, ''), e]);
    }
  }
  return (p._idx = {entries, byKey, exact, fuzzy});
}
/* Longest listed answer that the typed text ends with, e.g. "giant pacific octopus" -> "Octopus". */
export function matchTail(p, text){
  const idx = indexOf(p), words = keyOf(p, text).split(' ').filter(Boolean);
  for (let i = 1; i < words.length; i++){
    const tail = words.slice(i).join(' ');
    if (tail.replace(/ /g, '').length < 3) break;
    for (const f of forms(tail)){ const e = idx.exact.get(f); if (e) return e; }
  }
  return null;
}
export function matchListed(p, text){
  const idx = indexOf(p), n = keyOf(p, text);
  if (!n) return null;
  for (const f of forms(n)){ const e = idx.exact.get(f); if (e) return {e, d:0}; }
  const q = n.replace(/ /g, '');
  if (q.length < 5) return null;
  const tol = q.length >= 9 ? 2 : 1;
  let best = null, bd = tol + 1;
  for (const [a, e] of idx.fuzzy){
    if (a[0] !== q[0] || Math.abs(a.length - q.length) > tol) continue;
    const d = dist(q, a);
    if (d < bd){ bd = d; best = e; }
  }
  return best ? {e: best, d: bd} : null;
}

/* ---------------- Prices ---------------- */
export function priceOf(p){
  p = Math.min(Math.max(p, 1e-6), 0.999);
  const raw = (1 - p) / p;
  let pick = LADDER[0];
  for (const L of LADDER){ if (L[0] <= raw + 1e-9) pick = L; else break; }
  return {v: pick[0], s: pick[1]};
}
export function priceStr(v){ const L = LADDER.find(L => Math.abs(L[0] - v) < 1e-6); return L ? L[1] : Math.round(v) + '/1'; }
export function basePts(v){ return Math.min(100, Math.max(1, Math.round(10 * Math.log2(1 + v)))); }
/* Probability of answer key k: the house list's estimate blended with N real picks (counts by key). */
export function blend(count, N, p0){ return ((count || 0) + K_PRIOR * p0) / (N + K_PRIOR); }
export function probFrom(p, k, counts, N){
  const ent = indexOf(p).byKey.get(k);
  return blend(counts[k], N, ent ? ent.p0 : UNLISTED_P);
}
/* Does the typed text match the listed answer at position i? Checks only that entry, so it's cheap.
   Returns 'exact', 'fuzzy', 'tail' or null, using the same rules as matchListed and matchTail. */
export function verifyClaim(p, text, i){
  if (!Number.isInteger(i) || i < 0 || i >= p.a.length) return null;
  const [label, , aliases] = p.a[i];
  const names = [label, ...(aliases || [])].map(n => keyOf(p, n));
  const nameForms = new Set();
  for (const n of names) for (const f of forms(n)) nameForms.add(f);
  const tk = keyOf(p, text);
  if (!tk) return null;
  for (const f of forms(tk)) if (nameForms.has(f)) return 'exact';
  const q = tk.replace(/ /g, '');
  if (q.length >= 5){
    const tol = q.length >= 9 ? 2 : 1;
    for (const n of names){ const a = n.replace(/ /g, ''); if (a[0] === q[0] && Math.abs(a.length - q.length) <= tol && dist(q, a) <= tol) return 'fuzzy'; }
  }
  const words = tk.split(' ').filter(Boolean);
  for (let j = 1; j < words.length; j++){
    const tail = words.slice(j).join(' ');
    if (tail.replace(/ /g, '').length < 3) break;
    for (const f of forms(tail)) if (nameForms.has(f)) return 'tail';
  }
  return null;
}
/* The odds board: top answers by probability, plus the player's own answer if it falls outside the top. */
export function marketRows(p, counts, labels, N, mineKey, mineLabel, top = 5){
  const idx = indexOf(p);
  const keys = new Set(idx.entries.map(x => x.k));
  Object.keys(counts).forEach(k => keys.add(k));
  if (mineKey) keys.add(mineKey);
  const rows = [...keys].map(k => ({k, l: (idx.byKey.get(k) || {}).l || labels[k] || (k === mineKey ? mineLabel : k), p: probFrom(p, k, counts, N)})).sort((a, b) => b.p - a.p);
  const out = rows.slice(0, top).map((x, i) => ({...x, rank: i + 1}));
  const mi = mineKey ? rows.findIndex(x => x.k === mineKey) : -1;
  if (mi >= top) out.push({...rows[mi], rank: mi + 1});
  return {rows: out, max: rows.length ? rows[0].p : 1, listed: idx.entries.length};
}
