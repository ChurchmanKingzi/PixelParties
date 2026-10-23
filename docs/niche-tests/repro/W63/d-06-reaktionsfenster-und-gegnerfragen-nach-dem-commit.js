'use strict';
// W63d-06 · Reaktionsfenster und Fragen an den GEGNER: der Auftritt kommt VOR seiner Frage, aber erst NACH den abbrechbaren Wahlen des Spielers (Al, 22.10.2026)
//
// Regel (CARD_API „Auftritt streamen — erst nach dem Commit"): „Reaktionen auf das Spielen einer Karte gibt es erst, wenn sie gespielt wird." Der Gegner muss die Karte sehen, sobald er gefragt wird
//   (Konter-Fenster, „Gegner wählt zuerst"), und der Spieler hat sie dann verbindlich gespielt — es gibt keine Abbruchstelle mehr danach. Deshalb:
//   • Treasure Hunter's Backpack wählt seine Ausrüstung und den Träger VOR dem Reaktionsfenster (`payArtifactCost`): alle drei abbrechbaren Stellen des Spielers liegen VOR dem ersten Auftritt,
//     danach (Auftritt) fragt der Gegner „Tool Freezer einsetzen?". Negiert er, bleibt das Deck unberührt (nichts gemischt, nichts ausgerüstet); lehnt er ab, wirkt das Backpack.
//   • Bottled Flame: „Der Gegner wählt zuerst" — sein Abwurf-Dialog kommt NACH dem Auftritt.
// Szene: reiche Standard-Szene; Gegner hält Tool Freezer + Gold; MENSCH-Modus. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const B = "Treasure Hunter's Backpack", FREEZER = 'Tool Freezer';
const EQ = ['Club of Gobbo', 'Cloak of Edge'];
// Frage an den Gegner = der Moment, in dem sie WIRKLICH offen ist (answer-begin der Pumpe), nicht der Aufruf davor (in dem der Auftritt gerade erst committet).
const frageOffen = (r, sitz) => r.tl.findIndex(e => e.k === 'answer-begin' && e.pi === sitz);
const ersterAuftritt = (r, sid) => r.tl.findIndex(e => e.k === 'wire' && e.sid === sid && e.ev === 'card_reveal' && e.data && e.data.cardName === B);
(async () => {
  const R = W.runner();
  for (const nimmt of [true, false]) {
    R.section(`Backpack gegen Tool Freezer — Gegner ${nimmt ? 'negiert' : 'lehnt ab'}`);
    const t = await W.fresh({ scanState: true, hand: [[B], [FREEZER]], deck: [[...EQ, ...Array(18).fill(W.INERT.creature)], Array(18).fill(W.INERT.creature)], gold: [100, 100] });
    // Der Gegner antwortet auf „Tool Freezer einsetzen?" mit Ja/Nein
    const r = await W.spiele(t, 0, B, { answer: (e) => (e.kind === 'generic' && e.pi === 1 && e.d.type === 'confirm') ? (nimmt ? { confirmed: true } : { cancelled: true }) : undefined });
    const fr1 = frageOffen(r, 1);
    const letzteWahl = Math.max(...r.tl.map((e, i) => (e.k === 'answer-begin' && e.cancellable) ? i : -1));
    const auftritt = ersterAuftritt(r, 'S1');
    R.check('der Gegner wurde gefragt (Konter-Fenster)', fr1 >= 0, r.tl.filter(e => e.k === 'prompt').map(e => `${e.pi}:${e.d && e.d.type}`));
    R.check('alle abbrechbaren Stellen des Spielers (3) liegen VOR der Frage an den Gegner', r.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length >= 3 && letzteWahl < fr1, { letzteWahl, fr1 });
    R.check('der Auftritt kommt VOR der Frage an den Gegner', auftritt >= 0 && auftritt < fr1, { auftritt, fr1 });
    R.check('… aber NACH der letzten abbrechbaren Wahl des Spielers', auftritt > letzteWahl, { auftritt, letzteWahl });
    R.check('Zuschauer: Auftritt ebenfalls erst nach der letzten Wahl', r.tl.findIndex(e => e.k === 'wire' && e.sid === 'SPEC' && e.ev === 'card_reveal') > letzteWahl);
    R.check('Zustand: kein Kartenname an den Gegner vor der letzten Wahl', r.stateLeaks.filter(i => i < letzteWahl).length === 0, r.stateLeaks.slice(0, 4));
    R.check('Auftritt genau einmal', r.tl.filter(e => e.k === 'wire' && e.sid === 'S1' && e.ev === 'card_reveal' && e.data.cardName === B).length === 1);
    const ps = t.gs.players[0];
    const ausgeruestet = ps.supportZones.some(h => h.some(z => z.length && EQ.includes(z[0])));
    if (nimmt) {
      R.check('negiert: die Ausrüstung wurde NICHT angelegt, das Deck ist unberührt', !ausgeruestet && EQ.every(e => ps.mainDeck.includes(e)), { ausgeruestet });
      R.check('negiert: das Backpack ist verbraucht (Ablage)', !ps.hand.includes(B), ps.hand);
    } else {
      R.check('abgelehnt: die Ausrüstung liegt am Träger', ausgeruestet, ps.supportZones);
    }
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('Bottled Flame: der Gegner wählt zuerst — Auftritt vor seiner Frage');
  {
    const t = await W.reicheSzene({ seat: 0, karten: ['Bottled Flame'] });
    const r = await W.spiele(t, 0, 'Bottled Flame', {});
    const fr1 = frageOffen(r, 1);
    const auftritt = r.tl.findIndex(e => e.k === 'wire' && e.sid === 'S1' && e.ev === 'card_reveal' && e.data && e.data.cardName === 'Bottled Flame');
    R.check('Gegner wird gefragt', fr1 >= 0);
    R.check('Auftritt vor der Gegnerfrage', auftritt >= 0 && auftritt < fr1, { auftritt, fr1 });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
