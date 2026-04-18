// ═══════════════════════════════════════════
//  CARD EFFECT: "Arthor, Inheritor of the Barbarian Sword"
//  Ascended Hero — 550 HP, 80 ATK — BANNED
//  Starting abilities: Fighting 3, Summoning Magic 3
//
//  Ascension condition (base Arthor + both equips):
//  "Legendary Sword of a Barbarian King" AND
//  "Summoning Circle" must be equipped.
//  Not cheat-ascendable.
//
//  Hero Effect (once per turn, Main Phase):
//  Deal 400 damage to any target.
//  This is treated as an Attack — triggers
//  afterSpellResolved with Attack card data so
//  Legendary Sword's summon grant, Vampiric Sword
//  heals, and other Attack-reactive effects work.
// ═══════════════════════════════════════════

const CARD_NAME = 'Arthor, Inheritor of the Barbarian Sword';
const DAMAGE    = 400;

// Minimal fake card data for afterSpellResolved
const FAKE_ATTACK_DATA = {
  name: CARD_NAME,
  cardType: 'Attack',
  subtype: 'Normal',
  level: 0,
};

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Fighting', 'Summoning Magic']);
  },

  canActivateHeroEffect(ctx) {
    return true; // HOPT handled by engine; hero must be alive (engine checks)
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    const hero    = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    // Set up damage log (needed for afterSpellResolved target tracking)
    gs._spellDamageLog = [];

    // Prompt for any target
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'attack',
      baseDamage: DAMAGE,
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to any target. (Treated as an Attack)`,
      confirmLabel: `⚔️ ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) {
      delete gs._spellDamageLog;
      return false;
    }

    const tgtOwner   = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('red_lightning_rain', {
      owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
    });
    await engine._delay(500);

    // Deal damage
    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, DAMAGE, 'attack');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, DAMAGE, 'attack',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    // Collect unique targets
    const uniqueTargets = [];
    const seenIds = new Set();
    for (const t of (gs._spellDamageLog || [])) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
    }
    delete gs._spellDamageLog;

    // Fire afterSpellResolved as an Attack so reactive equips trigger
    await engine.runHooks('afterSpellResolved', {
      spellName: CARD_NAME,
      spellCardData: FAKE_ATTACK_DATA,
      heroIdx,
      casterIdx: pi,
      damageTargets: uniqueTargets,
      isSecondCast: false,
      _skipReactionCheck: true,
    });

    engine.log('arthor_ascended_strike', {
      player: ps.username, target: target.cardName, damage: DAMAGE,
    });
    engine.sync();
    return true;
  },
};
