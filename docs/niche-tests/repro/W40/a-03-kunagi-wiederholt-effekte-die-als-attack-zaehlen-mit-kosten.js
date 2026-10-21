'use strict';
// W40a · Punkt 3 · Al, 22.10.2026 (Antwort auf W39a-Rückfrage 3): „Doch, Kunagi soll auch Effekte wie Broghan wiederholen können. Im Fall von Brackle wäre dafür ein zweites Opfer nötig, im Fall von Effekten wie
//  Javelin Throw müsste ein weiteres Equip entfernt werden."
// Kartentext Idej Sword - Kunagi: „When the equipped Hero defeats exactly 1 Creature with an Attack, it may immediately perform that Attack again against a different target your opponent controls. For every
//  Creature the equipped Hero defeats, draw 1 card."
// Regel (W40a): auch ein Effekt, der als Attack zählt, wird wiederholt (`alsAttackKette({ wiederhole })` → `afterSpellResolved._wiederhole`): derselbe Held schlägt ERNEUT, das Ziel wird neu gewählt (nur Gegnerziele,
//  das vorige ausgenommen), die KOSTEN fallen erneut an (zweites Opfer, weiteres Equip …), Einmal-Stempel/Limits/Aktion des Effekts werden weder ein zweites Mal verbraucht noch blockieren sie die Wiederholung.
//  Fehlen die Kosten (kein weiteres Opfer, kein weiteres Equip) oder wird die Wahl abgebrochen, findet die Wiederholung nicht statt und kostet nichts. Pro besiegter Kreatur zieht Kunagi 1 Karte.
// Tabelle: Quelle | Kosten bei Wiederholung | Verhalten ohne Kosten — siehe CARD_API.md, Abschnitt „Welle 40 / W40a".
// Aufbau je Quelle: der Schlagende trägt Kunagi (Testaufbau; die Skripte prüfen die Ausrüst-Regel „Idej" beim Ausrüsten, nicht beim Wirken), der Gegner hat 4 Kreaturen mit je 10 HP (jeder Schlag besiegt genau 1).
// Exit 1 auf der Basis (kein Effekt wurde wiederholt), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W40/a-03-kunagi-wiederholt-effekte-die-als-attack-zaehlen-mit-kosten.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H, setzeFrei } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const KUNAGI = 'Idej Sword - Kunagi';

