// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Ankylos"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 400
//
//  ① UNIQUENESS — shared archetype rule: only 1
//    Gigantisaur Creature per Hero's Support
//    Zones at a time (via `gigantisaursCanSummon`).
//
//  ② ACTIVE — Once per turn, discard 1 card to
//    choose a target your opponent controls and
//    Stun it for 1 turn.
// ═══════════════════════════════════════════

const { gigantisaursCanSummon } = require('./_gigantisaurs-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Gigantisaur Ankylos';

module.exports = {
  activeIn: ['support'],
  canSummon: gigantisaursCanSummon,

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if ((ps.hand?.length || 0) < 1) return false;
    // Must have at least one opp-controlled target (Hero or Creature).
    const oi = ctx.cardOwner === 0 ? 1 : 0;
    const ops = engine.gs.players[oi];
    if (!ops) return false;
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const h = ops.heroes[hi];
      if (h?.name && h.hp > 0) return true;
    }
    const cardDB = engine._getCardDB();
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if ((inst.controller ?? inst.owner) !== oi) continue;
      if (inst.faceDown) continue;
      const cd = cardDB[inst.name];
      if (cd && hasCardType(cd, 'Creature')) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // Pay the discard cost FIRST — same pattern as Triceras: keeps a
    // freshly-drawn / freshly-revealed card from being chosen as the
    // pitched card later in the same activation flow.
    const handBefore = ps.hand.length;
    await engine.actionPromptForceDiscard(pi, 1, {
      title: CARD_NAME,
      source: CARD_NAME,
      selfInflicted: true,
    });
    if (ps.hand.length >= handBefore) {
      engine.log('ankylos_fizzle', { player: ps.username });
      engine.sync();
      return false;
    }

    // Build opp-controlled target list (Heroes + face-up Creatures).
    const oi = pi === 0 ? 1 : 0;
    const target = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      title: CARD_NAME,
      description: `Choose a target ${engine.gs.players[oi]?.username || 'your opponent'} controls to Stun for 1 turn.`,
      confirmLabel: '⚡ Stun!',
      confirmClass: 'btn-warning',
      cancellable: false,
    });
    if (!target) {
      engine.log('ankylos_fizzle', { player: ps.username, reason: 'no_target' });
      engine.sync();
      return false;
    }

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    // Giant bone-spiked tail swings down on the target — see the
    // `ankylo_tail_smash` animation in app-board.jsx for the visual.
    // Impact lands ~440ms in (tail arcs down from upper-right, then
    // slams), so wait through the impact frame before stamping the
    // Stun so the status visual lines up with the crunch.
    engine._broadcastEvent('play_zone_animation', {
      type: 'ankylo_tail_smash', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(520);

    if (target.type === 'hero') {
      await engine.addHeroStatus(target.owner, target.heroIdx, 'stunned', {
        duration: 1, appliedBy: pi,
      });
    } else if (target.cardInstance) {
      const inst = target.cardInstance;
      const applied = await engine.applyCreatureStatus(inst, 'stunned', {
        sourceOwner: pi,
        duration: 1,
        source: 'Gigantisaur Ankylos',
      });
      if (applied) engine.log('status_add', { target: inst.name, status: 'stunned', owner: target.owner });
    }

    engine.log('ankylos_stun', {
      player: ps.username, target: target.cardName,
    });
    engine.sync();
    return true;
  },
};
