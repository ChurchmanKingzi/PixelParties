// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Monstrosity"
//  Creature (Summoning Magic Lv2) — 50 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): pick one of your
//  OTHER Deepsea Creatures in play. Return it
//  to hand, then activate its on-summon effect
//  as if it was this Creature's own.
//
//  Copy-activation: we load the copied card's
//  script and invoke its hooks.onPlay with a
//  ctx whose cardName is the COPIED card's
//  name (per user A8 — "use the copied
//  Creature's name"). ctx.card is still the
//  Monstrosity instance so the effect's
//  animations and positional references point
//  at Monstrosity's slot.
//
//  Note: Monstrosity's own onPlay must NOT
//  recurse — if the copied on-summon tries to
//  do another bounce for "Deepsea Monstrosity"
//  it won't find one (we just placed it, and
//  the bounceable check excludes turn-placed
//  creatures). 1 per turn.
// ═══════════════════════════════════════════

const {
  inherentActionIfBounceable,
  canBypassLevelReqIfBounceable,
  canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargetsList,
  tryBouncePlace,
  canSummonPerTurnLimit,
  markSummonedPerTurnLimit,
  isDeepseaCreature,
  returnSupportCreatureToHand,
  promptOptionalOnSummon,
} = require('./_deepsea-shared');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Deepsea Monstrosity';

module.exports = {
  inherentAction: inherentActionIfBounceable,
  canBypassLevelReq: canBypassLevelReqIfBounceable,
  canBypassFreeZoneRequirement: canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlot: canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargets: getBouncePlacementTargetsList,
  beforeSummon: tryBouncePlace,
  canSummon: (ctx) => canSummonPerTurnLimit(ctx, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      markSummonedPerTurnLimit(ctx, CARD_NAME);
      // Don't recurse — if this is being fired via Blood Moon retrigger or
      // itself a copied effect, skip.
      if (ctx._monstrosityCopy) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      const selfInst = ctx.card;

      // Enumerate OTHER Deepsea creatures we control (excluding this one).
      const candidates = [];
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== pi) continue;
        if (inst.id === selfInst.id) continue;
        if (!isDeepseaCreature(inst.name, engine, inst)) continue;
        candidates.push(inst);
      }
      if (candidates.length === 0) return;

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Bounce one of your other Deepsea Creatures and copy its on-summon effect?'
      ))) return;

      // Zone-pick across all candidates.
      const zones = candidates.map(inst => {
        const hero = ps.heroes[inst.heroIdx];
        return {
          heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          label: `${hero?.name || 'Hero'} — ${inst.name} (Slot ${inst.zoneSlot + 1})`,
        };
      });
      const picked = await ctx.promptZonePick(zones, {
        title: CARD_NAME,
        description: 'Pick a Deepsea Creature to bounce (its on-summon will copy onto this one).',
        cancellable: true,
      });
      if (!picked) return;

      const chosenInst = candidates.find(i => i.heroIdx === picked.heroIdx && i.zoneSlot === picked.slotIdx);
      if (!chosenInst) return;
      const copiedName = chosenInst.name;

      // Step 1: bounce the chosen creature back to hand.
      await returnSupportCreatureToHand(engine, chosenInst, CARD_NAME);

      // Step 2: invoke the copied creature's on-summon effect with
      // Monstrosity's instance as the firing card, BUT the copied name
      // as the cardName (per design A8).
      //
      // On-summon effects can live in two places:
      //   (a) `hooks.onPlay`  — the usual slot.
      //   (b) `beforeSummon`  — module-level; some cards (e.g. Dark
      //       Deepsea God) put their tribute / conditional logic here
      //       so Blood Moon retriggers don't double-fire it.
      // Monstrosity fires BOTH, with `_monstrosityCopy: true` on the
      // ctx so scripts that care (DDG skips its own placement, the
      // shared `tryBouncePlace` no-ops) can branch. Cards whose effect
      // is purely in `onPlay` see no change from this addition.
      const copiedScript = loadCardEffect(copiedName);
      const hasOnPlay = !!copiedScript?.hooks?.onPlay;
      const hasBeforeSummon = typeof copiedScript?.beforeSummon === 'function';
      if (!hasOnPlay && !hasBeforeSummon) {
        engine.log('monstrosity_copy_noeffect', { copied: copiedName });
        return;
      }

      // Temporarily re-label the instance so the copied effect's hooks
      // (which often read ctx.cardName / inst.name) see the copied name.
      // CardInstance caches its script in `this.script` — we MUST null
      // it before and after the rename, otherwise getHook() returns the
      // Monstrosity hooks even after the name swap and the copied
      // creature's on-summon never fires.
      const origName = selfInst.name;
      const origScript = selfInst.script;
      selfInst.name = copiedName;
      selfInst.script = null;
      try {
        // (b) beforeSummon copy — invoked directly since it isn't
        // dispatched via runHooks. `_createContext` spreads the hookCtx
        // we pass as the second arg, so `_monstrosityCopy` survives
        // onto ctx.
        if (hasBeforeSummon) {
          const beforeCtx = engine._createContext(selfInst, {
            event: 'beforeSummonCopy',
            _monstrosityCopy: true,
            _skipReactionCheck: true,
          });
          try {
            await copiedScript.beforeSummon(beforeCtx);
          } catch (err) {
            engine.log('monstrosity_copy_beforesummon_error', { copied: copiedName, err: err.message });
          }
        }
        // (a) onPlay copy via runHooks — the instance is already
        // renamed, so the iterator loads the copied creature's script.
        if (hasOnPlay) {
          const fakeHookCtx = {
            _onlyCard: selfInst, playedCard: selfInst,
            cardName: copiedName,
            zone: 'support',
            heroIdx: selfInst.heroIdx, zoneSlot: selfInst.zoneSlot,
            _skipReactionCheck: true,
            _monstrosityCopy: true,
          };
          await engine.runHooks('onPlay', fakeHookCtx);
        }
      } catch (err) {
        engine.log('monstrosity_copy_error', { copied: copiedName, err: err.message });
      } finally {
        selfInst.name = origName;
        selfInst.script = origScript;
      }

      engine.log('monstrosity_copied', {
        player: ps.username, copied: copiedName,
      });
      engine.sync();
    },
  },
};
