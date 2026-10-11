'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Sky Shaman"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „You may once per turn choose a card from your deck and send it to your discard pile."
//
//  ── EFFEKT ──────────────────────────────────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion, keine Kosten): der Spieler sucht sich per
//  Galerie (alle verschiedenen Karten des Decks, mit Anzahl) EINE Karte aus und schickt sie direkt in die Ablage — wie The Eye of Ren /
//  Cute Nerd Magenta über `actionMillCards(pi, 1, { targetCardName, selfInflicted: true })`: Flug Deck → Ablage, Rettungsfenster
//  (Rebelliokai-Umleitung), `onMill`-Hooks, KEIN Abwurf (`onDiscard` feuert nicht) und KEIN Mischen. `selfInflicted`: sonst schützte der
//  Erstzug-Schutz das eigene Deck. Abbrechen in der Galerie verbraucht den Effekt nicht („you MAY").
//  Kein Aufdecken und keine Such-Sperre: die Karte geht nicht auf die Hand (wie The Eye of Ren). Ohne Karte im Deck nicht aktivierbar.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die Galerie beantwortet `cpuBesteMillKarte` (`_mill-pick-shared.js`, vorher in Cute Nerd Magenta): die Karte, deren Wechsel vom Deck in die
//  Ablage den Auswerter am meisten verbessert. Ohne Gewinn (Delta ≤ 0 gegenüber dem Auslassen) setzt die CPU den Effekt trotzdem ein —
//  er kostet nichts und die Karten des Decks sind ohnehin nur eine Reihenfolge.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `sky_shaman_chant` (Pixelart, Brett-Animation mit dem Schamanen als Ursprung und Ziel, Hülle `ppSalve`; Vorlage: das Kartenbild — der Schamane mit dem Federschmuck vor dem
//  blauen Himmel): Federn in Rot, Weiß und Türkis wirbeln in einer Spirale um die Karte nach oben, ein Runenring pulsiert, am Ende
//  verglühen sie in Funken; danach fliegt die gewählte Karte in die Ablage. Klänge in ZONE_ANIM_SFX; Log `sky_shaman`.
// ═══════════════════════════════════════════

const { cpuBesteMillKarte } = require('./_mill-pick-shared');

const CARD_NAME = 'Sky Shaman';
const CHANT_MS = 900;        // Länge der Beschwörung (deckt sich mit `sky_shaman_chant` im Client; +100 ms Einbau-Versatz)

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: () => true,

  /** Aktivierbar, solange das Deck nicht leer ist. */
  canActivateCreatureEffect(ctx) {
    return (ctx._engine.gs.players[ctx.cardOwner]?.mainDeck || []).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const ps = engine.gs.players[pi];
    if (!ps || (ps.mainDeck || []).length === 0) return false;

    // ① Wahl — jede verschiedene Karte des Decks, mit Anzahl.
    const zaehler = {};
    for (const n of ps.mainDeck) zaehler[n] = (zaehler[n] || 0) + 1;
    const galerie = Object.entries(zaehler).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'deck', count }));
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galerie,
      title: CARD_NAME,
      description: 'Choose a card from your deck to send to your discard pile.',
      confirmLabel: '🪶 Send it!',
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return false;      // „may": Abbruch verbraucht den Effekt nicht
    const name = wahl.cardName;
    if (!ps.mainDeck.includes(name)) return false;

    // ② Der Schamane singt, dann fliegt die Karte.
    engine._broadcastEvent('play_zone_animation', {
      type: 'sky_shaman_chant', zoneType: 'board', owner: inst.owner, heroIdx: -1, zoneSlot: -1, duration: CHANT_MS + 400,
      targets: [{ owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: CARD_NAME }],
      originOwner: inst.owner, originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
    });
    await engine._delay(CHANT_MS);
    const gemillt = await engine.actionMillCards(pi, 1, {
      targetCardName: name, holdDuration: 0, source: CARD_NAME, selfInflicted: true,
    });
    engine.log('sky_shaman', { player: ps.username, card: (gemillt && gemillt[0]) || name });
    engine.sync();
    return true;
  },

  /** CPU: die Galerie über den Auswerter (`_mill-pick-shared.js`). */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.type !== 'cardGallery' || payload?.title !== CARD_NAME) return undefined;
    return cpuBesteMillKarte(engine, payload, { source: CARD_NAME });
  },
};
