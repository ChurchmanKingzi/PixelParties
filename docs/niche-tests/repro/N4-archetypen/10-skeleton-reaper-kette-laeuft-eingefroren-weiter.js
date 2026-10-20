'use strict';
// N4-archetypen-10 · Skeleton Reaper: die „use this effect again"-Kette läuft weiter, obwohl die Reaper mitten in der Kette eingefroren wurde
// Kartentext (Skeleton Reaper): „You may once per turn choose a Creature your opponent controls and deal 50 damage to it. If this damage defeats that Creature, you may immediately use this effect again."
// Kartentext (Mischief Militia - Heli Troopers): „When this Creature is defeated, you may choose a target on the board and Freeze it for 1 turn."
// Regel (CARD_API Welle 7, Al): Gefroren/betäubt/negiert unterbrechen alle laufenden Effekte der Karte; ein gefrorenes Skelett kann seinen Effekt nicht benutzen (`isCreatureEffectSuppressed`).
// Aufbau: Sitz 0: Skeleton Reaper. Sitz 1: Heli Troopers + zwei Kreaturen mit 10 HP. Sitz 1 friert beim Tod der Troopers die Reaper ein.
// Erwartung: Die Reaper tötet die Troopers, ist danach gefroren → „use this effect again" ist nicht mehr möglich; die beiden anderen Kreaturen bleiben am Leben.
// Beobachtet: `onCreatureEffect` (skeleton-reaper.js) schleift `while (true)` ohne erneut die Unterdrückung (gefroren/negiert/betäubt) zu prüfen → beide weiteren Kreaturen sterben.
// Gegenprobe: Ohne Frost (Sitz 1 wählt einen anderen Helden zum Einfrieren) läuft die Kette über alle drei Kreaturen (legal).
const H = require('../../lib/h.js');
async function lauf(friereReaper) {
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30 });
  const r = t.put(0, 0, 0, 'Skeleton Reaper'); r.turnPlayed = 1;
  const h = t.put(1, 0, 0, 'Mischief Militia - Heli Troopers'); h.turnPlayed = 1;
  const x = t.put(1, 1, 0, H.INERT.frail); x.turnPlayed = 1;
  const y = t.put(1, 1, 1, H.INERT.frail); y.turnPlayed = 1;
  t.targetFn = (valid, cfg) => {
    if (cfg?.title === 'Mischief Militia - Heli Troopers') {
      return [friereReaper ? valid.find(v => v.cardName === 'Skeleton Reaper').id : valid.find(v => v.type === 'hero' && v.owner === 1).id];
    }
    return [(valid.find(v => v.cardName === 'Mischief Militia - Heli Troopers') || valid.find(v => v.cardName === H.INERT.frail)).id];
  };
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  const tot = t.pile(1, 'discardPile').length;
  return { t, tot, gefroren: !!r.counters.frozen };
}
(async () => {
  const R = H.runner();
  const k = await lauf(false);
  R.check('Gegenprobe (Troopers frieren einen Helden ein): Kette tötet alle 3 Kreaturen', k.tot === 3 && !k.gefroren, k.tot);
  const f = await lauf(true);
  R.check('Aufbau: die Reaper wurde mitten in der Kette eingefroren', f.gefroren, f.gefroren);
  R.check('gefrorene Reaper darf den Effekt nicht „erneut" nutzen: höchstens die Troopers sind tot (1)', f.tot === 1, f.tot);
  R.check('keine Engine-Fehler', f.t.errors.length === 0, f.t.errors);
  R.finish();
})();
