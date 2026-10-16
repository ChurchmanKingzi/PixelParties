'use strict';
// W14a · Rückfrage 10 (Welle 13 / W13b; M01-04 Cloud in a Bottle, Q134-Folge) · Al, 16.10.2026:
//   „Ja, sowohl bei Heroes als auch Creatures soll Cloud auch für Schaden angeboten werden, der tödlich wäre, und diesen halbieren. Natürlich könnte der
//    Schaden, wenn er genug Overkill gehabt hätte, trotzdem noch tödlich sein."
// Erwartet: Cloud wird für Helden UND Kreaturen auch angeboten, wenn der Treffer sonst tödlich wäre; der VOLLE Betrag (inkl. Overkill) wird halbiert (aufgerundet).
//   Reicht der halbierte Betrag noch zum Tod, stirbt das Ziel trotzdem (die Karte ist verbraucht). Überlebt es, trägt es „Cloudy". Zerstören/Opfer: kein Angebot.
const H = require('../../lib/h.js');
const CIB = 'Cloud in a Bottle';
(async () => {
  const R = H.runner();
  const angeboten = (t) => t.prompts.some(p => p.d.title === CIB);
  const src = (o) => ({ name: 'Test', owner: o, heroIdx: 0, controller: o });

  R.section('Held, Direktschaden (Nach-Schaden-Fenster): 100 HP, 150 Schaden');
  { const t = await H.fresh({ hand: [[], [CIB]], hp: 800 });
    t.hero(1, 0).hp = 100;
    await t.run(() => t.engine.actionDealDamage(src(0), t.hero(1, 0), 150, 'destruction_spell'));
    R.check('Cloud wurde angeboten', angeboten(t), t.prompts.map(p => p.d.title));
    R.check('Held überlebt mit 25 HP (150 → 75)', t.hp(1, 0) === 25, t.hp(1, 0));
    R.check('Held trägt „Cloudy", Karte verbraucht', !!t.hero(1, 0).buffs?.cloudy && !t.pile(1, 'hand').includes(CIB), { buffs: Object.keys(t.hero(1, 0).buffs || {}), hand: t.pile(1, 'hand') });
    R.check('Held ist nicht als besiegt verbucht', t.hero(1, 0).hp > 0 && t.lg('hero_defeated').length === 0 && t.lg('hero_ko').length === 0, { hp: t.hp(1, 0) });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }

  R.section('Held, Direktschaden mit Overkill: 100 HP, 300 Schaden (halbiert 150 ≥ 100)');
  { const t = await H.fresh({ hand: [[], [CIB]], hp: 800 });
    t.hero(1, 0).hp = 100;
    await t.run(() => t.engine.actionDealDamage(src(0), t.hero(1, 0), 300, 'destruction_spell'));
    R.check('Cloud wurde angeboten und verbraucht', angeboten(t) && !t.pile(1, 'hand').includes(CIB), { prompts: t.prompts.map(p => p.d.title), hand: t.pile(1, 'hand') });
    R.check('Held stirbt trotzdem (0 HP)', t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Held, Spell mit Zielfenster (Fireball 150): 100 HP');
  { const t = await H.fresh({ hand: [['Fireball'], [CIB]], hp: 800 });
    t.hero(1, 0).hp = 100;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Cloud wurde angeboten', angeboten(t), t.prompts.map(p => p.d.title));
    R.check('Held überlebt mit 25 HP', t.hp(1, 0) === 25, t.hp(1, 0));
    R.check('Held trägt „Cloudy"', !!t.hero(1, 0).buffs?.cloudy, Object.keys(t.hero(1, 0).buffs || {}));
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  { const t = await H.fresh({ hand: [['Fireball'], [CIB]], hp: 800 });
    t.hero(1, 0).hp = 60;   // 150 halbiert = 75 ≥ 60 → trotzdem tödlich
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Fireball (halbiert 75) auf Held mit 60 HP: Held stirbt trotzdem, Karte verbraucht', t.hp(1, 0) <= 0 && !t.pile(1, 'hand').includes(CIB), { hp: t.hp(1, 0), hand: t.pile(1, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('Kreatur: 100 HP, 150 Schaden');
  { const t = await H.fresh({ hand: [[], [CIB]], hp: 800 });
    const c = t.put(1, 0, 0, H.INERT.creature);
    c.counters.currentHp = 100; c.counters.maxHp = 200;
    await t.run(() => t.engine.actionDealCreatureDamage(src(0), c, 150, 'destruction_spell', { sourceOwner: 0, canBeNegated: true }));
    R.check('Cloud wurde angeboten', angeboten(t), t.prompts.map(p => p.d.title));
    R.check('Kreatur überlebt mit 25 HP (150 → 75)', t.find(H.INERT.creature, 'support') && c.counters.currentHp === 25, { hp: c.counters.currentHp, zone: t.zone(1, 0, 0) });
    R.check('Kreatur trägt „Cloudy", Karte verbraucht', !!c.counters.buffs?.cloudy && !t.pile(1, 'hand').includes(CIB), { buffs: Object.keys(c.counters.buffs || {}), hand: t.pile(1, 'hand') });
    await t.run(() => t.engine.actionDealCreatureDamage(src(0), c, 20, 'destruction_spell', { sourceOwner: 0, canBeNegated: true }));
    R.check('weiterer Schaden desselben Zuges halbiert (25 − 10 = 15)', c.counters.currentHp === 15, c.counters.currentHp);
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  R.section('Kreatur: Overkill (100 HP, 300 Schaden → halbiert 150): stirbt trotzdem');
  { const t = await H.fresh({ hand: [[], [CIB]], hp: 800 });
    const c = t.put(1, 0, 0, H.INERT.creature);
    c.counters.currentHp = 100; c.counters.maxHp = 200;
    await t.run(() => t.engine.actionDealCreatureDamage(src(0), c, 300, 'destruction_spell', { sourceOwner: 0, canBeNegated: true }));
    R.check('Cloud wurde angeboten und verbraucht', angeboten(t) && !t.pile(1, 'hand').includes(CIB), { prompts: t.prompts.map(p => p.d.title), hand: t.pile(1, 'hand') });
    R.check('Kreatur ist tot (Brett leer, Ablage)', !t.find(H.INERT.creature, 'support') && t.pile(1, 'discardPile').includes(H.INERT.creature), { zone: t.zone(1, 0, 0), abl: t.pile(1, 'discardPile') });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }

  R.section('Gegenproben: fremde Kreatur, Zerstören, ohne Cloud');
  { const t = await H.fresh({ hand: [[], [CIB]], hp: 800 });
    const c = t.put(0, 0, 0, H.INERT.creature);   // gehört dem Gegner des Cloud-Besitzers (Sitz 0)
    c.counters.currentHp = 100;
    await t.run(() => t.engine.actionDealCreatureDamage(src(1), c, 150, 'destruction_spell', { sourceOwner: 1, canBeNegated: true }));
    R.check('fremde Kreatur: kein Angebot, Kreatur stirbt', !angeboten(t) && !t.find(H.INERT.creature, 'support'), { prompts: t.prompts.map(p => p.d.title) }); }
  { const t = await H.fresh({ hand: [[], [CIB]], hp: 800 });
    const c = t.put(1, 0, 0, H.INERT.creature);
    await t.run(() => t.engine.actionDestroyCard(src(0), c, { source: 'Test' }));
    R.check('Zerstören ist kein Schaden: kein Cloud-Angebot, Kreatur weg', !angeboten(t) && !t.find(H.INERT.creature, 'support'), { prompts: t.prompts.map(p => p.d.title) }); }
  { const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.hero(1, 0).hp = 100;
    await t.run(() => t.engine.actionDealDamage(src(0), t.hero(1, 0), 150, 'destruction_spell'));
    R.check('ohne Cloud: tödlicher Treffer tötet', t.hp(1, 0) <= 0, t.hp(1, 0)); }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
