// ═══════════════════════════════════════════
//  CARD EFFECT: "Pollution Piranha"
//  Creature (Summoning Magic Lv0, Normal) — 50 HP.
//  Pollution archetype.
//
//  • Remove a Pollution Token from YOUR side of the
//    board to summon this Creature. (Summon cost.)
//  • Summoning this Creature counts as an additional
//    Action. (Plays as an inherent additional action
//    — does NOT consume the main action, same pattern
//    as Aggressive Town Guard.)
//  • Once per turn, choose a target and deal 50 damage.
//  • When this Creature leaves the board, delete 1
//    card from your hand.
//
//  Summon cost is resolved via _pollution-shared's
//  generic `removePollutionTokens` — same path Victorica
//  and Mana Beacon use. The `beforeSummon` hook runs
//  BEFORE placement so a cancelled/fizzled cost never
//  leaves a ghost Creature on the board.
//
//  Animations:
//    • Summon: the piranha bite engulfs the Pollution
//      Token as it's consumed to pay the summon cost
//      (piranha_bite on the token's zone).
//    • Damage: the same bite animation chomps the
//      targeted hero/creature.
// ═══════════════════════════════════════════

const {
  removePollutionTokens,
  getPollutionTokens,
  countPollutionTokens,
} = require('./_pollution-shared');

const CARD_NAME = 'Pollution Piranha';
const BITE_DAMAGE = 50;

module.exports = {
  activeIn: ['support'],

  // Summoning Pollution Piranha is itself an additional Action —
  // the summon doesn't consume the main Action Phase action.
  inherentAction: true,

  // Cheap gate: is at least one Pollution Token on our side?
  // Used by the engine's hand-play filter AND by summon effects
  // (Living Illusion etc.) via engine.isCreatureSummonable.
  canSummon(ctx) {
    return countPollutionTokens(ctx._engine, ctx.cardOwner) > 0;
  },

  /**
   * Pre-placement cost resolution. Runs BEFORE the Creature
   * touches the board, so a fizzled cost aborts the whole summon
   * without a transient ghost instance. Returning false aborts.
   *
   * Flow:
   *   1. Pick the specific Pollution Token to consume (auto if one,
   *      zone-pick if multiple).
   *   2. Bite-chomp animation on the chosen Token.
   *   3. Remove that exact Token via the shared helper (filter
   *      narrows the pool to the single chosen instance so the
   *      helper's own pick is bypassed — no double prompt).
   */
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const pool = getPollutionTokens(engine, pi);
    if (pool.length === 0) return false;

    let chosen;
    if (pool.length === 1) {
      chosen = pool[0];
    } else {
      const zones = pool.map(inst => {
        const hero = ps.heroes?.[inst.heroIdx];
        return {
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          label: `${hero?.name || 'Hero'} — Slot ${inst.zoneSlot + 1}`,
        };
      });
      const picked = await ctx.promptZonePick(zones, {
        title: CARD_NAME,
        description: 'Choose a Pollution Token to consume and summon Pollution Piranha in its place.',
        cancellable: false,
      });
      if (!picked) return false;
      chosen = pool.find(inst =>
        inst.heroIdx === picked.heroIdx && inst.zoneSlot === picked.slotIdx
      ) || pool[0];
    }
    if (!chosen) return false;

    // Bite animation on the chosen Token only — then let the shared
    // helper run its standard evaporate removal on the same slot.
    engine._broadcastEvent('play_zone_animation', {
      type: 'piranha_bite',
      owner: chosen.owner,
      heroIdx: chosen.heroIdx,
      zoneSlot: chosen.zoneSlot,
    });
    await engine._delay(450);

    const chosenId = chosen.id;
    const { removed } = await removePollutionTokens(engine, pi, 1, CARD_NAME, {
      promptCtx: ctx,
      filter: (inst) => inst.id === chosenId,
    });
    return removed > 0;
  },

  // ── Activated ability: once per turn, deal 50 damage ──
  creatureEffect: true,
  canActivateCreatureEffect(ctx) {
    // Engine enforces HOPT + summoning sickness generically; this
    // hook is only for extra conditions (we have none).
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const inst = ctx.card;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: BITE_DAMAGE,
      title: CARD_NAME,
      description: `Sink the piranha's teeth into a target for ${BITE_DAMAGE} damage.`,
      confirmLabel: `🦷 Bite! (${BITE_DAMAGE})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) return false;

    // Bite animation on the target
    const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'piranha_bite',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: tgtSlot,
    });
    await engine._delay(500);

    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, BITE_DAMAGE, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, BITE_DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('pollution_piranha_bite', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      damage: BITE_DAMAGE,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * When this Piranha leaves the Support Zone — via death, bounce,
     * banish, anything — the owner deletes 1 card from their hand.
     *
     * Guard pattern copied from flying-island-in-the-sky.js: only fire
     * when the LEAVING card (identified by ctx.fromOwner / fromHeroIdx /
     * fromZoneSlot) matches THIS listener's own board coordinates.
     * Crucial because _pollution-shared's `_removeTokenInstance` fires
     * `onCardLeaveZone` WITHOUT an `_onlyCard` filter — every listener
     * on the board gets the event. ctx.card is the listener (always this
     * Piranha), NOT the departing card, so name-matching on ctx.card
     * would false-trigger on every Pollution Token removal. The slot/
     * owner compare narrows correctly to "this Piranha leaving".
     */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const self = ctx.card; // listener = this Piranha

      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== undefined && ctx.fromOwner !== ctx.cardOwner) return;
      if (ctx.fromHeroIdx !== undefined && ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      if (ctx.fromZoneSlot !== undefined && self?.zoneSlot !== undefined
          && ctx.fromZoneSlot !== self.zoneSlot) return;

      const ownerIdx = self?.owner ?? ctx.cardOwner;
      if (ownerIdx == null) return;
      const ps = gs.players[ownerIdx];
      if (!ps) return;

      if ((ps.hand || []).length === 0) {
        engine.log('pollution_piranha_leave', {
          player: ps.username, note: 'empty_hand',
        });
        return;
      }

      const result = await engine.promptGeneric(ownerIdx, {
        type: 'forceDiscard',
        count: 1,
        title: CARD_NAME,
        description: 'Pollution Piranha left the board — delete 1 card from your hand.',
        instruction: 'Click a card in your hand to delete it.',
        cancellable: false,
      });

      let deletedName;
      let deletedIdx = -1;
      if (result && result.cardName) {
        const handIdx = result.handIndex;
        if (handIdx != null && handIdx >= 0 && handIdx < ps.hand.length
            && ps.hand[handIdx] === result.cardName) {
          deletedIdx = handIdx;
          deletedName = result.cardName;
        } else {
          const fallback = ps.hand.indexOf(result.cardName);
          if (fallback >= 0) { deletedIdx = fallback; deletedName = result.cardName; }
        }
      }
      // Safety fallback — if nothing was picked (shouldn't normally
      // happen because the prompt is non-cancellable), delete from
      // the end of hand so the effect still resolves.
      if (deletedIdx < 0 && (ps.hand || []).length > 0) {
        deletedIdx = ps.hand.length - 1;
        deletedName = ps.hand[deletedIdx];
      }

      if (deletedIdx >= 0 && deletedName) {
        ps.hand.splice(deletedIdx, 1);
        if (!ps.deletedPile) ps.deletedPile = [];
        ps.deletedPile.push(deletedName);
        engine.log('pollution_piranha_delete', {
          player: ps.username, card: deletedName,
        });
      }

      engine.sync();
    },
  },
};
