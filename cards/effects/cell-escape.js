// ═══════════════════════════════════════════
//  CARD EFFECT: "Cell Escape"
//  Spell (Normal, Decay Magic + Magic Arts, Lv 2) — Karte aus Welle 78
//
//  „Draw 2 cards from your opponent's deck. Then, if at least 1 of your Heroes is Frozen or Stunned, draw 2 more cards from your opponent's deck. This counts
//   as an additional Action. You can only play 1 "Cell Escape" per game."
//
//  ── AUSLEGUNG ──────────────────────────────────────────────────────────
//  • „Draw N cards from your opponent's deck" ist ZIEHEN (nicht „add"): `zieheAusGegnerDeck` (`_opponent-deck-shared.js`, Vorbild Love Shot) nimmt die OBERSTEN Karten des
//    Gegnerdecks nacheinander auf die eigene Hand. Die Karten bleiben dem Gegner zugehörig (Herkunftsmarke `_handOriginals`: sie kehren bei Ablage/Löschen/Deck in SEINE Stapel
//    zurück), nur der Ziehende sieht sie fliegen (der Gegner sieht Kartenrücken). Das Ziehen läuft durch dieselben Fenster wie jedes Ziehen — Hand-/Zieh-Sperre, Tuscan Artist
//    (Ruling 16.8.: „auch ein Zug aus dem GEGNERISCHEN Deck zählt — Cell Escape"), Intrude, Cybug Centipede, `onDraw` (Melissa, Dirty Smuggler, Analyzer …) und
//    `onCardTakenFromOpponent` (Lilly) je Karte. Weil „draw" kein „add" ist, löst es NICHT Control Monitors aus (Kopfkommentar dort: Ziehen und fremde Stapel zählen nicht).
//  • Zwei getrennte Zieh-Anweisungen („Draw 2 … Then … draw 2 more") sind zwei Ziehvorgänge zu je 2 Karten (je ein `_drawBatch`; Tuscan Artist prüft jeden für sich: genau 2).
//  • BEDINGUNG „at least 1 of your Heroes is Frozen or Stunned": geprüft BEI AUFLÖSUNG, NACH den ersten 2 Karten (Hooks wie Lilly/Melissa-Antworten können dazwischen etwas ändern).
//    „your Heroes" = Kontrolle statt Brettseite (`heroesControlledBy`): eigene Helden ohne die abgegebenen, plus übernommene (auch temporär). Gezählt wird der Status (Chilly Dog ändert
//    daran nichts), nur lebende Helden (besiegte verlieren ihre Status ohnehin).
//  • Weniger als 2 (bzw. 4) Karten im Gegnerdeck: es werden so viele gezogen, wie da sind; der Zauber verbraucht sich trotzdem. Bei LEEREM Gegnerdeck ist er nicht spielbar
//    (kein Verbrauch ohne Wirkung, wie Infiltration).
//  • „This counts as an additional Action": `inherentAction: true` (Standardform wie Brainstorming).
//  • „You can only play 1 per game": `oncePerGame`/`oncePerGameKey` — die Engine prüft das Tor und stempelt (Negation der ganzen Karte erstattet, Fizzle/Teilnegierung verbraucht,
//    Abbruch nie; Z7b).
//  • Gesperrt (ausgegraut, ohne Kosten/Stempel), solange der Zug der einzige Nutzen ist und nicht stattfinden kann: Hand-Sperre, Zieh-Sperre (`blockedByHandLock`/`blockedByDrawLock`),
//    Tuscan Artist beim Gegner (beide Ziehvorgänge sind genau 2: `drawWouldBeBlocked`), Erste-Runden-Immunität des Gegners (`blockedByFirstTurnProtection`, Nicht-Schadens-Effekt,
//    Q66) und Boris (`stealsOpponentCards`: Karten, die dem Boris-Spieler gehören, würden auf die Hand kommen — wie Infiltration; Love Shot trägt das Flag nicht).
//  • Ziehen aus dem Gegnerdeck ist kein Suchen: die Such-Sperre gilt nicht. Es ist auch keine Hand-Interaktion („Ambush the Scout", Spreading Rumor).
//  • 2–4 Sitze: nur im Skill Test gibt es mehr als zwei Sitze — dort ist der Gegner `engine.opponentOf(pi)` (Fokus); die Karte ist `skilltestLegal: false`.
//
//  ── BILD UND KLANG ─────────────────────────────────────────────────────
//  Motiv: ein Gefangener (gefroren) in der Zelle im Lichtschein. `play_zone_animation` `cell_escape` (Pixelart, `ppSalve`, ANIM_REGISTRY in `app-board.jsx`) auf dem GEGNER-Deck:
//  Eisengitter fallen vor das Deck, ein schräger Lichtkegel fällt hinein (Staubkörner), die Stäbe schwingen hoch, während die Karten (`play_pile_transfer` Gegnerdeck → Hand) davonfliegen.
//  Zweiter Durchgang (`mode: 'more'`): Frostfunken auf den Stäben — der gefrorene/betäubte Held hat „aufgeschlossen". Klänge in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cell Escape';
const MENGE = 2;                 // „Draw 2" — und noch einmal 2
const VORLAUF_MS = 480;          // die Gitter fallen, bevor die erste Karte fliegt
const ANIM_MS = 1500;            // Länge von `cell_escape` im Client (ENDE)

