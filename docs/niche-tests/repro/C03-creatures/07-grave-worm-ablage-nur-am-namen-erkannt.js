'use strict';
// C03-creatures-07 · Grave Worm: „sent to the discard pile" wird nur am NAMEN in der eigenen Ablage erkannt (Fehlauslösung)
// Kartentext: „When a Creature you control, except "Grave Worm", is defeated and sent to the discard pile while this Creature is in your discard pile, you may summon this
//   Creature into the same Support Zone from your discard pile as an additional Action."
// Fall A (Hell Fox): Hell Fox auf dem Brett wird besiegt – „delete it", er geht in den Gelöscht-Stapel, NICHT in die Ablage. Liegt aber ein anderer Hell Fox in der Ablage
//   (z. B. abgeworfen), fragt der Wurm trotzdem „Hell Fox just hit your discard pile. Summon …?".
// Fall B (geliehene Kreatur): Eine mit Lovely Teddy/Succubus geliehene gegnerische Kreatur stirbt, sie geht in die Ablage ihres BESITZERS. Liegt dieselbe Karte in meiner
//   Ablage, fragt der Wurm ebenfalls und setzt sich in Held/Slot-Nummer der Gegnerseite auf MEINE Seite („the same Support Zone" war eine Zone des Gegners).
// Erwartung: In beiden Fällen keine Rückfrage (die besiegte Karte wurde nicht in meine Ablage gelegt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    R.section('Fall A: Hell Fox stirbt (gelöscht), anderer Hell Fox in der Ablage');
    const t = await H.fresh({ discard: [['Grave Worm', 'Hell Fox'], []], deck: [['Fireball', 'Slow', 'Fireball', 'Slow'], []] });
    t.grantFor(0, 0, 'Grave Worm');
    const fox = t.put(0, 0, 1, 'Hell Fox'); fox.turnPlayed = 1;
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, fox));
    R.note('Rückfragen', t.prompts.map(p => p.d.title));
    R.check('Grave Worm fragt NICHT (Hell Fox wurde gelöscht, nicht abgelegt)', !t.prompts.some(p => p.d.title === 'Grave Worm'), t.prompts.map(p => p.d.title));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    R.section('Fall B: geliehene gegnerische Kreatur stirbt, gleicher Name in MEINER Ablage');
    const t = await H.fresh({ discard: [['Grave Worm', H.INERT.frail], []] });
    t.grantFor(0, 0, 'Grave Worm');
    const x = t.put(1, 2, 2, H.INERT.frail); x.turnPlayed = 1;
    t.engine.actionStealCreature(0, x);
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, x));
    R.note('Ablage Sitz 0 / Sitz 1', [t.pile(0, 'discardPile'), t.pile(1, 'discardPile')]);
    R.note('Brett Sitz 0', t.gs.players[0].supportZones.map(h => h.map(z => z.join('|'))));
    R.check('Grave Worm fragt NICHT (die Karte ging in die Ablage des Gegners)', !t.prompts.some(p => p.d.title === 'Grave Worm'), t.prompts.map(p => p.d.title));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
