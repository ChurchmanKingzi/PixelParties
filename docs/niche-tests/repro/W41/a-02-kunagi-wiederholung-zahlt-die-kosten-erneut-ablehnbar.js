'use strict';
// W41a · Punkt 2 · Al, 22.10.2026 (Antwort auf W40a-Rückfrage 2): „Nein, in jedem Fall müssen die Kosten wiederholt werden! Natürlich darf der Spieler das auch ablehnen, dann triggert Kunagi nicht und seine
//  Ladung wird nicht verbraucht (gilt generell)." — W42a · Punkt 1 und 3 · Al, 22.10.2026 präzisiert: Preis (Opfer von Brackle/Greatmaw, weiteres Equip bei Javelin Throw) wird erneut bezahlt; eine
//  AKTIVIERUNGSBEDINGUNG/ein Auslöser (Sacrificial Dagger „when you sacrifice a target", Bamboo Staff „when a card is added from your discard pile") und das Ausspielen/die Aktion (Kohta „spend your Action")
//  werden bei der Wiederholung NICHT erneut bezahlt: „Die zweite Aktivierung kostet NICHTS extra!"; „Die Aktion des ersten Schlags reicht."
// Dieses Repro prüft die Wiederholung von Dagger (kein weiteres Opfer), Bamboo Staff (keine weitere Ablagekarte) und Kohta (keine weitere Zusatzaktion), Ablehnen (Abbruch der Zielwahl) = nichts verbraucht.
//   (Brackle, Infected Greatmaw: weiteres Opfer; Javelin Throw: weiteres Equip — W40a, `W40/a-03`.)
// Aufbau wie `W40/a-03`: der Schlagende trägt Kunagi, der Gegner hat 4 Kreaturen mit je 10 HP (jeder Schlag besiegt genau 1).
// Aufruf: node docs/niche-tests/repro/W41/a-02-kunagi-wiederholung-zahlt-die-kosten-erneut-ablehnbar.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H, setzeFrei } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const KUNAGI = 'Idej Sword - Kunagi';

