// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloudy Slime"
//  Creature — On summon, you may place a
//  lv 0 Creature from your hand into any
//  free Support Zone you control. HOPT, but
//  only consumed on successful placement.
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

      // Check HOPT manually — only mark used AFTER successful summon
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      const hoptKey = `cloudy-slime-summon:${pi}`;
      if (engine.gs.hoptUsed[hoptKey] === engine.gs.turn) return;

      // Check summon lock
      if (ctx.isSummonLocked()) return;

      // Load card database
      const allCards = require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8');
      const cardDB = {};
      JSON.parse(allCards).forEach(c => { cardDB[c.name] = c; });

      // Find lv 0 Creatures in hand (excluding the just-summoned Cloudy Slime itself)
      const eligibleCards = [];
      const seen = new Set();
      for (const name of (ps.hand || [])) {
        if (seen.has(name)) continue;
        const c = cardDB[name];
        if (c && hasCardType(c, 'Creature') && (c.level || 0) === 0) {
          seen.add(name);
          eligibleCards.push({ name, source: 'hand' });
        }
      }

      // Fizzle if no eligible creatures
      if (eligibleCards.length === 0) return;

      // Find ALL free support zones across all own heroes
      const getFreeZones = () => {
        const zones = [];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          const supZones = ps.supportZones[hi] || [];
          for (let s = 0; s < 3; s++) { // Base zones only
            if ((supZones[s] || []).length === 0) {
              zones.push({ heroIdx: hi, slotIdx: s, label: `${hero.name} — Support ${s + 1}` });
            }
          }
        }
        return zones;
      };

      // Fizzle if no free zones anywhere
      if (getFreeZones().length === 0) return;

      // Step 1: Confirm
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Cloudy Slime',
        message: 'Summon another Lv 0 Creature from your hand?',
      });
      if (!confirmed) return;

      // Step 2 + 3: Pick creature → pick zone (with back navigation)
      while (true) {
        // Recompute eligible cards (hand may have changed if multiple effects)
        const currentEligible = [];
        const currentSeen = new Set();
        for (const name of (ps.hand || [])) {
          if (currentSeen.has(name)) continue;
          const c = cardDB[name];
          if (c && hasCardType(c, 'Creature') && (c.level || 0) === 0) {
            currentSeen.add(name);
            currentEligible.push({ name, source: 'hand' });
          }
        }
        if (currentEligible.length === 0) return; // No more eligible

        const selected = await ctx.promptCardGallery(currentEligible, {
          title: 'Cloudy Slime',
          description: 'Select a Lv 0 Creature to place.',
          cancellable: true,
        });
        if (!selected) return; // Escape = abort

        // Step 3: Pick a zone
        const freeZones = getFreeZones();
        if (freeZones.length === 0) return;

        const zone = await ctx.promptZonePick(freeZones, {
          title: 'Cloudy Slime',
          description: `Place ${selected.cardName} into a Support Zone.`,
          cancellable: true,
        });
        if (!zone) continue; // Escape = back to creature picker

        // Execute placement
        const cardName = selected.cardName;
        const idx = ps.hand.indexOf(cardName);
        if (idx < 0) return; // Card no longer in hand
        ps.hand.splice(idx, 1);

        // Place into support zone
        const hi = zone.heroIdx;
        const si = zone.slotIdx;
        if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
        ps.supportZones[hi][si] = [cardName];

        // Track card instance with placement flag
        const inst = engine._trackCard(cardName, pi, 'support', hi, si);
        inst.counters.isPlacement = 1;

        engine.log('placement', { card: cardName, by: 'Cloudy Slime', from: 'hand', heroIdx: hi, zoneSlot: si });

        // Mark HOPT as used NOW — successful placement
        engine.gs.hoptUsed[hoptKey] = engine.gs.turn;

        // Emit summon effect glow + wind animation
        engine._broadcastEvent('summon_effect', { owner: pi, heroIdx: hi, zoneSlot: si, cardName });
        engine._broadcastEvent('play_zone_animation', { type: 'wind', owner: pi, heroIdx: hi, zoneSlot: si });

        // Fire on-summon hooks
        await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx: hi, zoneSlot: si });
        await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: hi });

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
