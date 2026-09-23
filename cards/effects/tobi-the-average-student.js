'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Tobi, the Average Student"  (v1307, neuer Text)
//  Creature — Summoning Magic Lv1
//
//  "You may reveal a Double Spell in your hand to summon this Creature
//   as an additional Action. You may once per turn reveal a Double Spell
//   from your hand permanently. Spells revealed by this effect have their
//   levels reduced by 1 while they remain revealed in your hand. You can
//   only control 1 "Tobi, the Average Student"."
//
//  ① `inherentAction` als Funktion: frei, solange ein Double Spell auf
//     der Hand liegt. Nach der Gratis-Beschwoerung wird er dem Gegner
//     gezeigt (bei mehreren waehlt der Spieler).
//  ② Creature-Effekt: einen noch nicht dauerhaft aufgedeckten Double
//     Spell dauerhaft aufdecken (`_permanentlyRevealedHandIndices`, wie
//     Bamboo Shield) und ihm −1 Level geben (`_handLevelOffsets`, folgt
//     der Kopie durch die Hand und faellt mit ihr weg). Beides haengt an
//     der KARTE, nicht an Tobi — es bleibt, auch wenn Tobi geht.
//  ③ „only control 1": `beforeSummon`.
// ═══════════════════════════════════════════
const { istDoppelSpell, kontrolliert } = require('./_double-shared');

const CARD_NAME = 'Tobi, the Average Student';

function doppelIndizes(engine, pi, nurVerdeckt) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const offen = ps?._permanentlyRevealedHandIndices || {};
  return (ps?.hand || []).map((n, i) => i).filter(i =>
    istDoppelSpell(db[ps.hand[i]]) && (!nurVerdeckt || !offen[i]));
}

module.exports = {
  activeIn: ['hand', 'support'],
  creatureEffect: true,

  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    return !!eng && doppelIndizes(eng, pi, false).length > 0;
  },

  async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, CARD_NAME); },

  hooks: {
    // ① Das Aufdecken nach der Gratis-Beschwoerung
    onAnyActionResolved: async (ctx) => {
      if (ctx.actionType !== 'creature' || ctx.playedCardName !== CARD_NAME) return;
      if (!ctx.isInherent || ctx.playerIdx !== ctx.cardOwner || ctx.card?.zone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const idx = doppelIndizes(engine, pi, false);
      if (idx.length === 0) return;
      let i = idx[0];
      if (new Set(idx.map(k => ps.hand[k])).size > 1) {
        const r = await engine.promptGeneric(pi, {
          type: 'handPick', title: CARD_NAME,
          description: 'Reveal which Double Spell for summoning Tobi?',
          eligibleIndices: idx, minSelect: 1, maxSelect: 1, cancellable: false,
          confirmLabel: '👀 Reveal', pickIntent: 'use',
        });
        const p = r?.selectedCards?.[0];
        if (p && idx.includes(p.handIndex)) i = p.handIndex;
      }
      engine.revealToOpponent(pi, ps.hand[i], { source: CARD_NAME });
      engine.sync();
    },
  },

  canActivateCreatureEffect(ctx) {
    return doppelIndizes(ctx._engine, ctx.cardOwner, true).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const idx = doppelIndizes(engine, pi, true);
    if (idx.length === 0) return false;
    const r = await engine.promptGeneric(pi, {
      type: 'handPick', title: CARD_NAME,
      description: 'Reveal a Double Spell permanently — its level is reduced by 1 while it stays revealed in your hand.',
      eligibleIndices: idx, minSelect: 1, maxSelect: 1, cancellable: true,
      confirmLabel: '👀 Reveal!', pickIntent: 'use',
    });
    const p = r?.selectedCards?.[0];
    if (!p || !idx.includes(p.handIndex) || ps.hand[p.handIndex] !== p.cardName) return false;
    const i = p.handIndex;
    if (!ps._permanentlyRevealedHandIndices) ps._permanentlyRevealedHandIndices = {};
    ps._permanentlyRevealedHandIndices[i] = true;
    if (!ps._handLevelOffsets) ps._handLevelOffsets = {};
    ps._handLevelOffsets[i] = (ps._handLevelOffsets[i] || 0) - 1;
    engine.revealToOpponent(pi, p.cardName, { source: CARD_NAME });
    engine.log('double_class', { player: ps.username, card: CARD_NAME, text: `permanently revealed ${p.cardName} (level −1)` });
    engine.sync();
    return true;
  },

  cpuResponse(engine, kind, p) {
    if (kind !== 'generic' || p?.title !== CARD_NAME || p?.type !== 'handPick') return undefined;
    const ps = engine.gs.players[engine._cpuPlayerIdx];
    const db = engine._getCardDB();
    const i = [...(p.eligibleIndices || [])].sort((a, b) => (db[ps.hand[b]]?.level || 0) - (db[ps.hand[a]]?.level || 0))[0];
    return i == null ? undefined : { selectedCards: [{ handIndex: i, cardName: ps.hand[i] }] };
  },
};
