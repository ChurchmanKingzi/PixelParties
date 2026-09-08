// ═══════════════════════════════════════════
//  CARD EFFECT: "Koperniko, the Stargazer"
//  Hero
//
//  „Once per turn, when an Artifact or Spell allows you to add exactly
//   1 card from your deck to your hand, you may search your deck for an
//   additional card with a different name and the same specifications,
//   reveal it and also add it to your hand.\"   (Fassung Al 4.9.)
//
//  Wann?
//  ─────
//  „EXAKT 1 Karte\" laesst sich im Moment des Zugriffs nicht
//  beantworten — ob ein zweiter folgt, weiss man erst, wenn die Quelle
//  fertig ist. Koperniko haengt deshalb an `afterSpellResolved` und
//  `afterArtifactUsed` und liest dort die Strichliste, die
//  `actionAddCardFromDeckToHand` je Quelle fuehrt (v734). Steht dort
//  genau EIN Name, greift er; bei zwei oder mehr (Aurora Borealis,
//  Spider Dance) nicht.
//
//  Damit ist auch die Kartenart automatisch richtig: Kreatur-Effekte,
//  Helden-Effekte und Abilities laufen durch keinen dieser beiden
//  Hooks, nur Spells (inkl. Attacks) und Artifacts.
//
//  „same specifications\"
//  ─────────────────────
//  Die suchende Karte sagt selbst, was sie durfte — `searchSpec` an
//  `actionAddCardFromDeckToHand` (Vertrag v734, s. CARD_API):
//    • Cute Cheese  → `{ label: 'Creature', filter: … }` → Koperniko
//      darf ebenfalls nur eine Creature holen.
//    • Magnetic Glove → `{ label: 'card', filter: null }` → alles.
//  Deklariert eine aeltere Tutor-Karte noch nichts, faellt Koperniko
//  auf die KARTENART der eben geholten Karte zurueck. Das ist die
//  vorsichtige Annahme: nie grosszuegiger als das Original, und fuer
//  die typischen typgebundenen Tutoren genau richtig.
//
//  „different name\" gilt immer — auch bei unbeschraenkter Suche.
//
//  Abbruch bleibt spurlos: weder Kartenbild noch Rundensperre werden
//  angefasst, solange keine Karte gewaehlt wurde.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Koperniko, the Stargazer';
const HOPT_KEY = 'koperniko-stargazer';

/** Kartenart-Rueckfall fuer Tutoren ohne eigene `searchSpec`. */
function artFilter(cardDB, vorbildName) {
  const vorbild = cardDB[vorbildName];
  const art = vorbild?.cardType || null;
  if (!art) return { label: 'card', filter: null };
  return {
    label: art,
    filter: (cd) => hasCardType(cd, art),
  };
}

/**
 * Die Zusatzsuche. Gibt true zurueck, wenn tatsaechlich gesucht wurde
 * (nur dann ist die Rundensperre verbraucht).
 */
async function zusatzSuche(engine, pi, heroIdx, tally) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps || (ps.mainDeck || []).length === 0) return false;
  if (ps.handLocked) return false;

  const cardDB = engine._getCardDB();
  const schon = tally.names[0];
  const spec = tally.spec || artFilter(cardDB, schon);

  // Kandidaten: anderer Name, passende Spezifikation.
  const zaehler = {};
  for (const n of ps.mainDeck) {
    if (n === schon) continue;                          // „different name\"
    const cd = cardDB[n];
    if (!cd) continue;
    if (spec.filter && !spec.filter(cd, n)) continue;
    zaehler[n] = (zaehler[n] || 0) + 1;
  }
  const galerie = Object.entries(zaehler)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'deck', count }));
  if (galerie.length === 0) return false;

  const heldName = gs.players[pi]?.heroes?.[heroIdx]?.name || CARD_NAME;
  const wahl = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: galerie,
    title: CARD_NAME,
    description: `${heldName} reads the stars: you may add a second ${spec.label} with a different name from your deck.`,
    confirmLabel: '🔭 Add it!',
    cancellable: true,
    gerrymanderEligible: true,          // echtes „you may\"
  });
  const gewaehlt = wahl?.cardName;
  if (!gewaehlt || wahl?.cancelled) return false;
  if ((ps.mainDeck || []).indexOf(gewaehlt) < 0) return false;

  // ERST JETZT das Kartenbild einblenden (Als Befund 5.9.): das
  // Angebot ist ein echtes „you may", und ein Abbruch soll spurlos
  // bleiben. Vorher lief `showTriggeredEffect` vor der Galerie — wer
  // abbrach, hatte Kopernikos Auftritt gesehen, ohne dass etwas
  // geschah. Die Rundensperre haengt aus demselben Grund am
  // Rueckgabewert dieser Funktion.
  await engine.showTriggeredEffect(CARD_NAME);

  await engine.actionAddCardFromDeckToHand(pi, gewaehlt, {
    source: CARD_NAME,
    reveal: true,                        // „reveal it\"
    shuffle: true,
  });
  return true;
}

/** Gemeinsamer Auswerter fuer beide Fenster. */
async function pruefeUndBiete(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;               // Besitzer DIESES Helden
  const heroIdx = ctx.cardHeroIdx;

  const held = gs.players[pi]?.heroes?.[heroIdx];
  if (!held?.name || held.hp <= 0) return;
  if (held.statuses?.negated) return;     // negierter Held wirkt nicht

  const tally = engine._deckAddTally;
  if (!tally || tally.pi !== pi) return;
  if (tally.names.length !== 1) { engine._deckAddTally = null; return; }
  // Die eigene Zusatzsuche darf sich nicht selbst ausloesen.
  if (tally.source === CARD_NAME) { engine._deckAddTally = null; return; }

  // Rundensperre erst pruefen, dann (bei Erfolg) verbrauchen.
  if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) { engine._deckAddTally = null; return; }

  const kopie = { ...tally };
  engine._deckAddTally = null;            // vor der Suche leeren
  // Auftritt UND Rundensperre haengen beide am Erfolg — s. `zusatzSuche`.
  const gesucht = await zusatzSuche(engine, pi, heroIdx, kopie);
  if (gesucht) engine.claimHOPT(HOPT_KEY, pi);
}

module.exports = {
  activeIn: ['hero'],

  cpuMeta: {
    // Reine Kartenwirtschaft, kein Schaden, kein Status.
    castTriggersDraw: true,
  },

  hooks: {
    afterSpellResolved: async (ctx) => { await pruefeUndBiete(ctx); },
    afterArtifactUsed: async (ctx) => { await pruefeUndBiete(ctx); },
  },
};
