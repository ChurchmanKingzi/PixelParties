#!/usr/bin/env node
'use strict';
// Top-Liste der Skill-Test-Karten aus einem Meilenstein (milestone-N.json), im Vergleich zu einem älteren Meilenstein.
//
//   node scripts/skilltest-top-cards.js --new <milestone-neu.json> --old <milestone-alt.json> --out docs/skilltest-top-cards.md [--top 25] [--per-type 12]
//
// „Wert" = mittlere Platzierungsgüte (+1 Sieg … −1 Letzter), wenn die Karte in der Vorbereitung ausgeteilt wurde, zum Nullpunkt geschrumpft
// (skilltest/learn/ranking.js). Der Rang gilt innerhalb des jeweiligen Pools; die Pools sind verschieden groß (alt 993, neu ~1070 Karten).
const fs = require('fs');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : def; };
const read = (f) => JSON.parse(fs.readFileSync(f, { encoding: 'utf-8' }));
const sgn = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);

const cur = read(arg('new')), old = arg('old') ? read(arg('old')) : null;
const TOP = Number(arg('top', 25)), PER = Number(arg('per-type', 12));
const oldBy = new Map(old ? old.rows.map(r => [r.n, r]) : []);
const rows = cur.rows.slice().sort((a, b) => b.v - a.v);
rows.forEach((r, i) => { r.rk = i + 1; });
const oldRank = new Map(old ? old.rows.slice().sort((a, b) => b.v - a.v).map((r, i) => [r.n, i + 1]) : []);

const line = (r) => {
  const o = oldBy.get(r.n);
  const rk = oldRank.get(r.n);
  const delta = o ? `${rk} → ${r.rk}` : 'neu';
  return `| ${r.rk} | ${r.n} | ${r.t} | ${sgn(r.v)} | ${r.vn} | ${o ? sgn(o.v) : '–'} | ${delta} |`;
};
const head = '| Rang | Karte | Typ | Wert | Austeilungen | Wert alt | Rang alt → neu |\n| ---: | --- | --- | ---: | ---: | ---: | --- |';

const out = [];
out.push(`# Skill Test — Top-Karten (nach ${cur.games} Lernpartien)\n`);
out.push(`Neuer Lauf mit dem Stand vom 8.10. (Hand-Regeln v2, bereinigter Pool, Ziehen/Mulligan von außerhalb des Spiels, Idej-Pakete, freie Ability-Effekte der Bots, ` +
  `Mulligan-Kanal). Vergleich mit dem alten Lauf (${old ? old.games : '–'} Partien). ${rows.length} Karten mit ausreichend Austeilungen.\n`);
out.push(`## Die ${TOP} besten Karten\n\n${head}\n${rows.slice(0, TOP).map(line).join('\n')}\n`);
for (const t of ['Hero', 'Creature', 'Spell', 'Attack', 'Artifact', 'Potion', 'Ability']) {
  const sub = rows.filter(r => r.t === t);
  if (!sub.length) continue;
  out.push(`## ${t}: Top ${Math.min(PER, sub.length)} von ${sub.length}\n\n${head}\n${sub.slice(0, PER).map(line).join('\n')}\n`);
}
const heroes = rows.filter(r => r.t === 'Hero');
out.push(`## Die ${PER} schwächsten Heroes\n\n${head}\n${heroes.slice(-PER).reverse().map(line).join('\n')}\n`);

// Bewegungen: Karten, die in beiden Läufen vorkommen
if (old) {
  const both = rows.filter(r => oldBy.has(r.n) && r.vn >= 200 && oldBy.get(r.n).vn >= 200);
  const moved = both.map(r => ({ r, d: r.v - oldBy.get(r.n).v })).sort((a, b) => b.d - a.d);
  const f = ({ r, d }) => `| ${r.n} | ${r.t} | ${sgn(oldBy.get(r.n).v)} | ${sgn(r.v)} | ${sgn(d)} | ${oldRank.get(r.n)} → ${r.rk} |`;
  const mh = '| Karte | Typ | Wert alt | Wert neu | Δ | Rang |\n| --- | --- | ---: | ---: | ---: | --- |';
  out.push(`## Größte Aufsteiger\n\n${mh}\n${moved.slice(0, 20).map(f).join('\n')}\n`);
  out.push(`## Größte Absteiger\n\n${mh}\n${moved.slice(-20).reverse().map(f).join('\n')}\n`);
  const watch = ['Idej Lord Daiyo', 'Idej Lord Nobunakin', 'Idej Lord Shoguwana', 'Idej Lord Todugawin', 'Mary Crestmas', 'Cute Princess Mary', 'Vacarn, the Dark Goblin Necromancer', 'Beato, the Butterfly Witch',
    'Luna, the Flame Fairy', 'Logan, the Investment Monkee', 'Thorad, Strength of Coolness', 'Sorin, the Warden of Blood Rock', 'Hel, the Bound Specter'];
  const w = watch.map(n => rows.find(r => r.n === n)).filter(Boolean);
  if (w.length) out.push(`## Helden, die zuletzt ganz unten standen (oder im Fokus waren)\n\n${head}\n${w.map(line).join('\n')}\n`);
}

if (arg('out')) fs.writeFileSync(arg('out'), out.join('\n'), { encoding: 'utf-8' });
else console.log(out.join('\n'));
