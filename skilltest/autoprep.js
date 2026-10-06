'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — AUTOMATISCHER BASISAUFBAU
//
//  Zwei Verwendungen:
//   • autoFillHeroes: Notbehelf für Menschen, deren Timer abläuft (nur
//     fehlende Heroes werden gesetzt, alles andere bleibt, wie es ist).
//   • autoBuild: Grundaufbau für CPU-Sitze. Das ist die REGELBASIERTE
//     Basis; der Bot (bot.js) legt später eine gelernte Bewertung darüber.
// ═══════════════════════════════════════════════════════════════════
const Rules = require('../public/skilltest-rules.js');

function tryMove(env, ps, move) {
  const r = Rules.applyMove(env, ps, move);
  return r.ok ? r.ps : null;
}

const handIdx = (ps, pred) => ps.hand.findIndex(pred);

/** Fehlende Heroes aus der Hand nachziehen (stärkste zuerst), bis das Board voll ist. */
function autoFillHeroes(env, ps, heroScore) {
  const score = heroScore || ((n, c) => c.hp || 0);
  for (let guard = 0; guard < 12 && !Rules.boardFull(ps); guard++) {
    // Kandidaten: Heroes auf der Hand, nach Wert absteigend (Standard: HP; Zhigao nur, wenn nötig).
    const cands = ps.hand
      .map((n, idx) => ({ n, idx, c: env.cards[n] }))
      .filter(x => x.c && x.c.cardType === 'Hero')
      .sort((a, b) => score(b.n, b.c) - score(a.n, a.c));
    const zone = ps.heroes.findIndex(h => !h);
    if (zone < 0 || !cands.length) break;
    let placed = false;
    for (const cand of cands) {
      const next = tryMove(env, ps, { type: 'place', from: { kind: 'hand', idx: cand.idx }, to: { kind: 'hero', hi: zone } });
      if (next) { ps = next; placed = true; break; }
    }
    if (!placed) break;
  }
  return ps;
}

/** Karten der Hand nach Typ in die Zonen legen (nur gültige Züge). */
function autoBuild(env, psIn, rng = Math.random, opts = {}) {
  const pairScore = opts.pairScore || (() => 0);        // (Heldenname, Kartenname) → gelernte Passung
  let ps = autoFillHeroes(env, Rules.clone(psIn), opts.heroScore);
  const cards = env.cards;
  const place = (idx, to) => {
    const next = tryMove(env, ps, { type: 'place', from: { kind: 'hand', idx }, to });
    if (next) ps = next;
    return !!next;
  };

  // 1) Abilities: auf Heroes verteilen (reihum, in leere Zonen).
  for (let pass = 0; pass < 20; pass++) {
    const idx = handIdx(ps, n => cards[n] && cards[n].cardType === 'Ability');
    if (idx < 0) break;
    let done = false;
    const order = [0, 1, 2].filter(hi => ps.heroes[hi]);
    // Beste Passung zuerst, bei Gleichstand der Hero mit den wenigsten Ability-Zonen.
    const abName = ps.hand[idx];
    order.sort((a, b) => (pairScore(ps.heroes[b], abName) - pairScore(ps.heroes[a], abName))
      || (ps.abilityZones[a].filter(Boolean).length - ps.abilityZones[b].filter(Boolean).length));
    for (const hi of order) {
      for (let slot = 0; slot < 3 && !done; slot++) {
        if (!ps.abilityZones[hi][slot]) done = place(idx, { kind: 'ability', hi, slot });
      }
      if (done) break;
    }
    if (!done) break;
  }

  // 2) Creatures / Equipment / Attachments in Support Zonen (Creatures zuerst).
  const supportPref = (n) => {
    const c = cards[n]; if (!c) return 9;
    if (c.cardType === 'Creature' && c.subtype !== 'Surprise') return 0;
    if (c.subtype === 'Equipment') return 1;
    if (c.cardType === 'Artifact' && (c.subtype || '').includes('Creature')) return 0;
    if (c.subtype === 'Attachment') return 2;
    return 9;
  };
  for (let pass = 0; pass < 40; pass++) {
    let best = -1, bestP = 9;
    ps.hand.forEach((n, i) => { const p = supportPref(n); if (p < bestP) { bestP = p; best = i; } });
    if (best < 0) break;
    let done = false;
    const cardName = ps.hand[best];
    const order = [0, 1, 2].filter(hi => ps.heroes[hi])
      .sort((a, b) => (pairScore(ps.heroes[b], cardName) - pairScore(ps.heroes[a], cardName))
        || (ps.supportZones[a].filter(z => z.length).length - ps.supportZones[b].filter(z => z.length).length));
    for (const hi of order) {
      for (let slot = 0; slot < 3 && !done; slot++) {
        if (!ps.supportZones[hi][slot].length) done = place(best, { kind: 'support', hi, slot });
      }
      if (done) break;
    }
    if (!done) break;
  }

  // 3) Surprises (eine je Hero).
  for (let pass = 0; pass < 6; pass++) {
    const idx = handIdx(ps, n => cards[n] && cards[n].subtype === 'Surprise');
    if (idx < 0) break;
    let done = false;
    for (let hi = 0; hi < 3 && !done; hi++) {
      if (ps.heroes[hi] && !ps.surpriseZones[hi]) done = place(idx, { kind: 'surprise', hi });
    }
    if (!done) break;
  }

  // 4) Eine Area.
  const aIdx = handIdx(ps, n => cards[n] && cards[n].subtype === 'Area');
  if (aIdx >= 0) place(aIdx, { kind: 'area' });

  if (opts.ready !== false) ps.ready = true;
  return ps;
}

