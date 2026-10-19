'use strict';
// W16a · Punkt 6 · Al, 19.10.2026: „Soll für einen geliehenen/gecharmten Helden der Hand-Rabatt (Gift, Fiona) ebenfalls der konkreten Kopie folgen?" — „Lies die Hand des aktuellen Kontrolleurs."
// Erwartet: Spielt Sitz 0 einen Zauber über einen von ihm kontrollierten (gecharmten) Helden von Sitz 1, gelten Stufenprüfung, Rabatt und Wisdom-Kosten nach der HAND DES KONTROLLEURS
//   (Sitz 0) und nach der KONKRETEN KOPIE (wie W15b): nur die rabattierte Kopie ist spielbar; ein Rabatt in der Hand des Helden-BESITZERS (Sitz 1) zählt nicht.
//   Gilt für Spielweg (`validateActionPlay`/`doPlaySpell`), Spielbarkeitslisten (`getHeroPlayableCards.charmed`, inkl. `kopien.charmed`), Wisdom-Kosten und die Zusatzaktions-Auswahl. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const fbIdx = (ps) => ps.hand.map((n, i) => n === 'Fireball' ? i : -1).filter(i => i >= 0);
const rabatt = (ps, i, turn) => { ps._handLevelOffsetsTransient = { ...(ps._handLevelOffsetsTransient || {}), [i]: -3 }; ps._handLevelOffsetsExpireTurn = { ...(ps._handLevelOffsetsExpireTurn || {}), [i]: turn }; };
(async () => {
  const R = H.runner();

  async function aufbau(handKontrolleur, handBesitzer) {
    // Sitz 1, Held 0 (nur Magic Arts) ist von Sitz 0 gecharmt; Sitz 0 spielt über ihn
    const t = await H.fresh({ hand: [handKontrolleur, handBesitzer], abilities: { 1: { 0: [['Magic Arts'], [], []] } } });
    const h = t.hero(1, 0);
    h.charmedBy = 0;
    return t;
  }

  R.section('Rabatt auf der zweiten Kopie in der Hand des KONTROLLEURS (Sitz 0): nur sie ist über den geliehenen Helden spielbar');
  {
    const t = await aufbau(['Fireball', 'Fireball', 'Fireball'], []);
    const ps = t.gs.players[0];
    const idx = fbIdx(ps);
    rabatt(ps, idx[1], t.gs.turn);
    const v = (i) => !!t.engine.validateActionPlay(0, 'Fireball', i, 0, ['Spell'], { charmedOwner: 1 });
    R.check('validateActionPlay (geliehener Held): erste Kopie nein, rabattierte ja, dritte nein', !v(idx[0]) && v(idx[1]) && !v(idx[2]), idx.map(v));
    const L = t.engine.getHeroPlayableCards(0);
    R.check('Spielbarkeitsliste `charmed`: Fireball für den geliehenen Helden (Namensliste)', (L.charmed[0] || []).includes('Fireball'), L.charmed);
    R.check('`kopien.charmed`: nur die rabattierte Kopie', !!L.kopien && L.kopien.charmed[idx[0]].length === 0 && L.kopien.charmed[idx[1]].join() === '0' && L.kopien.charmed[idx[2]].length === 0, L.kopien);
    const rFalsch = await t.play(0, 'Fireball', { hero: 0, charmedOwner: 1, noGrant: true, keepActions: true, handIndex: idx[0] });
    R.check('Klick auf die ungesenkte Kopie: abgelehnt, nichts passiert', rFalsch === false && ps.hand.filter(n => n === 'Fireball').length === 3, rFalsch);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    const rRichtig = await t.play(0, 'Fireball', { hero: 0, charmedOwner: 1, noGrant: true, keepActions: true, handIndex: idx[1] });
    R.check('Klick auf die rabattierte Kopie: gespielt (150 Schaden an Sitz 1, Held 1), zwei Fireballs bleiben', rRichtig === true && t.hp(1, 1) === 650 && ps.hand.filter(n => n === 'Fireball').length === 2, { rRichtig, hp: t.hp(1, 1) });
    R.check('Rabatt mit der gespielten Kopie weg', Object.keys(ps._handLevelOffsetsTransient || {}).length === 0, ps._handLevelOffsetsTransient);
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Ein Rabatt in der Hand des Helden-BESITZERS (Sitz 1) zählt für die Karte des Kontrolleurs nicht');
  {
    const t = await aufbau(['Fireball'], ['Fireball']);
    const ps0 = t.gs.players[0], ps1 = t.gs.players[1];
    rabatt(ps1, 0, t.gs.turn);   // Rabatt in der Hand des Besitzers
    const v = !!t.engine.validateActionPlay(0, 'Fireball', 0, 0, ['Spell'], { charmedOwner: 1 });
    R.check('Kontrolleur-Kopie ohne eigenen Rabatt: über den geliehenen Helden NICHT spielbar', v === false, v);
    const L = t.engine.getHeroPlayableCards(0);
    R.check('Spielbarkeitsliste `charmed`: Fireball nicht aufgeführt', !(L.charmed[0] || []).includes('Fireball'), L.charmed);
    const r = await t.play(0, 'Fireball', { hero: 0, charmedOwner: 1, noGrant: true, keepActions: true, handIndex: 0 });
    R.check('Spielweg lehnt ab', r === false && ps0.hand.includes('Fireball') && t.hp(1, 1) === 800, r);
  }

  R.section('Rabatt in der Hand des Kontrolleurs, NICHTS beim Besitzer: spielbar (Stufe 0) — auch bei nur einer Kopie');
  {
    const t = await aufbau(['Fireball'], []);
    const ps0 = t.gs.players[0];
    rabatt(ps0, 0, t.gs.turn);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    const r = await t.play(0, 'Fireball', { hero: 0, charmedOwner: 1, noGrant: true, keepActions: true, handIndex: 0 });
    R.check('gespielt, 150 Schaden', r === true && t.hp(1, 1) === 650, { r, hp: t.hp(1, 1) });
  }

  R.section('Wisdom-Kosten über den geliehenen Helden folgen der Kopie des Kontrolleurs (Wisdom 1 reicht nur mit dem Rabatt auf Stufe 1)');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'ZZ Filler', 'ZZ Filler'], []], abilities: { 1: { 0: [['Wisdom'], [], []] } } });
    t.hero(1, 0).charmedBy = 0;
    const ps = t.gs.players[0];
    const idx = fbIdx(ps);
    ps._handLevelOffsetsTransient = { [idx[1]]: -1 }; ps._handLevelOffsetsExpireTurn = { [idx[1]]: t.gs.turn };
    const cd = t.engine._getCardDB()['Fireball'];
    const c = (i) => t.engine.getWisdomDiscardCost(1, 0, cd, i, 0);
    const cOhne = t.engine.getWisdomDiscardCost(1, 0, cd, idx[0]);   // alte Lesart: Hand des Besitzers (Sitz 1) → kein Rabatt, auch nicht für Kopie 1
    R.note('Wisdom-Kosten [ungesenkt, gesenkt, alte Lesart]', [c(idx[0]), c(idx[1]), cOhne]);
    R.check('Wisdom-Kosten der rabattierten Kopie (Hand des Kontrolleurs) sind niedriger als die der ungesenkten', c(idx[1]) < c(idx[0]) || (c(idx[0]) === -1 && c(idx[1]) >= 0), [c(idx[0]), c(idx[1]), cOhne]);
  }

  R.section('Wisdom-Abwurf im echten Spielweg (doPlaySpell) über den geliehenen Helden: die rabattierte Kopie kostet 1 Abwurf, die Hand des Kontrolleurs trägt ihn');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball', 'ZZ Filler', 'ZZ Filler'], []], abilities: { 1: { 0: [['Wisdom'], [], []] } } });
    t.hero(1, 0).charmedBy = 0;
    const ps = t.gs.players[0];
    const idx = fbIdx(ps);
    ps._handLevelOffsetsTransient = { [idx[1]]: -1 }; ps._handLevelOffsetsExpireTurn = { [idx[1]]: t.gs.turn };
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    t.script.push({ match: d => /forceDiscard|handPick|pickHandCard/.test(d.type || ''), answer: (d) => { const i = (ps.hand || []).findIndex(n => n === 'ZZ Filler'); return { cardName: 'ZZ Filler', handIndex: i, selectedCards: [{ cardName: 'ZZ Filler', handIndex: i }], selectedIndices: [i] }; } });
    const rFalsch = await t.play(0, 'Fireball', { hero: 0, charmedOwner: 1, noGrant: true, keepActions: true, handIndex: idx[0] });
    R.check('ungesenkte Kopie: abgelehnt (Wisdom 1 deckt Stufe 2 nicht)', rFalsch === false && ps.hand.length === 4, { rFalsch, hand: ps.hand });
    const r = await t.play(0, 'Fireball', { hero: 0, charmedOwner: 1, noGrant: true, keepActions: true, handIndex: idx[1] });
    R.check('rabattierte Kopie: gespielt, 150 Schaden, 1 Filler als Wisdom-Kosten abgeworfen', r === true && t.hp(1, 1) === 650 && ps.hand.filter(n => n === 'ZZ Filler').length === 1 && t.pile(0, 'discardPile').filter(n => n === 'ZZ Filler').length === 1, { r, hp: t.hp(1, 1), hand: ps.hand, abl: t.pile(0, 'discardPile') });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('Zusatzaktions-Auswahl (`_kopieStufeOk`) für den geliehenen Helden: die ungesenkte Kopie wird abgelehnt');
  {
    const t = await aufbau(['Fireball', 'Fireball'], []);
    const ps = t.gs.players[0];
    const idx = fbIdx(ps);
    rabatt(ps, idx[1], t.gs.turn);
    const cd = t.engine._getCardDB()['Fireball'];
    const ok = (i) => t.engine._kopieStufeOk(0, 0, cd, i, 1);
    R.check('_kopieStufeOk(pi=0, Held 0 von Sitz 1): ungesenkte Kopie abgelehnt, gesenkte ok', ok(idx[0]) === false && ok(idx[1]) === true, [ok(idx[0]), ok(idx[1])]);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
