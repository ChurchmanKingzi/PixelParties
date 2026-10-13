'use strict';
// M01-20 · Experimental Potion: „Choose a target you control" bedient die Brettseite statt des Kontrolleurs
// Kartentext: „Choose a target you control and Poison it for the rest of the game. …"
// Konvention (README §4 Familie 5 / Styx 28.9.): „Kontrolle statt Seite"; Elixir of Recovery macht es richtig (Vergleich im Scratch p03).
// Aufbau A: Sitz 1 hat eine Kreatur X, Sitz 0 stiehlt sie (Besitzer 1, Kontrolleur 0, Brett bleibt Seite 1). Sitz 0 spielt den Trank.
// Aufbau B: Sitz 0 besitzt X, Sitz 1 stiehlt sie (Besitzer 0, Kontrolleur 1, Brett Seite 0). Sitz 0 spielt den Trank.
// Aufbau C: Sitz 1 kontrolliert die gestohlene X (Besitzer 0, Seite 0, Held 0 / Slot 0) UND hat eine eigene Kreatur Y auf Seite 1 an derselben Position (Held 0 / Slot 0).
// Erwartet: A) X wird angeboten; B) X wird NICHT angeboten; C) beide Kreaturen sind wählbar.
// Beobachtet: A) nichts angeboten, B) X wird angeboten, C) nur EINE der beiden wird angeboten (`getCreatureTargets` sucht die Instanz über Position + „Besitzer ODER Kontrolleur" = erste Treffer in `cardInstances`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const offeredFor = async (t, seat) => {
    let offered = [];
    t.targetFn = (valid) => { offered = valid.filter(v => v.type === 'equip').map(v => v.cardInstance ? v.cardInstance.name : v.id); return null; };
    await t.play(seat, 'Experimental Potion');
    return offered;
  };
  {
    const t = await H.fresh({ hand: [['Experimental Potion'], []], hp: 800 });
    const x = t.put(1, 0, 0, H.INERT.creature); await t.engine.actionStealCreature(0, x); delete t.gs._chainResolvingLock;
    const o = await offeredFor(t, 0);
    R.check('A: eine Kreatur, die ich kontrolliere (gestohlen, Brett Seite 1), ist wählbar', o.length === 1, o);
  }
  {
    const t = await H.fresh({ hand: [['Experimental Potion'], []], hp: 800 });
    const x = t.put(0, 0, 0, H.INERT.creature); await t.engine.actionStealCreature(1, x); delete t.gs._chainResolvingLock;
    const o = await offeredFor(t, 0);
    R.check('B: eine Kreatur, die mir gestohlen wurde, ist NICHT wählbar', o.length === 0, o);
  }
  for (const order of ['X zuerst', 'Y zuerst']) {
    const t = await H.fresh({ hand: [[], ['Experimental Potion']], hp: 800 });
    let x, y;
    if (order === 'X zuerst') { x = t.put(0, 0, 0, H.INERT.creature); y = t.put(1, 0, 0, H.INERT.big); }
    else { y = t.put(1, 0, 0, H.INERT.big); x = t.put(0, 0, 0, H.INERT.creature); }
    await t.engine.actionStealCreature(1, x); delete t.gs._chainResolvingLock;
    t.gs.activePlayer = 1;
    const o = await offeredFor(t, 1);
    R.check('C (' + order + '): beide von Sitz 1 kontrollierten Kreaturen sind wählbar', o.length === 2, o);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
