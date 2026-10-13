// A08-23 · Paraseed: bei gefrorener/betäubter/negierter Kreatur gilt nur ein Teil ihres Textes weiter (Gift bleibt, Max-HP-Fraß und Einnisten fallen weg)
//
// Kartentext: „When this Creature is defeated by a Hero or Creature, place it into one of the attacking or corresponding Hero's free Support Zones instead of sending it to the discard pile.
// While this Creature is in a Hero's Support Zone, that Hero is Poisoned. Damage that Hero takes from Poison reduces its current and max HP. That Hero's Poison cannot be healed, but it is removed
// when this Creature leaves the Hero's Support Zone."
// Aufbau: Sitz 1 hat Paraseed in der Support Zone von Held 0 (800 HP); die Kreatur ist (a) normal, (b) gefroren, (c) betäubt, (d) negiert. Echter Zugwechsel → Gifttick.
// Konvention der Engine (B-querschnitt B-01…B-03, `isCreatureEffectSuppressed`): Eine gefrorene/betäubte/negierte Kreatur verliert ihre Effekte.
// Erwartung: entweder gilt der ganze Text (Gift + Max-HP-Fraß) oder keiner (kein Gift, kein Fraß).
// Beobachtet: normal: Held 800 → 770/770. gefroren/betäubt/negiert: Held bleibt vergiftet und verliert 30 HP (770), aber die Max-HP bleiben 800 (Fraß fällt weg);
//   außerdem nistet sich die stillgelegte Paraseed beim Tod nicht mehr ein (Ablage). Das Gift hängt am Zonen-Abgleich `syncParaseedPoison` (_paraseed-shared.js ~Z. 82-130), der den Status der Kreatur nicht liest;
//   der Max-HP-Fraß und das Einnisten laufen über Hooks, die der zentrale Verteiler für stillgelegte Kreaturen sperrt.
// Aufruf: node docs/niche-tests/repro/A08-pacman/23-paraseed-gift-bei-stillgelegter-kreatur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const { syncAllParaseedPoison } = require('../../../../cards/effects/_paraseed-shared.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  for (const mode of ['normal', 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ hp: 800, hand: [[], []], deck: [Array(10).fill(F), Array(10).fill(F)] });
    const p = t.put(1, 0, 0, 'Paraseed'); p.controller = 0; p.turnPlayed = 1;
    if (mode === 'negated') await t.run(() => t.engine.actionNegateCreature(p, 'Test'));
    else if (mode !== 'normal') await t.run(() => t.engine.applyCreatureStatus(p, mode, { sourceOwner: 0 }));
    await t.run(() => syncAllParaseedPoison(t.engine));
    const h = t.hero(1, 0);
    await t.endTurn();
    const vergiftet = !!h.statuses.poisoned, gift = 800 - h.hp, fraß = 800 - h.maxHp;
    R.note(mode, JSON.stringify({ hp: h.hp, maxHp: h.maxHp, vergiftet }));
    if (mode === 'normal') R.check('normal: Gift 30 und Max-HP-Fraß 30', gift === 30 && fraß === 30, { gift, fraß });
    else R.check(`${mode}: Gift und Max-HP-Fraß gehören zusammen (beide aus oder beide an)`, (gift > 0) === (fraß > 0), { gift, fraß });
    R.check(`${mode}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
