// ═══════════════════════════════════════════
//  CARD EFFECT: "No Retreat!"
//  Spell (Reaction, Lv1, Decay Magic)
//
//  Play immediately when your opponent activates
//  a card or effect that includes shuffling cards
//  from their hand, discard pile, or side of the
//  board back into the deck. Negate that card or
//  effect.
//
//  Detection: every card whose effect literally
//  recycles cards back into the deck declares
//  `shufflesFromHandOrDiscardIntoDeck: true` on its script. The
//  initial chain link is the activator (Spell /
//  Attack / Hero Effect / Ability), so we check
//  its script's flag. A new "shuffles back"
//  effect added to the codebase just needs the
//  flag for No Retreat! to start countering it.
//
//  ★ W5b-Z1 (Al, Welle 5: „generell sollen alle Effekte betroffen sein, die Karten auf der entsprechenden
//  Seite / von entsprechenden Händen shufflen würden"): zwei weitere Wege, alle nur für No Retreat!
//  (Distracting Crystal bleibt bei Hand/Ablage, `shufflesFromHandOrDiscardIntoDeck`):
//    • `shufflesFromBoardIntoDeck: true`  — mischt Karten der eigenen Brettseite ins Deck (statisch).
//    • `shufflesIntoDeckIf(gs, pi, engine, link) => bool` — dynamisch, zum Zeitpunkt des Fensters
//      (`pi` = Aktivierender): z. B. Mass Routing nur, wenn ≥ 1 Kreatur seiner Brettseite betroffen wäre.
//  ★ W5b-Z1b (Al: „No Retreat soll die Priests erkennen"): Priest of Luna / Tempeste – Zusatzbeschwörung
//  („shuffle 5 Creatures … to summon this Creature as an additional Action"). Die Kosten werden in `beforeSummon`
//  bezahlt, das Reaktionsfenster (`executeCardWithChain`) liegt DAVOR; der Kettenkopf trägt `isInherentAction`, und
//  `shufflesIntoDeckIf` der Priests ist wahr, wenn der Kopf eine inhärente Beschwörung ist. Negiert No Retreat! sie,
//  bleibt die Karte auf der Hand (`_negatedKeepInHand` → `chainResult.negatedKeepInHand`, Rückabwicklung in
//  `doPlayCreature`): nichts gemischt, nichts bezahlt. Das passt zu W4b: Kosten, die VOR dem Fenster bezahlt werden
//  (`paySummonCost`), bleiben bei Ganz-Negierung bezahlt – hier IST das Mischen die Kostenzahlung, also bleibt sie
//  hinter dem Fenster (`beforeSummon`) und wird von No Retreat! vorher abgefangen. Neue Kreaturen mit
//  „shuffle … to summon"-Kosten setzen dasselbe `shufflesIntoDeckIf` (Kopf: `link.isInherentAction`).
//  Nicht dazu gehören rein deck-interne Mischungen und spätere Trigger (Amazing Finding, Time Distortion,
//  Create Illusion, Ghazma/Hatusbal-Lage …). Neue Skripte (Meditation, Expedition, Motharch Squire,
//  Priests …) tragen das passende Merkmal, sobald sie geschrieben werden.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'No Retreat!';

module.exports = {
  isReaction: true,
  // Reaction-only — never proactively playable.
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length === 0) return false;
    const initial = chainCtx.chain.find(l => l.isInitialCard);
    if (!initial) return false;
    // "When your opponent activates ..." — only opp-initiated effects.
    if (initial.owner === pi) return false;
    const script = loadCardEffect(initial.cardName);
    if (!script) return false;
    if (script.shufflesFromHandOrDiscardIntoDeck || script.shufflesFromBoardIntoDeck) return true;
    if (typeof script.shufflesIntoDeckIf === 'function') {
      try { return !!script.shufflesIntoDeckIf(gs, initial.casterOwner ?? initial.owner, engine, initial); }
      catch (err) { console.error('[No Retreat!] shufflesIntoDeckIf', initial.cardName, err.message); }
    }
    return false;
  },

  resolve: async (engine, pi, _selectedIds, _validTargets, chain) => {
    const initial = chain.find(l => l.isInitialCard);
    if (!initial) return;
    const initialIdx = chain.indexOf(initial);
    if (initialIdx < 0) return;
    engine.negateChainLink(chain, initialIdx);
    // W5b-Z1b: ist es die Zusatzbeschwörung einer Kreatur, deren Kosten das Mischen sind (Priests), betrifft die Negierung
    // nur diesen Weg – die Karte bleibt auf der Hand (kein Ablage-Weg einer negierten Kreaturenkarte).
    if (initial.cardType === 'Creature' && initial.isInherentAction) initial._negatedKeepInHand = true;
    engine.log('no_retreat_negate', {
      player: engine.gs.players[pi]?.username,
      negated: initial.cardName,
    });
    engine.sync();
  },
};
