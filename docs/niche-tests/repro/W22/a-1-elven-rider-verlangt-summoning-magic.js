'use strict';
// W22a · Frage aus W21a · Al, 20.10.2026: „Soll der Elven Rider (Summoning Magic 1; „You cannot summon this Creature, except with its own effect“) wie Doomed Town Guard und andere
// Reaktionskreaturen einen Helden mit Summoning Magic 1 verlangen? (heute prüft er nur Aktionsfähigkeit)“ — „Ja, soll er“
//
// Regel: Der Held der Zone (der Rider kommt in die Zone der gestorbenen Elven) beschwört den Rider. Er muss
//   (1) aktionsfähig sein und vom Spieler kontrolliert werden (W11/W21a, unverändert) UND
//   (2) die Schul-/Stufenanforderung der Karte erfüllen (Summoning Magic 1, `heroMeetsLevelReq`).
// Ohne tauglichen Helden: kein Angebot, der Rider bleibt auf der Hand, nichts wird verbraucht (Gold, Aktionen, Einmal-Marke `_elvenRiderTriggered`).
// Gegenproben: Summoning Magic 1 → ja; höhere Stufe → ja; ohne Summoning Magic → nein; ein ANDERER eigener Held mit Summoning Magic genügt nicht (der Held der Zone zählt);
//   Normalspiel unverändert (beide Sitze); seitenfremd (A09-15, Ruling 14.10. gilt, Al 20.10.): der Dieb setzt den Rider auch dann in die Zone der gestorbenen Kreatur, wenn der Besitzer den Helden der Zone behält (mit eigenem tauglichen Helden); kontrolliert er den Helden der Zone, beschwört dieser (Summoning Magic 1 nötig); der Besitzer der Zone nie; Folgetod mit nachgerüstetem Helden geht wieder.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const gefragt = (t, pi) => t.prompts.some(p => p.pi === pi && p.d && p.d.type === 'confirm' && /Rider/.test(p.d.title || ''));
const antwort = (t) => {
  t.script.push({ match: dd => dd.type === 'confirm' && /Rider/.test(dd.title || ''), answer: () => ({ confirmed: true }) });
  t.script.push({ match: dd => dd.type === 'cardGallery', answer: (dd) => ({ cardName: (dd.cards[0].name || dd.cards[0]) }) });
};
const SM = (n) => [Array(n).fill('Summoning Magic'), [], []];

