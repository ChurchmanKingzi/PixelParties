'use strict';
// A06-rebelliokai-25 · SnowItAll beschwört ohne Beschwörer-Eignung (Schule/Level, Frozen/Stunned, summonLocked, Aktionssperre)
// Kartentext Mischief Militia - SnowItAll: „You may once per turn summon a level 1 or lower Creature from your hand as an additional Action,
//   but if you do, Freeze it for 2 turns."
// Ruling (CARD_API.md „BESCHWÖRUNGSSPERREN in _summon-eligibility.js", Kopf von _summon-eligibility.js, Ruling 8.8.): „summon as an additional
//   Action" ist eine ganz normale Beschwörung – ein tauglicher Beschwörer ist Pflicht (lebendig, nicht Frozen/Stunned/Webbed/Bound/Negated,
//   Schul-/Levelanforderung erfüllt), `ps.summonLocked` sperrt JEDE echte Beschwörung, Aktionssperren sperren auch Zusatzaktionen.
// Beobachtung: `_findFreeOwnSupportSlots` (mischief-militia-snowitall.js) listet jede freie Zone jedes lebenden Helden; weder
//   `eligibleSummonZones`/`canHeroSummon` noch `summonLocked` werden geprüft. Der Beagle (Lv1) landet bei einem Helden ohne Summoning Magic,
//   bei einem gefrorenen/betäubten/negierten Helden, trotz Beschwörungssperre und trotz Aktionssperre des Helden.
// Erwartung: in allen Fällen wird nichts beschworen (der Effekt ist nicht aktivierbar / verpufft); Kontrolle (gesunder Host mit SM) beschwört.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, SIA = 'Mischief Militia - SnowItAll', SM1 = [['Summoning Magic']];
  const beagleDa = (t) => [0, 1, 2].some(hi => [0, 1, 2].some(z => t.zone(0, hi, z) === 'Loyal Beagle'));
  const board = (t) => [0, 1, 2].map(hi => [0, 1, 2].map(z => t.zone(0, hi, z)));
  // Nur Held 1 hat eine freie Zone (Slot 0). SnowItAll steht seit dem Vorzug auf Held 0 / Slot 0.
  const setup = async ({ sm = true, status = null, locked = false, actionLock = false } = {}) => {
    const t = await H.fresh({ hand: [['Loyal Beagle'], []] });
    if (sm) t.setAbilities(0, 1, SM1);
    t.put(0, 0, 0, SIA).turnPlayed = t.gs.turn - 1;
    t.put(0, 0, 1, D); t.put(0, 0, 2, D);
    for (const z of [0, 1, 2]) t.put(0, 2, z, D);
    t.put(0, 1, 1, D); t.put(0, 1, 2, D);
    if (status) t.heroStatus(0, 1, status);
    if (locked) t.gs.players[0].summonLocked = true;
    if (actionLock) t.hero(0, 1)._actionLockedTurn = t.gs.turn;
    t.put(1, 0, 0, D).counters.frozen = 1;     // ein gefrorenes Ziel (Haste-Bedingung irrelevant, SnowItAll ist alt)
    t.gs.currentPhase = 2; t.resetActions(0);
    return t;
  };
  let t, r;
  R.section('Kontrolle: Held 1 mit Summoning Magic Lv1, gesund');
  t = await setup(); r = await t.activateCreature(0, 0, 0);
  R.check('Kontrolle: Beagle landet bei Held 1', t.zone(0, 1, 0) === 'Loyal Beagle', { r, board: board(t) });
  R.section('S1 kein Held hat Summoning Magic');
  t = await setup({ sm: false }); r = await t.activateCreature(0, 0, 0);
  R.check('S1: Beagle (Lv1) wird NICHT beschworen (kein tauglicher Beschwörer)', !beagleDa(t), { r, board: board(t) });
  for (const st of ['frozen', 'stunned', 'negated']) {
    t = await setup({ status: st }); r = await t.activateCreature(0, 0, 0);
    R.check('S2 ' + st + ': Beagle wird NICHT über einen ' + st + ' Helden beschworen', !beagleDa(t), { r, board: board(t) });
  }
  R.section('S3 summonLocked');
  t = await setup({ locked: true }); r = await t.activateCreature(0, 0, 0);
  R.check('S3: unter summonLocked wird nichts beschworen', !beagleDa(t), { r, board: board(t) });
  R.section('S4 Aktionssperre des Hosts');
  t = await setup({ actionLock: true }); r = await t.activateCreature(0, 0, 0);
  R.check('S4: Held mit Aktionssperre (_actionLockedTurn) beschwört nicht', !beagleDa(t), { r, board: board(t) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
