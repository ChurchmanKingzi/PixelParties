// ═══════════════════════════════════════════
//  CARD EFFECT: "Instant Cryo Stasis"
//  Spell (Decay Magic Lv1, Normal)
//
//  „Choose a Creature your opponent controls and Freeze it for the rest of the game. If the user has at
//   least Decay Magic 2, this counts as an additional Action."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Ziel: eine Creature der GEGNERSEITE, die noch nicht Frozen ist (ein zweites Einfrieren waere wirkungslos);
//    gibt es keine, ist der Zauber in der Hand ausgegraut (`spellPlayCondition`). Abbruch der Zielwahl gibt die
//    Karte zurueck.
//  • „For the rest of the game" = Freeze ohne Ablauf (Dauer 9999, tickt nie ab). Anders als Cold Coffin steht hier
//    NICHT „kann nicht aufgetaut werden": Heilung/Entfroster (Thaw Blader, Waitress …) wirken weiterhin.
//  • „Counts as an additional Action", wenn der WIRKER (user) mindestens Decay Magic 2 hat: `inherentAction`
//    prueft die Stufe seiner Ability-Zone (`countAbilitiesForSchool`).
//  • Status geht ueber `applyCreatureStatus` (Immunitaeten, `onStatusApplied`); Bild und Klang wie Cold Coffin
//    (`cold_coffin_encase`), auch bei Negierung (`spellVisual`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Instant Cryo Stasis';

function freezbareCreatures(engine, pi) {
  const oi = pi === 0 ? 1 : 0;
  return engine.getCreatureTargets(oi).filter(t => t.cardInstance && !t.cardInstance.counters?.frozen);
}

module.exports = {
  spellVisual: { impact: { type: 'cold_coffin_encase' }, impactMs: 260 },
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  /** „At least Decay Magic 2" beim Wirker → zusaetzliche Aktion. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    const zonen = gs.players[pi]?.abilityZones?.[heroIdx] || [];
    return engine.countAbilitiesForSchool('Decay Magic', zonen) >= 2;
  },

  /** Grau, solange keine einfrierbare gegnerische Creature steht. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return freezbareCreatures(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const kandidaten = freezbareCreatures(engine, pi);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }

      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['creature'],
        damageType: 'status',
        dealsDamage: false,
        title: CARD_NAME,
        appliesStatus: 'frozen',
        description: 'Choose a Creature your opponent controls. It is Frozen for the rest of the game.',
        confirmLabel: '❄️ Freeze!',
        confirmClass: 'btn-info',
        cancellable: true,
        condition: (t) => !!t.cardInstance && !t.cardInstance.counters?.frozen,
      });
      if (!target) { gs._spellCancelled = true; return; }

      engine._broadcastEvent('play_zone_animation', {
        type: 'cold_coffin_encase', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
      });
      await engine._delay(900);

      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
      if (inst && inst.zone === 'support') {
        const ok = await engine.applyCreatureStatus(inst, 'frozen', {
          duration: 9999, sourceOwner: pi, source: CARD_NAME,   // Bild kommt von cold_coffin_encase (oben)
        });
        if (ok) engine.log('freeze_applied', { target: inst.name, by: CARD_NAME, permanent: true });
      }
      engine.log('instant_cryo_stasis', { player: gs.players[pi]?.username, target: target.cardName });
      engine.sync();
    },
  },
};
