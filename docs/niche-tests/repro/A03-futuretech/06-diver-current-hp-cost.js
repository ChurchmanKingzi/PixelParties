'use strict';
// A03-futuretech-06 · Steam Dwarf Diver: zahlt nur MAX-HP, aktuelle HP werden bloß auf das neue Maximum gestutzt
//
// Kartentext: „You may once per turn reduce this Creature's current and max HP by 100 to search your deck for a card, reveal it and add it to your hand.“
// Vergleich: Rha'Bi (rha-bi-the-living-skeleton.js:240-249) und Gobbo (gobbo-chief-of-goblin.js:108-120) setzen für denselben Wortlaut ausdrücklich
//   „aktuelle HP − Betrag" (Befund 20.9.: „Der Kartentext verlangt BEIDES“); `decreaseMaxHp` allein stutzt nur.
// Erwartung: Diver mit 200 max / 150 aktuell zahlt 100 → 100 max / 50 aktuell.
// Beobachtet: 100 max / 100 aktuell (aktuell wurde nur auf das neue Maximum gestutzt, 50 statt 100 bezahlt). Bei 200/80 bleibt er mit 80 HP
//   am Leben (Text: −20 → besiegt).
// Ursache: cards/effects/steam-dwarf-diver.js:88 → _steam-dwarf-shared.js `decreaseCreatureMaxHp` (Klemme `if (curHp > newMax)`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [max, cur, erwMax, erwCur] of [[200, 200, 100, 100], [200, 150, 100, 50]]) {
    const t = await H.fresh({ deck: [['Future Tech Gun', H.INERT.creature], []] });
    const d = t.put(0, 0, 1, 'Steam Dwarf Diver', { counters: { maxHp: max, currentHp: cur } }); d.turnPlayed = 1;
    t.script.push({ match: dd => dd.type === 'cardGallery', answer: () => ({ cardName: 'Future Tech Gun' }), once: true });
    t.phase(2);
    await t.activateCreature(0, 0, 1);
    R.check(`Diver ${max}/${cur}: Karte gesucht`, t.pile(0, 'hand').includes('Future Tech Gun'));
    R.check(`Diver ${max}/${cur} → max ${erwMax} / aktuell ${erwCur}`, d.counters.maxHp === erwMax && d.counters.currentHp === erwCur, { max: d.counters.maxHp, aktuell: d.counters.currentHp });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
