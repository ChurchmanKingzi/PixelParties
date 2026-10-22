'use strict';
// W51a · Punkt B · Al, 22.10.2026: Ricochet – was als SENKUNG zählt (gibt sich an die Folgetreffer weiter) und was als SCHILD (nicht).
// Prinzip (Al): „Verringert der Effekt den eingehenden Schaden selbst (Prozent, Flat, 'reduced by', Halbierung, Umleitung eines Teils) → SENKUNG; ist es Zusatz-HP/Puffer/
// Deckel/Boden, der erst NACH dem Schaden greift oder HP gewährt (Nao-Art, Immortal, capAtHPMinus1, Prophecy-Deckel) → SCHILD." Ausdrücklich Senkungen: Harpyformer Choir
// („damage is reduced by 100"), Dichotomy of Luna and Tempeste (Halbierung), Cloud in a Bottle (am Helden UND an der Kreatur), Johanna (Teil-Umleitung), Aquatic Shield
// (Surprise „Reduce that damage by 100" UND Rider „reduce the next damage by 100"). Voll auf 0 gesenkt → alle Folgetreffer 0 (sie treffen aber weiter).
// Beide Sitze, Helden- und Kreaturenziele, Gegenproben (Nao-artige Zusatz-HP, Immortal, Prophecy-Deckel). Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const halb = (n) => Math.ceil(n / 2);
const kette = (k, n) => { const o = []; let v = k; for (let i = 0; i < n; i++) { o.push(v); v = halb(v); } return o; };

