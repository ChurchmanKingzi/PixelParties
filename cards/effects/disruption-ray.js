// ═══════════════════════════════════════════
//  CARD EFFECT: "Disruption Ray"
//  Spell (Decay Magic Lv1, Normal)
//
//  Choose a target. All damage that target
//  receives until the end of YOUR next turn is
//  doubled.
//
//  IMPLEMENTATION:
//   • Applies the generic `disrupted` buff
//     (BUFF_EFFECTS in _hooks.js, damageMultiplier
//     2). The engine's standard buff-multiplier
//     pass doubles every hit on both hero and
//     creature targets. True damage
//     (actionDealTrueDamage) bypasses it, same
//     engine-wide convention as Cloudy / Damage
//     Immune.
//   • Duration: "until the end of your next turn".
//     Buff expiry runs at TURN-START only
//     (_processBuffExpiry). With turns alternating
//     and gs.turn incrementing per player-turn:
//       cast=T → opp T+1 → caster's next turn T+2
//       → opp T+3.
//     The buff must stay live through ALL of the
//     caster's next turn (T+2) — the obvious use
//     is doubling your own follow-up damage — and
//     be gone by T+3. So it expires at the start
//     of T+3 (the first turn-start AFTER the end
//     of the caster's next turn): expiresAtTurn =
//     gs.turn + 3, expiresForPlayer = opponent
//     (the active player at T+3).
//
//     NOTE: this intentionally diverges from the
//     older Smoke Vial / cloud-pillow "+2 /
//     caster" pattern. That pattern expires at the
//     START of the caster's next turn, which is
//     fine only for effects whose window is the
//     opponent's turn (Blinded). A double-damage
//     effect must survive into the caster's own
//     next turn, so the literal "end of your next
//     turn" reading (+3 / opponent) is required.
//     (Smoke Vial was corrected to this same
//     convention.)
//
//  ANIMATION: a semi-transparent sickly-green
//  energy beam from the casting Hero to the
//  target (play_beam_animation with a green
//  `color` + `glow`), and a green `disruption_
//  impact` burst on the target (forwarded via the
//  beam's `impactAnim`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Disruption Ray';

module.exports = {
  // Tagged for Blinded gating — a Blinded caster can't pick a target.
  requiresTarget: true,

  // Permissive: there is essentially always a Hero on the board to
  // target, but stay defensive so the Spell isn't offered with literally
  // nothing to point at.
  spellPlayCondition(gs) {
    for (const ps of gs.players || []) {
      if ((ps?.heroes || []).some(h => h?.name && h.hp > 0)) return true;
      for (const hz of (ps?.supportZones || [])) {
        for (const slot of (hz || [])) {
          if ((slot || []).length > 0) return true;
        }
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const heroIdx = ctx.cardHeroIdx;

      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        min: 1,
        title: CARD_NAME,
        description: 'Choose a target. All damage it receives until the end of your next turn is doubled.',
        confirmLabel: '☢️ Disrupt!',
        confirmClass: 'btn-danger',
        cancellable: true,
        appliesStatus: true,
      });

      if (!selected || selected.length === 0) return; // Cancelled / negated
      const target = selected[0];

      // ── Sickly-green energy beam, caster Hero → target, with a green
      //    impact burst on the target (impactAnim overrides the beam's
      //    default explosion). ──
      const targetZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_beam_animation', {
        sourceOwner: ctx.cardHeroOwner,
        sourceHeroIdx: heroIdx,
        targetOwner: target.owner,
        targetHeroIdx: target.heroIdx,
        targetZoneSlot,
        color: 'rgba(150, 214, 60, 0.72)',
        glow: 'rgba(126, 196, 40, 0.85)',
        impactAnim: 'disruption_impact',
        duration: 1200,
      });
      await engine._delay(440);

      // "Until the end of your next turn" — see header. Expire at the
      // start of the opponent's turn that follows the caster's next turn.
      const expiresAtTurn = gs.turn + 3;
      const expiresForPlayer = oppIdx;

      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (!hero?.name || hero.hp <= 0) return;
        await engine.actionAddBuff(hero, target.owner, target.heroIdx, 'disrupted', {
          expiresAtTurn,
          expiresForPlayer,
          source: CARD_NAME,
        });
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (!inst) return;
        await engine.actionAddCreatureBuff(inst, 'disrupted', {
          expiresAtTurn,
          expiresForPlayer,
          source: CARD_NAME,
        });
      }

      engine.log('disruption_ray', {
        player: gs.players[pi]?.username,
        target: target.cardName,
        targetType: target.type,
        expiresAtTurn,
      });
      engine.sync();
    },
  },
};
