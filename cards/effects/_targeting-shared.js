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
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
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
      // Area zones count as non-Hero board cards — anything that can
      // target a Permanent should also be able to target an Area. The
      // BoardZone displays the top entry of areaZones[owner], so
      // filter to just that entry.
      const areaArr = gs.areaZones?.[inst.owner] || [];
      if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
      targets.push({
        id: `area-${inst.owner}`,
        type: 'area', owner: inst.owner, heroIdx: -1,
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

module.exports = { isOppCreatureEffect, collectNonHeroBoardTargets };
