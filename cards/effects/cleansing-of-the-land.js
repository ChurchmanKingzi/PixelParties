// ═══════════════════════════════════════════
//  CARD EFFECT: „Cleansing of the Land"
//  Spell (Normal, Magic Arts Lv1)
//
//  "Choose an Area from your deck and add it to your hand. If one of
//   your Heroes can use that Area, you may immediately use it as an
//   additional Action."
//
//  ── ZWEI SCHRITTE, DER ZWEITE OPTIONAL ───────────────────────────
//  ① Eine AREA aus dem Deck auf die Hand. Ueber
//     `actionAddCardFromDeckToHand` — den kanonischen Deck-Weg, der die
//     Such-Sperre und das Aufdeck-Fenster mittraegt. Dadurch ordnet die
//     Autoerkennung die Karte auch von selbst als Deck-Sucher ein
//     (Gruppe A der Such-Sperre).
//
//  ② „IF ONE OF YOUR HEROES CAN USE THAT AREA" — die Stufenpruefung,
//     nicht bloss „hast du einen lebenden Helden". `heroMeetsLevelReq`
//     ist genau diese Frage und beruecksichtigt Schulen, Wisdom und
//     jede Ermaessigung von selbst. Dazu muss ueberhaupt Platz sein:
//     `canPlaceAnotherArea` (v1050) prueft Zahl UND Dublette.
//
//  ★ „AS AN ADDITIONAL ACTION": der Einsatz laeuft hier mitten in der
//  Aufloesung, kostet also ohnehin keine regulaere Aktion. Nichts
//  abzubuchen — die Formulierung stellt nur klar, dass der Zug nicht
//  verbraucht wird.
//
//  ── ANIMATION ────────────────────────────────────────────────────
//  Al 14.9.: eine Feuerwalze ueber das komplette Spielfeld, „aber auf
//  Hintergrund-Layer". Dafuer gibt es seit v1088 `layer: 'background'`
//  am vorhandenen `zoneType: 'board'` — die Walze mountet damit in die
//  Atmosphaeren-Ebene und zieht UNTER Zonen und Karten durch, statt sie
//  zu verdecken.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cleansing of the Land';

