'use strict';
// W16b · A03-futuretech-25 (Erweiterung) · Kent: Kredit UND Aktionssperre folgen dem KONTROLLEUR des Helden
// Kartentext: „If you spend Gold … you may spend up to 20 Gold more than you own … While your Gold is negative, you cannot perform Actions" (sinngemäß; `blocksActions`)
// Aufbau: Kent bei Sitz 0, Sitz 1 übernimmt ihn. Sitz 1 hat −10 Gold: gesperrt (Kent ist sein Held). Sitz 0 (Besitzer) mit −10 Gold ist NICHT gesperrt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const KENT = 'Kent, the Indebted Apprentice';
  const t = await H.fresh({ gold: [50, 50] });
  t.setHero(0, 0, KENT, 400);
  await t.run(() => t.engine.actionStealHero(1, 0, 0));
  t.gs.players[1].gold = -10; t.gs.players[0].gold = -10;
  R.check('Sitz 1 (Kontrolleur) ist durch Kents Sperre blockiert', t.engine.areActionsBlocked(1) === true, t.engine.areActionsBlocked(1));
  R.check('Sitz 0 (Besitzer) ist nicht blockiert', t.engine.areActionsBlocked(0) === false, t.engine.areActionsBlocked(0));
  R.check('Kredit: Sitz 1 darf 20 Gold mehr ausgeben, als er hat', t.engine.goldOverdraftLimit(1) === 20 && t.engine.goldOverdraftLimit(0) === 0, [t.engine.goldOverdraftLimit(0), t.engine.goldOverdraftLimit(1)]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
