'use strict';
// A06-rebelliokai-20 · Chilly Wizard: der gespiegelte Status ist an den Wizard GEBUNDEN
// Kartentext: „Any negative status effect this Creature is affected by also affects the corresponding Hero while this Creature remains on the board.
//   This effect cannot be negated."
// ENTSCHIEDEN (Al, Welle 10, Q41: „Sollte an den Wizard gebunden sein!“): endet der Status beim Wizard (Heilung) oder verlässt/stirbt der Wizard, endet er auch
//   beim Wirtshelden. „Cannot be negated“: die Spiegelung ruht nicht, wenn der Wizard selbst gefroren/betäubt/negiert ist (`bypassStatusFilter`).
// (Umgestellt: vorher wurde „bleibt auf dem Wirt“ beanstandet/als Frage geführt.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const W = 'Mischief Militia - Chilly Wizard';
  const warte = (ms) => new Promise(r => setTimeout(r, ms));
  const aufbau = async () => {
    const t = await H.fresh({ hand: [[W], []] });
    t.gs._chillyWizardHint = { 0: { ownerIdx: 1, heroIdx: 0, slotIdx: 0 } };
    await t.play(0, W, { hero: 0, slot: 0 });
    const wiz = t.find(W, 'support');
    return { t, wiz };
  };
  // (a) Heilung des Wizards (Thaw-Weg) beendet den Spiegel
  let { t, wiz } = await aufbau();
  R.check('Aufbau: Wizard liegt auf der Seite des Gegners', !!wiz && wiz.owner === 1 && wiz.heroIdx === 0);
  await t.run(() => t.engine.applyCreatureStatus(wiz, 'frozen', { duration: 3, sourceOwner: 0, source: 'repro' }));
  R.check('Spiegel: Wirt (Gegner-Held 0) ist gefroren', !!t.hero(1, 0).statuses.frozen);
  t.engine.cleanseCreatureStatuses(wiz, ['frozen'], 'Thaw');
  await warte(150);
  R.check('Wizard geheilt (nicht mehr gefroren)', !wiz.counters.frozen);
  R.check('… dann ist auch der Wirt nicht mehr durch den Wizard gefroren', !t.hero(1, 0).statuses.frozen, t.hero(1, 0).statuses);
  R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  // (b) Tod des Wizards beendet den Spiegel
  ({ t, wiz } = await aufbau());
  await t.run(() => t.engine.applyCreatureStatus(wiz, 'frozen', { duration: 3, sourceOwner: 0, source: 'repro' }));
  R.check('(b) Spiegel liegt', !!t.hero(1, 0).statuses.frozen);
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Quelle', owner: 0, heroIdx: 0 }, wiz, 500, 'creature', { sourceOwner: 0 }));
  R.check('(b) Wizard ist tot', wiz.zone !== 'support' || !t.find(W, 'support'), wiz.zone);
  R.check('(b) Wirt nicht mehr gefroren', !t.hero(1, 0).statuses.frozen, t.hero(1, 0).statuses);
  R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  // (c) Abgang durch Zerstören beendet den Spiegel
  ({ t, wiz } = await aufbau());
  await t.run(() => t.engine.applyCreatureStatus(wiz, 'frozen', { duration: 3, sourceOwner: 0, source: 'repro' }));
  await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: 0, heroIdx: 0 }, wiz));
  R.check('(c) Wizard zerstört → Wirt nicht mehr gefroren', !t.hero(1, 0).statuses.frozen, t.hero(1, 0).statuses);
  // (d) Ein fremder (eigener) Frost des Wirts bleibt: nicht vom Wizard gespiegelt
  ({ t, wiz } = await aufbau());
  t.heroStatus(1, 0, 'frozen');
  await t.run(() => t.engine.applyCreatureStatus(wiz, 'frozen', { duration: 3, sourceOwner: 0, source: 'repro' }));
  t.engine.cleanseCreatureStatuses(wiz, ['frozen'], 'Thaw');
  await warte(150);
  R.check('(d) Wirt war schon aus anderer Quelle gefroren: bleibt gefroren, wenn der Wizard geheilt wird', !!t.hero(1, 0).statuses.frozen, t.hero(1, 0).statuses);
  // (e) „cannot be negated“: ein negierter Wizard spiegelt trotzdem
  ({ t, wiz } = await aufbau());
  await t.run(() => t.engine.actionNegateCreature(wiz, 'Test'));
  await t.run(() => t.engine.applyCreatureStatus(wiz, 'frozen', { duration: 3, sourceOwner: 0, source: 'repro' }));
  R.check('(e) negierter Wizard spiegelt den Frost weiter', !!t.hero(1, 0).statuses.frozen, t.hero(1, 0).statuses);
  R.check('(e) keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
