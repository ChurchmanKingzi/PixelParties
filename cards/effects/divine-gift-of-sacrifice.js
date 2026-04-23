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

module.exports = {
  // Inherent additional Action — played during own Main Phase at Sorcery speed.
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

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
