// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloud Pillow"
//  Artifact (Normal, 4 Gold) — Choose a living
//  target (Hero or Creature) you control. That
//  target gets "Cloudy" buff until the start of
//  your next turn (after Poison/Burn).
//
//  Cloudy: all damage taken is halved (rounded
//  up). Damage that cannot be reduced (Ida) is
//  NOT affected.
//
//  Uses the generic buff system:
//  - Heroes: hero.buffs.cloudy
//  - Creatures: inst.counters.buffs.cloudy
// ═══════════════════════════════════════════

module.exports = {
  // evaluateThroughTurnEnd (Al-Diagnose: 614× verfügbar, 4× gespielt):
  // Pillows Wert liegt im RESTZUG — es halbiert den Recoil der danach
  // gespielten Selbstschadens-Karten (Phoenix Tackle, Victory Phoenix
  // Cannon, Fire Bolts) plus den Schaden im Gegnerzug. Das Sofort-Gate
  // sah nur "−4 Gold, −1 Handkarte, Buff-Marker" und lehnte ab. Mit
  // Bewertung bis Zugende spielt der Rollout die Attacken MIT halbem
  // Recoil und der Wert wird sichtbar. (Der Pass-Zeitpunkt stimmt
  // bereits: Artifacts laufen in MP1, VOR der Action Phase.)
  cpuMeta: { evaluateThroughTurnEnd: true },
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    // Kontrolle statt Seite (Styx 28.9.) — wie engine.heroSideOf
    for (let p = 0; p < (gs.players || []).length; p++) {
      for (const hero of (gs.players[p]?.heroes || [])) {
        if (!hero?.name || hero.hp <= 0) continue;
        const seite = hero.charmedBy ?? hero.permaControlBy ?? p;
        if (seite === pi) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    if (!engine) return [];
    // Kontrolle statt Seite (Styx 28.9.) — „a target you control"
    const heroes = engine.heroesControlledBy(pi)
      .filter(({ hero }) => hero.hp > 0 && !hero.buffs?.cloudy)
      .map(({ physOwner, heroIdx, hero }) => ({
        id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name,
      }));
    const creatures = engine.getCreatureTargets(pi);
    return [...heroes, ...creatures];
  },

  targetingConfig: {
    description: 'Choose a target you control to give Cloudy (half damage).',
    confirmLabel: '☁️ Cloud Up!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'cloud_gather',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const gs = engine.gs;
    // Buff expires at the START of the caster's NEXT turn.
    // In a 2-player game, that's currentTurn + 2.
    const expiresTurn = gs.turn + 2;

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];   // physische Spalte
      if (!hero?.name || hero.hp <= 0) return false;

      await engine.actionAddBuff(hero, target.owner, target.heroIdx, 'cloudy', {
        sourceOwner: pi,   // v1067: Quelle ist Pflicht (siehe _affected-shared)
        expiresAtTurn: expiresTurn,
        expiresForPlayer: pi,
        source: 'Cloud Pillow',
        addAnim: 'cloud_gather',
        removeAnim: 'cloud_disperse',
      });
    } else if (target.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (!inst) return false;

      await engine.actionAddCreatureBuff(inst, 'cloudy', {
        expiresAtTurn: expiresTurn,
        expiresForPlayer: pi,
        source: 'Cloud Pillow',
        addAnim: 'cloud_gather',
        removeAnim: 'cloud_disperse',
      });
    }

    engine.log('cloud_pillow', { player: gs.players[pi].username, target: target.cardName });
    await engine._delay(800);
    return true;
  },
};
