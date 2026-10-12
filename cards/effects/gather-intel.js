'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Gather Intel"
//  Spell (Decay Magic + Magic Arts Lv0, Normal)
//
//  „Look at your opponent's hand and choose a card from it. Your opponent must either add that card to your hand or allow you to draw 2 cards (their choice).
//   You may make this count as an additional Action, but if you do, you cannot perform other Actions for the rest of the turn afterwards."
//
//  ── VORGABE 12.10. ──────────────────────────────────────────────────────
//  Vorher ein Attack (Fighting) mit „discard that card"; jetzt ein Spell (Decay Magic + Magic Arts) mit „add that card to your hand". Zur Zusatzaktion: „Wird die Karte
//  eingesetzt, wenn keine reguläre Action verfügbar ist, gibt sie immer den Action-locked-Debuff; wird sie eingesetzt, während noch eine Action zur Verfügung steht,
//  fragt sie den Spieler, ob sie eine additional sein soll (auch wenn es kaum jemals Sinn ergibt, sie dann als additional zu spielen)."
//
//  ── ZUSATZAKTION (Bauform „Greatmaw Remora") ────────────────────────────
//  `inherentAction` ist IMMER wahr: der Einsatz kostet von sich aus keine Aktion (auch in den Main Phases spielbar). Ob er eine ZUSATZAKTION bleibt, klärt `onPlay`:
//    • keine reguläre Aktion einlösbar (`engine.hasSpendableActionFor`: Main Phase, Action Phase nach der Aktion) → es IST eine Zusatzaktion, die Sperre greift immer
//      (keine Rückfrage);
//    • eine reguläre Aktion ist noch da → Rückfrage „zusätzliche Aktion?": JA = gratis, aber gesperrt; NEIN = die Aktion wird bezahlt (keine Sperre). Die Rückfrage ist
//      nicht abbrechbar (kein Versehen mit Folgen). NEIN bucht die Aktion über denselben Weg wie „Pillar of Light" (`gs._pendingActionBurn`, abgearbeitet NACH der
//      Auflösung, mit dem Phasenwechsel); gibt es nur eine Bonus-Aktion oder einen Zusatzaktions-Geber, wird sie über `consumeRealActionFor` verbraucht.
//  Die Sperre „cannot perform other Actions for the rest of the turn" ist der spielerweite Riegel `ps.actionLocked` (wie Overflowing Chalice: Engine setzt ihn beim
//  Zugbeginn zurück, Debuff-Banner im Client, `areActionsBlocked` sperrt JEDE Aktion, auch inherente und Bonus-Aktionen). Er wird ERST NACH der Auflösung gesetzt
//  („afterwards") und gilt auch, wenn die Hand-Interaktion negiert wird — nur eine negierte KARTE (Reaktion davor) löst `onPlay` gar nicht erst aus.
//  Die Entscheidung fällt VOR dem Ansehen der Hand (die Frage verrät nichts) und die Karte ist danach nicht mehr abbrechbar.
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Spielbar nur, wenn die Gegnerhand nicht leer ist, der Gegner keinen Erstrunden-Schutz hat und der Spieler nicht durch Spreading Rumor („cannot interact with your
//     opponent's hand") gesperrt ist (`spellPlayCondition`, in `onPlay` ein zweites Mal → `_spellCancelled`).
//  2. Animation `intel_peek` (Pixelart, Lupe gleitet über die GEGNERHAND; sie läuft ganz ab, erst DANACH wird die Hand aufgedeckt — die offene Hand liegt über der Animation), dann das Reaktionsfenster `onHandInteraction` Kategorie `reveal` (Ambush the Scout): negiert →
//     weder Ansehen noch Wegnehmen.
//  3. Die Gegnerhand liegt für den Spieler offen (`_revealedHandIndices`, wie bei Letter of Misinformations), er wählt EINE Karte (`pickFromOppHand`, nicht abbrechbar —
//     sonst wäre es ein kostenloser Blick).
//  4. Der GEGNER entscheidet: die gewählte Karte auf die Hand des Spielers ODER der Spieler zieht 2 Karten. Er sieht die gewählte Karte in der Frage. Entfällt eine Seite,
//     gibt es keine Frage: Boris (`stealsOpponentCards`) und eine Hand-Sperre des Spielers lassen nur das Ziehen zu (bei Hand-Sperre wirkt auch das nicht — die Engine
//     blockt das Ziehen selbst).
//  5. „Add to your hand" ist ein Hand-Diebstahl: `actionStealFromHand` mit der vorab gewählten Karte (`preselectedIndices`) — Erstrunden-Schutz, Reaktionsfenster Kategorie
//     `steal`, Flug `play_hand_steal`, Besitzerwechsel (`originalOwner` bleibt), Hook `onCardTakenFromOpponent`.
//  Logs (ohne Kartennamen — der Gegner kennt die Karte, unbeteiligte Sitze nicht): `gather_intel_look`, `gather_intel_result`, `gather_intel_lock`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Der Wirker wählt die wertvollste Karte der Gegnerhand, bezahlt die Aktion lieber, als sich zu sperren; der Gegner lässt lieber ziehen, wenn die gewählte Karte
//  etwas wert ist, und gibt sie her, wenn nicht.
// ═══════════════════════════════════════════

const CARD_NAME = 'Gather Intel';
const PEEK_MS = 1300;            // Länge der Animation (deckt sich mit `intel_peek` im Client)
const PEEK_VOR_MS = 1450;        // die Animation läuft VOLLSTÄNDIG ab (Länge + 100 ms Einbau-Versatz + Puffer), bevor das Fenster aufgeht und die Hand aufgedeckt wird — sonst hebt die offene Hand die Karten über die Animation und die Lupe verschwindet halb unter ihnen (Als Befund 12.10.)

/** Kann die Karte überhaupt etwas bewirken? (spielbar-Bedingung UND zweite Prüfung beim Auflösen) */
function wirkbar(gs, pi, oi) {
  const ps = gs.players[pi], ops = gs.players[oi];
  if (!ps || !ops) return false;
  if ((ops.hand || []).length === 0) return false;
  if (gs.firstTurnProtectedPlayer === oi) return false;                    // Erstrunden-Schutz: die Hand ist tabu
  if (ps._oppHandInteractionLockedTurn === gs.turn) return false;          // Spreading Rumor
  return true;
}

/** Grober Kartenwert für die CPU (Stufe, Kosten, Art). */
function kartenWert(engine, name) {
  const cd = engine._getCardDB()[name] || {};
  let v = (cd.level || 0) * 1.5 + (cd.cost || 0) / 4;
  if (cd.cardType === 'Creature') v += (cd.hp || 0) / 60 + 1;
  else if (cd.cardType === 'Attack' || cd.cardType === 'Spell') v += 1.5;
  else if (cd.cardType === 'Artifact') v += 1;
  return v;
}

/**
 * Zusatzaktion klären (s. Kopf). Gibt zurück, ob die Karte als ZUSATZAKTION zählt (Sperre am Ende).
 * Keine reguläre Aktion da → ja, ohne Frage. Sonst die Frage; „nein" bucht die Aktion.
 */
async function zusatzaktionKlaeren(engine, pi, heroIdx) {
  const gs = engine.gs;
  if (!engine.hasSpendableActionFor(pi, heroIdx, CARD_NAME)) return true;
  const wahl = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    _giPhase: 'additional',
    description: 'Make this count as an additional Action? If you do, you cannot perform other Actions for the rest of the turn afterwards. '
      + 'Otherwise it costs one of your Actions.',
    showCard: CARD_NAME,
    cancellable: false,
    options: [
      { id: 'additional', label: 'Additional Action (no other Actions this turn)' },
      { id: 'regular', label: 'Spend an Action instead' },
    ],
  });
  if (wahl?.optionId !== 'regular') return true;
  // Die Aktion bezahlen: in der Action Phase mit unverbrauchter Hauptaktion über die nachträgliche Buchung (Phasenwechsel nach der Auflösung), sonst über die
  // Bonus-/Geber-Aktion.
  if ((gs.currentPhase || 0) === 3 && !engine.mainActionSpent(pi, heroIdx)) {
    gs._pendingActionBurn = { pi, heroIdx };
    return false;
  }
  if (engine.consumeRealActionFor(pi, heroIdx, CARD_NAME)) return false;
  return true;        // nichts einlösbar (zwischen Frage und Antwort verfallen): dann zählt sie als Zusatzaktion
}

