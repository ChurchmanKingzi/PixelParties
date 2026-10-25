// ═══════════════════════════════════════════
//  CARD EFFECT: "Control Monitors"
//  Spell (Reaction) — Decay Magic + Magic Arts, Lv1
//
//  „Play this card immediately when your opponent adds 1 or more cards from
//   their deck or discard pile to their hand by discarding the same number of
//   cards from your hand. Delete the cards your opponent added. Your opponent
//   may delete all other cards in their hand instead."
//
//  ── AUSLEGUNG (Al, Fehlerbericht W72a: „Die Puzzle-CPU aktiviert trotz eines Heroes, der das könnte, nie ‚Control Monitors' in Reaktion auf meine Magnetic Potion.
//     Die Erwartung ist: Ich füge eine Karte meiner Hand hinzu, also sollte Monitors eingesetzt werden und die nehmen!") ────────────
//  • AUSLÖSER ist JEDES Hinzufügen von 1 oder mehr Karten aus dem Deck ODER der Ablage des Gegners auf dessen Hand (Magnetic Potion, Gate to the
//    Armory, Boomerang, Cute Dog …) — NICHT erst ein Tutor mit Abwurf. (Bis W72a las das Skript „by discarding the same number of cards from your hand"
//    als Preis des HINZUFÜGENDEN; nur die Abwurf-Tutoren öffneten ein Fenster.) Nicht ausgelöst wird durch: Ziehen (draw ist kein „add"), Karte vom Brett
//    zurück auf die Hand, Karten aus FREMDEN Stapeln (Infiltration, Xiong …), Potion Deck, Gelöscht-Stapel (Rückfragen an Al im Bericht).
//  • „by discarding the same number of cards from your hand" ist der PREIS DES REAKTIONSSPIELERS („your hand" = die Hand dessen, der Control Monitors spielt):
//    er wirft so viele Handkarten ab, wie der Gegner hinzugefügt hat, ZUSÄTZLICH zu Control Monitors selbst. Gewählt wird bei der Aktivierung
//    (`reactionKostenWahl`, abbrechbar → nichts passiert), bezahlt erst danach (`reactionKostenZahlen`; Regel „Kosten erst nach dem Commit", W66b). Boris darf den Abwurf
//    wie bei jedem Abwurf-Preis ignorieren (die Reaktion läuft dann ohne Abwurf).
//  • Zwei Bedingungen für das Angebot: (1) die Hand des Reaktionsspielers hat mindestens N WEITERE Karten (N = Anzahl der hinzugefügten Karten; ein notwendiger
//    Weisheits-Abwurf des Wirkers kommt dazu), (2) mindestens eine der hinzugefügten Karten liegt noch auf der Hand des Gegners.
//  • Ein Fenster je Effekt, nicht je Karte („1 or more cards"): die Engine sammelt die Zugänge zentral (`engine.noteHandZugangAusStapel`, gerufen von
//    `handZugang`/`actionAddCardFromDeckToHand`/`addCardFromDiscardToHand`) und meldet sie EINMAL mit dem Hook `onHandAddFromPile`
//    (Nach-Ketten-Aktion, oder früher, wenn die Tutor-Karte `engine.meldeHandZugangAusStapel` selbst ruft). Navigation zählt (Al, Welle 75).
//  • „Delete the cards your opponent added" — genau diese Karten (Handkarten gleichen Namens sind austauschbar). Sind einzelne schon nicht
//    mehr auf der Hand, faellt nur dieser Teil aus.
//  • „Your opponent may delete all other cards in their hand instead" — die WAHL liegt beim Hinzufuegenden; „all other" = alle Handkarten
//    ausser den hinzugefuegten (bei Namensgleichheit bleibt je hinzugefuegter Karte genau ein Exemplar). Ohne andere Handkarten entfaellt die Wahl.
//  • Loeschen ist kein Abwurf: Boris und Abwurf-Ersatz greifen nicht. Es FASST aber die Hand des Gegners an: „Ambush the Scout" darf es
//    negieren (`checkHandInteractionReaction`, verschachtelt). Das Loeschen laeuft ueber `deleteFromPile`
//    (Rettungs-Fenster wie Ash Worms, Geloescht-Stapel des BESITZERS, Flug).
// ═══════════════════════════════════════════

const CARD_NAME = 'Control Monitors';
const HOOK = 'onHandAddFromPile';

/** Welche der gemeldeten Karten liegen noch auf der Hand des Hinzufuegenden? (Namen, mit Vielfachheit) */
function nochAufDerHand(ps, names) {
  const rest = {};
  for (const n of ps.hand || []) rest[n] = (rest[n] || 0) + 1;
  const out = [];
  for (const n of names) { if ((rest[n] || 0) > 0) { rest[n]--; out.push(n); } }
  return out;
}

/** N = Anzahl der Karten, die der Gegner hinzugefuegt hat (auch die schon wieder weg sind: „the same number of cards"). */
function anzahlHinzugefuegt(hc) {
  return Math.max(1, hc?.hinzugefuegt ?? (hc?.cardNames || []).length);
}

/** Kleinster Weisheits-Abwurf, den ein Held von `pi` fuer diese Karte braucht (0 = ein Held erfuellt die Stufe ohne). */
function minWeisheit(engine, pi) {
  const cd = engine._getCardDB()[CARD_NAME];
  let best = null;
  for (let hi = 0; hi < (engine.gs.players[pi]?.heroes || []).length; hi++) {
    try {
      if (!engine._canHeroActivateSurprise(pi, hi, CARD_NAME, { spellInHand: true })) continue;
      const w = engine.getWisdomDiscardCost(pi, hi, cd) || 0;
      if (best == null || w < best) best = w;
    } catch { /* Held nicht pruefbar */ }
  }
  return best ?? 0;
}

