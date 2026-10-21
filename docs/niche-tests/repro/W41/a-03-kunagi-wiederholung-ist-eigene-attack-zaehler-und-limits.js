'use strict';
// W41a · Punkt 6 · Al, 22.10.2026 (Antwort auf W40a-Rückfrage 6): „Ja, das sollen in jedem Fall eigene Attacken-Instanzen sein!" + Bestätigung der Folgerung: unterliegt die Wiederholung einem Attack-Limit
//  (Mirjam hat ihre eine Attack schon gehabt, Berserk-Limit, Rioting Village, Knife Throw), kann Kunagi für diesen Helden schlicht nicht triggern: kein Angebot, nichts bezahlt, nichts verbraucht.
// Regel: JEDE Kunagi-Wiederholung (Effekt UND gespielte Attack-Karte) ist eine eigene Attack-Instanz: sie zählt für alle Attack-Zähler (`attacksPlayedThisTurn`, `hero._attacksThisTurn`,
//  `heroesAttackedThisTurn`, `onEffectCountedAsArt`) — genau EIN Zählschritt je Schlag, die Original-Karte nicht doppelt — und unterliegt den Attack-Limits (`heroKannAngreifen`).
// Aufbau wie `W40/a-03`: der Schlagende trägt Kunagi, der Gegner hat 4 Kreaturen mit je 10 HP (jeder Schlag besiegt genau 1).
// Aufruf: node docs/niche-tests/repro/W41/a-03-kunagi-wiederholung-ist-eigene-attack-zaehler-und-limits.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H, setzeFrei } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const KUNAGI = 'Idej Sword - Kunagi';
const MIRJAM = 'Mirjam, the Fallen Cute Angel';

