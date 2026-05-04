// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Magic"
//  Spell (Magic Arts Lv1, Normal)
//
//  Once per game (shared "Divine Gift" key).
//  Inherent additional Action — played at sorcery
//  speed before the spell you want discounted.
//
//  Reveal a Spell from your hand. Until the end of
//  this turn, that Spell's level in your hand is
//  reduced by 3.
//
//  Targeting: in-hand pick — the player clicks the
//  Spell in their own hand directly (no separate
//  gallery picker). Only Spells with level > 0 are
//  eligible (a level-0 Spell can already be cast
//  freely; a -3 reduction is meaningless for it).
//
//  Play gate: `spellPlayCondition` refuses the cast
//  when no level-1+ Spells exist in hand, so the
//  card greys out instead of activating into a
//  no-op.
//
//  Storage: a per-turn `_magicLevelReductions`
//  array on the player state. The engine's generic
//  `_applyCardLevelReductions` reads this list and
//  the turn-start cleanup clears it.
//
//  Animation: a screen-wide arcane burst —
//  concentric shockwaves, a rotating star glyph,
//  orbital runes, vertical magic streaks rising
//  from below, and a wide spread of sparkle
//  particles. Broadcast via `divine_magic_burst`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Divine Gift of Magic';

/**
 * Hand indices the player may target — Spells (other than this card)
 * with level >= 1. Excludes level-0 Spells (the discount has no effect).
 */
function eligibleTargetIndices(ps, cardDB) {
  const out = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const cn = ps.hand[i];
    if (cn === CARD_NAME) continue;
    const cd = cardDB[cn];
    if (!cd || cd.cardType !== 'Spell') continue;
    if ((cd.level || 0) < 1) continue;
    out.push(i);
  }
  return out;
}

module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  /**
   * Refuse the cast when no level-1+ Spell exists in hand. Greys the
   * card out in hand UI rather than letting the player play into a
   * fizzle. Engine's spellPlayCondition is the canonical "this Spell
   * is unplayable right now" gate (covers Wisdom-cost / hand-lock /
   * etc. checks elsewhere).
   */
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    const cardDB = engine?._getCardDB?.() || {};
    return eligibleTargetIndices(ps, cardDB).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const cardDB = engine._getCardDB();
      const eligibleIndices = eligibleTargetIndices(ps, cardDB);
      if (eligibleIndices.length === 0) {
        // spellPlayCondition should have caught this, but defend if
        // hand state shifted between play-time and resolution.
        gs._spellCancelled = true;
        return;
      }

      // ── Screen-wide arcane burst BEFORE the picker so the player
      // sees the spectacle as the prompt opens. The picker overlays
      // the screen anyway — the burst is rendered behind it on
      // z-index 9700 (prompts run higher), so they layer correctly.
      engine._broadcastEvent('divine_magic_burst');
      await engine._delay(400);

      // ── In-hand pick — the player clicks a Spell directly in their
      // hand row (no gallery). `pickHandCard` is the canonical
      // click-the-card-in-hand prompt; it returns
      // `{ cardName, handIndex }` on confirm or `{ cancelled: true }`
      // on cancel. ──
      const handPick = await engine.promptGeneric(pi, {
        type: 'pickHandCard',
        title: CARD_NAME,
        description: 'Click a level-1+ Spell in your hand to reveal it. Its level is reduced by 3 this turn.',
        eligibleIndices,
        confirmLabel: '✨ Reveal!',
        cancellable: true,
      });

      if (!handPick || handPick.cancelled || !handPick.cardName) {
        gs._spellCancelled = true;
        return;
      }
      const chosenName = handPick.cardName;

      // Reveal to opponent.
      engine._broadcastEvent('card_reveal', { cardName: chosenName, playerIdx: pi });
      await engine._delay(400);

      // Stash the per-turn reduction. Cleared at turn start by the engine.
      if (!ps._magicLevelReductions) ps._magicLevelReductions = [];
      ps._magicLevelReductions.push({ cardName: chosenName, amount: 3 });

      engine.log('divine_gift_magic', {
        player: ps.username,
        spell: chosenName,
        amount: 3,
      });
      engine.sync();
    },
  },
};
