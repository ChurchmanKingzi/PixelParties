'use strict';
// W21a · Frage 4 aus W20c · Al, 20.10.2026: „Soll die seitenfremde Beschwörung in die Zone einer gestohlenen Kreatur (Ruling A09-15 vom 14.10.: Elven Rider, Bomblebee Cluster u. a.) dem aktuellen
// Kontrolleur vorbehalten sein? (heute erlaubt)“ — „nur der aktuelle Kontrolleur“
//
// Regel: Die Beschwörung (und bei Cycling Demons das Platzieren) des Nachfolgers in die Zone einer gestohlenen Kreatur braucht den HELDEN dieser Zone unter der Kontrolle des Beschwörers
// (`heroSideOf` = Beschwörer; Zustand des Helden egal bei „place“, bei „summon“ muss er agieren können). Weder der Besitzer der Zone/des abgegebenen Helden noch der Dieb, solange der Besitzer den
// Helden der Zone behält. Das ersetzt die W20c-Ausnahme in `heroAgiert`/`heroAbgegeben` („greift nur für abgegebene Helden der eigenen Spalte, damit A09-15 erhalten bleibt“).
// ★★ W22a (Al, 20.10.2026: „Das Ruling vom 14. [gilt]“) — TEILWEISE ZURÜCKGENOMMEN: Lesart B. „Nur der aktuelle Kontrolleur“ heißt der Kontrolleur der GESTORBENEN KREATUR (der Dieb): er setzt/beschwört den
//   Nachfolger seitenfremd in die Zone der gestorbenen Kreatur, AUCH wenn der Besitzer den Helden der Zone behält (Elven Rider, Bomblebee Cluster, Cycling Demons …; Ruling A09-15 vom 14.10.). Der Besitzer der Zone, der
//   die Kreatur nicht kontrollierte, bekommt keinen Nachfolger. Beschwören mit einem abgegebenen/übernommenen Helden bleibt dem Kontrolleur dieses Helden vorbehalten (W20c/W21a). Die Prüfungen unten sind entsprechend
//   umgestellt (Helfer `heroAgiert`: Held der Gegenspalte ohne Kontrolle zulässig; Rider/Bomblebee „beim Besitzer“: Nachfolger wie bisher seitenfremd).
// Gegenproben: Dieb kontrolliert den Helden der Zone (dauerhaft oder temporär) → seitenfremde Beschwörung wie bisher; Normalspiel unverändert; abgegebener eigener Held weiter gesperrt (W20c).
// (Elven Rider/Cycling Demons stehen zusätzlich in W5-a/05, dort umgestellt.)
const H = require('../../lib/h.js');
const se = require('../../../../cards/effects/_summon-eligibility');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
async function uebernehmen(t, v, ctrl, besitzer, hi) {
  if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(ctrl, besitzer, hi);
  else if (v === 'temporaer') t.engine.actionStealHero(ctrl, besitzer, hi);
  await sleep(150);
}

