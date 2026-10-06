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
function autoFillHeroes(env, ps) {
  for (let guard = 0; guard < 12 && !Rules.boardFull(ps); guard++) {
    // Kandidaten: Heroes auf der Hand, nach HP absteigend (Zhigao nur, wenn nötig).
    const cands = ps.hand
      .map((n, idx) => ({ n, idx, c: env.cards[n] }))
      .filter(x => x.c && x.c.cardType === 'Hero')
      .sort((a, b) => (b.c.hp || 0) - (a.c.hp || 0));
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
function autoBuild(env, psIn, rng = Math.random) {
  let ps = autoFillHeroes(env, Rules.clone(psIn));
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
    // Hero mit den wenigsten Ability-Zonen zuerst.
    order.sort((a, b) => ps.abilityZones[a].filter(Boolean).length - ps.abilityZones[b].filter(Boolean).length);
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
    const order = [0, 1, 2].filter(hi => ps.heroes[hi])
      .sort((a, b) => ps.supportZones[a].filter(z => z.length).length - ps.supportZones[b].filter(z => z.length).length);
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

  ps.ready = true;
  return ps;
}

module.exports = { autoFillHeroes, autoBuild };