/** Kann irgendein Held von `pi` diese Area einsetzen? */
function einsetzbar(engine, pi, cd) {
  if (!cd) return false;
  if (!engine.canPlaceAnotherArea(pi, cd.name)) return false;
  const ps = engine.gs.players[pi];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (engine.heroMeetsLevelReq(pi, hi, cd)) return true;
  }
  return false;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'fire_sweep' }, impactMs: 260,
  },

  // ★ SUCH-SPERRE: handgesetzt, mit Grund (Als Ruling 14.9., Gruppe A).
  // Die Autoerkennung laesst die Karte durch, weil sie neben der Suche
  // noch `placeArea` aufruft — das gilt ihr als zweiter Effekt. Hier
  // haengt der Einsatz aber VOLLSTAENDIG an der Suche: ohne gefundene
  // Karte gibt es nichts zu legen. Unter der Sperre ist die Karte also
  // wirkungslos.
  blockedBySearchLock: true,

  /**
   * ★★ v1170 (Al 17.9.): „While there is at least 1 Area on the board,
   * this Spell can be used as an additional Action." — dieselbe Form wie
   * bei „Guardian of Teocuilatl": eine Funktion, die den Brettzustand
   * liest.
   */
  inherentAction(gs) {
    return (gs.areaZones || []).some(z => Array.isArray(z) && z.length > 0);
  },

  /**
   * Spielbar, sobald es etwas zu tun gibt: eine Area auf dem Brett zum
   * Abraeumen ODER eine Area im Deck zum Holen. (Vorher: nur Letzteres.)
   */
  spellPlayCondition(gs, pi, engine) {
    if ((gs.areaZones || []).some(z => Array.isArray(z) && z.length > 0)) return true;
    const db = engine._getCardDB();
    return (gs.players[pi]?.mainDeck || []).some(n => db[n]?.subtype === 'Area');
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const db = engine._getCardDB();
      // ★ v1159: Galerie-Eintraege (`{ name, source, count }`), nicht
      // rohe Namen — sonst bleibt die Galerie leer.
      const areaZaehler = new Map();
      for (const n of (ps.mainDeck || [])) {
        if (db[n]?.subtype !== 'Area') continue;
        areaZaehler.set(n, (areaZaehler.get(n) || 0) + 1);
      }
      const areas = [...areaZaehler.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      // ★★ v1170: „Send all Areas on the board to the discard pile." —
      // erst abraeumen, dann suchen. Die Feuerwand laeuft waehrenddessen.
      const areasAufDemBrett = (gs.areaZones || []).some(z => Array.isArray(z) && z.length > 0);
      if (!areasAufDemBrett && areas.length === 0) { gs._spellCancelled = true; return; }

      // ── Die Feuerwalze, auf der HINTERGRUND-Ebene ─────────────────
      engine._broadcastEvent('play_zone_animation', {
        type: 'fire_sweep', zoneType: 'board', layer: 'background',
        owner: pi, heroIdx: -1, zoneSlot: -1, duration: 2200,
      });
      await engine._delay(900);

      if (areasAufDemBrett) {
        // -2 heisst „keine Seite ausnehmen" — ALLE Areas.
        const weg = await engine.removeAllAreas(-2, CARD_NAME);
        engine.log('cleansing_of_the_land_wipe', { player: ps.username, areas: weg });
        engine.sync();
        await engine._delay(500);
      }

      // „You MAY then choose an Area from your deck" — ohne Area im Deck
      // (oder bei Abbruch) endet die Karte hier; abgeraeumt ist trotzdem.
      if (areas.length === 0) {
        engine.log('cleansing_of_the_land', { player: ps.username, card: null, used: false });
        engine.sync();
        return;
      }

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        searchToHand: true,   // v1118: Suche AUF DIE HAND
        title: CARD_NAME,
        description: 'Choose an Area from your deck.',
        cards: areas,
        cancellable: true,
      });
      const name = wahl?.cardName;
      // Abbruch ist erlaubt („you MAY"), der Guss bleibt gueltig: das
      // Abraeumen ist schon passiert.
      if (!name) {
        engine.log('cleansing_of_the_land', { player: ps.username, card: null, used: false });
        engine.sync();
        return;
      }

      // ① Auf die Hand — kanonischer Deck-Weg.
      // „openly add it to your hand" — die Karte wird beim Holen gezeigt.
      const ok = await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME, reveal: true });
      // (`actionAddCardFromDeckToHand` zeigt die Karte von sich aus —
      // „openly" ist damit erfuellt, ein zweiter Auftritt waere doppelt.)
      if (!ok) { engine.sync(); return; }

      // ② „If one of your Heroes can use that Area, you MAY immediately
      // use it."
      const cd = db[name];
      if (!einsetzbar(engine, pi, cd)) {
        engine.log('cleansing_of_the_land', { player: ps.username, card: name, used: false });
        engine.sync();
        return;
      }

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: name,
        message: `Immediately use ${name} as an additional Action?`,
        confirmLabel: '🔥 Use it!',
        cancelLabel: 'Keep it in hand',
        cancellable: true,
      });
      if (!ja) {
        engine.log('cleansing_of_the_land', { player: ps.username, card: name, used: false });
        engine.sync();
        return;
      }

      // Nach der Abfrage neu pruefen — waehrend des Ueberlegens kann
      // sich das Brett geaendert haben.
      const handIdx = (ps.hand || []).indexOf(name);
      if (handIdx < 0 || !einsetzbar(engine, pi, cd)) { engine.sync(); return; }

      // ★★ v1171 (Al 17.9.): Die Karte soll SICHTBAR von ihrem Platz in
      // der Hand auf das Brett fliegen. `placeArea` meldet nur das
      // Herabsinken in die Area-Zone — den Weg dorthin muss der Guss
      // selbst melden, wie jeder andere Hand→Brett-Weg auch.
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: name,
        from: 'hand', to: 'area',
        fromHandIdx: handIdx,
        finalHandSize: Math.max(0, (ps.hand || []).length - 1),
      });
      engine.takeFromPileSync(ps, 'hand', handIdx);
      engine.sync();
      await engine._delay(420);

      const inst = engine._trackCard(name, pi, 'hand', -1, -1);
      await engine.placeArea(pi, inst);

      engine.log('cleansing_of_the_land', { player: ps.username, card: name, used: true });
      engine.sync();
    },
  },

  /** CPU: eine Gratis-Area ist praktisch immer gut. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return { confirmed: true };
    return undefined;
  },
};
