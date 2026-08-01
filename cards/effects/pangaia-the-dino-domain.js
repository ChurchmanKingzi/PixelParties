// ═══════════════════════════════════════════
//  CARD EFFECT: "Pangaia, the Dino Domain"
//  Spell (Area, Lv2 Support Magic) — Gigantisaurs
//
//  While in play, every Lv3+ Creature SUMMONED
//  by either player has its current and max HP
//  increased by 200 on entry. Move/return events
//  (Slippery Skates, Dark Gear, Diplomacy) are
//  ignored — only fresh summons / placements
//  qualify, mirroring Blood Moon's `_isMove`
//  carve-out.
//
//  The buff is permanent on the affected Creature
//  even after Pangaia leaves play (it's a one-shot
//  +200 baked into `counters.{maxHp,currentHp}`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isAreaImmuneInst } = require('./_diver-helmet-shared');

const CARD_NAME = 'Pangaia, the Dino Domain';
const LV_THRESHOLD = 3;
const HP_BONUS = 200;

module.exports = {
  activeIn: ['area'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;
      if (ctx._isMove) return; // skip movements (not fresh summons)

      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const cd = entering.counters?._cardDataOverride || cardDB[entering.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
      if (!cd) return;
      if (!hasCardType(cd, 'Creature')) return;
      if (cd.cardType === 'Token') return;
      const level = cd.level || 0;
      if (level < LV_THRESHOLD) return;
      // Diver Helmet: a Creature in the equipped Hero's Support Zones
      // is unaffected by Areas — no +200 HP buff.
      if (isAreaImmuneInst(engine, entering)) return;

      // The buff lands on the freshly-placed instance. `increaseMaxHp`
      // handles the creature path: bumps counters.maxHp and counters.currentHp
      // by the same amount, including overheal semantics (Nao-style)
      // if currentHp was already above maxHp.
      engine.increaseMaxHp(entering, HP_BONUS);

      // Faint earthen-rumble pulse on the buffed slot.
      engine._broadcastEvent('play_zone_animation', {
        type: 'green_pulse', owner: entering.owner,
        heroIdx: entering.heroIdx, zoneSlot: entering.zoneSlot,
      });

      engine.log('pangaia_buff', {
        creature: entering.name,
        owner: engine.gs.players[entering.owner]?.username,
        amount: HP_BONUS,
      });
      engine.sync();
    },
  },
};
