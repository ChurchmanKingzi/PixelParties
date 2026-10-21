'use strict';
// W42a · Punkte 2 und 4 · Al, 22.10.2026 (Antworten auf die W41a-Rückfragen):
//  Punkt 2: „Korrekt, man muss keine extra Handkarten abwerfen und auch Gold nicht mehrfach zahlen." (Sword in a Bottle, Alluring Light, Javelin Throw)
//  Punkt 4: „Ja, das genügt" — Abbrechen der Kosten-/Zielwahl der Wiederholung gilt als Ablehnen, es gibt kein eigenes Ja/Nein-Fenster.
// Regel: das AUSSPIELEN der Karte (Handkarte, Gold, Aktion) wird bei der Kunagi-Wiederholung nie erneut bezahlt; nur In-Effekt-Kosten fallen erneut an (Javelin Throw: ein weiteres Equip).
// Absicherung des Ist-Zustands (kein Code geändert): Wiederholung vs. dieselbe Szene ohne Kunagi — gleiche Handkarten-/Gold-/Ablagebilanz (bis auf die Kunagi-Karten und das weitere Equip).
// Aufruf: node docs/niche-tests/repro/W42/a-02-kunagi-wiederholung-zahlt-das-ausspielen-nie-erneut-und-fragt-nicht-extra.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H, setzeFrei } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const KUNAGI = 'Idej Sword - Kunagi';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

