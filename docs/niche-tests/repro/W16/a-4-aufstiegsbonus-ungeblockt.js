'use strict';
// W16a · Punkt 4 · Al, 19.10.2026: „Soll Resistance den Aufstiegsbonus aller Ascended Heroes abfangen?" — „Nein, von keinem."
// Erwartet: Der Aufstiegsbonus (`performAscensionBonus` und Chuck, the Storyteller) wird von Resistance Lv3 am aufgestiegenen Helden NICHT abgefangen — der Bonus kommt bei JEDEM
// Ascended Hero, der ihn kennt. Die Standard-Spielaktion bleibt ohnehin ungeblockt; die Gegenprobe zeigt, dass Resistance sonst weiter wirkt (Anlegen per Effekt: Pressed Skill).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader');
const RES = ['Resistance', 'Resistance', 'Resistance'];
const zonen = (t, hi) => (t.gs.players[0].abilityZones[hi] || []).flat();
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
(async () => {
  const R = H.runner();

  R.section('Generischer Aufstiegsbonus (`performAscensionBonus`) bei Resistance Lv3 — jeder Held, der ihn nutzt');
  const helden = [
    ['Arthor, Inheritor of the Barbarian Sword', 'Fighting'],
    ["Kohta, Master of Super-Killing", 'Fighting'],
    ['Riffel, Master of the Ultimate Gun', 'Fighting'],
    ["Taio, Absorber of the Mountain's Heart", 'Fighting'],
    ["Layn, Master of Deri's Relic", 'Fighting'],
    ['Lolek, Mender of the Shattered Trident', 'Fighting'],
    ['Fiona, the Empty Vessel of a Forgotten Sorceress', 'Magic Arts'],
    ['True Fairy Crestina, the Primordial Goddess', 'Wisdom'],
  ];
  for (const [name, abil] of helden) {
    const t = await H.fresh({ deck: [[abil, abil, abil, 'ZZ Dummy'], []], hand: [[], []] });
    t.setHero(0, 0, name, 300);
    t.setAbilities(0, 0, [RES.slice(), [], []]);
    const skript = loadCardEffect(name);
    await t.run(() => skript.onAscensionBonus(t.engine, 0, 0, 0));
    const n = zonen(t, 0).filter(x => x === abil).length;
    R.check(`${name}: Resistance Lv3 fängt den Bonus nicht ab — ${abil} angelegt (mind. 1)`, n >= 1, { n, zonen: zonen(t, 0), prompts: t.prompts.map(p => p.d.title) });
    R.check(`${name}: keine Engine-Fehler / Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Chuck, the Storyteller (eigene Anlegeschleife)');
  {
    const CH = 'Chuck, the Storyteller';
    const t = await H.fresh({ hand: [[], []] });
    t.setHero(0, 0, CH, 300);
    t.setAbilities(0, 0, [RES.slice(), [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === CH, answer: () => ({ cardName: 'Fighting', source: 'outside' }), once: true });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === CH, answer: () => null });
    await t.run(() => loadCardEffect(CH).onAscensionBonus(t.engine, 0, 0, 0));
    const gal = t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === CH).length;
    R.check('Chuck bekommt seinen Bonus trotz Resistance Lv3 — Galerie erschien, Fighting angelegt', gal >= 1 && zonen(t, 0).includes('Fighting'), { gal, zonen: zonen(t, 0) });
    R.check('Chuck: keine Engine-Fehler / Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Echter Aufstieg (performAscension) auf einen Helden mit Resistance Lv3: Bonus kommt, die Resistance-Zone bleibt');
  {
    const t = await H.fresh({ deck: [['Fighting', 'Fighting', 'Fighting', 'ZZ Dummy'], []], hand: [[], []] });
    t.setAbilities(0, 0, [RES.slice(), [], []]);
    const deck0 = t.pile(0, 'mainDeck').length;
    await t.run(() => t.engine.performAscensionBonus(0, 0, ['Fighting'], 0));
    R.check('performAscensionBonus: drei Fighting aus dem Deck an den Helden', zonen(t, 0).filter(x => x === 'Fighting').length === 3 && t.pile(0, 'mainDeck').length === deck0 - 3, { zonen: zonen(t, 0), deck: t.pile(0, 'mainDeck') });
    R.check('Resistance Lv3 bleibt unverändert', zonen(t, 0).filter(x => x === 'Resistance').length === 3, zonen(t, 0));
  }

  R.section('Gegenprobe: Resistance blockt das Anlegen einer Ability per Effekt weiterhin (Aufstiegsbonus ist die einzige Ausnahme)');
  {
    const t = await H.fresh({ hand: [[], []], deck: [['Fighting', 'ZZ Dummy'], []] });
    t.setAbilities(0, 0, [RES.slice(), [], []]);
    const blockiert = await t.run(() => t.engine.abilityAnlegenDurchResistanceBlockiert(0, 0, 0, 'Pressed Skill'));
    R.check('abilityAnlegenDurchResistanceBlockiert meldet weiter „blockiert"', blockiert === true || (blockiert && blockiert.result === true), blockiert);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
