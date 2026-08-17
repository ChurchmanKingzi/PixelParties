// ═══════════════════════════════════════════
//  CARD EFFECT: "Crusader's Flintlock"
//  Equipment-Artefakt der „Crusader's"-Familie. Skelett in
//  `_crusader-shared.js`.
//
//  EIGENE KLAUSEL: „If this Attack deals damage to a Hero, discard all
//  Artifacts that Hero is equipped with."
//
//  AUSLEGUNG: „deals damage" — es reicht, dass Schaden ankommt; der
//  Held muss nicht fallen. Eingesammelt wird ueber
//  `engine.getArtifactTargets(owner, { heroIdx })`, den zentralen
//  Sammler: er liefert genau die ARTEFAKTE einer Support-Zone und
//  laesst Karten aus, die dort als Ability zaehlen (Cloak of Edge) —
//  Abwerfen wuerde die sonst faelschlich mitreissen.
//
//  Trifft der Schuss Cecilia selbst, faellt auch die Flintlock — sie
//  ist ein Artefakt an diesem Helden. Das steht so im Text.
// ═══════════════════════════════════════════

const { makeCrusaderArtifact, artefaktInDieAblage, takten, TAKT_MS } = require('./_crusader-shared');

const CARD_NAME = "Crusader's Flintlock";

module.exports = makeCrusaderArtifact({
  cardName: CARD_NAME,
  attackLabel: '🔫 80 Damage!',
  riderText: 'If it damages a Hero, all Artifacts equipped to that Hero are discarded.',

  // Pistolenkugel vom AUSGERUESTETEN Helden zum Ziel. Der Schaden faellt
  // beim Einschlag, nicht beim Abschuss: die Animation wartet die
  // Flugzeit ab und kehrt genau dann zurueck, wenn die Kugel ankommt —
  // der gemeinsame Teil der Fabrik schlaegt unmittelbar danach zu.
  async attackAnim(ctx, { engine, pi, heroIdx, tgtOwner, tgtHeroIdx, tgtZoneSlot, impactSlot }) {
    const FLUGZEIT = 380;                       // schnell, es ist eine Kugel
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: pi, sourceHeroIdx: heroIdx, sourceZoneSlot: -1,  // vom Helden, nicht vom Artefakt
      targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
      targetZoneSlot: tgtZoneSlot,
      emoji: '•',
      emojiStyle: { fontSize: 26, color: '#ffd9a0', textShadow: '0 0 8px rgba(255,190,90,.95)' },
      duration: FLUGZEIT,
    });
    await engine._delay(FLUGZEIT);
    engine._broadcastEvent('play_zone_animation', {
      type: 'arrow_impact', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
  },

  async rider(ctx, { engine, pi, target, hatSchaden }) {
    if (target.type !== 'hero' || !hatSchaden) return;

    const opferSeite = target.owner;
    const opferHeld = target.heroIdx;
    // Momentaufnahme vor dem Abwerfen — die Liste veraendert sich,
    // sobald die erste Karte die Zone verlaesst.
    const artefakte = engine.getArtifactTargets(opferSeite, { heroIdx: opferHeld })
      .map(t => t.cardInstance)
      .filter(Boolean);
    if (artefakte.length === 0) return;

    let abgeworfen = 0;
    for (const inst of artefakte) {
      if (!inst || inst.zone !== 'support') continue;
      if (await artefaktInDieAblage(engine, inst)) abgeworfen++;
      // Getaktet wie bei der Cutlass: sonst leert sich die ganze Reihe
      // in einem Zustandsversand und die Einzelfluege kommen zu spaet.
      await takten(engine, TAKT_MS);
    }
    engine.log('crusader_flintlock_strip', {
      player: engine.gs.players[pi]?.username,
      hero: engine.gs.players[opferSeite]?.heroes?.[opferHeld]?.name,
      discarded: abgeworfen,
    });
  },
});
