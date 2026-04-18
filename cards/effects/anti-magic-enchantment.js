// ═══════════════════════════════════════════
//  CARD EFFECT: "Anti Magic Enchantment"
//  Spell (Support Magic Lv0, Attachment)
//  Pollution archetype.
//
//  Play this card immediately when an Artifact is
//  equipped to a Hero by placing 1 Pollution Token
//  into your free Support Zone.
//
//  The triggering Artifact gains an ADDITIONAL
//  on-board ability while equipped:
//    "Once per turn, the controlling player may
//     negate the effects of a Spell that hits this
//     Artifact's equipped Hero."
//
//  Implementation overview
//  -----------------------
//  • AME is NOT a chain reaction. The chain window
//    asks "negate this card?" — AME doesn't negate,
//    it adds an enchantment. Firing it in the chain
//    window also happens BEFORE the Artifact lands,
//    which is the wrong timing per the card text
//    ("when an Artifact is equipped to a Hero"):
//    the Artifact must already be sitting in the
//    Support Zone for the enchantment to attach.
//
//  • Instead, AME listens on `onCardEnterZone` while
//    still in hand. When the Artifact actually lands
//    in a Support Zone, the hook offers AME's holder
//    the opportunity to play it. On accept: pay a
//    Pollution Token, stamp `counters.antiMagicEnchanted`
//    onto the Artifact, add the `anti_magic_enchanted`
//    buff icon, and move AME to the discard pile.
//
//  • The per-turn "negate one Spell" behaviour is
//    implemented in the engine's actionDealDamage
//    path (it looks for an armed counter on the
//    target Hero's artifacts). Engine-level means
//    it doesn't depend on AME's card instance
//    staying alive/active. Charges refresh to 1 at
//    the start of each turn, also engine-level.
// ═══════════════════════════════════════════

const { placePollutionTokens, hasFreeZone, countFreeZones } = require('./_pollution-shared');

module.exports = {
  // Dimmed in hand so the player can't drag it onto a hero — it's only ever
  // played via the post-land prompt.
  neverPlayable: true,

  // Must stay live while in hand (so the `onCardEnterZone` hook fires there).
  activeIn: ['hand'],

  hooks: {
    /**
     * Fires for every zone entry event. We only care when an Equipment
     * Artifact lands in a Support Zone on the AME holder's own side
     * (card text benefits the "controlling player" — for that to mean
     * anything, AME's holder must be the Artifact's controller).
     *
     * Uses a hookCtx flag so if the player holds multiple copies of AME,
     * only one prompts per event. Self-dedupes via engine.sync after the
     * card leaves hand.
     */
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hand') return;

      // Only the instance's own player; only if the AME name is still
      // physically in their hand array (after one plays, the others skip).
      const pi = inst.owner;
      const ps = gs.players[pi];
      if (!ps || !ps.hand.includes('Anti Magic Enchantment')) return;

      const entering = ctx.enteringCard;
      if (!entering || ctx.toZone !== 'support') return;

      const cardDB = engine._getCardDB();
      const cd = cardDB[entering.name];
      if (!cd || cd.cardType !== 'Artifact') return;
      if ((cd.subtype || '').toLowerCase() !== 'equipment') return;

      // AME enchants YOUR own artifacts — opponent's artifacts do nothing for you.
      if (entering.owner !== pi) return;

      // Dedupe: if multiple AME instances are in this player's hand, only
      // the first that reaches this point prompts. Scoped per-player so the
      // other player's AMEs still get their turn on their own Artifacts.
      const dedupeKey = `_ameCheckedThisEvent_p${pi}`;
      if (ctx[dedupeKey]) return;
      ctx.setFlag(dedupeKey, true);

      // Need a Support Zone for the Pollution Token after the Artifact has
      // already taken one. countFreeZones already reflects the landed
      // artifact's slot being occupied, so >= 1 is sufficient.
      if (countFreeZones(gs, pi) < 1) return;

      // Hero-cast check: at least one hero able to cast AME (Support Magic
      // Lv0 — practically any alive non-shut-down hero qualifies).
      const ameCd = cardDB['Anti Magic Enchantment'];
      let canCast = false;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
        if (hero.statuses?.nulled) continue;
        if (engine.heroMeetsLevelReq(pi, hi, ameCd)) { canCast = true; break; }
      }
      if (!canCast) return;

      // Ensure the client has the artifact's placement rendered BEFORE the
      // prompt appears (so the player can see what was just equipped).
      engine.sync();
      await engine._delay(200);

      // Prompt the holder
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Anti Magic Enchantment',
        message: `${entering.name} was just equipped. Play Anti Magic Enchantment to enchant it?`,
        showCard: 'Anti Magic Enchantment',
        confirmLabel: '✨ Enchant!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!confirmed || confirmed.cancelled) return;

      // Commit — remove AME from the hand, pay the pollution token, apply
      // the counter + buff icon, and move AME's instance to discard.
      const handIdx = ps.hand.indexOf('Anti Magic Enchantment');
      if (handIdx < 0) return; // Raced with another consumer — bail.
      ps.hand.splice(handIdx, 1);

      const promptCtxShim = {
        promptZonePick: (zs, cfg) => engine.promptGeneric(pi, {
          type: 'zonePick', zones: zs,
          title: cfg?.title || 'Anti Magic Enchantment',
          description: cfg?.description || 'Select a zone.',
          cancellable: cfg?.cancellable !== false,
        }),
      };
      await placePollutionTokens(engine, pi, 1, 'Anti Magic Enchantment', {
        promptCtx: promptCtxShim,
      });

      entering.counters.antiMagicEnchanted = {
        ownerPi: pi,
        charges: 1,
      };
      if (!entering.counters.buffs) entering.counters.buffs = {};
      entering.counters.buffs.anti_magic_enchanted = { source: 'Anti Magic Enchantment' };

      ps.discardPile.push('Anti Magic Enchantment');
      inst.zone = 'discard';

      engine.log('anti_magic_enchantment_applied', {
        artifact: entering.name,
        artifactOwner: entering.owner,
        enchantmentOwner: pi,
        player: ps.username,
      });
      engine.sync();
    },
  },
};
