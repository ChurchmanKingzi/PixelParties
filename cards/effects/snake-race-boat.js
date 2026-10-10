// ═══════════════════════════════════════════
//  CARD EFFECT: "Snake Race Boat"
//  Artifact / Equipment (Race Boats, Cost 12) — im Skill Test gebannt
//
//  „A Hero can only have 1 "Race Boat" Artifact equipped to it. You may once
//   per turn choose as many Creatures with different names from your deck as
//   there are Creatures in the corresponding Hero's Support Zones, reveal
//   them, and add them to your hand."
//
//  ── ALS VORGABEN (10.10., bindend) ────────────────────────────────────
//  · Die Creatures-Zahl schliesst Bonus-Zonen von „Flying Island in the Sky"
//    ein (`_race-boat-shared.kreaturenAmHeld`).
//  · Als EINZIGES der vier Boote manuell aktivierbar: der Spieler klickt es an
//    wie andere Ausruestungen mit aktivem Effekt (Vertrag `equipEffect` →
//    `onEquipEffect`, server.js `doActivateEquipEffect`). KEINE Summoning
//    Sickness — es ist Ausruestung, keine Creature (der Weg kennt keine).
//  · Hat der Held 0 Creatures in seinen Support Zones oder gibt es 0 legale
//    Ziele im Deck, ist die Karte gar nicht erst aktivierbar
//    (`canActivateEquipEffect`).
//  · EXAKT so viele, nicht „up to": gibt es im Deck weniger VERSCHIEDENE
//    Creature-Namen als der Held Creatures traegt, ist sie ebenfalls nicht
//    aktivierbar; und wird sie aktiviert, muessen genau X verschiedene Namen
//    gewaehlt werden (Galerie `minSelect = selectCount = X`, Bestaetigen erst bei
//    X). ABBRECHEN geht immer und verbraucht NICHTS (Rueckgabe `false`: die
//    Engine rollt die Einmal-je-Zug-Sperre zurueck).
//
//  ── Umsetzung ─────────────────────────────────────────────────────────
//  · „different names": Basisnamen (`baseCardName`, „[B]"/„[W]" sind Kosmetik);
//    `cardGalleryMulti` liefert ohnehin nur Verschiedene.
//  · Karten, die „Creature" sind und aus dem Deck kommen duerfen (`isPileCreature`).
//  · Hinzufuegen je Karte einzeln ueber `actionAddCardFromDeckToHand` (Flug,
//    `ON_CARD_ADDED_TO_HAND`, Such-Sperren) MIT dem ueblichen Aufdecken: nach jedem
//    Flug bestaetigt der GEGNER die gesuchte Karte (`deckSearchReveal`, Als Vorgabe
//    10.10. „wie bei anderen Searches"). Krates & Co. greifen nur bei
//    Ein-Karten-Suchen (`_noKrates`). Nicht gemischt: der Text nennt kein Mischen.
//  · Das BILD der Karte links neben dem Brett sehen BEIDE Spieler (Als Vorgabe
//    10.10.): der Gegner ueber den Standardweg des aktiven Einsatzes, der Aktivierende
//    ueber einen eigenen `card_reveal` an ihn (Regel 12.9 haelt ihn sonst heraus).
//  · Such-Sperren (`handLocked`, Hand-/Deck-Sperre): ist das Hinzufuegen gesperrt,
//    ist die Karte nicht aktivierbar.
// ═══════════════════════════════════════════

const RB = require('./_race-boat-shared');
const { isPileCreature, baseCardName } = require('./_hooks');

const CARD_NAME = 'Snake Race Boat';

