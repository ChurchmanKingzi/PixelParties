// ═══════════════════════════════════════════
//  CARD EFFECT: "Trial of Annoyance"
//  Spell (Decay Magic Lv1, Normal, Trials)
//
//  "You cannot play other Attacks or Spells the turn you play this
//   card. Your opponent discards cards from their hand until they
//   only have 2 cards left. You can only play 1 \"Trial of Annoyance\"
//   per game."
//
//  Umsetzung
//  ─────────
//  • Einmal pro Spiel + symmetrischer Riegel aus `_trials-shared.js`.
//  • „bis nur noch 2 uebrig sind" ist eine ZIELGROESSE, keine feste
//    Anzahl: abgeworfen wird `Handgroesse − 2`. Bei 2 oder weniger
//    Karten passiert nichts — dann ist die Bedingung schon erfuellt,
//    der Spell laeuft trotzdem durch und stempelt den Riegel.
//  • DER GEGNER WAEHLT, welche Karten fallen. `actionPromptForceDiscard`
//    ist genau dafuer da und bringt alles mit, was daran haengt: die
//    Abwurf-Sperre gegen Schnellklicks, die Stapel-Klammer fuer
//    `onForcedDiscardBatchEnd` (Cute Bunny), die aufgeschobenen
//    `onDiscard`-Hooks (Glass of Marbles, Skull Necklace) und die
//    Flugbahn Hand→Discard.
//  • Die Anzahl wird EINMAL vorab bestimmt, nicht in einer Schleife
//    gegen die laufende Handgroesse geprueft: waehrend des Abwerfens
//    koennen `onDiscard`-Effekte Karten NACHZIEHEN. Der Kartentext
//    beschreibt einen Vorgang, keine Dauerregel — wer durch einen
//    ausgeloesten Effekt wieder auf mehr als 2 kommt, behaelt sie.
//    Ohne diese Festlegung waere eine Endlosschleife moeglich.
//  • Der Effekt trifft die Hand, nicht das Brett — kein `requiresTarget`,
//    also kein Blinded-Gate.
// ═══════════════════════════════════════════

const { TRIAL_KEYS, trialTurnIsClean, stampTrialLock } = require('./_trials-shared');

const CARD_NAME = 'Trial of Annoyance';
const HAND_TARGET = 2;

module.exports = {
  oncePerGame: true,
  oncePerGameKey: TRIAL_KEYS[CARD_NAME],

  // Nur der Rundenriegel — wie Loyalty bewusst OHNE Inhaltspruefung:
  // die Pruefung darf auch gegen eine kleine Gegnerhand abgelegt
  // werden.
  spellPlayCondition(gs, pi) {
    return trialTurnIsClean(gs, pi);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      const oppIdx = pi === 0 ? 1 : 0;
      const opp = gs.players[oppIdx];

      // Riegel zuerst — gilt auch, wenn nichts abzuwerfen ist.
      stampTrialLock(gs, pi);

      // ★ ALS VORGABE 18.8.: „Neun geflügelte Katzen (animiert!), die in
      // Dreiergruppen um jede der drei Hero Zones des Gegners schwirren
      // wie lästige Fliegen."
      // Drei Ausloesungen, eine je gegnerischem Helden — jede zeichnet
      // ihre eigene Dreiergruppe. Das ergibt die neun und haelt die
      // Katzen bei ihrem Helden, statt sie zentral zu buendeln.
      for (let hi = 0; hi < 3; hi++) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'annoying_cats', owner: oppIdx, heroIdx: hi, zoneSlot: -1,
        });
      }
      engine.sync();
      // Kurz schwirren lassen, bevor der Abwurf-Dialog aufgeht — sonst
      // verdeckt die Abfrage die Animation sofort.
      await engine._delay(900);

      const handSize = (opp?.hand || []).length;
      const toDiscard = Math.max(0, handSize - HAND_TARGET);
      if (toDiscard === 0) {
        engine.log('trial_of_annoyance', {
          player: ps.username, opponent: opp?.username,
          discarded: 0, note: 'hand_already_at_or_below_target',
        });
        engine.sync();
        return;
      }

      await engine.actionPromptForceDiscard(oppIdx, toDiscard, {
        title: CARD_NAME,
        source: CARD_NAME,
        description: `Discard down to ${HAND_TARGET} cards.`,
      });

      engine.log('trial_of_annoyance', {
        player: ps.username, opponent: opp?.username,
        requested: toDiscard, handAfter: (opp?.hand || []).length,
      });
      engine.sync();
    },
  },
};
