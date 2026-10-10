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
//   • „You can only activate this effect if this was one of your starting
//     Heroes": `darfAktivieren`. Eigener Held: nur als eigener Starthero.
//     ÜBERNOMMENER Held (Charme, Controlled Attack, …; Als Ruling 10.10.): nur,
//     wenn das Potion Deck des Spielers ZUFÄLLIG auf diesen Helden zugeschnitten
//     ist — sprich, wenn der Spieler selbst mit einem Helden derselben Klausel
//     gestartet ist (eigener Chaos-Diamond, dann den gegnerischen übernommen).
//     „Zugeschnitten" prüft die Klausel-Tabelle (`public/potion-deck-clauses.js`:
//     Kartenart, verschiedene Namen, Level-Grenze, ohne die Kartenzahl — das
//     Potion Deck schrumpft im Spiel).
//
//  Benutzung im Heldenskript:
//    const { starthelden } = require('./_potion-deck-hero-shared');
//    hooks: { onGameStart: starthelden.onGameStart }
//    canActivateHeroEffect: if (!starthelden.darfAktivieren(engine, hero, pi, feld, CARD_NAME)) return false;
// ═══════════════════════════════════════════

const PotionDeckClauses = require('../../public/potion-deck-clauses.js');

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

/**
 * Wer handelt mit diesem Helden? Ein per Charme/Controlled Attack übernommener Held handelt für seinen
 * Übernehmer. `ctx.cardOwner` kennt den Charme schon, die Controlled-Attack-Marke (`controlledBy`) nicht
 * — daher hier ergänzt. `vorgabe` = `ctx.cardOwner`.
 */
function kontrolleur(hero, vorgabe) {
  return hero?.charmedBy ?? hero?.controlledBy ?? vorgabe;
}

/** War dieser Held ein Starthelden von Spieler `pi`? */
function istStartheldVon(hero, pi) {
  return !!hero && hero[STARTHELD_VON] === pi;
}

/** Die obersten `n` Karten des Potion Decks von `pi` (oberste zuerst, ohne sie zu entnehmen). */
function obersteKarten(engine, pi, n = 1) {
  return (engine.gs.players[pi]?.potionDeck || []).slice(0, n);
}

/**
 * Ist das Potion Deck von `pi` auf die Klausel dieses Helden zugeschnitten? Nicht leer, und jede Karte
 * darin erfüllt die Klausel (Kartenart, verschiedene Namen, Level-Grenze; die Kartenzahl bleibt außen vor).
 */
function potionDeckZugeschnitten(engine, pi, heroName) {
  const klausel = PotionDeckClauses.clauseOfHero(heroName);
  const deck = engine.gs.players[pi]?.potionDeck || [];
  if (!klausel || deck.length === 0) return false;
  const db = engine._getCardDB();
  return PotionDeckClauses.poolOk([klausel], deck, (n) => db[n]);
}

/**
 * „You can only activate this effect if this was one of your starting Heroes" — mit der Ausnahme für
 * ÜBERNOMMENE Helden (siehe Kopf).
 * @param {object} hero      der Held (auf der Brettseite `feld`)
 * @param {number} pi        wer den Effekt nutzen will (Kontrolleur)
 * @param {number} feld      Brettseite des Helden
 * @param {string} heroName  Kartenname (Schlüssel der Klausel-Tabelle)
 */
function darfAktivieren(engine, hero, pi, feld, heroName) {
  if (!hero) return false;
  if (istStartheldVon(hero, pi)) return true;
  // Übernommen = steht auf der Seite eines anderen oder war der Starthero eines anderen. Ein eigener Held, der
  // später ins Spiel kam (kein Stempel), bleibt gesperrt: „this was one of your starting Heroes".
  const uebernommen = feld !== pi || (hero[STARTHELD_VON] != null && hero[STARTHELD_VON] !== pi);
  return uebernommen && potionDeckZugeschnitten(engine, pi, heroName);
}

const starthelden = { onGameStart, istStartheldVon, obersteKarten, darfAktivieren, potionDeckZugeschnitten, kontrolleur };

module.exports = { starthelden, onGameStart, istStartheldVon, obersteKarten, darfAktivieren, potionDeckZugeschnitten, kontrolleur };