(async () => {
  const R = H.runner();

  // ── Normalspiel, beide Sitze: Elven stirbt in der eigenen Zone ──
  for (const seat of [0, 1]) for (const [tag, zonen, erwartet] of [
    ['ohne Summoning Magic', [[], [], []], false],
    ['Summoning Magic 1', SM(1), true],
    ['Summoning Magic 2', SM(2), true],
    ['Summoning Magic 3', SM(3), true],
    ['nur Magic Arts 2', [['Magic Arts', 'Magic Arts'], [], []], false],
  ]) {
    R.section(`Sitz ${seat}: eigene Elven Archer stirbt, Held der Zone: ${tag}`);
    const hand = seat === 0 ? [['Elven Rider'], []] : [[], ['Elven Rider']];
    const dk = [H.INERT.creature, 'Elven Leader', ...Array(10).fill(H.INERT.creature)];
    const t = await H.fresh({ hand, deck: seat === 0 ? [dk, Array(10).fill(H.INERT.creature)] : [Array(10).fill(H.INERT.creature), dk], active: seat, gold: [20, 20] });
    t.setAbilities(seat, 0, zonen);
    const e = t.put(seat, 0, 1, 'Elven Archer'); e.turnPlayed = 1;
    antwort(t); t.reset();
    const gold0 = t.gs.players[seat].gold, akt0 = t.gs.players[seat]._actionsPlayedThisTurn || 0;
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 - seat, heroIdx: 0 }, e, 999, 'creature'));
    await sleep(120);
    const rider = (t.gs.players[seat].supportZones[0][1] || []).includes('Elven Rider');
    if (erwartet) {
      R.check('der Spieler wird gefragt, der Rider steht in der Zone des gestorbenen Elven', gefragt(t, seat) && rider, { gefragt: gefragt(t, seat), rider });
      R.check('der Rider-Suchlauf läuft (Elven Leader kam auf die Hand), kein Gold/Aktion verbraucht', t.pile(seat, 'hand').includes('Elven Leader') && t.gs.players[seat].gold === gold0 && (t.gs.players[seat]._actionsPlayedThisTurn || 0) === akt0, { hand: t.pile(seat, 'hand'), gold: t.gs.players[seat].gold });
    } else {
      R.check('KEIN Angebot, kein Rider auf dem Brett, Zone bleibt leer', !gefragt(t, seat) && !rider && (t.gs.players[seat].supportZones[0][1] || []).length === 0, { gefragt: gefragt(t, seat), z: t.gs.players[seat].supportZones[0] });
      R.check('der Rider bleibt auf der Hand; Gold, Aktionen und Einmal-Marke unberührt', t.pile(seat, 'hand').includes('Elven Rider') && t.gs.players[seat].gold === gold0 && (t.gs.players[seat]._actionsPlayedThisTurn || 0) === akt0 && Object.keys(t.gs._elvenRiderTriggered || {}).length === 0 && !(t.gs._elvenRiderResolving || {})[seat], { hand: t.pile(seat, 'hand'), marken: t.gs._elvenRiderTriggered });
    }
    R.check('der gestorbene Elven Archer liegt in der Ablage', t.pile(seat, 'discardPile').includes('Elven Archer'), t.pile(seat, 'discardPile'));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Ein anderer Held mit Summoning Magic genügt nicht ──
  R.section('Der Held der Zone hat keine Summoning Magic, ein anderer eigener Held schon → kein Angebot');
  {
    const t = await H.fresh({ hand: [['Elven Rider'], []], deckSize: 30, active: 0 });
    t.setAbilities(0, 1, SM(2)); t.setAbilities(0, 2, SM(3));
    const e = t.put(0, 0, 0, 'Elven Archer'); e.turnPlayed = 1;
    antwort(t); t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, e, 999, 'creature'));
    await sleep(120);
    R.check('kein Angebot, Rider bleibt auf der Hand', !gefragt(t, 0) && t.pile(0, 'hand').includes('Elven Rider') && (t.gs.players[0].supportZones[0][0] || []).length === 0, { g: gefragt(t, 0) });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    // Folgetod: der Held der Zone bekommt die Schule nachträglich → die Marke war nicht verbraucht, der Rider kommt jetzt
    t.setAbilities(0, 0, SM(1));
    const e2 = t.put(0, 0, 0, 'Elven Archer'); e2.turnPlayed = 1;
    t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, e2, 999, 'creature'));
    await sleep(120);
    R.check('nach Nachrüsten von Summoning Magic 1 beim Folgetod: Angebot und Rider steht in der Zone', gefragt(t, 0) && (t.gs.players[0].supportZones[0][0] || []).includes('Elven Rider'), { g: gefragt(t, 0), z: t.gs.players[0].supportZones[0] });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Mehrere Elven, mehrere Helden: jede Zone nach ihrem Helden ──
  R.section('Zwei Elven sterben nacheinander: Held 0 mit Summoning Magic, Held 1 ohne');
  {
    const t = await H.fresh({ hand: [['Elven Rider', 'Elven Rider'], []], deckSize: 30, active: 0 });
    t.setAbilities(0, 0, SM(1)); t.setAbilities(0, 1, [[], [], []]);
    const e1 = t.put(0, 1, 0, 'Elven Archer'); e1.turnPlayed = 1;
    antwort(t); t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, e1, 999, 'creature'));
    await sleep(120);
    R.check('Elven bei Held 1 (ohne Summoning Magic): kein Angebot', !gefragt(t, 0) && (t.gs.players[0].supportZones[1][0] || []).length === 0, { g: gefragt(t, 0) });
    const e0 = t.put(0, 0, 0, 'Elven Archer'); e0.turnPlayed = 1;
    t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, e0, 999, 'creature'));
    await sleep(120);
    R.check('Elven bei Held 0 (Summoning Magic 1): Angebot, Rider steht in Zone 0:0', gefragt(t, 0) && (t.gs.players[0].supportZones[0][0] || []).includes('Elven Rider'), { g: gefragt(t, 0), z: t.gs.players[0].supportZones[0] });
    R.check('der zweite Rider bleibt (nur einer gebraucht) bzw. liegt noch auf der Hand', t.pile(0, 'hand').filter(n => n === 'Elven Rider').length === 1, t.pile(0, 'hand'));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Seitenfremd (A09-15, Ruling 14.10. gilt, Al 20.10.): gestohlener Elven stirbt in der Zone von Sitz 1 ──
  // Held der Zone: 'behält' = bleibt beim Besitzer (Sitz 1), sonst vom Dieb (Sitz 0) übernommen. smZone/smDieb = Summoning Magic beim Helden der Zone bzw. beim eigenen Helden des Diebs.
  // Beschwörer: ist der Held der Zone beim Dieb, beschwört dieser Held; sonst ein tauglicher EIGENER Held des Diebs (kontrolliert, aktionsfähig, Summoning Magic 1).
  for (const [v, smZone, smDieb, erwartet] of [
    ['dauerhaft', true, true, true], ['temporaer', true, true, true], ['dauerhaft', false, true, false], ['temporaer', false, true, false],
    ['behält', false, true, true], ['behält', true, false, false], ['behält', true, true, true], ['behält', false, false, false],
  ]) {
    R.section(`Gestohlener Elven Druid stirbt in der Zone von Sitz 1; Held der Zone: ${v === 'behält' ? 'beim Besitzer' : v + ' vom Dieb übernommen'}; Summoning Magic: Held der Zone ${smZone ? 'ja' : 'nein'}, eigener Held des Diebs ${smDieb ? 'ja' : 'nein'}`);
    const t = await H.fresh({ hand: [['Elven Rider'], ['Elven Rider']], deckSize: 30, active: 0 });
    if (smDieb) t.grantFor(0, 0, 'Elven Rider');
    if (smZone) t.grantFor(1, 0, 'Elven Rider');
    const d = t.put(1, 0, 0, 'Elven Druid'); d.turnPlayed = 1;
    await t.run(() => t.engine.actionStealCreature(0, d)); await sleep(250);
    if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(0, 1, 0); else if (v === 'temporaer') t.engine.actionStealHero(0, 1, 0);
    await sleep(150);
    antwort(t); t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, d, 999, 'creature'));
    await sleep(120);
    const rider = (t.gs.players[1].supportZones[0] || []).flat().includes('Elven Rider');
    if (erwartet) R.check('der Dieb wird gefragt, der Rider steht seitenfremd in der Zone der gestorbenen Kreatur, kontrolliert von Sitz 0', gefragt(t, 0) && rider && t.inst(c => c.name === 'Elven Rider' && c.zone === 'support')[0]?.controller === 0 && !t.pile(0, 'hand').includes('Elven Rider'), { g: gefragt(t, 0), rider, hand: t.pile(0, 'hand') });
    else R.check('kein Angebot (kein tauglicher Beschwörer-Held), kein Rider auf dem Brett, der Rider bleibt auf der Hand des Diebs', !gefragt(t, 0) && !rider && t.pile(0, 'hand').includes('Elven Rider'), { g: gefragt(t, 0), rider });
    R.check('der Besitzer der Zone (Sitz 1, Rider auf der Hand) wird nie gefragt und behält seinen Rider', !gefragt(t, 1) && t.pile(1, 'hand').includes('Elven Rider'), t.pile(1, 'hand'));
    R.check('der gestorbene Druid liegt in der Ablage seines Besitzers (Sitz 1)', t.pile(1, 'discardPile').includes('Elven Druid'), t.pile(1, 'discardPile'));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Abgegebener EIGENER Held: der Besitzer beschwört mit ihm nichts (W20c/W21a bleibt) ──
  for (const v of ['temporaer', 'dauerhaft']) {
    R.section(`Eigener Elven stirbt in der Zone des an Sitz 1 abgegebenen Helden 0 (${v}) → Sitz 0 bekommt keinen Rider, auch wenn ein anderer eigener Held Summoning Magic hat`);
    const t = await H.fresh({ hand: [['Elven Rider'], []], deckSize: 30, active: 0 });
    t.setAbilities(0, 0, SM(2)); t.setAbilities(0, 1, SM(2));
    const e = t.put(0, 0, 1, 'Elven Archer'); e.turnPlayed = 1;
    if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(1, 0, 0); else t.engine.actionStealHero(1, 0, 0);
    await sleep(250);
    antwort(t); t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, e, 999, 'creature'));
    await sleep(120);
    R.check('kein Angebot, Rider bleibt auf der Hand', !gefragt(t, 0) && t.pile(0, 'hand').includes('Elven Rider'), { g: gefragt(t, 0) });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Harte Negation (Abilities weg): Stufe 1 nicht, gesunder Held mit Summoning Magic ja (W12 bleibt) ──
  R.section('Abilities negiert (hart) trotz Summoning Magic 2 → kein Angebot; Effekt-negiert (leicht) → Angebot');
  for (const [form, erwartet] of [['hart', false], ['leicht', true]]) {
    const t = await H.fresh({ hand: [['Elven Rider'], []], deckSize: 30, active: 0 });
    t.setAbilities(0, 0, SM(2));
    if (form === 'hart') t.heroStatus(0, 0, 'negated'); else t.heroStatus(0, 0, 'negated', { appliedTurn: 0, effectOnly: true });
    const e = t.put(0, 0, 1, 'Elven Archer'); e.turnPlayed = 1;
    antwort(t); t.reset();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, e, 999, 'creature'));
    await sleep(120);
    R.check(`${form}: ${erwartet ? 'Angebot, Rider steht' : 'kein Angebot, Rider bleibt auf der Hand'}`, erwartet ? (gefragt(t, 0) && (t.gs.players[0].supportZones[0][1] || []).includes('Elven Rider')) : (!gefragt(t, 0) && t.pile(0, 'hand').includes('Elven Rider')), { g: gefragt(t, 0) });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
