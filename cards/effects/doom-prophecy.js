// ═══════════════════════════════════════════
//  CARD EFFECT: "Doom Prophecy"
//  Spell (Normal), Lv1, Decay Magic, PP MSAZ
//
//  "Search your deck for a 'Doom Clock' and place it
//   into your Area Zone. If the user has at least
//   Decay Magic 2, you may place it into your
//   opponent's Area Zone instead. Then, place 3 Doom
//   Counters onto it. Immediately end your turn
//   afterwards."
//
//  Als Rulings (5.8.)
//  ──────────────────
//  • Liegt KEINE Doom Clock im Deck, fizzelt die
//    Karte KOMPLETT — auch der Zug endet dann nicht.
//  • Zugende: offene Phasen werden uebersprungen,
//    eine laufende Kette laeuft aber zu Ende. Genau
//    das leistet Terrors Mechanik
//    (`gs._terrorForceEndTurn`): der Server wartet in
//    sendGameState, bis Prompt, Effekt und Kette
//    durch sind, und faehrt dann die End Phase.
//
//  Als Ruling (Al 27.10.): GAR NICHT ERST SPIELBAR
//  ───────────────────────────────────────────────
//  • Kann der Wirker KEINE Doom Clock legen, ist die
//    Karte ausgegraut (wie eine reine Zieh-Karte unter
//    Draw-Lock) — sie fizzelt nicht und verbraucht
//    nichts. Nicht legbar heisst: Reality Crack („You
//    cannot play another Area for the rest of the
//    turn"), oder KEINE der erlaubten Zonen nimmt eine
//    Uhr auf. Erlaubt ist die eigene Zone, mit Decay
//    Magic 2 des Wirkers auch die gegnerische; eine
//    Zone nimmt keine Uhr auf, wenn dort schon eine
//    liegt (zwei Kopien derselben Area gibt es nie) oder
//    eine unentfernbare Area (Gigalopolis) das Limit
//    besetzt haelt. Mit Decay 2 genuegt EINE freie Zone;
//    es wird dann nur sie angeboten (kein Wahldialog).
//  • Eine andere, entfernbare Area stoert nicht: der
//    Zonen-Besitzer legt sie wie bisher als Ueberhang ab
//    (`enforceAreaLimit`).
//  • Unveraendert: liegt KEINE Uhr im Deck, ist die Karte
//    spielbar und fizzelt (Ruling 5.8.) — die Suche darf
//    leer ausgehen.
//  • `spellPlayCondition` = irgendein eigener Held kann
//    die Uhr legen; `canPlayWithHero` = DIESER Held
//    (seine Decay-Stufe entscheidet, ob die Gegnerzone
//    zur Wahl steht).
// ═══════════════════════════════════════════

const D = require('./_doom-clock-shared');

const CARD_NAME = 'Doom Prophecy';
const START_COUNTERS = 3;

/** Nimmt die Area Zone von `z` eine (weitere) Doom Clock auf? Keine Dublette; eine unentfernbare Area (Gigalopolis) darf das Limit nicht besetzt halten. */
function zoneNimmtUhrAuf(engine, z) {
  if ((engine.gs.areaZones?.[z] || []).includes(D.CLOCK_NAME)) return false;
  return engine.areaPlatzNachAbraeumen(z, D.CLOCK_NAME);
}

/** Zonen, in die ein Wirker (Brettseite `seite`, Held `heroIdx`) die Uhr legen duerfte — Reihenfolge: eigene, dann gegnerische (nur mit Decay Magic 2). */
function zonenFuerWirker(engine, pi, seite, heroIdx) {
  if (engine.areaSpielGesperrt(pi, { direkt: true })) return [];
  const zonen = [pi];
  if (engine.heroSchoolLevel('Decay Magic', seite, heroIdx) >= 2) zonen.push(engine.opponentOf(pi));   // W4a: harte Negierung -> Stufe 0
  return zonen.filter(z => zoneNimmtUhrAuf(engine, z));
}

