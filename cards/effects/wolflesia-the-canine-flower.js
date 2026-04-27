// ═══════════════════════════════════════════
//  CARD EFFECT: "Wolflesia, the Canine Flower"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  Active effect: Goff/Antonia/Stellin-style
//  attach. Place a "Rafflesia, the Poison
//  Princess" from hand or deck underneath.
//
//  While Rafflesia attached:
//    • +200 HP (current and max).
//    • Once per turn, the player may use a
//      Lv 3 or lower Decay or Support Spell
//      with Wolflesia as an additional Action.
//      Wolflesia herself does NOT need any
//      Decay / Support Magic levels — the
//      generic "creature spell-cast" bypass in
//      the engine waives the school / level
//      requirement when the matching additional-
//      action provider is flagged
//      `bypassesCasterRequirement: true`.
//
//  GENERIC "Creature uses Spell" pattern — first
//  example, more to follow. The shape is:
//    1. Register an additional-action type with
//       `allowedCategories: ['spell']`,
//       `heroRestricted: true`, filter accepting
//       only the Spells the Creature is allowed
//       to cast, and `bypassesCasterRequirement:
//       true`.
//    2. Grant the action to the Creature's
//       instance.
//    3. The host hero (whose Support Zone holds
//       the Creature) acts as the technical
//       caster — drop the Spell on the host hero.
//       The engine's `validateActionPlay` honours
//       the bypass flag automatically, no
//       per-Creature engine edits needed.
//    4. Refresh the grant on `onTurnStart` so
//       a new "once per turn" use is available
//       each turn.
// ═══════════════════════════════════════════

const ATTACHABLE = 'Rafflesia, the Poison Princess';
const CARD_NAME  = 'Wolflesia, the Canine Flower';

function typeId(inst) {
  // Per-instance typeId so a hero with two "creature spell-caster"
  // Creatures attached doesn't share the additional-action grant.
  return `creature_spell_cast_${inst.id}`;
}

function setupWolflesiaSpellAction(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst) return;

  // Only register / grant while Rafflesia is actually attached and
  // Wolflesia herself is active (alive, not negated/frozen/stunned/
  // face-down). The standard runHooks filter already gates us on the
  // first three; we still defensively guard `currentHp > 0` here for
  // completeness.
  if (inst.counters?.attachedHero !== ATTACHABLE) return;
  if ((inst.counters?.currentHp ?? 1) <= 0) return;

  engine.registerAdditionalActionType(typeId(inst), {
    label: `${inst.name} — Spell Cast`,
    allowedCategories: ['spell'],
    heroRestricted: true,
    // Bypass the host hero's school / level requirement — Wolflesia
    // herself doesn't have Decay or Support Magic. The engine's
    // `canBypassCasterRequirementForSpell` reads this flag.
    bypassesCasterRequirement: true,
    filter: (cardData) => {
      if (!cardData || cardData.cardType !== 'Spell') return false;
      const isDecayOrSupport =
        cardData.spellSchool1 === 'Decay Magic'
        || cardData.spellSchool1 === 'Support Magic'
        || cardData.spellSchool2 === 'Decay Magic'
        || cardData.spellSchool2 === 'Support Magic';
      if (!isDecayOrSupport) return false;
      if ((cardData.level || 0) > 3) return false;
      return true;
    },
  });

  engine.grantAdditionalAction(inst, typeId(inst));
}

module.exports = {
  activeIn: ['support'],

  attachableHeroes: [ATTACHABLE],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    if (ctx.card.counters?.attachedHero) return false;
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    const hasRafflesia = (ps.hand || []).includes(ATTACHABLE)
      || (ps.mainDeck || []).includes(ATTACHABLE);
    return hasRafflesia;
  },

  async onCreatureEffect(ctx) {
    const ok = await ctx._engine.actionAttachHeroToCreature(
      ctx.cardOwner, ATTACHABLE, ctx.card,
      { source: CARD_NAME },
    );
    // Don't burn the once-per-turn creatureEffect slot — the post-
    // attach Spell-cast (granted by `onAttachHero`) is a SEPARATE
    // once-per-turn gate, and the player should be able to use it
    // the same turn Rafflesia is attached.
    if (ok) ctx._skipCreatureEffectHopt = true;
    return ok;
  },

  onAttachHero(engine, ctx) {
    engine.increaseMaxHp(ctx.card, 200);
    // Set up the spell-cast grant immediately — the player might want
    // to use it the same turn Rafflesia gets attached.
    setupWolflesiaSpellAction(ctx);
  },

  cpuMeta: { alwaysCommit: true },

  hooks: {
    onTurnStart: (ctx) => {
      // Re-grant each turn so the Lv3-Decay/Support cast is available
      // exactly once per turn. The grant is idempotent —
      // grantAdditionalAction sets `additionalActionAvail = 1`, so
      // calling on opp's turn-start too is a harmless no-op (the spell
      // can only be played on the borrower's own turn anyway).
      setupWolflesiaSpellAction(ctx);
    },
  },
};
