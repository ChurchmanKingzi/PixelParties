'use strict';
// W50a · Punkt 1 · Al, 22.10.2026 (Antwort auf die Rückfragen aus Welle 49): Ricochet – „Every subsequent target takes half as much damage as the previous one (rounded up)."
// Regel: Folgetreffer = aufgerundete Hälfte des ECHTEN Schadens des Vorgängers = Schaden nach allen SENKUNGEN (Cloudy, Reduktions-Hooks, Prozent-/Flat-Abzüge, Halbieren)
// und inkl. aller ERHÖHUNGEN des Kopfes (Elixir/Pfeile/Topaz), aber VOR HP-Deckeln/Böden (Immortal, Zusatz-HP wie Nao).
// W51a (Al, 22.10.2026) umgestellt: der Einmal-Schild (Aquatic Shield "reduce the next damage by X", Harpyformer Choir) VERRINGERT den Schaden = SENKUNG, auch Folgetreffer werden schwächer. Wird der Schaden irgendwo auf 0 gebracht
// (Negation/Immunität/Block), sind ALLE Folgetreffer 0 – sie TREFFEN aber weiter (On-Hit-Effekte wie Flame Arrow/Burn bleiben). On-Hit-Status trifft ALLE Ketten-Ziele.
// Beide Sitze, Helden- und Kreaturenziele. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const halb = (n) => Math.ceil(n / 2);
const kette = (k, n, ueber = {}) => { const o = []; let v = k; for (let i = 0; i < n; i++) { o.push(ueber[i] !== undefined ? ueber[i] : v); v = halb(v); } return o; };

