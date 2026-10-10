'use strict';
// ═══════════════════════════════════════════
//  GETEILT: HELDEN MIT POTION-DECK-KLAUSEL — LAUFZEIT-HAELFTE
//
//  „When this is one of your starting Heroes, your Potion Deck must
//   consist of exactly 15 … You can only activate this effect if this was
//   one of your starting Heroes. If this is one of your starting Heroes,
//   you can never draw cards from your Potion Deck."
//  (Chaos-Diamond, Pinta — und jeder kuenftige Held mit diesem Gerüst.)
//
//  Die DECKBAU-Haelfte („must consist of …") steht NICHT hier, sondern in
//  `public/potion-deck-clauses.js` — eine Tabelle, die Client und Server
//  lesen. Hier steht, was im Spiel selbst gilt:
//
//   • „STARTING HERO": alle Helden, die beim Spielstart auf dem Brett
//     stehen, sind Starthelden. `onGameStart` stempelt sie mit dem Platz
//     des Besitzers (`hero._startingHeroOf`). Ein spaeter ins Spiel
//     gekommener Held (Wiederbelebung, Gabby-artige Wege) traegt den
//     Stempel nicht: kein Effekt, KEINE Zieh-Sperre. Der Stempel nennt den
//     BESITZER, damit ein uebernommener Held („one of YOUR starting
//     Heroes") dem Uebernehmer nicht gehoert.
//   • „you can never draw cards from your Potion Deck": dieselbe Stelle
//     setzt `ps.potionDrawBanned`, das `engine.actionDrawFromPotionDeck`
//     liest. Die Sperre haengt am SPIELER, nicht am Helden — sie bleibt,
//     wenn der Held faellt (der Text sagt „never").
//
//  Benutzung im Heldenskript:
//    const { starthelden } = require('./_potion-deck-hero-shared');
//    hooks: { onGameStart: starthelden.onGameStart }
//    canActivateHeroEffect: if (!starthelden.istStartheldVon(hero, pi)) return false;
// ═══════════════════════════════════════════

const STARTHELD_VON = '_startingHeroOf';

/** `onGameStart`-Hook: Held als Starthelden seines Besitzers stempeln, Potion-Deck-Ziehen sperren. */
function onGameStart(ctx) {
  const engine = ctx._engine;
  const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
  const hero = ctx.attachedHero ?? engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
  if (!hero) return;
  hero[STARTHELD_VON] = ctx.cardOwner;
  const ps = engine.gs.players[ctx.cardOwner];
  if (ps) ps.potionDrawBanned = true;
}

/** War dieser Held ein Starthelden von Spieler `pi`? */
function istStartheldVon(hero, pi) {
  return !!hero && hero[STARTHELD_VON] === pi;
}

/** Die obersten `n` Karten des Potion Decks von `pi` (oberste zuerst, ohne sie zu entnehmen). */
function obersteKarten(engine, pi, n = 1) {
  return (engine.gs.players[pi]?.potionDeck || []).slice(0, n);
}

const starthelden = { onGameStart, istStartheldVon, obersteKarten };

module.exports = { starthelden, onGameStart, istStartheldVon, obersteKarten };
