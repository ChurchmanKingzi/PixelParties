// ═══════════════════════════════════════════
//  CARD EFFECT: "Life Serum"
//  Potion (Normal)
//
//  "Choose any target on the board and increase its current and max HP
//   by 150."
//
//  ── DIE ARBEIT MACHT DIE ENGINE ───────────────────────────────────
//  `engine.increaseMaxHp(ziel, HP_GAIN)` deckt BEIDE Zielarten bereits ab
//  und kennt die Feinheiten, die man von aussen leicht falsch macht:
//    • Helden: `maxHp` UND `hp` steigen, und die Obergrenze
//      `maxHpCapped` wird beachtet (der Helfer meldet zurueck, wie viel
//      wirklich ankam — bei einer Deckelung auch 0);
//    • Kreaturen: `counters.maxHp` / `counters.currentHp` statt der
//      Kartendaten, und zwar BEIDE um den vollen Betrag. Das ist
//      absichtlich so und traegt den Nao-Ueberheil-Fall: `currentHp`
//      darf `maxHp` uebersteigen.
//  Ein eigener Rechenweg hier waere genau die Dublette, die bei der
//  naechsten HP-Regel ausschert.
//
//  ── „ANY TARGET ON THE BOARD" ─────────────────────────────────────
//  Beide Seiten, Helden UND Kreaturen — die Karte kann also auch dem
//  Gegner nuetzen; das steht so im Text und ist kein Versehen.
//
//  ★ KEIN Ausschluss der Rundenschutz-Seite (`firstTurnProtectedPlayer`),
//  anders als bei „Acid Vial". Der Schutz haelt SCHADEN ab; hier wird
//  niemand angegriffen, sondern beschenkt. Ihn hier zu uebernehmen
//  waere Nachahmung der Vorlage statt ihrer Begruendung.
//
//  Kein HOPT: der Kartentext nennt keine Einsatzgrenze.
// ═══════════════════════════════════════════

const CARD_NAME = 'Life Serum';
const HP_GAIN = 150;   // v1065 (Als Balanceaenderung 14.9.): war 200

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx) {
    // Es muss irgendetwas auf dem Brett liegen, das HP hat.
    for (let pi = 0; pi < 2; pi++) {
      for (const hero of (gs.players[pi]?.heroes || [])) {
        if (hero?.name && hero.hp > 0) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    const targets = [];
    for (let pi = 0; pi < 2; pi++) {
      // `getHeroTargets` filtert bereits auf lebende Helden;
      // `getCreatureTargets` laeuft ueber jede Support Zone und haelt
      // Artefakt-Kreatur-Mischlinge (Powder Keg & Co.) drin.
      targets.push(...engine.getHeroTargets(pi));
      targets.push(...engine.getCreatureTargets(pi));
    }
    return targets;
  },

  targetingConfig: {
    title: CARD_NAME,
    description: `Increase a target's current and max HP by ${HP_GAIN}.`,
    confirmLabel: `💉 Inject! (+${HP_GAIN})`,
    confirmClass: 'btn-success',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection(selectedIds) {
    return selectedIds && selectedIds.length === 1;
  },

  // ★ Bewusst der VORHANDENE Heil-Klang/-Effekt statt eines neuen
  // Namens: ein Animationstyp, der nicht im Register von app-board.jsx
  // steht, tut still gar nichts — der Fehler faellt erst im Spiel auf.
  // `healing_hearts` ist registriert und passt (Lebenskraft steigt).
  animationType: 'healing_hearts',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;
    const gs = engine.gs;

    let ziel = null;
    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      ziel = hero;
    } else if (target.type === 'equip') {
      ziel = engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support'
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
      if (!ziel || ziel.zone !== 'support') return;
    }
    if (!ziel) return;

    engine._broadcastEvent('play_zone_animation', {
      type: 'healing_hearts',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
    });
    await engine._delay(180);

    const gestiegen = engine.increaseMaxHp(ziel, HP_GAIN);
    engine.log('life_serum', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      amount: gestiegen,
    });
    engine.sync();
  },
};
