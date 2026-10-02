// ═══════════════════════════════════════════
//  CARD EFFECT: "The Sixth Circle of Hell"
//  Spell (Destruction Magic Lv1, Area) — Archetyp Hell Circles
//
//  „When this card is deleted by an effect and you have not played a deleted Area yet this turn,
//   you may immediately delete all Areas you control and play this deleted Spell as an additional
//   Action. When this card on your side of the board is sent to the discard pile or deleted, you
//   may choose a Hero your opponent controls and take control of it for the rest of the turn. If
//   you do, that Hero is unaffected by your other cards and effects until the end of the turn."
//
//  • Uebernahme ueber den geteilten Ablauf `temporaereKontrolle` (`_charm-shared.js`) mit der
//    Golden-Apple-Marke `onlyFromController` („unaffected by YOUR other cards"); keine
//    Support-Zonen-Sperre (der Text nennt nur den Helden). Rueckgabe am Zugende ist generisch.
// ═══════════════════════════════════════════

const {
  verlaesstBrett, loeschenUndSpielen, cpuBejahen,
} = require('./_hell-circles-shared');
const { temporaereKontrolle, uebernehmbareHelden } = require('./_charm-shared');

const CARD_NAME = 'The Sixth Circle of Hell';

module.exports = {
  activeIn: ['hand', 'area'],
  ...cpuBejahen,

  onDeletedFromAnywhere: (engine, pi) => loeschenUndSpielen(engine, pi, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    onCardLeaveZone: async (ctx) => {
      if (!verlaesstBrett(ctx)) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      if (gs.firstTurnProtectedPlayer === oi) return;
      const kandidaten = uebernehmbareHelden(gs, oi);
      if (kandidaten.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const ziele = kandidaten.map(h => ({
        id: `hero-${oi}-${h.heroIdx}`, type: 'hero', owner: oi, heroIdx: h.heroIdx, cardName: h.heroName,
      }));
      const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
        maxTotal: 1,
        title: CARD_NAME,
        description: 'You may choose a Hero your opponent controls and take control of it for the rest of the turn.',
        confirmLabel: '😈 Take Control!',
        confirmClass: 'btn-danger',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
      });
      if (!gewaehlt || gewaehlt.length === 0) return;
      const ziel = ziele.find(t => t.id === gewaehlt[0]);
      if (!ziel) return;
      const erg = await temporaereKontrolle(engine, {
        controllerPi: pi, ownerPi: oi, heroIdx: ziel.heroIdx,
        sourceName: CARD_NAME, marker: 'onlyFromController', supportZonesLocked: false,
      });
      engine.log('sixth_circle_control', { player: gs.players[pi]?.username, target: ziel.cardName, ok: erg.ok });
      engine.sync();
    },
  },
};
