'use strict';
// W16a · Punkt 3 · Al, 19.10.2026: „Soll ein von Resistance abgefangenes Alex-/Training-/Backpack-Anlegen den Einmal-Einsatz verbrauchen?" — „Ja!"
// Erwartet (gleiche Regel für ALLE Effekte mit Einmal-Einsatz, die an Resistance abprallen): der Einsatz zählt als gewirkt — der Stempel ist gesetzt (Alex: Zähler „2× pro Zug"; Training/Riffel/Wight/
//   Lolek/Shapeshifter/Waflav: ein zweiter Einsatz im selben Zug ist nicht mehr möglich; Waflav zahlt den Evolution Counter; Backpack ist als Karte verbraucht). Die Karte bleibt, wo sie war
//   (Deck/Ablage/Hand — kein Mischen). Kontrolle ohne Resistance: Anlegen klappt und der Einsatz ist ebenfalls verbraucht. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const { usesLeft } = require('../../../../cards/effects/_charges');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const RES = (lv) => Array(lv).fill('Resistance');
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const stuetz = (t, seat, hi) => (t.gs.players[seat].supportZones[hi] || []).flat();
const zonen = (t, hi) => (t.gs.players[0].abilityZones[hi] || []).flat();
const anz = (t, titel) => t.prompts.filter(p => p.d.title === titel || (p.d.title || '').startsWith(titel)).length;
(async () => {
  const R = H.runner();

  // ───────────────────────── Riffel ─────────────────────────
  R.section('Future Tech Gunslinger Riffel (1× pro Zug): Club of Gobbo aus dem Deck an sich selbst');
  const RIF = 'Future Tech Gunslinger Riffel';
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ heroes: [[RIF, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [['Club of Gobbo', 'Club of Gobbo'], []], deck: [['Club of Gobbo', 'Club of Gobbo', 'ZZ Dummy'], []], hand: [[], []] });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === RIF, answer: () => ({ cardName: 'Club of Gobbo', source: 'discard' }) });
    const deck0 = t.pile(0, 'mainDeck').join('|');
    await t.activateHero(0, 0, {});
    await wait(100);
    const erst = anz(t, RIF);
    await t.activateHero(0, 0, {});
    await wait(100);
    R.check(`${label}: Galerie erschien beim ersten Einsatz`, erst >= 1, erst);
    R.check(`${label}: ein ZWEITER Einsatz im selben Zug ist nicht mehr möglich (Einmal-Einsatz verbraucht)`, anz(t, RIF) === erst, { erst, jetzt: anz(t, RIF) });
    if (lv) R.check(`${label}: Club prallt ab — bleibt im Deck (Reihenfolge unverändert, kein Mischen), nichts ausgerüstet`, stuetz(t, 0, 0).length === 0 && t.pile(0, 'mainDeck').join('|') === deck0, { zone: stuetz(t, 0, 0), deck: t.pile(0, 'mainDeck') });
    else R.check(`${label}: Club liegt am Helden`, stuetz(t, 0, 0).includes('Club of Gobbo'), stuetz(t, 0, 0));
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ───────────────────────── Weapon Collecting Wight ─────────────────────────
  R.section('Weapon Collecting Wight (1× pro Zug): Club of Gobbo aus der Ablage an Held 0');
  const WIGHT = 'Weapon Collecting Wight';
  for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
    const t = await H.fresh({ discard: [['Club of Gobbo', 'Club of Gobbo'], []], hand: [[], []] });
    if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
    t.put(0, 1, 0, WIGHT).turnPlayed = 1;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === WIGHT, answer: () => ({ cardName: 'Club of Gobbo' }) });
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return [(h || valid[0]).id]; };
    t.script.push({ match: d => d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0, owner: 0 }) });
    t.phase(2);   // aktionsfreier Kreatureffekt: Main Phase
    await t.activateCreature(0, 1, 0);
    await wait(100);
    const erst = anz(t, WIGHT);
    await t.activateCreature(0, 1, 0);
    await wait(100);
    R.check(`${label}: Galerie erschien beim ersten Einsatz`, erst >= 1, erst);
    R.check(`${label}: ein ZWEITER Einsatz im selben Zug ist nicht mehr möglich (Einmal-Einsatz verbraucht)`, anz(t, WIGHT) === erst, { erst, jetzt: anz(t, WIGHT) });
    if (lv) R.check(`${label}: Club prallt ab — beide Clubs bleiben in der Ablage`, t.pile(0, 'discardPile').filter(x => x === 'Club of Gobbo').length === 2 && !stuetz(t, 0, 0).includes('Club of Gobbo'), { abl: t.pile(0, 'discardPile'), zone: stuetz(t, 0, 0) });
    else R.check(`${label}: ein Club liegt am Helden`, stuetz(t, 0, 0).includes('Club of Gobbo'), stuetz(t, 0, 0));
    R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  // ───────────────────────── Lolek ─────────────────────────
  R.section('Lolek, the Shard Knight (1× pro Zug, halber Preis) / Lolek, Mender of the Shattered Trident (1× pro Zug, gratis)');
  for (const [name, mender] of [['Lolek, the Shard Knight', false], ['Lolek, Mender of the Shattered Trident', true]]) {
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ heroes: [[name, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [['Club of Gobbo', 'Club of Gobbo'], []], hand: [[], []], gold: [100, 100] });
      if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
      t.script.push({ match: d => d.type === 'optionPicker' && d.title === name, answer: () => ({ optionId: 'equip' }) });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === name, answer: () => ({ cardName: 'Club of Gobbo', source: 'discard' }) });
      t.script.push({ match: d => d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0, owner: 0 }) });
      t.targetFn = (valid) => { const z = valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0); return [(z || valid[0]).id]; };
      await t.activateHero(0, 0, {});
      await wait(100);
      const erst = anz(t, name);
      await t.activateHero(0, 0, {});
      await wait(100);
      R.check(`${name} / ${label}: Galerie erschien beim ersten Einsatz`, erst >= 1, erst);
      R.check(`${name} / ${label}: ein ZWEITER Einsatz im selben Zug ist nicht mehr möglich`, anz(t, name) === erst, { erst, jetzt: anz(t, name) });
      if (lv) R.check(`${name} / ${label}: Club prallt ab — bleibt in der Ablage`, !stuetz(t, 0, 0).includes('Club of Gobbo') && t.pile(0, 'discardPile').filter(x => x === 'Club of Gobbo').length === 2, { zone: stuetz(t, 0, 0), abl: t.pile(0, 'discardPile') });
      else R.check(`${name} / ${label}: Club liegt am Helden`, stuetz(t, 0, 0).includes('Club of Gobbo'), stuetz(t, 0, 0));
      if (lv && !mender) R.check(`${name} / ${label}: Kosten bleiben bezahlt (wie Cool Repair): Gold sank`, t.gs.players[0].gold < 100, t.gs.players[0].gold);
      R.check(`${name} / ${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  // ───────────────────────── Alex ─────────────────────────
  R.section('Alex, Trainer of Heroes (bis zu 2× pro Zug): abgefangener Tutor-Einsatz zählt');
  {
    const ALEX = 'Alex, Trainer of Heroes';
    const DECK = ['Fighting', 'Fighting', 'Wealth', 'Toughness', 'Leadership'].concat(Array(15).fill(H.INERT.creature));
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ heroes: [[ALEX, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deck: [DECK, []], hand: [['Luck'], []] });
      t.setAbilities(0, 0, [[], [], []]);
      if (lv) t.setAbilities(0, 1, [RES(lv), [], []]);
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === ALEX, answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
      t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: () => ({ heroIdx: 1, zoneSlot: -1 }) });
      await t.play(0, 'Luck', { hero: 0, zoneSlot: 0 });
      const alex = t.hero(0, 0);
      const rest = usesLeft(alex, t.gs, { key: 'AlexTutor', max: 2 });
      R.check(`${label}: ein Alex-Einsatz verbraucht (noch 1 von 2 frei)`, rest === 1, rest);
      R.check(`${label}: ${lv ? 'Wealth bleibt im Deck' : 'Wealth liegt an Held 1'}`, lv ? (!zonen(t, 1).includes('Wealth') && t.pile(0, 'mainDeck').includes('Wealth')) : zonen(t, 1).includes('Wealth'), { z: zonen(t, 1) });
      R.check(`${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  // ───────────────────────── Training ─────────────────────────
  R.section('Training (1× pro Zug, alle Kopien): Option A (aus der Hand) und Option B (Deck-Suche) an einen Helden mit Resistance Lv3');
  for (const [opt, lvT] of [['A (Lv1, Hand)', 1], ['B (Lv3, Deck)', 3]]) {
    for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
      const t = await H.fresh({ deck: [['Fighting', 'Fighting', 'ZZ Dummy'], []], hand: [lvT === 1 ? ['Fighting', 'Fighting'] : [], []] });
      t.setAbilities(0, 0, [Array(lvT).fill('Training'), lv ? RES(lv) : [], []]);
      t.script.push({ match: d => d.type === 'abilityAttach', answer: (d) => ({ cardName: d.eligibleCards[0] }) });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Training', answer: () => ({ cardName: 'Fighting', source: 'deck' }) });
      t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: lvT === 1 ? 'hand' : 'deck' }) });
      t.gs.activePlayer = 0; t.gs.currentPhase = 2;
      const fl0 = t.hero(0, 0).abilityGiven;
      await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
      await wait(250);
      const erst = t.prompts.filter(p => p.d.type === 'abilityAttach' || (p.d.type === 'cardGallery' && p.d.title === 'Training')).length;
      await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
      await wait(250);
      const zweit = t.prompts.filter(p => p.d.type === 'abilityAttach' || (p.d.type === 'cardGallery' && p.d.title === 'Training')).length;
      const hat = zonen(t, 0).includes('Fighting');
      R.check(`Training ${opt} / ${label}: erster Einsatz öffnete die Wahl`, erst >= 1, erst);
      R.check(`Training ${opt} / ${label}: zweiter Einsatz im selben Zug öffnet nichts mehr (Einmal-Einsatz verbraucht)`, zweit === erst, { erst, zweit });
      if (lv) R.check(`Training ${opt} / ${label}: Fighting prallt ab — nicht angelegt, Quelle unverändert`, !hat && (lvT === 1 ? t.pile(0, 'hand').filter(x => x === 'Fighting').length === 2 : t.pile(0, 'mainDeck').filter(x => x === 'Fighting').length === 2), { hat, hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck') });
      else R.check(`Training ${opt} / ${label}: Fighting angelegt`, hat, zonen(t, 0));
      R.check(`Training ${opt} / ${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  // ───────────────────────── Waflav ─────────────────────────
  R.section('Waflav, the Metamorphing Monstrosity (jeder Effekt 1× pro Zug, kostet 1 Evolution Counter): Anlegen aus Deck / Hand an sich selbst');
  {
    const WAF = 'Waflav, the Metamorphing Monstrosity';
    for (const [modus, qDeck, qHand] of [['deck', ['Fighting', 'Fighting', 'ZZ Dummy'], []], ['hand', ['ZZ Dummy', 'ZZ Dummy'], ['Fighting', 'Fighting']]]) {
      for (const [label, lv] of [['Resistance Lv3', 3], ['ohne Resistance (Kontrolle)', 0]]) {
        const t = await H.fresh({ heroes: [[WAF, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], deck: [qDeck, []], hand: [qHand, []] });
        t.hero(0, 0)._evolutionCounters = 4;
        t.setAbilities(0, 0, [lv ? RES(lv) : [], [], []]);
        t.script.push({ match: d => d.type === 'optionPicker' && d.title === WAF, answer: () => ({ optionId: modus }) });
        t.script.push({ match: d => d.type === 'cardGallery' && d.title === WAF, answer: () => ({ cardName: 'Fighting', source: modus }) });
        const deck0 = t.pile(0, 'mainDeck').join('|');
        await t.activateHero(0, 0, {});
        await wait(150);
        const evo = t.hero(0, 0)._evolutionCounters;
        const hat = zonen(t, 0).includes('Fighting');
        R.check(`Waflav ${modus} / ${label}: der Effekt zählt als gewirkt — Evolution Counter bezahlt (4 → 3)`, evo === 3, evo);
        if (lv) R.check(`Waflav ${modus} / ${label}: Fighting prallt ab — nicht angelegt, Quelle unverändert (kein Mischen)`, !hat && (modus === 'deck' ? t.pile(0, 'mainDeck').join('|') === deck0 : t.pile(0, 'hand').filter(x => x === 'Fighting').length === 2), { hat, hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck') });
        else R.check(`Waflav ${modus} / ${label}: Fighting angelegt`, hat, zonen(t, 0));
        {   // Einmal-pro-Zug-Stempel dieses Effekts steht (die Engine bietet ihn im selben Zug nicht noch einmal an)
          const stempel = Object.entries(t.gs.hoptUsed || {}).filter(([k, v]) => k.includes(`waflav-effect:${modus}`) && v === t.gs.turn);
          R.check(`Waflav ${modus} / ${label}: Einmal-pro-Zug-Stempel des Effekts gesetzt`, stempel.length === 1, t.gs.hoptUsed);
        }
        R.check(`Waflav ${modus} / ${label}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
      }
    }
  }

  // ───────────────────────── Shapeshifter ─────────────────────────
  R.section('???, the Shapeshifter (1× pro Zug): abgefangenes Anlegen verbraucht den Einsatz (Ist-Zustand)');
  {
    const SHAPE = '???, the Shapeshifter', BEATO = 'Beato, the Butterfly Witch';
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.setAbilities(0, 0, [RES(3), [], []]);
    t.addHand(0, BEATO);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: BEATO, source: 'hand' }) });
    await t.activateHero(0, 0, {});
    const erst = anz(t, SHAPE);
    await t.activateHero(0, 0, {});
    R.check('Shapeshifter / Resistance Lv3: zweiter Einsatz im selben Zug öffnet nichts mehr', erst >= 1 && anz(t, SHAPE) === erst, { erst, jetzt: anz(t, SHAPE) });
    R.check('Shapeshifter / Resistance Lv3: keine Verwandlung, Beato bleibt auf der Hand', t.hero(0, 0).name === SHAPE && t.pile(0, 'hand').includes(BEATO), { n: t.hero(0, 0).name, hand: t.pile(0, 'hand') });
  }

  // ───────────────────────── Backpack ─────────────────────────
  R.section("Treasure Hunter's Backpack (Karte): abgefangen, aber verbraucht (Ist-Zustand)");
  {
    const B = "Treasure Hunter's Backpack";
    const t = await H.fresh({ hand: [[B], []], deck: [['Club of Gobbo', 'ZZ Dummy', 'ZZ Dummy'], []], gold: [100, 100] });
    t.setAbilities(0, 0, [RES(3), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === B, answer: () => ({ cardName: 'Club of Gobbo', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}) });
    t.targetFn = (valid) => { if (!valid.length) return []; const z = valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0); return [(z || valid[0]).id]; };
    const r = await t.play(0, B);
    R.check('Backpack / Resistance Lv3: Karte verbraucht (nicht mehr auf der Hand), Club bleibt im Deck', r === true && !t.pile(0, 'hand').includes(B) && t.pile(0, 'mainDeck').includes('Club of Gobbo') && stuetz(t, 0, 0).length === 0, { r, hand: t.pile(0, 'hand') });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
