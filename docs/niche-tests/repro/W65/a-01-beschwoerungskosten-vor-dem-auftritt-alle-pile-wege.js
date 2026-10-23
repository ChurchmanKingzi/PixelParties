'use strict';
// W65a-01 · Beschwörungskosten (abbrechbare Opfer-/Tribut-Wahl der Kreatur) stehen VOR dem Auftritt — Forceful Revival + alle Pile-Wege der Engine, beide Sitze
//
// Befund (Gesamtlauf nach dem Merge von W64a + W64b, zwei rote Repros: W64/b-01 und W63/d-07): W64b committet den Auftritt VOR jedem „Effektschritt" (`engine.action…` + `AUFTRITT_SCHRITT_PRIMITIVE`), W64a fragt die Kosten
//   der beschworenen Karte VOR der Animation (`_beschwoerungKostenVorAuftritt`). `summonFromDiscard` und `summonCreatureWithHooks` standen in der Schritt-Liste: die Hülle committete beim AUFRUF — also VOR der
//   Kostenfrage, die erst im Inneren läuft. Brach der Spieler die Opfer-/Tribut-Wahl ab (Karte zurück in die Ablage, Zauber nicht verbraucht), hatten Gegner/Zuschauer schon `card_reveal` + Protokollzeilen.
// Regel (Al): der Gegner sieht NICHTS, solange der Spieler die Opfer-/Tribut-Wahl noch abbrechen kann; erst nach der letzten Abbruchstelle kommt der Auftritt, dann Animation/Effekt.
// Teil A: Forceful Revival × 7 Kreaturen mit Beschwörungskosten × beide Sitze (echter Spielweg, `W.durchlauf` + `W.pruefeDurchlauf`: Abbruch an JEDER Stelle → nichts gesehen; Durchlauf → Auftritt nach der Kostenwahl).
// Teil B: die Engine-Eintrittspunkte unter offener Vormerkung (wie der Server sie für einen Zauber setzt): summonFromDiscard (mit nachKostenAnim und mit vorAnim), summonFromDeck, summonFromPile (deck / discard / hand /
//   potionDeck), summonCreatureWithHooks (direkt, wie Divine Gift of the Deepsea / Monster Nest). Abbruch der Kostenfrage → Vormerkung bleibt offen, nichts an Gegner/Zuschauer, Karte zurück; Durchlauf → `card_reveal` NACH
//   der Antwort und VOR Flug/Animation/Landung. Gegenprobe ohne Kosten (Kreatur ohne beforeSummon, Modus revive): Auftritt vor Flug/Landung (W64b bleibt).
// Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const FR = 'Forceful Revival';
const PIRANHA = '500 Piranhas in a Monster Suit';
const KREATUREN = [
  [PIRANHA, 1], ['Archer of Teocuilatl', 1], ['Warrior of Teocuilatl', 1], ['Guardian of Teocuilatl', 1], ['Doctor Fester', 1], ['Empty Armor', 1], ['Blue-Ice Dragon', 3],
];

