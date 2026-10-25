'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Transmission"
//  Spell (Normal, Support Magic Lv1), PP SOB
//
//  „Choose any card from your discard pile and add it to your opponent's hand. This counts as an additional Action."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Wahl (`cardGallery`, abbrechbar → die Karte bleibt auf der Hand): JEDE Karte der eigenen Ablage, ohne Typfilter (entduplizierte Galerie mit Stückzahl, wie Shooting Star).
//     Transmission selbst liegt beim Auflösen noch NICHT in der Ablage und kann sich nicht selbst verschicken; eine zweite Kopie darin ist ein gültiges Ziel.
//  2. Reaktionsfenster „Hand-Interaktion / insert" (Ambush the Scout) — erst NACH der Wahl, wie bei Live Show. Wird es negiert, ist der Zauber verbraucht, die Karte bleibt in der Ablage.
//  3. Die Karte verlässt die Ablage (`takeFromPile`: Stapel-Ausgangssperre, Stab-Sperre mit Freikauf), fliegt in die Hand des Gegners (`play_pile_transfer` Ablage → Hand über die
//     Brettmitte) und Transmission selbst fliegt zeitgleich in die Ablage (`aufloesenderSpellInDieAblage`, wie Shooting Star).
//
//  4. Aufdecken beim Eintritt: die Karte kommt über `handZugang` auf die Hand des Gegners — Karten mit `revealOnEnterHand` (Crystals, Great Vanguard Demon …) liegen dort sofort aufgedeckt, ihre
//     Handwirkung gilt für den EMPFÄNGER (Weakening Crystal negiert schon beim Eintritt). Die Karte muss dafür nichts tun.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „This counts as an additional Action" — OHNE Bedingung → `inherentAction: true`: in der Main Phase spielbar, ohne eine Aktion zu kosten.
//
//  ── ANNAHMEN (Rulings der Umsetzung) ────────────────────────────────────
//  • Die Karte bleibt Eigentum ihres Besitzers (`originalOwner` = Wirker): wirft der Gegner sie ab / spielt er sie, landet sie in der Ablage des Wirkers.
//  • Unspielbar (statt wirkungslos), wenn die Karte nichts bewirken könnte: leere eigene Ablage (`spellPlayCondition`), Ablage-Sperre (`blockedByPileLock`), Hand-Sperre des Gegners
//    („cannot add cards to your hand" — wie `actionTransferCardToOppHand`), Erste-Runden-Schutz des Gegners (`blockedByFirstTurnProtection`), Spreading Rumor / Slow
//    (`_oppHandInteractionLockedTurn`: „cannot interact with your opponent's hand").
//  • Kein „von der Hand in die Gegnerhand"-Hook (Mary Crestmas) und kein „aus DEINER Ablage"-Hook (Bamboo Staff): die Karte kommt aus der Ablage des Wirkers, nicht des Empfängers,
//    und nicht aus dessen Hand. Der Empfänger meldet den Zuwachs über `onHandGrew` (Handlimit-Wächter, Charm of Balance).
//  • „Your opponent" = `engine.opponentOf(pi)` (im Skill Test mit mehreren Gegnern der Fokus-Gegner).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Spielt die Karte nie von sich aus (`cpuSkipProactive`): ein Geschenk an den Gegner ohne Wert-Rechnung wäre nur eine verschenkte Karte. Die Antwort auf die Galerie ist trotzdem
//  da (der wertloseste Kandidat).
// ═══════════════════════════════════════════

const CARD_NAME = 'Transmission';
const FLUG_MS = 650;      // Flugzeit Ablage → Gegnerhand, bis die Karte "landet"

/** Entduplizierte Galerie der eigenen Ablage, mit Stückzahl. */
function galerie(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const zaehler = {};
  for (const name of (ps.discardPile || [])) zaehler[name] = (zaehler[name] || 0) + 1;
  return Object.keys(zaehler)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, source: 'discard', count: zaehler[name] }));
}

/** Kann die Karte der Hand des Gegners überhaupt etwas geben? (Spielbarkeit UND zweite Prüfung beim Auflösen) */
function wirkbar(engine, pi, oi) {
  const gs = engine.gs;
  const ps = gs.players[pi], ops = gs.players[oi];
  if (!ps || !ops) return false;
  if (gs.firstTurnProtectedPlayer === oi) return false;                    // Erstrunden-Schutz: die Hand ist tabu
  if (ps._oppHandInteractionLockedTurn === gs.turn) return false;          // Spreading Rumor / Slow
  if (engine.handZugangGesperrt?.(oi)) return false;                       // Hand-Sperre des Empfängers
  return (ps.discardPile || []).length > 0;
}

