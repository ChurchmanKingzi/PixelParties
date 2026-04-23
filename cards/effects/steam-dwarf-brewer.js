// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Brewer"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 50 HP.
//
//  ① STEAM ENGINE passive (shared): once per
//    turn, when you discard 1+ cards, gain +50
//    current & max HP.
//  ② Once per turn: choose another Creature you
//    control and set its current & max HP equal
//    to this Creature's max HP.
// ═══════════════════════════════════════════

const { attachSteamEngine, setCreatureHp } = require('./_steam-dwarf-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Steam Dwarf Brewer';

/**
 * Build the list of candidate brewing targets: other friendly
 * creatures in support zones, not this Brewer, not face-down, whose
 * controller is the Brewer's controller. Creatures persist after
 * their host hero dies, so dead-hero columns are NOT filtered out.
 */
function getBrewTargets(engine, pi, selfInstId) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const targets = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) continue;
      const cd = cardDB[slot[0]];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const inst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'support' &&
        c.heroIdx === hi && c.zoneSlot === si
      );
      if (!inst) continue;
      if (inst.id === selfInstId) continue;   // exclude self
      if (inst.faceDown) continue;
      targets.push({
        id: `equip-${pi}-${hi}-${si}`,
        type: 'equip',
        owner: pi, heroIdx: hi, slotIdx: si,
        cardName: slot[0],
        cardInstance: inst,
      });
    }
  }
  return targets;
}

module.exports = attachSteamEngine({
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    if (inst.counters?.negated || inst.counters?.nulled) return false;
    return getBrewTargets(engine, ctx.cardOwner, inst.id).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = ctx.cardOwner;

    const targets = getBrewTargets(engine, pi, inst.id);
    if (targets.length === 0) return false;

    // Broadcast brewing max HP as a hint in the prompt
    const cd = engine._getCardDB()[inst.name];
    const myMax = inst.counters?.maxHp ?? cd?.hp ?? 0;

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: `Set another Creature's current & max HP to ${myMax} (this Brewer's max HP).`,
      confirmLabel: `🍺 Brew! (→ ${myMax} HP)`,
      confirmClass: 'btn-info',
      cancellable: true,
      allowNonCreatureEquips: false,
      maxTotal: 1,
    });
    if (!picked || picked.length === 0) return false;

    const target = targets.find(t => t.id === picked[0]);
    if (!target) return false;

    // Steam puff on the Brewer, then on the target
    engine._broadcastEvent('play_zone_animation', {
      type: 'steam_puff',
      owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(250);
    engine._broadcastEvent('play_zone_animation', {
      type: 'steam_puff',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
    });
    await engine._delay(300);

    // Apply the HP change — both increase and decrease paths are
    // handled by the shared helper.
    const delta = setCreatureHp(engine, target.cardInstance, myMax);

    engine.log('steam_brewer_brew', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      newHp: myMax,
      delta,
    });
    engine.sync();
    return true;
  },
});
