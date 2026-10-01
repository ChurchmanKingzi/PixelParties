// ═══════════════════════════════════════════
//  CARD EFFECT: "Kassaran, Seer of Everything"
//  Hero — passiver Effekt (NEUE FASSUNG, ersetzt den frueheren Zuruf-Effekt)
//
//  „At the start of the game, declare 3 card names. When you draw a card with
//   a declared name, you may reveal it and add a copy of it from your deck to
//   your hand. Cards added that way count as being part of your starting hand.
//   You may only add a card with the same name once per turn with this effect."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „At the start of the game": der Hook `onBeforeHandDraw` (vor dem Ziehen der
//    Starthaende — wie Bill; laeuft auch im Puzzle). Drei VERSCHIEDENE Namen,
//    Pflicht (`cardNamePicker`, je eine Abfrage, schon gewaehlte fallen weg).
//    Gespeichert am Helden: `hero._kassaranDeclared`.
//  • „When you draw a card with a declared name": jede Ziehung des Besitzers —
//    ueber `onDraw` (Zug, Effekte) UND ueber die Starthand (Startblatt-Fenster der
//    Engine, Haken `onStartingHandCardDrawn`: die Starthand ist ebenfalls
//    „gezogen"). Namensvergleich ueber `baseCardName`.
//  • „you may reveal it and add a copy of it": Ja/Nein (`confirm` mit Kartenbild),
//    die gezogene Karte wird dem Gegner als Bild gezeigt (`showTriggeredEffect`),
//    eine KOPIE aus dem Deck kommt auf die Hand (`actionAddCardFromDeckToHand`).
//    Gibt es keine Kopie im Deck, wird nichts angeboten.
//  • „count as being part of your starting hand": die hinzugefuegte Karte laeuft
//    durch `processStartingHandDraw` — im Startblatt-Fenster ueber die Warteschlange
//    der laufenden Auswertung (`ctx.counted`), sonst als eigener Aufruf.
//  • „once per turn with the same name": je Name und Zug (`baseCardName`) ein Mal;
//    ein Ablehnen verbraucht nichts.
// ═══════════════════════════════════════════

const CARD_NAME = 'Kassaran, Seer of Everything';
const ANZAHL = 3;
const { baseCardName } = require('./_hooks');

/** Der Held, dem dieser Hook gehoert (Brettseite), und seine Deklarationen. */
function deklariert(hero) {
  return Array.isArray(hero?._kassaranDeclared) ? hero._kassaranDeclared : [];
}

/**
 * Die Ziehung einer Karte bearbeiten: Angebot, Aufdecken, Kopie holen.
 * @returns {Promise<string|null>} Name der hinzugefuegten Karte oder null
 */
async function bearbeiteZug(ctx, kartenName) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  const hero = ctx.attachedHero || gs.players[ctx.cardHeroOwner ?? pi]?.heroes?.[ctx.cardHeroIdx];
  if (!ps || !hero?.name || hero.hp <= 0 || !kartenName) return null;
  const basis = baseCardName(kartenName);
  if (!deklariert(hero).some(n => baseCardName(n) === basis)) return null;

  // „once per turn with the same name"
  if (!hero._kassaranAdded || hero._kassaranAdded.turn !== gs.turn) hero._kassaranAdded = { turn: gs.turn, names: [] };
  if (hero._kassaranAdded.names.includes(basis)) return null;
  // Eine Kopie muss im Deck liegen.
  const kopie = (ps.mainDeck || []).find(n => baseCardName(n) === basis);
  if (!kopie) return null;

  const antwort = await engine.promptGeneric(pi, {
    type: 'confirm', title: CARD_NAME, showCard: kartenName,
    message: `You drew "${kartenName}" (declared). Reveal it and add a copy of it from your deck to your hand?`,
    confirmLabel: '🔮 Reveal & add!', cancelLabel: 'No', cancellable: true, _cpuAutoConfirm: true,
  });
  if (!antwort || antwort.cancelled || antwort.confirmed === false) return null;

  await engine.showTriggeredEffect(kartenName, { playerIdx: pi });
  const ok = await engine.actionAddCardFromDeckToHand(pi, kopie, { source: CARD_NAME, reveal: false });
  if (!ok) return null;
  engine.markLastStartingCounted(pi, 1);   // genau DIESE Kopie zaehlt als Starthand
  hero._kassaranAdded.names.push(basis);
  engine.log('kassaran_add', { player: ps.username, card: kartenName });
  engine.sync();
  return kopie;
}

