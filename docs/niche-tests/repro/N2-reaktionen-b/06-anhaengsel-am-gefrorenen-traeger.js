'use strict';
// N2-06 · Spell-Anhängsel an gefrorenem/betäubtem/negiertem Träger: fünf Karten, zwei Verhaltensweisen
// Ruling Welle 7 (Al): „Freeze, Stun und Negated unterbrechen *alle* laufende passive Effekte!" (CARD_API.md ~Z. 20256; Prüfer `isHeroPassiveDormant`/`isCardPassiveDormant` für Kreaturen, Heldenkarten, Abilities).
//   Für Spell-ANHÄNGSEL am Helden gibt es keine Entscheidung; die Engine schaltet sie nicht still (Kommentar `_lightBallProtects`: „The protection persists even when the host is Frozen …").
// Beobachtet (Träger gefroren): STILL: Gathering Storm (`gathering-storm.js` Z. 216: `host.statuses.frozen|stunned|negated → return`) und Intrude (`intrude.js` Z. 129 derselbe Satz).
//   AKTIV: Energy Aura, Guardian Angel, Idej Projection (ebenso Invisibility, Forbidden Curse of Aging, Light Ball laut Skript — nicht einzeln gemessen) — keine Statusprüfung.
// ★ W25b (Al, Welle 25: „Nein, die sollen alle *nicht* still liegen! Das ist bei Storm und Intrude ein Bug!"): Spell-Anhängsel liegen an gefrorenem/betäubtem/negiertem Träger NICHT still —
//   ihre Effekte laufen weiter (die Ruhe-Regeln der Wellen 7/8 gelten für Passive von Heldenkarten/Kreaturen). Behoben: die Prüfung in Gathering Storm und Intrude entfiel. Exit 0 = alle aktiv.
//   Zusatz: Gegenprobe Frost UND Betäubung UND Negierung für Gathering Storm; Forbidden Curse of Aging sperrt die Heilung auch am gefrorenen Träger.
const H = require('../../lib/h.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  const ergebnis = {};
  const frieren = async (t, seat, hi) => { await t.engine.addHeroStatus(seat, hi, 'frozen', { duration: 3, appliedBy: 1 - seat }); await sleep(50); };

  R.section('Gathering Storm (Sitz 0) mit gefrorenem Träger → Zugbeginn des Gegners');
  {
    const t = await H.fresh({ hand: [['Gathering Storm'], []], deckSize: 30 });
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Gathering Storm') ? v.slice(0, 3).map(x => x.id) : [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, 'Gathering Storm', { hero: 0 });
    await frieren(t, 0, 0);
    await t.endTurn();
    ergebnis['Gathering Storm'] = [0, 1, 2].some(i => t.hp(1, i) < 800) ? 'aktiv' : 'still';
  }
  R.section('Intrude (Sitz 0) mit gefrorenem Träger → Gegner zieht per Effekt');
  {
    const t = await H.fresh({ hand: [['Intrude'], []], deckSize: 30 });
    await t.play(0, 'Intrude', { hero: 0 });
    await t.endTurn();
    t.gs.activePlayer = 1; t.phase(2);
    await frieren(t, 0, 0);
    t.reset();
    await t.run(() => t.engine.actionDrawCards(1, 2, { source: 'x' }));
    ergebnis['Intrude'] = t.prompts.some(p => p.d.title === 'Intrude') ? 'aktiv' : 'still';
  }
  R.section('Energy Aura (Sitz 1) mit gefrorenem Träger → Zauber des Gegners');
  {
    const t = await H.fresh({ hand: [['Burning Finger'], ['Energy Aura']], deckSize: 30 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(1, 'Energy Aura', { hero: 0 });
    await frieren(t, 1, 0);
    await t.play(0, 'Burning Finger', { hero: 0 });
    ergebnis['Energy Aura'] = t.hp(1, 0) === 800 ? 'aktiv' : 'still';
  }
  R.section('Guardian Angel (Sitz 0 am Gegner) mit gefrorenem Träger → tödlicher Zauber');
  {
    const t = await H.fresh({ hand: [['Guardian Angel', 'Burning Finger'], []], deckSize: 30 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Guardian Angel', { hero: 0 });
    await frieren(t, 1, 0);
    t.hero(1, 0).hp = 100;
    await t.play(0, 'Burning Finger', { hero: 0 });
    ergebnis['Guardian Angel'] = t.hp(1, 0) > 0 ? 'aktiv' : 'still';
  }
  R.section('Idej Projection (Sitz 1) mit gefrorenem Träger → Zauber des Gegners');
  {
    const t = await H.fresh({ heroes: [null, ['Idej Lord Daiyo', H.BLANK_HEROES_B[1], H.BLANK_HEROES_B[2]]], hand: [['Burning Finger'], []], deckSize: 30 });
    t.put(1, 0, 0, 'Idej Projection');
    t.script.push({ match: d => d.title === 'Idej Projection', answer: () => ({ confirmed: true }) });
    await frieren(t, 1, 0);
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Burning Finger', { hero: 0 });
    ergebnis['Idej Projection'] = t.hp(1, 0) === 800 ? 'aktiv' : 'still';
  }
  for (const status of ['stunned', 'negated']) {
    R.section(`Gathering Storm (Sitz 0) mit Träger ${status}`);
    const t = await H.fresh({ hand: [['Gathering Storm'], []], deckSize: 30 });
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Gathering Storm') ? v.slice(0, 3).map(x => x.id) : [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, 'Gathering Storm', { hero: 0 });
    await t.engine.addHeroStatus(0, 0, status, { duration: 3, appliedBy: 1 }); await sleep(50);
    await t.endTurn();
    ergebnis['Gathering Storm/' + status] = [0, 1, 2].some(i => t.hp(1, i) < 800) ? 'aktiv' : 'still';
  }
  R.section('Forbidden Curse of Aging (Sitz 0 am Gegner) mit gefrorenem Träger → Heilung wird gesperrt');
  {
    const t = await H.fresh({ hand: [['Forbidden Curse of Aging'], []], deckSize: 30 });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Forbidden Curse of Aging', { hero: 0 });
    await frieren(t, 1, 0);
    t.hero(1, 0).hp = 300;
    await t.run(() => t.engine.actionHealHero({ name: 'Heiler', owner: 1 }, t.hero(1, 0), 100));
    ergebnis['Forbidden Curse of Aging'] = t.hp(1, 0) === 300 ? 'aktiv' : 'still';
  }
  R.note('Ergebnis je Karte bei gefrorenem Träger', ergebnis);
  R.check('alle Spell-Anhängsel bleiben aktiv (keines liegt still)', Object.values(ergebnis).every(v => v === 'aktiv'), ergebnis);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
