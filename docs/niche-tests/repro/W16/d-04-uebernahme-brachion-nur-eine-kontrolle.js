'use strict';
// W16d · d-04 (zu A07-31): „You can only control 1 Gigantisaur Brachion" gilt auch bei der Übernahme - zeitweiliger Diebstahl
// (`actionStealCreature`) und dauerhafte Übernahme (`actionTransferCreature`) werden abgewiesen, eine andere Kreatur geht weiter.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  t.put(0, 0, 0, 'Gigantisaur Brachion');
  const feind = t.put(1, 0, 0, 'Gigantisaur Brachion');
  const anderer = t.put(1, 1, 0, H.INERT.creature);
  const stehl = await t.run(() => t.engine.actionStealCreature(0, feind));
  R.check('Diebstahl des zweiten Brachion wird abgewiesen', !stehl && feind.stolenBy == null && (feind.controller ?? feind.owner) === 1, { stehl, ctrl: feind.controller });
  const tr = await t.run(() => t.engine.actionTransferCreature(feind, 0, 1, 0));
  R.check('dauerhafte Übernahme des zweiten Brachion wird abgewiesen', !(tr && tr.success), tr);
  const stehl2 = await t.run(() => t.engine.actionStealCreature(0, anderer));
  R.check('Kontrolle: eine andere Kreatur lässt sich weiter stehlen', !!stehl2 && anderer.stolenBy === 0, { stehl2 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
