'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Time Tyrant"
//  Creature (Normal, Lv0, 70 HP, Summoning Magic)
//
//  „You may once per turn reveal the top card of your deck and then shuffle it back into your deck. If it was an Attack or Spell, draw cards equal to its level
//   afterwards."
//
//  ── LEVEL ───────────────────────────────────────────────────────────────
//  Jetzt Lv 0 (vorher Lv 2): Datenänderung in `data/cards.json`, kein Skripteingriff.
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion, keine Kosten), Vorlage: The Oracle of Heaven.
//    ① Aufdecken: die oberste Karte fliegt in die Bildmitte, wird umgedreht (beide Spieler sehen sie) und zurück ins Deck gelegt (`decke`, Ziel `deck`). Aufdecken ist keine
//       Suche (keine Such-Sperre).
//    ② „shuffle it back into your deck": das GANZE Deck wird gemischt (`shuffleDeck`), die aufgedeckte Karte ist danach nicht mehr oben.
//    ③ „If it was an Attack or Spell, draw cards equal to its level afterwards": war die Karte ein Attack oder ein Spell (auch Hybridkarten mit diesem Typ), zieht der Kontrolleur
//       so viele Karten, wie ihr aufgedruckter Level angibt (Lv0 = keine; Stufen über den Kartenvorrat hinaus ziehen, was da ist). Andere Typen: nichts weiter.
//  Ohne Karte im Deck nicht aktivierbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Die Zeit-Uhr `time_distortion` (Pixelart, ANIM_REGISTRY — gleiche Grafik wie bei Time Distortion) läuft AUF DEM DECK, danach das Aufdecken. Logs `time_tyrant`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Keine Entscheidung: die CPU aktiviert die Fähigkeit, sobald sie möglich ist.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { oberste, decke } = require('./_deck-top-shared');

const CARD_NAME = 'Time Tyrant';
const UHR_MS = 900;       // Länge der Uhr-Animation (`time_distortion` im Client)
const UHR_VOR_MS = 650;   // bis die Uhr aufbricht, dann das Aufdecken

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: () => true,

  /** Aktivierbar, solange das Deck nicht leer ist. */
  canActivateCreatureEffect(ctx) {
    return !!oberste(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps || !oberste(engine, pi)) return false;

    // Die Uhr tickt über dem DECK.
    engine._broadcastEvent('play_zone_animation', {
      type: 'time_distortion', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: UHR_MS,
      targets: [{ owner: pi, deck: true }],
      originOwner: pi, originDeck: true,
    });
    await engine._delay(UHR_VOR_MS);

    // ① Aufdecken (die Karte fliegt in die Mitte und zurück ins Deck; der Zustand ändert sich nicht).
    const name = oberste(engine, pi);
    if (!name) return true;
    await decke(engine, pi, name, { source: CARD_NAME, dest: 'deck' });

    // ② Das ganze Deck mischen.
    engine.shuffleDeck(pi, 'main');

    // ③ Attack oder Spell → so viele Karten ziehen, wie der Level sagt.
    const cd = engine._getCardDB()[name];
    const zaehlt = !!cd && (hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'));
    const level = zaehlt ? (Number(cd.level) || 0) : 0;
    let gezogen = 0;
    if (level > 0) {
      const vorher = (ps.hand || []).length;
      await engine.actionDrawCards(pi, level, { source: CARD_NAME });
      gezogen = Math.max(0, (ps.hand || []).length - vorher);
    }
    engine.log('time_tyrant', { player: ps.username, revealed: name, level, drew: gezogen, counts: zaehlt });
    engine.sync();
    return true;
  },
};
