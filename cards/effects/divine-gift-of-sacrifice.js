// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Sacrifice"
//  Spell (Normal, Decay Magic Lv1)
//
//  Once per game (shared "Divine Gift" key).
//  Sacrifice a Hero you originally control to
//  increase another Hero's current and max HP
//  by the sacrificed Hero's max HP.
//
//  Sorcery speed: can only be played on the
//  user's own turn as an inherent additional
//  Action. No reaction / chain behavior.
//
//  Animation: snake devour on sacrifice, golden
//  sparkles on buffed hero.
// ═══════════════════════════════════════════

/**
 * Get heroes eligible for sacrifice: alive, originally owned by the player.
 */
function getSacrificeTargets(gs, pi) {
  const ps = gs.players[pi];
  const targets = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    // Must be originally owned (not temporarily controlled)
    if (hero._originalOwner !== undefined && hero._originalOwner !== pi) continue;
    targets.push({
      id: `hero-${pi}-${hi}`,
      type: 'hero', owner: pi, heroIdx: hi,
      cardName: hero.name,
    });
  }
  return targets;
}

/**
 * Core sacrifice logic: pick a hero to sacrifice, kill it, buff another.
 */
async function doSacrifice(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];

  const sacrificeTargets = getSacrificeTargets(gs, pi);
  if (sacrificeTargets.length < 2) return false; // Need 2+ to sacrifice one and buff another

  // Step 1: Pick hero to sacrifice
  const sacrificePick = await engine.promptEffectTarget(pi, sacrificeTargets, {
    title: 'Divine Gift of Sacrifice',
    description: 'Choose a Hero to sacrifice.',
    confirmLabel: '🐍 Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: false,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
    maxTotal: 1,
  });

  if (!sacrificePick || sacrificePick.length === 0) return false;
  const sacTarget = sacrificeTargets.find(t => t.id === sacrificePick[0]);
  if (!sacTarget) return false;

  const sacHero = ps.heroes[sacTarget.heroIdx];
  if (!sacHero?.name || sacHero.hp <= 0) return false;
  const sacMaxHp = sacHero.maxHp || sacHero.hp;

  // Step 2: Pick hero to receive the buff (exclude sacrificed hero)
  const buffTargets = sacrificeTargets.filter(t => t.id !== sacTarget.id);
  if (buffTargets.length === 0) return false;

  let buffTarget;
  if (buffTargets.length === 1) {
    buffTarget = buffTargets[0]; // Auto-select if only 1 option
  } else {
    const buffPick = await engine.promptEffectTarget(pi, buffTargets, {
      title: 'Divine Gift of Sacrifice',
      description: `Choose a Hero to receive +${sacMaxHp} max HP from ${sacHero.name}.`,
      confirmLabel: '✨ Empower!',
      confirmClass: 'btn-success',
      cancellable: false,
      greenSelect: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1 },
      maxTotal: 1,
    });

    if (!buffPick || buffPick.length === 0) return false;
    buffTarget = buffTargets.find(t => t.id === buffPick[0]);
    if (!buffTarget) return false;
  }

  const buffHero = ps.heroes[buffTarget.heroIdx];
  if (!buffHero?.name || buffHero.hp <= 0) return false;

  // Step 3: Snake devour animation on sacrificed hero
  engine._broadcastEvent('play_zone_animation', {
    type: 'snake_devour', owner: pi,
    heroIdx: sacTarget.heroIdx, zoneSlot: -1,
  });
  await engine._delay(700);

  // Step 4: Kill the sacrificed hero
  sacHero.hp = 0;
  sacHero.diedOnTurn = gs.turn;
  engine.log('hero_ko', { hero: sacHero.name, source: 'Divine Gift of Sacrifice' });
  await engine.runHooks('onHeroKO', { hero: sacHero, source: { name: 'Divine Gift of Sacrifice', owner: pi }, _bypassDeadHeroFilter: true });

  if (sacHero.hp <= 0 && !sacHero._koProcessed) {
    sacHero._koProcessed = true;
    await engine.handleHeroDeathCleanup(sacHero);
    await engine.checkAllHeroesDead();
  }

  // If game ended from all heroes dead, stop
  if (gs.result) return true;

  // Step 5: Golden sparkles on buffed hero
  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: pi,
    heroIdx: buffTarget.heroIdx, zoneSlot: -1,
  });
  await engine._delay(400);

  // Step 6: Increase current and max HP
  engine.increaseMaxHp(buffHero, sacMaxHp);

  engine.log('divine_gift_sacrifice', {
    player: ps.username,
    sacrificed: sacHero.name, sacMaxHp,
    buffed: buffHero.name, newMaxHp: buffHero.maxHp,
  });

  // Mark Divine Gift as used
  if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
  ps._oncePerGameUsed.add('divineGift');

  engine.sync();
  return true;
}