/** Grober Kartenwert für die CPU (hoch = dem Gegner nicht gönnen). */
function kartenWert(engine, name) {
  const cd = engine._getCardDB()[name] || {};
  let v = (cd.level || 0) * 1.5 + (cd.cost || 0) / 4;
  if (cd.cardType === 'Creature') v += (cd.hp || 0) / 60 + 1;
  else if (cd.cardType === 'Attack' || cd.cardType === 'Spell') v += 1.5;
  else if (cd.cardType === 'Artifact') v += 1;
  return v;
}

module.exports = {
  activeIn: ['hand'],
  inherentAction: true,                    // „This counts as an additional Action." — ohne Bedingung
  blockedByPileLock: true,                 // einziger Nutzen = Entnahme aus der Ablage (Stapel-Ausgangssperre)
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerseite
  cpuSkipProactive: true,

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return (gs.players[pi]?.discardPile || []).length > 0;
    return wirkbar(eng, pi, eng.opponentOf(pi));
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;
      if (!wirkbar(engine, pi, oi)) { gs._spellCancelled = true; return; }

      // ── 1. Wahl ──
      const karten = galerie(gs, pi);
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: karten,
        title: CARD_NAME,
        description: "Choose a card from your discard pile to add to your opponent's hand.",
        confirmLabel: '📡 Send',
        cancellable: true,
      });
      if (!wahl?.cardName) { gs._spellCancelled = true; return; }
      const gewaehlt = wahl.cardName;
      if (!(ps.discardPile || []).includes(gewaehlt)) { gs._spellCancelled = true; return; }

      // ── 2. Reaktionsfenster (Ambush the Scout, Kategorie „insert") ──
      if (await engine.checkHandInteractionReaction(oi, 'insert', { byPi: pi, count: 1, sourceName: CARD_NAME })) {
        engine.log('transmission_negated', { player: ps.username, opponent: ops.username });
        engine.sync();
        return;
      }
      // Zwischen Wahl und Auflösung kann sich etwas geändert haben (Fenster, Reaktionen): noch einmal prüfen.
      if (!wirkbar(engine, pi, oi)) { engine.log('transmission_fizzle', { player: ps.username }); engine.sync(); return; }

      // ── 3. Die Karte verlässt die Ablage ──
      const genommen = await engine.takeFromPile(pi, 'discard', gewaehlt, { source: CARD_NAME });
      if (!genommen) {
        // Ablage gesperrt (Stab-Sperre ohne Freikauf …): nichts passiert, die Karte bleibt auf der Hand.
        gs._spellCancelled = true;
        return;
      }

      const eigenerIdx = (ps.hand || []).indexOf(CARD_NAME);
      const endGroesse = (ops.hand || []).length + 1;
      engine._broadcastEvent('play_pile_transfer', {
        fromOwner: pi, toOwner: oi, cardName: gewaehlt, from: 'discard', to: 'hand',
        toHandIdx: endGroesse - 1, finalHandSize: endGroesse,
      });
      engine.sync();
      // Transmission selbst fliegt jetzt in die Ablage — gleichzeitig mit dem Abflug der gewählten Karte (nur aus der Hand; aus Crestinas Vorrat bleibt der Normalweg).
      if (eigenerIdx >= 0 && !ps._resolvingCard?.fromCreation) await engine.aufloesenderSpellInDieAblage(pi);
      await engine._delay(FLUG_MS);

      // ── 4. Landung in der Gegnerhand ──
      const inst = await engine.handZugang(oi, gewaehlt, { originalOwner: pi, source: CARD_NAME });
      if (!inst) {
        // Kein Zugang möglich (z. B. Token-Name): zurück in die Ablage, nichts geht verloren.
        engine.returnToPile(pi, 'discard', gewaehlt);
        engine.log('transmission_fizzle', { player: ps.username });
        engine.sync();
        return;
      }
      engine.log('transmission', { player: ps.username, opponent: ops.username, card: gewaehlt });
      engine.sync();
    },
  },

  /** CPU: den wertlosesten Kandidaten verschicken (nur zur Absicherung; die Karte wird nicht von selbst gespielt). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery' || promptData?.title !== CARD_NAME) return undefined;
    const karten = promptData.cards || [];
    if (karten.length === 0) return undefined;
    let best = karten[0], bestV = Infinity;
    for (const k of karten) { const v = kartenWert(engine, k.name); if (v < bestV) { bestV = v; best = k; } }
    return { cardName: best.name, source: best.source };
  },
};
