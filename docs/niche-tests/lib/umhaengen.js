'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Gemeinsame Helfer der W51b-Repros (Umhängen per Slippery Fridge / Inheritance Ceremony / actionTransferAttachment).
//  Liegt bewusst in lib/ (der Sammellauf `runall` führt alles unter repro/ als Repro aus).
//
//    const U = require('../../lib/umhaengen.js');
//    const t = await U.fresh(me, { hand: [...], heroes: {...} });      // Szene für Sitz `me` (Sitz 1 → active: 1)
//    await U.lege(t, me, 'Wanted Poster', 0);                          // Equip über den echten Spielweg an Held 0
//    await U.bewege(t, me, 'fridge', { nach: 1, name: 'Wanted Poster' });
//    await U.bewege(t, me, 'ceremony', { von: 0, nach: 1 });
// ═══════════════════════════════════════════════════════════════════════════
const H = require('./h.js');
const F = 'Slippery Fridge', C = 'Inheritance Ceremony';

/** Frisches Spiel; `hand` = Karten, die Sitz `me` zusätzlich auf der Hand hält. `heroes`: { seat: [h0,h1,h2] }. */
async function fresh(me, o = {}) {
  const hand = [0, 1].map(i => i === me ? (o.hand || []) : []);
  const t = await H.fresh({ hand, gold: 900, deckSize: 30, ...(me ? { active: 1 } : {}), ...(o.opts || {}) });
  for (const [seat, namen] of Object.entries(o.heroes || {})) namen.forEach((n, hi) => { if (n) t.setHero(+seat, hi, n, 800); });
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  return t;
}

/** Equip über den echten Handweg (doPlayArtifact) an Held `hi`, Zone `slot` (Standard: erste freie). */
async function lege(t, seat, name, hi = 0, slot) {
  const r = await t.play(seat, name, { hero: hi, ...(slot != null ? { slot } : {}), active: seat });
  return r;
}

/**
 * Zielwahl für Fridge/Ceremony: `name` = nur diese Karte (null = alle wählbaren), `nach` = Zielheld, `besitzer` = nur Karten/Helden dieser Brettseite (Fridge auf Gegner-Helden), `slot` = nur die Karte in dieser Zone.
 */
function wahl(t, { name = null, nach = 1, besitzer = null, slot = null } = {}) {
  t.targetFn = (v, cfg) => {
    const ti = (cfg && cfg.title) || '';
    const pass = (x) => besitzer == null || x.owner === besitzer;
    if (ti === F || (ti === C && v.some(x => x.type === 'equip'))) {
      return v.filter(x => x.type === 'equip' && pass(x) && (name ? x.cardName === name : true) && (slot == null || x.slotIdx === slot)).map(x => x.id);
    }
    const h = v.find(x => x.type === 'hero' && x.heroIdx === nach && pass(x)) || v.find(x => x.type === 'equip' && x.heroIdx === nach && pass(x));
    return h ? [h.id] : undefined;
  };
}

/**
 * Die echte Karte spielen. `via`: 'fridge' | 'ceremony'. Ceremony wirkt von Held `von` (Nutzer) auf Held `nach`; die Karte liegt dazu auf der Hand (wird ergänzt).
 * Rückgabe: Ergebnis von `t.play`.
 */
async function bewege(t, seat, via, { name = null, nach = 1, von = 0, besitzer = null, slot = null } = {}) {
  wahl(t, { name, nach, besitzer, slot });
  const karte = via === 'ceremony' ? C : F;
  return t.play(seat, karte, { hero: von, active: seat });
}

/** Ein Anhängsel (Energy Aura …) an Held `hi` legen (Zielwahl: eigener Held). */
async function haenge(t, seat, name, hi = 0) {
  t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === seat && x.heroIdx === hi); return h ? [h.id] : undefined; };
  return t.play(seat, name, { hero: hi, active: seat });
}

const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const stuetz = (t, s, hi) => (t.gs.players[s].supportZones[hi] || []).flat();
const wo = (t, s, n) => [0, 1, 2].filter(hi => stuetz(t, s, hi).includes(n));
const atk = (t, s, hi) => t.gs.players[s].heroes[hi].atk;

module.exports = { F, C, fresh, lege, wahl, bewege, haenge, sauber, stuetz, wo, atk, H };