// ── CPU helper: hero "value" heuristic ─────────────────────────────
// Used to pick the LEAST valuable hero for sacrifice and the MOST
// valuable hero for the buff. Combines several "this hero is doing
// work" signals into a single score:
//
//   • Ability stack size — more abilities attached = more invested
//     (Wisdom, Toughness, Fighting, Friendship stacks on a carry).
//   • Spell-school strength — the hero's max school level scales
//     directly with which Spells/Attacks they can resolve. A hero
//     with Magic Arts Lv3 is the deck's spellcaster carry by
//     definition.
//   • Engine-ability bonus — Divinity / Wisdom / future engine
//     abilities (whatever declares `cpuMeta.engineValue`) compound
//     the carry signal.
//   • Equipped artifacts — each support zone occupancy is investment.
//   • Hero's own ATK — small modifier so beefy attackers register
//     above pure utility heroes when nothing else differentiates.
//
// Deliberately does NOT use current HP — the user's bug report had
// the carry sitting at 50 HP precisely BECAUSE it was the most
// active hero. Penalising "already-damaged" would re-cause the
// "sacrifice the useful one" picker bug.
const SPELL_SCHOOLS = [
  'Destruction Magic', 'Support Magic', 'Magic Arts',
  'Decay Magic', 'Summoning Magic',
];
function cpuHeroValue(engine, ownerIdx, heroIdx) {
  const ps = engine.gs.players[ownerIdx];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return -Infinity;
  let value = 0;
  const abZones = ps.abilityZones?.[heroIdx] || [];
  // 1. Ability stack size (15 per stack — same weight evaluateState uses).
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    value += slot.length * 15;
  }
  // 2. Max spell-school level — caster carry signal. Multiplied
  //    aggressively because a Lv3 caster is what wins the game.
  let maxSchool = 0;
  for (const school of SPELL_SCHOOLS) {
    let lvl = 0;
    try { lvl = engine.countAbilitiesForSchool(school, abZones); } catch {}
    if (lvl > maxSchool) maxSchool = lvl;
  }
  value += maxSchool * 30;
  // 3. Engine abilities (Divinity = 120, future engines TBD).
  //    Lazy-load to avoid pulling _loader at module top.
  let engineBonus = 0;
  try {
    const { loadCardEffect } = require('./_loader');
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const base = loadCardEffect(slot[0]);
      const ev = base?.cpuMeta?.engineValue || 0;
      if (ev > 0) engineBonus += ev * slot.length;
    }
  } catch {}
  value += engineBonus;
  // 4. Equipped artifacts (every support occupant = +10).
  const sup = ps.supportZones?.[heroIdx] || [];
  for (const slot of sup) {
    if ((slot || []).length > 0) value += 10;
  }
  // 5. Hero ATK as a tiebreaker.
  value += (hero.atk || 0) * 0.1;
  return value;
}

module.exports = {
  // Inherent additional Action — played during own Main Phase at Sorcery speed.
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  /**
   * CPU target picker — fires for both prompts (sacrifice pick + buff
   * pick) since both go through the engine's promptEffectTarget. The
   * description text disambiguates which prompt we're answering:
   *   • "Choose a Hero to sacrifice." → pick LEAST valuable.
   *   • "Choose a Hero to receive +N max HP …" → pick MOST valuable.
   *
   * Without this override, both prompts fall through to the generic
   * "shuffle own targets, ascended-first" picker — which doesn't
   * distinguish a 50-HP main caster from an idle utility hero, and
   * happily sacrifices the wrong one. Picking by `cpuHeroValue` (see
   * top of file) lifts the heuristic to "engine investment + spell
   * school + equipped artifacts" so the carry is recognised.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'target') return undefined;
    const targets = promptData?.validTargets || [];
    if (targets.length === 0) return undefined;
    const description = promptData?.config?.description || '';
    const isBuffPick = /receive\s+\+|to receive/i.test(description);
    // Score every valid hero target by carry-value heuristic.
    const scored = targets
      .filter(t => t.type === 'hero')
      .map(t => ({ id: t.id, score: cpuHeroValue(engine, t.owner, t.heroIdx) }));
    if (scored.length === 0) return undefined;
    if (isBuffPick) {
      // Buff: pick HIGHEST value. Ties broken by lower current HP
      // (already-damaged carry needs the cushion more).
      const gs = engine.gs;
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const heroA = gs.players?.[
          targets.find(t => t.id === a.id)?.owner
        ]?.heroes?.[targets.find(t => t.id === a.id)?.heroIdx];
        const heroB = gs.players?.[
          targets.find(t => t.id === b.id)?.owner
        ]?.heroes?.[targets.find(t => t.id === b.id)?.heroIdx];
        return (heroA?.hp || Infinity) - (heroB?.hp || Infinity);
      });
    } else {
      // Sacrifice: pick LOWEST value (least useful hero).
      scored.sort((a, b) => a.score - b.score);
    }
    return [scored[0].id];
  },

  // CPU hint: sacrificing an own hero in Main Phase 1 costs that hero's
  // Action Phase. The correct order is "use the about-to-be-sacrificed
  // caster first, THEN sacrifice in Main Phase 2". This flag tells the
  // CPU brain to defer the proactive play until Main Phase 2 so the
  // caster is still alive when the Action Phase opens. See
  // `fireAdditionalActions` in cards/effects/_cpu.js.
  cpuDelayToMainPhase2: true,

  /**
   * Play condition: need 2+ originally-owned alive heroes (one to sacrifice,
   * one to receive the buff).
   */
  spellPlayCondition(gs, pi) {
    return getSacrificeTargets(gs, pi).length >= 2;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      const success = await doSacrifice(engine, pi);
      if (!success) {
        gs._spellCancelled = true;
      }
    },
  },
};
