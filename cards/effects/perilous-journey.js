// ═══════════════════════════════════════════
//  CARD EFFECT: "Perilous Journey"
//  Spell (Magic Arts, Lv 2) — Normal.
//
//  "Search your deck for an Ascended Hero, reveal it and add it to
//   your hand. During your next turn, you may Ascend an appropriate
//   Hero to that Ascended Hero, ignoring its Ascension condition, but
//   if you do, Burn all targets you control for the rest of the game.
//   That Burn cannot be healed."
//
//  ── ALS RULINGS (31.8.), BINDEND ──────────────────────────────────
//  ① Der Erlass darf KEINE Bedingungen umgehen, die nicht umgangen
//     werden koennen. Der Riegel sitzt in der ENGINE
//     (`isAscensionConditionUnskippable`, geprueft in Anzeige UND
//     Aufstiegsroute) — dieselbe Wahrheit, die Awakening und Throne
//     Robber lesen. Die SUCHE darf die sechs trotzdem holen: sie sind
//     dann ein reiner Tutor, der Erlass an ihnen ist wirkungslos.
//  ② „that Ascended Hero" = DIESE eine gesuchte Karte, KEINE Kopien.
//     Traeger ist das Handindex-Feld `_handAscensionGrants` (folgt der
//     physischen Kopie durch Splices/Umsortierungen, faellt mit ihr
//     aus der Hand); die Aufstiegsroute verbraucht exakt die
//     gestempelte Kopie und wechselt NIE still auf eine namensgleiche.
//
//  ── ZEITRECHNUNG ─────────────────────────────────────────────────
//  Gewirkt im eigenen Zug N, der Gegner spielt N+1 — „during your
//  next turn" ist Zug N+2, und nur solange `activePlayer` der
//  Besitzer ist. Stempelwert: `gs.turn + 2`.
//
//  ── DER PREIS ────────────────────────────────────────────────────
//  Wird der Erlass eingeloest, ruft die Engine nach vollzogenem
//  Aufstieg `onAscensionGrantUsed` — Dauerbrand (kein `duration`-Feld
//  = laeuft nie ab) mit `unhealable` auf ALLEN eigenen Zielen dieses
//  Moments, den frisch Aufgestiegenen eingeschlossen. Spaeter
//  beschworene Ziele sind NICHT betroffen — „Burn all targets you
//  control" ist eine einmalige Anwendung, „for the rest of the game"
//  beschreibt ihre Dauer. Bewusst KEIN eigener Zweig in der
//  Statusentfernung: `unhealable` ist der bestehende Vertrag, den
//  Cure & Co. zentral respektieren.
//
//  Steht der NORMALWEG offen (Bedingung erfuellt / ascensionReady),
//  nimmt die Engine ihn und der Preis bleibt aus — der Erlass ist
//  letzter Ausweg, niemand brennt freiwillig.
// ═══════════════════════════════════════════

const CARD_NAME = 'Perilous Journey';
const ERLASS_IN_ZUEGEN = 2;   // siehe Zeitrechnung

/** Alle unterschiedlichen Ascended-Hero-Namen im eigenen Deck. */
function ascendedImDeck(engine, pi) {
  const deck = engine.gs.players[pi]?.mainDeck || [];
  const cardDB = engine._getCardDB();
  const raus = [];
  const gesehen = new Set();
  for (const n of deck) {
    if (gesehen.has(n)) continue;
    gesehen.add(n);
    if (cardDB[n]?.cardType === 'Ascended Hero') raus.push(n);
  }
  return raus;
}