/** Verschiedene Creature-Namen im Deck (Basisnamen) → [{ name, source: 'deck', count }]. */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps?.mainDeck?.length) return [];
  const db = engine._getCardDB();
  const zaehler = new Map();                 // Basisname → { name, count }
  for (const name of ps.mainDeck) {
    const cd = db[name];
    if (!cd || !isPileCreature(cd)) continue;
    const key = baseCardName(name);
    const e = zaehler.get(key);
    if (e) e.count++; else zaehler.set(key, { name, source: 'deck', count: 1 });
  }
  return [...zaehler.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  activeIn: ['support'],
  equipEffect: true,

  /** „A Hero can only have 1 "Race Boat" Artifact equipped to it." */
  canEquipToHero: RB.canEquipToHero,

  /**
   * Aktivierbar nur, wenn der Held mindestens eine Creature traegt UND das Deck mindestens so viele VERSCHIEDENE
   * Creature-Namen hat — exakt, nicht „up to".
   */
  canActivateEquipEffect(ctx) {
    const t = RB.traeger(ctx);
    if (!t) return false;
    const engine = ctx._engine;
    const n = RB.kreaturenAmHeld(engine, t.seite, t.heroIdx);
    if (n < 1) return false;
    if (engine._isSearchBlocked(t.kontrolleur, {}, 'deck')) return false;
    return kandidaten(engine, t.kontrolleur).length >= n;
  },

  async onEquipEffect(ctx) {
    const t = RB.traeger(ctx);
    if (!t) return false;
    const engine = ctx._engine;
    const pi = t.kontrolleur;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const n = RB.kreaturenAmHeld(engine, t.seite, t.heroIdx);
    const cands = kandidaten(engine, pi);
    if (n < 1 || cands.length < n) return false;     // Lage hat sich seit dem Klick geaendert

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      searchToHand: true,
      cards: cands,
      selectCount: n,
      minSelect: n,                                  // EXAKT so viele
      title: CARD_NAME,
      description: `Choose exactly ${n} Creature${n > 1 ? 's' : ''} with different names from your deck (one per Creature in ${t.hero.name}'s Support Zones) — reveal ${n > 1 ? 'them' : 'it'} and add ${n > 1 ? 'them' : 'it'} to your hand.`,
      confirmLabel: `🐍 Add ${n}!`,
      confirmClass: 'btn-success',
      cancellable: true,
    });
    // Abbrechen verbraucht nichts.
    if (!wahl || wahl.cancelled || !Array.isArray(wahl.selectedCards)) return false;

    // Nur Namen aus dem Kandidatensatz, jeder Basisname einmal — und EXAKT n davon.
    const erlaubt = new Map(cands.map(c => [baseCardName(c.name), c.name]));
    const gewaehlt = [];
    const gesehen = new Set();
    for (const roh of wahl.selectedCards) {
      const key = baseCardName(roh);
      if (!erlaubt.has(key) || gesehen.has(key)) continue;
      gesehen.add(key);
      gewaehlt.push(roh);
    }
    if (gewaehlt.length !== n) return false;

    // Das Bild der Karte links neben dem Brett — Als Vorgabe 10.10.: an BEIDE Spieler. Der Gegner bekommt es ueber den
    // ueblichen Weg des aktiven Einsatzes (`_pendingCardReveal`, feuert mit der bestaetigten Galerie); der AKTIVIERENDE
    // sieht es hier zusaetzlich (sonst bekaeme er nach Regel 12.9 kein Bild seines eigenen Einsatzes).
    engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi }, { toPlayers: [pi] });

    // Je Karte einzeln, wie jede Deck-Suche: Flug Deck → Hand, dann bestaetigt der GEGNER, was gesucht wurde
    // (`deckSearchReveal`, Standard von `actionAddCardFromDeckToHand` — `reveal` bleibt AN).
    const hinzu = [];
    for (const name of gewaehlt) {
      // Der Eintrag im Deck heisst evtl. anders als der Basisname („[B]"-Fassung): den echten Namen nehmen.
      const echt = ps.mainDeck.find(x => baseCardName(x) === baseCardName(name));
      if (!echt) continue;
      const ok = await engine.actionAddCardFromDeckToHand(pi, echt, {
        source: CARD_NAME, _noKrates: true, revealDelayMs: 350,
      });
      if (!ok) continue;
      hinzu.push(echt);
      engine.noteKnownCard(engine.opponentOf(pi), echt, 'deck');
      engine.noteKnownCard(engine.opponentOf(pi), echt, 'hand');
    }
    engine.log('snake_race_boat', { player: ps.username, hero: t.hero.name, creatures: n, added: hinzu });
    engine.sync();
    return true;
  },

  _test: { kandidaten },
};
