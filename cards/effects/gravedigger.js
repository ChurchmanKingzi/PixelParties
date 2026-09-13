// ═══════════════════════════════════════════
//  CARD EFFECT: „Gravedigger"
//  Creature (Summoning Magic Lv 0, 20 HP, PP SOD)
//
//  „When you summon this Creature, your opponent must send the top 3
//   cards from their deck to the discard pile OR delete 8 cards from
//   their discard pile (their choice).
//   You may once per turn send the top card of your opponent's deck to
//   the discard pile."
//
//  (Level von 1 auf 0 gesenkt — Als Anpassung 12.9., in cards.json.)
//
//  BAUART
//  ──────
//  • TEIL 1 haengt an `onPlay` mit Selbsttest, Zonenpruefung und dem
//    `isPlacement`-Riegel: PLATZIEREN ist keine BESCHWOERUNG (Muster
//    Knight of Kings, Wire Hatchling).
//
//  • ★ DER GEGNER WAEHLT („their choice"), also laeuft der Picker bei
//    IHM — im fremden Zug. Deshalb `beginHumanWait`/`endHumanWait` um
//    die Abfrage: seine Bedenkzeit darf nicht gegen die Zug-Uhr des
//    Ausspielenden laufen.
//
//  • ★ „delete 8 cards" IST EINE ZAHL, KEINE GESTE: liegen weniger als
//    8 Karten in seiner Ablage, kann er den Weg gar nicht gehen — dann
//    wird er nicht angeboten, und der Mill passiert ohne Rueckfrage.
//    WELCHE acht, sagt der Text nicht; weil die Wahl den Wert stark
//    aendert, waehlt der Gegner sie selbst (Mehrfach-Galerie mit
//    `selectCount: 8`, nicht abbrechbar — die Entscheidung fuer diesen
//    Weg ist schon gefallen).
//
//  • Geloescht wird ueber den kanonischen Dreischritt (Muster
//    `_rebelliokai-shared`): erst aus der Ablage nehmen (Stapel-
//    Schicht `takeFromPileSync`), dann `discard_to_deleted_animation`
//    senden, nach dem Flug in den Geloescht-Stapel legen. Alle acht in
//    EINEM Broadcast, damit der Client sie gestaffelt fliegen laesst.
//
//  • TEIL 2 ist ein aktiver Kreatureffekt (`creatureEffect`): „You may
//    once per turn" — die Einmal-je-Zug-Sperre stempelt die Engine
//    selbst, wie bei jedem Kreatureffekt.
//
//  • Beide Mills laufen ueber `actionMillCards`, das die Deck-Sperre
//    (`pileOutAllowed`) und die Mitten-Aufdeckung mitbringt.
//
//  • ★ CPU-ENTSCHEIDUNG (Als Vorgaben 12.9.) — s. `gravediggerWeg`:
//    Deck gefaehrlich klein → nie millen; Deck lebt aus der Ablage →
//    fast immer millen; acht wertlose Karten da → loeschen. Der Wert
//    einer Ablagekarte kommt aus dem neuen Lernkanal
//    `deckProfile.discardCardValue`, und die Entscheidung selbst kann
//    das Profil ueber `discardVsMillRules` uebersteuern.
// ═══════════════════════════════════════════

const deckProfile = require('./_deck-profile');

const CARD_NAME = 'Gravedigger';
const MILL_BEI_BESCHWOERUNG = 3;
const LOESCHEN = 8;

/** Kanonischer Weg Ablage → Geloescht fuer mehrere Karten auf einmal. */
async function loescheAusAblage(engine, pi, namen, quelle) {
  const ps = engine.gs.players[pi];
  if (!ps || namen.length === 0) return 0;
  let raus = 0;
  for (const name of namen) {
    const idx = (ps.discardPile || []).indexOf(name);
    if (idx < 0) continue;
    const orphan = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'discard' && c.name === name);
    if (orphan) engine._untrackCard(orphan.id);
    if (!engine.takeFromPileSync(ps, 'discard', idx, { source: quelle })) continue;
    raus++;
  }
  if (raus === 0) return 0;
  engine.sync();
  engine._broadcastEvent('discard_to_deleted_animation', {
    owner: pi, cardNames: namen.slice(0, raus), source: quelle,
  });
  await engine._delay(560);
  for (const name of namen.slice(0, raus)) ps.deletedPile.push(name);
  engine.sync();
  return raus;
}

