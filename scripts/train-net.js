'use strict';
// ═══════════════════════════════════════════
//  PIXEL PARTIES — Wertnetz in den Sammel-Skripten (train-all-decks, train-iterative)
//
//  Die Datensammlung spielt mit dem Wertnetz als Blattbewertung der CPU-Suche (`PP_VALUE_NET=leaf`, Horizont 0, 12 Rollouts): gleiche
//  gemessene Spielstärke bei rund der halben Rechenzeit. Gewichte: `data/cpu-value/` (net.json, net.f32).
//
//  Alles ist rückholbar, ohne Code zu ändern:
//    · global aus:   `--net 0` an der Kommandozeile oder `PP_TRAIN_NET=0` in der Umgebung,
//    · je Deck aus:  `data/cpu-value/net-aus.json` → { "decks": ["Lightning Caller", …] } (Namensteile, wie bei `--only`); diese Decks
//                    sammeln mit dem alten Evaluator,
//    · erzwingen:    `--net 1` / `PP_TRAIN_NET=1` ignoriert die Ausnahmeliste.
//  Eine selbst gesetzte `PP_VALUE_NET` (z. B. `log` für den Zustandslog) und selbst gesetzte `PP_VALUE_LEAF_*` bleiben unangetastet.
//  Datensammlungen mit Netz und mit Evaluator liegen in getrennten Ordnern (`data/training/all-net` bzw. `all`) und werden nie in einer
//  Datei gemischt; jede Partie trägt außerdem `valueNet` im Datensatz.
//  Die Spiegel-A/B-Messungen der Skripte (`--ab`) laufen weiter mit dem Evaluator: das ist die Spielweise im Livespiel, und genau dafür
//  muss ein Profil seinen Wirksamkeitstest bestehen.
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'cpu-value');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const gewichteDa = (dir = DIR) => fs.existsSync(path.join(dir, 'net.json')) && fs.existsSync(path.join(dir, 'net.f32'));

function ausnahmen(dir = DIR) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'net-aus.json'), { encoding: 'utf-8' }));
    return (Array.isArray(j.decks) ? j.decks : []).map(norm).filter(Boolean);
  } catch { return []; }
}

/**
 * Entscheidet für ein Deck, ob mit dem Netz gesammelt wird.
 * @param {string} deckName
 * @param {{flag?: string|null, env?: object, dir?: string}} [opt]  flag: '0' | '1' | null/undefined (= Standard)
 * @returns {{on: boolean, reason: string, env: object}}  `env`: Zusätze für den server.js-Prozess (leer, wenn aus)
 */
function netFuer(deckName, opt = {}) {
  const env = opt.env || process.env, dir = opt.dir || DIR;
  const flag = opt.flag != null ? String(opt.flag) : (env.PP_TRAIN_NET != null ? String(env.PP_TRAIN_NET) : null);
  const aus = (reason) => ({ on: false, reason, env: {} });
  if (flag === '0') return aus('Netz aus (--net 0 / PP_TRAIN_NET=0)');
  if (env.PP_VALUE_NET) return aus(`PP_VALUE_NET=${env.PP_VALUE_NET} ist selbst gesetzt, bleibt unangetastet`);
  if (!gewichteDa(dir)) return aus('keine Gewichte in data/cpu-value');
  if (flag !== '1') {
    const n = norm(deckName);
    const treffer = ausnahmen(dir).find(e => n.includes(e) || e.includes(n));
    if (treffer) return aus(`Deck steht in data/cpu-value/net-aus.json (${treffer})`);
  }
  const zusatz = { PP_VALUE_NET: 'leaf' };
  if (env.PP_VALUE_LEAF_HORIZON == null) zusatz.PP_VALUE_LEAF_HORIZON = '0';
  if (env.PP_VALUE_LEAF_PULLS == null) zusatz.PP_VALUE_LEAF_PULLS = '12';
  return { on: true, reason: flag === '1' ? 'Netz an (erzwungen)' : 'Netz an (Standard)', env: zusatz };
}

/** Eine Zeile fürs Konsolenprotokoll. */
const beschreibung = (deckName, r) =>
  `[net] "${deckName}": ${r.on ? 'Wertnetz AN' : 'Evaluator'} — ${r.reason}${r.on ? ` (leaf, Horizont ${r.env.PP_VALUE_LEAF_HORIZON ?? process.env.PP_VALUE_LEAF_HORIZON}, ${r.env.PP_VALUE_LEAF_PULLS ?? process.env.PP_VALUE_LEAF_PULLS} Rollouts)` : ''}`;

module.exports = { netFuer, beschreibung, gewichteDa, ausnahmen, DIR };
