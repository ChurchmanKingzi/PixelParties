// ═══════════════════════════════════════════
//  SHARED: Zielwahl-Merkmale (v701)
//
//  EINE Auslegungsstelle fuer „ist die Quelle
//  ein GEGNERISCHER Creature-Effekt?" — bisher
//  stand die Pruefung nur in Shield of Wisdom;
//  Rolling Boulder ist der zweite Nutzer, also
//  wandert sie hierher (Konsolidierungs-Regel).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * Die Quelle ist ein Creature-Effekt des GEGNERS von `pi`: eine
 * Creature-Instanz in einer Support Zone, kontrolliert vom anderen
 * Spieler. (Demon's-Gate-Faelle sind vorverarbeitet — die Engine
 * schreibt die Quelle vor allen Fenstern auf die castende Creature um.)
 */
function isOppCreatureEffect(engine, pi, sourceCard) {
  if (!sourceCard) return false;
  const srcOwner = sourceCard.controller ?? sourceCard.owner ?? -1;
  if (srcOwner < 0 || srcOwner === pi) return false;          // nur Gegner
  if (sourceCard.zone !== 'support') return false;            // Brett-Creature
  const cd = (engine.getEffectiveCardData ? engine.getEffectiveCardData(sourceCard) : null)
    || (sourceCard.name ? engine._getCardDB()[sourceCard.name] : null);
  return !!(cd && hasCardType(cd, 'Creature'));
}

/**
 * v704: ALLE offenen und verdeckten Nicht-Helden-Brettkarten als
 * Zielobjekte (Support, Ability-Stapel-Spitze, Permanent, Area-Spitze,
 * Surprise, Coolness-Stack-Spitze). Aus The Yeeting extrahiert; Shishi
 * ist der zweite Nutzer. Erst-Runden-Schutz und `immovable` werden
 * hier schon gefiltert. Jedes Ziel traegt `_cardInstance`.
 */
/**
 * ★ DIE EINE STELLE, an der eine Area-Ziel-ID entsteht (v1054).
 *
 * Vorher baute jede Karte `area-${owner}` selbst zusammen — neun
 * Kopien, alle mit der stillen Annahme „es gibt nur eine Area je
 * Seite". Seit „Spatial Crevice" stimmt die nicht mehr, und ohne den
 * Stapelplatz in der ID kann der Client zwei Eintraege nicht
 * unterscheiden.
 *
 * Der Client baut dieselbe ID aus seinem Render-Index (`gs.areaZones`
 * ist auf beiden Seiten dieselbe Namensliste, die Indizes stimmen also
 * ueberein).
 */
function areaTargetId(owner, stapelPlatz) {
  return `area-${owner}-${stapelPlatz}`;
}


/** Seite, auf der eine Brettkarte physisch liegt (s. `engine.physicalSide`). */
function _brettSeite(engine, inst) {
  if (typeof engine?.physicalSide === 'function') return engine.physicalSide(inst);
  if (inst.stolenBy != null) return inst.owner;
  return inst.controller ?? inst.owner;
}

function collectNonHeroBoardTargets(gs, engine) {
  const targets = [];
  const seen = new Set();

  // Erst-Runden-Schutz: Karten des geschützten Spielers kann
  // `actionDestroyCard` gar nicht zerstören (es loggt `destroy_blocked`
  // und kehrt zurück). Sie hier anzubieten hieße, ein Ziel zu zeigen,
  // das die Bezahlung anschließend verweigert — der Spieler zahlt 150
  // Selbstschaden für nichts. Der dafür vorgesehene Engine-Helfer heißt
  // `isAbilityRemovalProtected` und ist ausdrücklich für getValidTargets
  // gedacht.
  const EngineClass = engine?.constructor;
  const isProtected = (owner) => (
    typeof EngineClass?.isAbilityRemovalProtected === 'function'
      ? EngineClass.isAbilityRemovalProtected(gs, owner)
      : gs.firstTurnProtectedPlayer === owner
  );

  for (const inst of engine.cardInstances) {
    if (inst.zone === 'hand' || inst.zone === 'discard' || inst.zone === 'deleted' || inst.zone === 'hero' || inst.zone === 'deck') continue;
    if (inst.counters?.immovable) continue;
    if (isProtected(inst.owner)) continue;
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);

    if (inst.zone === 'support') {
      targets.push({
        // ★ 26.9. (Als Befund, Crimson Web): ID und `owner` nennen die Seite, auf
        // der die Zone LIEGT — sonst findet der Client sie nicht. Eine an
        // den Angreifer angelegte Crimson Web gehoert dem Verteidiger,
        // steckt aber in einer Support Zone des Angreifers.
        id: `equip-${_brettSeite(engine, inst)}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: _brettSeite(engine, inst), heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'ability') {
      // Only target the top card of each ability stack
      const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
      if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
      targets.push({
        id: `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'ability', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'permanent') {
      targets.push({
        id: `perm-${inst.owner}-${inst.counters?.permId || inst.id}`,
        type: 'perm', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'area') {
      // ★ v1054 (Als Befund 14.9.: „The Yeeting trifft immer die
      // oberste Area statt der gewaehlten").
      //
      // Hier stand ein Filter auf den OBERSTEN Eintrag, mit der
      // Begruendung „die BoardZone zeigt ohnehin nur den". Seit
      // „Spatial Crevice" zeigt sie ALLE — und die unteren waren damit
      // nicht nur unsichtbar fuer die Zielwahl, sie waren gar nicht
      // erst im Angebot. Die Auswahl landete auf der einzigen ID, die
      // es gab, und die gehoerte der obersten Karte.
      //
      // Jede Area ist jetzt ihr eigenes Ziel. Die ID traegt den
      // STAPELPLATZ, weil der Client nur Namen kennt (gs.areaZones ist
      // eine Namensliste) und ohne ihn zwei Eintraege nicht
      // auseinanderhalten koennte.
      const areaArr = gs.areaZones?.[inst.owner] || [];
      const stapelPlatz = areaArr.indexOf(inst.name);
      if (stapelPlatz < 0) continue;      // Instanz haengt nicht mehr in der Zone
      targets.push({
        id: areaTargetId(inst.owner, stapelPlatz),
        type: 'area', owner: inst.owner, heroIdx: -1,
        slotIdx: stapelPlatz,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'surprise') {
      // v706 (Als Befund, Shishi): der Client klickt Surprise-Zonen unter
      // `surprise-<owner>-<heroIdx>` mit Typ 'surprise' (Mizune, Skeleton
      // Archer, Baby Spider). Die alte `equip-…-surprise`-ID war fuer den
      // Client unsichtbar — auch The Yeeting konnte Surprises deshalb nie
      // anklicken, obwohl `maxPerType.surprise` schon darauf wartete.
      targets.push({
        id: `surprise-${inst.owner}-${inst.heroIdx}`,
        type: 'surprise', owner: inst.owner, heroIdx: inst.heroIdx,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'coolnessStack') {
      // Only the TOP of each player's Coolness Stack is targetable.
      const stack = gs.players[inst.owner]?.coolnessStack || [];
      if (stack.length === 0 || stack[stack.length - 1] !== inst.name) continue;
      targets.push({
        id: `coolness-${inst.owner}`,
        type: 'coolnessStackTop', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    }
  }

  return targets;
}

module.exports = { isOppCreatureEffect, collectNonHeroBoardTargets, areaTargetId };