async function lauf(name, me, op, o = {}) {
  const sp = L.TREIBER[name];
  const opferSeite = sp.opferSeite === 'me' ? me : op;
  const logs = [];
  const r = await L.szene(name, me, op, {
    ziel: 'creature', kreaturName: H.INERT.frail, kreaturHp: 10, F: 1, ...(o.szene || {}),
    vorbereiten: async (t, k) => {
      const _log = t.engine.log.bind(t.engine);
      t.engine.log = (n, d) => { logs.push({ n, d }); return _log(n, d); };
      for (const [hi, sl] of [[0, 0], [0, 1], [2, 0]]) { const c = t.put(opferSeite, hi, sl, H.INERT.frail); c.turnPlayed = 1; }
      if (!o.ohneKunagi) setzeFrei(t, k.as, k.held, KUNAGI);
      if (o.wrap) {
        let tf = null;
        Object.defineProperty(t, 'targetFn', { configurable: true, get() { return tf; }, set(fn) { tf = fn ? (v, c, tt) => { const x = o.wrap(v, c, t, k); return x !== 'orig' ? x : fn(v, c, tt); } : fn; } });
      }
      if (o.vorbereiten) await o.vorbereiten(t, k);
    },
  });
  const t = r.t;
  const frailUebrig = t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === opferSeite && c.name === H.INERT.frail && (c.counters?.currentHp ?? 1) > 0).length;
  const zahl = (n) => logs.filter(l => l.n === n).length;
  const gezogen = logs.filter(l => l.n === 'idej_kunagi_draw').reduce((a, l) => a + (l.d?.drew || 0), 0);
  return { r, t, k: t.k, logs, besiegt: 4 - frailUebrig, wiederholt: zahl('idej_kunagi_repeat'), gezogen };
}
const ok = (R, id, t) => R.check(id + ': keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
const eigeneLebend = (t, me, namen) => t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === me && namen.includes(c.name) && (c.counters?.currentHp ?? 1) > 0).length;

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);

    // ── Sacrificial Dagger (W42a): „when you sacrifice a target" ist die AKTIVIERUNGSBEDINGUNG, kein Preis → die Wiederholung kostet NICHTS (kein weiteres Opfer, keine Opferwahl) ──
    for (const futter of [0, 1, 2]) {
      let opferWahlen = 0;
      const wrap = (v) => { if (v.length && v.every(x => x.owner === me)) { opferWahlen++; return [v[0].id]; } return 'orig'; };   // jede Wahl unter EIGENEN Zielen wäre eine Opferwahl
      const e = await lauf('Sacrificial Dagger', me, op, { wrap, vorbereiten: async (t) => { for (let i = 0; i < futter; i++) t.put(me, 2, i, H.INERT.creature); } });
      R.check(`Dagger mit ${futter} weiterer(n) eigener Kreatur(en): alle 4 Gegner-Kreaturen besiegt (Wiederholungen kostenlos, auch ohne weiteres Opfer)`, e.besiegt === 4, { besiegt: e.besiegt });
      R.check(`Dagger mit ${futter} weiterer(n): 3 Wiederholungen, keine Opferwahl, alle ${futter} weiteren Kreaturen leben noch`, e.wiederholt >= 3 && opferWahlen === 0 && eigeneLebend(e.t, me, [H.INERT.creature]) === futter, { wiederholt: e.wiederholt, opferWahlen, uebrig: eigeneLebend(e.t, me, [H.INERT.creature]) });
      R.check(`Dagger mit ${futter} weiterer(n): Kunagi zieht je besiegter Kreatur`, e.gezogen === 4, { gezogen: e.gezogen });
      ok(R, `Dagger ${futter}`, e.t);
    }
    {   // Ablehnen an der Zielwahl der Wiederholung: nichts passiert, keine Kosten
      let nGegnerWahl = 0;
      const wrap = (v) => { if (v.some(x => x.owner === op)) { nGegnerWahl++; return nGegnerWahl === 1 ? 'orig' : null; } return 'orig'; };
      const e = await lauf('Sacrificial Dagger', me, op, { wrap, vorbereiten: async (t) => { t.put(me, 2, 0, H.INERT.creature); } });
      R.check('Dagger: Zielwahl der Wiederholung abgelehnt → keine Wiederholung, die weitere eigene Kreatur lebt', e.besiegt === 1 && e.wiederholt === 0 && eigeneLebend(e.t, me, [H.INERT.creature]) === 1, { besiegt: e.besiegt, uebrig: eigeneLebend(e.t, me, [H.INERT.creature]) });
      ok(R, 'Dagger abgelehnt (Ziel)', e.t);
    }
    {   // Einmal-pro-Zug des Dolchs bleibt einmal gesetzt: ein zweites Opfer im selben Zug löst ihn nicht neu aus
      const e = await lauf('Sacrificial Dagger', me, op, { vorbereiten: async (t) => { t.put(me, 2, 0, H.INERT.creature); } });
      const treffer0 = e.t.treffer.length;
      const c = e.t.put(me, 2, 1, H.INERT.creature);
      await e.t.run(() => e.t.engine.opfereKreatur(c, { name: 'Test', owner: me }));
      R.check('Dagger: Einmal-pro-Zug nach der Kette weiter verbraucht (kein Schlag beim nächsten Opfer)', e.t.treffer.length === treffer0, { vor: treffer0, nach: e.t.treffer.length });
    }
    {   // Gegenprobe ohne Kunagi
      const e = await lauf('Sacrificial Dagger', me, op, { ohneKunagi: true });
      R.check('Dagger ohne Kunagi: genau 1 Schlag', e.besiegt === 1 && e.wiederholt === 0, { besiegt: e.besiegt });
    }

    // ── Bamboo Staff (W42a): „when a card is added from your discard pile to your hand" ist die AKTIVIERUNGSBEDINGUNG → die Wiederholung braucht keine weitere Karte aus der Ablage ──
    for (const extra of [0, 1, 2]) {
      const szene = { discard: { [me]: Array(extra).fill('ZZ Filler') } };   // plus die eine Karte des Treibers für den ersten Auslöser
      let galerien = 0;
      const e = await lauf('Bamboo Staff', me, op, { szene, vorbereiten: async (t) => { t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Bamboo Staff', answer: () => { galerien++; return { cardName: 'ZZ Filler' }; } }); } });
      const ablage = e.t.pile(me, 'discardPile').filter(n => n === 'ZZ Filler').length;
      const hand = e.t.pile(me, 'hand').filter(n => n === 'ZZ Filler').length;
      R.check(`Bamboo Staff mit ${extra} weiterer(n) Ablagekarte(n): alle 4 Kreaturen besiegt, keine Kartenwahl, die Ablage bleibt unangetastet`, e.besiegt === 4 && galerien === 0 && ablage === extra && hand === 1, { besiegt: e.besiegt, galerien, ablage, hand });
      R.check(`Bamboo Staff mit ${extra}: 3 Wiederholungen, Kunagi zieht je besiegter Kreatur`, e.wiederholt >= 3 && e.gezogen === 4, { wiederholt: e.wiederholt, gezogen: e.gezogen });
      ok(R, `Bamboo ${extra}`, e.t);
    }
    {   // Ablehnen an der Zielwahl: nichts bewegt
      let n = 0;
      const wrap = (v) => { if (v.some(x => x.owner === op)) { n++; return n === 1 ? 'orig' : null; } return 'orig'; };
      const e = await lauf('Bamboo Staff', me, op, { wrap, szene: { discard: { [me]: ['ZZ Filler'] } }, vorbereiten: async (t) => { t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Bamboo Staff', answer: () => ({ cardName: 'ZZ Filler' }) }); } });
      const ablage = e.t.pile(me, 'discardPile').filter(x => x === 'ZZ Filler').length;
      R.check('Bamboo Staff: Zielwahl der Wiederholung abgelehnt → keine Wiederholung, die Ablage bleibt unangetastet', e.besiegt === 1 && e.wiederholt === 0 && ablage === 1, { besiegt: e.besiegt, ablage });
      ok(R, 'Bamboo abgelehnt (Ziel)', e.t);
    }
    {   // Weich-Einmal-pro-Zug des Staffs bleibt gesetzt (kein zweiter eigener Auslöser im selben Zug)
      const e = await lauf('Bamboo Staff', me, op, { szene: { discard: { [me]: ['ZZ Filler'] } }, vorbereiten: async (t) => { t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Bamboo Staff', answer: () => ({ cardName: 'ZZ Filler' }) }); } });
      const vor = e.t.treffer.length;
      e.t.setDiscard(me, ['ZZ Filler']);
      await e.t.run(() => e.t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W42a' }));
      R.check('Bamboo Staff: Weich-Einmal-pro-Zug weiter verbraucht (der nächste Auslöser im selben Zug schlägt nicht)', e.t.treffer.length === vor, { vor, nach: e.t.treffer.length });
    }

    // ── Kohta (W42a, Al: „Nein, verbraucht es nicht, ebenso wenig, wie normale Attacks mit Karten Zusatzaktionen mit Kunagi kosten. Die Aktion des ersten Schlags reicht.") ──
    for (const zusatz of [0, 1, 2]) {
      const e = await lauf('Kohta', me, op, { vorbereiten: async (t, k) => {
        if (!zusatz) return;
        const traeger = t.put(me, 2, 2, H.INERT.artifact);
        t.engine.registerAdditionalActionType('ZZ-aa', { label: 'ZZ', allowedCategories: ['ability_activation'], sourceLabel: 'ZZ' });
        traeger.counters.aaGrants = { 'ZZ-aa': zusatz }; t.engine._syncAAMirror(traeger);
      } });
      R.check(`Kohta mit ${zusatz} Zusatzaktion(en): alle 4 Kreaturen besiegt (3 Wiederholungen ohne weitere Aktion)`, e.besiegt === 4 && e.wiederholt >= 3, { besiegt: e.besiegt, wiederholt: e.wiederholt });
      const rest = e.t.engine.cardInstances.filter(c => c.name === H.INERT.artifact).reduce((a, c) => a + (c.counters?.aaGrants?.['ZZ-aa'] || 0), 0);
      R.check(`Kohta mit ${zusatz}: keine Zusatzaktion verbraucht`, rest === zusatz, { rest });
      ok(R, `Kohta ${zusatz}`, e.t);
    }
    {   // Ablehnen an der Zielwahl: nichts verbraucht, die harte Sperre bleibt einmal gesetzt
      let n = 0;
      const wrap = (v) => { if (v.some(x => x.owner === op)) { n++; return n === 1 ? 'orig' : null; } return 'orig'; };
      const e = await lauf('Kohta', me, op, { wrap });
      R.check('Kohta: Zielwahl der Wiederholung abgelehnt → nur der erste Schlag', e.besiegt === 1 && e.wiederholt === 0, { besiegt: e.besiegt, wiederholt: e.wiederholt });
      ok(R, 'Kohta abgelehnt', e.t);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