/** Kann der Bot diese Handkarte im Kampf einsetzen? (Zauber/Angriffe, Artifacts, Creatures, Surprises) */
function usableInBattle(c) {
  if (!c) return false;
  const sub = (c.subtype || '').toLowerCase();
  if (c.cardType === 'Spell' || c.cardType === 'Attack') return sub === 'normal' || sub === '' || sub === 'surprise';
  if (c.cardType === 'Artifact') return sub === 'equipment' || sub === 'normal';
  if (c.cardType === 'Creature') return sub === 'normal' || sub === 'surprise';
  return false;
}

/**
 * Basis mit Recycling: bauen, alles Unbrauchbare (und Überzähliges) in den Recycler werfen, die
 * ausgeworfenen Karten einsetzen — bis nichts Verwertbares mehr übrig ist. Jede eingeworfene Karte gibt
 * Gold, und wer am meisten recycelt, beginnt. Nichts wird ohne Pool ausgeworfen (dann nur gebaut).
 *
 * opts: { pool, config, rng, heroScore, pairScore, keepScore, maxKeep }
 */
function buildWithRecycling(env, psIn, opts = {}) {
  const { pool, config } = opts;
  const rng = opts.rng || Math.random;
  const keepScore = opts.keepScore || (() => 0);
  const maxKeep = opts.maxKeep != null ? opts.maxKeep : 4;
  const build = (ps) => autoBuild(env, ps, rng, { heroScore: opts.heroScore, pairScore: opts.pairScore, ready: false });
  let ps = build(Rules.clone(psIn));
  const ejectedAll = [], recycledAll = [];                    // für die Auswertung (Lernsystem): was kam aus dem Recycler, was ging hinein
  if (!pool || !config) { ps.ready = true; return ps; }
  for (let pass = 0; pass < 30; pass++) {
    const keep = [], junk = [];
    ps.hand.forEach((n, idx) => {
      const c = env.cards[n];
      if (!usableInBattle(c)) { junk.push({ n, idx }); return; }
      const typeBase = (c.cardType === 'Spell' || c.cardType === 'Attack') ? 3 : c.cardType === 'Artifact' ? 2 : 1;
      keep.push({ n, idx, score: typeBase + keepScore(n) });
    });
    keep.sort((a, b) => b.score - a.score);
    const list = [...junk, ...keep.slice(maxKeep)].sort((a, b) => b.idx - a.idx);   // höchste Indizes zuerst
    if (!list.length) break;
    let progressed = false;
    for (const { idx } of list) {
      const name = ps.hand[idx];
      const res = Rules.applyMove(env, ps, { type: 'recycle', from: { kind: 'hand', idx } });
      if (!res.ok) continue;                                   // z. B. Hero bei nicht vollem Board
      ps = res.ps; progressed = true; recycledAll.push(name);
      if (ps.recycled % config.RECYCLE_EVERY === 0) {
        const ejected = pool.takeAny(config.RECYCLER_TYPE_WEIGHTS);
        if (ejected) { ps.hand.push(ejected); ejectedAll.push(ejected); }
      }
    }
    if (!progressed) break;
    ps = build(ps);                                            // Ausgeworfenes einsetzen
  }
  ps.ready = true;
  ps.ejected = ejectedAll; ps.recycledCards = recycledAll;
  return ps;
}

module.exports = { autoFillHeroes, autoBuild, buildWithRecycling, usableInBattle };
