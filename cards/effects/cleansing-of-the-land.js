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
  // ★ SUCH-SPERRE: handgesetzt, mit Grund (Als Ruling 14.9., Gruppe A).
  // Die Autoerkennung laesst die Karte durch, weil sie neben der Suche
  // noch `placeArea` aufruft — das gilt ihr als zweiter Effekt. Hier
  // haengt der Einsatz aber VOLLSTAENDIG an der Suche: ohne gefundene
  // Karte gibt es nichts zu legen. Unter der Sperre ist die Karte also
  // wirkungslos.
  blockedBySearchLock: true,

  spellPlayCondition(gs, pi, engine) {
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
      if (areas.length === 0) { gs._spellCancelled = true; return; }

      // ── Die Feuerwalze, auf der HINTERGRUND-Ebene ─────────────────
      engine._broadcastEvent('play_zone_animation', {
        type: 'fire_sweep', zoneType: 'board', layer: 'background',
        owner: pi, heroIdx: -1, zoneSlot: -1, duration: 2200,
      });
      await engine._delay(900);

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        searchToHand: true,   // v1118: Suche AUF DIE HAND
        title: CARD_NAME,
        description: 'Choose an Area from your deck.',
        cards: areas,
        cancellable: true,
      });
      const name = wahl?.cardName;
      if (!name) { gs._spellCancelled = true; return; }

      // ① Auf die Hand — kanonischer Deck-Weg.
      const ok = await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME });
      if (!ok) { gs._spellCancelled = true; return; }

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

      ps.hand.splice(handIdx, 1);
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
