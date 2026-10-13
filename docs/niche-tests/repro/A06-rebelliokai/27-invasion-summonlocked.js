'use strict';
// A06-rebelliokai-27 · Mischief Invasion beschwört trotz Beschwörungssperre (summonLocked)
// Kartentext Mischief Invasion: „Choose up to as many "Mischief Militia" Creatures from your hand as there are Frozen targets on the board and
//   summon them as additional Actions."
// Ruling (_summon-eligibility.js Kopf / CARD_API „BESCHWÖRUNGSSPERREN"): `ps.summonLocked` sperrt JEDE echte Beschwörung, auch „as an additional Action".
// Beobachtung: mischief-invasion.js (`_heroCanHostCreature`) prüft Held-Status und `heroMeetsLevelReq`, nicht `summonLocked` (und nicht die
//   Aktionssperren des Hosts). Der Zauber (kein Kreaturenweg, daher von der Sperre nicht abgefangen) beschwört die Kreatur.
// Erwartung: unter summonLocked wird nichts beschworen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, SM1 = [['Summoning Magic']];
  const board = (t) => [0, 1, 2].map(hi => [0, 1, 2].map(z => t.zone(0, hi, z)));
  const mk = async ({ locked = false, actionLock = false } = {}) => {
    const t = await H.fresh({ hand: [['Mischief Invasion', 'Mischief Militia - Chilly Dog'], []] });
    t.grantFor(0, 0, 'Mischief Invasion'); t.setAbilities(0, 1, SM1);
    for (const z of [0, 1, 2]) { t.put(0, 0, z, D); t.put(0, 2, z, D); }
    if (locked) t.gs.players[0].summonLocked = true;
    if (actionLock) t.hero(0, 1)._actionLockedTurn = t.gs.turn;
    t.put(1, 0, 0, D).counters.frozen = 1;    // ein gefrorenes Ziel
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.slice(0, 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    return t;
  };
  const chilly = (t) => [0, 1, 2].some(z => t.zone(0, 1, z) === 'Mischief Militia - Chilly Dog');
  let t, r;
  t = await mk();
  r = await t.play(0, 'Mischief Invasion', { hero: 0, noGrant: true });
  R.check('Kontrolle: ohne Sperre wird Chilly Dog bei Held 1 beschworen', chilly(t), { r, board: board(t) });
  t = await mk({ locked: true });
  r = await t.play(0, 'Mischief Invasion', { hero: 0, noGrant: true });
  R.check('summonLocked: Chilly Dog wird NICHT beschworen', !chilly(t), { r, board: board(t), hand: t.pile(0, 'hand') });
  t = await mk({ actionLock: true });
  r = await t.play(0, 'Mischief Invasion', { hero: 0, noGrant: true });
  R.check('Aktionssperre des Hosts (Held 1): Chilly Dog wird NICHT bei Held 1 beschworen', !chilly(t), { r, board: board(t) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
