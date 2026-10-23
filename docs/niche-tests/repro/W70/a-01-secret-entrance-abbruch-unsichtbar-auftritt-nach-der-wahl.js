'use strict';
// W70a-01 · Secret Entrance: Auftritt und Terror-Zähler erst NACH dem Commit der abbrechbaren blinden Wahl (Al, 22.10./23.10.2026)
//
// Karte (neu, 23.10.): „Choose up to 1/2/3 random cards from your opponent's hand and add them to your hand. While your opponent has at least twice as many cards in their hand as you, this counts as
//   an additional Action." (Spell Normal, Magic Arts Lv1.)
// Befund (Sweeps W63/d-07, W66/b-08, b-10 rot nach dem Merge): das Skript rief `engine.actionStealFromHand(… cancellable: true)` — die Auftritts-Hülle der `action…`-Primitive zeigte die Karte
//   (card_reveal, spell_played, Zustand) schon beim AUFRUF, also vor der abbrechbaren blinden Wahl, und der Terror-Zähler (beiCommit) wurde gesetzt; ein Abbruch ließ `_terrorTracking[Sitz]` = ["Secret Entrance"].
// Jetzt: die abbrechbare Wahl läuft über `engine.blindHandWahl` (ohne Hülle), erst danach `actionStealFromHand` mit `preselectedIndices` → Commit, Auftritt, dann der Diebstahl.
// Geprüft (beide Sitze): (A) Abbruch der Wahl → Gegner/Zuschauer sehen nichts, Zustandsdifferenz 0, Terror-Zähler unverändert, Karte auf der Hand; (B) Durchlauf → Auftritt NACH der Wahl und VOR dem
//   Flug/der ersten Effektzeile, Terror-Zähler gesetzt, Karte(n) auf der Hand des Spielers; (C) „up to": Mindestauswahl 1, Höchstauswahl = Magic-Arts-Stufe (1/2/3, geklemmt auf die Gegnerhand),
//   zwei gewählte Karten wandern beide. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const SE = 'Secret Entrance';
const terror = (t, seat) => ((t.gs._terrorTracking || {})[seat] || []).slice();

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    // (A)+(B) Standard-Szene: Magic Arts Lv1 → eine Karte
    {
      const label = `[S${seat}] ${SE}`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [SE], board: async (t) => { t.grantFor(seat, 0, SE); } });
      const answer = (e) => (e.kind === 'generic' && e.d.type === 'blindHandPick') ? { selectedIndices: [0] } : undefined;
      const d = await W.durchlauf(mk, seat, SE, { seat, hero: 0, maxCancel: 4, answer });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc: 1, nEcht: 1 });
      const c = d.clean;
      R.check(`${label}: Durchlauf — Karte gespielt, Terror-Zähler zählt sie`, c.r.handNachher < c.r.handVorher && terror(c.t, seat).includes(SE), { hand: [c.r.handVorher, c.r.handNachher], terror: terror(c.t, seat) });
      R.check(`${label}: Durchlauf — eine Gegnerkarte wanderte auf die Hand des Spielers`, c.t.gs.players[opp].hand.length === 2 && c.t.lg('hand_steal').length === 1, { opp: c.t.gs.players[opp].hand.length, steal: c.t.lg('hand_steal') });
      // Reihenfolge je Empfänger: card_reveal vor dem Flug (play_hand_steal)
      for (const sid of ['S' + opp, 'SPEC']) {
        const w = c.r.tl.map((e, i) => [e, i]).filter(([e]) => e.k === 'wire' && e.sid === sid);
        const iR = w.find(([e]) => e.ev === 'card_reveal' && e.data && e.data.cardName === SE);
        const iF = w.find(([e]) => e.ev === 'play_hand_steal');
        R.check(`${label}: ${sid} — Auftritt (card_reveal) kommt VOR dem Diebstahl-Flug`, !!iR && !!iF && iR[1] < iF[1], { reveal: iR && iR[1], flug: iF && iF[1] });
      }
      const abbr = d.cancels.filter(x => x.r.undone);
      R.check(`${label}: Abbruch der blinden Wahl ist eine echte Abbruchstelle`, abbr.length >= 1, d.cancels.map(x => [x.k, x.r.undone]));
      for (const { k, r, t } of abbr) {
        R.check(`${label}: Abbruch an Stelle ${k} — Terror-Zähler unverändert (leer)`, terror(t, seat).length === 0, terror(t, seat));
        R.check(`${label}: Abbruch an Stelle ${k} — Gegner/Zuschauer sehen nichts (keine Sendung über die Karte)`, r.appearances.length === 0 && (r.leakEvents || []).length === 0, r.leakEvents);
        R.check(`${label}: Abbruch an Stelle ${k} — Zustandsdifferenz = 0`, (r.zustandsDiff || []).length === 0, (r.zustandsDiff || []).slice(0, 6));
        R.check(`${label}: Abbruch an Stelle ${k} — Hände unverändert`, t.gs.players[opp].hand.length === 3 && t.gs.players[seat].hand.includes(SE), { opp: t.gs.players[opp].hand });
      }
    }
    // (C) Magic Arts Lv3, Gegner mit 4 Handkarten → „up to 3": min 1, max 3, zwei gewählte Karten wandern
    {
      const label = `[S${seat}] ${SE} (Magic Arts Lv3, up to 3)`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [SE], board: async (t) => { t.setAbilities(seat, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]); t.addHand(opp, W.REICH.CRE[2]); } });
      let gesehen = null;
      const answer = (e) => { if (e.kind === 'generic' && e.d.type === 'blindHandPick') { gesehen = { min: e.d.minSelect, max: e.d.maxSelect, canc: !!e.d.cancellable }; return { selectedIndices: [1, 3] }; } return undefined; };
      const d = await W.durchlauf(mk, seat, SE, { seat, hero: 0, maxCancel: 3, answer });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc: 1, nEcht: 1 });
      const c = d.clean;
      R.check(`${label}: Auswahl „up to 3": mindestens 1, höchstens 3, abbrechbar`, gesehen && gesehen.min === 1 && gesehen.max === 3 && gesehen.canc, gesehen);
      R.check(`${label}: zwei gewählte Karten wandern, zwei bleiben beim Gegner`, c.t.gs.players[opp].hand.length === 2 && (c.t.lg('hand_steal')[0] || {}).stolen && c.t.lg('hand_steal')[0].stolen.length === 2, { opp: c.t.gs.players[opp].hand, steal: c.t.lg('hand_steal') });
      for (const { k, r, t } of d.cancels.filter(x => x.r.undone)) {
        R.check(`${label}: Abbruch an Stelle ${k} — Zustandsdifferenz = 0, Terror leer`, (r.zustandsDiff || []).length === 0 && terror(t, seat).length === 0, { diff: (r.zustandsDiff || []).slice(0, 4), terror: terror(t, seat) });
      }
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
