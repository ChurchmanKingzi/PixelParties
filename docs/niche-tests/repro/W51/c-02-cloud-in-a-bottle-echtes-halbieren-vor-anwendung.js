'use strict';
// W51c · Auftrag B · Al, 22.10.2026: „Warum läuft Cloud in a Bottle per Wiederherstellung nach dem Treffer? Mir würde intuitiv ein echtes Halbieren des Schadens sinnvoller erscheinen."
// Kartentext: „Play this card immediately when a target you control takes any damage. Halve any damage that target would take for the rest of the turn (including that damage) (rounded up)."
// Erwartet: der Treffer wird VOR dem Anwenden (und vor Einmal-Schilden/Deckeln/HP-Böden, wie jede Schadenssenkung zu ihrer Stufe) auf ceil(Betrag/2) gesenkt – keine
// Wiederherstellung, kein Zwischenzustand mit vollem Treffer. „Cloudy" gilt für den Rest des Zuges für weiteren Schaden. Rulings bleiben: Welle 14 Q10 (auch tödlicher Schaden
// wird angeboten, der VOLLE Betrag inkl. Overkill wird halbiert; reicht die Hälfte noch zum Tod, stirbt das Ziel, kein Cloudy für einen Gefallenen), Welle 13 Q134 (Kreaturen),
// nur Schaden (kein Zerstören/Opfer). Beide Sitze, Helden- und Kreaturenziele, Mehrfachziele, Letal-/Overkill-Fälle, Gegenproben. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const CIB = 'Cloud in a Bottle';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

