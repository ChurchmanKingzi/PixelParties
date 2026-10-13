'use strict';
// A01-pollution-22 · Soul Shard Ka: die per Suche beschworene Kreatur ist „negiert“ – ihr Einsatz-Effekt (On-Summon) läuft aber trotzdem
// Kartentext Ka: „When this Creature is summoned from your discard pile, you may search your deck for any level 0/1/2 or lower Creature and immediately summon it as an
//   additional Action, but negate its effects until the end of the turn.“ (Skriptkopf: „The placed Creature is Necromancy-style negated“.)
// Erwartung: wie bei Necromancy (Kreatur kommt negiert ins Spiel, ihr Einsatz-Effekt unterbleibt): Archer of Teocuilatl bringt KEINE 4 Gold, Sleeping Beauty verknüpft keinen Helden.
// Beobachtet: Ka wendet `actionNegateCreature` erst NACH `summonCreatureWithHooks` an (Hooks `onPlay`/`onCardEnterZone` sind schon gelaufen): Archer +4 Gold, Sleeping Beauty
//   bekommt ihre Verknüpfung (`_linkedHeroOwner`) – die Kreatur gilt danach als negiert (Flag gesetzt), ihr Einsatz-Effekt hat aber gewirkt. Gegenprobe Necromancy: keine Wirkung.
// Ursache: cards/effects/soul-shard-ka.js (~Z. 195–225): `summonCreatureWithHooks(…)` vor `engine.actionNegateCreature(placeRes.inst, …)`; Necromancy setzt die Negation vor dem Einsatz-Effekt.
// Aufruf: node docs/niche-tests/repro/A01-pollution/22-soul-shard-ka-negiert-erst-nach-dem-einsatz-effekt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const THEP = ['Thep, the Court Scribe', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'];
(async () => {
  const R = H.runner();
  // Ka (Thep platziert Ka aus der Ablage) → Archer aus dem Deck
  let t = await H.fresh({ discard: [['Soul Shard Ka'], []], deck: [['Archer of Teocuilatl', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], []],
    heroes: [THEP, undefined], abilities: { 0: { 0: [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []] } } });
  t.gs.players[0]._discardNamesAtTurnStart = new Set(['Soul Shard Ka']);
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Thep, the Court Scribe', answer: () => ({ cardName: 'Soul Shard Ka' }) });
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Soul Shard Ka', answer: () => ({ cardName: 'Archer of Teocuilatl' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  const g0 = t.gs.players[0].gold;
  await t.activateHero(0, 0, {});
  const archer = t.find('Archer of Teocuilatl', 'support');
  R.check('Aufbau: Archer wurde per Ka beschworen und ist negiert', !!archer && !!archer.counters.negated, archer && archer.counters);
  R.check('Ka → Archer: negierter Archer bringt KEINE 4 Gold (Einsatz-Effekt unterbleibt)', t.gs.players[0].gold === g0, { vorher: g0, nachher: t.gs.players[0].gold });

  // Gegenprobe: Necromancy → Archer
  t = await H.fresh({ discard: [['Archer of Teocuilatl'], []], heroes: [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], undefined],
    abilities: { 0: { 0: [['Necromancy', 'Necromancy', 'Necromancy'], ['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], []] } } });
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: 'Archer of Teocuilatl' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  const g1 = t.gs.players[0].gold;
  t.gs.activePlayer = 0; t.phase(2);
  await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
  R.check('Kontrolle Necromancy → Archer: ebenfalls negiert, 0 Gold', !!t.find('Archer of Teocuilatl', 'support') && t.gs.players[0].gold === g1, { vorher: g1, nachher: t.gs.players[0].gold });

  // Sleeping Beauty: Verknüpfung (On-Summon)
  t = await H.fresh({ discard: [['Soul Shard Ka'], []], deck: [['Sleeping Beauty', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], []],
    heroes: [THEP, undefined], abilities: { 0: { 0: [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []] } } });
  t.gs.players[0]._discardNamesAtTurnStart = new Set(['Soul Shard Ka']);
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Thep, the Court Scribe', answer: () => ({ cardName: 'Soul Shard Ka' }) });
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Soul Shard Ka', answer: () => ({ cardName: 'Sleeping Beauty' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  await t.activateHero(0, 0, {});
  const sb = t.find('Sleeping Beauty', 'support');
  R.check('Ka → Sleeping Beauty: negierte Kreatur verknüpft keinen Helden', !!sb && sb.counters._linkedHeroOwner === undefined, sb && sb.counters);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
