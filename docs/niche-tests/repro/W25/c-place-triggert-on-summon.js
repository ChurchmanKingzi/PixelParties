'use strict';
// W25c · N3-13 (Al, Welle 25): „Platzieren triggert On-Summon-Effekte" („When you summon this Creature, …") – wie Beschwören.
// Allgemeine Regel (CARD_API.md, Abschnitt „Platzieren triggert On-Summon"): Wer eine Kreatur PLATZIERT (Drill Sergeant, Army of the Cute, Glorious Rebirth, Deepsea-Tausch, Teocuilatl,
//   Create Illusion, Staff of Illusions, Layn, Xuanwu …), löst ihren Einsatz-Effekt aus. Umsetzen/Übernehmen einer SCHON liegenden Kreatur (Guard Change, Slippery, Dark Gear, Capture …) ist
//   kein Platzieren (`_isMove`) und löst nichts aus. Kein Doppelfeuern (je Platzierung genau einmal), Sandy Blob (R4) reagiert nur auf einen wirklich feuernden Effekt.
// Aufbau je Fall: eine Kreatur mit Einsatz-Effekt (Scavenging Crane: ziehen 1; Barkeeper: Hand auf 7 füllen; Gravedigger: Gegner mahlt 3; Wire Hatchling: halbe HP; Frolake: ziehen 2)
//   wird auf dem jeweiligen Weg platziert. Exit 0 = der Effekt feuert genau einmal.
const H = require('../../lib/h.js');
const CR = 'Scavenging Crane';
(async () => {
  const R = H.runner();
  const zp = { match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) };
  const filler = () => Array(20).fill(H.INERT.creature);

  R.section('Drill Sergeant');
  async function sergeant(karte) {
    const t = await H.fresh({ hand: [[karte], []], deck: [filler(), filler()] });
    t.put(0, 0, 0, 'Drill Sergeant').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Drill Sergeant', answer: () => ({ cardName: karte }) });
    t.script.push(zp);
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const v = { deck0: t.pile(0, 'mainDeck').length, deck1: t.pile(1, 'mainDeck').length };
    await t.activateCreature(0, 0, 0);
    return { t, liegt: !!t.find(karte, 'support'), gezogen: v.deck0 - t.pile(0, 'mainDeck').length, gemahlen: v.deck1 - t.pile(1, 'mainDeck').length, hand: t.pile(0, 'hand').length, errors: t.errors };
  }
  { const r = await sergeant(CR);          R.check('Scavenging Crane (platziert) zieht genau 1 Karte (Ordnen + Ziehen)', r.liegt && r.gezogen === 1 && r.t.prompts.some(p => p.d.type === 'cardReorder'), { liegt: r.liegt, gezogen: r.gezogen }); R.check('keine Engine-Fehler (Crane)', r.errors.length === 0 && r.t.audit().length === 0, r.errors); }
  { const r = await sergeant('Barkeeper');  R.check('Barkeeper (platziert) füllt die Hand auf 7', r.liegt && r.hand === 7, { liegt: r.liegt, hand: r.hand }); }
  { const r = await sergeant('Gravedigger'); R.check('Gravedigger (platziert): der Gegner mahlt 3 Karten (genau einmal)', r.liegt && r.gemahlen === 3, { liegt: r.liegt, gemahlen: r.gemahlen }); }
  { const r = await sergeant('Frolake');     R.check('Frolake (platziert) zieht genau 2 Karten – kein Doppelfeuern (war schon vorher so)', r.liegt && r.gezogen === 2, { liegt: r.liegt, gezogen: r.gezogen }); }
  { const r = await sergeant('Knight of Kings [W]');
    const key = `ofkings-summoned:${require('../../../../cards/effects/_of-kings-shared.js').KNIGHT}:0`;
    R.check('Knight of Kings [W] (platziert) stempelt „Knight diesen Zug beschworen"', r.liegt && r.t.gs.hoptUsed?.[key] === r.t.gs.turn, { liegt: r.liegt, stempel: r.t.gs.hoptUsed?.[key], turn: r.t.gs.turn }); }

  R.section('Wire Hatchling (Stufe 2, direkt platziert)');
  {
    const t = await H.fresh({ hand: [['Wire Hatchling'], []] });
    const g = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 1); return x ? [x.id] : undefined; };
    t.reset();
    const r = await t.run(() => t.engine.actionPlaceCreature('Wire Hatchling', 0, 0, 1, { source: 'hand', sourceName: 'Test' }));
    R.check('Wire Hatchling (platziert) halbiert die HP des gewählten Ziels (200 → 100)', !!(r && r.inst) && g.counters.currentHp === 100, g.counters.currentHp);
    R.check('keine Engine-Fehler (Hatchling)', t.errors.length === 0 && t.audit().length === 0, t.errors);
  }

  R.section('Eigene Platzier-Wege: Staff of Illusions, Create Illusion, Xuanwu, Layn');
  {
    const t = await H.fresh({ hand: [[], []], gold: [100, 100] });
    t.setHand(0, ['Staff of Illusions', CR]);
    t.script.push({ match: d => d.title === 'Staff of Illusions' && d.type === 'cardGallery', answer: () => ({ cardName: CR }) });
    t.script.push(zp); t.reset();
    const d0 = t.pile(0, 'mainDeck').length;
    const r = await t.play(0, 'Staff of Illusions', { hero: 0 });
    R.check('Staff of Illusions: die platzierte Crane löst ihren Effekt aus (zieht 1)', r === true && !!t.find(CR, 'support') && d0 - t.pile(0, 'mainDeck').length === 1, { r, gezogen: d0 - t.pile(0, 'mainDeck').length });
    R.check('keine Engine-Fehler (Staff)', t.errors.length === 0 && t.audit().length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [['Create Illusion'], []], deck: [[CR, ...filler().slice(1)], []] });
    t.setAbilities(0, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
    t.script.push({ match: d => d.title === 'Create Illusion' && d.type === 'cardGallery', answer: () => ({ cardName: CR }) });
    t.script.push(zp); t.reset();
    const d0 = t.pile(0, 'mainDeck').length;
    const r = await t.play(0, 'Create Illusion', { hero: 0, noGrant: true });
    R.check('Create Illusion: die platzierte Crane löst ihren Effekt aus (1 Karte Tutor + 1 Karte Ziehen)', r === true && !!t.find(CR, 'support') && d0 - t.pile(0, 'mainDeck').length === 2, { r, delta: d0 - t.pile(0, 'mainDeck').length });
    R.check('keine Engine-Fehler (Create Illusion)', t.errors.length === 0 && t.audit().length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [[], []], discard: [[CR], []] });
    t.put(0, 0, 0, 'Cardinal Beast Xuanwu').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: CR }) });
    t.script.push(zp);
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const d0 = t.pile(0, 'mainDeck').length;
    await t.activateCreature(0, 0, 0);
    R.check('Xuanwu: die aus der Ablage platzierte Crane löst ihren Effekt aus (zieht 1) – HP bleiben 1/1', !!t.find(CR, 'support') && d0 - t.pile(0, 'mainDeck').length === 1 && t.find(CR, 'support').counters.currentHp === 1, { gezogen: d0 - t.pile(0, 'mainDeck').length });
    R.check('keine Engine-Fehler (Xuanwu)', t.errors.length === 0 && t.audit().length === 0, t.errors);
  }
  {
    const heroes = [["Layn, Master of Deri's Relic", H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
    const t = await H.fresh({ hand: [[], []], discard: [['Frolake'], []], heroes });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Frolake' }) });
    t.script.push(zp);
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const h0 = t.pile(0, 'hand').length;
    await t.activateHero(0, 0, {});
    R.check('Layn: die aus der Ablage platzierte Frolake zieht 2 Karten', !!t.find('Frolake', 'support') && t.pile(0, 'hand').length - h0 === 2, { delta: t.pile(0, 'hand').length - h0 });
    R.check('keine Engine-Fehler (Layn)', t.errors.length === 0 && t.audit().length === 0, t.errors);
  }

  R.section('Gegenprobe: Umsetzen ist kein Platzieren');
  {
    const t = await H.fresh({ hand: [[], []] });
    const c = t.put(0, 0, 0, CR); c.turnPlayed = 1;
    t.reset();
    const d0 = t.pile(0, 'mainDeck').length;
    const r = await t.run(() => t.engine.actionTransferCreature(c, 0, 1, 1, { source: 'Test' }));
    R.check('Crane wird auf einen anderen Helden umgesetzt: kein Einsatz-Effekt (kein Ziehen)', c.heroIdx === 1 && t.pile(0, 'mainDeck').length === d0, { heroIdx: c.heroIdx, delta: d0 - t.pile(0, 'mainDeck').length });
  }

  R.section('Sandy Blob (R4): nur ein wirklich feuernder Effekt');
  {
    const t = await H.fresh({ hand: [[CR], []] });
    t.put(0, 2, 0, 'Sandy Blob').turnPlayed = 1;
    const g = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 1); return x ? [x.id] : undefined; };
    t.reset();
    await t.run(() => t.engine.actionPlaceCreature(CR, 0, 0, 1, { source: 'hand', sourceName: 'Test' }));
    R.check('Sandy Blob: die platzierte Crane (Effekt feuert wirklich) löst den Blob aus (50 Schaden, genau einmal)', g.counters.currentHp === 150, g.counters.currentHp);
  }
  {
    const t = await H.fresh({ hand: [['Barkeeper', ...Array(7).fill(H.INERT.filler)], []] });   // Hand schon voll genug (7 nach dem Platzieren): Barkeeper wirkt nicht
    t.put(0, 2, 0, 'Sandy Blob').turnPlayed = 1;
    const g = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (v) => { const x = v.find(y => y.type === 'equip' && y.owner === 1); return x ? [x.id] : undefined; };
    t.reset();
    await t.run(() => t.engine.actionPlaceCreature('Barkeeper', 0, 0, 1, { source: 'hand', sourceName: 'Test' }));
    R.check('Sandy Blob: Barkeeper (platziert) wirkt nicht (Hand schon 7) → Blob bleibt stumm', (g.counters.currentHp ?? 200) === 200, g.counters.currentHp);
  }

  R.finish();
})();
