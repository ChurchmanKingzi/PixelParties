// ═══════════════════════════════════════════
//  CARD EFFECT: "Exploding Skull"
//  Creature (Summoning Magic Lv 1, 1 HP)
//
//  When this Creature is defeated, deal 80 damage
//  to all targets your opponent controls. You can
//  only activate this effect once per turn.
//
//  Implementation
//  ──────────────
//  • `activeIn: ['support']` — the engine fires
//    ON_CREATURE_DEATH AFTER splicing the dying
//    Creature out of its slot but BEFORE flipping
//    `inst.zone` to 'discard' / untracking the
//    instance (see `_engine.js` ~L5959 comment).
//    So this script (which lives on the dying
//    instance) is still active in 'support' at
//    hook time.
//
//  • Self-detection via instance id — the global
//    onCreatureDeath fires for every listener; we
//    only fire OUR payload when the dying instance
//    IS this script's host (`death.instId ===
//    ctx.card.id`). Robust against multiple
//    Exploding Skulls on the board.
//
//  • HOPT keyed by CONTROLLER (`exploding-skull:${pi}`).
//    Text says "you can only activate this effect
//    once per turn" — interpreted as a per-side
//    once-per-turn so a second Skull dying on the
//    same side later in the same turn won't fire.
//    Each side has its own HOPT counter, so MY
//    Skull's death + OPP's Skull's death in the
//    same turn both fire (they're different
//    controllers, different HOPT keys).
//
//  • HOPT is claimed AFTER target collection — if
//    opp controls no Heroes and no Creatures, the
//    effect simply doesn't activate (defensive
//    against the rare "wipe board then opp Skull
//    dies" timing) and the HOPT stays free for the
//    rest of the turn.
//
//  • Damage shape mirrors Book of Doom: explosion
//    animations fire on every target in parallel,
//    then a brief delay, then heroes take damage
//    individually and Creatures are processed as
//    one batch through `processCreatureDamageBatch`
//    so on-damage hooks (Diamond, Great Wall, etc.)
//    see the full batch at once.
//
//  • Damage type 'creature' — this is damage from
//    a Creature's effect (the Skull's own death
//    trigger). Composes correctly with type-keyed
//    modifiers and lets recipients distinguish it
//    from spell/attack/artifact damage.
// ═══════════════════════════════════════════