/**
 * ★ „Millen oder loeschen?" — Als drei Regeln (12.9.), plus Lernkanal.
 * Gibt 'mill' oder 'delete' zurueck und legt die Lage-Tags fuer das
 * Training auf `engine._discardChoiceLog`.
 */
function gravediggerWeg(engine, pi) {
  const tags = [];
  let weg = 'mill';
  try {
    const ps = engine.gs.players[pi];
    const ablage = ps?.discardPile || [];
    const werte = ablage.map(n => {
      try { return deckProfile.discardCardValue(engine, pi, n); } catch { return 0; }
    });
    const wertlos = werte.filter(v => v <= 1).length;
    const gesamtWert = werte.reduce((a, b) => a + b, 0);
    const zuegeUebrig = deckProfile.deckTurnsLeft(engine, pi);
    const gefahr = deckProfile.deckoutDangerSizeOf(engine, pi);
    const deckKlein = zuegeUebrig <= 4
      || (typeof gefahr === 'number' && (ps?.mainDeck || []).length <= gefahr);

    if (deckKlein) tags.push('deckLow');
    if (gesamtWert >= 15) tags.push('discardFuelled');
    if (wertlos >= LOESCHEN) tags.push('ballastEight');
    tags.push(zuegeUebrig <= 6 ? 'turnsLeftShort' : 'turnsLeftLong');

    // Regel 1 sticht: ein leeres Deck verliert die Partie.
    if (deckKlein) weg = 'delete';
    // Regel 2: die Ablage ist Treibstoff — Deck opfern, Ablage fuettern.
    else if (gesamtWert >= 15) weg = 'mill';
    // Regel 3: genug Ballast da — der kostet nichts.
    else if (wertlos >= LOESCHEN) weg = 'delete';

    const gelernt = deckProfile.discardVsMillDecision(engine, pi, tags);
    if (gelernt === 'delete' || gelernt === 'mill') weg = gelernt;

    // Der Loeschweg geht nur mit genug Karten.
    if (weg === 'delete' && ablage.length < LOESCHEN) weg = 'mill';

    if (!engine._discardChoiceLog) engine._discardChoiceLog = [];
    engine._discardChoiceLog.push({ pi, t: engine.gs?.turn || 0, mode: weg, tags });
  } catch { /* defensiv — im Zweifel millen */ }
  return weg;
}

