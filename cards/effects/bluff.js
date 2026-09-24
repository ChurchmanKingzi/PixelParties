'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Bluff"  (v1363, Text von Al 24.9.: „Draw 3" statt 2)
//  Attack (Surprise) — Fighting Lv0
//
//  "Activate this Surprise when the user is chosen by an Attack or Spell.
//   Draw 3 cards. When this card is removed from the board by an
//   opponent's card or effect, draw 4 cards."
//
//  ① AUSLOESER wie Flooding: der Wirt wird von einer Attack- oder
//     Spell-KARTE gewaehlt (keine Kreatur-/Helden-/Artefakt-Effekte, keine
//     volle AoE — „chosen"). Kein Negieren: die Attack/der Spell loest
//     danach ganz normal auf.
//  ② „removed from the board by an opponent's card or effect": Bluff
//     verlaesst das Brett (Surprise Zone — oder eine Support Zone, in der
//     es verdeckt liegt), und der Bewegende ist der GEGNER. Der Bewegende
//     kommt aus dem Leave-Hook (`entferntVon`, Engine v1363). Das eigene
//     Aufdecken (Bluff geht nach dem Aktivieren in die Ablage) und eigene
//     Effekte (Silent Water Mizune, Spider-Kosten) ziehen nichts.
//     Gezogen wird vom Besitzer der Karte.
// ═══════════════════════════════════════════
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Bluff';
const ZIEHEN_AKTIV = 3;
const ZIEHEN_ENTFERNT = 4;
const BRETT = new Set(['surprise', 'support']);

module.exports = {
  isSurprise: true,
  // Auch ausserhalb des Bretts zuhoeren: manche Entfern-Wege feuern den
  // Leave-Hook erst, wenn die Karte schon umgebucht ist. Der Handler
  // reagiert ohnehin nur auf das eigene Verlassen des Bretts.
  activeIn: ['surprise', 'support', 'discard', 'deleted', 'hand'],
  // Verdeckt liegende Karten hoeren sonst auf gar keinen Hook (Engine-Filter);
  // Bluff braucht genau diesen einen (Engine-Vertrag v1363).
  hooksWhileFaceDown: ['onCardLeaveZone'],

  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (!sourceInfo) return false;
    if (sourceInfo.owner == null || sourceInfo.owner < 0) return false;
    if (sourceInfo.cardInstance?._isAoeCheck) return false;
    const cd = sourceInfo.cardInstance
      ? (engine.getEffectiveCardData?.(sourceInfo.cardInstance) || engine._getCardDB()[sourceInfo.cardName])
      : engine._getCardDB()[sourceInfo.cardName];
    if (!cd) return false;
    return hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell');
  },

  onSurpriseActivate: async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    engine.log('bluff_draw', { player: engine.gs.players[pi]?.username, card: CARD_NAME, count: ZIEHEN_AKTIV });
    await engine.actionDrawCards(pi, ZIEHEN_AKTIV);
    engine.sync();
    return {};
  },

  hooks: {
    onCardLeaveZone: async (ctx) => {
      const self = ctx.card;
      const weg = ctx.leavingCard || ctx.card;
      if (!self || !weg || weg.id !== self.id) return;
      if (!BRETT.has(ctx.fromZone)) return;
      if (ctx.toZone && BRETT.has(ctx.toZone)) return;   // Umzug auf dem Brett
      const engine = ctx._engine;
      const pi = self.originalOwner ?? self.owner;
      const von = ctx.entferntVon;
      if (typeof von !== 'number' || von === pi) return;
      // Kein doppeltes Ziehen, falls zwei Wege denselben Abgang melden.
      if (self._bluffGezogen) return;
      self._bluffGezogen = true;
      // v1365 (Als Befund): erst ziehen, wenn Bluff die Zone WIRKLICH
      // verlassen hat — sonst stand die Karte waehrend Auftritt und Zug
      // noch in der Surprise Zone, obwohl ihr Flug laengst gelandet war.
      engine.nachAbgang(self, async () => {
        await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
        engine.log('bluff_removed_draw', { player: engine.gs.players[pi]?.username, card: CARD_NAME, count: ZIEHEN_ENTFERNT });
        await engine.actionDrawCards(pi, ZIEHEN_ENTFERNT);
        engine.sync();
      });
    },
  },
};
