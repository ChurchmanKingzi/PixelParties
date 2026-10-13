'use strict';
// C05-creatures-09 · Wire Hatchling: Abbruch der Einsatz-Zielwahl lässt die Kreatur auf dem Brett (Aktion verbraucht, Karte nicht auf der Hand)
// Kartentext: „When you summon this Creature, choose any target on the board and deal damage to it equal to half its current HP (rounded up)."
// Regel 23.9 (CARD_API.md Z. 367-392): „Zielende Attacks/Spells/Creature Effects sollten immer abbrechbar sein. … Abbruch heißt: nichts ist passiert.
//   Die Karte bleibt auf der Hand, die Aktion wird erstattet, der Gegner hat nichts gesehen."
// Beobachtet (Mensch bricht die Zielwahl mit `null` ab): Die Kreatur steht auf dem Brett, die Hand hat sie nicht mehr, die Aktion des Helden ist verbraucht,
//   es entsteht kein Schaden. (Die Zielwahl ist `cancellable: true` – der Abbruch wird also angeboten, bedeutet aber nur „kein Effekt", nicht „Karte nicht gespielt".)
// Einordnung: Stufe C – bewusste Frage. Die Vorrunde nannte „500 Piranhas in a Monster Suit" als Gegenbeispiel; dort ist die Wahl aber ein SPIELKOSTEN-Schritt
//   in `beforeSummon` (Opfer wählen, um die Karte zu spielen), kein Effekt nach dem Landen – nicht vergleichbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Wire Hatchling', H.INERT.filler], []] });
  t.targetFn = () => null;                                        // „Abbrechen"-Knopf eines Menschen
  const r = await t.play(0, 'Wire Hatchling', { hero: 0 });
  R.check('Spielweg behandelt', r === true, r);
  R.check('Regel 23.9 wörtlich: Karte zurück auf der Hand', t.pile(0, 'hand').includes('Wire Hatchling'), { hand: t.pile(0, 'hand'), brett: t.zone(0, 0, 0) });
  R.check('Regel 23.9 wörtlich: Kreatur nicht auf dem Brett', !t.find('Wire Hatchling', 'support'), t.zone(0, 0, 0));
  R.check('Regel 23.9 wörtlich: Aktion erstattet', (t.gs.players[0].heroesActedThisTurn || []).length === 0, t.gs.players[0].heroesActedThisTurn);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
