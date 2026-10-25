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
  // W46a (Al, 22.10.2026: „Surprise Creature-Effekte sind immer noch Creature-Effekte"): neben der Brett-Creature (Zone 'support') zählt die AUFLÖSENDE Creature-Surprise
  // (Zone 'surprise', cardType Creature: Afflicted Vermin, Cactus Creature, Cybugs, Noble Mummy Guards …) — ihre Zielwahl läuft, bevor sie auf dem Brett steht.
  if (sourceCard.zone !== 'support' && sourceCard.zone !== 'surprise') return false;
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

/**
 * W19a (Al, 19.10.2026: „Tengu Windstorm, Sparkfly Worker … Yeeting und andere vergleichbare Effekte auch"): „any card on the board
 * that is not a Hero" schließt die OBERSTE Karte des Coolness Stacks jedes Spielers ein. EINE Stelle für Ziel-ID und -Art
 * (`coolness-<Seite>` / `coolnessStackTop`, wie Coolness Overcharge und Ralzish sie von jeher anbieten); jeder Sammler
 * („Nicht-Helden-Zielmenge") ruft sie in seiner Zonen-Schleife für Instanzen der Zone `coolnessStack`. Gibt das Ziel zurück
 * oder `null` (nicht die oberste Karte; bei gleichnamigen Karten im Stapel gilt nur die oberste Instanz - kein doppeltes Ziel).
 * Das Entfernen aus dem Stapel läuft über `engine.actionPopCoolnessStackTo` bzw. `actionDestroyCard` (leitet Stack-Karten dorthin).
 */
function coolnessSpitzeZiel(engine, inst) {
  if (!inst || inst.zone !== 'coolnessStack') return null;
  if (inst.counters?.immovable) return null;
  const stack = engine?.gs?.players?.[inst.owner]?.coolnessStack || [];
  if (stack.length === 0 || stack[stack.length - 1] !== inst.name) return null;
  const spitze = engine.getCoolnessStackTopInst?.(inst.owner);
  if (spitze && spitze !== inst) return null;
  return {
    id: `coolness-${inst.owner}`,
    type: 'coolnessStackTop', owner: inst.owner, heroIdx: -1,
    cardName: inst.name, _cardInstance: inst,
  };
}

/**
 * 25.10.2026 (Al, Xal-Runde 4: „Sun Beam und co sollen Support-Zone-Abilities als Abilities behandeln – und entsprechend die oberste Kopie davon entfernen"):
 * Eine Ability in einer Support Zone (Xal, Xalibur, gewonnener Xal-Effekt; auch eine schlafende, von der Leafagami Snake gehaltene) ist für „any card on the board that
 * is not a Hero" eine ABILITY — ein Stapel ist wie in einer Ability Zone EIN Ziel, vertreten von seiner OBERSTEN Kopie (`engine.supportAbilitySpitze`). Abwerfen, Zerstören oder
 * Zurückschicken trifft genau diese eine Kopie, die Stufe sinkt um 1. Die Ziel-ID bleibt die der Support Zone (`equip-<Seite>-<Held>-<Slot>`, Art 'equip'): so
 * hebt der Client genau diese Zone hervor.
 *
 * EINE Stelle für jeden Sammler („Nicht-Helden-Zielmenge"); er ruft sie am Anfang seines Support-Zweigs:
 *   const sa = supportAbilityZiel(engine, inst);
 *   if (sa !== undefined) { if (sa) targets.push(sa); continue; }
 * Rückgabe: `undefined` = keine Support-Ability (der Sammler arbeitet wie bisher), `null` = Kopie unterhalb der Spitze (überspringen), sonst das Ziel
 * (`istAbilityStapel: true`, `level` = Stapelhöhe).
 */
function supportAbilityZiel(engine, inst) {
  if (!engine?.istAbilityImSupport?.(inst)) return undefined;
  if (engine.supportAbilitySpitze(inst) !== inst) return null;
  const seite = _brettSeite(engine, inst);
  return {
    id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`,
    type: 'equip', owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
    cardName: inst.name, cardInstance: inst, _cardInstance: inst,
    zoneKind: 'support', istAbilityStapel: true, level: engine.abilityStapelVon(inst).length || 1,
  };
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
      const sa = supportAbilityZiel(engine, inst);   // 25.10.: Ability in einer Support Zone = Ability-Stapel, ein Ziel, oberste Kopie
      if (sa !== undefined) { if (sa) targets.push(sa); continue; }
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
      // Only the TOP of each player's Coolness Stack is targetable (W19a: `coolnessSpitzeZiel`).
      const spitze = coolnessSpitzeZiel(engine, inst);
      if (spitze) targets.push(spitze);
    }
  }

  return targets;
}

module.exports = { isOppCreatureEffect, collectNonHeroBoardTargets, areaTargetId, coolnessSpitzeZiel, supportAbilityZiel };
