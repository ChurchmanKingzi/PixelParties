// ═══════════════════════════════════════════
//  CREATURE: "The Nornstellar, Foretellers of
//  Coolness"
//
//  Whenever ANOTHER target you control is defeated,
//  push the top card of your deck onto your
//  Coolness Stack. Skipped when this Creature is
//  ALSO marked for death by the same damage source
//  (it can't trigger off a co-fatal hit).
//
//  When this Creature is itself defeated, you may
//  place a card from your hand on top of your
//  Coolness Stack. If you do, draw 2 cards.
//
//  Both branches no-op while the controller has no
//  Stack (Wowhalla absent).
// ═══════════════════════════════════════════

const CARD_NAME = 'The Nornstellar, Foretellers of Coolness';

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * Engine fires onCreatureDeath with `ctx.creature = { name, owner,
     * originalOwner, heroIdx, zoneSlot, instId }`. We branch on whether
     * this is Nornstellar's own death (instId match) or an ally death.
     */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // ── Self-death branch ──
      // Optionally place a hand card on top of the Stack to draw 2.
      // Mirrors a smaller Freshya. The listener still fires here
      // because at this point the inst is in the discard pile but is
      // still tracked (the engine untracks it AFTER onCreatureDeath
      // returns), and `activeIn` is satisfied because inst.zone has
      // not yet been flipped off `support` for the death path.
      if (death.instId === ctx.card?.id) {
        if (!engine.hasCoolnessStack(pi)) return;
        const ps = engine.gs.players[pi];
        if (!ps?.hand?.length) return;
        const handPick = await engine.promptGeneric(pi, {
          type: 'pickHandCard',
          title: CARD_NAME,
          description: 'You may place a card from your hand on top of your Coolness Stack to draw 2 cards.',
          confirmLabel: '🆒 Place + Draw 2',
          confirmClass: 'btn-info',
          cancelLabel: 'Skip',
          cancellable: true,
        });
        if (!handPick || handPick.cancelled || !handPick.cardName) return;
        const ok = await ctx.pushHandCardToCoolnessStack(pi, handPick.cardName, handPick.handIndex);
        if (!ok) return;
        await ctx.drawCards(pi, 2);
        return;
      }

      // ── Ally creature death branch ──
      // "A target you control" — the dying creature's CURRENT
      // controller must be us. The deathInfo `controller` field is
      // the engine's gameplay-truth side (originally-ours but cross-
      // side-placed onto opp's board doesn't count; opp's creatures
      // we currently control DO count). Falls back to `owner` for old
      // payloads that pre-date the controller field.
      if ((death.controller ?? death.owner) !== pi) return;

      // Same-source co-fatality gate: if Nornstellar itself is also
      // queued to die in the current batch (its currentHp has
      // already been zeroed by the same damage application pass),
      // skip the deck push. processCreatureDamageBatch applies all
      // damage first and THEN walks the deaths in order; by the time
      // the listener fires for an ally death, Nornstellar's HP
      // already reflects whether it's slated to die this batch.
      if ((ctx.card?.counters?.currentHp ?? 1) <= 0) return;
      if (!engine.hasCoolnessStack(pi)) return;
      await ctx.pushDeckTopToCoolnessStack(pi, { source: CARD_NAME, requireStack: true });
    },

    /**
     * Hero KO — heroes you control are also "another target you
     * control". Engine fires `onHeroKO` with `ctx.hero` set to the
     * hero object directly; we have to look up the owner by array
     * identity.
     */
    onHeroKO: async (ctx) => {
      const dyingHero = ctx.hero;
      if (!dyingHero?.name) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      let deadOwner = -1;
      for (let p = 0; p < 2; p++) {
        const heroes = engine.gs.players[p]?.heroes || [];
        if (heroes.includes(dyingHero)) { deadOwner = p; break; }
      }
      if (deadOwner !== pi) return;

      // Same co-fatality gate as the creature branch.
      if ((ctx.card?.counters?.currentHp ?? 1) <= 0) return;
      if (!engine.hasCoolnessStack(pi)) return;
      await ctx.pushDeckTopToCoolnessStack(pi, { source: CARD_NAME, requireStack: true });
    },
  },
};
