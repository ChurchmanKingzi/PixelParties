// ═══════════════════════════════════════════
//  CARD EFFECT: "Crusader's Arm-Cannon"
//  Equipment-Artefakt der „Crusader's"-Familie. Skelett in
//  `_crusader-shared.js`.
//
//  EIGENE KLAUSEL: „If a Hero that has 3 Abilities at level 1 takes
//  damage from this Attack, send all Abilities attached to that Hero
//  to the discard pile."
//
//  ── AUSLEGUNG (Al gemeldet) ──────────────────────────────────────
//  „has 3 Abilities at level 1" wird als MINDESTENS drei Abilities auf
//  Stufe 1 gelesen (`>= 3`). Ein Held hat drei Ability-Zonen, im
//  Normalfall sind „3" und „mindestens 3" also dasselbe. Auseinander
//  gehen sie nur, wenn eine Karte in einer SUPPORT-Zone als Ability
//  zaehlt (Cloak of Edge) — dann kann ein Held vier Abilities tragen.
//  Die grosszuegigere Lesart trifft dann trotzdem zu, weil die
//  Bedingung „drei auf Stufe 1" erfuellt ist.
//
//  Eingesammelt wird ueber `engine.getAbilityTargets` — der zentrale
//  Sammler, der Ability-Zonen UND als Ability zaehlende Support-Karten
//  abdeckt (Vorschrift aus CARD_API.md). Selbst durch die Zonen zu
//  laufen wuerde Cloak of Edge uebersehen, und zwar in BEIDE
//  Richtungen: beim Zaehlen und beim Abwerfen.
// ═══════════════════════════════════════════

const { makeCrusaderArtifact, takten, ABILITY_TAKT_MS } = require('./_crusader-shared');

const CARD_NAME = "Crusader's Arm-Cannon";
const LEVEL1_SCHWELLE = 3;

module.exports = makeCrusaderArtifact({
  cardName: CARD_NAME,
  attackLabel: '💥 80 Damage!',
  riderText: 'If it damages a Hero with 3 Abilities at level 1, all Abilities on that Hero are discarded.',

  // Kanonenkugel: dasselbe Projektil-Prinzip wie bei der Flintlock, aber
  // deutlich groesser und traeger — und mit Explosion statt Einschlag.
  async attackAnim(ctx, { engine, pi, heroIdx, tgtOwner, tgtHeroIdx, tgtZoneSlot, impactSlot }) {
    const FLUGZEIT = 620;                       // schwerer als eine Kugel
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: pi, sourceHeroIdx: heroIdx, sourceZoneSlot: -1,
      targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
      targetZoneSlot: tgtZoneSlot,
      emoji: '⚫',
      emojiStyle: { fontSize: 46, filter: 'drop-shadow(0 0 10px rgba(60,60,70,.9))' },
      duration: FLUGZEIT,
    });
    await engine._delay(FLUGZEIT);
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
    await engine._delay(160);
  },

  async rider(ctx, { engine, pi, target, hatSchaden }) {
    if (target.type !== 'hero' || !hatSchaden) return;

    const opferSeite = target.owner;
    const opferHeld = target.heroIdx;
    const abilities = engine.getAbilityTargets(opferSeite, { heroIdx: opferHeld });
    const aufStufe1 = abilities.filter(a => a.level === 1).length;
    if (aufStufe1 < LEVEL1_SCHWELLE) return;

    // Alle Abilities dieses Helden — nicht nur die auf Stufe 1. Der
    // Text sagt „send ALL Abilities attached to that Hero".
    //
    // v800: ueber `discardAbilityTopCopy` (→ `sendBoardCardToDiscard`)
    // statt der alten Namens-Schleife — so wandert je Kopie die INSTANZ
    // mit, und Fighting/Toughness nehmen ihre Boni zurueck. Eine Ability
    // der Stufe N liegt als N Karten im selben Slot; der Stapel wird
    // Kopie fuer Kopie abgeraeumt, mit Als Takt dazwischen (17.8.: „ein
    // etwas groesserer Delay zwischen ihnen").
    let abgeworfen = 0;
    for (const eintrag of abilities) {
      if (eintrag.zoneKind !== 'ability') continue;
      const hoehe = eintrag.level || 1;
      for (let k = 0; k < hoehe; k++) {
        if (!(await engine.discardAbilityTopCopy(eintrag, { source: CARD_NAME, sourceOwner: pi }))) break;
        abgeworfen++;
      }
      await takten(engine, ABILITY_TAKT_MS);
    }
    // Karten in SUPPORT-Zonen, die als Ability zaehlen (Cloak of Edge),
    // liegen nicht in den Ability-Zonen — sie gehen ueber denselben Weg.
    for (const eintrag of abilities) {
      if (eintrag.zoneKind !== 'support' || !eintrag.cardInstance) continue;
      if (await engine.discardAbilityTopCopy(eintrag, { source: CARD_NAME, sourceOwner: pi })) abgeworfen++;
    }
    engine.log('crusader_arm_cannon_strip', {
      player: engine.gs.players[pi]?.username,
      hero: engine.gs.players[opferSeite]?.heroes?.[opferHeld]?.name,
      level1: aufStufe1, discarded: abgeworfen,
    });
  },
});
