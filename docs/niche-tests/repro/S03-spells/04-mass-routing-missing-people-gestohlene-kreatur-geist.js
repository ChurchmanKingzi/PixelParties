'use strict';
// S03-04 · Mass Routing / Missing People: gestohlene Kreatur → Geisterkarte im Slot + Duplikat im Deck
// Kartentext Mass Routing: „Shuffle all Creatures on the board up to level 1/2/3 back into their original owners' decks."
// Kartentext Missing People: „Choose a Creature your opponent controls and place it at the bottom of their deck."
// Vorbild: A05-03 (Dive Bomblebee) – dieselbe Fehlerklasse: das Skript nimmt den Namen aus der Zone des KONTROLLEURS, die gestohlene Kreatur
//   steht physisch aber in der Zone ihres Besitzers (`physicalSide`, `actionStealCreature` bewegt nichts).
// Aufbau: Sitz 1 besitzt zwei Kreaturen in Held 0 (Slot 0, Slot 1); Sitz 0 stiehlt die in Slot 0 (`actionStealCreature(0, inst)`).
//   (a) Mass Routing (Decay Magic 1, Kreatur Level 1)  (b) Missing People, Ziel = die gestohlene Kreatur (wird angeboten, weil sie physisch bei Sitz 1 steht).
// Erwartet: Karte verlässt das Brett vollständig: Slot leer, Instanz weg, genau EINE Kopie im Deck des Besitzers; Kartenbilanz ±0.
// Beobachtet: Der Name bleibt in `players[1].supportZones[0][0]` (Instanz getilgt, `audit`: „0 Instanzen"), zusätzlich liegt eine Kopie im Deck ⇒ Bilanz +1.
const H = require('../../lib/h.js');
function lvl(t, n, level) { const d = Object.assign({}, H.DB['ZZ Dummy'], { name: n, level }); H.DB[n] = d; t.engine._getCardDB()[n] = d; }
(async () => {
  const R = H.runner();
  {
    R.section('a) Mass Routing mit gestohlener Kreatur');
    const t = await H.fresh({ hand: [['Mass Routing'], []], deckSize: 5 });
    lvl(t, 'ZZ L1', 1);
    const x = t.put(1, 0, 0, 'ZZ L1');
    await t.engine.actionStealCreature(0, x); await H.sleep(80);          // Hook läuft asynchron – kurz warten
    t.setAbilities(0, 0, [['Decay Magic'], [], []]);
    const c0 = t.census();
    const r = await t.play(0, 'Mass Routing', { hero: 0, noGrant: true });
    const diff = t.censusDiff(c0, t.census()).filter(s => s.startsWith('ZZ L1'));
    R.check('Mass Routing gespielt', r === true, r);
    R.check('Slot des Besitzers ist leer (keine Geisterkarte)', t.gs.players[1].supportZones[0][0].length === 0, t.gs.players[1].supportZones[0]);
    R.check('Kartenbilanz „ZZ L1" ±0', diff.length === 0, diff);
    R.check('audit sauber', t.audit().length === 0, t.audit());
  }
  {
    R.section('b) Missing People auf eine selbst gestohlene Kreatur');
    const t = await H.fresh({ hand: [['Missing People'], []], deckSize: 5 });
    const s = t.put(1, 0, 0, 'ZZ Dummy Big'); t.put(1, 0, 1, 'ZZ Dummy');
    await t.engine.actionStealCreature(0, s); await H.sleep(80);
    t.targetFn = (valid) => { const v = valid.find(q => q.cardName === 'ZZ Dummy Big'); return v ? [v.id] : null; };
    const c0 = t.census();
    const r = await t.play(0, 'Missing People', { hero: 0 });
    const diff = t.censusDiff(c0, t.census()).filter(s2 => s2.startsWith('ZZ Dummy Big'));
    R.check('Missing People gespielt', r === true, r);
    R.check('Die gestohlene (= von mir kontrollierte) Kreatur ist KEIN legales Ziel („your opponent controls")', t.targets.every(q => !q.valid.some(v => v.cardName === 'ZZ Dummy Big')), t.targets.map(q => q.valid.map(v => v.cardName)));
    R.check('Slot des Besitzers ist leer (keine Geisterkarte)', t.gs.players[1].supportZones[0][0].length === 0, t.gs.players[1].supportZones[0]);
    R.check('Kartenbilanz „ZZ Dummy Big" ±0', diff.length === 0, diff);
    R.check('audit sauber', t.audit().length === 0, t.audit());
  }
  R.finish();
})();
