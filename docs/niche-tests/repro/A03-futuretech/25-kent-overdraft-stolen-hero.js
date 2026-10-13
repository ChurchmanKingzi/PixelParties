'use strict';
// A03-futuretech-25 · Kent, the Indebted Apprentice: der Kreditrahmen bleibt beim Besitzer, wenn der Gegner Kent übernimmt
//
// Kartentext: „If **you** spend Gold on a card or effect while you have 0 or more Gold, you may spend up to 20 Gold more than you own, going into negative Gold. …“
// Regel: CARD_API.md Z. ~18862 „Übernommene Helden gelten als Helden des Kontrolleurs": „you/your“ = Kontrolleur (… Gold …) für die Dauer der Übernahme.
// Erwartung: Wird Kent von Sitz 1 übernommen (`actionStealHero`), gilt der Kredit für Sitz 1 (20), nicht mehr für Sitz 0 (0).
// Beobachtet: `engine.goldOverdraftLimit(0)` bleibt 20, `goldOverdraftLimit(1)` bleibt 0 – der Besitzer behält den Kredit des Helden, den er gerade nicht kontrolliert.
// Ursache: `_engine.js` ~24227 `goldOverdraftLimit(playerIdx)` iteriert `gs.players[playerIdx].heroes` (physische Seite) und fragt `heroSideOf` nicht; ebenso kentAlive/blocksActions in kent-the-indebted-apprentice.js.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const KENT = 'Kent, the Indebted Apprentice';
  const t = await H.fresh({ gold: [50, 50] });
  t.setHero(0, 0, KENT, 400);
  R.check('Kontrolle: vor der Übernahme hat Sitz 0 den Kredit', t.engine.goldOverdraftLimit(0) === 20 && t.engine.goldOverdraftLimit(1) === 0, { l0: t.engine.goldOverdraftLimit(0), l1: t.engine.goldOverdraftLimit(1) });
  await t.run(() => t.engine.actionStealHero(1, 0, 0));
  R.check('Kent steht unter Kontrolle von Sitz 1', t.engine.heroSideOf(0, t.hero(0, 0)) === 1, { side: t.engine.heroSideOf(0, t.hero(0, 0)) });
  R.check('nach der Übernahme: Kredit gehört dem Kontrolleur (Sitz 1 = 20, Sitz 0 = 0)', t.engine.goldOverdraftLimit(1) === 20 && t.engine.goldOverdraftLimit(0) === 0, { l0: t.engine.goldOverdraftLimit(0), l1: t.engine.goldOverdraftLimit(1) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
