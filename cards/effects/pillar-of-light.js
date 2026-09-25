// ═══════════════════════════════════════════
//  CARD EFFECT: „Pillar of Light"
//  Spell (Magic Arts Lv 1, PP DD)
//
//  „Declare a card name. Your opponent must search their deck for a
//   card with that name and add it to their hand, if possible. If they
//   find a card with the declared name, this counts as an additional
//   Action and you may draw a card. You can only play 1 \"Pillar of
//   Light\" per turn."
//
//  BAUART
//  ──────
//  • Namensansage ueber `cardNamePicker` — derselbe Waehler wie bei
//    Accusation und Luck, mit der vollen Kartenliste ausser Tokens.
//    Abbruch meldet `gs._spellCancelled` (Fehlerklasse v981).
//
//  • ★ DIE ZUSATZAKTION IST BEDINGT (Als Vorgabe 12.9.) — und zwar in
//    zwei Stufen:
//
//    1. SPIELBARKEIT: Die Karte ist NUR dann eine Zusatzaktion, wenn
//       danach noch eine REGULAERE Aktion zur Verfuegung steht. Sonst
//       gibt `inherentAction` false zurueck — und weil eine Zusatz-
//       aktion ohne kommende Aktion nichts zu verrechnen haette, ist
//       die Karte dann gar nicht spielbar (`spellPlayCondition`).
//       Als „verfuegbar\" zaehlt: die Aktion der Action Phase, solange
//       sie offen ist, und ein EINLOESBARER Zweitaktions-Zuschlag
//       (Zhigao, Torchure, Duigno).
//
//    2. AUFLOESUNG: Findet der Gegner die Karte, BLEIBT es eine
//       Zusatzaktion — die kommende Aktion ist unangetastet. Findet er
//       nichts, wird sie NACHTRAEGLICH verbraucht: der Held gilt als
//       gehandelt, der Phasenzaehler steigt, und in der Action Phase
//       geht es weiter.
//
//  • ★ DER VERBRAUCH LAEUFT NACH DER AUFLOESUNG (v1003): `advanceToPhase`
//    weist jeden Wechsel ab, solange `_spellResolutionDepth > 0`. Die
//    Karte setzt darum nur `gs._pendingActionBurn`; der Spielweg ruft
//    danach `engine.burnUpcomingAction`. Das springt aus einer MAIN
//    PHASE 1 zuerst in die Action Phase — dort liegt die Aktion, und
//    der Wechsel faehrt `onPhaseStart`, woran die Zweitaktions-
//    Zuschlaege haengen (Zhigao).
//
//  • ★ WOHIN ES DANACH GEHT, entscheidet `advanceToPhase(pi, 4)` von
//    selbst: der Riegel dort haelt den Spieler in der Action Phase,
//    wenn ein einloesbarer Zweitaktions-Zuschlag offen ist, und laesst
//    ihn sonst in die Main Phase 2. Genau die zwei Faelle, die Al
//    beschreibt — kein eigener Nachbau noetig.
//
//  • „if possible\": findet sich die Karte nicht im Deck, passiert
//    beim Gegner nichts. Gesucht wird mit `baseCardName` (v875), damit
//    Farbvarianten mitzaehlen.
//
//  • „You can only play 1 per turn\": HOPT-Schluessel je Spieler,
//    gesetzt beim Aufloesen, geprueft in `spellPlayCondition`.
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Pillar of Light';
const HOPT_KEY = 'pillar-of-light';
const MAIN1 = 2;
const AKTIONSPHASE = 3;
const MAIN2 = 4;

/** Steht ein EINLOESBARER Zweitaktions-Zuschlag offen? */
function zweiteAktionOffen(engine, pi) {
  return engine.cardInstances.some(c => {
    if (c.owner !== pi || !c.counters?.additionalActionAvail) return false;
    const cfg = engine._additionalActionTypes?.[c.counters.additionalActionType];
    if (!cfg?.isSecondActionGrant) return false;
    return engine._isSecondActionGrantAvailable(pi, cfg);
  });
}

/**
 * ★ Steht danach noch eine REGULAERE Aktion zur Verfuegung?
 * Main Phase 1: die Action Phase kommt noch, sofern in diesem Zug noch
 * nicht gehandelt wurde. Action Phase: die eigene Aktion, solange sie
 * offen ist — oder ein Zweitaktions-Zuschlag. Main Phase 2: nichts mehr.
 */
function regulaereAktionOffen(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps || !engine) return false;
  if (engine.areActionsBlocked?.(pi)) return false;
  const phase = gs.currentPhase;
  if (phase === 2) return (ps.heroesActedThisTurn || []).length === 0;
  if (phase === AKTIONSPHASE) {
    if ((ps._actionsPlayedThisPhase || 0) === 0) return true;
    return zweiteAktionOffen(engine, pi);
  }
  return false;
}

