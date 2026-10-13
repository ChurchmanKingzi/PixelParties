// A08-22 · "Bloom", the Continent Corruptor: die Heilung durch Gift hängt davon ab, ob Bloom, the Maniacal Botanist VOR oder NACH ihm in der Heldenreihe steht
//
// Kartentexte: Continent: „Damage this Hero would take from Poison is applied as healing instead. Before a Hero with a "Paraseed" in its Support Zones takes Poison damage, increase that Poison's damage by 100."
//              Maniacal:  „Before a Hero with a "Paraseed" Creature in its Support Zones takes Poison damage, increase that Poison's damage by 50 times the number of "Paraseed" Creatures …"
// Aufbau: Sitz 1 hat Continent mit 1 Paraseed (Held trägt Gift) bei 100/500 HP, daneben Bloom, the Maniacal Botanist. Reihenfolge der Helden: [Continent, Bloom] gegen [Bloom, Continent].
//   Echter Zugwechsel zum Gifttick des Sitzes 1.
// Erwartung: Dieselbe Heilung in beiden Reihenfolgen (Hook-Reihenfolge darf das Ergebnis nicht bestimmen, vgl. Kommentar in `_engine.js` ~3970 „Reihenfolge der Listener darf das Ergebnis nicht bestimmen").
// Beobachtet: [Continent, Bloom]: +30 (nur der Grundschaden – Continent storniert den Schaden, bevor Maniacals Aura greift). [Bloom, Continent]: +80 (30 + 50). Mit 2 Paraseeds +30 gegen +130.
//   Zusätzlich greift die eigene +100-Aura des Continent nie auf ihn selbst (der Heil-Zweig kehrt vor der Aura zurück) – ob die Heilung die Auren enthalten soll, sagt der Text nicht (Frage unten).
// Aufruf: node docs/niche-tests/repro/A08-pacman/22-bloom-continent-heilung-haengt-von-heldenreihenfolge-ab.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const { syncAllParaseedPoison } = require('../../../../cards/effects/_paraseed-shared.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const BLOOM = 'Bloom, the Maniacal Botanist', CONT = '"Bloom", the Continent Corruptor';
  async function lauf(order, nPara) {
    const t = await H.fresh({ heroes: [null, order.map(x => x === 'C' ? CONT : x === 'B' ? BLOOM : 'Zwei, the Lucky Thief')], hp: 800, hand: [[], []], deck: [Array(6).fill(F), Array(6).fill(F)] });
    const ci = order.indexOf('C');
    for (let i = 0; i < nPara; i++) { const p = t.put(1, ci, i, 'Paraseed'); p.controller = 0; p.turnPlayed = 1; }
    t.hero(1, ci).hp = 100; t.hero(1, ci).maxHp = 500;
    await t.run(() => syncAllParaseedPoison(t.engine));
    await t.endTurn();
    return { heal: t.hero(1, ci).hp - 100, err: t.errors.length };
  }
  for (const n of [1, 2]) {
    const a = await lauf(['C', 'B', 'Z'], n), b = await lauf(['B', 'C', 'Z'], n);
    R.note(`${n} Paraseed(s): [Continent, Bloom] +${a.heal} · [Bloom, Continent] +${b.heal}`);
    R.check(`${n} Paraseed(s): Heilung unabhängig von der Heldenreihenfolge`, a.heal === b.heal, { CB: a.heal, BC: b.heal });
    R.check('keine Engine-Fehler', a.err === 0 && b.err === 0);
  }
  R.finish();
})();
