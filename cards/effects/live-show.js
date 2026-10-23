'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Live Show"
//  Spell (Magic Arts Lv1, Normal)
//
//  „Look at your opponent's hand. Then, add any number of cards from your hand to your opponent's hand and add up to that many cards from your opponent's hand to your hand
//   afterwards. You may play this card as an additional Action, but if you do, you must give your opponent at least 2 cards more than you take from them."
//
//  ── VORGABE 12.10. ──────────────────────────────────────────────────────
//  Kompletter neuer Effekt (vorher ein anderer). Zur Zusatzaktion: „Die Additional-Condition ist hier relativ kompliziert; hat man weniger als 2 weitere Karten zum
//  Verschenken in der Hand, kann sie nie additional sein."
//
//  ── ZUSATZAKTION (Bauform „Gather Intel", aber MIT Bedingung statt Sperre) ──
//  `inherentAction` ist eine FUNKTION: wahr, solange der Spieler MINDESTENS ZWEI WEITERE Karten auf der Hand hat (die gespielte Karte selbst zählt nicht mit). Nur dann gibt es
//  überhaupt eine Zusatzaktion; mit weniger kostet der Einsatz stets die Aktion, ohne Rückfrage. Ob sie als Zusatzaktion gespielt wird, klärt `onPlay`:
//    • keine reguläre Aktion einlösbar (`engine.hasSpendableActionFor`: Main Phase, Action Phase nach der Aktion) → es IST eine Zusatzaktion (keine Rückfrage);
//    • eine reguläre Aktion ist noch da → Rückfrage „zusätzliche Aktion?": JA = gratis, dafür gilt die Bedingung unten; NEIN = die Aktion wird bezahlt, ohne Bedingung
//      (`gs._pendingActionBurn`, abgearbeitet NACH der Auflösung, oder `consumeRealActionFor` bei Bonus-/Geber-Aktionen). Die Rückfrage verrät nichts und ist nicht abbrechbar.
//  Die BEDINGUNG „you must give your opponent at least 2 cards more than you take": als Zusatzaktion müssen es MINDESTENS ZWEI verschenkte Karten sein, und genommen werden dürfen
//  höchstens (verschenkt − 2) — die Differenz zählt die tatsächlich übergebenen Karten. Keine Sperre nach der Auflösung (anders als Gather Intel).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Spielbar nur, wenn die Gegnerhand tabu ist (Erstrunden-Schutz, Spreading Rumor „cannot interact with your opponent's hand") NICHT gilt UND es etwas zu tun gibt: der
//     Gegner hat Handkarten ODER der Spieler hat eine weitere Karte (`spellPlayCondition`, in `onPlay` ein zweites Mal → `_spellCancelled`).
//  2. Zusatzaktion klären (s. oben), dann Animation `live_show_spot` (Pixelart: Scheinwerfer und Vorhang über der GEGNERHAND, Konfetti; sie läuft ganz ab, erst DANACH wird die
//     Hand aufgedeckt) und das Reaktionsfenster `onHandInteraction` Kategorie `reveal` (Ambush the Scout): negiert → die GANZE Karte entfällt (Ansehen, Geben, Nehmen).
//  3. „Look at": die Gegnerhand liegt für den Spieler offen (`_revealedHandIndices`, nur während der Wahl).
//  4. „add any number of cards from your hand to your opponent's hand": EINE `handPick`-Auswahl aus den EIGENEN Handkarten (die gerade aufgelöste Karte ist ausgenommen), 0 bis
//     alle — als Zusatzaktion mindestens 2. Nicht abbrechbar (sonst wäre es ein kostenloser Blick). Ein Reaktionsfenster `insert` für das GANZE Geben (nicht je Karte), dann
//     wandern die Karten einzeln (`actionTransferCardToOppHand`, Flug, Hook `onCardTransferredToOppHand`).
//  5. „and add up to that many cards from your opponent's hand to your hand afterwards": NACH dem Geben, aber NUR aus den Karten, die der Gegner schon VOR dem Geben auf der
//     Hand hatte — die gerade verschenkten Karten dürfen NICHT zurückgenommen werden (Vorgabe 12.10.). Obergrenze = tatsächlich übergebene Karten (als Zusatzaktion minus 2),
//     höchstens die Zahl der ursprünglichen Gegnerkarten; offen sichtbare Hand, `blindHandPick` mit `minSelect: 0` (bis zu N, auch keine) und `eligibleIndices` (die
//     verschenkten Karten liegen ausgegraut am Ende der Hand und sind nicht anklickbar; der Server filtert zusätzlich). Das Nehmen läuft als Hand-Diebstahl:
//     `actionStealFromHand` mit den vorab gewählten Karten (`preselectedIndices`) — Erstrunden-Schutz, Reaktionsfenster `steal`, Flug, Besitzerwechsel, Hook
//     `onCardTakenFromOpponent`. Unter Boris (`stealsOpponentCards`) und einer Hand-Sperre des Spielers entfällt das Nehmen.
//  Logs (der Gegner kennt die Karten, unbeteiligte Sitze nicht — das Protokoll nennt nur Anzahlen): `live_show_look`, `live_show_result`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Spielt die Karte nie von sich aus (`cpuSkipProactive`): ein Tausch ohne Wert-Rechnung wäre eine verschenkte Aktion. Die Antworten auf die Abfragen sind trotzdem
//  vollständig (schlechteste Karten geben, beste nehmen), falls die Karte doch auf anderem Weg gespielt wird.
// ═══════════════════════════════════════════

