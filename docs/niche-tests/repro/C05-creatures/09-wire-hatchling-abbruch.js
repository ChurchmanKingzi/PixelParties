'use strict';
// C05-creatures-09 · Wire Hatchling: Einsatz-Zielwahl (UMGESTELLT in Welle 12 auf die neue Regel von Al, Q86)
// Kartentext: „When you summon this Creature, choose any target on the board and deal damage to it equal to half its current HP (rounded up)."
// ALTE Regel (Regel 23.9, Stufe C): Abbruch → Karte zurück auf die Hand, Aktion erstattet.
// NEUE Regel (Al, Welle 12, Q86): „Wire Hatchlings Zielwahl sollte überhaupt nicht abbrechbar sein! Sobald er in einer Zone liegt, MUSS man ein Ziel
//   wählen, man kommt da nicht raus." → Pflichtwahl (`cancellable: false`); die Beschwörung wird nie zurückgenommen. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Wire Hatchling', H.INERT.filler], []] });
  let cfg = null;
  t.targetFn = (valid, config) => { cfg = config; return null; };
  const r = await t.play(0, 'Wire Hatchling', { hero: 0 });
  R.check('Spielweg behandelt', r === true, r);
  R.check('Zielwahl ist Pflicht (nicht abbrechbar)', cfg && cfg.cancellable === false, cfg && cfg.cancellable);
  R.check('Beschwörung wird nie zurückgenommen: Kreatur auf dem Brett', !!t.find('Wire Hatchling', 'support'), t.zone(0, 0, 0));
  R.check('Karte nicht auf der Hand', !t.pile(0, 'hand').includes('Wire Hatchling'), t.pile(0, 'hand'));
  R.check('Aktion verbraucht', (t.gs.players[0].heroesActedThisTurn || []).length === 1, t.gs.players[0].heroesActedThisTurn);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
