// ═══════════════════════════════════════════
//  CARD EFFECT: "Defending the Gate"
//  Spell (Surprise) — Reactive shield
//
//  When opponent effects would affect cards in
//  the user's Support Zones, negate all effects
//  on Support Zone cards for the rest of that
//  resolution.
//
//  Activation is handled by the engine:
//  _triggerGateCheck / _isGateShielded
// ═══════════════════════════════════════════

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'gate_shield' }, impactMs: 260 },

  activeIn: ['surprise'],
  isSurprise: true,
  isDefendingGate: true,

  // Cannot be activated by Telekinesis (engine-handled reactive shield)
  canTelekinesisActivate: false,

  // Activation: set the gate shield and play shield animations
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];

    // Set shield flag
    gs._gateShieldActive = pi;

    // Log
    const heroName = ps.heroes?.[ctx.cardHeroIdx]?.name || 'Hero';
    engine.log('gate_activated', { player: ps.username, hero: heroName, card: 'Defending the Gate' });

    // Shield animation on all occupied support zones
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        if (((ps.supportZones[hi] || [])[si] || []).length > 0) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'gate_shield', owner: pi, heroIdx: hi, zoneSlot: si,
          });
        }
      }
    }

    engine.sync();
    await engine._delay(500);
    return null;
  },
};