module.exports = {
  /** Spielbar nur mit mindestens einem Ascended Hero im Deck. */
  spellPlayCondition(gs, pi, engine) {
    return ascendedImDeck(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const kandidaten = ascendedImDeck(engine, pi);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }

      // ── ① Suche ──────────────────────────────────────────────────
      let gewaehlt = kandidaten[0];
      if (kandidaten.length > 1) {
        const res = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: kandidaten.map(n => ({ name: n, source: 'deck' })),
          title: CARD_NAME,
          description: 'Search your deck for an Ascended Hero to reveal and add to your hand.',
          confirmLabel: '🧭 Search!',
          cancellable: true,
        });
        if (!res || res.cancelled) { gs._spellCancelled = true; return; }
        if (typeof res.cardName === 'string' && kandidaten.includes(res.cardName)) {
          gewaehlt = res.cardName;
        }
      }

      // Aufdecken + Splice + Mischen + Handzugang — der Standardweg.
      const geholt = await engine.searchDeckForNamedCard(pi, gewaehlt, CARD_NAME, {});
      if (!geholt) {
        engine.log('perilous_journey_search_failed', { player: ps.username, card: gewaehlt });
        engine.sync();
        return;
      }

      // ── ② Stempel auf GENAU DIESE Kopie ──────────────────────────
      // `lastIndexOf`: die frisch zugefuegte Kopie liegt hinten. Der
      // Eintrag wandert mit ihr durch jede Handbewegung und faellt
      // mit ihr aus der Hand — Kopien desselben Namens bleiben leer
      // (Als Ruling ②).
      const idx = ps.hand.lastIndexOf(gewaehlt);
      if (idx >= 0) {
        if (!ps._handAscensionGrants) ps._handAscensionGrants = {};
        ps._handAscensionGrants[idx] = {
          turn: gs.turn + ERLASS_IN_ZUEGEN,
          byCard: CARD_NAME,
        };
      }

      engine.log('perilous_journey', {
        player: ps.username, card: gewaehlt,
        grantOnTurn: gs.turn + ERLASS_IN_ZUEGEN,
      });
      engine.sync();
    },
  },

  /**
   * Der Preis — von der Engine gerufen, NACHDEM der Erlass-Aufstieg
   * vollzogen ist: Dauerbrand auf allem, was der Spieler in diesem
   * Moment kontrolliert.
   */
  async onAscensionGrantUsed(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    let gebrannt = 0;
    // Helden (lebende — ein Besiegter traegt keine Statusse mehr).
    for (const hero of (ps.heroes || [])) {
      if (!hero?.name || hero.hp <= 0) continue;
      const ok = await engine.actionAddStatus(hero, 'burned', {
        source: CARD_NAME,
        unhealable: true,   // „That Burn cannot be healed."
        // KEIN duration-Feld: laeuft nie ab („for the rest of the game").
      });
      if (ok) gebrannt++;
    }
    // Kreaturen in den eigenen Support Zones.
    for (const inst of engine.cardInstances) {
      if (inst.owner !== pi || inst.zone !== 'support') continue;
      const cd = engine._getCardDB()[inst.name];
      if (!cd || !/creature/i.test(cd.cardType || '')) continue;
      const ok = await engine.applyCreatureStatus(inst, 'burned', {
        sourceOwner: pi, source: CARD_NAME,
      });
      if (ok) {
        // Kanonischer Weg, einen Kreaturen-Status unheilbar zu machen
        // (siehe Cold Coffin): die zentrale Statusentfernung prueft
        // `<key>Unhealable` am Zaehler.
        if (!inst.counters) inst.counters = {};
        inst.counters.burnedUnhealable = true;
        gebrannt++;
      }
    }

    engine.log('perilous_journey_price', {
      player: ps.username, burned: gebrannt,
    });
    engine.sync();
  },

  /** CPU: bevorzugt eine Form, die zu einem kontrollierten Helden
   *  passt (nur die kann der Erlass je einloesen); darunter die mit
   *  den meisten gedruckten HP. Sonst schlicht die dickste. */
  cpuResponse(engine, promptKind, promptData) {
    if (promptKind === 'generic'
        && promptData?.type === 'cardGallery'
        && promptData.title === CARD_NAME) {
      const namen = (promptData.cards || []).map(c => c?.name || c?.cardName).filter(Boolean);
      if (namen.length === 0) return null;
      const pi = typeof promptData.ownerIdx === 'number' ? promptData.ownerIdx : engine._cpuPlayerIdx;
      const cardDB = engine._getCardDB();
      const helden = engine.gs.players?.[pi]?.heroes || [];
      const passt = n => helden.some(h => h?.name && h.hp > 0
        && h.name !== n && engine.getAscendedFormsFor(h.name).includes(n));
      const hp = n => cardDB[n]?.hp || 0;
      const sortiert = namen.slice().sort((a, b) =>
        (passt(b) - passt(a)) || (hp(b) - hp(a)));
      return { cardName: sortiert[0], name: sortiert[0] };
    }
    return undefined;
  },
};
