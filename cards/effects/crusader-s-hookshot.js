// ═══════════════════════════════════════════
//  CARD EFFECT: "Crusader's Hookshot"
//  Equipment-Artefakt der „Crusader's"-Familie. Skelett in
//  `_crusader-shared.js`.
//
//  EIGENE KLAUSEL: „If a Hero takes damage from this Attack, its
//  effect is negated for 1 turn. This counts as a negative status
//  effect."
//
//  Umgesetzt ueber den regulaeren `negated`-Status (`addHeroStatus`) —
//  derselbe Weg, den Sparky Slime nimmt. Damit ist der zweite Satz
//  automatisch erfuellt: `negated` steht in `getNegativeStatuses`, also
//  greifen Immunitaeten (Johanna, Crusader of Light schuetzt ihre
//  Mitstreiter) und Reinigungseffekte ohne Zutun dieser Karte.
// ═══════════════════════════════════════════

const { makeCrusaderArtifact } = require('./_crusader-shared');

const CARD_NAME = "Crusader's Hookshot";

module.exports = makeCrusaderArtifact({
  cardName: CARD_NAME,
  attackLabel: '⚓ 80 Damage!',
  riderText: "If it damages a Hero, that Hero's effect is negated for 1 turn.",

  // Der ausgeruestete Held rammt das Ziel und fliegt zurueck — dasselbe
  // `play_ram_animation`, das Phoenix Tackle benutzt. Die Zeitachse ist
  // von dort uebernommen: der Held erreicht das Ziel bei ~12 % der
  // Flugdauer, dort sitzt der Aufprall, danach faellt der Schaden.
  async attackAnim(ctx, { engine, pi, heroIdx, tgtOwner, tgtHeroIdx, tgtZoneSlot, impactSlot }) {
    const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: pi, sourceHeroIdx: heroIdx,
      targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
      targetZoneSlot: tgtZoneSlot,
      cardName: hero?.name, duration: 1100,
    });
    await engine._delay(150);                   // Held ist am Ziel
    engine._broadcastEvent('play_zone_animation', {
      type: 'ox_impact', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
    await engine._delay(180);
  },

  async rider(ctx, { engine, pi, target, hatSchaden }) {
    if (target.type !== 'hero' || !hatSchaden) return;

    await engine.addHeroStatus(target.owner, target.heroIdx, 'negated', {
      appliedBy: pi,
      source: CARD_NAME,
    });
    engine.log('crusader_hookshot_negate', {
      player: engine.gs.players[pi]?.username,
      hero: engine.gs.players[target.owner]?.heroes?.[target.heroIdx]?.name,
    });
  },
});
