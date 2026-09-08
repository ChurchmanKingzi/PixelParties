'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Kasperov, the King of Kings [W]"  (v818)
//  Hero — 300 HP / 60 ATK, Leadership + Summoning Magic
//
//  "Once per turn, during either player's turn, when an "of Kings"
//   Creature you control is defeated, you may immediately summon a
//   "Pawn of Kings" from your hand or deck with any Hero you control as
//   an additional Action."
//
//  Getriggert (`onCreatureDeath`, Opfer eingeschlossen), harte Einmal-
//  pro-Zug-Marke je Held (`gs.hoptUsed`). ECHTE Beschwoerung: nur
//  lebende, nicht stummgeschaltete Helden mit passender Summoning Magic
//  (`summonZonesFor` → `canHeroSummon`; Als Ruling 6.9., Frage 15).
//  Auftritt beim Ja (v818-Grundregel). Die Todes-Zone ist beim Hook
//  bereits frei und steht mit zur Wahl.
// ═══════════════════════════════════════════
const {
  PAWN, isOfKingsName, collectHandAndDeck, pickFromHandOrDeck, summonFromHandOrDeck,
  summonZonesFor, pickZone, ofKingsCpuAnswer,
} = require('./_of-kings-shared');

const CARD_NAME = 'Kasperov, the King of Kings [W]';
const key = (pi, hi) => `kasperov-w:${pi}:${hi}`;
const isPawn = (cd) => !!cd && String(cd.name).startsWith(PAWN);

module.exports = {
  activeIn: ['hero'],

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload?.title === CARD_NAME) return true;
    return ofKingsCpuAnswer(engine, kind, payload);
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const hi = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[hi];
      if (!hero?.name || hero.hp <= 0) return;
      if (engine._isHeroEffectSilenced?.(pi, hi)) return;
      const death = ctx.creature;
      if (!death || !isOfKingsName(death.name)) return;
      if ((death.controller ?? death.owner) !== pi) return;
      if (gs.hoptUsed?.[key(pi, hi)] === gs.turn) return;

      const entries = collectHandAndDeck(engine, pi, isPawn);
      if (entries.length === 0) return;
      const cd = engine._getCardDB()[entries[0].name];
      const zones = summonZonesFor(engine, pi, cd);
      if (zones.length === 0) return;

      const yes = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: `${death.name} was defeated. Summon a "Pawn of Kings" from your hand or deck with any Hero as an additional Action?`,
        showCard: CARD_NAME, showCardLeft: death.name,
        confirmLabel: '♚ Summon!', cancelLabel: 'No', cancellable: true,
      });
      if (!yes) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[key(pi, hi)] = gs.turn;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: death });

      const pick = await pickFromHandOrDeck(engine, pi, entries, {
        title: CARD_NAME, auto: true, cancellable: false,
        description: 'Choose which "Pawn of Kings" to summon.', confirmLabel: '♟ Summon!',
      });
      if (!pick) return;
      const zone = await pickZone(engine, pi, summonZonesFor(engine, pi, engine._getCardDB()[pick.name]),
        CARD_NAME, `Summon ${pick.name} with which Hero?`);
      if (!zone) return;
      const inst = await summonFromHandOrDeck(engine, pi, pick, zone.heroIdx, zone.slotIdx, CARD_NAME);
      engine.log('kasperov_w_summon', { player: gs.players[pi]?.username, summoned: pick.name, from: pick.source, ok: !!inst });
      if (inst) {
        await engine.runHooks('onAnyActionResolved', {
          actionType: 'creature', playerIdx: pi, cardName: pick.name, playedCardName: pick.name, heroIdx: zone.heroIdx,
          isAdditional: true, isInherent: false, isFree: false, _skipReactionCheck: true,
        });
      }
      engine.sync();
    },
  },
};
