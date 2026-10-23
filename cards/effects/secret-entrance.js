'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Secret Entrance"
//  Spell (Normal, Magic Arts Lv1) — Umsetzung 23.10.
//
//  „Choose up to 1/2/3 random cards from your opponent's hand and add them to your hand. While your opponent has at least twice as many cards in their hand as you, this
//   counts as an additional Action."
//
//  ── ANZAHL „1/2/3" ──────────────────────────────────────────────────────
//  Das Magic-Arts-Level des Nutzers (Vorgabe 12.9., `effectiveSchoolLevelForCaster`, zählt Ability-Stapel in Support Zonen mit), geklemmt über `scaledByLevel`: Lv 0/1 → 1,
//  Lv 2 → 2, Lv 3 und höher → 3.
//
//  ── „CHOOSE … RANDOM CARDS … ADD THEM TO YOUR HAND" ─────────────────────
//  Wie Loot the Leftovers: der Spieler wählt BLIND Plätze der verdeckten Gegnerhand (`blindHandPick`), nicht abbrechbar nach dem Bestätigen — die Auswahl selbst ist abbrechbar
//  (dann bleibt die Karte auf der Hand). „up to": mindestens eine, höchstens N Karten (`minSelect: 1`). Das Nehmen läuft ganz über die kanonische Hand-Diebstahl-Strecke
//  `engine.actionStealFromHand`: Erstrunden-Schutz, Reaktionsfenster `onHandInteraction` Kategorie `steal` (Ambush the Scout), Flug `play_hand_steal`, Besitzerwechsel
//  (`originalOwner` bleibt beim Gegner: Ablage/Löschen/Deck gehen dorthin), Hook `onCardTakenFromOpponent` (Lilly). Eine gerade aufgelöste Gegnerkarte ist nicht stehlbar.
//
//  ── SPIELBARKEIT ────────────────────────────────────────────────────────
//  Ausgegraut, wenn die Karte nichts bewirken kann: Gegnerhand leer, Erstrunden-Schutz des Gegners, Hand-Sperre des Wirkers (`handZugangGesperrt`: „cannot add cards to your
//  hand"), Spreading Rumor / Slow („cannot interact with your opponent's hand", `_oppHandInteractionLockedTurn`), Boris (`stealsOpponentCards`: holt nur Gegnerkarten).
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „While your opponent has at least twice as many cards in their hand as you" → `inherentAction` als FUNKTION (Vertrag „Counts as an additional Action"): gelesen VOR dem
//  Spielen, also zählt der Stand beim Ausspielen. Gezählt werden die Handkarten des Gegners (ohne die, die er gerade auflöst) gegen die EIGENEN WEITEREN Handkarten — die
//  gespielte Secret Entrance zählt nicht mit (sie ist in dem Moment keine Handkarte mehr; Bauform Live Show). Ohne die Bedingung bleibt die Karte spielbar und kostet eine
//  normale Aktion (`cpuMeta.optionalInherent`). Hat der Gegner keine Karte, ist sie ohnehin nicht spielbar.
// ═══════════════════════════════════════════

const { scaledByLevel } = require('./_hooks');

const CARD_NAME = 'Secret Entrance';
const SCHULE = 'Magic Arts';
const ANZAHL = [1, 2, 3];

/** Handindizes der WEITEREN eigenen Karten (alles außer der gespielten Secret Entrance). Vor der Auflösung zählt eine Kopie dieses Namens als „die gespielte". */
function andereIndizes(engine, ps) {
  const hand = ps?.hand || [];
  const alle = hand.map((_, i) => i);
  if (ps?._resolvingCard && !ps._resolvingCard.fromCreation) return alle.filter(i => !engine._istAufloesendeHandkarte(ps, i));
  const eigene = hand.indexOf(CARD_NAME);
  return eigene >= 0 ? alle.filter(i => i !== eigene) : alle;
}

/** Stehlbare Handkarten des Gegners (ohne eine Karte, die er gerade auflöst). */
function gegnerKarten(engine, ops) {
  return engine._handIndizesOhneAufloesende(ops).length;
}

/** Kann die Karte etwas bewirken? (Spielbarkeit UND zweite Prüfung beim Auflösen) */
function wirkbar(engine, pi, oi) {
  const gs = engine.gs;
  const ps = gs.players[pi], ops = gs.players[oi];
  if (!ps || !ops) return false;
  if (gs.firstTurnProtectedPlayer === oi) return false;                    // Erstrunden-Schutz: die Hand ist tabu
  if (ps._oppHandInteractionLockedTurn === gs.turn) return false;          // Spreading Rumor / Slow
  if (engine.handZugangGesperrt?.(pi)) return false;                       // Hand-Sperre: keine Karten auf die Hand
  return gegnerKarten(engine, ops) > 0;
}

/** „1/2/3": Magic-Arts-Level des Nutzers, geklemmt. */
function anzahlFuer(engine, pi, heroIdx) {
  let lvl = 0;
  try { lvl = engine.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx) || 0; } catch { lvl = 0; }
  return scaledByLevel(lvl, ANZAHL);
}

module.exports = {
  // „While your opponent has at least twice as many cards in their hand as you": Zusatzaktion (Funktion; Stand beim Ausspielen).
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    const ps = gs.players[pi], ops = gs.players[eng.opponentOf(pi)];
    if (!ps || !ops) return false;
    const gegner = gegnerKarten(eng, ops);
    return gegner > 0 && gegner >= 2 * andereIndizes(eng, ps).length;
  },

  blockedByHandLock: true,                 // einziger Nutzen = Karten auf die Hand (Hand-Sperre)
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerhand
  stealsOpponentCards: true,               // Boris: „cannot add any cards originally owned by you to their hand"

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return wirkbar(eng, pi, eng.opponentOf(pi));
  },

  cpuMeta: { optionalInherent: true },     // auch als normale Aktion in der Action Phase spielbar

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      if (!ps) return;
      if (!wirkbar(engine, pi, oi)) { gs._spellCancelled = true; return; }

      const n = anzahlFuer(engine, pi, ctx.cardHeroIdx);
      const res = await engine.actionStealFromHand(pi, {
        count: n,
        minSelect: 1,                                   // „up to": mindestens eine Karte
        title: CARD_NAME,
        description: `Choose up to ${n} random card${n > 1 ? 's' : ''} from your opponent's hand. They are added to your hand.`,
        sourceName: CARD_NAME,
        cancellable: true,
      });
      if (res?.cancelled) { gs._spellCancelled = true; return; }     // Abbruch in der Wahl: die Karte bleibt auf der Hand
      engine.log(res?.stolen?.length ? 'secret_entrance' : 'secret_entrance_fizzle', {
        player: ps.username, opponent: gs.players[oi]?.username, count: res?.stolen?.length || 0,
      });
      engine.sync();
    },
  },
};