async function lauf(me, op, opt) {
  const heroes = opt.heroes ? (me === 0 ? [opt.heroes.me, opt.heroes.op] : [opt.heroes.op, opt.heroes.me]) : undefined;
  const t = await H.fresh({ hand: me === 0 ? [['Ricochet'], []] : [[], ['Ricochet']], hp: 5000, active: me, ...(heroes ? { heroes } : {}) });
  const atk = opt.atk || 100;
  t.hero(me, 0).atk = atk; t.hero(me, 0).baseAtk = atk;
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
  const kInst = (s, hi = 0) => t.inst(x => x.zone === 'support' && x.owner === s && x.heroIdx === hi && x.zoneSlot === 0)[0];
  const kHp = (s, hi = 0) => { const c = kInst(s, hi); return c ? (c.counters?.currentHp ?? 1000) : null; };
  return { t, ok, dmg, cdmg, kHp, kInst };
}
const kreatur = (t, s, hi, name) => { t.put(s, hi, 0, name); return t.inst(x => x.zone === 'support' && x.owner === s && x.heroIdx === hi && x.zoneSlot === 0)[0]; };

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    const fehler = (r, was) => { R.check(was + ': keine Engine-Fehler', r.t.errors.length === 0, r.t.errors); R.check(was + ': Zustand sauber', r.t.audit().length === 0, r.t.audit()); };
    const KOPF_KREATUR = [[op, 'c'], [me, 0], [op, 0], [me, 1], [op, 1], [me, 2]];

    // ── Harpyformer Choir (Kreaturen-Schild vom Spieler vergeben): „the next damage … is reduced by 100" = SENKUNG ──
    { const r = await lauf(me, op, { atk: 300, reihe: KOPF_KREATUR, vorher: async (t) => { kreatur(t, op, 0, H.INERT.big); t.gs.players[op]._kreaturenSchild = [{ by: 'Harpyformer Choir', reduce: 100, turn: t.gs.turn }]; } });
      R.check('Choir auf dem Kreaturenkopf (300 − 100): Kreatur −200, Folgetreffer 100/50/25/13/7/4', r.cdmg[0] === 200 && gleich(r.dmg, kette(100, 6)), { c: r.cdmg, d: r.dmg });
      R.check('Choir: der Schutz ist verbraucht', !r.t.gs.players[op]._kreaturenSchild, r.t.gs.players[op]._kreaturenSchild); fehler(r, 'Choir Kopf'); }
    { const r = await lauf(me, op, { atk: 400, reihe: [[op, 0], [me, 'c'], [op, 1], [me, 0], [op, 2], [me, 1]], vorher: async (t) => { kreatur(t, me, 0, H.INERT.big); t.gs.players[me]._kreaturenSchild = [{ by: 'Harpyformer Choir', reduce: 100, turn: t.gs.turn }]; } });
      // Pos. 2 = eigene Kreatur: 200 − 100 = 100 → Pos. 3 = 50, 25, 13, 7
      R.check('Choir auf einer Kreatur an Position 2 (200 − 100): Kreatur −100, danach Helden 400/50/25/13/7', 1000 - r.kHp(me) === 100 && gleich(r.dmg, [400, 50, 25, 13, 7]), { k: 1000 - r.kHp(me), d: r.dmg }); fehler(r, 'Choir Pos.2'); }
    { const r = await lauf(me, op, { atk: 80, reihe: KOPF_KREATUR, vorher: async (t) => { kreatur(t, op, 0, H.INERT.big); t.gs.players[op]._kreaturenSchild = [{ by: 'Harpyformer Choir', reduce: 100, turn: t.gs.turn }]; } });
      R.check('Choir senkt den Kopf (80) auf 0: Kreatur −0, ALLE Folgetreffer 0 (sie treffen: 6 Heldentreffer)', r.kHp(op) === 1000 && r.dmg.length === 6 && r.dmg.every(x => x === 0), { k: r.kHp(op), d: r.dmg }); fehler(r, 'Choir auf 0'); }

    // ── Aquatic Shield ──
    //  (a) Rider „reduce the next damage each target you control would take … by 100": Einmal-Schild am Helden / an der Kreatur = SENKUNG
    { const r = await lauf(me, op, { atk: 300, vorher: async (t) => { t.hero(op, 0)._oneShotDmgShields = [{ amount: 100, source: 'Aquatic Shield', ownerIdx: op }]; } });
      R.check('Aquatic-Rider am Heldenkopf (300 − 100): Kopf 200, Folgetreffer 100/50/25/13/7', gleich(r.dmg, [200, 100, 50, 25, 13, 7]), r.dmg); fehler(r, 'Aquatic Rider Held'); }
    { const r = await lauf(me, op, { atk: 300, reihe: KOPF_KREATUR, vorher: async (t) => { const c = kreatur(t, op, 0, H.INERT.big); c.counters._oneShotDmgShields = [{ amount: 100, source: 'Aquatic Shield', ownerIdx: op }]; } });
      R.check('Aquatic-Rider am Kreaturenkopf (300 − 100): Kreatur −200, Folgetreffer 100/50/25/13/7/4', r.cdmg[0] === 200 && gleich(r.dmg, kette(100, 6)), { c: r.cdmg, d: r.dmg }); fehler(r, 'Aquatic Rider Kreatur'); }
    { const r = await lauf(me, op, { atk: 100, vorher: async (t) => { t.hero(op, 0)._oneShotDmgShields = [{ amount: 150, source: 'Aquatic Shield', ownerIdx: op }]; } });
      R.check('Aquatic-Rider schluckt den ganzen Kopf (100 − 150): Kopf 0 und ALLE Folgetreffer 0 (6 Treffer)', r.dmg.length === 6 && r.dmg.every(x => x === 0), r.dmg); fehler(r, 'Aquatic Rider ganz'); }
    { const r = await lauf(me, op, { atk: 300, reihe: [[op, 0], [me, 'c'], [op, 1], [me, 0], [op, 2], [me, 1]], vorher: async (t) => { const c = kreatur(t, me, 0, H.INERT.big); c.counters._oneShotDmgShields = [{ amount: 100, source: 'Aquatic Shield', ownerIdx: me }]; } });
      // Pos. 2 = eigene Kreatur: 150 − 100 = 50 → Pos. 3 = 25 …
      R.check('Aquatic-Rider an Position 2 (Kreatur 150 − 100 = 50): Folgetreffer 300/25/13/7/4', 1000 - r.kHp(me) === 50 && gleich(r.dmg, [300, 25, 13, 7, 4]), { k: 1000 - r.kHp(me), d: r.dmg }); fehler(r, 'Aquatic Rider Pos.2'); }
    //  (b) Surprise-Auslöser „Reduce that damage by 100" (echte Karte)
    { const r = await lauf(me, op, { atk: 300, vorher: async (t) => { t.putSurprise(op, 0, 'Aquatic Shield'); t.grantFor(op, 0, 'Aquatic Shield'); } });
      R.check('Aquatic Shield (Surprise, echte Karte): Kopf 300 − 100 = 200, Folgetreffer 100/50/25/13/7', gleich(r.dmg, [200, 100, 50, 25, 13, 7]), r.dmg); fehler(r, 'Aquatic Surprise'); }

    // ── Dichotomy of Luna and Tempeste (Halbierung brennender Ziele) ──
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 0).statuses.burned = { appliedTurn: 0 }; t.put(op, 1, 0, 'Dichotomy of Luna and Tempeste'); } });
      R.check('Dichotomy (Held, brennend) auf dem Kopf: 100 → 50, Folgetreffer 25/13/7/4/2', gleich(r.dmg, [50, 25, 13, 7, 4, 2]), r.dmg); fehler(r, 'Dichotomy Held'); }
    { const r = await lauf(me, op, { reihe: KOPF_KREATUR, vorher: async (t) => { const c = kreatur(t, op, 0, H.INERT.big); c.counters.burned = { appliedTurn: 0 }; t.put(op, 1, 0, 'Dichotomy of Luna and Tempeste'); } });
      R.check('Dichotomy (Kreatur, brennend) als Kopf: Kreatur −50, Folgetreffer 25/13/7/4/2/1', r.cdmg[0] === 50 && gleich(r.dmg, kette(50, 7).slice(1, 7)), { c: r.cdmg, d: r.dmg }); fehler(r, 'Dichotomy Kreatur'); }
    { const r = await lauf(me, op, { vorher: async (t) => { t.put(op, 1, 0, 'Dichotomy of Luna and Tempeste'); } });
      R.check('Gegenprobe: Dichotomy ohne Brand (Ziel nicht brennend) senkt nichts: 100/50/25/13/7/4', gleich(r.dmg, kette(100, 6)), r.dmg); }

    // ── Cloud in a Bottle (Hand des Verteidigers): „Halve any damage …" = SENKUNG, am Helden und an der Kreatur ──
    { const r = await lauf(me, op, { vorher: async (t) => { t.setHand(op, ['Cloud in a Bottle']); } });
      R.check('Cloud in a Bottle am Heldenkopf (100 → 50): Folgetreffer 25/13/7/4/2', gleich(r.dmg.slice(1), [25, 13, 7, 4, 2]), r.dmg);
      R.check('Cloud in a Bottle am Heldenkopf: der Held verliert netto 50 und trägt Cloudy', r.t.hp(op, 0) === 4950 && !!r.t.hero(op, 0).buffs?.cloudy, { hp: r.t.hp(op, 0), b: r.t.hero(op, 0).buffs }); fehler(r, 'CiB Held'); }
    { const r = await lauf(me, op, { reihe: KOPF_KREATUR, vorher: async (t) => { kreatur(t, op, 0, H.INERT.big); t.setHand(op, ['Cloud in a Bottle']); } });
      R.check('Cloud in a Bottle am Kreaturenkopf (100 → 50): Kreatur netto −50, Folgetreffer 25/13/7/4/2/1', 1000 - r.kHp(op) === 50 && gleich(r.dmg, [25, 13, 7, 4, 2, 1]), { k: 1000 - r.kHp(op), d: r.dmg }); fehler(r, 'CiB Kreatur'); }
    { const r = await lauf(me, op, { reihe: KOPF_KREATUR, vorher: async (t) => { kreatur(t, op, 0, H.INERT.frail); t.setHand(op, ['Cloud in a Bottle']); } });
      R.check('Cloud in a Bottle an einer Kreatur, die trotzdem fällt (10 HP): Folgetreffer 25/13/7/4/2/1', !r.kInst(op) && gleich(r.dmg, [25, 13, 7, 4, 2, 1]), { d: r.dmg, da: !!r.kInst(op) }); fehler(r, 'CiB Kreatur tödlich'); }
    { const r = await lauf(me, op, { vorher: async (t) => { t.addHand(me, 'Cloud in a Bottle'); } });
      // Position 2 ist der eigene Angreifer (me, Held 0): 50 → 25; Pos. 3 = 13 …
      // W51c: Cloud in a Bottle halbiert jetzt VOR dem Anwenden (kein Wiederherstellen mehr) – das Schadens-Log zeigt den ECHTEN Treffer 25 (vorher den vollen Betrag 50).
      R.check('Cloud in a Bottle des Angreifers an Position 2 (50 → 25): 100/25/13/7/4/2', gleich(r.dmg, [100, 25, 13, 7, 4, 2]), r.dmg); fehler(r, 'CiB eigene Seite'); }
    { const r = await lauf(me, op, {});
      R.check('Gegenprobe ohne Cloud in a Bottle: 100/50/25/13/7/4', gleich(r.dmg, kette(100, 6)), r.dmg); }

    // ── Johanna: Teil-Umleitung (Hälfte) bleibt SENKUNG ──
    { const r = await lauf(me, op, { vorher: async (t) => { t.setHero(op, 1, 'Johanna, Crusader of Light', 5000); } });
      // Kopf Held 0: 100 − 50 (umgeleitet an Johanna, eigene Logzeile) = 50 → Folgetreffer 25/13/7/4/2
      R.check('Johanna leitet die Hälfte des Kopfes um: Kopf 50 (+50 an Johanna), Folgetreffer 25/13/7/4/2', gleich(r.dmg, [50, 50, 25, 13, 7, 4, 2]), r.dmg); fehler(r, 'Johanna'); }

    // ── Gegenproben: SCHILD = Zusatz-HP / HP-Deckel / Deckel geben sich NICHT weiter ──
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 0).hp = 5300; } });   // Nao-artig: HP jenseits der Max-HP
      R.check('Zusatz-HP (Nao-artig, 5300/5000) am Kopf: voller Schaden 100, Folgetreffer unverändert 50/25/13/7/4', gleich(r.dmg, kette(100, 6)) && r.t.hp(op, 0) === 5200, { d: r.dmg, hp: r.t.hp(op, 0) });
      R.check('Zusatz-HP: keine Engine-Fehler', r.t.errors.length === 0, r.t.errors); }
    { const r = await lauf(me, op, { vorher: async (t) => { t.hero(op, 0).hp = 1; t.hero(op, 0).buffs = { immortal: { stacks: 1 } }; } });
      R.check('HP-Boden (Immortal bei 1 HP) am Kopf: Kopf 0, Folgetreffer trotzdem 50/25/13/7/4', gleich(r.dmg, [0, 50, 25, 13, 7, 4]), r.dmg); fehler(r, 'Immortal'); }
    { const r = await lauf(me, op, { atk: 300, heroes: { me: H.BLANK_HEROES, op: [H.BLANK_HEROES[0], null, null] }, reihe: [[op, 0], [me, 0], [me, 1]], vorher: async (t) => { t.put(op, 0, 0, 'Prophecy of Tempeste'); } });
      R.check('Deckel (Prophecy of Tempeste, „cannot exceed 100") am Kopf: Kopf 100, Folgetreffer rechnet von 300 → 150', gleich(r.dmg, [100, 150]), r.dmg); fehler(r, 'Prophecy-Deckel'); }
    { const r = await lauf(me, op, { atk: 300, vorher: async (t) => { t.hero(op, 0).hp = 60; t.hero(op, 0).buffs = { immortal: { stacks: 1 } }; } });
      R.check('HP-Boden (Immortal bei 60 HP): Kopf 59, Folgetreffer rechnen vom vollen 300: 150/75/38/19/10', gleich(r.dmg, [59, 150, 75, 38, 19, 10]), r.dmg); fehler(r, 'Immortal 60'); }
  }
  R.finish();
})();
