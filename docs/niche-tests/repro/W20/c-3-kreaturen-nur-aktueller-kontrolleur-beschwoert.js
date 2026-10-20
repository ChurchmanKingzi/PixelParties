'use strict';
// W20c · Frage 3 · Al, 20.10.2026: „Soll auch das Beschwören einer Kreatur aus der Hand über einen abgegebenen eigenen Helden dem Kontrolleur vorbehalten sein?“
// — „Ja, nur der aktuelle Kontrolleur darf mit einem Hero Creatures beschwören.“
//
// Regel: Kreaturen beschwört mit einem Helden NUR der Spieler, der ihn gerade kontrolliert — von der Hand, per Zusatzaktion und per Effekt „summon with this/the same Hero“. Der BESITZER eines
// abgegebenen Helden (Charme, Golden Apple, Love Shot, Styx, Paraseed … = `charmedBy`/`permaControlBy`) beschwört mit ihm nichts, solange der Gegner ihn kontrolliert; nach der Rückgabe wieder.
// Der Kontrolleur beschwört über den übernommenen Helden (Zone in der Spalte des Besitzers, Kreatur gehört ihm). „Platzieren“ (Kartentext „place“) ist keine Beschwörung mit dem Helden und bleibt
// nach den bestehenden Rulings ausgenommen: Platzier-Karten prüfen die Kontrolle ohnehin über ihre Zielplätze (`getBouncePlacementTargets` nach Kontrolle).
// Gegenproben: Normalspiel unverändert, die übrigen Helden des Besitzers beschwören weiter, `controlledBy` (Controlled Attack) nimmt dem Besitzer die Beschwörung nicht (c-2).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const J = (x) => JSON.stringify(x);
const D = H.INERT.creature;
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
async function uebernehmen(t, v, ctrl, besitzer, hi) {
  if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(ctrl, besitzer, hi);
  else if (v === 'temporaer') t.engine.actionStealHero(ctrl, besitzer, hi);
  await sleep(150);   // Harness-Falle: onTakeControl läuft asynchron nach
}

