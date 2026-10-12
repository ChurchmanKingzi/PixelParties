'use strict';
// A06-rebelliokai-20 · Chilly Wizard: gespiegelter Status bleibt auf dem Wirt, wenn der Wizard ihn verliert oder das Feld verlässt
// Kartentext: „Any negative status effect this Creature is affected by also affects the corresponding Hero while this Creature remains on the board.
//   This effect cannot be negated."
// Beobachtung: Der Status wird einmal bei Anlegen gespiegelt (`onStatusApplied`, mischief-militia-chilly-wizard.js) und lebt dann mit eigener Dauer
//   auf dem Helden. Heilt man den Wizard (z. B. Thaw Blader) oder stirbt er, bleibt der Wirt gefroren.
// Frage (Stufe C): Soll der gespiegelte Status enden, sobald der Wizard ihn nicht mehr trägt bzw. das Feld verlässt – Ja (gebunden) oder Nein (läuft allein ab)?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const W = 'Mischief Militia - Chilly Wizard';
  const t = await H.fresh({ hand: [[W], []] });
  t.gs._chillyWizardHint = { 0: { ownerIdx: 1, heroIdx: 0, slotIdx: 0 } };
  await t.play(0, W, { hero: 0, slot: 0 });
  const wiz = t.find(W, 'support');
  R.check('Aufbau: Wizard liegt auf der Seite des Gegners', !!wiz && wiz.owner === 1 && wiz.heroIdx === 0);
  await t.run(() => t.engine.applyCreatureStatus(wiz, 'frozen', { duration: 3, sourceOwner: 0, source: 'repro' }));
  R.check('Spiegel: Wirt (Gegner-Held 0) ist gefroren', !!t.hero(1, 0).statuses.frozen);
  t.engine.cleanseCreatureStatuses(wiz, ['frozen'], 'Thaw');
  R.check('Wizard geheilt (nicht mehr gefroren)', !wiz.counters.frozen);
  R.check('… dann ist auch der Wirt nicht mehr durch den Wizard gefroren', !t.hero(1, 0).statuses.frozen, t.hero(1, 0).statuses);
  R.finish();
})();