const CARD_NAME = 'Exploding Skull';
const DAMAGE = 80;
const HOPT_KEY_PREFIX = 'exploding-skull';

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    // The Skull WANTS to die — that's how its payload fires. Set the
    // standard "death is good for the owner" magnitude so the CPU
    // values own copies as attractive sacrifice fodder and treats
    // opp copies as unattractive Attack targets (don't feed opp's
    // blast). 60 is roughly the eval value of clearing two opp
    // Creatures, which is the realistic mid-board outcome (3 opp
    // targets × 80 = 240 burst, capped by 1-HP-Creature kills).
    //
    // `preferDead: true` keeps the CPU from spending defensive
    // resources (heals, cleanses, buffs) on this Creature — every
    // turn it lives without dying is a turn its payload isn't
    // firing. Same opt-in Cute Cat uses.
    onDeathBenefit: 60,
    preferDead: true,
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death) return;
      // Self-only: the engine stamps `instId` on the death payload
      // (both the actionMoveCard death path and the damage-batch
      // death path). Compare by id so this only fires for THIS Skull,
      // not for any other Skull that dies somewhere on the board.
      if (death.instId !== ctx.card.id) return;

      // Per-inst suppression flag — set by an earlier Skull's hook in
      // the same turn (loop below). This is the LOAD-BEARING gate for
      // the simultaneous-death case (Book of Doom killing 2+ Skulls in
      // one batch): when Skull A's hook fires first, it stamps
      // `_explodingSkullSuppressed = true` on every other Skull on the
      // same side BEFORE Skull B's HP is even subtracted by the batch's
      // apply-loop. Skull B's hook reaches this check and bails. The
      // flag lives on the inst's JS object — read by direct reference,
      // not via any HOPT table or gs index — so it survives every
      // engine path between the two deaths without depending on the
      // batch-loop sequencing being identical to my reading of
      // `processCreatureDamageBatch`.
      if (ctx.card.counters?._explodingSkullSuppressed) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Standard once-per-turn HOPT — covers the SEQUENTIAL-death
      // case (Skull dies on turn N, then another Skull dies later in
      // the same turn from a different damage source). The suppress
      // flag above doesn't cover that case because the second Skull
      // wasn't alive-and-flagged when the first fired.
      if (!engine.claimHOPT('exploding-skull', pi)) return;

      // Mark every OTHER face-up Exploding Skull on this side as
      // suppressed so simultaneous deaths in this same turn (any
      // batch path that processes multiple Skulls) bail at the
      // per-inst check above. Walks `cardInstances` once, marks each
      // sibling's counters synchronously — no awaits between this
      // loop and the death-cascade for-loop in
      // `processCreatureDamageBatch`, so the marks land before any
      // subsequent batch-entry's HP is applied.
      for (const inst of engine.cardInstances) {
        if (inst.id === ctx.card.id) continue;
        if (inst.name !== CARD_NAME) continue;
        if (inst.zone !== 'support' || inst.faceDown) continue;
        if ((inst.controller ?? inst.owner) !== pi) continue;
        if (!inst.counters) inst.counters = {};
        inst.counters._explodingSkullSuppressed = true;
      }

      const gs = engine.gs;
      const oi = pi === 0 ? 1 : 0;

      // Build the opp target list — every living Hero + every face-
      // up Creature in a support zone on opp's side. `getCreatureTargets`
      // already filters out Equipment / Tokens / etc.
      const oppHeroes = engine.getHeroTargets(oi);
      const oppCreatures = engine.getCreatureTargets(oi);
      const targets = [...oppHeroes, ...oppCreatures];
      if (targets.length === 0) return;

      // Fire explosion animations on every target IN PARALLEL — same
      // shape Book of Doom uses for its multi-target burst. The brief
      // post-broadcast delay lets the explosion flash render before
      // the damage numbers fly out.
      for (const t of targets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'explosion',
          owner: t.owner,
          heroIdx: t.heroIdx,
          zoneSlot: t.type === 'equip' ? t.slotIdx : -1,
        });
      }
      await engine._delay(400);

      const source = {
        name: CARD_NAME,
        owner: pi,
        heroIdx: death.heroIdx,
        cardInstance: ctx.card,
      };

      // Heroes one at a time, Creatures batched — same pattern as
      // Book of Doom. Batching the Creatures means every
      // beforeCreatureDamageBatch listener (Diamond, Great Wall,
      // Sculpture Guards, …) sees the full sweep at once and can
      // make a single coherent decision over the whole batch.
      const creatureBatch = [];
      for (const t of targets) {
        if (t.type === 'hero') {
          const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (hero && hero.hp > 0) {
            await engine.actionDealDamage(source, hero, DAMAGE, 'creature');
          }
        } else if (t.type === 'equip') {
          const inst = t.cardInstance || engine.cardInstances.find(c =>
            c.owner === t.owner && c.zone === 'support'
            && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx,
          );
          if (inst) {
            creatureBatch.push({
              inst,
              amount: DAMAGE,
              type: 'creature',
              source,
              sourceOwner: pi,
              canBeNegated: true,
              isStatusDamage: false,
              animType: null,
            });
          }
        }
      }

      if (creatureBatch.length > 0) {
        await engine.processCreatureDamageBatch(creatureBatch);
      }

      engine.log('exploding_skull_blast', {
        player: gs.players[pi]?.username,
        damage: DAMAGE,
        targets: targets.length,
      });

      engine.sync();
    },
  },
};
