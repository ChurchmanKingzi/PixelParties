// ═══════════════════════════════════════════
//  CARD EFFECT: "Fiedel, the Mercenary Mage"
//  Hero (500 HP, 40 ATK — Decay Magic + Magic Arts)
//
//  Passive — Reaction Spells played from Fiedel
//  count as one level lower for the school-level
//  check. Implemented by populating her hero's
//  `levelOverrideCards` map with `name → level - 1`
//  for every Reaction Spell in the card DB. The
//  engine's level-req gate (engine.js:15590-15592)
//  reads the override per cardName before any
//  ability/board reductions, so no engine change
//  is needed and the rebate composes cleanly with
//  Wisdom / Mana Mining / Forager.
//
//  Reaction Spells already at level 0 (Deepsea
//  Spores) are skipped — there's nothing to
//  reduce, and writing -1 would muddy the override
//  semantics.
//
//  Interaction with Shamanic Curse: Curse reads
//  `prevOverride ?? cardLevel`, increments by 1,
//  then restores prevOverride. With Fiedel's
//  override present, Curse bumps from `level - 1`
//  back to `level` — i.e. Curse cancels Fiedel's
//  rebate exactly once, which matches the engine's
//  established override-stacking convention.
//
//  Re-asserted on onPlay + onTurnStart so revives
//  / Ascension swaps / future swap mechanics don't
//  silently drop the rebate (mirroring Ida's
//  defensive re-assertion pattern).
// ═══════════════════════════════════════════

function _isReactionSpell(cardData) {
  return cardData?.cardType === 'Spell' && cardData?.subtype === 'Reaction';
}

/**
 * Apply Fiedel's reaction-spell rebate to her hero's
 * `levelOverrideCards` map. Walks the card DB once and writes
 * `name → level - 1` for every Reaction Spell with level > 0.
 *
 * Conflict policy: if another override already exists for the
 * same spell on this hero (e.g. Sol Rym-style hard zero), keep
 * the LOWER value. This protects future "Chain Lightning is
 * always level 0"-style overrides from being silently raised
 * back up by the rebate.
 */
function _applyOverrides(ctx) {
  const engine = ctx._engine;
  const ps = engine.gs.players[ctx.cardOriginalOwner];
  const hero = ps?.heroes?.[ctx.cardHeroIdx];
  if (!hero?.name) return;
  if (!hero.levelOverrideCards) hero.levelOverrideCards = {};

  const cardDB = engine._getCardDB();
  for (const name of Object.keys(cardDB)) {
    const cd = cardDB[name];
    if (!_isReactionSpell(cd)) continue;
    const lvl = cd.level || 0;
    if (lvl <= 0) continue;
    const reduced = lvl - 1;
    const existing = hero.levelOverrideCards[name];
    if (existing == null || existing > reduced) {
      hero.levelOverrideCards[name] = reduced;
    }
  }
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onGameStart: (ctx) => _applyOverrides(ctx),
    onPlay: (ctx) => _applyOverrides(ctx),
    onTurnStart: (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      _applyOverrides(ctx);
    },
  },
};
