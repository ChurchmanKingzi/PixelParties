'use strict';
// W15a · R6 (Rückfrage 6 aus W14b) · Al, 16.10.2026: „Unwanted Audience sperrt auch Wiederholungen durch Spirit of the Forbidden Grimoire/Kohta?" — „Ja."
// Erwartet: Die Sperre „aktive Effekte" (Status active_locked, Unwanted Audience) gilt auch für GELIEHENE Aktivierungen: (A) Spirit of the Forbidden Grimoire kann den aktiven Effekt
//   einer gesperrten Kreatur nicht ausleihen (nicht wählbar, kein Plan), (B) Kohta, the Silent Observer kann den Effekt einer gesperrten Kreatur nicht ein zweites Mal auslösen
//   (die Wiederholung bleibt aus), (C) die direkten Engine-Wege `reactivateCreatureEffect` / `prepareCreatureEffectFor` lehnen ab. Kontrollen ohne Sperre klappen wie in W11/b-73.
//   (D) End-to-End mit der echten Karte: ist die Kreatur nach Unwanted Audience gesperrt, ist auch der Spirit selbst (eine Kreatur des Gegners) gesperrt. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SG = 'Spirit of the Forbidden Grimoire';
  const ok = (t) => t.errors.length === 0 && t.audit().length === 0;

  R.section('(A) Grimoire: der gesperrte Cannon Tower ist nicht leihbar; ungesperrt schon (Kontrolle)');
  for (const gesperrt of [false, true]) {
    const t = await H.fresh({});
    const gs = t.gs;
    t.put(0, 2, 0, SG).turnPlayed = 1;
    const tower = t.put(0, 0, 0, 'Cannon Tower'); tower.turnPlayed = 1;
    const tower2 = t.put(0, 1, 0, 'Cannon Tower'); tower2.turnPlayed = 1;   // zweite Kopie, damit das Grimoire in jedem Fall etwas Wählbares hat? nein — gleicher Name zählt nicht doppelt
    t.engine.cardInstances.splice(t.engine.cardInstances.indexOf(tower2), 1); gs.players[0].supportZones[1][0] = [];
    if (gesperrt) tower.counters.active_locked = 1;
    let angeboten = null;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) { angeboten = valid.filter(x => !x.ineligible).map(x => x.cardName); return valid.filter(x => !x.ineligible && x.cardName === 'Cannon Tower').map(x => x.id).slice(0, 1); }
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    gs.currentPhase = 2;
    const h0 = t.hp(1, 0);
    await t.activateCreature(0, 2, 0);
    const schaden = h0 - t.hp(1, 0);
    if (!gesperrt) R.check('Kontrolle: Grimoire leiht den Tower (150 Schaden)', schaden === 150 && (angeboten || []).includes('Cannon Tower'), { schaden, angeboten });
    else R.check('gesperrter Tower: nicht angeboten, kein Schaden', !(angeboten || []).includes('Cannon Tower') && schaden === 0, { schaden, angeboten });
    R.check(`${gesperrt ? 'gesperrt' : 'Kontrolle'}: keine Engine-/Audit-Fehler`, ok(t), { e: t.errors, a: t.audit() });
  }

  R.section('(B) Kohta: die Wiederholung von Mr. Jiggles bleibt aus, wenn Jiggles gesperrt ist; sonst feuert sie');
  for (const sperren of [false, true]) {
    const t = await H.fresh({ heroes: [['Kohta, the Silent Observer', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null] });
    const gs = t.gs;
    const jiggles = t.put(0, 1, 0, 'Mr. Jiggles'); jiggles.turnPlayed = 1;
    const frail = t.put(1, 0, 0, H.INERT.frail), big = t.put(1, 1, 0, H.INERT.big);
    let calls = 0;
    t.targetFn = (valid) => {
      calls++;
      if (calls === 1 && sperren) jiggles.counters.active_locked = 1;   // Unwanted Audience trifft mitten im Lauf — vor der Wiederholung
      const pick = calls === 1 ? frail : big;
      return [valid.find(v => v.owner === 1 && v.heroIdx === pick.heroIdx && v.type !== 'hero').id];
    };
    t.policy.confirm = true;
    gs.currentPhase = 2;
    await t.activateCreature(0, 1, 0);
    const bigSchaden = 1000 - (big.counters.currentHp ?? 1000);
    if (!sperren) R.check('Kontrolle: Kohta wiederholt (100 auf die große Kreatur)', bigSchaden === 100, { bigSchaden, calls });
    else R.check('Jiggles gesperrt: keine Wiederholung (große Kreatur unberührt)', bigSchaden === 0, { bigSchaden, calls });
    R.check(`${sperren ? 'gesperrt' : 'Kontrolle'}: keine Engine-/Audit-Fehler`, ok(t), { e: t.errors, a: t.audit() });
  }

  R.section('(C) direkte Engine-Wege lehnen die gesperrte Kreatur ab');
  {
    const t = await H.fresh({});
    const tower = t.put(0, 0, 0, 'Cannon Tower'); tower.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.gs.currentPhase = 2;
    tower.counters.active_locked = 1;
    const h0 = t.hp(1, 0);
    const re = await t.run(() => t.engine.reactivateCreatureEffect(tower, 0));
    const plan = await t.run(() => t.engine.prepareCreatureEffectFor(tower, 0));
    R.check('reactivateCreatureEffect: false, kein Schaden', re === false && t.hp(1, 0) === h0, { re, hp: t.hp(1, 0) });
    R.check('prepareCreatureEffectFor: ok=false', plan && plan.ok === false, plan);
    delete tower.counters.active_locked;
    const re2 = await t.run(() => t.engine.reactivateCreatureEffect(tower, 0));
    R.check('Kontrolle ohne Sperre: reactivateCreatureEffect wirkt (150 Schaden)', re2 !== false && h0 - t.hp(1, 0) === 150, { re2, hp: t.hp(1, 0) });
  }

  R.section('(D) echte Unwanted Audience: der gegnerische Spirit ist als Kreatur ebenfalls gesperrt');
  {
    const t = await H.fresh({ hand: [[], ['Unwanted Audience']], hp: 800 });
    t.grantFor(1, 0, 'Unwanted Audience');
    const spirit = t.put(0, 2, 0, SG); spirit.turnPlayed = 1;
    const tower = t.put(0, 0, 0, 'Cannon Tower'); tower.turnPlayed = 1;
    t.gs.activePlayer = 1; t.gs.turn = 5; t.policy.confirm = true;
    await t.endTurn();   // Zug 6 (Sitz 0): Unwanted Audience wird angeboten und gespielt
    R.check('Unwanted Audience wurde gespielt; Tower UND Spirit tragen active_locked', t.prompts.some(p => p.d.title === 'Unwanted Audience') && !!tower.counters.active_locked && !!spirit.counters.active_locked, { tower: tower.counters, spirit: spirit.counters });
    let angeboten = null;
    t.targetFn = (valid, cfg) => { if (cfg && cfg.title === SG) angeboten = valid.map(x => x.cardName); return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };
    t.gs.currentPhase = 2;
    const h0 = t.hp(1, 0);
    const r1 = await t.activateCreature(0, 2, 0);
    const r2 = await t.activateCreature(0, 0, 0);
    R.check('weder Spirit noch Tower lassen sich aktivieren, kein Schaden', r1 === false && r2 === false && t.hp(1, 0) === h0 && angeboten === null, { r1, r2, hp: t.hp(1, 0), angeboten });
    R.check('keine Engine-/Audit-Fehler', ok(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