async function lauf(name, me, op, o = {}) {
  const sp = L.TREIBER[name];
  const opferSeite = sp.opferSeite === 'me' ? me : op;
  const z = { zaehlschritte: 0, gegnerWahl: 0 };
  const r = await L.szene(name, me, op, {
    ziel: 'creature', kreaturName: H.INERT.frail, kreaturHp: 10, F: 1, ...(o.szene || {}),
    vorbereiten: async (t, k) => {
      const _za = t.engine.zaehleAlsArt.bind(t.engine);
      t.engine.zaehleAlsArt = async (art, q) => { if (art === 'attack' && q.pi === me) { z.zaehlschritte++; } const rr = await _za(art, q); if (o.nachZaehlen) o.nachZaehlen(t, art, q); return rr; };
      for (const [hi, sl] of [[0, 0], [0, 1], [2, 0]]) { const c = t.put(opferSeite, hi, sl, H.INERT.frail); c.turnPlayed = 1; }
      if (!o.ohneKunagi) setzeFrei(t, k.as, k.held, KUNAGI);
      let tf = null;
      Object.defineProperty(t, 'targetFn', { configurable: true, get() { return tf; }, set(fn) { tf = fn ? (v, c, tt) => { if (v.some(x => x.owner === opferSeite && x.type === 'equip')) z.gegnerWahl++; return fn(v, c, tt); } : fn; } });
      if (o.vorbereiten) await o.vorbereiten(t, k);
    },
  });
  const t = r.t;
  const frailUebrig = t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === opferSeite && c.name === H.INERT.frail && (c.counters?.currentHp ?? 1) > 0).length;
  const as = sp.angreifer === 'op' ? op : me;
  const schlaege = t.treffer.filter(y => y.srcOwner === as && y.srcHero === sp.held).length;   // Treffer des schlagenden Helden (Original + Wiederholungen; die letzte Wiederholung trifft einen Helden, wenn keine Kreatur mehr da ist)
  return { r, t, besiegt: 4 - frailUebrig, z, schlaege, ps: t.gs.players[me], held: t.gs.players[as].heroes[sp.held] };
}
const ok = (R, id, t) => R.check(id + ': keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);

    // ── Zähler: jede Wiederholung = eine Attack, genau ein Zählschritt je Schlag ──
    for (const n of ['Echte Attack', 'Broghan', 'Arthor', 'Sword in a Bottle', 'Sacrificial Dagger']) {
      const extra = n === 'Sacrificial Dagger' ? async (t) => { for (let i = 0; i < 3; i++) t.put(me, 2, i, H.INERT.creature); } : undefined;
      const wrap = n === 'Sacrificial Dagger' ? true : false;
      const e = await lauf(n, me, op, { vorbereiten: extra });
      void wrap;
      R.check(`${n} + Kunagi: Original + Wiederholungen, mehrere Schläge`, e.schlaege >= 2, { schlaege: e.schlaege, besiegt: e.besiegt });
      R.check(`${n} + Kunagi: attacksPlayedThisTurn = hero._attacksThisTurn = Anzahl Schläge (je Schlag genau ein Zählschritt, die Original-Karte nicht doppelt)`, e.ps.attacksPlayedThisTurn === e.schlaege && e.held._attacksThisTurn === e.schlaege && (e.ps.heroesAttackedThisTurn || []).length === 1, { schlaege: e.schlaege, spieler: e.ps.attacksPlayedThisTurn, held: e.held._attacksThisTurn });
      ok(R, `Zähler ${n}`, e.t);
    }
    {
      const e = await lauf('Echte Attack', me, op, { ohneKunagi: true });
      R.check('Gegenprobe Echte Attack ohne Kunagi: 1 Schlag, 1 Zählschritt', e.besiegt === 1 && e.ps.attacksPlayedThisTurn === 1, { besiegt: e.besiegt, spieler: e.ps.attacksPlayedThisTurn });
    }

    // ── Berserk: „nie mehr als 2 Attacks pro Zug" — Original + 1 Wiederholung, dann kein Angebot mehr ──
    for (const n of ['Echte Attack', 'Broghan']) {
      const e = await lauf(n, me, op, { vorbereiten: async (t, k) => { t.hero(k.as, k.held).statuses.berserked = { duration: 99 }; } });
      R.check(`${n} + Berserk-Held: genau 2 Schläge (Berserk-Limit gilt für die Wiederholung), danach kein Angebot`, e.besiegt === 2 && e.ps.attacksPlayedThisTurn === 2 && e.held._attacksThisTurn === 2, { besiegt: e.besiegt, spieler: e.ps.attacksPlayedThisTurn, wahl: e.z.gegnerWahl });
      R.check(`${n} + Berserk-Held: nach dem Limit wird keine dritte Zielwahl geöffnet`, e.z.gegnerWahl === 2, { wahl: e.z.gegnerWahl });
      ok(R, `Berserk ${n}`, e.t);
    }

    // ── Mirjam: „can never use more than 1 Attack per turn" — keine Wiederholung ──
    for (const n of ['Echte Attack', 'Javelin Throw']) {
      const e = await lauf(n, me, op, { vorbereiten: async (t, k) => { t.setHero(me, 0, MIRJAM, 800); t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100; } });
      R.check(`${n} mit Mirjam + Kunagi: nur der Original-Schlag (die Wiederholung wäre eine 2. Attack)`, e.besiegt === 1 && e.z.gegnerWahl === 1, { besiegt: e.besiegt, wahl: e.z.gegnerWahl });
      ok(R, `Mirjam ${n}`, e.t);
    }
    {   // Gegenprobe: ohne Mirjam wiederholt Kunagi (Echte Attack, Javelin Throw)
      for (const n of ['Echte Attack', 'Javelin Throw']) {
        const e = await lauf(n, me, op, n === 'Javelin Throw' ? { vorbereiten: async (t) => { setzeFrei(t, me, 0, H.INERT.artifact); } } : {});
        R.check(`Gegenprobe ${n} ohne Mirjam: Kunagi wiederholt (≥ 2 Schläge)`, e.besiegt >= 2, { besiegt: e.besiegt });
      }
    }

    // ── Rioting Village: „no player can use more than 1 Attack per turn" ──
    for (const n of ['Echte Attack', 'Broghan']) {
      const e = await lauf(n, me, op, { vorbereiten: async (t) => { t.putArea(op, 'Rioting Village'); } });
      R.check(`${n} unter Rioting Village + Kunagi: nur 1 Schlag`, e.besiegt === 1 && e.z.gegnerWahl === 1, { besiegt: e.besiegt, wahl: e.z.gegnerWahl });
      ok(R, `Rioting Village ${n}`, e.t);
    }

    // ── Knife Throw („must be the only Attack you play this turn"): der Stempel sperrt die Wiederholung ──
    for (const n of ['Echte Attack', 'Broghan']) {
      const e = await lauf(n, me, op, { nachZaehlen: (t, art, q) => { if (art === 'attack' && q.pi === me && !t.gs.players[me]._soleAttackTurn) t.gs.players[me]._soleAttackTurn = t.gs.turn; } });
      R.check(`${n} mit „only Attack"-Stempel (Knife Throw) + Kunagi: nur 1 Schlag, keine zweite Zielwahl`, e.besiegt === 1 && e.z.gegnerWahl === 1, { besiegt: e.besiegt, wahl: e.z.gegnerWahl });
    }

    // ── Knife Throw als echte Karte (Absicherung, schon auf der Basis grün): die Karte stempelt „only Attack" → keine Wiederholung, die Attack zählt genau einmal ──
    {
      const t = await H.fresh({ hand: me === 0 ? [['Knife Throw'], []] : [[], ['Knife Throw']], hp: 800, deckSize: 20, active: me });
      t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100;
      t.setAbilities(me, 0, [['Fighting', 'Fighting'], [], []]);
      t.put(me, 0, 0, KUNAGI); t.put(me, 0, 1, H.INERT.artifact);
      for (let i = 0; i < 3; i++) { const c = t.put(op, 1, i, H.INERT.frail); c.turnPlayed = 1; }
      t.targetFn = (v) => { const e = v.find(x => x.owner === op && x.type === 'equip'); const tr = v.find(x => x.cardName === H.INERT.artifact && x.owner === me); return e ? [e.id] : (tr ? [tr.id] : undefined); };
      const r = await t.play(me, 'Knife Throw', { hero: 0 });
      const uebrig = t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === op && c.name === H.INERT.frail && (c.counters?.currentHp ?? 1) > 0).length;
      R.check('Knife Throw (echte Karte) + Kunagi: gespielt, genau 1 Kreatur besiegt (keine Wiederholung), genau 1 Attack gezählt', r === true && uebrig === 2 && t.gs.players[me].attacksPlayedThisTurn === 1, { r, uebrig, attacks: t.gs.players[me].attacksPlayedThisTurn });
      R.check('  keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
    }

    // ── Gesperrte Wiederholung kostet nichts: Dagger unter Mirjam-Limit → kein weiteres Opfer ──
    {
      const e = await lauf('Sacrificial Dagger', me, op, { vorbereiten: async (t) => { t.setHero(me, 0, MIRJAM, 800); t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100; t.put(me, 2, 0, H.INERT.creature); } });
      const uebrig = e.t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === me && c.name === H.INERT.creature && (c.counters?.currentHp ?? 1) > 0).length;
      R.check('Dagger unter Mirjam-Limit + Kunagi: nur 1 Schlag, das weitere Opfer wird nicht angeboten/gebracht', e.besiegt === 1 && uebrig === 1, { besiegt: e.besiegt, uebrig });
      ok(R, 'Dagger Mirjam', e.t);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