module.exports = {
  requiresTarget: false,

  // ★ Bedingte Zusatzaktion — s. Kopf, Stufe 1.
  inherentAction: (gs, pi, heroIdx, engine) => regulaereAktionOffen(gs, pi, engine),

  // Ohne kommende Aktion gaebe es nichts zu verrechnen: dann ist die
  // Karte gar nicht spielbar. Dazu die Einmal-je-Zug-Grenze.
  spellPlayCondition: (gs, pi, engine) => {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    return regulaereAktionOffen(gs, pi, engine);
  },

  // Abbrechbare Prompts bricht die Engine fuer die CPU pauschal ab
  // (Befund v828). Genannt wird die Karte, die im Gegnerdeck am
  // haeufigsten vorkommt — die groesste Trefferchance.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'cardNamePicker') {
      const gs = engine?.gs;
      const cpuIdx = gs?.players?.findIndex(p => p?.isCPU);
      const oi = cpuIdx === 0 ? 1 : 0;
      const deck = gs?.players?.[oi]?.mainDeck || [];
      if (deck.length === 0) return undefined;
      const zaehler = new Map();
      for (const n of deck) zaehler.set(n, (zaehler.get(n) || 0) + 1);
      let beste = null;
      for (const [n, k] of zaehler) if (!beste || k > beste.k) beste = { n, k };
      return beste ? { cardName: beste.n } : undefined;
    }
    if (promptData.type === 'confirm') return { confirmed: true };   // Karte ziehen
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) { gs._spellCancelled = true; return; }

      const cardDB = engine._getCardDB();
      const alleNamen = Object.keys(cardDB)
        .filter(n => cardDB[n] && cardDB[n].cardType !== 'Token')
        .sort((a, b) => a.localeCompare(b));

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardNamePicker',
        title: CARD_NAME,
        description: `Declare a card name. ${ops.username} must search their deck for it and add it to their hand.`,
        cardNames: alleNamen,
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName) { gs._spellCancelled = true; return; }
      const genannt = wahl.cardName;

      // Einmal je Zug — ab hier hat die Karte aufgeloest.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;

      // ── Der Gegner sucht ────────────────────────────────────────
      const trifft = (n) => baseCardName(n) === baseCardName(genannt);   // v875
      const idx = (ops.mainDeck || []).findIndex(trifft);
      const gefunden = idx >= 0;

      if (gefunden) {
        const name = ops.mainDeck[idx];
        engine._broadcastEvent('card_reveal', { cardName: name });
        if (await engine.takeFromPile(ops, 'deck', idx, { source: CARD_NAME, shuffle: true, toHand: true })) {
          engine._broadcastEvent('deck_search_add', { cardName: name, playerIdx: oi });
          await engine.handZugang(ops, name, { von: 'deck', source: CARD_NAME });
          engine.sync();
          await engine._delay(500);
        }
      }

      engine.log('pillar_of_light', {
        player: ps.username, opponent: ops.username,
        declared: genannt, found: gefunden ? 1 : 0,
      });

      if (gefunden) {
        // ── Treffer: bleibt eine Zusatzaktion, dazu der Zug ────────
        const ja = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: 'Draw a card?',
          showCard: CARD_NAME,
          confirmLabel: '🃏 Draw',
          cancelLabel: 'No',
          cancellable: true,
        });
        const bestaetigt = typeof engine._confirmSaidYes === 'function'
          ? engine._confirmSaidYes(ja) : !!(ja && !ja.cancelled);
        if (bestaetigt) await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
        engine.sync();
        return;
      }

      // ── Fehlschlag: die kommende Aktion wird NACHTRAEGLICH ──────
      // verbraucht. Der Spielweg hat die Karte als Zusatzaktion
      // behandelt (kein Zaehler, kein Phasenwechsel) — das wird hier
      // nachgeholt.
      // ★ NICHT HIER WECHSELN (v1003, Als Befund 12.9.): `advanceToPhase`
      // weist jeden Phasenwechsel ab, solange `_spellResolutionDepth > 0`
      // — und der laeuft waehrend dieses Hooks. Der Zauber hinterlaesst
      // deshalb nur die Marke; der Spielweg fuehrt sie aus, sobald die
      // Aufloesung durch ist (`burnUpcomingAction`: erst in die Action
      // Phase, dort die Aktion verbrauchen, dann weiter — wobei der
      // Riegel in `advanceToPhase` entscheidet, ob ein einloesbarer
      // Zweitaktions-Zuschlag den Spieler dort haelt).
      gs._pendingActionBurn = { pi, heroIdx: ctx.cardHeroIdx };
      engine.log('pillar_of_light_cost', { player: ps.username });
      engine.sync();
    },
  },
};
