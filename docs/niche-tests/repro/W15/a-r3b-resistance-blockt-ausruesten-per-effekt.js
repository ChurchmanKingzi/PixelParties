'use strict';
// W15a · R3 (Rückfrage 3 aus W14a), Teil B: Ausrüsten PER EFFEKT — gleiches Muster wie Ability-Anlegen (Regel W14a Q5: Standard-Spielaktion ≠ Effekt; „prüfe auch andere Karten mit demselben Muster").
// W14a hatte nur `equipArtifactToHero` verdrahtet. Erwartet: Jeder weitere Effekt, der eine Ausrüstung/einen Helden per Effekt an einen Helden mit Resistance Lv3 legt, prallt ab — VOR jeder
//   Kartenbewegung (die Karte bleibt in Deck/Ablage/Hand, kein Mischen); die gespielte Karte ist verbraucht. Kontrolle ohne Resistance: wie bisher. Gegenprobe: normales Ausspielen der
//   Ausrüstung von der Hand bleibt ungeblockt. Exit 0 = korrekt.
// Abgedeckt: der gemeinsame Helfer `ruesteAusStapelAus` (Weapon Collecting Wight, Riffel, Looting), Cool Repair, Treasure Hunter's Backpack, Gate to the Armory (Direkt-Ausrüsten),
//   Initiation Ritual, ???, the Shapeshifter.
const H = require('../../lib/h.js');
const { ruesteAusStapelAus } = require('../../../../cards/effects/_equip-shared');
const RES = (lv) => Array(lv).fill('Resistance');
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const stuetz = (t, hi) => (t.gs.players[0].supportZones[hi] || []).flat();
const heroT = (owner, hi) => (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi); return h ? [h.id] : [valid[0].id]; };
(async () => {
  const R = H.runner();

  R.section('gemeinsamer Helfer `ruesteAusStapelAus` (Weapon Collecting Wight, Riffel, Looting): Club of Gobbo aus der Ablage an Held 0');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ discard: [['Club of Gobbo'], []], hand: [[], []] });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    const inst = await t.run(() => ruesteAusStapelAus(t.engine, 0, 'discard', 'Club of Gobbo', 0, 0, { source: 'Test' }));
    if (lv) R.check(`${label}: nicht ausgerüstet (null), Club bleibt in der Ablage`, !inst && t.pile(0, 'discardPile').includes('Club of Gobbo') && !stuetz(t, 0).includes('Club of Gobbo'), { inst: !!inst, abl: t.pile(0, 'discardPile'), zone: stuetz(t, 0) });
    else R.check(`${label}: ausgerüstet`, !!inst && stuetz(t, 0).includes('Club of Gobbo') && !t.pile(0, 'discardPile').includes('Club of Gobbo'), { inst: !!inst });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Cool Repair: Club of Gobbo aus der Ablage an Held 0');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Cool Repair'], []], discard: [['Club of Gobbo'], []], gold: [100, 100] });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Club of Gobbo' }) });
    t.targetFn = heroT(0, 0);
    const gold0 = t.gs.players[0].gold;
    const r = await t.play(0, 'Cool Repair', { hero: 0 });
    R.check(`${label}: Cool Repair gespielt`, r === true && !t.pile(0, 'hand').includes('Cool Repair'), { r, hand: t.pile(0, 'hand') });
    if (lv) R.check(`${label}: Club prallt ab — bleibt in der Ablage, Kosten bezahlt`, !stuetz(t, 0).includes('Club of Gobbo') && t.pile(0, 'discardPile').includes('Club of Gobbo') && t.gs.players[0].gold < gold0, { zone: stuetz(t, 0), abl: t.pile(0, 'discardPile'), gold: t.gs.players[0].gold });
    else R.check(`${label}: Club liegt am Helden`, stuetz(t, 0).includes('Club of Gobbo'), { zone: stuetz(t, 0) });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section("Treasure Hunter's Backpack: Club of Gobbo aus dem Deck an Held 0");
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const B = "Treasure Hunter's Backpack";
    const t = await H.fresh({ hand: [[B], []], deck: [['Club of Gobbo', 'ZZ Dummy', 'ZZ Dummy'], []], gold: [100, 100] });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === B, answer: () => ({ cardName: 'Club of Gobbo', source: 'deck' }), once: false });
    t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}), once: false });
    t.targetFn = (valid) => { if (!valid.length) return []; const z = valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0); return [(z || valid[0]).id]; };
    const deck0 = t.pile(0, 'mainDeck').join('|');
    const r = await t.play(0, B);
    if (lv) R.check(`${label}: Club prallt ab — bleibt im Deck (Reihenfolge unverändert, kein Aufdecken); Backpack verbraucht`, r === true && !stuetz(t, 0).includes('Club of Gobbo') && t.pile(0, 'mainDeck').join('|') === deck0 && !t.prompts.some(p => p.d.type === 'deckSearchReveal') && !t.pile(0, 'hand').includes(B), { r, zone: stuetz(t, 0), deck: t.pile(0, 'mainDeck'), hand: t.pile(0, 'hand') });
    else R.check(`${label}: Club liegt am Helden`, stuetz(t, 0).includes('Club of Gobbo'), { zone: stuetz(t, 0) });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Gate to the Armory: Direkt-Ausrüsten (Club of Gobbo) am Nutzer');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Gate to the Armory'], []], deck: [['Club of Gobbo', 'ZZ Dummy', 'ZZ Dummy'], []] });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Gate to the Armory', answer: (d) => ({ cardName: 'Club of Gobbo', source: 'deck' }) });
    t.policy.confirm = true;
    const r = await t.play(0, 'Gate to the Armory', { hero: 0 });
    R.check(`${label}: Gate gespielt, Direkt-Ausrüsten wurde angeboten`, r === true && t.prompts.some(p => p.d.type === 'confirm' && /Equip Club of Gobbo directly/.test(p.d.message || '')), { r, prompts: t.prompts.map(p => p.d.message || p.d.title) });
    if (lv) R.check(`${label}: Club prallt am Nutzer ab — der Tutor-Teil bleibt: Club liegt auf der Hand`, !stuetz(t, 0).includes('Club of Gobbo') && t.pile(0, 'hand').includes('Club of Gobbo'), { zone: stuetz(t, 0), hand: t.pile(0, 'hand') });
    else R.check(`${label}: Club liegt am Nutzer`, stuetz(t, 0).includes('Club of Gobbo'), { zone: stuetz(t, 0) });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Initiation Ritual: gefallener Held 1 wird an Held 0 (Resistance Lv3) angelegt');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Initiation Ritual'], []], gold: [100, 100], abilities: { 0: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    await t.run(() => t.engine.actionDealDamage({ name: 'x', owner: 1 }, t.hero(0, 1), 9999, 'true'));
    t.gs.turn = 7; t.hero(0, 1).diedOnTurn = 5;
    const r = await t.play(0, 'Initiation Ritual', { noAutoConfirm: true });
    let pt = t.gs.potionTargeting;
    const v = (pt && pt.validTargets || []).filter(x => !x.ineligible).find(x => x.type === 'hero' && x.heroIdx === 1);
    if (v) await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: [v.id] }));
    pt = t.gs.potionTargeting;
    if (pt) {   // zweite Wahl: der lebende Zielheld (Held 0) bzw. seine Zone
      const w = (pt.validTargets || []).filter(x => !x.ineligible).find(x => x.heroIdx === 0 && (x.type === 'hero' || x.type === 'equip'));
      if (w) await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: [w.id] }));
    }
    const angelegt = stuetz(t, 0).includes('Rick, the Trigger Happy Undertaker');
    R.check(`${label}: Initiation Ritual gespielt (Karte weg, Aufbau trägt)`, r === true && !!v && !t.pile(0, 'hand').includes('Initiation Ritual'), { r, v: !!v });
    if (lv) R.check(`${label}: der Gefallene wird nicht angelegt, seine Ability Zones bleiben unberührt`, !angelegt && t.gs.players[0].abilityZones[1].flat().includes('Fighting') && !t.pile(0, 'deletedPile').includes('Fighting'), { zonen: t.gs.players[0].abilityZones[1], del: t.pile(0, 'deletedPile') });
    else R.check(`${label}: der Gefallene liegt als Ausrüstung am lebenden Helden`, angelegt, { zone: t.gs.players[0].supportZones });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('???, the Shapeshifter: legt einen Helden an SICH an (Resistance Lv3 am Shapeshifter)');
  {
    const SHAPE = '???, the Shapeshifter';
    const BEATO = 'Beato, the Butterfly Witch';
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
      if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
      t.addHand(0, BEATO);
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: BEATO, source: 'hand' }), once: true });
      t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
      await t.activateHero(0, 0, {});
      if (lv) R.check(`${label}: keine Verwandlung — Beato bleibt auf der Hand`, t.hero(0, 0).name === SHAPE && t.pile(0, 'hand').includes(BEATO), { name: t.hero(0, 0).name, hand: t.pile(0, 'hand') });
      else R.check(`${label}: als Beato verwandelt`, t.hero(0, 0).name === BEATO, t.hero(0, 0).name);
      R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  R.section('Gegenprobe: normales Ausspielen einer Ausrüstung (Standard-Spielaktion) bleibt gegen Resistance Lv3 ungeblockt');
  {
    const t = await H.fresh({ hand: [['Club of Gobbo'], []] });
    t.setAbilities(0, 0, [RES(3), [], []]);
    const r = await t.play(0, 'Club of Gobbo', { hero: 0, zoneSlot: 0 });
    R.check('Club of Gobbo aus der Hand wird normal ausgerüstet', r === true && stuetz(t, 0).includes('Club of Gobbo'), { r, zone: stuetz(t, 0) });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
