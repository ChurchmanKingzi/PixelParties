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
    // Start-Abilities stehen auf Stufe 3: dort bringt dieselbe Ability von der Hand nichts mehr; Heroes ohne sie (oder mit niedrigerer Stufe) zuerst.
    const levelOn = (hi) => { const z = ps.abilityZones[hi].find(q => q && q.n === abName); return z ? Rules.abilityLevel(z) : 0; };
    order.sort((a, b) => ((levelOn(a) >= Rules.MAX_ABILITY_LEVEL ? 1 : 0) - (levelOn(b) >= Rules.MAX_ABILITY_LEVEL ? 1 : 0))
      || (pairScore(ps.heroes[b], abName) - pairScore(ps.heroes[a], abName))
      || (ps.abilityZones[a].filter(Boolean).length - ps.abilityZones[b].filter(Boolean).length));
    for (const hi of order) {
      if (levelOn(hi) >= Rules.MAX_ABILITY_LEVEL) continue;
      // liegt die Ability schon auf dem Hero, wird ihre Zone angesteuert (Stufe +), sonst die erste freie
      const own = ps.abilityZones[hi].findIndex(q => q && q.n === abName);
      const slots = own >= 0 ? [own] : [0, 1, 2];
      for (const slot of slots) {
        if (done) break;
        if (own >= 0 || !ps.abilityZones[hi][slot]) done = place(idx, { kind: 'ability', hi, slot });
      }
      if (done) break;
    }
    if (!done) break;
  }

  // 2) Creatures / Equipment / Attachments in Support Zonen (Creatures zuerst).
  const supportPref = (n) => {
    const c = cards[n]; if (!c) return 9;
    if (isReactionCard(c)) return 9;                                  // Reaktionskarten bleiben auf der Hand
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

/** Reaktionskarten (Hand-Reaktionen) — der Bot hält sie auf der Hand und löst sie aus, wenn ein Fenster aufgeht. */
const isReactionCard = (c) => !!c && (c.subtype || '').toLowerCase() === 'reaction';

/**
 * Kann der Bot diese Handkarte im Kampf einsetzen? Zauber/Angriffe, Artifacts, Creatures, Surprises, Tränke,
 * Hand-Abilities (an Helden legen, Stufe erhöhen) und Reaktionskarten.
 */
function usableInBattle(c) {
  if (!c) return false;
  const sub = (c.subtype || '').toLowerCase();
  if (isReactionCard(c)) return ['Spell', 'Attack', 'Artifact', 'Creature', 'Potion'].includes(c.cardType);
  if (c.cardType === 'Potion') return true;
  if (c.cardType === 'Ability') return true;
  // Areas und Attachments setzt der Aufbau aufs Brett, Surprises in die Surprise Zone, Artifact-Creatures wie Creatures in die Support Zones —
  // all das ist im Kampf einsetzbar. Creatures OHNE Untertyp (die vier Cardinal Beasts, Stufe 5) gelten ebenso: Der Aufbau stellt sie ohne Stufenprüfung
  // aufs Brett; als „unbrauchbar“ gewertet wurden sie bisher fast immer recycelt (Nutzer 7.10.: „die CPU hat nicht erkannt, dass sie sie spielen darf“).
  if (c.cardType === 'Spell' || c.cardType === 'Attack') return ['normal', '', 'surprise', 'area', 'attachment'].includes(sub);
  if (c.cardType === 'Artifact') return ['equipment', 'normal', 'creature', 'surprise', ''].includes(sub);
  if (c.cardType === 'Creature') return ['normal', 'surprise', ''].includes(sub);
  return false;
}

/**
 * Basis mit Recycling: bauen, alles Unbrauchbare (und Überzähliges) in den Recycler werfen, die
 * ausgeworfenen Karten einsetzen — bis nichts Verwertbares mehr übrig ist. Jede eingeworfene Karte gibt
 * Gold, und wer am meisten recycelt, beginnt. Nichts wird ohne Pool ausgeworfen (dann nur gebaut).
 *
 * opts: { pool, config, rng, heroScore, pairScore, keepScore, maxKeep, decide, record }
 *  • `decide(ps) → { recycle: [Handindex…], log }` ersetzt die feste Regel (learn/keepmodel.js: Behalten/Recyceln mit dem
 *    Kontext der restlichen Hand und des Bretts). Ohne `decide` gilt die feste Regel `usableInBattle` + `keepScore`/`maxKeep`.
 *  • `record`: legt `ps.keepLog` an (Entscheidungen samt Merkmalen) für das Lernen.
 */
function buildWithRecycling(env, psIn, opts = {}) {
  const { pool, config } = opts;
  const rng = opts.rng || Math.random;
  const keepScore = opts.keepScore || (() => 0);
  const maxKeep = opts.maxKeep != null ? opts.maxKeep : 4;
  const build = (ps) => autoBuild(env, ps, rng, { heroScore: opts.heroScore, pairScore: opts.pairScore, ready: false });
  let ps = build(Rules.clone(psIn));
  const ejectedAll = [], recycledAll = [];                    // für die Auswertung (Lernsystem): was kam aus dem Recycler, was ging hinein
  const lastLog = {}, recycleLog = {};                         // Entscheidungen samt Merkmalen (opts.decide)
  if (!pool || !config) { ps.ready = true; return ps; }
  for (let pass = 0; pass < 30; pass++) {
    let list;
    if (opts.decide) {
      const d = opts.decide(ps);
      for (const e of d.log) lastLog[e.c] = e;
      list = d.recycle.map(idx => ({ idx })).sort((a, b) => b.idx - a.idx);       // höchste Indizes zuerst
    } else {
      const keep = [], junk = [];
      ps.hand.forEach((n, idx) => {
        const c = env.cards[n];
        if (Rules.HAND_ONLY_HEROES.includes(n)) return;           // Quetzahuitl bleibt auf der Hand (greift beim Fall des letzten Heroes ein)
        if (!usableInBattle(c)) { junk.push({ n, idx }); return; }
        const typeBase = isReactionCard(c) ? 2 : (c.cardType === 'Spell' || c.cardType === 'Attack') ? 3 : (c.cardType === 'Artifact' || c.cardType === 'Potion' || c.cardType === 'Ability') ? 2 : 1;
        keep.push({ n, idx, score: typeBase + keepScore(n) });
      });
      keep.sort((a, b) => b.score - a.score);
      list = [...junk, ...keep.slice(maxKeep)].sort((a, b) => b.idx - a.idx);   // höchste Indizes zuerst
    }
    if (!list.length) break;
    let progressed = false;
    for (const { idx } of list) {
      const name = ps.hand[idx];
      const res = Rules.applyMove(env, ps, { type: 'recycle', from: { kind: 'hand', idx } });
      if (!res.ok) continue;                                   // z. B. Hero bei nicht vollem Board
      if (lastLog[name]) recycleLog[name] = lastLog[name];
      ps = res.ps; progressed = true; recycledAll.push(name);
      if (ps.recycled % config.RECYCLE_EVERY === 0) {
        // Spells passend zu den Schulen der Heroes auf dem Brett; ein Hero bringt seine Partner mit (hand-rules.js).
        const r = require('./hand-rules').eject({ pool, cards: env.cards, ps, weights: config.RECYCLER_TYPE_WEIGHTS, rng });
        if (r.ejected) ejectedAll.push(r.ejected, ...r.extras);
      }
    }
    if (!progressed) break;
    ps = build(ps);                                            // Ausgeworfenes einsetzen
  }
  ps.ready = true;
  ps.ejected = ejectedAll; ps.recycledCards = recycledAll;
  if (opts.record && opts.decide) {
    // Lernprotokoll: wer recycelt wurde (Merkmale zum Zeitpunkt der Entscheidung) und wer am Ende noch auf der Hand liegt (letzte Bewertung)
    ps.keepLog = [...Object.values(recycleLog), ...ps.hand.filter(n => lastLog[n] && lastLog[n].a === 1).map(n => lastLog[n])];
  }
  return ps;
}

module.exports = { autoFillHeroes, autoBuild, buildWithRecycling, usableInBattle };
