// H02-heroes-23 · Junshi (gefroren/betäubt): die Stufensenkung der Magic-Arts-Zauber auf der Hand gilt weiter
//
// Kartentext Junshi: „Magic Arts Spells in your hand have their levels reduced by the number of Creatures you control."
// Konvention (`_isHeroEffectSilenced`, _engine.js ~6446): gefrorene (ohne Chilly Dog), betäubte, negierte und tote Helden verlieren ihre Heldeneffekte.
// Das Skript prüft in `heldWirkt` nur `hp > 0` und `statuses.negated` (Kommentar: „jede Form der Negation legt den Effekt still").
// Aufbau: Junshi auf Held 0, 1 eigene Kreatur; Held 1 (ohne Schulen) soll den Magic-Arts-Zauber „Detection" (Lv 1; Gegner hat eine Surprise) wirken – nur mit der Senkung auf Lv 0 spielbar.
// Erwartung: gefroren/betäubt → nicht spielbar. Beobachtung: wird gespielt (negiert/tot: korrekt gesperrt).
// Aufruf: node docs/niche-tests/repro/H02-heroes/23-junshi-gefroren-senkt-weiter.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const JU = 'Junshi, the Tactical Genius';
(async () => {
  const R = H.runner();
  async function spielbar(status) {
    const t = await H.fresh({ heroes: [[JU, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Detection'], []] });
    t.put(0, 0, 0, H.INERT.creature); t.putSurprise(1, 0, 'Frost Rune');
    if (status) t.heroStatus(0, 0, status);
    const r = await t.play(0, 'Detection', { hero: 1, noGrant: true });
    return r === true && t.pile(0, 'discardPile').includes('Detection');
  }
  R.check('Kontrolle: Junshi ohne Status senkt (Detection spielbar)', await spielbar(null) === true);
  for (const st of ['frozen', 'stunned', 'negated']) R.check(`Junshi ${st}: Detection NICHT spielbar`, await spielbar(st) === false);
  R.finish();
})();
