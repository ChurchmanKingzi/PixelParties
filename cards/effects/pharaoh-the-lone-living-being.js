// ═══════════════════════════════════════════
//  CARD EFFECT: "Pharaoh, the Lone Living Being"
//  Hero — 400 HP / 80 ATK (Divinity + Leadership)
//
//  "Whenever this Hero uses an Attack or Spell or summons a Creature
//   it couldn't without the effect of Divinity, place 1 Divinity
//   Counter onto it. At the end of your turn, if there is at least 1
//   Divinity Counter on this Hero, sacrifice a target you control,
//   then remove 1 Divinity Counter from this Hero and draw 2 cards.
//   This effect cannot be negated."
//
//  ── Detecting "couldn't use/summon without Divinity" ────────────
//  Two universal triggers cover EVERY way Pharaoh can use a card,
//  "no matter how" (normal play, additional / inherent / free
//  action, immediate / replacement Action from Lunar Eclipse / The
//  Master's Plan, second cast, …):
//    • Spells & Attacks → `afterSpellResolved` (fires only when the
//      card actually RESOLVED, i.e. was NOT negated — a negated
//      Spell correctly earns no counter). The engine's immediate-
//      action paths were extended to fire this for Attacks too and
//      for the any-Hero replacement path.
//    • Creatures → `onAnyActionResolved` with `actionType:'creature'`
//      (fires for every successful summon Pharaoh performs, normal
//      or immediate-action).
//  Necessity test: re-run the engine's own `heroMeetsLevelReq` with
//  Pharaoh's Divinity slots temporarily stripped. If Pharaoh meets
//  the requirement WITH Divinity (it just resolved/summoned) but NOT
//  without it, Divinity's gap-coverage is what enabled it → place a
//  Divinity Counter. Reusing the engine path means the test honours
//  every level / school / Wisdom / reduction rule automatically
//  (a card Wisdom alone could also cover does NOT count as
//  Divinity-only).
//
//  ── End-of-turn sacrifice ───────────────────────────────────────
//  "Sacrifice a target you control" — per design, ANY target the
//  controller controls (a Creature OR a Hero, Pharaoh itself
//  included). Creatures route through the standard sacrifice
//  pipeline (ON_CREATURE_SACRIFICED → death/discard); Heroes are a
//  voluntary self-defeat (`actionDefeatHero`, bypassing first-turn
//  protection like other voluntary sacrifices). Then 1 counter is
//  removed and the controller draws 2.
//
//  `bypassStatusFilter: true` keeps BOTH the counter placement and
//  the end-of-turn payoff firing while Pharaoh is Frozen / Stunned /
//  Negated — "this effect cannot be negated".
//
//  Counter storage: `hero._divinityCounters` (int). Rendered as a
//  hero badge in app-board.jsx.
// ═══════════════════════════════════════════

const CARD_NAME = 'Pharaoh, the Lone Living Being';
const DIVINITY  = 'Divinity';

/**
 * Would Pharaoh be able to play `cardData` from `heroIdx` if its
 * Divinity slots were removed? Synchronous engine call wrapped in a
 * temporary ability-zone swap (no awaits between swap and restore —
 * safe in single-threaded JS). Returns true (= "didn't need
 * Divinity") on any error or when no Divinity is attached.
 */
function couldUseWithoutDivinity(engine, pi, heroIdx, cardData) {
  const ps = engine.gs.players[pi];
  const origSlots = ps?.abilityZones?.[heroIdx];
  if (!Array.isArray(origSlots)) return true;
  const hasDivinity = origSlots.some(slot => Array.isArray(slot) && slot[0] === DIVINITY);
  if (!hasDivinity) return true; // Divinity wasn't even present.
  // Blank every Divinity-based slot (Performance stacked on Divinity
  // counts as Divinity for coverage, so drop the whole slot).
  const stripped = origSlots.map(slot =>
    (Array.isArray(slot) && slot[0] === DIVINITY) ? [] : slot);
  ps.abilityZones[heroIdx] = stripped;
  try {
    return !!engine.heroMeetsLevelReq(pi, heroIdx, cardData);
  } catch {
    return true; // Be conservative — never spuriously add a counter.
  } finally {
    ps.abilityZones[heroIdx] = origSlots;
  }
}

/**
 * Shared: Pharaoh just used/summoned `cd` from `heroIdx`. If Divinity
 * was necessary to do so, place a Divinity Counter on Pharaoh.
 */
