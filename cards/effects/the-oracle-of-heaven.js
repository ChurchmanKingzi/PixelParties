'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Oracle of Heaven"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „You may once per turn declare a card name and reveal the top card of your deck. If it is a card with the declared name, add it to your
//   hand and draw 2 cards. Otherwise, send it end the top 2 cards below it from your deck to your discard pile."
//
//  ── LEVEL UND WORTLAUT (Als Vorgabe 10.10.) ─────────────────────────────
//  Jetzt Lv 0 (vorher höher) und mit ganz neuem Effekt. Datenänderung in `data/cards.json`. Das „end" im Kartentext der Vorgabe ist ein Tippfehler für
//  „and" (Annahme): Die aufgedeckte Karte UND die zwei Karten darunter — insgesamt bis zu DREI Karten — gehen aus dem Deck in die Ablage.
//
//  ── EFFEKT ──────────────────────────────────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion, keine Kosten), Vorlage: Heart of Cards.
//    ① Ansage („declare a card name"): Namenswahl (`cardNamePicker`, alle Karten ohne Token), abbrechbar — Abbruch verbraucht nichts („you MAY"). Die Ansage wird dem
//       GEGNER als Kartenbild gezeigt (`card_reveal`, nur an ihn), damit er sieht, was gerade geschieht.
//    ② „reveal the top card": die oberste Karte fliegt in die Bildmitte und wird dort umgedreht (beide Spieler sehen sie). Treffer = Namensgleichheit über
//       `baseCardName` (die [B]/[W]-Hinweise sind kein Teil des Namens).
//    ③ Treffer („add it to your hand and draw 2 cards"): die Karte fliegt in die Hand, danach werden 2 Karten gezogen.
//       Fehlschlag („send it and the top 2 cards below it … to your discard pile"): die aufgedeckte Karte und die beiden darunter werden NACHEINANDER in der Mitte gezeigt
//       und gehen in die Ablage — ein MILL (`actionMillCards`, `selfInflicted`): Rettungsfenster der Rebelliokai-Umleitung, `onMill`-Hooks, KEIN Abwurf
//       (`onDiscard` feuert nicht) und KEIN Mischen. Hat das Deck weniger als drei Karten, geht, was da ist.
//  Aufdecken ist keine Suche (keine Such-Sperre auf dem Weg ins Deck: es wird nichts durchsucht). Ohne Karte im Deck nicht aktivierbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `oracle_vision` (Pixelart, Hülle `ppSalve`; Vorlage: das Kartenbild — die Orakelfigur im dunklen Gewand mit dem violetten Kristall, vier steinerne Wächter
//  mit gelben, grünen, roten und blauen Augen) läuft AUF DEM DECK: die vier Augenpaare erwachen nacheinander, ein violetter Kristall steigt auf und pulsiert, bleiche Lichtstrahlen
//  fallen herab. Klänge in ZONE_ANIM_SFX; Logs `oracle_declare`, `oracle_reveal`, `oracle_of_heaven`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU sagt die häufigste Karte ihres Decks an (beste Trefferchance), wie bei Heart of Cards.
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');
const { oberste } = require('./_deck-top-shared');

const CARD_NAME = 'The Oracle of Heaven';
const VISION_MS = 800;       // Länge der Vision bis zum Aufdecken (deckt sich mit `oracle_vision` im Client; +100 ms Einbau-Versatz)
const SCHAU_MS = 1100;       // Deck → Mitte → Umdrehen → Hand (wie `MILL_CENTER_REVEAL_MS`)
const MILL_ANZAHL = 3;       // die aufgedeckte Karte + die zwei darunter
const MILL_PRO_KARTE_MS = 800;

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
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oi = engine.opponentOf(pi);
    if (!ps || !oberste(engine, pi)) return false;

    // ① Ansage — abbrechbar, dann ist nichts verbraucht.
    const db = engine._getCardDB();
    const alleNamen = Object.keys(db)
      .filter(n => db[n] && db[n].cardType !== 'Token')
      .sort((a, b) => a.localeCompare(b));
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: CARD_NAME,
      description: 'Declare a card name. The top card of your deck is revealed — if it has the declared name, add it to your hand and draw 2 cards. Otherwise it and the top 2 cards below it are sent to your discard pile.',
      cardNames: alleNamen,
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return false;
    const genannt = wahl.cardName;

    // Die angesagte Karte als BILD an den Gegner streamen.
    engine._broadcastEvent('card_reveal', { cardName: genannt }, { toPlayers: [oi] });
    engine.log('oracle_declare', { player: ps.username, declared: genannt });

    // Die Vision läuft über dem DECK.
    engine._broadcastEvent('play_zone_animation', {
      type: 'oracle_vision', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: VISION_MS + 500,
      targets: [{ owner: pi, deck: true }],
      originOwner: pi, originDeck: true,
    });
    await engine._delay(VISION_MS);

    // ② Aufdecken. (Das Deck kann sich während der Vision nicht geändert haben, aber sicher ist sicher.)
    const oben = oberste(engine, pi);
    if (!oben) return true;
    const treffer = baseCardName(oben) === baseCardName(genannt);
    engine.log('oracle_reveal', { player: ps.username, declared: genannt, revealed: oben, hit: treffer });
    engine.meldeAufgedeckt(pi, [oben], { zone: 'deck', source: CARD_NAME });   // W85b: aufgedeckt → Atta (Treffer: liegt danach auf der Hand; Fehlschlag: schon in der Ablage)

    // ③ Treffer: in die Hand, 2 ziehen — Fehlschlag: die Karte und die zwei darunter in die Ablage.
    let gemillt = [];
    if (treffer) {
      engine._broadcastEvent('mill_center_reveal', { owner: pi, cardNames: [oben], dest: 'hand', revealMs: SCHAU_MS });
      await engine._delay(SCHAU_MS);
      await engine.actionAddCardFromDeckToHand(pi, oben, { source: CARD_NAME, reveal: false, _skipFlight: true });
      engine.sync();
      await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
    } else {
      gemillt = await engine.actionMillCards(pi, MILL_ANZAHL, {
        source: CARD_NAME, selfInflicted: true, centerReveal: true, centerRevealMs: MILL_PRO_KARTE_MS,
      });
    }
    engine.log('oracle_of_heaven', { player: ps.username, declared: genannt, revealed: oben, hit: treffer, milled: gemillt });
    engine.sync();
    return true;
  },

  /** CPU: die häufigste Karte im eigenen Deck ansagen (beste Trefferchance). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'cardNamePicker') return undefined;
    const pi = engine?._cpuPlayerIdx;
    const deck = engine?.gs?.players?.[pi]?.mainDeck || [];
    if (deck.length === 0) return undefined;
    const zaehler = new Map();
    for (const n of deck) zaehler.set(n, (zaehler.get(n) || 0) + 1);
    let beste = null;
    for (const [n, k] of zaehler) if (!beste || k > beste.k) beste = { n, k };
    return beste ? { cardName: beste.n } : undefined;
  },
};