(async () => {
  const R = H.runner();

  // ═══ Teil 1 · Beschwörung aus der Hand ═══
  for (const v of ['normal', 'dauerhaft', 'temporaer']) {
    R.section(`Teil 1 (${v}): Kreatur aus der Hand mit dem Helden 0:0${v === 'normal' ? ' (Normalspiel)' : ', den Sitz 1 kontrolliert'}`);
    const t = await H.fresh({ hand: [[D, D, D], [D, D]], deckSize: 30, active: 0 });
    await uebernehmen(t, v, 1, 0, 0);
    const abgegeben = v !== 'normal';
    const own = t.engine.getHeroPlayableCards(0).own;
    R.check(`${v}: Spielbarkeitsliste des Besitzers für 0:0 ${abgegeben ? 'ohne die Kreatur' : 'mit der Kreatur'}, für 0:1 mit`, J(own[0] || []) === J(abgegeben ? [] : [D]) && J(own[1]) === J([D]), own);
    const cd = H.DB[D];
    const vOwner = t.engine.validateActionPlay(0, D, 0, 0, ['Creature'], { zoneSlot: 0 });
    R.check(`${v}: validateActionPlay (Besitzer, Held 0:0) ${abgegeben ? 'lehnt ab' : 'erlaubt'}`, abgegeben ? vOwner === null : !!vOwner, !!vOwner);
    const r0 = await t.play(0, D, { hero: 0, slot: 0, noGrant: true });
    R.check(`${v}: Besitzer beschwört mit 0:0 → ${abgegeben ? 'abgelehnt (Karte bleibt auf der Hand, Zone leer)' : 'beschworen'}`, abgegeben ? (r0 === false && t.pile(0, 'hand').length === 3 && (t.gs.players[0].supportZones[0][0] || []).length === 0) : (r0 === true && (t.gs.players[0].supportZones[0][0] || []).includes(D)), [r0, t.pile(0, 'hand'), t.gs.players[0].supportZones[0]]);
    const r1 = await t.play(0, D, { hero: 1, slot: 0, noGrant: true });
    R.check(`${v}: derselbe Besitzer beschwört mit dem NICHT abgegebenen Helden 0:1 normal`, r1 === true && (t.gs.players[0].supportZones[1][0] || []).includes(D), [r1, t.gs.players[0].supportZones[1]]);
    if (abgegeben) {
      // Kontrolleur (Sitz 1) beschwört über den übernommenen Helden: Zone in der Spalte des Besitzers, Kreatur gehört dem Kontrolleur
      t.gs.activePlayer = 1; t.resetActions(1);
      const rk = await t.play(1, D, { hero: 0, slot: 1, charmedOwner: 0, noGrant: true });
      const inst = t.find(D, 'support') && t.inst(c => c.zone === 'support' && c.heroIdx === 0 && c.zoneSlot === 1)[0];
      R.check(`${v}: Kontrolleur beschwört über den übernommenen Helden 0:0 (Zone 1 in der Spalte von Sitz 0)`, rk === true && (t.gs.players[0].supportZones[0][1] || []).includes(D), [rk, t.gs.players[0].supportZones[0]]);
      R.check(`${v}: die Kreatur gehört und wird kontrolliert von Sitz 1`, !!inst && (inst.controller ?? inst.owner) === 1, inst && [inst.owner, inst.controller]);
    }
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Teil 1: Rückgabe der Kontrolle — der Besitzer beschwört wieder');
  {
    const t = await H.fresh({ hand: [[D, D], []], deckSize: 30, active: 0 });
    await uebernehmen(t, 'dauerhaft', 1, 0, 0);
    R.check('dauerhaft übernommen: Besitzer-Liste für 0:0 leer', (t.engine.getHeroPlayableCards(0).own[0] || []).length === 0, t.engine.getHeroPlayableCards(0).own[0]);
    await t.engine.actionReturnHeroControl(0, 0); await sleep(300);
    R.check('nach der Rückgabe: Besitzer-Liste für 0:0 enthält die Kreatur wieder', J(t.engine.getHeroPlayableCards(0).own[0]) === J([D]), t.engine.getHeroPlayableCards(0).own[0]);
    const r = await t.play(0, D, { hero: 0, slot: 0, noGrant: true });
    R.check('nach der Rückgabe beschwört der Besitzer mit 0:0', r === true && (t.gs.players[0].supportZones[0][0] || []).includes(D), [r, t.gs.players[0].supportZones[0]]);
  }
  R.section('Teil 1: Zugwechsel bei temporärer Übernahme — der Besitzer beschwört in seinem Zug wieder');
  {
    const t = await H.fresh({ hand: [[D, D], []], deckSize: 30, active: 1 });
    await uebernehmen(t, 'temporaer', 1, 0, 0);
    await t.endTurn(); await sleep(300);
    t.phase(3); t.resetActions(0);
    R.check('Zugwechsel: 0:0 gehört wieder Sitz 0, Liste enthält die Kreatur', t.engine.heroSideOf(0, t.gs.players[0].heroes[0]) === 0 && (t.engine.getHeroPlayableCards(0).own[0] || []).includes(D), t.engine.getHeroPlayableCards(0).own[0]);
    const r = await t.play(0, D, { hero: 0, slot: 0, noGrant: true });
    R.check('Besitzer beschwört mit 0:0', r === true, r);
  }

  // ═══ Teil 2 · Zusatzaktion ═══
  for (const v of ['normal', 'dauerhaft', 'temporaer']) {
    R.section(`Teil 2 (${v}): Karten, die eine Zusatzaktion mit dem Helden erlauben (getHeroEligibleActionCards)`);
    const t = await H.fresh({ hand: [[D, 'Fireball'], [D]], deckSize: 30, active: 0 });
    t.grantFor(0, 0, 'Fireball');
    await uebernehmen(t, v, 1, 0, 0);
    const abgegeben = v !== 'normal';
    const bes = t.engine.getHeroEligibleActionCards(0, 0);
    R.check(`${v}: Besitzer, Held 0:0 → ${abgegeben ? 'keine Zusatzaktion (weder Kreatur noch Zauber)' : 'Kreatur und Fireball'}`, J(bes.slice().sort()) === J(abgegeben ? [] : [D, 'Fireball'].sort()), bes);
    const bes1 = t.engine.getHeroEligibleActionCards(0, 1).filter(n => n === D);
    R.check(`${v}: Besitzer, Held 0:1 → die Kreatur wie bisher`, bes1.length === 1, bes1);
    if (abgegeben) {
      const ctl = t.engine.getHeroEligibleActionCards(1, 0, 0);
      R.check(`${v}: Kontrolleur (Sitz 1) über den übernommenen Helden → seine Kreatur steht zur Wahl`, ctl.includes(D), ctl);
    }
  }
  R.section('Teil 2: sofortige Beschwörung per Effekt („as an additional Action“): Zonenliste folgt der Kontrolle');
  {
    const se = require('../../../../cards/effects/_summon-eligibility');
    for (const v of ['normal', 'dauerhaft']) {
      const t = await H.fresh({ hand: [[D], [D]], deckSize: 30, active: 0 });
      await uebernehmen(t, v, 1, 0, 0);
      const zOwner = se.eligibleSummonZones(t.engine, 0, D, {}).filter(z => z.heroIdx === 0).length;
      const zCtl = se.eligibleSummonZones(t.engine, 1, D, { nachKontrolle: true }).filter(z => z.owner === 0 && z.heroIdx === 0).length;
      R.check(`${v}: freie Zonen des Helden 0:0 für den Besitzer: ${v === 'normal' ? 'alle drei' : 'keine'}`, zOwner === (v === 'normal' ? 3 : 0), zOwner);
      R.check(`${v}: freie Zonen des Helden 0:0 für den Sitz 1: ${v === 'normal' ? 'keine' : 'alle drei (Kontrolleur)'}`, zCtl === (v === 'normal' ? 0 : 3), zCtl);
    }
  }

  // ═══ Teil 3 · Effekte, die einen Beschwörer-Helden nennen („summon … with the same Hero“) ═══
  for (const v of ['normal', 'dauerhaft', 'temporaer']) {
    R.section(`Teil 3 (${v}): Grave Worm — „summon Grave Worm into the SAME Support Zone“ (der Held der Zone beschwört)`);
    const t = await H.fresh({ hand: [[], []], deckSize: 30, active: 0, discard: [['Grave Worm'], []] });
    t.engine._trackCard('Grave Worm', 0, 'discard');
    const d = t.put(0, 0, 0, D); d.turnPlayed = 1;
    await uebernehmen(t, v, 1, 0, 0);
    t.script.push({ match: dd => dd.type === 'confirm' && /Grave Worm/.test(dd.title || ''), answer: () => ({ confirmed: true }) });
    t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, d, 999, 'creature'));
    await sleep(100);
    const gefragt = t.prompts.some(p => p.pi === 0 && /Grave Worm/.test(p.d.title || ''));
    const worm = (t.gs.players[0].supportZones[0] || []).flat().includes('Grave Worm');
    R.check(`${v}: der Besitzer wird ${v === 'normal' ? 'gefragt und beschwört den Wurm' : 'NICHT gefragt (Held 0:0 gehört ihm nicht), der Wurm bleibt in der Ablage'}`, v === 'normal' ? (gefragt && worm) : (!gefragt && !worm && t.pile(0, 'discardPile').includes('Grave Worm')), { gefragt, worm, abl: t.pile(0, 'discardPile') });
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  for (const v of ['normal', 'dauerhaft', 'temporaer']) {
    R.section(`Teil 3 (${v}): Elven Rider aus der Hand — „summon … when an Elven Creature you control is defeated“ (der Held der Zone beschwört)`);
    const t = await H.fresh({ hand: [['Elven Rider'], []], deckSize: 30, active: 0 });
    t.grantFor(0, 0, 'Elven Rider');
    const d = t.put(0, 0, 0, 'Elven Druid'); d.turnPlayed = 1;
    await uebernehmen(t, v, 1, 0, 0);
    t.script.push({ match: dd => dd.type === 'confirm' && /Rider/.test(dd.title || ''), answer: () => ({ confirmed: true }) });
    t.script.push({ match: dd => dd.type === 'cardGallery', answer: (dd) => ({ cardName: (dd.cards[0].name || dd.cards[0]) }) });
    t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, d, 999, 'creature'));
    await sleep(100);
    const gefragt = t.prompts.some(p => p.pi === 0 && /Rider/.test(p.d.title || ''));
    const rider = (t.gs.players[0].supportZones[0] || []).flat().includes('Elven Rider');
    R.check(`${v}: der Besitzer wird ${v === 'normal' ? 'gefragt, der Rider steht in der Zone' : 'NICHT gefragt, der Rider bleibt auf der Hand'}`, v === 'normal' ? (gefragt && rider) : (!gefragt && !rider && t.pile(0, 'hand').includes('Elven Rider')), { gefragt, rider, hand: t.pile(0, 'hand') });
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.section('Teil 3: gemeinsamer Helfer `heroAgiert(hero, engine, pi)` — Kontrolle, nicht Besitz');
  {
    const se = require('../../../../cards/effects/_summon-eligibility');
    const t = await H.fresh({ hand: [[], []], deckSize: 30 });
    const eigen = t.gs.players[0].heroes[1], abg = t.gs.players[0].heroes[0];
    await uebernehmen(t, 'dauerhaft', 1, 0, 0);
    R.check('eigener, nicht abgegebener Held: Besitzer ja', se.heroAgiert(eigen, t.engine, 0) === true, null);
    R.check('abgegebener eigener Held: Besitzer nein, Kontrolleur ja', se.heroAgiert(abg, t.engine, 0) === false && se.heroAgiert(abg, t.engine, 1) === true, [se.heroAgiert(abg, t.engine, 0), se.heroAgiert(abg, t.engine, 1)]);
    R.check('ohne Kontext (alte Aufrufer) bleibt es bei der reinen Statusprüfung', se.heroAgiert(abg) === true, se.heroAgiert(abg));
    t.heroStatus(0, 0, 'frozen');
    R.check('Frozen sperrt auch den Kontrolleur', se.heroAgiert(abg, t.engine, 1) === false, se.heroAgiert(abg, t.engine, 1));
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
