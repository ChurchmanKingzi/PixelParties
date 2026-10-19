'use strict';
// W15a · R3 (Rückfrage 3 aus W14a), Teil A: Ability-Anlegen PER EFFEKT · Al, 16.10.2026: „Sollen auch die Divinity-Anleger (Sacrifice to Divinity, Quetzahuitl, Very Special Prisoner), Alex, Chuck und Muscle
//   Training an Resistance abprallen?" — „Ja."
// Erwartet (Regel W14a Q5: Standard-Spielaktion ≠ Effekt): Legt einer dieser Effekte eine Ability an einen Helden mit Resistance Lv3 an, prallt das Anlegen ab — VOR jeder Kartenbewegung:
//   die Ability bleibt in Hand/Deck/Ablage (kein Mischen), Kosten (Opfer, Abwurf, Karte selbst) bleiben bezahlt. Kontrolle ohne Resistance: wie bisher angelegt.
//   Gleiches Muster, nicht von Al genannt: Training (Deck-Option). Exit 0 = korrekt.
//   ★ W16a (Al, 19.10.2026, Frage 4: „Nein, von keinem"): UMGESTELLT — der Aufstiegsbonus (`performAscensionBonus`, Chuck, the Storyteller und alle anderen Ascended Heroes) wird von Resistance
//   NICHT abgefangen; die Abschnitte „Chuck" und „Aufstiegsbonus" erwarten jetzt den Bonus auch bei Resistance Lv3 (Absicherung: `W16/a-4-…`).
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const RES = (lv) => Array(lv).fill('Resistance');
const zonen = (t, hi) => (t.gs.players[0].abilityZones[hi] || []).flat();
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
(async () => {
  const R = H.runner();

  R.section('Sacrifice to Divinity → Held 1 trägt Resistance Lv3');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Sacrifice to Divinity', 'Divinity'], []] });
    const opfer = t.put(0, 0, 0, H.INERT.creature); opfer.turnPlayed = 1;
    if (lv) t.setAbilities(0, 1, [RES(lv), [], []]);
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 1, zoneSlot: -1 }) });
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    const hat = zonen(t, 1).includes('Divinity');
    R.check(`${label}: gespielt, Opfer bezahlt (Kreatur in der Ablage)`, r === true && t.pile(0, 'discardPile').includes(H.INERT.creature), { r, abl: t.pile(0, 'discardPile') });
    if (lv) R.check(`${label}: Divinity prallt ab — bleibt auf der Hand, nicht angelegt`, !hat && t.pile(0, 'hand').includes('Divinity'), { hat, hand: t.pile(0, 'hand') });
    else R.check(`${label}: Divinity liegt an Held 1`, hat && !t.pile(0, 'hand').includes('Divinity'), { hat, hand: t.pile(0, 'hand') });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  {   // Quelle Deck: kein Mischen, keine Aufdeck-Meldung, Divinity bleibt im Deck
    const t = await H.fresh({ hand: [['Sacrifice to Divinity'], []], deck: [['Divinity', 'ZZ Dummy', 'ZZ Dummy'], []] });
    t.put(0, 0, 0, H.INERT.creature).turnPlayed = 1;
    t.setAbilities(0, 1, [RES(3), [], []]);
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 1, zoneSlot: -1 }) });
    const deck0 = t.pile(0, 'mainDeck').join('|');
    await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    R.check('Deck-Quelle: Divinity bleibt im Deck (Reihenfolge unverändert, kein Aufdecken)', t.pile(0, 'mainDeck').join('|') === deck0 && !t.prompts.some(p => p.d.type === 'deckSearchReveal'), { deck: t.pile(0, 'mainDeck') });
  }

  R.section('Very Special Prisoner → Held 1 trägt Resistance Lv3');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Very Special Prisoner', 'Divinity'], []], hp: 800 });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    if (lv) t.setAbilities(0, 1, [RES(lv), [], []]);
    const ziel = t.put(1, 0, 0, H.INERT.creature);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 1, zoneSlot: -1 }) });
    await t.run(() => t.engine.actionStealCreature(0, ziel));
    await wait(300);
    const hat = zonen(t, 1).includes('Divinity');
    R.check(`${label}: Very Special Prisoner wurde gespielt`, !t.pile(0, 'hand').includes('Very Special Prisoner') && t.pile(0, 'discardPile').includes('Very Special Prisoner'), { hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') });
    if (lv) R.check(`${label}: Divinity prallt ab — bleibt auf der Hand`, !hat && t.pile(0, 'hand').includes('Divinity'), { hat, hand: t.pile(0, 'hand') });
    else R.check(`${label}: Divinity liegt an Held 1`, hat, { hat });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Quetzahuitl: das Anlegen der bis zu drei Divinity ist EIN Effekt — er fragt den Prüfer (frischer Held, daher gestellter Prüfer)');
  {
    const Q = 'Quetzahuitl, Receiver of Sacrifices';
    for (const [label, blockt] of [['Prüfer blockt', true], ['Prüfer blockt nicht (Kontrolle)', false]]) {
      const t = await H.fresh({ hp: 300, hand: [[Q, 'Heal'], []], deck: [['Divinity', 'Divinity', 'Divinity', 'Heal', 'Heal', 'Heal'], null], active: 1 });
      t.hero(0, 0).hp = 0; t.hero(0, 1).hp = 0;
      const aufrufe = [];
      const orig = t.engine.heroNonDamageEffectBlocked.bind(t.engine);
      t.engine.heroNonDamageEffectBlocked = async (o, h, typ, opts) => { aufrufe.push([o, h, typ]); return blockt && typ === 'ability_attach' ? true : orig(o, h, typ, opts); };
      await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 2), 9999, 'spell'));
      R.check(`${label}: Abstieg fand statt (Quetzahuitl auf Platz 2)`, t.hero(0, 2).name === Q, t.hero(0, 2).name);
      R.check(`${label}: genau EIN Aufruf des Prüfers (ability_attach, Platz 2)`, aufrufe.filter(a => a[2] === 'ability_attach').length === 1 && aufrufe.some(a => a[0] === 0 && a[1] === 2 && a[2] === 'ability_attach'), aufrufe);
      const an = zonen(t, 2).filter(x => x === 'Divinity').length;
      R.check(`${label}: ${blockt ? 'keine Divinity angelegt, drei bleiben im Deck' : 'drei Divinity angelegt'}`, blockt ? (an === 0 && t.pile(0, 'mainDeck').filter(x => x === 'Divinity').length === 3) : an === 3, { an, deck: t.pile(0, 'mainDeck') });
      R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }

  R.section('Alex, Trainer of Heroes: sein Tutor legt an Held 1 an (Resistance Lv3) — prallt ab; Ability bleibt im Deck');
  {
    const ALEX = 'Alex, Trainer of Heroes';
    const DECK = ['Fighting', 'Fighting', 'Wealth', 'Toughness', 'Leadership'].concat(Array(15).fill(H.INERT.creature));
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ heroes: [[ALEX, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deck: [DECK, []], hand: [['Luck'], []] });
      t.setAbilities(0, 0, [[], [], []]);
      if (lv) t.setAbilities(0, 1, [RES(lv), [], []]);
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === ALEX, answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
      t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 1, zoneSlot: -1 }) });
      const deck0 = t.pile(0, 'mainDeck').join('|');
      const r = await t.play(0, 'Luck', { hero: 0, zoneSlot: 0 });
      const hat = zonen(t, 1).includes('Wealth');
      R.check(`${label}: Luck an Alex gespielt, die Alex-Galerie erschien`, r === true && t.prompts.some(p => p.d.type === 'cardGallery' && p.d.title === ALEX), r);
      if (lv) R.check(`${label}: Wealth prallt ab — bleibt im Deck (Reihenfolge unverändert, kein Aufdecken)`, !hat && t.pile(0, 'mainDeck').join('|') === deck0 && !t.prompts.some(p => p.d.type === 'deckSearchReveal'), { hat, deck: t.pile(0, 'mainDeck').length });
      else R.check(`${label}: Wealth liegt an Held 1, Deck 19`, hat && t.pile(0, 'mainDeck').length === 19, { hat, deck: t.pile(0, 'mainDeck').length });
      R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  R.section('Muscle Training (Attack): Fighting an den Nutzer mit Resistance Lv3 — prallt ab');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ hand: [['Muscle Training'], []], deck: [['Fighting', 'ZZ Dummy', 'ZZ Dummy'], []] });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    const deck0 = t.pile(0, 'mainDeck').join('|');
    const r = await t.play(0, 'Muscle Training', { hero: 0, noGrant: true });
    const hat = zonen(t, 0).includes('Fighting');
    R.check(`${label}: Muscle Training gespielt (Karte in der Ablage)`, r === true && t.pile(0, 'discardPile').includes('Muscle Training'), { r, abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    if (lv) R.check(`${label}: Fighting prallt ab — bleibt im Deck (Reihenfolge unverändert)`, !hat && t.pile(0, 'mainDeck').join('|') === deck0, { hat, deck: t.pile(0, 'mainDeck') });
    else R.check(`${label}: Fighting liegt am Nutzer`, hat && !t.pile(0, 'mainDeck').includes('Fighting'), { hat, deck: t.pile(0, 'mainDeck') });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Chuck, the Storyteller: Aufstiegsbonus „bis zu drei Abilities von außerhalb" — W16a: Resistance Lv3 fängt ihn NICHT ab');
  {
    const CH = 'Chuck, the Storyteller';
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ hand: [[], []] });
      t.setHero(0, 0, CH, 300);
      t.setAbilities(0, 0, [lv ? RES(lv) : [], [], []]);
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === CH, answer: () => ({ cardName: 'Fighting', source: 'outside' }), once: true });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === CH, answer: () => null });
      const script = require('../../../../cards/effects/_loader').loadCardEffect(CH);
      await t.run(() => script.onAscensionBonus(t.engine, 0, 0, 0));
      const gal = t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === CH).length;
      const hat = zonen(t, 0).includes('Fighting');
      R.check(`${label}: Bonus läuft trotz Resistance (W16a) — Galerie, Fighting angelegt`, gal >= 1 && hat, { gal, zonen: zonen(t, 0) });
      R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  R.section('Gleiches Muster: Training Lv3, Deck-Option (Ability suchen und an diesen Helden anlegen) — Resistance Lv3 am selben Helden');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ deck: [['Fighting', 'ZZ Dummy', 'ZZ Dummy'], []], hand: [[], []] });
    t.setAbilities(0, 0, [['Training', 'Training', 'Training'], lv ? RES(lv) : [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Training', answer: () => ({ cardName: 'Fighting', source: 'deck' }) });
    const deck0 = t.pile(0, 'mainDeck').join('|');
    t.gs.activePlayer = 0; t.gs.currentPhase = 2;   // Main Phase 1 (Training ist in der Aktionsphase nicht freigegeben)
    await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    await wait(200);
    const hat = zonen(t, 0).includes('Fighting');
    R.check(`${label}: Training-Galerie erschien`, t.prompts.some(p => p.d.type === 'cardGallery' && p.d.title === 'Training'), t.prompts.map(p => p.d.title));
    if (lv) R.check(`${label}: Fighting prallt ab — bleibt im Deck, kein Mischen`, !hat && t.pile(0, 'mainDeck').join('|') === deck0, { hat, deck: t.pile(0, 'mainDeck') });
    else R.check(`${label}: Fighting liegt am Helden`, hat && !t.pile(0, 'mainDeck').includes('Fighting'), { hat, deck: t.pile(0, 'mainDeck') });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Aufstiegsbonus (`performAscensionBonus`, z. B. Arthor/Riffel/Kohta/Taio …) auf einen Helden mit Resistance Lv3 — W16a: nicht abgefangen');
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ deck: [['Fighting', 'Fighting', 'Fighting', 'ZZ Dummy'], []], hand: [[], []] });
    t.setAbilities(0, 0, [lv ? RES(lv) : [], [], []]);
    const deck0 = t.pile(0, 'mainDeck').join('|');
    await t.run(() => t.engine.performAscensionBonus(0, 0, ['Fighting'], 0));
    const n = zonen(t, 0).filter(x => x === 'Fighting').length;
    R.check(`${label}: drei Fighting angelegt (W16a: Resistance fängt den Aufstiegsbonus nicht ab)`, n === 3, { n });
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Gegenprobe: die Standard-Spielaktion („Ability per turn") bleibt auch gegen Resistance Lv3 ungeblockt');
  {
    const t = await H.fresh({ hand: [['Fighting'], []] });
    t.setAbilities(0, 0, [RES(3), [], []]);
    const r = await t.play(0, 'Fighting', { hero: 0 });
    R.check('Fighting aus der Hand wird normal angelegt', r === true && zonen(t, 0).includes('Fighting'), { r, zonen: zonen(t, 0) });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
