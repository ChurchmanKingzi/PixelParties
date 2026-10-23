'use strict';
// NK2-05 · Spy in the Enemy's Camp (23.10.2026)
// Kartentext: „Play this card immediately when your opponent summons a Creature. You may activate that Creature's active effect during your turn as if you control it."
//   Spell (Reaction), Decay Magic Lv1. Al: die Kreatur bleibt beim Gegner; die Marke ist KEIN Status (Heilen entfernt sie nicht) und gilt, bis die Kreatur das Brett verlässt.
const H = require('../../lib/h.js');
const SpyShared = require('../../../../cards/effects/_spy-shared.js');
(async () => {
  const R = H.runner();
  const SPY = "Spy in the Enemy's Camp";
  const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
  const kreatur = (t, name = 'Cavalry', seat = 1) => t.inst(c => c.zone === 'support' && c.name === name && c.owner === seat)[0];
  const marke = (t, name, seat = 1) => { const c = kreatur(t, name, seat); return c ? ((c.counters || {})._spyMask || 0) : null; };
  const fenster = (t) => t.prompts.filter(p => /Spy in the Enemy/.test(JSON.stringify(p.d))).length;

  /** Sitz 0 hält Spy (Held 0 mit Decay Magic), Sitz 1 die Kreatur `name` (und optional mehr). */
  const frisch = async (o = {}) => {
    const t = await H.fresh({ hand: [[SPY, ...(o.hand0 || [])], [o.creature || 'Cavalry', ...(o.hand1 || [])]], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    t.grantFor(0, 0, SPY);
    t.policy.confirm = true;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1) || valid.find(x => !x.ineligible); return v ? [v.id] : null; };
    return t;
  };
  const sommer = (t, name = 'Cavalry', slot = 0) => t.play(1, name, { hero: 0, slot });
  /** Mein Zug, Main Phase: die Kreatur darf benutzt werden. */
  const meinZug = (t) => { t.gs.activePlayer = 0; t.gs.turn = (t.gs.turn || 0) + 1; t.phase(2); t.resetActions(0); };
  const anbieten = (t) => t.engine.getActivatableCreatures(0).filter(e => e.spy);

  R.section('A · Grundfall: Reaktion auf die Beschwörung, Marke, Karte in der Ablage');
  {
    const t = await frisch();
    const r = await sommer(t);
    R.check('Kreatur beschworen', r === true && !!kreatur(t), r);
    R.check('Reaktionsfenster wurde angeboten', fenster(t) >= 1, t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
    R.check('Spionage-Marke an der Kreatur (Sitz 0)', marke(t, 'Cavalry') === 1, marke(t, 'Cavalry'));
    R.check('Spy liegt in der Ablage von Sitz 0, nicht mehr in der Hand', t.pile(0, 'discardPile').includes(SPY) && !t.pile(0, 'hand').includes(SPY), { disc: t.pile(0, 'discardPile') });
    R.check('die Kreatur bleibt Eigentum und Kontrolle des Gegners (Sitz 1)', t.engine.kontrolleurVon(kreatur(t)) === 1 && kreatur(t).owner === 1);
    R.check('keine Engine-Fehler, Audit sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Benutzen in meinem Zug („as if you control it")');
  {
    const t = await frisch();
    await sommer(t);
    meinZug(t);
    const liste = anbieten(t);
    R.check('der Sammler bietet die Kreatur Sitz 0 an (spy, charmedOwner = Gegenseite, aktivierbar)', liste.length === 1 && liste[0].cardName === 'Cavalry' && liste[0].canActivate === true && liste[0].charmedOwner === 1, liste);
    const inst = kreatur(t);
    const hpVor = [0, 1, 2].map(i => t.hp(1, i)), hpMein = [0, 1, 2].map(i => t.hp(0, i));
    const r = await t.activateCreature(0, inst.heroIdx, inst.zoneSlot, { charmedOwner: 1 });
    R.check('Aktivierung gelang', r === true, r);
    const hpNach = [0, 1, 2].map(i => t.hp(1, i));
    R.check('Cavalry traf den Helden des GEGNERS (Sitz 1) — „your opponent" aus meiner Sicht — und nicht mich', hpNach.some((h, i) => h < hpVor[i]) && [0, 1, 2].every(i => t.hp(0, i) === hpMein[i]), { hpVor, hpNach, mein: [0, 1, 2].map(i => t.hp(0, i)) });
    R.check('danach gehört die Kreatur wieder dem Gegner (Kontrolle zurück, kein stolenBy)', t.engine.kontrolleurVon(inst) === 1 && inst.stolenBy == null && inst.controller !== 0, { ctrl: inst.controller, st: inst.stolenBy });
    R.check('die Marke bleibt nach dem Benutzen', marke(t, 'Cavalry') === 1);
    R.check('Rundensperre: in diesem Zug nicht noch einmal', anbieten(t).length === 1 && anbieten(t)[0].canActivate === false && anbieten(t)[0].exhausted === true, anbieten(t));
    R.check('keine Engine-Fehler, Audit sauber', sauber(t), { e: t.errors, a: t.audit() });
    // Der Besitzer darf sie auf seinem eigenen Zug ebenfalls benutzen (eigene Rundensperre je Zug)
    t.gs.activePlayer = 1; t.gs.turn++; t.phase(2); t.resetActions(1); inst.turnPlayed = 0;
    const eig = t.engine.getActivatableCreatures(1).filter(e => e.cardName === 'Cavalry');
    R.check('der Gegner bekommt seine eigene Kreatur in seinem Zug weiter angeboten', eig.length === 1 && eig[0].canActivate === true, eig);
    t.gs.activePlayer = 0;
  }

  R.section('C · „you / your opponent" im geliehenen Effekt sind meine — Chatty Town Guard');
  {
    const t = await frisch({ creature: 'Chatty Town Guard', hand0: ['ZZ Dummy'] });
    await sommer(t, 'Chatty Town Guard');
    R.check('Marke gesetzt', marke(t, 'Chatty Town Guard') === 1, marke(t, 'Chatty Town Guard'));
    meinZug(t);
    t.script.push({ match: d => d.type === 'cardPick' || d.type === 'handPick' || /hand/i.test(d.type || ''), answer: (d) => d.eligibleIndices ? { handIndex: d.eligibleIndices[0], cardName: t.gs.players[0].hand[d.eligibleIndices[0]] } : undefined });
    const inst = kreatur(t, 'Chatty Town Guard');
    const handVor = [t.pile(0, 'hand').length, t.pile(1, 'hand').length];
    const r = await t.activateCreature(0, inst.heroIdx, inst.zoneSlot, { charmedOwner: 1 });
    R.note('Chatty Town Guard benutzt: Ergebnis & Handgrößen', { r, vor: handVor, nach: [t.pile(0, 'hand').length, t.pile(1, 'hand').length], prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
  }

  R.section('D · Nicht angeboten');
  {
    const t = await frisch();
    const r = await t.play(0, 'Cavalry', { hero: 1, slot: 0 });   // MEINE eigene Beschwörung (Sitz 0 hält Spy)
    R.check('eigene Beschwörung: kein Fenster, keine Marke', fenster(t) === 0 && marke(t, 'Cavalry', 0) === 0 || marke(t, 'Cavalry', 0) === 0 && fenster(t) === 0, { f: fenster(t), r });
  }
  {
    const t = await frisch({ creature: 'ZZ Dummy' });
    await sommer(t, 'ZZ Dummy');
    R.check('Kreatur ohne aktiven Effekt: kein Fenster, keine Marke', fenster(t) === 0 && marke(t, 'ZZ Dummy') === 0, { f: fenster(t), m: marke(t, 'ZZ Dummy') });
  }
  {
    const t = await frisch();
    t.script.unshift({ match: d => d.type === 'confirm' && /Spy in the Enemy/.test(JSON.stringify(d)), answer: () => false });   // Kettenfenster: `promptGeneric` liefert hier den Boolean
    await sommer(t);
    R.check('abgelehnt: keine Marke, Spy bleibt auf der Hand', marke(t, 'Cavalry') === 0 && t.pile(0, 'hand').includes(SPY), { m: marke(t, 'Cavalry'), hand: t.pile(0, 'hand') });
  }
  {
    const t = await frisch(); t.setHero(0, 0, 'Atta, Speaker of Desires', 800);   // kein Decay Magic
    t.setAbilities(0, 0, [[], [], []]);
    await sommer(t);
    R.check('ohne Decay Magic Lv1: kein Fenster, keine Marke', fenster(t) === 0 && marke(t, 'Cavalry') === 0, { f: fenster(t) });
  }
  {
    const t = await frisch();
    await sommer(t);
    t.gs.activePlayer = 1; t.gs.turn++; t.phase(2);
    R.check('im Zug des Gegners wird sie mir nicht angeboten', anbieten(t).length === 0, anbieten(t));
    meinZug(t); t.phase(3);
    R.check('Action Phase: kostenlose Effekte sind Main-Phase-Sache — nicht angeboten', anbieten(t).length === 0, anbieten(t));
  }

  R.section('E · Marke ist kein Status: Heilen entfernt sie nicht');
  {
    const t = await frisch();
    await sommer(t);
    const inst = kreatur(t);
    inst.counters.poisoned = 1; inst.counters.burned = 1;
    const alle = require('../../../../cards/effects/_hooks').getCleansableStatuses();
    const weg = t.engine.cleanseCreatureStatuses(inst, alle, 'Test');
    await new Promise(r => setTimeout(r, 100));
    R.check('nach vollständiger Heilung (alle heilbaren Status) hängt die Marke noch', marke(t, 'Cavalry') === 1 && !inst.counters.poisoned && !inst.counters.burned && weg.length >= 1, { c: inst.counters, weg });
    meinZug(t);
    inst.counters.frozen = 1;
    R.check('eingefroren: nicht angeboten', anbieten(t).length === 0, anbieten(t));
    delete inst.counters.frozen;
    R.check('wieder frei: angeboten', anbieten(t).length === 1 && anbieten(t)[0].canActivate === true, anbieten(t));
  }

  R.section('F · Die Marke endet, wenn die Kreatur das Brett verlässt');
  {
    const t = await frisch({ hand1: ['Cavalry'] });
    await sommer(t);
    const alt = kreatur(t);
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0 }, alt));
    R.check('Kreatur tot: nicht mehr auf dem Brett, nicht mehr angeboten', !kreatur(t) && anbieten(t).length === 0, { an: anbieten(t) });
    t.setHand?.(0, []);
    t.policy.confirm = false;                                   // kein zweiter Spy: nur prüfen, dass die neue Instanz markenfrei beginnt
    await sommer(t, 'Cavalry', 1);
    R.check('neu beschworene Cavalry beginnt ohne Marke', marke(t, 'Cavalry') === 0, marke(t, 'Cavalry'));
  }
  {
    const t = await frisch();
    await sommer(t);
    const alt = kreatur(t);
    await t.run(() => t.engine.actionMoveCard(alt, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 }));
    R.check('auf die Hand zurückgekehrt: Instanz weg oder ohne Marke', !t.inst(c => c.name === 'Cavalry' && c.zone === 'support').length, { z: t.inst(c => c.name === 'Cavalry').map(c => c.zone + ':' + ((c.counters || {})._spyMask || 0)) });
    t.policy.confirm = false;
    await sommer(t, 'Cavalry', 2);
    R.check('erneut beschworen: ohne Marke', marke(t, 'Cavalry') === 0, marke(t, 'Cavalry'));
  }

  R.section('G · Negierte Beschwörung setzt keine Marke (Bausteintest)');
  {
    const t = await frisch();
    const link = { id: 'L1', cardName: 'Cavalry', owner: 1 };
    SpyShared.spyVormerken(t.engine, 0, link);
    SpyShared.spyKetteBeendet(t.engine, link, true);
    const fake = { name: 'Cavalry', owner: 1, zone: 'support', counters: {}, heroIdx: 0, zoneSlot: 0 };
    SpyShared.spyLandung(t.engine, fake, 1);
    R.check('negiert: keine Marke', !fake.counters._spyMask, fake.counters);
    SpyShared.spyVormerken(t.engine, 0, link);
    SpyShared.spyKetteBeendet(t.engine, link, false);
    const echt = { name: 'Cavalry', owner: 1, zone: 'support', counters: {}, heroIdx: 0, zoneSlot: 0 };
    SpyShared.spyLandung(t.engine, { ...echt, counters: {}, name: 'Anderer Name' }, 1);
    R.check('anderer Name: keine Marke, Vormerkung bleibt', !t.gs._spyVormerkungen || t.gs._spyVormerkungen.length === 1);
    SpyShared.spyLandung(t.engine, echt, 0);
    R.check('anderer Beschwörer: keine Marke', !echt.counters._spyMask);
    SpyShared.spyLandung(t.engine, echt, 1);
    R.check('nicht negiert: Marke für Sitz 0, Vormerkung verbraucht', echt.counters._spyMask === 1 && !t.gs._spyVormerkungen, { m: echt.counters, v: t.gs._spyVormerkungen });
  }

  R.section('H · Geliehener Effekt mit Aktionskosten: ein eigener Held zahlt');
  {
    const t = await frisch({ creature: 'The Spawn Mother' });
    await sommer(t, 'The Spawn Mother');
    R.check('Spawn Mother: Marke gesetzt', marke(t, 'The Spawn Mother') === 1, marke(t, 'The Spawn Mother'));
    meinZug(t); t.phase(3);
    const liste = anbieten(t);
    R.check('Action Phase: Spawn Mother wird mir angeboten (kostet eine Aktion)', liste.length === 1 && liste[0].cardName === 'The Spawn Mother', liste);
  }

  R.section('I · CPU');
  {
    // Sitz 0 ist die CPU: spielt Spy auf die Beschwörung (Standard-Reaktion) und benutzt die Kreatur danach in seinem Zug über den Spy-Zweig in `activateCreatureEffects`.
    const cpu = require('../../../../cards/effects/_cpu.js');
    const t = await frisch();
    cpu.installCpuBrain(t.engine);
    t.targetFn = null;
    await sommer(t);
    R.check('CPU: Marke gesetzt (Spy als Reaktion gespielt)', marke(t, 'Cavalry') === 1, marke(t, 'Cavalry'));
    meinZug(t);
    t.engine._cpuPlayerIdx = 0;
    const hpVor = [0, 1, 2].map(i => t.hp(1, i));
    const helpers = { room: t.room, doActivateCreatureEffect: (room, pi, params) => t.run(() => require('../../../../server.js').skillTestHandlers.doActivateCreatureEffect(room, pi, params)) };
    await cpu._test.activateCreatureEffects(t.engine, helpers);
    const hpNach = [0, 1, 2].map(i => t.hp(1, i));
    R.check('CPU benutzt die Spionagekreatur: ein Gegnerheld verliert HP', hpNach.some((h, i) => h < hpVor[i]), { hpVor, hpNach });
    R.check('Kreatur danach wieder beim Gegner, keine Engine-Fehler', t.engine.kontrolleurVon(kreatur(t)) === 1 && t.errors.length === 0, t.errors);
  }
  R.finish();
})();