(async () => {
  const R = H.runner();
  for (const [a, d] of [[0, 1], [1, 0]]) {   // a = Angreifer, d = Verteidiger (hält die Flasche)
    R.section('Sitz ' + d + ' verteidigt (Angreifer Sitz ' + a + ')');
    const opts = (extra = {}) => ({ hand: [0, 1].map(i => i === d ? [CIB] : []), hp: 800, active: a, ...extra });
    const src = (o = a) => ({ name: 'Test', owner: o, heroIdx: 0, controller: o });
    const gefragt = (t) => t.prompts.some(p => p.d.title === CIB);
    const verbraucht = (t) => !t.pile(d, 'hand').includes(CIB) && t.pile(d, 'deletedPile').includes(CIB);
    const dealH = (t, hi, n, srcO) => t.run(() => t.engine.actionDealDamage(srcO || src(), t.hero(d, hi), n, 'destruction_spell'));
    const dealK = (t, c, n) => t.run(() => t.engine.actionDealCreatureDamage(src(), c, n, 'destruction_spell', { sourceOwner: a, canBeNegated: true }));
    const kreatur = (t, hi, name, hp) => { const c = t.put(d, hi, 0, name || H.INERT.creature); c.counters.currentHp = hp ?? 200; c.counters.maxHp = Math.max(hp ?? 200, 200); return c; };
    const keinRestore = (t) => t.lg('cloud_bottle_restore').length === 0;

    // ── Held, Direktschaden ──
    { const t = await H.fresh(opts());
      await dealH(t, 0, 150);
      R.check('Held 150 → 75: HP 725, Karte verbraucht, Cloudy liegt', t.hp(d, 0) === 725 && verbraucht(t) && !!t.hero(d, 0).buffs?.cloudy, { hp: t.hp(d, 0), b: t.hero(d, 0).buffs });
      const dm = t.lg('damage').map(x => x.amount);
      R.check('echtes Halbieren: das Schadens-Log zeigt NUR den halbierten Treffer 75 (kein voller Treffer + Rückgabe)', dm.length === 1 && dm[0] === 75 && keinRestore(t), { dm, restore: t.lg('cloud_bottle_restore') });
      R.check('Cloudy läuft zu Zugende ab (expiresAtTurn = Zug + 1)', t.hero(d, 0).buffs.cloudy.expiresAtTurn === t.gs.turn + 1, t.hero(d, 0).buffs.cloudy);
      await dealH(t, 0, 20);
      R.check('weiterer Schaden desselben Zuges halbiert (20 → 10)', t.hp(d, 0) === 715, t.hp(d, 0));
      R.check('Held 0: keine Engine-Fehler / Zustand sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const t = await H.fresh(opts());
      await dealH(t, 0, 101);
      R.check('aufgerundet: 101 → 51 (HP 749)', t.hp(d, 0) === 749, t.hp(d, 0)); }

    // ── Letal / Overkill (Welle 14, Q10) ──
    { const t = await H.fresh(opts()); t.hero(d, 0).hp = 100;
      await dealH(t, 0, 150);
      R.check('tödlich angeboten: 100 HP, 150 → 75: Held lebt mit 25, trägt Cloudy, nie auf 0 gefallen', gefragt(t) && t.hp(d, 0) === 25 && !!t.hero(d, 0).buffs?.cloudy && t.lg('hero_defeated').length === 0 && keinRestore(t), { hp: t.hp(d, 0), g: gefragt(t), b: t.hero(d, 0).buffs }); }
    { const t = await H.fresh(opts()); t.hero(d, 0).hp = 100;
      await dealH(t, 0, 300);
      R.check('Overkill: 100 HP, 300 → 150 ≥ 100: Held stirbt, Karte verbraucht, KEIN Cloudy für den Gefallenen', t.hp(d, 0) <= 0 && verbraucht(t) && !t.hero(d, 0).buffs?.cloudy, { hp: t.hp(d, 0), v: verbraucht(t), b: t.hero(d, 0).buffs }); }
    { const t = await H.fresh(opts()); t.hero(d, 0).hp = 100;
      await dealH(t, 0, 200);
      R.check('Grenze: 100 HP, 200 → 100 = genau tödlich: Held stirbt', t.hp(d, 0) <= 0, t.hp(d, 0)); }

    // ── Reihenfolge: die Halbierung kommt VOR Deckeln / Böden / Einmal-Schilden ──
    { const t = await H.fresh(opts()); t.hero(d, 0).hp = 100; t.hero(d, 0).buffs = { immortal: { stacks: 1 } };
      await dealH(t, 0, 500);
      R.check('Immortal: 500 → 250 → Deckel HP−1 (99) → Held bleibt bei 1 HP (Halbierung VOR dem Deckel; früher: Deckel 99, dann Rückgabe → 50 HP)', t.hp(d, 0) === 1, t.hp(d, 0)); }
    { const t = await H.fresh(opts()); t.hero(d, 0)._oneShotDmgShields = [{ amount: 100, source: 'Aquatic Shield', ownerIdx: d }];
      await dealH(t, 0, 300);
      R.check('Einmal-Schild −100: 300 → 150 (Cloud) → 50 (Schild) → HP 750 (früher: 300 − 100 = 200, danach Rückgabe → HP 700)', t.hp(d, 0) === 750, t.hp(d, 0)); }
    { const t = await H.fresh(opts()); t.hero(d, 0).hp = 100; t.hero(d, 0).buffs = { immortal: { stacks: 1 } };
      await dealH(t, 0, 150);
      R.check('Immortal + 150 (→ 75, überlebbar): HP 25 (Halbierung zuerst, Deckel greift nicht)', t.hp(d, 0) === 25, t.hp(d, 0)); }

    // ── Fenster / Gegenproben ──
    { const t = await H.fresh(opts()); t.hero(d, 0).buffs = { cloudy: { damageMultiplier: 0.5, source: 'Cloud Pillow' } };
      await dealH(t, 0, 100);
      R.check('Stapel-Sperre: Held trägt schon Cloudy (Cloud Pillow) → kein Angebot, Treffer 50, Karte bleibt', !gefragt(t) && t.hp(d, 0) === 750 && t.pile(d, 'hand').includes(CIB), { g: gefragt(t), hp: t.hp(d, 0) }); }
    { const t = await H.fresh(opts());
      await t.run(() => t.engine.actionDealDamage(src(d), t.hero(a, 0), 100, 'destruction_spell'));
      R.check('Gegenprobe: ein Gegner-Held wird getroffen → keine Flasche gefragt, voller Treffer', !gefragt(t) && t.hp(a, 0) === 700 && t.pile(d, 'hand').includes(CIB), { g: gefragt(t), hp: t.hp(a, 0) }); }
    { const t = await H.fresh(opts()); t.script.push({ match: (x) => x.title === CIB, answer: () => false });   // Hand-Fenster: Ablehnen = false
      await dealH(t, 0, 100);
      R.check('abgelehnt: voller Treffer, Karte bleibt auf der Hand, kein Cloudy', gefragt(t) && t.hp(d, 0) === 700 && t.pile(d, 'hand').includes(CIB) && !t.hero(d, 0).buffs?.cloudy, { hp: t.hp(d, 0) }); }
    { const t = await H.fresh(opts()); t.hero(d, 0).charmedBy = a;   // Held steht bei d, wird aber von a kontrolliert → kein „target you control" für d
      await dealH(t, 0, 100);
      R.check('Gegenprobe Übernahme: der Held steht bei mir, wird aber vom Gegner kontrolliert → kein Angebot', !gefragt(t) && t.hp(d, 0) === 700, { g: gefragt(t), hp: t.hp(d, 0) }); }
    { const t = await H.fresh(opts()); t.hero(a, 0).charmedBy = d;   // Held des Angreifers, von d kontrolliert → d darf reagieren
      await t.run(() => t.engine.actionDealDamage(src(a), t.hero(a, 0), 100, 'destruction_spell'));
      R.check('Übernommener Gegner-Held (von mir kontrolliert) wird getroffen: Flasche wird angeboten, 100 → 50', gefragt(t) && t.hp(a, 0) === 750 && verbraucht(t), { g: gefragt(t), hp: t.hp(a, 0) }); }
    { // Nicht senkbarer Schaden (Tempeste, the Weather Fairy: weder verringerbar noch negierbar) → nicht angeboten, Karte nicht verbraucht
      const base = [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], ['Atta, Speaker of Desires', 'Hulijing, the Foxdemon', 'George, the Mad Tyrant King']];
      const t = await H.fresh(opts({ heroes: base.map((h, i) => i === d ? ['Tempeste, the Weather Fairy', h[1], h[2]] : h) }));
      await dealH(t, 0, 100);
      R.check('unaufhaltbarer Schaden (Tempeste): kein Angebot, voller Treffer, Karte bleibt', !gefragt(t) && t.hp(d, 0) === 700 && t.pile(d, 'hand').includes(CIB), { g: gefragt(t), hp: t.hp(d, 0) }); }
    { // Buff verhindert (z. B. Anti-Magic-Schild): die Engine halbiert diesen Treffer trotzdem
      const t = await H.fresh(opts()); const orig = t.engine.actionAddBuff.bind(t.engine);
      t.engine.actionAddBuff = async (h, o, i, name, ...rest) => name === 'cloudy' ? false : orig(h, o, i, name, ...rest);
      await dealH(t, 0, 100);
      R.check('Cloudy-Buff verhindert: der Treffer wird trotzdem halbiert (100 → 50), Karte verbraucht', t.hp(d, 0) === 750 && verbraucht(t), { hp: t.hp(d, 0) }); }

    // ── Heldenziel über die Zielwahl (Post-Target-Fenster), Mehrfachziele ──
    { const t = await H.fresh(opts({ hand: [0, 1].map(i => i === a ? ['Fireball'] : [CIB]) })); t.hero(d, 0).hp = 100;
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === d && x.heroIdx === 0).id];
      await t.play(a, 'Fireball', { hero: 0 });
      R.check('Fireball (150) auf Held mit 100 HP: angeboten, halbiert (75), Held überlebt mit 25, Cloudy, kein Wiederherstellen', gefragt(t) && t.hp(d, 0) === 25 && !!t.hero(d, 0).buffs?.cloudy && keinRestore(t), { hp: t.hp(d, 0), g: gefragt(t) });
      R.check('Fireball: Schadens-Log zeigt den halbierten Treffer 75', t.lg('damage').map(x => x.amount).join() === '75', t.lg('damage').map(x => x.amount)); }
    { const t = await H.fresh(opts({ hand: [0, 1].map(i => i === a ? ['Butterfly Cloud'] : [CIB]) }));
      t.targetFn = (v, cfg) => cfg && cfg.title === CIB ? [v.find(x => x.heroIdx === 1).id] : undefined;
      await t.play(a, 'Butterfly Cloud', { hero: 0 });
      const hp = [0, 1, 2].map(i => t.hp(d, i));
      R.check('Mehrfachziel (Butterfly Cloud, 50 auf alle): ich wähle Held 1 → 25, die anderen voll (50)', hp[0] === 750 && hp[1] === 775 && hp[2] === 750 && verbraucht(t) && !!t.hero(d, 1).buffs?.cloudy && !t.hero(d, 0).buffs?.cloudy, { hp, b: t.hero(d, 1).buffs }); }

    // ── Kreaturen ──
    { const t = await H.fresh(opts()); const c = kreatur(t, 0, null, 100);
      await dealK(t, c, 150);
      R.check('Kreatur 100 HP, 150 → 75: überlebt mit 25, Cloudy, Karte verbraucht, nie Wiederherstellung', gefragt(t) && c.counters.currentHp === 25 && !!c.counters.buffs?.cloudy && verbraucht(t) && keinRestore(t), { hp: c.counters.currentHp, b: c.counters.buffs, g: gefragt(t) });
      await dealK(t, c, 20);
      R.check('weiterer Schaden desselben Zuges halbiert (25 − 10 = 15)', c.counters.currentHp === 15, c.counters.currentHp);
      R.check('Kreatur: keine Engine-Fehler / Zustand sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const t = await H.fresh(opts()); const c = kreatur(t, 0, null, 100);
      await dealK(t, c, 300);
      R.check('Kreatur Overkill (100 HP, 300 → 150): stirbt trotzdem, Karte verbraucht', !t.find(H.INERT.creature, 'support') && t.pile(d, 'discardPile').includes(H.INERT.creature) && verbraucht(t), { z: t.zone(d, 0, 0), hand: t.pile(d, 'hand') }); }
    { const t = await H.fresh(opts()); const c = kreatur(t, 0, null, 100);
      c.counters._oneShotDmgShields = [{ amount: 100, source: 'Aquatic Shield', ownerIdx: d }];
      await dealK(t, c, 300);
      R.check('Kreatur + Einmal-Schild −100: 300 → 150 (Cloud) → 50 (Schild): 100 − 50 = 50 HP (früher: 300 − 100 = 200 ≥ 100, Kreatur tot)', c.counters.currentHp === 50 && !!t.find(H.INERT.creature, 'support'), { hp: c.counters.currentHp }); }
    { const t = await H.fresh(opts()); const c = t.put(a, 0, 0, H.INERT.creature); c.counters.currentHp = 100;
      await t.run(() => t.engine.actionDealCreatureDamage(src(d), c, 150, 'destruction_spell', { sourceOwner: d, canBeNegated: true }));
      R.check('Gegenprobe: fremde Kreatur → kein Angebot, Kreatur stirbt', !gefragt(t) && !t.find(H.INERT.creature, 'support'), { g: gefragt(t) }); }
    { const t = await H.fresh(opts()); const c = kreatur(t, 0, null, 100);
      await t.run(() => t.engine.actionDestroyCard(src(a), c, { source: 'Test' }));
      R.check('Gegenprobe: Zerstören ist kein Schaden → kein Angebot', !gefragt(t) && !t.find(H.INERT.creature, 'support'), { g: gefragt(t) }); }
    { const t = await H.fresh(opts()); const c = kreatur(t, 0, null, 200); c.counters.buffs = { cloudy: { damageMultiplier: 0.5, source: 'Cloud Pillow' } };
      await dealK(t, c, 100);
      R.check('Kreatur mit Cloudy (Stapel-Sperre): kein Angebot, Treffer 50', !gefragt(t) && c.counters.currentHp === 150, { hp: c.counters.currentHp }); }
    { const t = await H.fresh(opts()); const c = kreatur(t, 0, null, 200); const orig = t.engine.actionAddCreatureBuff.bind(t.engine);
      t.engine.actionAddCreatureBuff = async (i, name, ...r) => name === 'cloudy' ? false : orig(i, name, ...r);
      await dealK(t, c, 100);
      R.check('Kreatur, Cloudy-Buff verhindert: der Treffer wird trotzdem halbiert (200 − 50 = 150)', c.counters.currentHp === 150 && verbraucht(t), { hp: c.counters.currentHp }); }
    { // Flächenschaden auf mehrere eigene Kreaturen: je Kreatur ein Angebot nur für die erste (ein Angebot je Ziel; die Karte ist nur einmal da)
      const t = await H.fresh(opts()); const c1 = kreatur(t, 0, null, 200), c2 = kreatur(t, 1, null, 200);
      await t.run(() => t.engine.actionDealCreatureDamage(src(), c1, 80, 'destruction_spell', { sourceOwner: a, canBeNegated: true }));
      await t.run(() => t.engine.actionDealCreatureDamage(src(), c2, 80, 'destruction_spell', { sourceOwner: a, canBeNegated: true }));
      R.check('zwei Kreaturen nacheinander: nur die erste wird geschützt (eine Karte): 200−40 = 160 / 200−80 = 120', c1.counters.currentHp === 160 && c2.counters.currentHp === 120, { c1: c1.counters.currentHp, c2: c2.counters.currentHp }); }

    // ── Cloud Pillow (Auftrag C): gleiche Wirkung ohne Sonderweg – Cloudy-Buff mit Multiplikator ──
    { const t = await H.fresh(opts({ hand: [0, 1].map(i => i === d ? ['Cloud Pillow'] : []), gold: 100 }));
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === d && x.heroIdx === 0).id];
      await t.play(d, 'Cloud Pillow', { hero: 0 });
      await dealH(t, 0, 100);
      R.check('Cloud Pillow: Treffer 100 → 50 direkt (HP 750), im Log nur der halbierte Treffer, keine Wiederherstellung', t.hp(d, 0) === 750 && t.lg('damage').map(x => x.amount).join() === '50' && keinRestore(t), { hp: t.hp(d, 0), dm: t.lg('damage').map(x => x.amount) }); }
  }
  R.finish();
})().catch(e => { process.stderr.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