const CARD_NAME = 'Live Show';
const SHOW_MS = 1300;            // Länge der Animation (deckt sich mit `live_show_spot` im Client)
const SHOW_VOR_MS = 1450;        // die Animation läuft VOLLSTÄNDIG ab (Länge + 100 ms Einbau-Versatz + Puffer), bevor die Hand aufgedeckt wird (wie bei Gather Intel)
const GEBEN_ABSTAND_MS = 320;    // zwischen den einzelnen Flügen der verschenkten Karten
const WEG_VOR_MS = 150;          // Live Show fliegt kurz VOR der ersten verschenkten Karte in die Ablage
const NEHMEN_VOR_MS = 120;       // zwischen „Karten gewählt“ und Abflug der genommenen Karten (die Wahl ist schon markiert)
const UEBERSCHUSS = 2;           // Zusatzaktion: mindestens so viele Karten MEHR verschenken als nehmen
const MINDEST_ZUSATZ = 2;        // ... also mindestens so viele weitere Karten müssen auf der Hand liegen

/**
 * Handindizes der WEITEREN Karten (alles ausser der gespielten Live Show). Während der Auflösung kennt die Engine die Karte genau (`_istAufloesendeHandkarte`, gleichnamige
 * Kopien sind sonst nicht unterscheidbar); davor (Spielbarkeitsprüfung) liegt sie noch in der Hand — dann zählt eine Kopie dieses Namens als „die gespielte".
 */
function andereIndizes(engine, ps) {
  const hand = ps?.hand || [];
  const alle = hand.map((_, i) => i);
  if (ps?._resolvingCard && !ps._resolvingCard.fromCreation) return alle.filter(i => !engine._istAufloesendeHandkarte(ps, i));
  const eigene = hand.indexOf(CARD_NAME);
  return eigene >= 0 ? alle.filter(i => i !== eigene) : alle;
}