module.exports = {
  creatureEffect: true,

  // ═══ CPU-ENTSCHEIDUNG (v987, Als Vorgaben 12.9.) ═══════════════════
  // Drei Regeln, in dieser Reihenfolge:
  //   1. Wird das eigene DECK gefaehrlich klein — gemessen daran, wie
  //      viele Karten es pro Zug im Schnitt verlassen —, dann NIE
  //      millen, solange der andere Weg offensteht.
  //   2. Lebt das Deck aus der Ablage (gelernter Discard-Wert hoch),
  //      dann fast immer millen: die Ablage ist Treibstoff, das Deck
  //      ist Nachschub.
  //   3. Gibt es acht Karten OHNE nennenswerten Wert, immer loeschen —
  //      Ballast kostet nichts.
  // Darueber liegt der Lernkanal `discardVsMillDecision`: sobald das
  // Profil Regeln hat, entscheidet es; die Heuristik bleibt Rueckfall
  // und liefert im Training beide Arme.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;

    if (promptData.type === 'optionPicker') {
      const pi = promptData._forPlayer ?? engine?.gs?.players?.findIndex(p => p?.isCPU);
      const entscheidung = gravediggerWeg(engine, pi);
      return { optionId: entscheidung };
    }

    if (promptData.type === 'cardGalleryMulti') {
      // Geloescht wird das BILLIGSTE: nach gelerntem Discard-Wert
      // aufsteigend sortiert, die ersten acht.
      const pi = promptData._forPlayer ?? engine?.gs?.players?.findIndex(p => p?.isCPU);
      const karten = (promptData.cards || []).map(c => c.name);
      if (karten.length === 0) return undefined;
      const bewertet = karten.map(n => ({
        n, v: (() => { try { return deckProfile.discardCardValue(engine, pi, n); } catch { return 0; } })(),
      }));
      bewertet.sort((a, b) => a.v - b.v);
      return { selectedCards: bewertet.slice(0, LOESCHEN).map(x => x.n) };
    }
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (ctx.playedCard?.id !== ctx.card?.id || ctx.card.zone !== 'support') return;
      if (ctx.card.counters?.isPlacement) return;        // platziert ≠ beschworen

      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ops = gs.players[oi];
      if (!ops) return;

      const kannLoeschen = (ops.discardPile || []).length >= LOESCHEN;

      let weg = 'mill';
      if (kannLoeschen) {
        // ★ Der GEGNER entscheidet, und zwar in einem fremden Zug.
        engine.beginHumanWait?.();
        let wahl;
        try {
          wahl = await engine.promptGeneric(oi, {
            type: 'optionPicker',
            title: CARD_NAME,
            message: `${gs.players[pi]?.username} dug up your graveyard — choose your loss.`,
            showCard: CARD_NAME,
            options: [
              { id: 'mill', label: `⛏️ Mill the top ${MILL_BEI_BESCHWOERUNG} cards of your deck`, color: '#44cc66' },
              { id: 'delete', label: `🗑️ Delete ${LOESCHEN} cards from your discard pile`, color: '#e04040' },
            ],
            cancellable: false,
          });
        } finally {
          engine.endHumanWait?.();
        }
        if (wahl?.optionId === 'delete') weg = 'delete';
      }

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      if (weg === 'mill') {
        const gemillt = await engine.actionMillCards(oi, MILL_BEI_BESCHWOERUNG, {
          source: CARD_NAME, centerReveal: true,
        });
        engine.log('gravedigger_choice', {
          player: ops.username, mode: 'mill', count: (gemillt || []).length,
        });
        engine.sync();
        return;
      }

      // ── Acht Karten aus seiner Ablage, seine Wahl ─────────────────
      let namen = [];
      engine.beginHumanWait?.();
      try {
        const wahl = await engine.promptGeneric(oi, {
          type: 'cardGalleryMulti',
          cards: (ops.discardPile || []).map(n => ({ name: n, source: 'discard' })),
          title: CARD_NAME,
          description: `Choose ${LOESCHEN} cards from your discard pile to delete.`,
          selectCount: LOESCHEN,
          minSelect: LOESCHEN,
          confirmLabel: '🗑️ Delete',
          confirmClass: 'btn-danger',
          cancellable: false,
        });
        namen = (wahl?.selectedCards || []).slice(0, LOESCHEN);
      } finally {
        engine.endHumanWait?.();
      }
      // Keine oder zu wenige Karten gewaehlt (CPU-Abbruch, Zeitablauf):
      // dann trifft es die obersten — die Wahl war Pflicht.
      if (namen.length < LOESCHEN) {
        namen = (ops.discardPile || []).slice(-LOESCHEN);
      }

      // ★ Lernspur (v987): fuer JEDE Karte der Ablage, ob sie geloescht
      // wurde oder liegenblieb. Daraus fittet der Trainer
      // `discardValueRules` — „was kostet es, genau diese Karte zu
      // verlieren?". Vor dem Loeschen aufnehmen, sonst ist die Ablage
      // schon halb leer.
      if (!engine._discardFateLog) engine._discardFateLog = [];
      const _t = engine.gs?.turn || 0;
      // ★ Mit ANZAHL statt Menge: die Ablage enthaelt Doppelte, und der
      // Name allein wuerde jede Kopie als „geloescht" zaehlen — der
      // Behalten-Arm waere leer und der Fit wertlos.
      const _offen = new Map();
      for (const n of namen) _offen.set(n, (_offen.get(n) || 0) + 1);
      for (const n of (ops.discardPile || [])) {
        const rest = _offen.get(n) || 0;
        const geloescht = rest > 0;
        if (geloescht) _offen.set(n, rest - 1);
        engine._discardFateLog.push({ pi: oi, c: n, t: _t, deleted: geloescht ? 1 : 0 });
      }

      const raus = await loescheAusAblage(engine, oi, namen, CARD_NAME);
      engine.log('gravedigger_choice', {
        player: ops.username, mode: 'delete', count: raus,
      });
      engine.sync();
    },
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = engine.physicalSide(ctx.card) ?? ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    if (!ops || (ops.mainDeck || []).length === 0) return false;

    const gemillt = await engine.actionMillCards(oi, 1, {
      source: CARD_NAME, centerReveal: true,
    });
    if (!gemillt || gemillt.length === 0) return false;

    engine.log('gravedigger_dig', {
      player: gs.players[pi]?.username, opponent: ops.username, card: gemillt[0],
    });
    engine.sync();
    return true;
  },
};