(async () => {
  const R = W.runner();

  // ── Teil A: Forceful Revival (echter Spielweg) ───────────────────────────────────────────────────────────────
  for (const seat of [0, 1]) {
    for (const [kre, fight] of KREATUREN) {
      const label = `A · ${FR} → ${kre}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = async () => {
        const t = await W.reicheSzene({ seat, karten: [FR], board: async (t2, s) => {
          t2.setAbilities(s, 0, [Array(fight).fill('Fighting'), [], []]);
          t2.gs.players[s].discardPile.push(kre);
        } });
        t._ablVor = t.gs.players[seat].discardPile.filter(x => x === kre).length;
        return t;
      };
      const antwort = (e) => (e.kind === 'generic' && e.d.type === 'cardGallery') ? { cardName: kre, source: 'discard' } : undefined;
      const d = await W.durchlauf(mk, seat, FR, { seat, hero: 0, maxCancel: 5, answer: antwort });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc: 1 });
      // Die Kostenfrage selbst muss abbrechbar sein UND eine echte Abbruchstelle (Karte + Zauber zurück), sonst prüft der Test die Lücke nicht
      const nKosten = d.clean.r.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
      const kostenAbbruch = d.cancels.filter(x => x.r.undone).length;
      R.check(`${label}: mindestens 2 echte Abbruchstellen (Galerie + Kostenwahl) — abbrechbar ${nKosten}, echt ${kostenAbbruch}`, kre === PIRANHA ? kostenAbbruch >= 2 : kostenAbbruch >= 1, { nKosten, kostenAbbruch });
      for (const { k, r, t } of d.cancels) {
        if (!r.undone) continue;
        R.check(`${label}: Abbruch an Stelle ${k} — ${kre} liegt wieder in der Ablage, Zauber nicht verbraucht (auf der Hand)`,
          t.gs.players[seat].discardPile.filter(x => x === kre).length === t._ablVor && t.inst(c => c.name === kre && c.zone === 'support').length === 0 && t.gs.players[seat].hand.includes(FR),
          { abl: t.gs.players[seat].discardPile.filter(x => x === kre).length, vor: t._ablVor, hand: t.gs.players[seat].hand.includes(FR) });
        R.check(`${label}: Abbruch an Stelle ${k} — kein Ramm-Anlauf / keine Animation an Gegner/Zuschauer`,
          !r.tl.some(e => e.k === 'wire' && /ram_animation|zone_animation|pile_transfer|summon_effect|hand_to_board_fly/.test(e.ev) && e.sid !== 'S' + seat), r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && /animation|transfer|summon_effect/.test(e.ev)).map(e => e.sid + ':' + e.ev));
      }
      // Durchlauf: card_reveal kommt NACH der letzten echten Abbruchstelle (Kostenwahl) und VOR dem Ramm-Anlauf für den Gegner. (500 Piranhas legt sich selbst auf die Seite des Gegners — kein Anlauf; Blue-Ice
      // Dragon fragt nach dem bezahlten Opfer noch einmal (bestätigen), das ist keine Abbruchstelle des Zaubers mehr: das Opfer ist bezahlt.)
      const c = d.clean.r;
      const iRamm = c.tl.findIndex(e => e.k === 'wire' && e.ev === 'play_ram_animation' && e.sid !== 'S' + seat);
      const canIdx = []; c.tl.forEach((e, i) => { if (e.k === 'answer-begin' && e.cancellable) canIdx.push(i); });
      const kMax = Math.max(-1, ...d.cancels.filter(x => x.r.undone).map(x => x.k));
      const iGrenze = kMax >= 0 ? canIdx[kMax] : -1;
      const iReveal = c.tl.findIndex(e => e.k === 'wire' && e.ev === 'card_reveal' && e.sid !== 'S' + seat);
      R.check(`${label}: Durchlauf — card_reveal kommt NACH der letzten echten Abbruchstelle (Kostenwahl) und VOR dem Ramm-Anlauf`, iReveal > iGrenze && (iRamm < 0 || iRamm > iReveal), { iGrenze, iReveal, iRamm });
    }
  }

  // ── Teil B: Engine-Eintrittspunkte unter offener Vormerkung ───────────────────────────────────────────────────
  const AUFRUFE = [
    ['summonFromDiscard (+nachKostenAnim)', 'discard', (t, seat, kre) => t.engine.summonFromDiscard(seat, seat, kre, 0, 0, { source: 'W65-Test', flug: false, nachKostenAnim: async () => { t.engine._broadcastEvent('play_ram_animation', { sourceOwner: seat, sourceHeroIdx: 0, targetOwner: seat, targetHeroIdx: 0, targetZoneSlot: 0, cardName: 'Test', duration: 100 }); } }), 'play_ram_animation'],
    ['summonFromDiscard (+vorAnim, Flug)', 'discard', (t, seat, kre) => t.engine.summonFromDiscard(seat, seat, kre, 0, 0, { source: 'W65-Test', vorAnim: { type: 'angel_revival', ms: 50 } }), 'play_zone_animation'],
    ['summonFromDeck', 'deck', (t, seat, kre) => t.engine.summonFromDeck(seat, kre, 0, 0, { source: 'W65-Test' }), 'play_pile_transfer'],
    ['summonFromPile(deck)', 'deck', (t, seat, kre) => t.engine.summonFromPile(seat, 'deck', kre, 0, 0, { source: 'W65-Test' }), 'play_pile_transfer'],
    ['summonFromPile(discard)', 'discard', (t, seat, kre) => t.engine.summonFromPile(seat, 'discard', kre, 0, 0, { source: 'W65-Test' }), 'play_pile_transfer'],
    ['summonFromPile(hand)', 'hand', (t, seat, kre) => t.engine.summonFromPile(seat, 'hand', kre, 0, 0, { source: 'W65-Test' }), 'play_pile_transfer'],
    ['summonFromPile(potionDeck)', 'potionDeck', (t, seat, kre) => t.engine.summonFromPile(seat, 'potionDeck', kre, 0, 0, { source: 'W65-Test' }), 'play_pile_transfer'],
    ['summonCreatureWithHooks (direkt, isPlacement)', null, (t, seat, kre) => t.engine.summonCreatureWithHooks(kre, seat, 0, 0, { source: 'W65-Test', isPlacement: true }), 'summon_effect'],
  ];
  for (const seat of [0, 1]) {
    for (const [bez, pile, aufruf, sichtbar] of AUFRUFE) {
      for (const kre of [PIRANHA, 'Warrior of Teocuilatl']) {
        const label = `B · ${bez} → ${kre}${seat ? ' (Sitz 1)' : ''}`;
        R.section(label);
        const mk = async () => {
          const t = await W.reicheSzene({ seat, karten: [] });
          const ps = t.gs.players[seat];
          if (pile) { const arr = pile === 'deck' ? ps.mainDeck : pile === 'discard' ? ps.discardPile : pile === 'hand' ? ps.hand : ps.potionDeck; arr.unshift(kre); }
          t.gs.activePlayer = seat; t.phase(3);
          return t;
        };
        const lauf = async (cancelAt) => {
          const t = await mk();
          t.gs._pendingCardReveal = { cardName: FR, ownerIdx: seat };      // wie der Server für einen Zauber vormerkt (Zauber ist NICHT in der Szene: der Name taucht nur im Auftritt auf)
          const r = await W.spiele(t, seat, FR, { cancelAt, persist: true, call: () => aufruf(t, seat, kre), undoneFn: () => true });
          return { t, r };
        };
        const clean = await lauf(null);
        const nC = clean.r.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
        R.check(`${label}: Durchlauf — Kostenfrage abbrechbar (${nC}) und ${kre} liegt auf dem Brett`, nC >= (kre === PIRANHA ? 1 : 0) && clean.t.inst(c => c.name === kre && c.zone === 'support').length >= 1 && clean.t.errors.length === 0, { nC, z: clean.t.inst(c => c.name === kre).map(c => c.zone), e: clean.t.errors });
        const tl = clean.r.tl;
        const iAnt = (() => { let r = -1; tl.forEach((e, i) => { if (e.k === 'answer') r = i; }); return r; })();
        const iRev = tl.findIndex(e => e.k === 'wire' && e.ev === 'card_reveal' && e.sid !== 'S' + seat);
        const iSicht = tl.findIndex((e, i) => i > iAnt && e.k === 'wire' && e.ev === sichtbar && e.sid !== 'S' + seat);
        R.check(`${label}: Durchlauf — Auftritt (card_reveal) NACH der Kostenantwort und VOR ${sichtbar}`, iRev > iAnt && (iSicht < 0 || iRev < iSicht) && clean.t.gs._pendingCardReveal === undefined, { iAnt, iRev, iSicht, offen: !!clean.t.gs._pendingCardReveal });
        R.check(`${label}: Durchlauf — Gegner UND Zuschauer sehen den Auftritt`, tl.some(e => e.k === 'wire' && e.ev === 'card_reveal' && e.sid === 'SPEC') && iRev >= 0);
        if (nC >= 1) {
          const cx = await lauf(0);
          R.check(`${label}: Abbruch der Kostenfrage — abgebrochen, keine Engine-Fehler`, cx.r.cancelled && cx.t.errors.length === 0, { c: cx.r.cancelled, e: cx.t.errors });
          R.check(`${label}: Abbruch der Kostenfrage — Gegner/Zuschauer haben NICHTS über die Karte erhalten (kein card_reveal, keine Zeile, kein Name im Zustand)`, cx.r.appearances.length === 0 && cx.r.stateLeaks.length === 0 && cx.r.kanalLeaks.length === 0, { app: cx.r.leakEvents, st: cx.r.stateLeaks.length });
          R.check(`${label}: Abbruch der Kostenfrage — keine Animation/kein Flug an Gegner/Zuschauer (${sichtbar})`, !cx.r.tl.some(e => e.k === 'wire' && e.ev === sichtbar && e.sid !== 'S' + seat), cx.r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && e.ev !== 'game_state').map(e => e.sid + ':' + e.ev));
          R.check(`${label}: Abbruch der Kostenfrage — die Vormerkung der Karte bleibt offen (Auftritt nicht verbraucht)`, !!cx.t.gs._pendingCardReveal && cx.t.gs._pendingCardReveal.cardName === FR, cx.t.gs._pendingCardReveal);
          R.check(`${label}: Abbruch der Kostenfrage — ${kre} nicht auf dem Brett${pile ? ', wieder im Stapel' : ''}`, cx.t.inst(c => c.name === kre && c.zone === 'support').length === 0, cx.t.inst(c => c.name === kre).map(c => c.zone));
        }
      }
    }
  }

  // ── Gegenprobe ohne Kosten: Kreatur ohne beforeSummon und Modus revive — der Auftritt kommt weiterhin vor Flug und Landung (W64b) ────────────────────────────────────
  for (const seat of [0, 1]) {
    for (const [bez, modus] of [['summonFromDiscard (summon, Kreatur ohne Kosten)', 'summon'], ['summonFromDiscard (revive, keine Kosten)', 'revive']]) {
      const label = `C · ${bez}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const kre = W.REICH.CRE[0];
      const t = await W.reicheSzene({ seat, karten: [] });
      t.gs.players[seat].discardPile.unshift(kre); t.gs.activePlayer = seat; t.phase(3);
      t.gs._pendingCardReveal = { cardName: FR, ownerIdx: seat };
      const r = await W.spiele(t, seat, FR, { call: () => t.engine.summonFromDiscard(seat, seat, kre, 0, 0, { source: 'W65-Test', mode: modus }), undoneFn: () => true });
      const iRev = r.tl.findIndex(e => e.k === 'wire' && e.ev === 'card_reveal' && e.sid !== 'S' + seat);
      const iFlug = r.tl.findIndex(e => e.k === 'wire' && e.ev === 'play_pile_transfer' && e.sid !== 'S' + seat);
      R.check(`${label}: card_reveal vor dem Flug (Ablage → Zone)`, iRev >= 0 && iFlug > iRev, { iRev, iFlug });
      R.check(`${label}: Kreatur auf dem Brett, keine Fehler`, t.inst(c => c.name === kre && c.zone === 'support').length === 1 && t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
