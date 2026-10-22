'use strict';
// W49a · Punkt 2 · Al, 22.10.2026 (Stand vor der Fix-Welle): Ricochet „scheint nur die Hälfte des *regulären* Schadens weiterzugeben statt die Hälfte des
// vollen angerichteten Schadens: Elixir of Strength oder die Arrows stärken den ersten Treffer von 150 auf 300, aber der zweite Treffer ist dann trotzdem nur 75."
// Kartentext: „The first target takes damage equal to the attacker's Attack stat. Every subsequent target takes half as much damage as the previous one (rounded up)."
// Regel (W49a): Folgetreffer = aufgerundete Hälfte des VOLLEN Schadens des Vorgängers inkl. aller Erhöhungen (Elixir of Strength +150, Pfeile/Magic Topaz,
// Niu, erhöhende Hook-Boni); die Quellen-Boni kommen beim Folgetreffer nicht noch einmal obendrauf. Reduktionen/Schilde des Vorgängers geben sich NICHT weiter
// (Ist-Zustand, Ja/Nein-Frage an Al im Abschlussbericht). Beide Sitze. Exit 0 = korrekt (Exit 1 auf der Basis: Folgetreffer = Hälfte des Nennwerts).
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const halb = (n) => Math.ceil(n / 2);
// Erwartete Kette ab Kopf `k`, `n` Treffer, optional mit Überschreibungen je Position (Reduktion des Ziels wirkt nur dort).
const kette = (k, n, ueber = {}) => { const o = []; let v = k; for (let i = 0; i < n; i++) { o.push(ueber[i] !== undefined ? ueber[i] : v); v = halb(v); } return o; };