const { zieheAusGegnerDeck } = require('./_opponent-deck-shared');
const { drawWouldBeBlocked } = require('./_draw-block-shared');
const { opponentOfGs } = require('./_opp');

/** „at least 1 of your Heroes is Frozen or Stunned" — Kontrolle statt Seite, nur lebende Helden. */
function gefrorenOderBetaeubt(engine, pi) {
  for (const { hero } of engine.heroesControlledBy(pi)) {
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return true;
  }
  return false;
}

/** Ein Ziehvorgang „Draw 2 cards from your opponent's deck" mit seinem Bild. */
async function ziehe(engine, pi, oi, modus) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'cell_escape', zoneType: 'board', owner: oi, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS, mode: modus,
    targets: [{ owner: oi, deck: true }],
    originOwner: oi, originDeck: true,
  });
  await engine._delay(VORLAUF_MS);
  return zieheAusGegnerDeck(engine, pi, MENGE, { source: CARD_NAME });
}

module.exports = {
  // „You can only play 1 "Cell Escape" per game."
  oncePerGame: true,
  oncePerGameKey: 'cellEscape',

  // „This counts as an additional Action."
  inherentAction: true,

  // Der Zug ist der einzige Nutzen (Praezedenz Haste): unter Hand-/Zieh-Sperre gar nicht spielbar.
  blockedByHandLock: true,
  blockedByDrawLock: true,
  // Nicht-Schadens-Effekt gegen den Gegner (Deck-Zug): unspielbar gegen die Erste-Runden-Immunitaet (Welle 11, Q66).
  blockedByFirstTurnProtection: true,
  // Boris: „cannot add any cards originally owned by you to their hand" — die gezogenen Karten gehoeren dem Gegner.
  stealsOpponentCards: true,

  /** Ohne Karte im Gegnerdeck gaebe es keine Wirkung — nicht spielbar, der Einmal-Slot bleibt frei. */
  spellPlayCondition(gs, pi) {
    return (gs.players[opponentOfGs(gs, pi)]?.mainDeck || []).length > 0;
  },

  /** Tuscan Artist (Ruling 16.8.): beide Ziehvorgaenge sind genau 2 Karten — der ganze Zauber wuerde ins Leere laufen. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    return !drawWouldBeBlocked(engine, pi, MENGE);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      if (!ps || !gs.players[oi]) return;

      // Der Zauber verlässt die Hand JETZT in die Ablage (Bauform Shooting Star / Live Show): sonst liegt er während der Flüge noch in der Hand, und beim Abgang
      // rückt die Hand zusammen — die Landeplätze der gezogenen Karten würden springen.
      const weg = await engine.aufloesenderSpellInDieAblage(pi);
      if (weg) await engine._delay(150);

      const erste = await ziehe(engine, pi, oi, 'first');

      // „Then, if at least 1 of your Heroes is Frozen or Stunned" — jetzt geprüft, nicht beim Ausspielen.
      const bonus = gefrorenOderBetaeubt(engine, pi);
      const zweite = bonus ? await ziehe(engine, pi, oi, 'more') : [];

      engine.log('cell_escape', { player: ps.username, opponent: gs.players[oi].username, drawn: erste.length + zweite.length, bonus });
      engine.sync();
    },
  },
};