/** Kann die Karte überhaupt etwas bewirken? (Spielbarkeit UND zweite Prüfung beim Auflösen) */
function wirkbar(engine, pi, oi) {
  const gs = engine.gs;
  const ps = gs.players[pi], ops = gs.players[oi];
  if (!ps || !ops) return false;
  if (gs.firstTurnProtectedPlayer === oi) return false;                    // Erstrunden-Schutz: die Hand ist tabu
  if (ps._oppHandInteractionLockedTurn === gs.turn) return false;          // Spreading Rumor
  return (ops.hand || []).length > 0 || andereIndizes(engine, ps).length > 0;
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
 * Zusatzaktion klären (s. Kopf). Gibt zurück, ob die Karte als ZUSATZAKTION zählt (dann gilt die Bedingung „mindestens 2 mehr geben als nehmen").
 * Keine reguläre Aktion da → ja, ohne Frage. Sonst die Frage; „nein" bucht die Aktion.
 */
async function zusatzaktionKlaeren(engine, pi, heroIdx) {
  const gs = engine.gs;
  if (!engine.hasSpendableActionFor(pi, heroIdx, CARD_NAME)) return true;
  const wahl = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    _lsPhase: 'additional',
    description: `Play this card as an additional Action? If you do, you must give your opponent at least ${UEBERSCHUSS} cards more than you take from them. `
      + 'Otherwise it costs one of your Actions.',
    showCard: CARD_NAME,
    cancellable: false,
    options: [
      { id: 'additional', label: `Additional Action (give at least ${UEBERSCHUSS} more than you take)` },
      { id: 'regular', label: 'Spend an Action instead' },
    ],
  });
  if (wahl?.optionId !== 'regular') return true;
  // Die Aktion bezahlen: in der Action Phase mit unverbrauchter Hauptaktion über die nachträgliche Buchung (Phasenwechsel nach der Auflösung), sonst über die Bonus-/Geber-Aktion.
  if ((gs.currentPhase || 0) === 3 && !engine.mainActionSpent(pi, heroIdx)) {
    gs._pendingActionBurn = { pi, heroIdx };
    return false;
  }
  if (engine.consumeRealActionFor(pi, heroIdx, CARD_NAME)) return false;
  return true;        // nichts einlösbar (zwischen Frage und Antwort verfallen): dann zählt sie als Zusatzaktion
}

/** Die Gegnerhand für den Spieler aufdecken, solange `fn` läuft (nur die Marken, die diese Funktion gesetzt hat, werden wieder gelöscht). */
async function mitOffenerGegnerhand(engine, ops, fn) {
  if (!ops._revealedHandIndices) ops._revealedHandIndices = {};
  const aufgedeckt = [];
  for (let i = 0; i < (ops.hand || []).length; i++) if (!ops._revealedHandIndices[i]) { ops._revealedHandIndices[i] = true; aufgedeckt.push(i); }
  engine.sync();
  try { return await fn(); }
  finally { for (const i of aufgedeckt) delete ops._revealedHandIndices[i]; }
}

