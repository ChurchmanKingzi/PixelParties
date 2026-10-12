'use strict';
// A03-futuretech-05 · Steam Dwarf Engineer bietet Creatures an, die nicht aus dem Deck beschworen werden dürfen – Karte geht verloren
//
// Kartentext Engineer: „… You may once per turn sacrifice this Creature … to place any Creature from your deck whose max HP is less than
//   or equal to this Creature's current HP into its Support Zone. If that Creature would require additional sacrifices, negate those sacrifices.“
// Kartentext Ifrit (80 HP): „This Creature cannot be summoned from anywhere, except your hand.“
// Erwartung (egal welche Lesart): Entweder wird Ifrit gar nicht erst angeboten (Beschwörungssperre), oder er wird platziert (Damus' „place“ ist
//   ebenfalls keine Beschwörung). Auf keinen Fall verschwindet die Karte: Engineer geopfert, Ifrit weder auf dem Brett noch im Deck.
// Beobachtet: Galerie bietet Ifrit an; `summonCreatureWithHooks` lehnt ab (`summon_blocked` hand_only); Engineer ist geopfert (Ablage), Ifrit ist aus
//   dem Deck entfernt und nirgends mehr (Kartenbilanz −1). Das Log nennt irreführend `no_free_slot`.
// Ursache: cards/effects/steam-dwarf-engineer.js:53/79 + 115 + 129-149: Poolfilter `isSummonablePileCreature` kennt `summonOnlyFromHand` nicht (_hooks.js:642),
//   die Karte wird per `deckEntnahme` entnommen BEVOR die Beschwörung scheitern kann (_engine.js ~15014 `hand_only`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const name of ['Ifrit', 'Slave Trader']) {
    R.section('Engineer holt ' + name);
    const hp = H.DB[name].hp;
    const t = await H.fresh({ deck: [[name, H.INERT.creature, H.INERT.creature], []] });
    const eng = t.put(0, 0, 1, 'Steam Dwarf Engineer', { counters: { maxHp: 150, currentHp: 150 } }); eng.turnPlayed = 1;
    const before = t.census();
    let angeboten = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { angeboten = d.cards.map(c => c.name); return angeboten.includes(name) ? { cardName: name } : null; }, once: true });
    t.phase(2);
    await t.activateCreature(0, 0, 1);
    const diff = t.censusDiff(before, t.census());
    const aufBrett = [0, 1, 2].some(s => t.zone(0, 0, s) === name);
    R.check(`${name} (${hp} HP) wird nicht angeboten ODER landet auf dem Brett`, angeboten === null || !angeboten.includes(name) || aufBrett, { angeboten, brett: [0, 1, 2].map(s => t.zone(0, 0, s)) });
    R.check('keine Karte geht verloren (außer dem geopferten Engineer, der in der Ablage liegt)', diff.every(d => !/^(Ifrit|Slave Trader):/.test(d)), diff);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