module.exports = {
  activeIn: ['hero'],

  /** CPU: die drei haeufigsten Kartennamen des eigenen Decks ansagen, Angebote annehmen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm' && promptData.title === CARD_NAME) return true;
    if (promptData?.type === 'cardNamePicker' && promptData.title === CARD_NAME) {
      const pi = engine?._cpuPlayerIdx;
      const deck = engine?.gs?.players?.[pi]?.mainDeck || [];
      const zaehler = new Map();
      for (const n of deck) zaehler.set(n, (zaehler.get(n) || 0) + 1);
      const frei = new Set(promptData.cardNames || []);
      const beste = [...zaehler.entries()].filter(([n]) => frei.has(n)).sort((a, b) => b[1] - a[1])[0];
      return beste ? { cardName: beste[0] } : (promptData.cardNames?.[0] ? { cardName: promptData.cardNames[0] } : undefined);
    }
    return undefined;
  },

  hooks: {
    /** „At the start of the game, declare 3 card names." */
    onBeforeHandDraw: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const hero = ctx.attachedHero || gs.players[ctx.cardHeroOwner ?? pi]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name) return;
      if (deklariert(hero).length >= ANZAHL) return;   // z. B. im Puzzle vorgegeben

      const db = engine._getCardDB();
      const alle = Object.keys(db)
        .filter(n => db[n] && db[n].cardType !== 'Token')
        .sort((a, b) => a.localeCompare(b));
      const gewaehlt = [...deklariert(hero)];
      let versuche = 0;
      while (gewaehlt.length < ANZAHL) {
        const frei = alle.filter(n => !gewaehlt.some(g => baseCardName(g) === baseCardName(n)));
        const wahl = await engine.promptGeneric(pi, {
          type: 'cardNamePicker', title: CARD_NAME,
          description: `Declare card name ${gewaehlt.length + 1}/${ANZAHL}. When you draw a card with a declared name, you may reveal it and add a copy from your deck.`,
          cardNames: frei, cancellable: false,
        });
        const name = wahl?.cardName;
        // Nur ein NOCH NICHT angesagter Name zaehlt — sonst neu fragen (die drei muessen verschieden sein).
        if (!name || !frei.includes(name)) {
          if (++versuche > 25) { gewaehlt.push(frei[0]); versuche = 0; }
          continue;
        }
        gewaehlt.push(name);
      }
      hero._kassaranDeclared = gewaehlt;
      engine.log('kassaran_declare', { player: gs.players[pi]?.username, names: gewaehlt });
      engine.sync();
    },

    /** Zug- und Effekt-Ziehungen: die hinzugefuegte Karte zaehlt als Starthand. */
    onDraw: async (ctx) => {
      if (ctx.cardZone !== 'hero') return;
      const engine = ctx._engine;
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if ((engine._startingHandDepth || 0) > 0) return;       // Starthand-Ziehungen laufen im Fenster
      const hinzu = await bearbeiteZug(ctx, ctx.drawnCardName);
      if (hinzu) await engine.processStartingHandDraw(ctx.cardOwner, [hinzu], { window: 'kassaran' });
    },

    /** Starthand-Karten (Startblatt-Fenster der Engine). */
    onStartingHandCardDrawn: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const hinzu = await bearbeiteZug(ctx, ctx.drawnCardName);
      if (hinzu && Array.isArray(ctx.counted)) ctx.counted.push(hinzu);   // zaehlt als Starthand
    },
  },
};