async function lauf(me, op, opt) {
  const t = await H.fresh({ hand: me === 0 ? [['Ricochet'], []] : [[], ['Ricochet']], hp: 5000, active: me });
  t.hero(me, 0).atk = 100; t.hero(me, 0).baseAtk = 100;
  if (opt.vorher) await opt.vorher(t);
  const reihe = opt.reihe || [[op, 0], [me, 0], [op, 1], [me, 1], [op, 2], [me, 2]];
  let i = 0;
  t.targetFn = (valid) => {
    const w = reihe[i++];
    const v = w && valid.find(x => x.owner === w[0] && (w[1] === 'c' ? x.type !== 'hero' : x.type === 'hero' && x.heroIdx === w[1]));
    return [(v || valid[0]).id];
  };
  t.reset();
  const ok = await t.play(me, 'Ricochet', { hero: 0 });
  const dmg = t.lg('damage').filter(d => d.source === 'Ricochet').map(d => d.amount);
  const cdmg = t.lg('creature_damage').filter(d => d.source === 'Ricochet').map(d => d.amount);
  const kHp = (s, hi = 0) => { const c = t.inst(x => x.zone === 'support' && x.owner === s && x.heroIdx === hi && x.zoneSlot === 0)[0]; return c ? (c.counters?.currentHp ?? 1000) : null; };
  return { t, ok, dmg, cdmg, kHp };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const fehler = (r, was) => { R.check(was + ': keine Engine-Fehler', r.t.errors.length === 0, r.t.errors); R.check(was + ': Zustand sauber', r.t.audit().length === 0, r.t.audit()); };

    { const r = await lauf(me, op, {});
      R.check('Basis ohne Boni: 100/50/25/13/7/4', gleich(r.dmg, kette(100, 6)), r.dmg); fehler(r, 'Basis'); }

    // ── SENKUNGEN geben sich weiter ──
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(me, 0).buffs = { empowered_strike: { stacks: 1 } }; t.hero(me, 0).buffs.cloudy = { damageMultiplier: 0.5 }; } });
      // Position 2 = eigener Held 0 (Angreifer, trägt Cloudy): 125 → 63; ab jetzt rechnet die Kette von 63 weiter: 32/16/8/4.
      R.check('Cloudy auf Treffer 2 (Elixir-Kopf 250): 250/63/32/16/8/4', gleich(r.dmg, [250, 63, 32, 16, 8, 4]), r.dmg); fehler(r, 'Cloudy Pos.2'); }

    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 0).buffs = { cloudy: { damageMultiplier: 0.5 } }; t.hero(me, 0)._armedArrows = [{ flatDamage: 60, sourceCard: 'Magic Topaz' }]; } });
      R.check('Kopf mit Cloudy (Topaz 160): Kopf 80, dann 40/20/10/5/3', gleich(r.dmg, [80, 40, 20, 10, 5, 3]), r.dmg); fehler(r, 'Kopf-Cloudy'); }

    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 1).buffs = { cloudy: { damageMultiplier: 0.5 } }; } });
      // Treffer 3 = Gegner Held 1 mit Cloudy: Betrag 25 → 13; danach ceil(13/2)=7, 4, 2.
      R.check('Cloudy auf Treffer 3 (ohne Boni): 100/50/13/7/4/2', gleich(r.dmg, [100, 50, 13, 7, 4, 2]), r.dmg); fehler(r, 'Cloudy Pos.3'); }

    // Reduktions-Hook am Helden (angehängtes Petrification Break: „any damage it would take is halved"): Treffer 3: 25 → 13, Rest von 13 aus.
    { const r = await lauf(me, op, { vorher: async (t) => { t.put(op, 1, 0, 'Petrification Break'); } });
      R.check('Hook-Halbierung (Petrification Break) auf Treffer 3: 100/50/13/7/4/2', gleich(r.dmg, [100, 50, 13, 7, 4, 2]), r.dmg); fehler(r, 'Petrification Break'); }

    // Kreatur als Kopf mit Flat-Reduktion (Loyal Labradoodle: −20 je „Loyal"-Kreatur): 100 → 80 → Folge 40.
    { const r = await lauf(me, op, { reihe: [[op, 'c'], [me, 0], [op, 0], [me, 1], [op, 1], [me, 2]],
        vorher: async (t) => { t.put(op, 0, 0, 'Loyal Labradoodle'); } });
      R.check('Kreaturenkopf mit Flat-Reduktion (Labradoodle −20): Kreatur nimmt 80, Folgetreffer 40/20/10/5/3/2', r.cdmg[0] === 80 && gleich(r.dmg, [40, 20, 10, 5, 3, 2]), { c: r.cdmg, dmg: r.dmg });
      fehler(r, 'Labradoodle-Kopf'); }

    // Folgetreffer auf eine Kreatur mit Cloudy (Kreaturenpfad, Buff-Multiplikator): Betrag 50 → 25, Rest von 25 aus: 13/7/4/2
    { const r = await lauf(me, op, { reihe: [[op, 0], [me, 'c'], [op, 1], [me, 0], [op, 2], [me, 1]],
        vorher: async (t) => { t.put(me, 0, 0, H.INERT.big); const c = t.inst(x => x.zone === 'support' && x.owner === me && x.heroIdx === 0 && x.zoneSlot === 0)[0]; c.counters.buffs = { cloudy: { damageMultiplier: 0.5 } }; } });
      R.check('Folgetreffer auf Kreatur mit Cloudy: Kreatur −25, danach Helden 100/13/7/4/2', 1000 - r.kHp(me) === 25 && gleich(r.dmg, [100, 13, 7, 4, 2]), { k: 1000 - r.kHp(me), dmg: r.dmg });
      fehler(r, 'Kreatur-Cloudy'); }

    // ── Einmal-Schild = SENKUNG (W51a); HP-Deckel/Böden geben sich NICHT weiter ──
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 0)._oneShotDmgShields = [{ amount: 60, source: 'Aquatic Shield', ownerIdx: op }]; } });
      R.check('Einmal-Schild (−60, Aquatic Shield) auf dem Kopf ist eine SENKUNG: Kopf nimmt 40, Folgetreffer 20/10/5/3/2', gleich(r.dmg, [40, 20, 10, 5, 3, 2]), r.dmg); fehler(r, 'Einmal-Schild'); }

    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 0).hp = 1; t.hero(op, 0).buffs = { immortal: { stacks: 1 } }; } });
      R.check('HP-Deckel (Immortal) auf dem Kopf: Kopf nimmt 0, Folgetreffer trotzdem 50/25/13/7/4', gleich(r.dmg, [0, 50, 25, 13, 7, 4]), r.dmg); fehler(r, 'Immortal'); }

    { const r = await lauf(me, op, { reihe: [[op, 0], [me, 'c'], [op, 1], [me, 0], [op, 2], [me, 1]],
        vorher: async (t) => { t.put(me, 0, 0, H.INERT.big); const c = t.inst(x => x.zone === 'support' && x.owner === me && x.heroIdx === 0 && x.zoneSlot === 0)[0]; c.counters._oneShotDmgShields = [{ amount: 40, source: 'Aquatic Shield', ownerIdx: me }]; } });
      // Folgetreffer 2 (Kreatur): 50 − 40 Schild = 10; Treffer 3 rechnet von 10 (Senkung, W51a).
      R.check('Einmal-Schild (Senkung) auf einer Kreatur (Pos. 2): Kreatur −10, Pos. 3 rechnet von 10 → 5/3/2/1', 1000 - r.kHp(me) === 10 && gleich(r.dmg, [100, 5, 3, 2, 1]), { k: 1000 - r.kHp(me), dmg: r.dmg }); fehler(r, 'Kreatur-Schild'); }

    // ── NEGATION / IMMUNITÄT: alles danach 0, aber die Treffer finden statt ──
    { const r = await lauf(me, op, { vorher: async (t) => { t.gs.players[me].damageLocked = true; } });
      R.check('Kopf negiert (Flame-Avalanche-Sperre auf Gegner-Zielen): Kopf 0 und ALLE Folgetreffer 0 (6 Treffer)', r.dmg.length === 6 && r.dmg.every(x => x === 0), r.dmg); fehler(r, 'Negation Held'); }

    { const r = await lauf(me, op, { reihe: [[op, 'c'], [me, 0], [op, 0], [me, 1], [op, 1], [me, 2]],
        vorher: async (t) => { t.put(op, 0, 0, H.INERT.big); const c = t.inst(x => x.zone === 'support' && x.owner === op && x.heroIdx === 0 && x.zoneSlot === 0)[0]; c.counters._cardinalImmune = true; } });
      R.check('Kreaturenkopf immun: Kreatur 0, alle Folgetreffer 0 (6 Heldentreffer)', r.kHp(op) === 1000 && r.dmg.length === 6 && r.dmg.every(x => x === 0), { k: r.kHp(op), dmg: r.dmg }); fehler(r, 'Negation Kreatur'); }

    // Negation mitten in der Kette: ab da 0.
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(me, 0).buffs = {}; t.gs.players[me].damageLocked = false; t.hero(op, 1).statuses = {}; },
        reihe: [[op, 0], [me, 0], [op, 1], [me, 1], [op, 2], [me, 2]] });
      R.check('Gegenprobe ohne Negation läuft normal (100/50/25/13/7/4)', gleich(r.dmg, kette(100, 6)), r.dmg); }

    // ── On-Hit-Effekte (Flame Arrow = +10 und Burn) treffen ALLE Ziele der Kette, auch bei 0 Schaden und auf Kreaturen ──
    const burn = [{ flatDamage: 10, applyBurn: true, sourceCard: 'Flame Arrow' }];
    const brennt = (t, w) => w[1] === 'c'
      ? !!t.inst(x => x.zone === 'support' && x.owner === w[0] && x.heroIdx === (w[2] ?? 0) && x.zoneSlot === 0)[0]?.counters?.burned
      : !!t.hero(w[0], w[1]).statuses?.burned;
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(me, 0)._armedArrows = burn.map(x => ({ ...x })); } });
      const ziele = [[op, 0], [me, 0], [op, 1], [me, 1], [op, 2], [me, 2]];
      R.check('Flame Arrow: Kopf 110, Folge 55/28/14/7/4 (Bonus nur im Kopf)', gleich(r.dmg, kette(110, 6)), r.dmg);
      R.check('Flame Arrow: ALLE 6 Helden der Kette brennen', ziele.every(w => brennt(r.t, w)), ziele.map(w => brennt(r.t, w))); fehler(r, 'Flame Heroes'); }

    { const r = await lauf(me, op, { reihe: [[op, 'c'], [me, 'c'], [op, 0], [me, 0], [op, 1], [me, 1]],
        vorher: async (t) => { t.put(op, 0, 0, H.INERT.big); t.put(me, 1, 0, H.INERT.big); t.hero(me, 0)._armedArrows = burn.map(x => ({ ...x })); } });
      // Reihe: [op,'c'] = Kreatur (op, Held 0), [me,'c'] = erste eigene Kreatur (me, Held 1).
      R.check('Flame Arrow auf Kreaturen und Helden gemischt: beide Kreaturen und alle Helden brennen',
        brennt(r.t, [op, 'c', 0]) && brennt(r.t, [me, 'c', 1]) && brennt(r.t, [op, 0]) && brennt(r.t, [me, 0]) && brennt(r.t, [op, 1]) && brennt(r.t, [me, 1]),
        { opK: brennt(r.t, [op, 'c', 0]), meK: brennt(r.t, [me, 'c', 1]), oh0: brennt(r.t, [op, 0]), mh0: brennt(r.t, [me, 0]), oh1: brennt(r.t, [op, 1]), mh1: brennt(r.t, [me, 1]) });
      fehler(r, 'Flame gemischt'); }

    { const r = await lauf(me, op, { vorher: async (t) => { t.gs.players[me].damageLocked = true; t.hero(me, 0)._armedArrows = burn.map(x => ({ ...x })); } });
      // Gegner-Seite ist gesperrt (alle Treffer 0), die eigenen Helden (Treffer 2/4/6) werden vom Folgetreffer 0 getroffen.
      const ziele = [[op, 0], [me, 0], [op, 1], [me, 1], [op, 2], [me, 2]];
      R.check('Flame Arrow bei Schaden 0: die Treffer finden statt, ALLE 6 brennen', ziele.every(w => brennt(r.t, w)) && r.dmg.every(x => x === 0), { dmg: r.dmg, b: ziele.map(w => brennt(r.t, w)) }); fehler(r, 'Flame Null'); }
  }
  R.finish();
})();