async function lauf(me, op, opt) {
  const t = await H.fresh({ hand: me === 0 ? [['Ricochet'], []] : [[], ['Ricochet']], hp: 5000, active: me });
  t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100;
  if (opt.vorher) await opt.vorher(t);
  // Zielreihenfolge: Kopf = Gegner Held 0 (oder gesetzt), dann wechselnd Gegner-Held / eigener Held, jeweils der nächste ungewählte.
  const reihe = opt.reihe || [[op, 0], [me, 0], [op, 1], [me, 1], [op, 2], [me, 2]];
  let i = 0;
  t.targetFn = (valid) => {
    const w = reihe[i++];
    const v = w && valid.find(x => x.owner === w[0] && ((w[1] === 'c' ? x.type !== 'hero' : x.type === 'hero' && x.heroIdx === w[1])));
    return [(v || valid[0]).id];
  };
  t.reset();
  const ok = await t.play(me, 'Ricochet', { hero: 0 });
  const dmg = t.lg('damage').filter(d => d.source === 'Ricochet').map(d => d.amount);   // nur Heldentreffer (Kreaturenschaden steht nicht im Log `damage`)
  const kHp = (s) => { const c = t.inst(i => i.zone === 'support' && i.owner === s && i.heroIdx === 0 && i.zoneSlot === 0)[0]; return c ? (c.counters?.currentHp ?? 1000) : null; };
  return { t, ok, dmg, kHp };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const fehler = (r, was) => { R.check(was + ': keine Engine-Fehler', r.t.errors.length === 0, r.t.errors); R.check(was + ': Zustand sauber', r.t.audit().length === 0, r.t.audit()); };

    { const r = await lauf(me, op, {});
      R.check('Basis ohne Boni: 100/50/25/13/7/4', gleich(r.dmg, kette(100, 6)), r.dmg); fehler(r, 'Basis'); }

    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(me, 0).buffs = { empowered_strike: { stacks: 1 } }; } });
      R.check('Elixir of Strength (+150): 250/125/63/32/16/8, Buff verbraucht', gleich(r.dmg, kette(250, 6)) && !r.t.hero(me, 0).buffs?.empowered_strike, { dmg: r.dmg, buffs: Object.keys(r.t.hero(me, 0).buffs || {}) });
      fehler(r, 'Elixir'); }

    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(me, 0)._armedArrows = [{ flatDamage: 60, sourceCard: 'Magic Topaz' }]; } });
      R.check('Magic Topaz (+60) auf dem Kopf: 160/80/40/20/10/5 (Pfeil-Bonus nicht erneut je Treffer)', gleich(r.dmg, kette(160, 6)), r.dmg); fehler(r, 'Topaz'); }

    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(me, 0).buffs = { empowered_strike: { stacks: 1 } }; t.hero(me, 0)._armedArrows = [{ flatDamage: 60, sourceCard: 'Angelfeather Arrow' }]; } });
      R.check('Elixir + Pfeil kombiniert: 310/155/78/39/20/10', gleich(r.dmg, kette(310, 6)), r.dmg); fehler(r, 'Elixir+Pfeil'); }

    // Gegenprobe Reduktion: Cloudy (halber Schaden) auf dem 2. Ziel halbiert nur DIESEN Treffer, die Kette läuft vom Nennwert weiter.
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(me, 0).buffs = { empowered_strike: { stacks: 1 } }; t.hero(me, 0).buffs.cloudy = { damageMultiplier: 0.5 }; } });
      // Position 2 ist der eigene Held 0 (Angreifer, trägt Cloudy): 125 -> 63; Position 3 weiter von 125: 63.
      R.check('Reduktion des Vorgängers gibt sich nicht weiter (Cloudy auf Treffer 2: 63, Treffer 3 bleibt 63)', gleich(r.dmg, kette(250, 6, { 1: 63 })), r.dmg); fehler(r, 'Cloudy'); }

    // Kopf-Ziel mit Cloudy: der Kopf nimmt weniger, die Kette rechnet vom vollen Kopfschaden.
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 0).buffs = { cloudy: { damageMultiplier: 0.5 } }; t.hero(me, 0)._armedArrows = [{ flatDamage: 60, sourceCard: 'Magic Topaz' }]; } });
      R.check('Kopf mit Cloudy: Kopf 80 (halb von 160), Treffer 2 = 80 (halbe 160), dann 40/20/10/5', gleich(r.dmg, kette(160, 6, { 0: 80 })), r.dmg); fehler(r, 'Kopf-Cloudy'); }

    // Kopf ist eine Kreatur (Kreaturenpfad): Boni zählen ebenfalls.
    { const r = await lauf(me, op, { reihe: [[op, 'c'], [me, 0], [op, 0], [me, 1], [op, 1], [me, 2]],
        vorher: async (t) => { t.put(op, 0, 0, H.INERT.big); t.hero(me, 0).buffs = { empowered_strike: { stacks: 1 } }; } });
      // Kette: Kreatur 250, dann Held(me) 125, Held(op) 63, Held(me) 32 … (Heldentreffer im Log: 125/63/32/16/8/4)
      R.check('Kopf = Kreatur mit Elixir: Kreatur −250, danach 125/63/32/16/8/4', 1000 - r.kHp(op) === 250 && gleich(r.dmg, [125, 63, 32, 16, 8, 4]), { kreatur: 1000 - r.kHp(op), dmg: r.dmg });
      R.check('Elixir nach Kreaturen-Kopf verbraucht', !r.t.hero(me, 0).buffs?.empowered_strike, Object.keys(r.t.hero(me, 0).buffs || {})); fehler(r, 'Kreaturenkopf'); }

    // Folgetreffer auf eine Kreatur (Kreaturenpfad): Hälfte des vollen Vorgängers, Pfeil nicht erneut.
    { const r = await lauf(me, op, { reihe: [[op, 0], [me, 'c'], [op, 1], [me, 0], [op, 2], [me, 1]],
        vorher: async (t) => { t.put(me, 0, 0, H.INERT.big); t.hero(me, 0)._armedArrows = [{ flatDamage: 60, sourceCard: 'Magic Topaz' }]; } });
      // Kette: Held(op) 160, Kreatur(me) 80, Held(op) 40, Held(me) 20, Held(op) 10, Held(me) 5 (Heldentreffer im Log: 160/40/20/10/5)
      R.check('Folgetreffer auf eigene Kreatur (Pfeil +60): Kreatur −80 (Hälfte von 160), Helden 160/40/20/10/5', 1000 - r.kHp(me) === 80 && gleich(r.dmg, [160, 40, 20, 10, 5]), { kreatur: 1000 - r.kHp(me), dmg: r.dmg }); fehler(r, 'Kreaturen-Folge'); }

    // Gegenprobe: normale Ein-Ziel-Attack mit Elixir bleibt +150; Pfeile bleiben bei Mehrziel-Attacks je Ziel (Whirlwind) wirksam.
    { const t = await H.fresh({ hand: me === 0 ? [['Attack'], []] : [[], ['Attack']], hp: 5000, active: me });
      t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100; t.hero(me, 0).buffs = { empowered_strike: { stacks: 1 } };
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      t.reset(); await t.play(me, 'Attack', { hero: 0 });
      const d = t.lg('damage').filter(x => x.source === 'Attack').map(x => x.amount);
      R.check('Gegenprobe: normale Attack mit Elixir = 100 + 150', gleich(d, [250]), d); }
    { const t = await H.fresh({ hand: me === 0 ? [['Whirlwind Strike'], []] : [[], ['Whirlwind Strike']], hp: 5000, active: me });
      t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100; t.hero(me, 0)._armedArrows = [{ flatDamage: 60, sourceCard: 'Magic Topaz' }];
      t.put(op, 0, 0, H.INERT.big);
      t.targetFn = (v) => v.filter(x => x.type === 'hero' && x.owner === op).slice(0, 1).map(x => x.id);
      t.reset(); await t.play(me, 'Whirlwind Strike', { hero: 0 });
      const d = t.lg('damage').filter(x => x.source === 'Whirlwind Strike').map(x => x.amount);
      R.check('Gegenprobe: Mehrziel-Attack (Whirlwind) behält den Pfeil-Bonus je Ziel (Held 160)', d.length >= 1 && d.every(x => x === 160), d); }
  }
  R.finish();
})();
