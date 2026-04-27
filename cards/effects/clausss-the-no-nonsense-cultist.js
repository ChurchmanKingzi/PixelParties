// ═══════════════════════════════════════════
//  CARD EFFECT: "Clausss, the No-Nonsense Cultist"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  Two-mode active effect — INDEPENDENT once-
//  per-turn gates. Mode A (attach) does NOT
//  consume the engine's `creature-effect:${inst.id}`
//  HOPT (the script stamps `_skipCreatureEffectHopt`
//  on the ctx during the attach), so Mode B can
//  fire the same turn the attach lands. Mode B
//  consumes HOPT normally.
//
//    A) NOT YET ATTACHED:
//       Place a "Klaus, the Cult Leader" from
//       your hand or deck underneath this
//       Creature.
//
//    B) KLAUS ATTACHED:
//       Sacrifice a Creature you control that was
//       NOT summoned this turn → grant a second
//       Action this turn's Action Phase.
//
//  While Klaus is attached:
//    • +200 HP (current and max).
//    • The bonus mode (B) becomes the active
//      effect.
//
//  Second-action grant uses the SAME flag
//  Torchure uses (`ps._bonusMainActions = 1`),
//  so multiple grants OVERLAP into a single
//  bonus slot — Torchure + Clausss in one turn,
//  or two Clausss firing on the same turn, both
//  still grant exactly one bonus action. The
//  flag is consumed after the second action is
//  played (engine handles the consumption).
//
//  Phase restriction: the sacrifice mode only
//  fires during Main Phase 1 (phase 2). Main
//  Phase 2 (phase 4) is post-Action and the
//  bonus would be wasted — the engine's
//  `getActivatableCreatures` allows Main Phase
//  2 and 4, so this script narrows further.
//
//  Sacrifice candidates filter via the standard
//  `engine.getSacrificableCreatures` (already
//  drops Cardinal Beasts / immovables / face-
//  downs etc.) plus a `c.inst.turnPlayed !==
//  gs.turn` filter for "not summoned this turn".
// ═══════════════════════════════════════════

const ATTACHABLE = 'Klaus, the Cult Leader';
const CARD_NAME  = 'Clausss, the No-Nonsense Cultist';

function freshSacrificableCount(engine, pi) {
  const turn = engine.gs.turn;
  const cs = engine.getSacrificableCreatures(pi);
  let n = 0;
  for (const c of cs) {
    if (c.inst.turnPlayed !== turn) n++;
  }
  return n;
}

module.exports = {
  activeIn: ['support'],

  attachableHeroes: [ATTACHABLE],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;

    if (!ctx.card.counters?.attachedHero) {
      // Mode A: attach Klaus. Requires a Klaus accessible from hand
      // or deck.
      return (ps.hand || []).includes(ATTACHABLE)
        || (ps.mainDeck || []).includes(ATTACHABLE);
    }

    // Mode B: sacrifice for second action. Restricted to Main Phase 1
    // (phase 2) so the bonus action lands in the upcoming Action
    // Phase — Main Phase 2 (phase 4) is post-Action, the bonus would
    // be wasted there.
    if (engine.gs.currentPhase !== 2) return false;

    // Need at least one sacrificable creature that wasn't summoned
    // this turn (engine's helper already filters Cardinal Beasts /
    // immovables / face-down).
    return freshSacrificableCount(engine, ctx.cardOwner) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];

    // Mode A: attach Klaus.
    if (!ctx.card.counters?.attachedHero) {
      const ok = await engine.actionAttachHeroToCreature(
        ctx.cardOwner, ATTACHABLE, ctx.card,
        { source: CARD_NAME },
      );
      // Don't burn the once-per-turn creatureEffect slot — Mode B
      // (sacrifice for second action) is a SEPARATE once-per-turn
      // gate, and the player should be able to use it the same turn
      // Klaus is attached.
      if (ok) ctx._skipCreatureEffectHopt = true;
      return ok;
    }

    // Mode B: sacrifice → second action.
    const sacrificed = await engine.resolveSacrificeCost(ctx, {
      minCount: 1,
      // Cap at exactly one — the card text reads "sacrifice A
      // Creature", singular. Without `maxCount`, the picker would
      // accept multi-select up to the full candidate list, letting
      // the player burn extra creatures for the same single bonus.
      maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to gain a second Action this turn.',
      confirmLabel: '🗡️ Sacrifice & Act!',
      confirmClass: 'btn-danger',
      cancellable: true,
      // "Not summoned this turn" gate — Clausss explicitly excludes
      // fresh placements/summons. The engine's default sacrifice
      // collector doesn't apply this gate (Sacrifice to Divinity is
      // permissive), so we layer it on per-card here.
      filter: (c) => c.inst.turnPlayed !== engine.gs.turn,
    });
    if (!sacrificed) return false;

    // Grant the second-action grace slot. Same `_bonusMainActions = 1`
    // flag Torchure uses — assignment (not increment) means multiple
    // sources overlap into a single bonus slot. The engine consumes
    // the flag after the second action is played.
    ps._bonusMainActions = 1;

    engine.log('clausss_second_action', {
      player: ps.username,
      sacrificed: Array.isArray(sacrificed)
        ? sacrificed.map(s => s.cardName)
        : null,
    });
    engine.sync();
    return true;
  },

  onAttachHero(engine, ctx) {
    engine.increaseMaxHp(ctx.card, 200);
  },

  cpuMeta: { alwaysCommit: true },
};