function placeCounterIfDivinityNeeded(ctx, cd) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = ctx.attachedHero;
  if (!hero?.name || hero.hp <= 0) return;

  // It resolved/summoned (so WITH Divinity it was legal). Counter only
  // if it would NOT have been legal without Divinity.
  if (couldUseWithoutDivinity(engine, pi, heroIdx, cd)) return;

  hero._divinityCounters = (hero._divinityCounters || 0) + 1;
  engine._broadcastEvent('play_zone_animation', {
    type: 'johanna_cleanse', owner: pi, heroIdx, zoneSlot: -1,
  });
  engine.log('pharaoh_divinity_counter', {
    player: engine.gs.players[pi]?.username,
    card: cd?.name, counters: hero._divinityCounters,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['hero'],
  // "This effect cannot be negated" — counter placement AND the
  // end-of-turn sacrifice/draw fire through Frozen / Stunned /
  // Negated / Mummified.
  bypassStatusFilter: true,

  hooks: {
    /**
     * Pharaoh resolved an Attack or Spell (fires only when NOT
     * negated). Counter if Divinity was necessary to use it.
     */
    afterSpellResolved: async (ctx) => {
      const pi = ctx.cardOwner;
      // Must be Pharaoh itself doing the casting.
      if (ctx.casterIdx !== pi || ctx.heroIdx !== ctx.cardHeroIdx) return;
      const cd = ctx.spellCardData;
      if (!cd || (cd.cardType !== 'Spell' && cd.cardType !== 'Attack')) return;
      placeCounterIfDivinityNeeded(ctx, cd);
    },

    /**
     * Pharaoh summoned a Creature (universal action-resolved signal —
     * fires for normal AND immediate/additional summons). Counter if
     * Divinity was necessary to summon it. Spell/Attack action types
     * are handled by afterSpellResolved above (negation-correct), so
     * they're ignored here to avoid double-counting.
     */
    onAnyActionResolved: async (ctx) => {
      if (ctx.actionType !== 'creature') return;
      const pi = ctx.cardOwner;
      if (ctx.playerIdx !== pi || ctx.heroIdx !== ctx.cardHeroIdx) return;
      const cd = ctx._engine._getCardDB()[ctx.cardName];
      if (!cd || cd.cardType !== 'Creature') return;
      placeCounterIfDivinityNeeded(ctx, cd);
    },

    /**
     * End of the controller's turn: if Pharaoh holds ≥1 Divinity
     * Counter, sacrifice a target the controller controls, remove 1
     * counter, then draw 2.
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs.result) return;

      const pi = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== pi) return;

      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      if ((hero._divinityCounters || 0) < 1) return;

      const ps = gs.players[pi];

      // ── Build "targets you control": living Heroes + sacrificeable
      //    Creatures (Cardinal / immune / face-down already excluded
      //    by getSacrificableCreatures). Pharaoh itself is a valid
      //    target — the Lone Living Being can be its own tribute.
      const sacCreatureIds = new Set(
        engine.getSacrificableCreatures(pi).map(c => c.inst.id)
      );

      const target = await ctx.promptDamageTarget({
        side: 'my',
        types: ['hero', 'creature'],
        title: CARD_NAME,
        description: 'Sacrifice a target you control (Divinity Counter payoff).',
        confirmLabel: '🗡️ Sacrifice!',
        confirmClass: 'btn-danger',
        cancellable: false,
        // Non-damage targeting — keep pure damage-mitigation reactions
        // / surprises out of this self-sacrifice pick.
        dealsDamage: false,
        condition: (t, eng) => {
          if (t.owner !== pi) return false;
          if (t.type === 'hero') {
            const h = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return !!(h && h.name && h.hp > 0);
          }
          // Creature targets come back as type 'equip' with a
          // cardInstance (legacy picker naming).
          if (t.cardInstance) {
            return sacCreatureIds.has(t.cardInstance.id);
          }
          return false;
        },
      });

      const source = { name: CARD_NAME, owner: pi, heroIdx };

      if (target) {
        if (target.type === 'hero') {
          const victim = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (victim && victim.hp > 0) {
            engine._broadcastEvent('play_zone_animation', {
              type: 'knife_sacrifice', owner: target.owner,
              heroIdx: target.heroIdx, zoneSlot: -1,
            });
            await engine._delay(550);
            // Voluntary self-side sacrifice — must land even under the
            // first-turn grace shield (matches Divine Gift of Sacrifice).
            await engine.actionDefeatHero(source, victim, {
              reason: 'Pharaoh sacrifice',
              respectFirstTurnProtection: false,
            });
          }
        } else if (target.cardInstance) {
          // Creature target (type 'equip' + cardInstance).
          const inst = target.cardInstance;
          engine._broadcastEvent('play_zone_animation', {
            type: 'knife_sacrifice', owner: inst.owner,
            heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
          });
          await engine._delay(550);
          // Sacrificing is a sub-type of dying — fire
          // ON_CREATURE_SACRIFICED before the destroy so listeners see
          // the live instance, then route through actionDestroyCard
          // (which also fires ON_CREATURE_DEATH downstream).
          await engine.runHooks('onCreatureSacrificed', {
            creature: inst, cardName: inst.name,
            owner: inst.owner, heroIdx: inst.heroIdx,
            zoneSlot: inst.zoneSlot, source,
            _skipReactionCheck: true,
          });
          await engine.actionDestroyCard(source, inst);
        }
      }

      // "then remove 1 Divinity Counter from this Hero and draw 2
      //  cards." Runs even if Pharaoh sacrificed itself (the trigger
      //  already committed) — guards on the hero object still being
      //  the tracked one.
      if (hero._divinityCounters > 0) hero._divinityCounters -= 1;
      if (hero._divinityCounters <= 0) delete hero._divinityCounters;

      await ctx.drawCards(pi, 2);

      engine.log('pharaoh_divinity_payoff', {
        player: ps?.username,
        sacrificed: target?.cardName || target?.type || null,
        countersLeft: hero._divinityCounters || 0,
      });
      engine.sync();
    },
  },
};