module.exports = {
  // Immer gratis spielbar; ob sie als Zusatzaktion gilt, entscheidet `onPlay`.
  inherentAction: () => true,

  // Wirkt die Karte nicht, bleibt sie ausgegraut (leere Gegnerhand, Erstrunden-Schutz, Spreading Rumor).
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return wirkbar(gs, pi, engine.opponentOf(pi));
  },

  cpuMeta: {
    // „cannot perform other Actions" schließt spätere Plays aus — die Karte gehört ans Ende des Zuges.
    cpuDeferUntilLast: true,
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;
      if (!wirkbar(gs, pi, oi)) { gs._spellCancelled = true; return; }

      // Die gespielte Karte JETZT dem Gegner zeigen, nicht erst nach den Abfragen.
      if (gs._pendingCardReveal) engine._firePendingCardReveal();

      // ── 1. Zusatzaktion? (vor allem anderen; danach ist die Karte nicht mehr abbrechbar) ──
      const zusatz = await zusatzaktionKlaeren(engine, pi, heroIdx);

      try {
        // ── 2. Lupe über die Gegnerhand, dann das Reaktionsfenster ──
        engine._broadcastEvent('play_zone_animation', {
          type: 'intel_peek', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: PEEK_MS,
          targets: [{ owner: oi, hand: true }],
          originOwner: pi, originHeroIdx: heroIdx, originZoneSlot: -1,
        });
        await engine._delay(PEEK_VOR_MS);
        engine.log('gather_intel_look', { player: ps.username, opponent: ops.username });

        if (await engine.checkHandInteractionReaction(oi, 'reveal',
              { byPi: pi, count: (ops.hand || []).length, sourceName: CARD_NAME })) {
          engine.sync();
          return;
        }
        if ((ops.hand || []).length === 0) { engine.sync(); return; }          // das Fenster hat die Hand geleert

        // ── 3. Die Hand liegt offen, der Spieler wählt EINE Karte ──
        if (!ops._revealedHandIndices) ops._revealedHandIndices = {};
        const aufgedeckt = [];
        const alleIdx = ops.hand.map((_, i) => i);
        for (const i of alleIdx) if (!ops._revealedHandIndices[i]) { ops._revealedHandIndices[i] = true; aufgedeckt.push(i); }
        engine.sync();
        let wahl;
        try {
          wahl = await engine.promptGeneric(pi, {
            type: 'pickFromOppHand',
            title: CARD_NAME,
            _giPhase: 'pick',
            description: `Choose a card from ${ops.username}'s hand.`,
            instruction: `${ops.username} must either add it to your hand or let you draw 2 cards.`,
            eligibleIndices: alleIdx,
            cancellable: false,
            opponentTitle: '🔍 Opponent is looking at your hand...',
          });
        } finally {
          for (const i of aufgedeckt) delete ops._revealedHandIndices[i];
        }
        let idx = Number.isInteger(wahl?.handIndex) ? wahl.handIndex : -1;
        if (idx < 0 || idx >= ops.hand.length) idx = 0;                          // defensiv: nie ohne Wahl abbrechen
        const name = ops.hand[idx];
        if (!name) { engine.sync(); return; }

        // ── 4. Der Gegner entscheidet ──
        const boris = engine.isBorisBlocked({ stealsOpponentCards: true }, pi);
        const geben = !boris && !ps.handLocked;
        let entscheidung = 'draw';
        if (geben) {
          const e = await engine.promptGeneric(oi, {
            type: 'optionPicker',
            title: CARD_NAME,
            _giPhase: 'decide',
            description: `${ps.username} looked at your hand and chose ${name}. Add it to ${ps.username}'s hand, or let ${ps.username} draw 2 cards?`,
            showCard: name,
            cancellable: false,
            options: [
              { id: 'give', label: `Add ${name} to their hand` },
              { id: 'draw', label: 'They draw 2 cards' },
            ],
          });
          entscheidung = e?.optionId === 'give' ? 'give' : 'draw';
        }

        // ── 5. Ausführen ──
        if (entscheidung === 'give') {
          const r = await engine.actionStealFromHand(pi, { count: 1, preselectedIndices: [idx], sourceName: CARD_NAME });
          engine.log('gather_intel_result', { player: ps.username, opponent: ops.username, choice: 'give', moved: (r?.stolen || []).length });
        } else {
          await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
          engine.log('gather_intel_result', { player: ps.username, opponent: ops.username, choice: 'draw', moved: 0 });
        }
        engine.sync();
      } finally {
        // ── Nach der Auflösung: „you cannot perform other Actions for the rest of the turn" ──
        if (zusatz) {
          ps.actionLocked = true;
          engine.log('gather_intel_lock', { player: ps.username });
          engine.sync();
        }
      }
    },
  },

  /** CPU: Karte wählen / Zusatzaktion bezahlen / als Gegner geben oder ziehen lassen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    const me = engine._cpuPlayerIdx;
    if (promptData._giPhase === 'additional') return { optionId: 'regular' };
    if (promptData._giPhase === 'pick') {
      const hand = engine.gs.players?.[engine.opponentOf(me)]?.hand || [];
      const idxs = (promptData.eligibleIndices && promptData.eligibleIndices.length) ? promptData.eligibleIndices : hand.map((_, i) => i);
      let best = idxs[0] ?? 0, bestV = -1;
      for (const i of idxs) { const v = kartenWert(engine, hand[i]); if (v > bestV) { bestV = v; best = i; } }
      return { handIndex: best, cardName: hand[best] || null };
    }
    if (promptData._giPhase === 'decide') {
      return { optionId: kartenWert(engine, promptData.showCard) >= 3 ? 'draw' : 'give' };
    }
    return undefined;
  },
};
