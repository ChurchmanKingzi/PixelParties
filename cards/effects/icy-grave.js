// ═══════════════════════════════════════════
//  CARD EFFECT: "Icy Grave"
//  Spell (Decay Magic Lv 2) — Normal.
//
//  "Freeze the target for 2 turns."
//
//  Same single-target picker shape as Icebolt but
//  with the damage stripped and the freeze
//  duration locked to 2 of the target's own turns
//  (mirrors Frost Rune's freeze rider). The Spell
//  is tagged `damageType: 'status'` with no
//  `baseDamage` so:
//    • Great Wall of Deri correctly excludes opp
//      Creatures from the picker (status pickers
//      are non-damage by the engine's gating).
//    • damage-mitigation post-target reactions
//      (Spectral Armor, Bamboo Shield, Sculpture
//      Guards, …) do NOT fire — there's no damage
//      to mitigate.
//
//  Anti Magic + Resistance are honoured by the
//  engine's standard freeze-application paths:
//    • Heroes: `engine.addHeroStatus` runs the
//      Anti Magic gate (`_isHeroSpellProtected`)
//      and the `onStatusApplied` chain (which is
//      where Resistance's listener absorbs the
//      freeze).
//    • Creatures: `engine.applyCreatureStatus`
//      runs the freeze-immunity gate (Cardinal
//      Beast, `freeze_immune`, etc.).
//
//  Animation: `icy_grave_strike` — a dramatic
//  icicle plummeting from above with four
//  ground-rising frost columns, cyan impact flash,
//  shockwave, ice-shard burst and snowflake
//  scatter (1700 ms lifespan; broadcast passes
//  matching `duration`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Icy Grave';
const FREEZE_DURATION = 2;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Pick any target on either side. `damageType: 'status'` + no
      // `baseDamage` tags this as a non-damage targeting effect;
      // the engine's pickers apply the Wall-of-Deri exclusion to opp
      // Creatures and damage-mitigation post-target reactions stay
      // silent.
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'status',
        title: CARD_NAME,
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): diese Karte
        // traegt Schaden UND Status. Das Ziel-Gate filtert deshalb NICHT —
        // `classifyTargetTags` stempelt stattdessen `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie stark
        // das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'frozen',
        description: `Choose any target — Freeze it for ${FREEZE_DURATION} turns.`,
        confirmLabel: '❄ Freeze!',
        confirmClass: 'btn-info',
        cancellable: true,
      });

      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      // ── Strike animation ──
      // Anchored to the target's slot. `duration: 1700` keeps the
      // component mounted through the full lifespan (default is
      // 1000 ms — would unmount mid-effect).
      engine._broadcastEvent('play_zone_animation', {
        type: 'icy_grave_strike',
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
        duration: 1700,
      });
      // Sync the freeze application with the impact beat (~880 ms
      // into the animation, just as the shard touches down and the
      // frost spikes erupt).
      await engine._delay(880);

      // ── Apply the freeze ──
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero?.name && hero.hp > 0) {
          // `engine.addHeroStatus` runs the Anti Magic gate +
          // ON_STATUS_APPLIED chain (Resistance's absorb path lives
          // there). Returns silently when blocked.
          await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
            appliedBy: pi,
            duration: FREEZE_DURATION,
            source: CARD_NAME,
            // No animationType — the strike animation above is the
            // visual; the engine's default `freeze` overlay would
            // stack on top of the much louder strike, washing it out.
            animationType: 'none',
          });
        }
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support'
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
        );
        if (inst && inst.zone === 'support') {
          // `engine.applyCreatureStatus` runs `canApplyCreatureStatus`
          // (freeze_immune / Cardinal Beast / etc.) and fires
          // ON_STATUS_APPLIED. Returns false when blocked.
          const applied = await engine.applyCreatureStatus(inst, 'frozen', {
            sourceOwner: pi,
            source: CARD_NAME,
            duration: FREEZE_DURATION,
            animationType: 'none',
          });
          if (applied) {
            engine.log('freeze', {
              target: inst.name, by: CARD_NAME, type: 'creature',
            });
          }
        }
      }

      engine.log('icy_grave', {
        player: gs.players[pi]?.username,
        target: target.cardName,
        duration: FREEZE_DURATION,
      });
      engine.sync();
    },
  },
};
