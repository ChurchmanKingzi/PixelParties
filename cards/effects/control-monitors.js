// ═══════════════════════════════════════════
//  CARD EFFECT: "Control Monitors"
//  Spell (Reaction) — Decay Magic + Magic Arts, Lv1
//
//  „Play this card immediately when your opponent adds 1 or more cards from
//   their deck or discard pile to their hand by discarding the same number of
//   cards from your hand. Delete the cards your opponent added. Your opponent
//   may delete all other cards in their hand instead."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „by discarding the same number of cards from your hand" = der Hinzufuegende zahlt den Tutor mit dem Abwurf von GENAU so vielen
//    Handkarten, wie er Karten aus Deck/Ablage auf die Hand nimmt (Cute Dog, Cute Annoyance Mini, Life-Searcher, Lunatic Cycle -
//    New Moon, Inventing). „your hand" im Kartentext wird so gelesen, dass die Hand des Hinzufuegenden gemeint ist (nur dort laesst
//    sich abwerfen und hinzufuegen) — Rueckfrage an Al, falls anders gemeint.
//  • Ein Fenster je Effekt, nicht je Karte („1 or more cards"): die Tutor-Karte ruft `engine.meldeHandZugangDurchAbwurf` EINMAL,
//    wenn alle Karten auf der Hand liegen (Hook `onHandAddByDiscard`, Reaktionsfenster der Engine).
//  • „Delete the cards your opponent added" — genau diese Karten (Handkarten gleichen Namens sind austauschbar). Sind einzelne schon nicht
//    mehr auf der Hand, faellt nur dieser Teil aus.
//  • „Your opponent may delete all other cards in their hand instead" — die WAHL liegt beim Hinzufuegenden; „all other" = alle Handkarten
//    ausser den hinzugefuegten (bei Namensgleichheit bleibt je hinzugefuegter Karte genau ein Exemplar). Ohne andere Handkarten entfaellt die Wahl.
//  • Loeschen ist kein Abwurf: Boris und Abwurf-Ersatz greifen nicht. Es FASST aber die Hand des Gegners an: „Ambush the Scout" darf es
//    negieren (`checkHandInteractionReaction`, verschachtelt). Das Loeschen laeuft ueber `deleteFromPile`
//    (Rettungs-Fenster wie Ash Worms, Geloescht-Stapel des BESITZERS, Flug).
// ═══════════════════════════════════════════

const CARD_NAME = 'Control Monitors';

/** Welche der gemeldeten Karten liegen noch auf der Hand des Hinzufuegenden? (Namen, mit Vielfachheit) */
function nochAufDerHand(ps, names) {
  const rest = {};
  for (const n of ps.hand || []) rest[n] = (rest[n] || 0) + 1;
  const out = [];
  for (const n of names) { if ((rest[n] || 0) > 0) { rest[n]--; out.push(n); } }
  return out;
}

module.exports = {
  isReaction: true,
  canActivate: () => false,

  // CPU: die Wahl des Hinzufuegenden (optionPicker) → die hinzugefuegten Karten loeschen (kleineres Uebel).
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'optionPicker' && promptData.title === CARD_NAME) return { optionId: 'added' };
    return undefined;
  },

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (chainCtx?.hookName !== 'onHandAddByDiscard') return false;
    const hc = chainCtx.hookCtx || {};
    if (hc.playerIdx == null || hc.playerIdx === pi) return false;
    if (!engine.opponentsOf(pi).includes(hc.playerIdx)) return false;
    const adderPs = gs.players[hc.playerIdx];
    if (!adderPs) return false;
    // Es muss noch etwas zu loeschen geben (sonst waere die Karte reine Verschwendung).
    return nochAufDerHand(adderPs, hc.cardNames || []).length > 0;
  },

  resolve: async (engine, pi, _selectedIds, _validTargets, _chain, _myIdx) => {
    const gs = engine.gs;
    const hc = engine.reactionWindowEvent?.()?.hookCtx;
    if (!hc || hc.playerIdx == null) return;
    const adder = hc.playerIdx;
    const adderPs = gs.players[adder];
    if (!adderPs) return;

    const added = nochAufDerHand(adderPs, hc.cardNames || []);
    if (!added.length) return;

    // „Other" = Hand ohne je ein Exemplar der hinzugefuegten Karten.
    const andere = [...adderPs.hand];
    for (const n of added) { const k = andere.indexOf(n); if (k >= 0) andere.splice(k, 1); }

    let wahl = 'added';
    if (andere.length > 0) {
      const res = await engine.promptGeneric(adder, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `${gs.players[pi]?.username || 'Your opponent'} activated Control Monitors. Delete the ${added.length === 1 ? 'card' : added.length + ' cards'} you added — or delete all your other cards instead.`,
        options: [
          { id: 'added', label: `🗑️ Delete the added card${added.length === 1 ? '' : 's'}: ${[...new Set(added)].join(', ')}` },
          { id: 'rest',  label: `💀 Delete all other cards in hand (${andere.length})` },
        ],
        cancellable: false,
      });
      wahl = res?.optionId === 'rest' ? 'rest' : 'added';
    }

    const ziel = wahl === 'rest' ? andere : added;
    // Das Loeschen fasst die Hand des Gegners an → Hand-Interaktion (Ambush the Scout darf den Effekt negieren). Verschachteltes Fenster,
    // weil wir mitten in der aufloesenden Reaktionskette stehen.
    if (await engine.checkHandInteractionReaction(adder, 'discard', { byPi: pi, count: ziel.length, sourceName: CARD_NAME, verschachtelt: true })) {
      engine.log('control_monitors_negated', { player: gs.players[pi]?.username, opponent: adderPs.username });
      return;
    }
    let geloescht = 0;
    for (const n of ziel) {
      if (await engine.deleteFromPile(adder, 'hand', n, { source: CARD_NAME, sourceOwner: pi })) geloescht++;
    }
    hc.geloeschtDurchMonitors = (hc.geloeschtDurchMonitors || 0) + geloescht;
    engine.log('control_monitors', { player: gs.players[pi]?.username, opponent: adderPs.username, choice: wahl, deleted: geloescht, added });
    engine.sync();
  },
};
