'use strict';
// W41a · Punkte 3 und 5 · Al, 22.10.2026 (Antworten auf die W40a-Rückfragen 3 und 5): „Ja" (Kunagi-Besitzer = Kontrolleur des gezwungenen Helden wählt das neue Opfer unter den Zielen des Light-Spielers) und
//  „Ja, der Pfeil-Bonus geht in jedem Fall an den ‚Schaden, der ausgeführt wird'." — beides ist der Ist-Zustand (W40a); hier nur abgesichert.
// (A) Alluring Light × Idej Sword - Kunagi: der gezwungene Held des Gegners trägt Kunagi und besiegt eine Kreatur des Light-Spielers → er schlägt erneut; das NEUE Opfer wählt der KUNAGI-BESITZER (nicht der Light-Spieler)
//     unter den Zielen des Light-Spielers (das vorige Opfer ausgenommen); Abbruch dieser Wahl = keine Wiederholung. Gegenprobe ohne Kunagi.
// (B) Duel: der Pfeil-Bonus gehört dem Schaden, der ausgeführt wird (dem Duellanten), auch wenn ein anderer Held die Karte spielt: Held 1 spielt Duel, Held 0 duelliert → Bonus auf dem ERSTEN Schlag von Held 0, Held 1
//     bekommt nichts und behält keine scharfen Pfeile. Gegenprobe: Held 0 spielt und duelliert selbst.
// Aufruf: node docs/niche-tests/repro/W41/a-05-kunagi-alluring-light-besitzer-waehlt-und-duel-pfeil-gehoert-dem-duellanten.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H, setzeFrei } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const KUNAGI = 'Idej Sword - Kunagi';

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);

    // ── (A) Kunagi × Alluring Light ──
    const licht = async (o = {}) => {
      const logs = [];
      const r = await L.szene('Alluring Light', me, op, {
        ziel: 'creature', kreaturName: H.INERT.frail, kreaturHp: 10, F: 1,
        vorbereiten: async (t, k) => {
          const _log = t.engine.log.bind(t.engine); t.engine.log = (n, d) => { logs.push({ n, d }); return _log(n, d); };
          for (const [hi, sl] of [[0, 0], [0, 1], [2, 0]]) { const c = t.put(me, hi, sl, H.INERT.frail); c.turnPlayed = 1; }
          if (!o.ohneKunagi) setzeFrei(t, op, 0, KUNAGI);
          if (o.vorbereiten) await o.vorbereiten(t, k);
        },
      });
      const t = r.t;
      const frail = t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === me && c.name === H.INERT.frail && (c.counters?.currentHp ?? 1) > 0).length;
      return { t, logs, besiegt: 4 - frail, wiederholt: logs.filter(l => l.n === 'idej_kunagi_repeat').length };
    };
    {
      const e = await licht();
      R.check('Alluring Light + Kunagi (Gegner): der gezwungene Held besiegt Original + Wiederholungen alle 4 Kreaturen des Light-Spielers', e.besiegt === 4 && e.wiederholt >= 3, { besiegt: e.besiegt, wiederholt: e.wiederholt });
      // Wer wählt? Die ersten zwei Wahlen (Angreifer, Opfer) macht der Light-Spieler, jede weitere der Kunagi-Besitzer (Gegner) — unter Zielen des Light-Spielers
      const w = e.t.targets;
      const lichtSpieler = w.filter(x => x.who === me).length, kunagiBesitzer = w.filter(x => x.who === op);
      R.check('  genau 2 Wahlen gehören dem Light-Spieler (Angreifer, erstes Opfer); jede Wiederholung wählt der Kunagi-Besitzer', lichtSpieler === 2 && kunagiBesitzer.length >= 3, { lichtSpieler, kunagiBesitzer: kunagiBesitzer.length });
      R.check('  die Wahl des Kunagi-Besitzers bietet nur Ziele des LIGHT-Spielers an (Gegner des gezwungenen Helden), nie die eigenen', kunagiBesitzer.every(x => x.valid.every(v => v.owner === me)), kunagiBesitzer.map(x => x.valid.map(v => v.owner)));
      R.check('Alluring Light + Kunagi: keine Engine-Fehler, Zustand sauber', e.t.errors.length === 0 && e.t.audit().length === 0, { errors: e.t.errors, audit: e.t.audit() });
    }
    {   // Abbruch der Opferwahl durch den Kunagi-Besitzer: keine Wiederholung
      let abgelehnt = 0;
      const e = await licht({ vorbereiten: async (t) => {
        let tf = null;
        Object.defineProperty(t, 'targetFn', { configurable: true, get() { return tf; }, set(fn) { tf = fn ? (v, c, tt) => { if (t.targets[t.targets.length - 1].who === op) { abgelehnt++; return null; } return fn(v, c, tt); } : fn; } });
      } });
      R.check('Alluring Light + Kunagi: lehnt der Kunagi-Besitzer die Wiederholung ab (Abbruch seiner Zielwahl), bleibt es bei EINEM Schlag, keine Wiederholung', abgelehnt === 1 && e.besiegt === 1 && e.wiederholt === 0, { besiegt: e.besiegt, wiederholt: e.wiederholt, abgelehnt });
      R.check('  die Karte Alluring Light ist gespielt (Ablage), das abgelehnte Angebot hat sie nicht als abgebrochen markiert (nicht zurück auf die Hand)', e.t.pile(me, 'discardPile').includes('Alluring Light') && !e.t.pile(me, 'hand').includes('Alluring Light'), { ablage: e.t.pile(me, 'discardPile'), hand: e.t.pile(me, 'hand') });
      R.check('  keine Engine-Fehler, Zustand sauber', e.t.errors.length === 0 && e.t.audit().length === 0, { errors: e.t.errors, audit: e.t.audit() });
    }
    {
      const e = await licht({ ohneKunagi: true });
      R.check('Gegenprobe Alluring Light ohne Kunagi: genau 1 Kreatur, keine Wiederholung', e.besiegt === 1 && e.wiederholt === 0, { besiegt: e.besiegt });
    }

    // ── (B) Duel: der Pfeil-Bonus gehört dem Duellanten ──
    for (const spielt of [1, 0]) {
      const r = await L.szene('Duel', me, op, { attHand: ['Angelfeather Arrow'], nicht: true, vorbereiten: async (t, k) => { t.grantFor(me, 0, 'Angelfeather Arrow'); t.grantFor(me, spielt, 'Duel'); t.grantFor(me, spielt, 'Angelfeather Arrow'); } });
      const t = r.t;
      t.gs._deferGameOverCheck = true;
      t.targetFn = (v) => [(posHero(v, v[0].owner, 0) || v[0]).id];
      const ok = await t.play(me, 'Duel', { hero: spielt });
      const von0 = t.treffer.filter(x => x.srcOwner === me && x.srcHero === 0).map(x => x.amount);
      const von1 = t.treffer.filter(x => x.srcOwner === me && x.srcHero === 1).map(x => x.amount);
      R.check(`Held ${spielt} spielt Duel, Held 0 duelliert: Pfeil-Bonus (+60) nur auf dem ERSTEN Schlag von Held 0`, ok === true && gleich(von0, [160, 100, 100]), { ok, von0 });
      R.check(`  Held 1 schlägt nicht, hat keinen Bonus und keine scharfen Pfeile übrig`, von1.length === 0 && !(t.hero(me, 1)._armedArrows && t.hero(me, 1)._armedArrows.length) && !(t.hero(me, 0)._armedArrows && t.hero(me, 0)._armedArrows.length), { von1, a1: t.hero(me, 1)._armedArrows, a0: t.hero(me, 0)._armedArrows });
      R.check('  keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