async function lauf(name, me, op, o = {}) {
  const sp = L.TREIBER[name];
  const opferSeite = sp.opferSeite === 'me' ? me : op;
  const logs = [];
  const r = await L.szene(name, me, op, {
    ziel: 'creature', kreaturName: H.INERT.frail, kreaturHp: 10, F: 1, meHand: ['ZZ Filler', 'ZZ Filler', 'ZZ Filler'], ...(o.szene || {}),
    vorbereiten: async (t, k) => {
      const _log = t.engine.log.bind(t.engine);
      t.engine.log = (n, d) => { logs.push({ n, d }); return _log(n, d); };
      for (const [hi, sl] of [[0, 0], [0, 1], [2, 0]]) { const c = t.put(opferSeite, hi, sl, H.INERT.frail); c.turnPlayed = 1; }
      if (!o.ohneKunagi) setzeFrei(t, k.as, k.held, KUNAGI);
      if (o.vorbereiten) await o.vorbereiten(t, k);
    },
  });
  const t = r.t;
  const frailUebrig = t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === opferSeite && c.name === H.INERT.frail && (c.counters?.currentHp ?? 1) > 0).length;
  const zahl = (n) => logs.filter(l => l.n === n).length;
  return { r, t, besiegt: 4 - frailUebrig, wiederholt: zahl('idej_kunagi_repeat'), gold: t.gs.players[me].gold, ablage: t.pile(me, 'discardPile').slice(), hand: t.pile(me, 'hand').slice(), confirms: t.prompts.filter(p => p.d && p.d.type === 'confirm').length };
}
const anz = (l, n) => l.filter(x => x === n).length;
const ohneOpfer = (l) => l.filter(x => x !== H.INERT.frail);   // besiegte Kreaturen (hier eigene Opfer bei Alluring Light) liegen ebenfalls in der Ablage
/** Zielwahl-Wrapper: `fn(v, c)` darf 'orig' liefern, dann antwortet der Treiber. */
const mitWrap = (t, fn) => { let tf = null; Object.defineProperty(t, 'targetFn', { configurable: true, get() { return tf; }, set(f) { tf = f ? (v, c, tt) => { const x = fn(v, c); return x !== 'orig' ? x : f(v, c, tt); } : f; } }); };

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const gegner = (v) => (v.find(x => x.type === 'equip' && x.owner === op) || v[0]).id;

    // ── Sword in a Bottle: Handkarte (der Trank) und Gold nur einmal ──
    {
      const wrap = { vorbereiten: async (t) => { t.setGold(me, 100); mitWrap(t, (v) => (v.length && v.every(x => x.owner !== me)) ? [gegner(v)] : 'orig'); } };
      const mit = await lauf('Sword in a Bottle', me, op, wrap);
      const ohne = await lauf('Sword in a Bottle', me, op, { ...wrap, ohneKunagi: true });
      R.check('Sword in a Bottle: mit Kunagi mehrere Schläge (Wiederholung fand statt)', mit.besiegt >= 2 && mit.wiederholt >= 1 && ohne.besiegt === 1, { mit: mit.besiegt, wdh: mit.wiederholt, ohne: ohne.besiegt });
      R.check('Sword in a Bottle: Gold wie ohne Kunagi (nicht mehrfach gezahlt)', mit.gold === ohne.gold, { mit: mit.gold, ohne: ohne.gold });
      R.check('Sword in a Bottle: der Trank liegt genau einmal in der Ablage, keine zusätzlichen Handkarten abgeworfen', anz(mit.ablage, 'Sword in a Bottle') === anz(ohne.ablage, 'Sword in a Bottle') && mit.ablage.length <= ohne.ablage.length + 0, { mit: mit.ablage, ohne: ohne.ablage });
      R.check('Sword in a Bottle: Handkarten (Füller) unverändert, Kunagi stellt keine Rückfrage', anz(mit.hand, 'ZZ Filler') >= anz(ohne.hand, 'ZZ Filler') && mit.confirms === ohne.confirms, { mit: mit.hand, ohne: ohne.hand, c: [mit.confirms, ohne.confirms] });
      R.check('Sword in a Bottle: keine Engine-Fehler, Zustand sauber', sauber(mit.t), { errors: mit.t.errors, audit: mit.t.audit() });
    }

    // ── Alluring Light: Karte und Gold nur einmal; Abbruch der Opferwahl lehnt ab (kein eigenes Fenster) ──
    {
      const wrap = { vorbereiten: async (t) => { t.setGold(me, 100); } };
      const mit = await lauf('Alluring Light', me, op, wrap);
      const ohne = await lauf('Alluring Light', me, op, { ...wrap, ohneKunagi: true });
      R.check('Alluring Light: mit Kunagi mehrere Schläge, ohne genau einer', mit.besiegt >= 2 && ohne.besiegt === 1, { mit: mit.besiegt, ohne: ohne.besiegt });
      R.check('Alluring Light: Gold wie ohne Kunagi', mit.gold === ohne.gold, { mit: mit.gold, ohne: ohne.gold });
      R.check('Alluring Light: die Karte liegt genau einmal in der Ablage, keine zusätzlichen Handkarten abgeworfen', anz(mit.ablage, 'Alluring Light') === anz(ohne.ablage, 'Alluring Light') && ohneOpfer(mit.ablage).length === ohneOpfer(ohne.ablage).length, { mit: mit.ablage, ohne: ohne.ablage });
      R.check('Alluring Light: keine zusätzliche Ja/Nein-Rückfrage durch Kunagi', mit.confirms === ohne.confirms, { mit: mit.confirms, ohne: ohne.confirms });
      R.check('Alluring Light: keine Engine-Fehler, Zustand sauber', sauber(mit.t), { errors: mit.t.errors, audit: mit.t.audit() });
    }

    // ── Javelin Throw: nur das WEITERE Equip kostet; keine zweite Karte, kein Gold ──
    {
      const wrap = (v, c) => {
        if (!c || c.title !== 'Javelin Throw') return 'orig';
        if (v.length && v.every(x => x.type === 'equip' && x.owner === me)) { const tr = v.find(x => x.cardName === 'ZZ Trinket'); return tr ? [tr.id] : null; }
        if (v.some(x => x.owner === op)) return [gegner(v)];
        return 'orig';
      };
      const rig = (t, k) => { setzeFrei(t, k.as, k.held, 'ZZ Trinket'); t.setGold(me, 100); mitWrap(t, wrap); };
      const mit = await lauf('Javelin Throw', me, op, { vorbereiten: async (t, k) => rig(t, k) });
      const ohne = await lauf('Javelin Throw', me, op, { ohneKunagi: true, vorbereiten: async (t, k) => rig(t, k) });
      const trMit = anz(mit.ablage, 'ZZ Trinket'), trOhne = anz(ohne.ablage, 'ZZ Trinket');
      R.check('Javelin Throw: Original + Wiederholung; die Wiederholung wirft ein weiteres Equip ab (Trinkets in der Ablage: 2 statt 1)', mit.besiegt >= 2 && ohne.besiegt === 1 && trOhne === 1 && trMit >= 2, { mit: mit.besiegt, ohne: ohne.besiegt, trMit, trOhne });
      R.check('Javelin Throw: Gold wie ohne Kunagi, die Handkarte liegt genau einmal in der Ablage, keine Füller abgeworfen', mit.gold === ohne.gold && anz(mit.ablage, 'Javelin Throw') === anz(ohne.ablage, 'Javelin Throw') && anz(mit.ablage, 'ZZ Filler') === anz(ohne.ablage, 'ZZ Filler'), { mit: mit.ablage, ohne: ohne.ablage });
      R.check('Javelin Throw: keine zusätzliche Ja/Nein-Rückfrage durch Kunagi', mit.confirms === ohne.confirms, { mit: mit.confirms, ohne: ohne.confirms });
      R.check('Javelin Throw: keine Engine-Fehler, Zustand sauber', sauber(mit.t), { errors: mit.t.errors, audit: mit.t.audit() });
    }

    // ── Punkt 4: Abbruch der Zielwahl der Wiederholung = Ablehnen (nichts verbraucht, kein eigenes Fenster) ──
    for (const n of ['Broghan', 'Kohta', 'Sacrificial Dagger', 'Bamboo Staff']) {
      let nGegnerWahl = 0;
      const wrap = (v) => { if (v.some(x => x.owner === op)) { nGegnerWahl++; return nGegnerWahl === 1 ? 'orig' : null; } return 'orig'; };
      const mit = await lauf(n, me, op, { vorbereiten: async (t) => mitWrap(t, wrap) });
      const ohne = await lauf(n, me, op, { ohneKunagi: true });
      R.check(`${n}: Abbruch der Zielwahl der Wiederholung → nur der erste Schlag, keine Wiederholung, keine zusätzliche Rückfrage`, mit.besiegt === 1 && mit.wiederholt === 0 && mit.confirms === ohne.confirms, { besiegt: mit.besiegt, wdh: mit.wiederholt, c: [mit.confirms, ohne.confirms] });
      R.check(`${n}: keine Engine-Fehler, Zustand sauber`, sauber(mit.t), { errors: mit.t.errors, audit: mit.t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