module.exports = {
  // „You may play this card as an additional Action": nur mit mindestens zwei WEITEREN Karten auf der Hand (sonst nie additional — dann kostet sie die Aktion).
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return andereIndizes(engine, gs.players[pi]).length >= MINDEST_ZUSATZ;
  },

  // Wirkt die Karte nicht, bleibt sie ausgegraut (Hand tabu oder beide Seiten ohne Karten).
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return wirkbar(engine, pi, engine.opponentOf(pi));
  },

  cpuSkipProactive: true,

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
      if (!wirkbar(engine, pi, oi)) { gs._spellCancelled = true; return; }

      // Die gespielte Karte JETZT dem Gegner zeigen, nicht erst nach den Abfragen.
      if (gs._pendingCardReveal) engine._firePendingCardReveal();

      // ── 1. Zusatzaktion? Nur wenn die Engine sie als inherente (gratis) Karte behandelt hat, also mit mindestens zwei weiteren Karten — sonst hat sie die Aktion schon gekostet ──
      const zusatz = andereIndizes(engine, ps).length >= MINDEST_ZUSATZ
        ? await zusatzaktionKlaeren(engine, pi, heroIdx)
        : false;

      // ── 2. Scheinwerfer über die Gegnerhand, dann das Reaktionsfenster ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'live_show_spot', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: SHOW_MS,
        targets: [{ owner: oi, hand: true }],
        originOwner: pi, originHeroIdx: heroIdx, originZoneSlot: -1,
      });
      await engine._delay(SHOW_VOR_MS);
      engine.log('live_show_look', { player: ps.username, opponent: ops.username });

      if ((ops.hand || []).length > 0 && await engine.checkHandInteractionReaction(oi, 'reveal',
            { byPi: pi, count: (ops.hand || []).length, sourceName: CARD_NAME })) {
        engine.sync();
        return;
      }

      // ── 3.+4. Die Hand liegt offen, der Spieler wählt, was er verschenkt ──
      const kandidaten = andereIndizes(engine, ps);
      let gewaehlt = [];
      if (kandidaten.length > 0) {
        const minSel = zusatz ? Math.min(MINDEST_ZUSATZ, kandidaten.length) : 0;
        const wahl = await mitOffenerGegnerhand(engine, ops, () => engine.promptGeneric(pi, {
          type: 'handPick',
          title: CARD_NAME,
          _lsPhase: 'give',
          description: zusatz
            ? `Choose at least ${minSel} card${minSel === 1 ? '' : 's'} from your hand to add to ${ops.username}'s hand. You may then take up to that many minus ${UEBERSCHUSS} cards from theirs.`
            : `Choose any number of cards from your hand to add to ${ops.username}'s hand. You may then take up to that many cards from theirs.`,
          eligibleIndices: kandidaten,
          highlightStyle: 'strong',       // deutliche Hervorhebung der wählbaren/gewählten Karten (Client: `hand-pick-stark`)
          minSelect: minSel,
          maxSelect: kandidaten.length,
          confirmLabel: '🎭 Give!',
          // pflichtwahl: nach dem Ansehen der Gegnerhand und dem Zahlen der Aktion gibt es keinen Rückzieher (0 Karten zu geben ist ohnehin erlaubt)
          cancellable: false,
        }));
        const roh = Array.isArray(wahl?.selectedCards) ? wahl.selectedCards : [];
        gewaehlt = [...new Set(roh.map(s => s?.handIndex).filter(i => Number.isInteger(i) && kandidaten.includes(i)))];
        // Defensiv: der Server erzwingt die Untergrenze selbst (die Oberfläche tut es schon).
        for (const i of kandidaten) { if (gewaehlt.length >= minSel) break; if (!gewaehlt.includes(i)) gewaehlt.push(i); }
      }

      // Live Show verlässt JETZT die Hand in die Ablage (Bauform Shooting Star): sie fliegt, während die Karten zur Gegnerhand fliegen, und die Hand richtet sich schon so aus,
      // als wäre sie weg — später würde sie genau im Moment des Eintreffens der genommenen Karten aus der Hand verschwinden und deren Landeplätze verschieben. Die gewählten
      // Handplätze rücken mit (Plätze hinter der Live Show rutschen um eins).
      const weg = await engine.aufloesenderSpellInDieAblage(pi);
      if (weg) {
        gewaehlt = gewaehlt.map(i => (i > weg.idx ? i - 1 : i));
        await engine._delay(WEG_VOR_MS);       // der Client richtet die Hand neu aus, bevor die Flugquellen (Handplätze) gelten
      }

      // Geben: EIN Fenster (`insert`) für das ganze Geben, die Karten fliegen dann von hinten nach vorn (stabile Indizes), je Karte mit eigenem Flug.
      let gegeben = 0;
      if (gewaehlt.length > 0 && !(await engine.checkHandInteractionReaction(oi, 'insert',
            { byPi: pi, count: gewaehlt.length, sourceName: CARD_NAME }))) {
        // Jede Karte fliegt an IHREN neuen Platz am Ende der Gegnerhand, und die Hand rückt erst beim EINTREFFEN dieser Karte zusammen: Ziel = Platz in einer Hand, die bis dahin genau
        // diese Karte mehr hat (`finalHandSize` = Platz + 1), die früheren Karten sind dann schon gelandet.
        for (const idx of [...gewaehlt].sort((a, b) => b - a)) {
          if (await engine.actionTransferCardToOppHand(pi, idx, { source: CARD_NAME, windowChecked: true, finalHandSize: (ops.hand || []).length + 1 })) gegeben++;
          if (gegeben < gewaehlt.length) await engine._delay(GEBEN_ABSTAND_MS);
        }
      }

      // ── 5. Nehmen: bis zu (gegeben − 2 als Zusatzaktion) Karten aus der URSPRÜNGLICHEN Gegnerhand — die verschenkten Karten (angehängt am Ende) sind tabu ──
      let genommen = 0;
      const boris = engine.isBorisBlocked({ stealsOpponentCards: true }, pi);
      const ursprung = Math.max(0, (ops.hand || []).length - gegeben);                 // Plätze 0 … ursprung−1 gehören dem Gegner von vornherein
      const nehmbar = Array.from({ length: ursprung }, (_, i) => i);
      const obergrenze = Math.min(Math.max(0, gegeben - (zusatz ? UEBERSCHUSS : 0)), ursprung);
      if (obergrenze > 0 && !boris && !ps.handLocked) {
        const wahl = await mitOffenerGegnerhand(engine, ops, () => engine.promptGeneric(pi, {
          type: 'blindHandPick',
          title: CARD_NAME,
          _lsPhase: 'take',
          description: `Take up to ${obergrenze} card${obergrenze === 1 ? '' : 's'} from ${ops.username}'s hand. The cards you just gave cannot be taken back.`,
          maxSelect: obergrenze,
          minSelect: 0,
          eligibleIndices: nehmbar,
          highlightStyle: 'strong',       // wählbare/gewählte Karten deutlich markiert (Client: `blind-pick-stark`), die verschenkten liegen ausgegraut daneben
          confirmLabel: '🫳 Take!',
          oppHandCount: (ops.hand || []).length,
          // pflichtwahl: das Geben ist schon geschehen; 0 gewählte Karten (Bestätigen ohne Auswahl) sind erlaubt
          cancellable: false,
        }));
        const roh = Array.isArray(wahl?.selectedIndices) ? wahl.selectedIndices : [];
        const sel = [...new Set(roh.filter(i => Number.isInteger(i) && nehmbar.includes(i)))].slice(0, obergrenze);
        if (sel.length > 0) {
          const r = await engine.actionStealFromHand(pi, { count: sel.length, preselectedIndices: sel, sourceName: CARD_NAME, highlightMs: NEHMEN_VOR_MS });
          genommen = (r?.stolen || []).length;
        }
      }

      engine.log('live_show_result', { player: ps.username, opponent: ops.username, gave: gegeben, took: genommen, additional: !!zusatz });
      engine.sync();
    },
  },

  /** CPU: Zusatzaktion bezahlen; die schlechtesten Karten geben, die besten nehmen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    const me = engine._cpuPlayerIdx;
    const ps = engine.gs.players?.[me];
    const ops = engine.gs.players?.[engine.opponentOf(me)];
    if (promptData._lsPhase === 'additional') return { optionId: 'regular' };
    if (promptData._lsPhase === 'give') {
      const idxs = (promptData.eligibleIndices || []).slice().sort((a, b) => kartenWert(engine, ps.hand[a]) - kartenWert(engine, ps.hand[b]));
      const n = promptData.minSelect || 0;
      return { selectedCards: idxs.slice(0, n).map(i => ({ handIndex: i, cardName: ps.hand[i] })) };
    }
    if (promptData._lsPhase === 'take') {
      const hand = ops?.hand || [];
      const idxs = (promptData.eligibleIndices || hand.map((_, i) => i)).slice().sort((a, b) => kartenWert(engine, hand[b]) - kartenWert(engine, hand[a]));
      return { selectedIndices: idxs.slice(0, promptData.maxSelect || 0) };
    }
    return undefined;
  },
};
