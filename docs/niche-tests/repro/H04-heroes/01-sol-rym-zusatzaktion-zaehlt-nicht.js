'use strict';
// H04-01 · Sol Rym: Zusatzaktionen zählen nicht gegen „never more than 1 Action per turn"
//
// Kartentext (Sol Rym, the Thunder Djinn): „This Hero may use the Spell "Chain Lightning" regardless of its level.
//   This Hero can never perform more than 1 Action per turn."
// Coffee: „… you may immediately perform an additional Action with that Hero."
// Ruling (CARD_API.md, Abschnitt Friedhelm): „‚Can never perform more than 1 Action per turn' – Zusatzaktionen zählen mit.
//   Vorhandener Engine-Vertrag: hero._maxActionsPerTurn = 1 im onGameStart (wie Sol Rym). Der Zähler _actionsThisTurn wird in
//   server.js aber nur bei regulären Zügen erhöht; zusätzliche und inhärente Aktionen laufen daran vorbei.
//   Friedhelm lauscht deshalb auf onAnyActionResolved …"
// Erwartung: Sol Rym führt nach der Coffee-Zusatzaktion KEINE zweite (reguläre) Aktion mehr aus.
// Beobachtet: _actionsThisTurn bleibt nach der Zusatzaktion 0; in der Action Phase wirkt Sol Rym ein zweites Chain Lightning.
// Ursache: sol-rym-the-thunder-djinn.js setzt nur hero._maxActionsPerTurn (onGameStart), hat – anders als friedhelm-the-misled-avenger.js –
//   keinen onAnyActionResolved-Hook; server.js zählt _actionsThisTurn nur in doPlaySpell/doPlayCreature.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SOL = 'Sol Rym, the Thunder Djinn';
  const t = await H.fresh({ heroes: [[SOL, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [['Coffee', 'Chain Lightning', 'Chain Lightning'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.heroStatus(0, 0, 'poisoned'); t.hero(0, 0).statuses.poisoned.stacks = 1;   // alter Negativstatus (appliedTurn 0 < Zug 5)
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
  t.script.push({ match: d => d.type === 'statusSelect', answer: () => ({ selectedStatuses: ['poisoned'] }), once: true });
  t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cardName: 'Chain Lightning', handIndex: t.gs.players[0].hand.indexOf('Chain Lightning') }), once: true });
  // Coffee ist ein zielendes Artefakt: play() öffnet den Zielmodus, doConfirmPotion bestätigt ihn
  await t.play(0, 'Coffee', { hero: 0 });
  await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: ['hero-0-0'] }));
  const nach1 = t.pile(0, 'discardPile').filter(n => n === 'Chain Lightning').length;
  R.check('Vorbereitung: Zusatzaktion hat Chain Lightning gewirkt', nach1 === 1, t.pile(0, 'discardPile'));
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); return v ? [v.id] : null; };
  const r2 = await t.play(0, 'Chain Lightning', { hero: 0, noGrant: true, keepActions: true, phase: 3 });
  const n = t.pile(0, 'discardPile').filter(x => x === 'Chain Lightning').length;
  R.check('Sol Rym: nach der Zusatzaktion keine weitere Aktion in diesem Zug (höchstens 1 Chain Lightning gewirkt)', n <= 1, { r2, chainLightningGewirkt: n, _actionsThisTurn: t.hero(0, 0)._actionsThisTurn });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
