// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian's Appearance"
//  Spell (Magic Arts Lv1, Normal)
//  Archetype: Guardian Beasts.
//
//  Choose a "Guardian Beast" Creature from your
//  hand and place it into a free Support Zone of
//  any Hero you control, IGNORING its summoning
//  restrictions (no empty-discard-pile gate, no
//  level requirement, no per-turn additional-
//  action interaction with the GB first-summon
//  flag — placement IS the action grant). If you
//  do, send the top 3 cards of either player's
//  deck (caster's choice) to their discard pile.
// ═══════════════════════════════════════════

const {
  isGuardianBeastCreature,
} = require('./_guardian-beasts-shared');

const CARD_NAME = "Guardian's Appearance";

module.exports = {
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least one Guardian Beast Creature in hand AND a free
    // Support slot on at least one alive Hero.
    const hasGBInHand = (ps.hand || []).some(isGuardianBeastCreature);
    if (!hasGBInHand) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      const zones = ps.supportZones?.[hi] || [[], [], []];
      for (let z = 0; z < 3; z++) {
        if ((zones[z] || []).length === 0) return true;
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Step 1: gallery of Guardian Beast Creatures in hand. We dedupe
      // by name and surface the count so the player can see they have
      // multiples of one type.
      const counts = {};
      for (const cn of (ps.hand || [])) {
        if (!isGuardianBeastCreature(cn)) continue;
        counts[cn] = (counts[cn] || 0) + 1;
      }
      const gallery = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'hand', count }));
      if (gallery.length === 0) return;

      const pickHand = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose a Guardian Beast Creature in your hand to place onto any of your Heroes (ignores summoning restrictions).',
        cancellable: false,
      });
      if (!pickHand?.cardName) return;
      const beastName = pickHand.cardName;

      // Step 2: pick a free zone on one of the caster's alive heroes.
      const zones = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        const sz = ps.supportZones?.[hi] || [[], [], []];
        for (let z = 0; z < 3; z++) {
          if ((sz[z] || []).length === 0) {
            zones.push({
              heroIdx: hi, slotIdx: z,
              label: `${h.name} — Slot ${z + 1}`,
            });
          }
        }
      }
      if (zones.length === 0) return;
      const promptCtx = engine._createContext(ctx.card, {});
      const slotPick = await promptCtx.promptZonePick(zones, {
        title: CARD_NAME,
        description: `Place ${beastName} into which zone?`,
        cancellable: false,
      });
      if (!slotPick) return;

      // Step 3: remove from hand & place. Use isPlacement+skipBeforeSummon
      // so the empty-discard summon gate is bypassed (matches "ignoring
      // its summoning restrictions"). Hooks fire so the placed Beast's
      // own onPlay (per-turn flag stamp) and any board reactions land.
      const handIdx = ps.hand.indexOf(beastName);
      if (handIdx < 0) return;
      ps.hand.splice(handIdx, 1);

      engine._broadcastEvent('play_zone_animation', {
        type: 'summoning_glow',
        owner: pi, heroIdx: slotPick.heroIdx, zoneSlot: slotPick.slotIdx,
      });
      await engine._delay(250);

      const placeRes = await engine.summonCreatureWithHooks(
        beastName, pi, slotPick.heroIdx, slotPick.slotIdx,
        {
          source: CARD_NAME,
          isPlacement: true,
          skipBeforeSummon: true,
          hookExtras: {
            _summonedBy: CARD_NAME,
            _summonedFromHand: true,
            _bypassGuardianBeastsGate: true,
          },
        },
      );
      if (!placeRes) {
        // Fizzle — push the beast back to hand to avoid a permanent
        // loss on a placement we couldn't do.
        ps.hand.push(beastName);
        engine.log('guardians_appearance_fizzle', { player: ps.username, beast: beastName });
        return;
      }

      // Step 4: optional mill — 3 from a chosen deck. The opponent's
      // deck is also a valid target; "either player's deck" per text.
      const oi = pi === 0 ? 1 : 0;
      const millOpts = [];
      if ((ps.mainDeck?.length || 0) > 0) millOpts.push({ id: 'self', label: 'Mill top 3 of YOUR deck' });
      if ((gs.players[oi]?.mainDeck?.length || 0) > 0) millOpts.push({ id: 'opp', label: "Mill top 3 of OPPONENT'S deck" });
      if (millOpts.length === 0) {
        engine.sync();
        return;
      }
      millOpts.push({ id: 'skip', label: 'Skip the mill' });
      const millChoice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Send the top 3 cards of either deck to its discard pile.',
        options: millOpts,
        cancellable: false,
      });
      if (millChoice?.optionId === 'self') {
        await engine.actionMillCards(pi, 3, { source: CARD_NAME, selfInflicted: true });
      } else if (millChoice?.optionId === 'opp') {
        await engine.actionMillCards(oi, 3, { source: CARD_NAME });
      }

      engine.log('guardians_appearance', {
        player: ps.username, beast: beastName, mill: millChoice?.optionId || 'skip',
      });
      engine.sync();
    },
  },
};
