// ═══════════════════════════════════════════
//  CARD EFFECT: "Slime Rancher"
//  Creature — Passive (while in own Support Zone):
//
//  When ANOTHER "Slime" Creature on the same side
//  is summoned (i.e. fires its onPlay as it enters
//  the support zone), re-run that Creature's
//  onPlay one additional time.
//
//  Excluded from doubling:
//    • Slime Rancher itself (self-exclude — also
//      has no meaningful onPlay to double).
//    • Cloudy Slime, Shadowy Slime — these carry
//      their own per-turn HOPT on the EFFECT. The
//      restriction is on the effect itself, not on
//      the Creature firing it, so Rancher must NOT
//      grant a second activation around the gate.
//
//  Wiring: hooks onCardEnterZone (fires AFTER the
//  original onPlay) and re-invokes `runHooks('onPlay')`
//  on the same instance. Each Rancher in play fires
//  its own re-trigger — multiple Ranchers stack
//  (3 fires with 2 Ranchers, etc.), matching the
//  per-Creature reading of "While you control this
//  Creature".
//
//  Filtered out: pure moves (engine flags those
//  with `_isMove: true`), entries into non-support
//  zones, and the Rancher's own entry event.
// ═══════════════════════════════════════════

const SLIMES_NOT_DOUBLED = new Set([
  'Slime Rancher',
  'Cloudy Slime',
  'Shadowy Slime',
]);

module.exports = {
  activeIn: ['support'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'support') return;
      if (ctx._isMove) return;

      const entering = ctx.enteringCard;
      if (!entering) return;
      if (entering.owner !== ctx.cardOwner) return;
      if (entering.id === ctx.card.id) return;
      if (SLIMES_NOT_DOUBLED.has(entering.name)) return;

      const engine = ctx._engine;
      const cardData = engine._getCardDB()[entering.name];
      if (!cardData || cardData.archetype !== 'Slimes') return;

      // Re-fire the entering Slime's onPlay one additional time.
      // `_onlyCard` scopes the dispatch to just this instance, so we
      // don't accidentally re-trigger other listeners. Cloudy / Shadowy
      // are pre-filtered above so the effect-level HOPT they enforce
      // internally is never bypassed.
      await engine.runHooks('onPlay', {
        _onlyCard: entering,
        playedCard: entering,
        cardName: entering.name,
        zone: 'support',
        heroIdx: entering.heroIdx,
        zoneSlot: entering.zoneSlot,
        _skipReactionCheck: true,
        _slimeRancherDouble: true,
      });
    },
  },
};
