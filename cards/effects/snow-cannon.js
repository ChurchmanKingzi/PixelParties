// ═══════════════════════════════════════════
//  CARD EFFECT: "Snow Cannon"
//  Artifact (Normal) — Choose a target Hero
//  or Creature that isn't Immune. Freeze it
//  until the end of its owner's next turn.
//  Goes to discard after resolving.
//
//  ★ Spielgestalter-Entscheidung 17.11.2026 (Warnungsprinzip): gegen Frost
//  immune Ziele (Helden UND Kreaturen: freeze_immune, `immune`, Charme,
//  Cardinal Beasts …) bleiben WAEHLBAR — nicht ausgegraut, nicht
//  herausgefiltert. Die Zielwahl warnt („… is immune to freezing and will
//  not be affected."), der Frost verpufft, die Karte ist verbraucht. Die CPU
//  waehlt solche Ziele nicht. Nur Unwaehlbares (tot, schon gefroren,
//  verdeckt, untargetable) steht weiter nicht in der Liste.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { opponentOfGs } = require('./_opp');

module.exports = {
  // ★ Welle 12 (B-06, Al: „Eine Karte, deren Effekt komplett nutzlos wäre, ist nicht spielbar."): trifft NUR den Gegner — gegen den durch die
  // Erste-Runden-Immunität geschützten Spieler unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten/Einmal-Stempel; `engine.ersterZugGeschuetzt`).
  blockedByFirstTurnProtection: true,
  isTargetingArtifact: true,
  animationType: null, // No destruction animation — just freezes

  canActivate(gs, playerIdx, engine) {
    return this.getValidTargets(gs, playerIdx, engine).length > 0;
  },

  // v327 (Als Report): Der Kartentext sagt "Choose a target Hero OR
  // CREATURE that isn't Immune" — angeboten wurden bisher nur Helden.
  // Gegnerische Kreaturen fehlten komplett. `engine` kommt als dritter
  // Parameter herein (gleiches Muster wie perfect-disguise.js); fehlt er
  // — etwa in einem Aufruf ohne Engine-Referenz — bleibt es beim alten
  // Verhalten mit Helden, statt zu werfen.
  getValidTargets(gs, playerIdx, engine) {
    const targets = [];
    const oppIdx = opponentOfGs(gs, playerIdx);
    // Kontrolle statt Seite (Styx 28.9.): alle Helden, die der Gegner
    // kontrolliert (wie engine.heroSideOf) — Ziel-IDs bleiben physisch.
    for (let po = 0; po < (gs.players || []).length; po++) {
    const ps = gs.players[po];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if ((hero.charmedBy ?? hero.permaControlBy ?? po) !== oppIdx) continue;
      // `immune` (Auftau-Puffer), freeze_immune & Co. nehmen den Helden NICHT aus der Liste (Spielgestalter-Entscheidung 17.11.2026): wählbar, Warnung im Picker, der Frost verpufft.
      if (hero.statuses?.frozen) continue;
      targets.push({
        id: `hero-${po}-${hi}`,
        type: 'hero',
        owner: po,
        heroIdx: hi,
        cardName: hero.name,
      });
    }
    }

    // Gegnerische Kreaturen in den Support-Zonen. Kreatur-Status liegt
    // auf `inst.counters`, nicht auf `statuses`. Ob der Frost ueberhaupt
    // landen darf, entscheidet die Engine ueber
    // `canApplyCreatureStatus` — damit gelten Immunitaeten und Schilde
    // hier genauso wie beim tatsaechlichen Anwenden, statt sie hier ein
    // zweites Mal (und moeglicherweise abweichend) nachzubauen.
    if (engine) {
      const cardDB = engine._getCardDB ? engine._getCardDB() : {};
      for (const inst of (engine.cardInstances || [])) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== oppIdx) continue;
        if (inst.faceDown) continue;
        { const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name]; if (!cd || !engine.isChoosableAsCreature(inst, cd)) continue; }   // wirksame Daten: Tokens/Artifact Creatures auf dem Brett (Als Sweep 9.10.)
        if (inst.counters?.frozen) continue;
        // Harte Unwählbarkeit (Thicket): „cannot be chosen by cards and effects" — wie im Engine-Sammler (F03-04).
        if (inst.counters?.untargetable_all) continue;
        // Frost-Immunitaet (freeze_immune, Cardinal Beast …) schliesst die Kreatur NICHT aus (Spielgestalter-Entscheidung 17.11.2026): wählbar, Warnung im Picker, der Frost verpufft.
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }
    }
    // Immune Ziele markieren (`wirkungslos`): der Picker warnt, die CPU wählt sie nicht.
    if (engine?.markiereStatusWirkungslos) engine.markiereStatusWirkungslos(targets, 'frozen', playerIdx, 'Snow Cannon');
    return targets;
  },

  targetingConfig: {
    description: 'Select a Hero or Creature to Freeze.',
    confirmLabel: 'Freeze!',
    confirmClass: 'btn-info',
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
    maxTotal: 1,
  },

  validateSelection(selected, validTargets) {
    if (!selected || selected.length !== 1) return false;
    const validIds = new Set(validTargets.map(t => t.id));
    return selected.every(id => validIds.has(id));
  },

  async resolve(engine, playerIdx, selectedIds, validTargets) {
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;
    // Immunes Ziel (Spielgestalter-Entscheidung 17.11.2026): der Frost verpufft — `addHeroStatus`/`applyCreatureStatus` weisen ihn ab (`status_blocked`), die Karte ist gespielt.
    let angewendet = false;
    if (target.type === 'hero') {
      await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', { appliedBy: playerIdx });
      angewendet = !!engine.gs.players[target.owner]?.heroes?.[target.heroIdx]?.statuses?.frozen;
    } else {
      // Kreatur — Instanz bevorzugt aus dem Ziel, sonst ueber die Zone
      // nachschlagen (das Ziel kann eine ueber den Client gelaufene
      // Kopie ohne `cardInstance` sein).
      const inst = target.cardInstance
        || (engine.cardInstances || []).find(c => c.zone === 'support'
          && c.owner === target.owner && c.heroIdx === target.heroIdx
          && c.zoneSlot === target.slotIdx);
      if (!inst) return;
      angewendet = !!(await engine.applyCreatureStatus(inst, 'frozen', {
        source: { name: 'Snow Cannon', owner: playerIdx },
        appliedBy: playerIdx,
      }));
    }
    if (angewendet) engine.log('freeze', { target: target.cardName, by: 'Snow Cannon' });
  },
};