module.exports = {
  isReaction: true,
  canActivate: () => false,

  // CPU: die Wahl des Hinzufuegenden (optionPicker) → die hinzugefuegten Karten loeschen (kleineres Uebel).
  // Die Abwurfwahl des Reaktionsspielers (handPick) beantwortet das CPU-Gehirn nach Kartenwert (billigste/entbehrlichste zuerst);
  // nur ohne Gehirn (Puzzle-Gegner) greift der einfache Ersatz unten.
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'optionPicker' && promptData.title === CARD_NAME) return { optionId: 'added' };
    if (promptData?.type === 'handPick' && promptData.title === CARD_NAME && !engine._cpuBrainInstalled) {
      const ps = engine.gs.players[engine._cpuPlayerIdx];
      const db = engine._getCardDB();
      const wert = (i) => { const cd = db[ps?.hand?.[i]] || {}; return (cd.level || 0) * 10 + (cd.cost || 0) + (cd.cardType === 'Ascended Hero' ? 200 : 0); };
      const n = promptData.maxSelect || 1;
      const idx = (promptData.eligibleIndices || []).slice().sort((a, b) => wert(a) - wert(b)).slice(0, n);
      return { selectedCards: idx.map(i => ({ handIndex: i, cardName: ps.hand[i] })) };
    }
    return undefined;
  },

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (chainCtx?.hookName !== HOOK) return false;
    const hc = chainCtx.hookCtx || {};
    if (hc.playerIdx == null || hc.playerIdx === pi) return false;
    if (!engine.opponentsOf(pi).includes(hc.playerIdx)) return false;
    const adderPs = gs.players[hc.playerIdx];
    const myPs = gs.players[pi];
    if (!adderPs || !myPs) return false;
    // Es muss noch etwas zu loeschen geben (sonst waere die Karte reine Verschwendung).
    if (nochAufDerHand(adderPs, hc.cardNames || []).length === 0) return false;
    // Preis: N weitere Handkarten (Control Monitors selbst liegt noch in der Hand und zaehlt nicht), dazu ein noetiger Weisheits-Abwurf.
    const weitere = (myPs.hand || []).length - 1;
    return weitere - minWeisheit(engine, pi) >= anzahlHinzugefuegt(hc);
  },

  /**
   * Abwurfwahl bei der Aktivierung (abbrechbar: Abbruch = die Reaktion kommt nicht zustande, nichts ist bezahlt). Gewaehlt werden N Handkarten
   * ausser der aktivierenden Kopie; bezahlt wird erst in `reactionKostenZahlen`.
   */
  async reactionKostenWahl(engine, pi, chainCtx, info) {
    const hc = chainCtx?.hookCtx || {};
    const n = anzahlHinzugefuegt(hc);
    const ps = engine.gs.players[pi];
    if (!ps) return null;
    const waehlbar = (ps.hand || []).map((_, i) => i).filter(i => i !== info.handIdx);
    if (waehlbar.length - (info.wisdomCost || 0) < n) return null;   // der gewaehlte Wirker braucht mehr Weisheits-Abwurf, als uebrig bleibt
    const res = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: CARD_NAME,
      description: `Choose ${n} card${n === 1 ? '' : 's'} from your hand to discard — your opponent added ${n} card${n === 1 ? '' : 's'} to their hand.`,
      eligibleIndices: waehlbar,
      minSelect: n,
      maxSelect: n,
      confirmLabel: `Discard ${n} & play Control Monitors`,
      cancellable: true,
    });
    if (!res || res.cancelled || !Array.isArray(res.selectedCards)) return null;
    const idx = [...new Set(res.selectedCards.map(c => c.handIndex))].filter(i => waehlbar.includes(i));
    if (idx.length !== n) return null;
    return { namen: idx.map(i => ps.hand[i]), anzahl: n };
  },

  /** Zahlung der gewaehlten Karten: Control Monitors liegt schon nicht mehr in der Hand. Ein Abwurf-Vorgang (Cute Bunny: „2 or more at once"). */
  async reactionKostenZahlen(engine, pi, wahl) {
    const namen = (wahl?.namen || []).slice();
    if (!namen.length) return;
    await engine.withDiscardBatch(pi, { source: CARD_NAME }, async () => {
      // Boris: ein Abwurf-PREIS darf ignoriert werden (die Reaktion laeuft dann ohne Abwurf).
      if (await engine.borisVerzicht(pi, namen.length, { source: CARD_NAME })) return;
      for (const n of namen) await engine.actionDiscardHandCard(pi, n, null, { source: CARD_NAME, _noGlow: true });
    });
    engine.sync();
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
    // Bild: drei rote Monitore flackern ueber der Seite des Hinzufuegenden (Vorlage: das Kartenbild), danach fliegen die Karten in den Geloescht-Stapel.
    const heroAnker = Math.max(0, (adderPs.heroes || []).findIndex(h => h?.name && h.hp > 0));
    engine._broadcastEvent('play_zone_animation', {
      type: 'control_monitors', zoneType: 'board', owner: adder, heroIdx: -1, zoneSlot: -1, duration: 1300,
      targets: [{ owner: adder, heroIdx: heroAnker, zoneSlot: -1, cardName: added[0] }],
      originOwner: pi, originHeroIdx: 0, originZoneSlot: -1, mode: wahl,
    });
    await engine._delay(900);
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
