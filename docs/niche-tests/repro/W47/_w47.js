'use strict';
// W47a · gemeinsame Bausteine der Repros a-01 … a-05 (kein eigener Test; Exit 0).
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader');

/** Szene: `me` hält die Surprise(s) und die Leser, `op` ist der Gegner (Standard: `op` am Zug). */
async function szene(me, op, o = {}) {
  const t = await H.fresh({ hand: [[], []], hp: o.hp ?? 800, deckSize: 20, active: o.active ?? op, gold: 200 });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(me, hi).atk = 100; }
  return t;
}

/** Wurde dem Spieler `pi` die Karte `name` als Reaktion angeboten (Ja/Nein-Frage mit dem Kartentitel oder Galerie mit der Karte)? */
function angeboten(t, pi, name) {
  return t.prompts.some(p => p.pi === pi && p.d && (p.d.title === name || (p.d.type === 'cardGallery' && (p.d.cards || []).some(c => c.name === name))));
}
/** Wie oft wurde `pi` die Karte `name` als Ja/Nein-Reaktion angeboten (Fenster, nicht Folgeabfragen)? `auf` = nur Fenster, die auf diese Karte reagieren („<auf> was activated"). */
const anzahlAngebote = (t, pi, name, auf) => t.prompts.filter(p => p.pi === pi && p.d && p.d.title === name && p.d.type === 'confirm' && /Activate/.test(p.d.message || '')
  && (!auf || (p.d.message || '').startsWith(auf + ' was activated'))).length;

/** Hat `pi` die Surprise `name` aktiviert (Log `surprise_activated`)? */
const surprise = (t, pi, name) => t.logs.some(l => l.type === 'surprise_activated' && l.data.card === name && l.data.player === 'P' + (pi + 1));

/** Held 0 des Seitenpaars wählen (Zielfunktion): der Held `hi` von `seite`. */
const waehleHeld = (seite, hi = 0) => (v) => [(v.find(x => x.type === 'hero' && x.owner === seite && x.heroIdx === hi) || v[0]).id];

/**
 * Surprise-Quellen: `me` hält die Surprise in der Surprise Zone von Held `hi` (Standard 0), `op` löst sie aus.
 * `setup(t)` richtet nach dem Legen der Surprise Leser/Karten ein. Rückgabe: die Szene `t`.
 *   Bluff        Attack-Surprise („chosen by an Attack or Spell": zieht 3 Karten) — Auslöser: Fireball von op auf Held `hi`
 *   Booby Trap   Spell-Surprise (Destruction Magic) — Auslöser: Fireball
 *   Jumpscare    Spell-Surprise (Decay Magic, wirkt nach der Auflösung) — Auslöser: Fireball
 *   Gold Trap    Spell-Surprise (Decay Magic) — Auslöser: op gewinnt Gold durch einen Effekt
 *   Water Golem  Creature-Surprise — Auslöser: direkte Aktivierung (Wahl nach der Platzierung)
 *   Cybug ANTS   Creature-Surprise — Auslöser: direkte Aktivierung (Schaden, Kreatur noch in der Surprise Zone)
 */
const QUELLEN = {
  Bluff: { art: 'Attack' }, 'Booby Trap': { art: 'Spell' }, Jumpscare: { art: 'Spell' }, 'Gold Trap': { art: 'Spell' },
  'Water Golem': { art: 'Creature' }, 'Cybug ANTS': { art: 'Creature' },
};
async function quelle(name, me, op, setup, o = {}) {
  const hi = o.hi ?? 0;
  const t = await szene(me, op, o);
  t.putSurprise(me, hi, name); t.grantFor(me, hi, name);
  if (setup) await setup(t);
  const art = QUELLEN[name].art;
  if (art === 'Creature') {
    t.targetFn = (v, cfg) => (cfg && cfg.title === name) ? [`hero-${op}-0`] : [(v.find(x => !x.ineligible) || v[0]).id];
    await t.run(() => t.engine._activateSurprise(me, hi, name, { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect(name)));
  } else if (name === 'Gold Trap') {
    await t.run(() => t.engine.actionGainGold(op, 30));
  } else {
    t.addHand(op, 'Fireball');
    t.targetFn = waehleHeld(me, hi);
    await t.play(op, 'Fireball', { hero: 0 });
  }
  return t;
}

module.exports = { H, loadCardEffect, szene, angeboten, anzahlAngebote, surprise, waehleHeld, quelle, QUELLEN };
if (require.main === module) process.exit(0);
