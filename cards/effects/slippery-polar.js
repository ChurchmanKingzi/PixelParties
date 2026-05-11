// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Polar"
//  Creature (Summoning Magic Lv2, 130 HP — Slippery)
//
//  At the beginning of each of your turns, slide
//  this Creature into the free Support Zone of an
//  adjacent Hero (if possible).
//
//  Once per turn, when this Creature is moved into
//  a different Hero's Support Zone, the HERO IN
//  WHOSE ZONE IT ENDS (Polar's destination heroIdx,
//  per the user clarification — not the Hero it
//  came from) may immediately use a Summoning
//  Magic Spell from your hand as an additional
//  Action.
//
//  Wiring:
//   • Registers a single shared additional-action
//     type `slippery-polar` whose filter accepts
//     any Spell with `Summoning Magic` in
//     spellSchool1 or spellSchool2. The grant is
//     `heroRestricted: true` — only the Hero
//     hosting Polar (per its tracked `inst.heroIdx`)
//     can spend the bonus, so Polars on different
//     Heroes don't share each other's grants.
//   • HOPT key `slippery-polar:<instId>` keyed on
//     this Polar's instance gates "once per turn"
//     per-Polar (a player can run two Polars and
//     get two bonus Spells if both move into a
//     different Hero this turn).
//   • Grant is cleared at end of the controller's
//     turn (`onTurnEnd`) so it doesn't carry over —
//     the bonus is "immediately, this turn".
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { onSlipperyTurnStart, slipperyOnMoveGate } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Polar';
const ADDITIONAL_TYPE = 'slippery-polar';

/**
 * Spell filter for the bonus Action — any Spell whose primary or
 * secondary spell school is `Summoning Magic`. Matches the card text
 * verbatim, no level restriction (the bonus uses standard play-time
 * level gates against the host Hero's ability stack like any other
 * additional-action Spell).
 */
function isSummoningMagicSpell(cardData) {
  if (!cardData) return false;
  if (!hasCardType(cardData, 'Spell')) return false;
  return cardData.spellSchool1 === 'Summoning Magic'
      || cardData.spellSchool2 === 'Summoning Magic';
}

function ensureRegistered(engine) {
  if (engine._slipperyPolarTypeRegistered) return;
  engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
    label: 'Slippery Polar',
    allowedCategories: ['spell'],
    heroRestricted: true,
    filter: isSummoningMagicSpell,
  });
  engine._slipperyPolarTypeRegistered = true;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const gs = engine.gs;
      // Per-instance HOPT — "once per turn" applies to THIS Polar.
      const hoptKey = `${ADDITIONAL_TYPE}:${ctx.card.id}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      // Only grant when the destination Hero is alive (the bonus is
      // useless on a dead host — no Spell could be cast through them).
      const destHero = gs.players[pi]?.heroes?.[ctx.card.heroIdx];
      if (!destHero?.name || destHero.hp <= 0) return;

      ensureRegistered(engine);
      engine.grantAdditionalAction(ctx.card, ADDITIONAL_TYPE);
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      const ps = gs.players[pi];
      engine.log('slippery_polar_grant', {
        player: ps?.username, hero: destHero.name,
      });
      engine.sync();
    },

    /**
     * Expire the bonus at end of the controller's turn. The grant is
     * scoped to the same-turn "immediately" window — if the player
     * didn't spend it before End Turn, it doesn't carry over. Other
     * Polars on the same side each expire their own grant
     * independently because each instance carries its own counter.
     */
    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst?.counters?.additionalActionAvail) return;
      if (inst.counters.additionalActionType !== ADDITIONAL_TYPE) return;
      ctx._engine.expireAdditionalAction(inst);
    },
  },
};
