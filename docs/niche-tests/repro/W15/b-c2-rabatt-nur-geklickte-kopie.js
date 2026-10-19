'use strict';
// W15b · C2 (Q165 Nachfrage, Divine Gift of Magic + Fiona, the Empty Vessel) · Al, 16.10.2026: „Der Rabatt soll exakt die geklickte/ausgewählte Karte treffen."
// Auslegung: Der Rabatt (−3) gehört genau der beim Gift offenbarten bzw. von Fiona geholten Kopie und gilt nur, wenn GENAU DIESE Karte ausgespielt/ausgewählt wird. Eine andere Kopie gleichen Namens
//   bekommt keinen Rabatt (ggf. nicht spielbar); der Rabatt wird NICHT mehr auf die gespielte Kopie umgehängt (`kopienRabattAufGespielteKopie` entfällt).
// Aufbau: Held 0 mit Magic Arts, aber ohne Destruction Magic; Fireball (Lv2, Destruction) ×2–3 auf der Hand. Prüft Spielweg (`doPlaySpell`), Stufenprüfung je Handindex, Zusatzaktion (`heroAction`-Auswahl),
//   die CPU-Wahl der Zusatzaktion, Wisdom-Kosten je Kopie und dass der Rabatt an der Kopie hängen bleibt.
const H = require('../../lib/h.js');
const FV = 'Fiona, the Empty Vessel of a Forgotten Sorceress';
(async () => {
  const R = H.runner();
  const fb = (ps) => ps.hand.map((n, i) => n === 'Fireball' ? i : -1).filter(i => i >= 0);

  R.section('Divine Gift of Magic: nur die offenbarte Kopie (zweite von drei)');
  {
    const t = await H.fresh({ hand: [['Divine Gift of Magic', 'Fireball', 'Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    const ps = t.gs.players[0];
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = ps.hand.map((n, k) => n === 'Fireball' ? k : -1).filter(k => k >= 0)[1]; return { cardName: 'Fireball', handIndex: i }; } });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Divine Gift of Magic', { hero: 0, noGrant: true });
    const idx = fb(ps);
    const cd = t.engine._getCardDB()['Fireball'];
    const lvl = (i) => t.engine.effectiveCardLevel(cd, 0, { heroIdx: 0, handIdx: i });
    R.check('Rabatt hängt an der zweiten Kopie (Stufe 0), die anderen bleiben Stufe 2', lvl(idx[0]) === 2 && lvl(idx[1]) === 0 && lvl(idx[2]) === 2, idx.map(lvl));
    R.check('Stufenprüfung je Karte: nur die offenbarte Kopie besteht (validateActionPlay mit Handindex)',
      !t.engine.validateActionPlay(0, 'Fireball', idx[0], 0, ['Spell']) && !!t.engine.validateActionPlay(0, 'Fireball', idx[1], 0, ['Spell']) && !t.engine.validateActionPlay(0, 'Fireball', idx[2], 0, ['Spell']), idx);
    const rErste = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, handIndex: idx[0] });
    R.check('Klick auf die erste Kopie: abgelehnt, nichts gespielt, Rabatt unverändert', rErste === false && ps.hand.filter(n => n === 'Fireball').length === 3 && t.hp(1, 0) === 800 && ps._handLevelOffsetsTransient?.[idx[1]] === -3, { rErste, hp: t.hp(1, 0), off: ps._handLevelOffsetsTransient });
    const rDritte = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, handIndex: idx[2] });
    R.check('Klick auf die dritte Kopie: abgelehnt', rDritte === false && ps.hand.filter(n => n === 'Fireball').length === 3, rDritte);
    const rRichtig = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, handIndex: idx[1] });
    R.check('Klick auf die offenbarte Kopie: gespielt (150 Schaden), zwei Fireballs bleiben', rRichtig === true && t.hp(1, 0) === 650 && ps.hand.filter(n => n === 'Fireball').length === 2, { rRichtig, hp: t.hp(1, 0) });
    R.check('Rabatt mit der Kopie aufgeräumt, die übrigen Kopien weiter ohne Rabatt', Object.keys(ps._handLevelOffsetsTransient || {}).length === 0 && fb(ps).every(i => lvl(i) === 2), ps._handLevelOffsetsTransient);
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Zusatzaktion (heroAction-Auswahl nur mit Namen): die andere Kopie wird abgelehnt');
  {
    const t = await H.fresh({ hand: [['Divine Gift of Magic', 'Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    const ps = t.gs.players[0];
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: 'Fireball', handIndex: fb(ps)[1] }), once: true });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Divine Gift of Magic', { hero: 0, noGrant: true });
    const idx = fb(ps);
    // Auswahl: erst die UNGESENKTE Kopie (abgelehnt → erneute Auswahl), dann die gesenkte
    const antworten = [{ cardName: 'Fireball', handIndex: idx[0] }, { cardName: 'Fireball', handIndex: idx[1] }];
    t.script.push({ match: d => d.type === 'heroAction', answer: () => antworten.shift() || { cancelled: true } });
    const hp0 = t.hp(1, 0);
    const res = await t.run(() => t.engine.performImmediateAction(0, 0, { title: 'W15b-Test' }));
    R.check('die ungesenkte Kopie wurde abgelehnt (zweite Auswahlrunde), die gesenkte gewirkt (150 Schaden)', antworten.length === 0 && t.hp(1, 0) === hp0 - 150 && ps.hand.filter(n => n === 'Fireball').length === 1, { rest: antworten.length, hp: t.hp(1, 0), res });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('CPU-Wahl der Zusatzaktion nimmt die gesenkte Kopie, nicht die erste mit dem Namen');
  {
    const t = await H.fresh({ hand: [['Divine Gift of Magic', 'Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
    const ps = t.gs.players[0];
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: 'Fireball', handIndex: fb(ps)[1] }), once: true });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Divine Gift of Magic', { hero: 0, noGrant: true });
    const idx = fb(ps);
    const wahl = t.engine._cpuWaehleSofortaktion({ eligibleCards: ['Fireball'], heroIdx: 0 }, 0);
    R.check('CPU wählt den gesenkten Handindex', wahl.cardName === 'Fireball' && wahl.handIndex === idx[1], { wahl, idx });
  }

  R.section('Fiona (gleiche Maschine): nur die geholte Kopie');
  {
    const t = await H.fresh({ heroes: [[FV, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []], deck: [['Fireball', 'ZZ Dummy', 'ZZ Dummy'], []] });
    const ps = t.gs.players[0];
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === FV, answer: () => ({ cardName: 'Fireball' }), once: true });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.activateHero(0, 0, { effect: FV });
    const idx = fb(ps);
    R.check('Fiona hat eine zweite Kopie geholt, Rabatt auf ihr', idx.length === 2 && ps._handLevelOffsetsTransient?.[idx[1]] === -3, { hand: ps.hand, off: ps._handLevelOffsetsTransient });
    const rAlt = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, handIndex: idx[0] });
    R.check('die ungeholte Kopie ist nicht spielbar, der Rabatt bleibt an der geholten', rAlt === false && ps._handLevelOffsetsTransient?.[idx[1]] === -3 && t.hp(1, 0) === 800, { rAlt, off: ps._handLevelOffsetsTransient });
    const rNeu = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, handIndex: idx[1] });
    R.check('die geholte Kopie ist spielbar (genau einmal)', rNeu === true && t.hp(1, 0) === 650 && ps.hand.filter(n => n === 'Fireball').length === 1, { rNeu, hp: t.hp(1, 0) });
    R.check('danach ist der Rabatt weg: die verbliebene Kopie ist nicht spielbar', (await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: false })) === false && Object.keys(ps._handLevelOffsetsTransient || {}).length === 0, ps._handLevelOffsetsTransient);
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Wisdom-Kosten je Kopie');
  {
    // Held mit Wisdom 1 und ohne Destruction: Fireball Lv2 braucht Wisdom-Deckung; die gesenkte Kopie (Stufe 0) kostet nichts, die andere schon.
    const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'ZZ Dummy'], []], abilities: { 0: { 0: [['Wisdom'], [], []] } } });
    const ps = t.gs.players[0];
    const cd = t.engine._getCardDB()['Fireball'];
    ps._handLevelOffsetsTransient = { 1: -3 }; ps._handLevelOffsetsExpireTurn = { 1: t.gs.turn };
    const c0 = t.engine.getWisdomDiscardCost(0, 0, cd, 0), c1 = t.engine.getWisdomDiscardCost(0, 0, cd, 1), cn = t.engine.getWisdomDiscardCost(0, 0, cd);
    R.check('Kosten: ungesenkte Kopie > 0 (oder nicht spielbar), gesenkte Kopie 0, namensweit = günstigste', c0 !== 0 && c1 === 0 && cn === 0, { c0, c1, cn });
  }
  R.finish();
})();