(async () => {
  const R = H.runner();

  R.section('Helfer heroAgiert(hero, engine, pi): Kontrolle entscheidet, in jeder Spalte');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 30 });
    const eigen = t.gs.players[0].heroes[1], abg = t.gs.players[0].heroes[0], fremd = t.gs.players[1].heroes[2], fremd2 = t.gs.players[1].heroes[1];
    await uebernehmen(t, 'dauerhaft', 1, 0, 0);      // Sitz 1 kontrolliert 0:0
    await uebernehmen(t, 'temporaer', 0, 1, 1);      // Sitz 0 kontrolliert 1:1 (temporär)
    R.check('eigener Held, nicht abgegeben: Sitz 0 ja', se.heroAgiert(eigen, t.engine, 0) === true, null);
    R.check('abgegebener eigener Held (0:0): Besitzer nein, Kontrolleur ja', se.heroAgiert(abg, t.engine, 0) === false && se.heroAgiert(abg, t.engine, 1) === true, [se.heroAgiert(abg, t.engine, 0), se.heroAgiert(abg, t.engine, 1)]);
    R.check('Held der Gegenspalte, den Sitz 0 NICHT kontrolliert (1:2): Sitz 0 ja (W22a: Ruling 14.10. gilt wieder, seitenfremde Beschwörung), Sitz 1 ja', se.heroAgiert(fremd, t.engine, 0) === true && se.heroAgiert(fremd, t.engine, 1) === true, [se.heroAgiert(fremd, t.engine, 0), se.heroAgiert(fremd, t.engine, 1)]);
    R.check('übernommener Held der Gegenspalte (1:1): Sitz 0 ja, Sitz 1 (Besitzer) nein', se.heroAgiert(fremd2, t.engine, 0) === true && se.heroAgiert(fremd2, t.engine, 1) === false, [se.heroAgiert(fremd2, t.engine, 0), se.heroAgiert(fremd2, t.engine, 1)]);
    R.check('ohne Kontext (alte Aufrufer) bleibt es bei der reinen Statusprüfung', se.heroAgiert(fremd) === true, se.heroAgiert(fremd));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  for (const v of ['keine', 'dauerhaft', 'temporaer']) {
    R.section(`Elven Rider: gestohlener Elven Druid stirbt in der Zone von Sitz 1 — Held der Zone: ${v === 'keine' ? 'beim Besitzer (Sitz 1)' : v + ' vom Dieb (Sitz 0) kontrolliert'}`);
    const t = await H.fresh({ hand: [['Elven Rider'], []], deckSize: 30, active: 0 });
    t.grantFor(0, 0, 'Elven Rider');
    t.grantFor(1, 0, 'Elven Rider');   // W22a (Al, 20.10.2026): der Held der Zone beschwoert den Rider und braucht Summoning Magic 1
    const d = t.put(1, 0, 0, 'Elven Druid'); d.turnPlayed = 1;
    await t.run(() => t.engine.actionStealCreature(0, d)); await sleep(250);
    if (v !== 'keine') await uebernehmen(t, v, 0, 1, 0);
    t.script.push({ match: dd => dd.type === 'confirm' && /Rider/.test(dd.title || ''), answer: () => ({ confirmed: true }) });
    t.script.push({ match: dd => dd.type === 'cardGallery', answer: (dd) => ({ cardName: (dd.cards[0].name || dd.cards[0]) }) });
    t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, d, 999, 'creature'));
    await sleep(120);
    const gefragt = t.prompts.some(p => p.pi === 0 && /Rider/.test(p.d.title || ''));
    const rider = (t.gs.players[1].supportZones[0] || []).flat().includes('Elven Rider');
    if (v === 'keine') {
      R.check('W22a (Ruling 14.10.): der Dieb wird gefragt, der Rider steht seitenfremd in der Zone, kontrolliert von Sitz 0', gefragt && rider && t.inst(c => c.name === 'Elven Rider')[0]?.controller === 0 && !t.pile(0, 'hand').includes('Elven Rider'), { gefragt, rider, hand: t.pile(0, 'hand') });
      R.check('der Besitzer der Zone (Sitz 1) wird nicht gefragt', !t.prompts.some(p => p.pi === 1 && /Rider/.test(p.d.title || '')), null);
    } else {
      R.check('der Dieb (Kontrolleur des Helden) wird gefragt, der Rider steht in der Zone, kontrolliert von Sitz 0', gefragt && rider && t.inst(c => c.name === 'Elven Rider')[0]?.controller === 0, { gefragt, rider });
    }
    R.check('der gestorbene Druid liegt in der Ablage seines Besitzers (Sitz 1)', t.pile(1, 'discardPile').includes('Elven Druid'), t.pile(1, 'discardPile'));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  for (const v of ['keine', 'dauerhaft', 'temporaer']) {
    R.section(`Bomblebee Cluster: Bomblebee wird seitenfremd in die Zone von Sitz 1 beschworen — Held der Zone: ${v === 'keine' ? 'beim Besitzer' : v + ' vom Beschwörer kontrolliert'}`);
    const t = await H.fresh({ hand: [['Bomblebee Cluster', 'Dive Bomblebee', 'Carpet Bomblebee'], []], deckSize: 30, active: 0 });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);
    t.setAbilities(1, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);   // der Held der Zone (Sitz 1, Held 0) hat die Stufe für die Bomblebees
    if (v !== 'keine') await uebernehmen(t, v, 0, 1, 0);
    t.script.push({ match: d => d.type === 'confirm' && /Bomblebee Cluster/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'cardGallery' && /Bomblebee Cluster/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name }) });
    t.reset();
    await t.run(() => t.engine.summonCreatureWithHooks('Bomblebee', 1, 0, 0, { controller: 0, source: 'Test' }));
    await sleep(150);
    const nachgeschoben = (t.gs.players[1].supportZones[0] || []).flat().filter(n => n === 'Dive Bomblebee' || n === 'Carpet Bomblebee').length;
    if (v === 'keine') {
      R.check('W22a (Ruling 14.10.): auch wenn der Held der Zone dem Gegner gehört, beschwört der Cluster (Beschwörer = Sitz 0) die Bomblebees seitenfremd nach', nachgeschoben >= 1, { nachgeschoben, hand: t.pile(0, 'hand') });
    } else {
      R.check('der Beschwörer kontrolliert den Helden: Cluster beschwört nach wie bisher', nachgeschoben >= 1, { nachgeschoben, zone: t.gs.players[1].supportZones[0] });
    }
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Normalspiel: Elven Rider, eigene gestorbene Elven Druid-Zone (Held beim Besitzer) — unverändert');
  {
    const t = await H.fresh({ hand: [['Elven Rider'], []], deckSize: 30, active: 0 });
    t.grantFor(0, 0, 'Elven Rider');
    const d = t.put(0, 0, 0, 'Elven Druid'); d.turnPlayed = 1;
    t.script.push({ match: dd => dd.type === 'confirm' && /Rider/.test(dd.title || ''), answer: () => ({ confirmed: true }) });
    t.script.push({ match: dd => dd.type === 'cardGallery', answer: (dd) => ({ cardName: (dd.cards[0].name || dd.cards[0]) }) });
    t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, d, 999, 'creature'));
    await sleep(120);
    R.check('Rider steht in der eigenen Zone', (t.gs.players[0].supportZones[0] || []).flat().includes('Elven Rider'), t.gs.players[0].supportZones[0]);
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
