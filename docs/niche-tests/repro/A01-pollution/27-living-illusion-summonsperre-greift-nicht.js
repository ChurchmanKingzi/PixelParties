'use strict';
// A01-pollution-27 · Living Illusion: „You cannot summon Creatures for the rest of the turn“ sperrt Effekt-Beschwörungen nicht
// Kartentext: „… You cannot summon Creatures for the rest of the turn afterwards. This counts as an additional Action.“
// CARD_API.md Z. 1972: `ctx.lockSummons()` → `ps.summonLocked` — „sperrt in der Engine Hand-, Effekt-Beschwörungen UND Platzierungen“; Z. 18167: „`ps.summonLocked` | immer (jede echte Beschwörung)“.
// Aufbau: Sitz 0: 2× Living Illusion, Reincarnation, Dummy-Kreatur auf der Hand, 2× Royal Corgi im Deck, Royal Corgi in der Ablage; Thep als Held (zweiter Test, Soul Shard Ba in der Ablage).
// Schritte: 1. erste Living Illusion (setzt `ps.summonLocked`). 2. zweite Living Illusion. 3. Reincarnation (Kreatur aus der Ablage). 4. Thep platziert Soul Shard Ba. Gegenprobe: Kreatur aus der Hand → abgelehnt.
// Erwartung: unter der Sperre wird keine Kreatur beschworen/platziert (zweite Living Illusion und Reincarnation-Kreatur sind nicht wirksam bzw. nicht spielbar, Thep darf nichts platzieren).
// Beobachtet: Hand-Beschwörung wird abgelehnt (Sperre greift), aber die zweite Living Illusion setzt eine zweite Kreatur, Reincarnation eine dritte und Thep platziert Soul Shard Ba.
// Ursache: `summonLocked` wird nur von der Hand-Prüfung, `actionPlaceCreature` (_engine.js ~25989) und den per Lader markierten Summon-only-Karten (`blockedBySummonLock`) gelesen; `summonCreatureWithHooks` /
//   `summonFromDiscard` (Weg von Living Illusion, Reincarnation, Thep, Soul Shard Ka/Khet) prüfen sie nicht.
// Aufruf: node docs/niche-tests/repro/A01-pollution/27-living-illusion-summonsperre-greift-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const corgis = (t) => t.inst(c => c.name === 'Royal Corgi' && c.zone === 'support').length;
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['Living Illusion', 'Living Illusion', 'Reincarnation', 'ZZ Dummy'], []], deck: [['Royal Corgi', 'Royal Corgi', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], []],
    discard: [['Royal Corgi', 'Soul Shard Ba'], []] });
  t.policy.confirm = true;
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Living Illusion', answer: () => ({ cardName: 'Royal Corgi' }) });
  t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Reincarnation', answer: () => ({ optionId: 'restore' }) });
  t.script.push({ match: d => d && d.type === 'cardGallery' && /Reincarnation/.test(d.title || ''), answer: () => ({ cardName: 'Royal Corgi' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  await t.play(0, 'Living Illusion', { hero: 0 });
  R.check('Aufbau: erste Living Illusion hat 1 Corgi gesetzt und die Sperre aktiviert', corgis(t) === 1 && t.gs.players[0].summonLocked === true, { corgis: corgis(t), locked: t.gs.players[0].summonLocked });
  const rHand = await t.play(0, 'ZZ Dummy', { hero: 0, slot: 2, keepActions: true });
  R.check('Kontrolle: Kreatur aus der Hand wird unter der Sperre abgelehnt', rHand === false, rHand);
  await t.play(0, 'Living Illusion', { hero: 0, keepActions: false });
  R.check('zweite Living Illusion setzt unter der Sperre keine Kreatur', corgis(t) === 1, { corgis: corgis(t) });
  t.grantFor(0, 0, 'Reincarnation');
  await t.play(0, 'Reincarnation', { hero: 0, keepActions: false });
  R.check('Reincarnation (Kreatur aus der Ablage) platziert unter der Sperre keine Kreatur', corgis(t) === 1, { corgis: corgis(t) });

  // Thep
  const THEP = ['Thep, the Court Scribe', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'];
  t = await H.fresh({ hand: [['Living Illusion'], []], deck: [['Royal Corgi', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], []], discard: [['Soul Shard Ba'], []], heroes: [THEP, undefined],
    abilities: { 0: { 0: [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []] } } });
  t.gs.players[0]._discardNamesAtTurnStart = new Set(['Soul Shard Ba']);
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Living Illusion', answer: () => ({ cardName: 'Royal Corgi' }) });
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Thep, the Court Scribe', answer: () => ({ cardName: 'Soul Shard Ba' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.policy.confirm = true;
  await t.play(0, 'Living Illusion', { hero: 0 });
  await t.activateHero(0, 0, {});
  R.check('Thep platziert unter der Beschwörungssperre keine Soul Shard', !t.find('Soul Shard Ba', 'support'), { auf_brett: !!t.find('Soul Shard Ba', 'support') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
