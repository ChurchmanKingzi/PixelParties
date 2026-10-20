'use strict';
// N5-05 · Cute Wings: „Equip this card to a Hero you control. All Creatures that Hero summons count as "Cute" Creatures."
// Cute Conversion: „This Spell's level in your hand is reduced by the number of "Cute" Creatures you control."
// Das Wings-Skript erklärt, dass Kreaturen in der Support Zone des Wings-Trägers über `isCuteCreatureInst` als Cute zählen (Board-Lesart; Pink Sky nutzt sie, Q24: „Der Name zählt").
// Cute Conversion zählt dagegen nur `isCuteCreatureCard(cd)` (Name) — eine Dummy-Kreatur im Wings-Helden senkt die Stufe nicht.
// Erwartet: Held mit Magic Arts 1, auf dem Brett Held 1 mit Cute Wings + Dummy-Kreatur → Cute Conversion (Stufe 2) wird auf 1 gesenkt und ist spielbar (Gegenprobe: Kreatur mit „Cute" im Namen senkt ✓; Dummy ohne Wings senkt nicht ✓).
// Aufruf: node docs/niche-tests/repro/N5-sonstige/05-cute-wings-zaehlt-bei-cute-conversion-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    const FAELLE = [
      ['Brett leer', () => {}, false],
      ['Kreatur mit „Cute" im Namen (Gegenprobe)', (t) => t.put(seat, 1, 0, 'Cute Bunny'), true],
      ['Dummy-Kreatur ohne Wings (Gegenprobe)', (t) => t.put(seat, 1, 0, H.INERT.creature), false],
      ['Dummy-Kreatur im Helden mit Cute Wings', (t) => { t.put(seat, 1, 0, H.INERT.creature); t.put(seat, 1, 1, 'Cute Wings'); }, true],
    ];
    for (const [name, aufbau, sollSpielbar] of FAELLE) {
      const hand = [[], []]; hand[seat] = ['Cute Conversion'];
      const t = await H.fresh({ active: seat, hand });
      t.setAbilities(seat, 0, [['Magic Arts'], [], []]);   // Magic Arts 1, der Zauber braucht 2
      aufbau(t);
      t.put(opp, 0, 0, H.INERT.creature);
      const r = await t.play(seat, 'Cute Conversion', { hero: 0, noGrant: true });
      const gespielt = r === true && !t.pile(seat, 'hand').includes('Cute Conversion');
      R.check(`Sitz ${seat} · ${name}: Cute Conversion ${sollSpielbar ? 'spielbar' : 'nicht spielbar'}`, gespielt === sollSpielbar, { r });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
