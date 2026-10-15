// W11b · Q56 (A08-22) · "Bloom", the Continent Corruptor + Bloom, the Maniacal Botanist
// Al: „Die Giftheilung heilt den vollen Wert, inklusive Paraseed-Boni."
// Erwartung: Heilung = Grundschaden (30) + Continent-Aura (+100, auch auf sich selbst) + Maniacal (+50 je Paraseed);
//   beide Heldenreihenfolgen rechnen gleich. Ohne Maniacal: 130. Exit 0 = korrekt.
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
    return { heal: t.hero(1, ci).hp - 100, err: t.errors.length, aud: t.audit().length };
  }
  for (const n of [1, 2]) {
    const a = await lauf(['C', 'B', 'Z'], n), b = await lauf(['B', 'C', 'Z'], n), c = await lauf(['B', 'Z', 'C'], n);
    const soll = 30 + 100 + 50 * n;
    R.check(`${n} Paraseed(s): [C,B] heilt ${soll}`, a.heal === soll, a.heal);
    R.check(`${n} Paraseed(s): [B,C] heilt ${soll}`, b.heal === soll, b.heal);
    R.check(`${n} Paraseed(s): [B,Z,C] heilt ${soll}`, c.heal === soll, c.heal);
    R.check('keine Engine-/Audit-Fehler', a.err + b.err + c.err + a.aud + b.aud + c.aud === 0);
  }
  const o = await lauf(['C', 'Z', 'Z'], 1);
  R.check('ohne Maniacal: 30 + 100 = 130', o.heal === 130, o.heal);
  R.finish();
})();
