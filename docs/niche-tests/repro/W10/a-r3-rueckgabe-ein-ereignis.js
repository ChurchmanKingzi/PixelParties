'use strict';
// W10a · R3 (A02-deepsea-16) · Al, 15.10.2026: „Zählen Siphem und Co Instanzen von Bounce oder jede einzelne Karte? … Die drei sind nur eine Instanz“
//   Siphem „Whenever you return 1 or more cards …“, Teppes „Up to 5 times per turn, when 1 or more cards are added …“, Analyzer/Gatherer
//   „Whenever your opponent draws or adds cards to their hand via an effect“ = EIN Ereignis, auch wenn ein Effekt mehrere Karten zugleich zurückgibt.
//   Karten mit Pro-Karte-Text (Blood Moon under the Sea: „Whenever a Creature is returned …“) behalten ihre Zählung.
// Erwartet: Dark Deepsea God gibt 3 Kreaturen in einem Effekt zurück → Siphem +1 Counter, Teppes zieht 1 (verbraucht 1 von 5 Ladungen),
//   Analyzer und Gatherer des Gegners je +1 Change Counter, Blood Moon (am Held der Rückgaben) löst 3x aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SIPH = 'Siphem, the Deepsea Demon', TEP = 'Teppes, the Deepsea Vampire';
  const AN = 'Analyzer from the Cosmic Depths', GA = 'Gatherer from the Cosmic Depths';
  // (1) Siphem + Teppes + Analyzer + Gatherer
  {
    const t = await H.fresh({ heroes: [[SIPH, TEP, 'Tushu, the Knowledge Keeper'], []], hand: [['Dark Deepsea God'], []], deck: [Array(10).fill(H.INERT.creature)] });
    const a = t.put(0, 0, 0, 'Deepsea Werewolf'), b = t.put(0, 0, 1, 'Deepsea Siren'), c = t.put(0, 1, 0, 'Deepsea Witch');
    a.turnPlayed = b.turnPlayed = c.turnPlayed = 1;
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip' && v.owner === 0 && [a, b, c].some(x => x.heroIdx === v.heroIdx && x.zoneSlot === v.slotIdx)).map(v => v.id);
    const r = await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
    R.check('(1) DDG gespielt (3 Tribute)', r === true && !!t.find('Dark Deepsea God', 'support'), r);
    R.check('(1) Siphem: genau 1 Counter', t.hero(0, 0).deepseaCounters === 1, t.hero(0, 0).deepseaCounters);
    const gezogen = t.pile(0, 'hand').filter(n => n === H.INERT.creature).length;
    R.check('(1) Teppes: zieht genau 1 Karte', gezogen === 1, t.pile(0, 'hand'));
    R.check('(1) Teppes: nur 1 von 5 Ladungen verbraucht', require('../../../../cards/effects/_charges').usesLeft(t.hero(0, 1), t.gs, { key: 'teppesDraw', max: 5 }) === 4, null);
    R.check('(1) alle 3 Kreaturen auf der Hand', ['Deepsea Werewolf', 'Deepsea Siren', 'Deepsea Witch'].every(n => t.pile(0, 'hand').includes(n)), t.pile(0, 'hand'));
    R.check('(1) keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('(1) Zustand sauber', t.audit().length === 0, t.audit());
  }
  // (1b) Analyzer/Gatherer des Gegners (ohne Teppes: dessen Ziehen wäre selbst ein „draws … via an effect“)
  {
    const t = await H.fresh({ heroes: [[SIPH, 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'], []], hand: [['Dark Deepsea God'], []], deck: [Array(10).fill(H.INERT.creature)] });
    const a = t.put(0, 0, 0, 'Deepsea Werewolf'), b = t.put(0, 0, 1, 'Deepsea Siren'), c = t.put(0, 1, 0, 'Deepsea Witch');
    a.turnPlayed = b.turnPlayed = c.turnPlayed = 1;
    const an = t.put(1, 0, 0, AN); an.turnPlayed = 1;
    const ga = t.put(1, 0, 1, GA); ga.turnPlayed = 1;
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip' && v.owner === 0 && [a, b, c].some(x => x.heroIdx === v.heroIdx && x.zoneSlot === v.slotIdx)).map(v => v.id);
    const r = await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
    R.check('(1b) DDG gespielt (3 Tribute)', r === true && !!t.find('Dark Deepsea God', 'support'), r);
    R.check('(1b) Analyzer des Gegners: genau +1', (an.counters.changeCounter || 0) === 1, an.counters.changeCounter || 0);
    R.check('(1b) Gatherer des Gegners: genau +1', (ga.counters.changeCounter || 0) === 1, ga.counters.changeCounter || 0);
    R.check('(1b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (2) Blood Moon zählt weiter je Kreatur (Text: „Whenever a Creature is returned …“)
  {
    const t = await H.fresh({ heroes: [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], ['Atta, Speaker of Desires', 'Hulijing, the Foxdemon', 'George, the Mad Tyrant King']], hand: [['Dark Deepsea God'], []], deck: [Array(10).fill(H.INERT.creature)] });
    const a = t.put(0, 0, 0, 'Deepsea Werewolf'), b = t.put(0, 0, 1, 'Deepsea Siren'), c = t.put(0, 0, 2, 'Deepsea Witch');
    a.turnPlayed = b.turnPlayed = c.turnPlayed = 1;
    t.put(0, 0, 0, 'Blood Moon under the Sea');
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.baseDamage === 50) { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : null; }
      return valid.filter(v => v.type === 'equip' && v.owner === 0 && [a, b, c].some(x => x.heroIdx === v.heroIdx && x.zoneSlot === v.slotIdx)).map(v => v.id);
    };
    const hp0 = t.hp(1, 0);
    const r = await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
    R.note('(2) gespielt', { r, hp: t.hp(1, 0), errors: t.errors.length });
    // DDG selbst macht 150 auf den Gegner; Blood Moon je Kreatur 50 → 3x50 = 150 zusätzlich
    R.check('(2) Blood Moon löst je Kreatur aus (3 x 50)', hp0 - t.hp(1, 0) === 150 + 3 * 50, hp0 - t.hp(1, 0));
    R.check('(2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
