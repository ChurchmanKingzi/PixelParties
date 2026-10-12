'use strict';
// A01-pollution-11 · Soul Shard Sah: das Nachspielen fremder On-Summon-Effekte stempelt deren „1 pro Zug“-Sperre
// Kartentexte: Sah: „When this Creature is summoned by the effect of Necromancy, you may choose up to 2 Creatures with different names in your discard pile,
//   except „Soul Shard Sah“. This Creature resolves those Creatures' on-summon effects as if they were its own.“
//   Sekhem/Ba/…: „You can only summon 1 „Soul Shard Sekhem“ per turn.“
// Erwartung: Sah BESCHWÖRT weder Sekhem noch Ba – er löst nur deren Effekt aus. Eine echte Soul Shard Sekhem aus der Hand bleibt im selben Zug spielbar.
// Beobachtet: Der nachgespielte `onPlay` von Sekhem/Ba ruft `markSoulShardSummoned(gs, pi, 'Soul Shard Sekhem'/'Soul Shard Ba')` (Name des Skripts, nicht des
//   Trägers) → `ps._soulShardSummonedThisTurn = {Sah, Sekhem, Ba}`; die echte Sekhem aus der Hand wird abgelehnt (doPlayCreature → false).
// Ursache: cards/effects/soul-shard-sah.js (läuft `runHooks('onPlay', {cardName: chosenName})` mit `_effectOverride`) + der Stempel am Anfang jedes
//   Shard-`onPlay` (z. B. soul-shard-sekhem.js: `markSoulShardSummoned(gs, pi, CARD_NAME)`).
// Aufruf: node docs/niche-tests/repro/A01-pollution/11-soul-shard-sah-stempelt-fremde-shards.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Soul Shard Sekhem'], []], discard: [['Soul Shard Sah', 'Soul Shard Sekhem', 'Soul Shard Ba'], []],
    abilities: { 0: { 0: [['Necromancy', 'Necromancy', 'Necromancy'], ['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], []] } } });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.script.push({ match: d => d && d.type === 'cardGallery' && /Necromancy/.test(d.title || ''), answer: () => ({ cardName: 'Soul Shard Sah' }) });
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti' && d.title === 'Soul Shard Sah', answer: () => ({ selectedCards: ['Soul Shard Sekhem', 'Soul Shard Ba'] }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));       // Necromancy (freie Ability)
  R.check('Necromancy hat Sah beschworen, Sekhem-Effekt lief (50 Schaden)', !!t.find('Soul Shard Sah', 'support') && t.hp(1, 0) === 750, { sah: !!t.find('Soul Shard Sah', 'support'), hp: t.hp(1, 0) });
  const stempel = Object.keys(t.gs.players[0]._soulShardSummonedThisTurn || {});
  R.check('als beschworen gestempelt sind nur die wirklich beschworenen Shards (nur Sah)', stempel.length === 1 && stempel[0] === 'Soul Shard Sah', stempel);
  const r = await t.play(0, 'Soul Shard Sekhem', { hero: 0 });
  R.check('echte Soul Shard Sekhem aus der Hand ist im selben Zug spielbar', r === true && !!t.find('Soul Shard Sekhem', 'support'), { r, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
