// ═══════════════════════════════════════════
//  CARD EFFECT: "Martyry"
//  Spell (Support Magic Lv1, Reaction)
//
//  Exact same effect as Challenge but as a
//  Support Magic Spell. Activates via the
//  target redirect system when a target the
//  player controls is chosen by an Attack,
//  Spell, or Creature effect.
//
//  Animation: Martyry user rams into the
//  original target to protect it with its body.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

function heroCanUseMartyry(ps, heroIdx) {
  const hero = ps.heroes[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return false;

  // Spell school check: needs Support Magic Lv1
  const abZones = ps.abilityZones[heroIdx] || [];
  let smCount = 0;
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const baseAbility = slot[0];
    for (const abName of slot) {
      if (abName === 'Support Magic') smCount++;
      else if (abName === 'Performance' && baseAbility === 'Support Magic') smCount++;
    }
  }
  return smCount >= 1;
}

function getEligibleRedirectHeroes(gs, pi, selected, validTargets) {
  const ps = gs.players[pi];
  const eligible = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!heroCanUseMartyry(ps, hi)) continue;
    if (selected.type === 'hero' && selected.owner === pi && selected.heroIdx === hi) continue;
    const isValidTarget = validTargets.some(t =>
      t.type === 'hero' && t.owner === pi && t.heroIdx === hi
    );
    if (!isValidTarget) continue;
    eligible.push(hi);
  }
  return eligible;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  isTargetRedirect: true,

  spellPlayCondition() {
    return false;
  },

  canRedirect(gs, pi, selected, validTargets, config, engine) {
    if (selected.owner !== pi) return false;
    return getEligibleRedirectHeroes(gs, pi, selected, validTargets).length > 0;
  },

  onRedirect: async (engine, pi, selected, validTargets, config, sourceCard) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const eligible = getEligibleRedirectHeroes(gs, pi, selected, validTargets);
    if (eligible.length === 0) return null;

    // ── Select Hero to take the hit ──
    let selectedHeroIdx;
    if (eligible.length === 1) {
      selectedHeroIdx = eligible[0];
    } else {
      const heroTargets = eligible.map(hi => ({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: ps.heroes[hi].name,
      }));

      const picked = await engine.promptEffectTarget(pi, heroTargets, {
        title: 'Martyry',
        description: 'Select a Hero to sacrifice themselves and take the hit.',
        confirmLabel: '💚 Protect!',
        confirmClass: 'btn-success',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        greenSelect: true,
      });

      if (!picked || picked.length === 0) return null;
      const target = heroTargets.find(t => t.id === picked[0]);
      if (!target) return null;
      selectedHeroIdx = target.heroIdx;
    }

    const martyrHero = ps.heroes[selectedHeroIdx];
    if (!martyrHero?.name) return null;

    // ── Chain visualization ──
    const attackerName = config.title || sourceCard?.name || 'Effect';
    const chain = [
      {
        id: 'redirect-source',
        cardName: attackerName,
        owner: sourceCard?.controller ?? sourceCard?.owner ?? (pi === 0 ? 1 : 0),
        cardType: config.damageType === 'attack' ? 'Attack' : 'Spell',
        isInitialCard: true,
        negated: false,
        chainClosed: false,
      },
      {
        id: 'redirect-martyry',
        cardName: 'Martyry',
        owner: pi,
        cardType: 'Spell',
        isInitialCard: false,
        negated: false,
        chainClosed: false,
      },
    ];
    engine._broadcastChainUpdate(chain);
    await engine._delay(800);

    engine._broadcastEvent('reaction_chain_resolving_start', { chain });
    await engine._delay(400);
    engine._broadcastEvent('reaction_chain_link_resolving', { index: 1, cardName: 'Martyry' });
    await engine._delay(600);
    engine._broadcastEvent('reaction_chain_done', {});

    // ── Animation: Martyry hero rams into the original target to protect it ──
    const originalOwner = selected.owner;
    const originalHeroIdx = selected.heroIdx;
    const originalZoneSlot = selected.type === 'hero' ? undefined : selected.slotIdx;

    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: selectedHeroIdx,
      targetOwner: originalOwner, targetHeroIdx: originalHeroIdx,
      targetZoneSlot: originalZoneSlot,
      cardName: martyrHero.name, duration: 1200,
    });
    await engine._delay(300);

    // Heal sparkle on the protected target
    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle', owner: originalOwner, heroIdx: originalHeroIdx,
      zoneSlot: selected.type === 'hero' ? -1 : selected.slotIdx,
    });
    await engine._delay(900);

    // ── Build the redirect target ──
    const redirectTarget = validTargets.find(t =>
      t.type === 'hero' && t.owner === pi && t.heroIdx === selectedHeroIdx
    );

    if (!redirectTarget) return null;

    engine.log('martyry', {
      player: ps.username,
      martyrHero: martyrHero.name,
      originalTarget: selected.cardName,
      attacker: attackerName,
    });
    engine.sync();

    return { redirectTo: redirectTarget };
  },
};
