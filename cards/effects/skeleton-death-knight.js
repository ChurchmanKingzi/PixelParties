// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Death Knight"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose a target your opponent controls.
//  That target cannot perform an Action, or, if it is a Creature,
//  its effects are negated until the end of your opponent's next
//  turn. This counts as a status effect.
//
//  Flavor: presented to the player as a "Silence" — the confirm
//  label, the badge tooltip, and the dark-green diagonal-cut
//  animation all use that wording. Mechanically still routes through
//  the engine's existing `bound` (heroes) and `negated` (creatures)
//  primitives — purely a cosmetic skin keyed on the
//  `source = "Skeleton Death Knight"` tag (heroes) and
//  `inst.counters._dkSilenced` flag (creatures) that StatusBadges
//  reads.
//
//  Mapping:
//    • Hero target   → `bound` status. Default expiry = end of bearer's
//      controller's turn = end of opp's next turn.
//    • Creature target → `actionNegateCreature` with expiresAtTurn =
//      gs.turn + 2 / expiresForPlayer = caster (Necromancy pattern).
//      Expires at start of caster's next turn = right after end of
//      opp's next turn.
//
//  Re-application protection: when bound (hero) or negated-buff
//  (creature) naturally expires, the engine grants post-cleanse
//  immunity automatically — `bound` is now in `CC_STATUSES` and
//  creature negation buffs carry `grantsCcImmuneOnExpire`. Death
//  Knight can't re-target the same victim on the very next turn.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skeleton Death Knight';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    const oppPs = engine.gs.players[oi];
    if (!oppPs) return false;

    // Any opp hero alive + not already bound + not post-cleanse immune?
    for (const hero of (oppPs.heroes || [])) {
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.bound) continue;
      if (hero.statuses?.immune) continue;
      return true;
    }
    // Any opp creature able to receive negated?
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if ((inst.controller ?? inst.owner) !== oi) continue;
      if (inst.counters?.negated) continue;
      if (inst.counters?.cc_immune) continue;
      // Targeting-side gate — omni-immune Creatures stay in the
      // activation pool. The Negate application fizzles in resolve.
      if (engine.canTargetForStatus(inst, 'negated')) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    const target = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      damageType: 'status',
      title: CARD_NAME,
      description: 'Silence an opponent — Heroes cannot perform Actions, Creatures have their effects negated — until the end of their next turn.',
      confirmLabel: '🤐 Silence!',
      confirmClass: 'btn-warning',
      cancellable: true,
      condition: (t) => {
        if (t.type === 'hero') {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (!h || h.hp <= 0) return false;
          if (h.statuses?.bound) return false;
          if (h.statuses?.immune) return false;
          return true;
        }
        if (t.type === 'creature' || t.type === 'equip') {
          const inst = engine.cardInstances.find(c =>
            c.zone === 'support' && c.owner === t.owner
            && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx,
          );
          if (!inst) return false;
          if (inst.counters?.negated) return false;
          if (inst.counters?.cc_immune) return false;
          // Targeting-side gate — omni-immune Creatures stay selectable.
          return engine.canTargetForStatus(inst, 'negated');
        }
        return false;
      },
    });
    if (!target) return false;

    // Dark-green diagonal slash animation on the target zone — fires
    // for both branches before the status lands so the cut visually
    // causes the silence.
    engine._broadcastEvent('play_zone_animation', {
      type: 'silence_cut',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
    });
    await engine._delay(200);

    if (target.type === 'hero') {
      // `source: CARD_NAME` is what the StatusBadges renderer keys on
      // to display the "Silenced" variant of the bound badge. The
      // mechanical effect (cannot act) is identical to bound.
      await engine.addHeroStatus(target.owner, target.heroIdx, 'bound', {
        appliedBy: pi,
        source: CARD_NAME,
      });
      engine.log('skeleton_death_knight_silence', {
        player: gs.players[pi]?.username,
        target: target.cardName,
      });
    } else {
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === target.owner
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
      );
      if (inst) {
        engine.actionNegateCreature(inst, CARD_NAME, {
          expiresAtTurn: gs.turn + 2,
          expiresForPlayer: pi,
        });
        // Stamp the "Silenced" cosmetic marker. The StatusBadges
        // renderer checks for `c._dkSilenced` and renders the
        // Silenced variant of the negated badge. The marker is
        // cleaned up alongside the negated counter when the buff
        // expires — extending the buff's `clearCountersOnExpire`
        // list with `_dkSilenced` makes the engine's expiry path
        // remove it automatically.
        if (inst.counters) inst.counters._dkSilenced = 1;
        const buffKey = 'skeleton_death_knight_negated';
        const buff = inst.counters?.buffs?.[buffKey];
        if (buff) {
          buff.clearCountersOnExpire = [...(buff.clearCountersOnExpire || []), '_dkSilenced'];
        }
        engine.log('skeleton_death_knight_silence', {
          player: gs.players[pi]?.username,
          target: inst.name,
        });
      }
    }
    engine.sync();
    return true;
  },
};
