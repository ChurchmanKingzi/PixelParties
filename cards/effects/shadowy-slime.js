// ═══════════════════════════════════════════
//  CARD EFFECT: "Shadowy Slime"
//  Creature — On summon, you may place a
//  lv 0 Creature from your DISCARD pile into
//  a free Support Zone of the SAME Hero.
//  If you do, you cannot summon any more
//  Creatures for the rest of the turn.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.players;
      const pi = ctx.cardOwner;
      const ps = gs[pi];
      const heroIdx = ctx.cardHeroIdx;

      // Check HOPT manually — only mark used AFTER successful summon
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      const hoptKey = `shadowy-slime-summon:${pi}`;
      if (engine.gs.hoptUsed[hoptKey] === engine.gs.turn) return;

      // Check summon lock
      if (ctx.isSummonLocked()) return;

      // Load card database
      const allCards = require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8');
      const cardDB = {};
      JSON.parse(allCards).forEach(c => { cardDB[c.name] = c; });

      // Find lv 0 Creatures in discard pile
      const eligibleCards = [];
      const seen = new Set();
      for (const name of (ps.discardPile || [])) {
        if (seen.has(name)) continue;
        const c = cardDB[name];
        if (c && hasCardType(c, 'Creature') && (c.level || 0) === 0) {
          seen.add(name);
          eligibleCards.push({ name, source: 'discard' });
        }
      }

      // Fizzle if no eligible creatures in discard
      if (eligibleCards.length === 0) return;

      // Find free support zones on the SAME hero only
      const getFreeZones = () => {
        const zones = [];
        const hero = ps.heroes[heroIdx];
        if (!hero?.name || hero.hp <= 0) return zones;
        const supZones = ps.supportZones[heroIdx] || [];
        for (let s = 0; s < 3; s++) { // Base zones only
          if ((supZones[s] || []).length === 0) {
            zones.push({ heroIdx, slotIdx: s, label: `${hero.name} — Support ${s + 1}` });
          }
        }
        return zones;
      };

      // Fizzle if no free zones on this hero
      if (getFreeZones().length === 0) return;

      // Step 1: Confirm
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Shadowy Slime',
        message: 'Summon a Lv 0 Creature from your discard pile? (You won\'t be able to summon any more Creatures this turn!)',
      });
      if (!confirmed) return;

      // Step 2 + 3: Pick creature → pick zone (with back navigation)
      while (true) {
        // Recompute eligible cards
        const currentEligible = [];
        const currentSeen = new Set();
        for (const name of (ps.discardPile || [])) {
          if (currentSeen.has(name)) continue;
          const c = cardDB[name];
          if (c && hasCardType(c, 'Creature') && (c.level || 0) === 0) {
            currentSeen.add(name);
            currentEligible.push({ name, source: 'discard' });
          }
        }
        if (currentEligible.length === 0) return;

        const selected = await ctx.promptCardGallery(currentEligible, {
          title: 'Shadowy Slime',
          description: 'Select a Lv 0 Creature from your discard pile.',
          cancellable: true,
        });
        if (!selected) return; // Escape = abort

        // Step 3: Pick a zone (same hero only)
        const freeZones = getFreeZones();
        if (freeZones.length === 0) return;

        const zone = await ctx.promptZonePick(freeZones, {
          title: 'Shadowy Slime',
          description: `Place ${selected.cardName} into a Support Zone.`,
          cancellable: true,
        });
        if (!zone) continue; // Escape = back to creature picker

        // Execute placement — remove from discard pile
        const cardName = selected.cardName;
        const idx = ps.discardPile.indexOf(cardName);
        if (idx < 0) return;
        ps.discardPile.splice(idx, 1);

        // Place into support zone
        const si = zone.slotIdx;
        if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
        ps.supportZones[heroIdx][si] = [cardName];

        // Track card instance with placement flag
        const inst = engine._trackCard(cardName, pi, 'support', heroIdx, si);
        inst.counters.isPlacement = 1;

        engine.log('placement', { card: cardName, by: 'Shadowy Slime', from: 'discard', heroIdx, zoneSlot: si });

        // Mark HOPT as used — successful placement
        engine.gs.hoptUsed[hoptKey] = engine.gs.turn;

        // APPLY SUMMON LOCK — no more creatures this turn
        ctx.lockSummons();
        engine.log('summon_lock', { player: ps.username, by: 'Shadowy Slime' });

        // Emit summon effect glow + shadow animation
        engine._broadcastEvent('summon_effect', { owner: pi, heroIdx, zoneSlot: si, cardName });
        engine._broadcastEvent('play_zone_animation', { type: 'shadow_summon', owner: pi, heroIdx, zoneSlot: si });

        // Fire on-summon hooks
        await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: si });
        await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });

        engine.sync();
        break;
      }
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
