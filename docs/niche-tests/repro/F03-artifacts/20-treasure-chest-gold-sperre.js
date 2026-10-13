'use strict';
// F03-artifacts-20 · Treasure Chest unter der eigenen Gold-Sperre (Golden Arrow): spielbar und vergeudet
// Kartentext: Treasure Chest „Gain 10 Gold." · Golden Arrow „You cannot gain or spend Gold for the rest of the turn afterwards." (setzt `ps.goldLocked`, _arrows-shared.js ~302)
// Regel (Al 17.8., `_gold-block-shared.js` Kopf): „eine Karte, deren einziger Nutzen ein Gold-Gewinn ist, wird gesperrt statt wirkungslos zu feuern – Treasure Chest, Golden Bananas, War Chest …"
// Erwartung: Treasure Chest ist unter `goldLocked` nicht spielbar (bleibt auf der Hand, kein Aktionsverbrauch).
// Beobachtet (✗): Die Karte wird gespielt (Aktion verbraucht, Karte in der Ablage), Gold bleibt 100 – wirkungslos verbrannt.
// Ursache: `cards/effects/treasure-chest.js` `canActivate` ruft `goldGainWouldBeBlocked` (`_gold-block-shared.js` Z. ~84), das nur Tuscan Aristocrat (gegnerische Kreatur) prüft, nicht `ps.goldLocked`;
//   `actionGainGold` bricht dagegen bei `goldLocked` ab (_engine.js ~24065).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Treasure Chest'], []], gold: 100 });
  t.gs.players[0].goldLocked = true;
  const r = await t.play(0, 'Treasure Chest');
  R.check('Treasure Chest ist unter goldLocked nicht spielbar (Karte bleibt auf der Hand)', r === false && t.pile(0, 'hand').includes('Treasure Chest'), { r, hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), gold: t.gs.players[0].gold });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