module.exports = {
  /** Grau, solange KEIN eigener Held eine Uhr legen kann (Reality Crack, Dublette, kein Platz). */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
      if (!hero?.name || hero.hp <= 0) continue;
      if (zonenFuerWirker(engine, pi, physOwner, heroIdx).length > 0) return true;
    }
    return false;
  },

  /** Je Wirker: seine Decay-Stufe entscheidet, ob die Gegnerzone zur Wahl steht. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return zonenFuerWirker(engine, pi, engine.heldSeiteFuer(pi, heroIdx), heroIdx).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];

      // Als Ruling (Al 27.10.): ohne legbare Zone (Reality Crack, Dublette, kein Platz) ist die Karte gar nicht spielbar (`spellPlayCondition`/`canPlayWithHero`); kippt der Zustand
      // zwischen Wahl und Wirkung (Kette), fizzelt sie hier wie ohne Doom Clock im Deck (nichts wird gelegt, der Zug endet nicht).
      const zonen = zonenFuerWirker(engine, pi, ctx.cardHeroOwner ?? pi, ctx.cardHeroIdx);   // Als Befund 29.9.: Zonen des Wirkers auf seiner Brettseite
      const idx = zonen.length === 0 ? -1 : (ps.mainDeck || []).indexOf(D.CLOCK_NAME);
      if (idx < 0) {
        // Kein Ziel im Deck -> die Karte fizzelt komplett, der Zug
        // laeuft normal weiter (Als Ruling).
        engine.log('doom_prophecy_fizzle', { player: ps.username });
        engine.sync();
        return;
      }

      // Gegnerische Area-Zone nur mit Decay Magic 2 auf dem Anwender — und nur, wenn sie die Uhr aufnimmt; bleibt nur EINE Zone, gibt es nichts zu wählen.
      let ziel = zonen[0];
      const decayLv = engine.heroSchoolLevel('Decay Magic', ctx.cardHeroOwner ?? pi, ctx.cardHeroIdx);   // W4a: harte Negierung -> Stufe 0
      if (zonen.length > 1) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          message: `Into which Area Zone? (Decay Magic ${decayLv})`,
          options: [
            { id: 'self', label: '🏠 My Area Zone', color: '#44aaff' },
            { id: 'opp',  label: "☠️ Opponent's Area Zone", color: '#e04040' },
          ],
          cancellable: false,
        });
        if (wahl?.optionId === 'opp') ziel = oi;
      }

      if (!(await engine.takeFromPile(ps, 'deck', idx, { source: CARD_NAME }))) return;   // v820: Stapel-Schicht
      const inst = engine._trackCard(D.CLOCK_NAME, ziel, 'deck');
      // ★ W16b (A01-pollution-08, Welle 5 „Karten gehen zum permanenten Besitzer"): die Uhr kam aus MEINEM Deck — in der Gegnerzone
      // bleibt `owner` = Zonen-Besitzer, `originalOwner` = Leger; Ablage/Gelöscht-Stapel lesen den Leger.
      inst.originalOwner = pi;
      // Als Befund (A01-pollution-07): `placeArea` liest den aufloesenden Zauber
      // vom BESITZER der Area-Zone. Liegt die Uhr beim Gegner, ist dort keiner
      // → die Engine stempelt `_spellPlacedOnBoard` ("der Zauber liegt selbst
      // auf dem Brett") und Doom Prophecy kaeme nie in die Ablage. Die Uhr ist
      // aber nicht der Zauber: den Stempel wie vorher belassen.
      const placedVorher = gs._spellPlacedOnBoard;
      await engine.placeArea(ziel, inst);
      if (ziel !== pi) {
        if (placedVorher) gs._spellPlacedOnBoard = placedVorher;
        else delete gs._spellPlacedOnBoard;
      }
      engine.log('doom_prophecy_place', {
        player: ps.username,
        into: gs.players[ziel]?.username,
        decayLevel: decayLv,
      });
      engine.shuffleDeck?.(pi);
      engine.sync();
      // ★ W16b (A01-pollution-13): Area-Limit (`areaLimitFor`, Ruling 14.9.) gilt auch für die per Effekt gelegte Uhr — der Zonen-Besitzer
      // legt den Überhang ab (`enforceAreaLimit`, er wählt). Ist es die neue Uhr selbst, die geht, bleiben ihr die Startzähler erspart.
      await engine.enforceAreaLimit(ziel, CARD_NAME);
      engine.sync();

      // Die drei Startzaehler legt der ANWENDER — bei nur 3 Stueck kann
      // das noch niemanden das Spiel kosten, der Weg ist aber derselbe
      // wie ueberall (Hook feuert, Grenze wird geprueft).
      for (let n = 0; n < START_COUNTERS && inst.zone === 'area'; n++) {
        const ende = await D.placeCounter(engine, inst, pi, { sourceName: CARD_NAME });
        if (ende) return;
      }

      // Zug sofort beenden — Terror-Mechanik: der Server wartet, bis
      // Prompts, Effekte und eine laufende Kette durch sind.
      gs._terrorForceEndTurn = pi;
      // Quelle fuer den Zug-Ende-Riegel (v436). Doom Prophecy beendet
      // den EIGENEN Zug — Blackstache greift hier also nicht, Tuscan
      // Prisoner schon ("unaffected by ALL effects that would end
      // your turn", Als Ruling 16.8.).
      gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
      engine.log('doom_prophecy_end_turn', { player: ps.username });
      engine.sync();
    },
  },
};