/** Eine Szene bauen und den Effekt auslösen; liefert Zähler aus Protokoll und Zustand. */
async function lauf(name, me, op, o = {}) {
  const sp = L.TREIBER[name];
  const opferSeite = sp.opferSeite === 'me' ? me : op;
  const logs = [];
  const r = await L.szene(name, me, op, {
    ziel: 'creature', kreaturName: H.INERT.frail, kreaturHp: 10, F: 1, ...(o.szene || {}),
    vorbereiten: async (t, k) => {
      const _log = t.engine.log.bind(t.engine);
      t.engine.log = (n, d) => { logs.push({ n, d }); return _log(n, d); };
      // Gegner-Kreaturen: 4 Stück mit 10 HP (die erste setzt `szene` auf Held 1 Slot 0)
      for (const [hi, sl] of [[0, 0], [0, 1], [2, 0]]) { const c = t.put(opferSeite, hi, sl, H.INERT.frail); c.turnPlayed = 1; }
      if (!o.ohneKunagi) setzeFrei(t, k.as, k.held, KUNAGI);
      // Antworten abfangen: pro Quelle lassen sich Eingaben der Wiederholung überschreiben
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
  return { r, t, k: t.k, logs, besiegt: 4 - frailUebrig, frailUebrig, wiederholt: zahl('idej_kunagi_repeat'), gezogen, opferSeite };
}
const ok = (R, id, t) => R.check(id + ': keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
const gegner = (v, op) => (v.find(x => x.type === 'equip' && x.owner === op) || v[0]).id;

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);

    // ── Heldeneffekte ohne Zusatzkosten: Broghan, Arthor, Heragas, Kohta (Stempel einmal, Wiederholung bis kein Ziel mehr genau 1 Kreatur besiegt) ──
    for (const n of ['Broghan', 'Arthor', 'Heragas', 'Kohta']) {
      const e = await lauf(n, me, op);
      R.check(`${n}: alle 4 Kreaturen besiegt (Original + Wiederholungen)`, e.besiegt === 4, { besiegt: e.besiegt });
      R.check(`${n}: ≥ 3 Wiederholungen, Kunagi zieht je besiegter Kreatur 1 Karte`, e.wiederholt >= 3 && e.gezogen === 4, { wiederholt: e.wiederholt, gezogen: e.gezogen });
      // Einmal-Stempel nur einmal verbraucht: der zweite Versuch im selben Zug schlägt nicht (Ziele bleiben unversehrt)
      const vor = e.t.treffer.length;
      await L.TREIBER[n].los(e.t, me, op, { ziel: 'creature' });
      R.check(`${n}: Einmal-Stempel/Aktion bleibt gesetzt (zweite Aktivierung schlägt nicht)`, e.t.treffer.length === vor, { vor, nach: e.t.treffer.length });
      ok(R, n, e.t);
    }

    // ── Brackle: ein zweites Opfer ist nötig ──
    for (const fodder of [1, 2, 3]) {
      const wrapB = (v, c, t, k) => (c && c.title === 'Brackle, the Catapulting Turtle' && v.length && v.every(x => x.type === 'equip' && x.owner === me)) ? [v[0].id] : 'orig';   // Opfer-Wahl: die erste zahlbare Kreatur
      const e = await lauf('Brackle', me, op, { wrap: wrapB, vorbereiten: async (t, k) => { for (let i = 1; i < fodder; i++) { const c = t.put(k.me, 2, i - 1, H.INERT.creature); c.turnPlayed = 1; c.counters.currentHp = 100; } } });
      const opfer = e.logs.filter(l => l.n === 'brackle_catapult' && !l.d?.negated).length;
      R.check(`Brackle mit ${fodder} Opfer-Kreatur(en): ${fodder} Schlag/Schläge, ${fodder} Opfer (nie doppelt)`, e.besiegt === fodder && opfer === fodder, { besiegt: e.besiegt, opfer });
      R.check(`Brackle mit ${fodder} Opfer-Kreatur(en): ${fodder - 1} Wiederholung(en), Kunagi zieht ${fodder}`, e.wiederholt === fodder - 1 && e.gezogen === fodder, { wiederholt: e.wiederholt, gezogen: e.gezogen });
      const eigene = e.t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === me && (c.name === H.INERT.creature) && (c.counters?.currentHp ?? 1) > 0).length;
      R.check(`Brackle mit ${fodder} Opfer-Kreatur(en): keine eigene Kreatur übrig, die nicht gebraucht wurde`, eigene === 0, { eigene });
      ok(R, `Brackle ${fodder}`, e.t);
    }

    // ── Javelin Throw: ein weiteres Equip wird entfernt; ohne weiteres Equip → Wiederholung abgelehnt, Kunagi bleibt ──
    {
      let schaden = 0;
      const wrap = (v, c, t, k) => {
        if (!c || c.title !== 'Javelin Throw') return 'orig';
        if (v.length && v.every(x => x.type === 'equip' && x.owner === me)) { const tr = v.find(x => x.cardName === 'ZZ Trinket'); return tr ? [tr.id] : null; }   // Equip-Wahl: nur Trinkets (nie Kunagi)
        if (v.some(x => x.owner === op)) { schaden++; return schaden <= 2 ? [gegner(v, op)] : null; }   // 3. Zielwahl = Wiederholung ohne weiteres Equip: ablehnen
        return 'orig';
      };
      const e = await lauf('Javelin Throw', me, op, { wrap, vorbereiten: async (t, k) => { setzeFrei(t, k.as, k.held, 'ZZ Trinket'); } });
      const abl = e.t.gs.players[me].discardPile;
      R.check('Javelin Throw (3 Equips: Trinket, Trinket, Kunagi): Original + 1 Wiederholung, beide Male ein Trinket abgeworfen', e.besiegt === 2 && abl.filter(n => n === 'ZZ Trinket').length === 2, { besiegt: e.besiegt, ablage: abl });
      R.check('Javelin Throw: ohne weiteres Equip (nur Kunagi übrig) → Wiederholung abgelehnt: Kunagi bleibt ausgerüstet, nichts bezahlt', !abl.includes(KUNAGI) && e.t.engine.cardInstances.some(c => c.name === KUNAGI && c.zone === 'support'), { ablage: abl });
      R.check('Javelin Throw: Kunagi zieht je besiegter Kreatur', e.gezogen === 2 && e.wiederholt === 1, { gezogen: e.gezogen, wiederholt: e.wiederholt });
      const ohne = await lauf('Javelin Throw', me, op, { ohneKunagi: true });
      const geister = (x) => x.t.engine.cardInstances.filter(c => c.zone === 'hand' && c.owner === me && c.name === 'Javelin Throw').length;
      R.check('Javelin Throw: kein zusätzlicher Geisterzustand durch die Wiederholung (Hilfsinstanz auf der Hand wie ohne Kunagi)', geister(e) === geister(ohne), { mit: geister(e), ohne: geister(ohne) });
      ok(R, 'Javelin Throw', e.t);
      const e1 = await lauf('Javelin Throw', me, op, { wrap: (v, c) => (c && c.title === 'Javelin Throw' && v.length && v.every(x => x.type === 'equip' && x.owner === me)) ? null : 'orig' });
      R.check('Javelin Throw nur mit dem Wurf-Artefakt + Kunagi: Original trifft; die Wiederholung bietet nur Kunagi an (Gegenprobe: Abbruch kostet nichts)', e1.besiegt >= 0 && e1.t.errors.length === 0, { besiegt: e1.besiegt });
    }

    // ── Sword in a Bottle: keine Zusatzkosten (der Trank ist gespielt); Wiederholung bis keine Kreatur mehr fällt ──
    {
      const wrap = (v, c) => (v.length && v.every(x => x.owner !== me)) ? [gegner(v, op)] : 'orig';
      const e = await lauf('Sword in a Bottle', me, op, { wrap });
      R.check('Sword in a Bottle: alle 4 Kreaturen besiegt, Kunagi zieht je Kreatur', e.besiegt === 4 && e.gezogen === 4 && e.wiederholt >= 3, { besiegt: e.besiegt, gezogen: e.gezogen, wiederholt: e.wiederholt });
      R.check('Sword in a Bottle: Einmal-pro-Zug bleibt gesetzt (zweiter Trank im selben Zug lehnt der Server ab)', e.t.gs.hoptUsed?.[`sword-in-a-bottle:${me}`] === e.t.gs.turn, e.t.gs.hoptUsed);
      ok(R, 'Sword in a Bottle', e.t);
    }

    // ── Crusader's (Cutlass als Beispiel; alle vier teilen `_crusader-shared`) ──
    for (const n of ["Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"]) {
      const e = await lauf(n, me, op);
      R.check(`${n}: Original + Wiederholungen besiegen alle 4 Kreaturen, Kunagi zieht je Kreatur`, e.besiegt === 4 && e.gezogen === 4 && e.wiederholt >= 3, { besiegt: e.besiegt, gezogen: e.gezogen, wiederholt: e.wiederholt });
      const vor = e.t.treffer.length;
      await L.TREIBER[n].los(e.t, me, op, { ziel: 'creature' });
      R.check(`${n}: Einmal-pro-Zug (Instanz-Stempel) bleibt gesetzt: zweite Aktivierung schlägt nicht`, e.t.treffer.length === vor, { vor, nach: e.t.treffer.length });
      ok(R, n, e.t);
    }

    // ── Bamboo Staff: keine eigenen Kosten (der Auslöser „Karte aus der Ablage auf die Hand" ist keine Zahlung) ──
    {
      const e = await lauf('Bamboo Staff', me, op);
      R.check('Bamboo Staff: Original + Wiederholungen besiegen alle 4 Kreaturen, Kunagi zieht je Kreatur', e.besiegt === 4 && e.gezogen === 4 && e.wiederholt >= 3, { besiegt: e.besiegt, gezogen: e.gezogen, wiederholt: e.wiederholt });
      const vor = e.t.treffer.length;
      await e.t.run(() => e.t.engine.addCardFromDiscardToHand(me, 'ZZ Filler', me, { source: 'W40a' }));
      R.check('Bamboo Staff: Weich-Einmal-pro-Zug bleibt gesetzt (zweiter Auslöser im selben Zug schlägt nicht)', e.t.treffer.length === vor, { vor, nach: e.t.treffer.length });
      ok(R, 'Bamboo Staff', e.t);
    }

    // ── Sacrificial Dagger: keine eigenen Kosten (das Opfer ist der Auslöser, nicht die Zahlung des Schlags) ──
    {
      const e = await lauf('Sacrificial Dagger', me, op);
      R.check('Sacrificial Dagger: Original + Wiederholungen besiegen alle 4 Kreaturen, Kunagi zieht je Kreatur', e.besiegt === 4 && e.gezogen === 4 && e.wiederholt >= 3, { besiegt: e.besiegt, gezogen: e.gezogen, wiederholt: e.wiederholt });
      ok(R, 'Sacrificial Dagger', e.t);
    }

    // ── Infected Greatmaw: ein weiteres Opfer ist nötig ──
    for (const fodder of [1, 2, 3]) {
      const e = await lauf('Infected Greatmaw', me, op, { vorbereiten: async (t, k) => { for (let i = 1; i < fodder; i++) { const c = t.put(k.me, 2, i, H.INERT.frail); c.turnPlayed = 1; } } });
      const eigeneFutter = e.t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === me && c.name === H.INERT.frail && (c.counters?.currentHp ?? 1) > 0).length;
      R.check(`Infected Greatmaw mit ${fodder} Opfer-Kreatur(en): ${fodder} Schlag/Schläge (je Schlag 1 Opfer)`, e.besiegt === fodder && eigeneFutter === 0, { besiegt: e.besiegt, eigeneFutter });
      R.check(`Infected Greatmaw mit ${fodder} Opfer-Kreatur(en): ${fodder - 1} Wiederholung(en), Kunagi zieht ${fodder}`, e.wiederholt === fodder - 1 && e.gezogen === fodder, { wiederholt: e.wiederholt, gezogen: e.gezogen });
      R.check(`Infected Greatmaw mit ${fodder} Opfer-Kreatur(en): Greatmaw selbst bleibt (nie sein eigenes Opfer)`, e.t.engine.cardInstances.some(c => c.name === 'Infected Greatmaw' && c.zone === 'support'), null);
      ok(R, `Infected Greatmaw ${fodder}`, e.t);
    }

    // ── Alluring Light: der gezwungene Held trägt Kunagi und besiegt eine Kreatur des Spielers → er schlägt erneut (Kunagi-Besitzer wählt unter den Zielen des Light-Spielers) ──
    {
      const e = await lauf('Alluring Light', me, op);
      R.check('Alluring Light: der gezwungene Held (Kunagi) besiegt Original + Wiederholungen alle 4 Kreaturen des Light-Spielers', e.besiegt === 4 && e.wiederholt >= 3, { besiegt: e.besiegt, wiederholt: e.wiederholt });
      R.check('Alluring Light: Kunagi (beim Gegner) zieht je besiegter Kreatur', e.gezogen === 4, { gezogen: e.gezogen });
      ok(R, 'Alluring Light', e.t);
    }

    // ── Duel: trifft nur Helden — Kunagi („defeats exactly 1 Creature") löst nie aus; kein Fehler, keine Wiederholung ──
    {
      const e = await lauf('Duel', me, op);
      R.check('Duel: keine Kreatur besiegt, keine Wiederholung, Kunagi bleibt', e.besiegt === 0 && e.wiederholt === 0 && e.gezogen === 0, { besiegt: e.besiegt, wiederholt: e.wiederholt });
      ok(R, 'Duel', e.t);
    }

    // ── Gegenprobe: ohne Kunagi keine Wiederholung ──
    for (const n of ['Broghan', 'Javelin Throw', 'Alluring Light']) {
      const e = await lauf(n, me, op, { ohneKunagi: true });
      R.check(`Gegenprobe ${n} ohne Kunagi: genau 1 Kreatur besiegt, keine Wiederholung`, e.besiegt === 1 && e.wiederholt === 0, { besiegt: e.besiegt, wiederholt: e.wiederholt });
    }

    // ── Pfeil-Bonus nur für die erste Attack: Original +60, Wiederholung ohne Bonus (Effekt UND Karte); Vergleich mit demselben Aufbau ohne Pfeil ──
    for (const [n, arrow] of [['Broghan', 'Angelfeather Arrow'], ['Arthor', 'Angelfeather Arrow'], ['Echte Attack', 'Angelfeather Arrow'], ['Echte Attack', 'Magic Topaz']]) {
      const e = await lauf(n, me, op, { szene: { attHand: [arrow] }, vorbereiten: async (t, k) => { t.grantFor(k.as, k.held, arrow); } });
      const b = await lauf(n, me, op, {});
      const von = (x) => x.t.treffer.filter(y => y.srcOwner === me && y.srcHero === 0).map(y => y.amount);
      const mine = von(e), basis = von(b);
      R.check(`${n} + ${arrow}: nur der ERSTE Treffer trägt +60, die Wiederholungen nicht (wie ohne Pfeil)`, mine.length >= 3 && mine.length === basis.length && mine[0] === basis[0] + 60 && mine.slice(1).every((x, i) => x === basis[i + 1]), { mit: mine, ohne: basis });
      ok(R, `${n} + ${arrow}`, e.t);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
