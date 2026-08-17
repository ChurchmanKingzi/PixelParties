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
    // Eine Engine-Primitive dafuer gibt es nicht; das Muster stammt aus
    // `ragnarock.js`: Zone leeren, Namen in den Ablagestapel, dazu das
    // `ability_zone_to_discard`-Ereignis fuer den Flug. WICHTIG: eine
    // Ability der Stufe N liegt als N Karten IM SELBEN Slot
    // (`level: slot.length` in `getAbilityTargets`) — es muss also der
    // ganze Stapel abgeraeumt werden, nicht nur die oberste Karte.
    const opferPs = engine.gs.players[opferSeite];
    const zonen = opferPs?.abilityZones?.[opferHeld] || [];
    let abgeworfen = 0;
    for (let zi = 0; zi < zonen.length; zi++) {
      const slot = zonen[zi];
      if (!slot?.length) continue;
      const anzahl = slot.length;
      const name = slot[0];
      slot.length = 0;
      for (let k = 0; k < anzahl; k++) opferPs.discardPile.push(name);
      engine._broadcastEvent('ability_zone_to_discard', {
        owner: opferSeite, heroIdx: opferHeld, zoneSlot: zi, cardName: name,
      });
      abgeworfen += anzahl;
      // Als Vorgabe 17.8.: „ein etwas groesserer Delay zwischen ihnen."
      // Deshalb `ABILITY_TAKT_MS` statt des normalen Takts — drei
      // Abilities hintereinander sollen einzeln lesbar bleiben.
      await takten(engine, ABILITY_TAKT_MS);
    }
    // Karten in SUPPORT-Zonen, die als Ability zaehlen (Cloak of Edge),
    // liegen nicht in den Ability-Zonen — sie gehen ueber den
    // Artefakt-Weg. `zoneKind` unterscheidet die beiden Herkuenfte.
    const { artefaktInDieAblage } = require('./_crusader-shared');
    for (const eintrag of abilities) {
      if (eintrag.zoneKind !== 'support' || !eintrag.cardInstance) continue;
      if (await artefaktInDieAblage(engine, eintrag.cardInstance)) abgeworfen++;
    }
    engine.log('crusader_arm_cannon_strip', {
      player: engine.gs.players[pi]?.username,
      hero: engine.gs.players[opferSeite]?.heroes?.[opferHeld]?.name,
      level1: aufStufe1, discarded: abgeworfen,
    });
  },
});
