'use strict';
// A07-10 · Guardian Beasts Hou/She/Long/Ji/Gou: „targets on the board" umfasst Ausrüstung (und andere Nicht-Kreaturen)
//
// Kartentexte (Hou): „… delete total cards … up to the number of targets on the board to choose the same number of
//   targets on the board and deal 50 damage to them." (She/Long/Ji/Gou entsprechend mit Poison/Burn/Stun/Schutz)
// Konvention (CARD_API.md ~Z. 7929, Kohta): „Zielmenge: Helden UND Kreaturen beider Seiten („any target on the board" schließt
//   eigene ein). Artefakte, Abilities und Surprises sind NICHT dabei." Alle anderen „choose a target"-Kreaturen der Gruppe
//   (Dragolfin, Red Dragoneer, Chimera, Stomp …) fragen über `promptDamageTarget` nur ['hero','creature'].
// Beobachtet: `buildAllBoardTargets` (_guardian-beasts-shared.js:465) liefert JEDE offene Support-Karte (Typ 'equip').
//   Folgen: Hou schreibt 50 Schaden auf eine Ausrüstung (`counters.currentHp = -50`, die Ausrüstung bleibt liegen);
//   die Zielzahl („number of targets on the board") ist um Ausrüstung aufgebläht; Long zählt die Brandmarke auf einer
//   Ausrüstung zur Obergrenze „not more than 3 targets can be Burned" (`countBurnedTargets`), obwohl sie nie tickt.
const H = require('../../lib/h.js');
const F = H.INERT.filler;

(async () => {
  const R = H.runner();

  R.section('Hou');
  let t = await H.fresh({ discard: [Array(5).fill(F), []], deckSize: 10 });
  let hou = t.put(0, 0, 0, 'Guardian Beast Hou'); hou.turnPlayed = 1;
  let eq = t.put(1, 0, 0, 'Charm of Balance');
  let angeboten = [];
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => ({ selectedIndices: [0], selectedCards: [d.cards[0].name] }) });
  t.targetFn = (v) => { angeboten = v.map(x => x.cardName); const e = v.find(x => x.cardName === 'Charm of Balance'); return [e ? e.id : v[0].id]; };
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Ausrüstung wird nicht als Ziel angeboten', !angeboten.includes('Charm of Balance'), angeboten);
  R.check('Ausrüstung hat keine HP-Zähler bekommen', eq.counters.currentHp === undefined, eq.counters);

  R.section('Long: Brandmarke auf Ausrüstung zählt zur 3er-Obergrenze');
  t = await H.fresh({ discard: [Array(5).fill(F), []], deckSize: 10 });
  const long = t.put(0, 0, 0, 'Guardian Beast Long'); long.turnPlayed = 1;
  for (let s = 0; s < 3; s++) t.put(1, 0, s, 'Charm of Balance').counters.burned = 1;      // 3 Ausrüstungen, "verbrannt"
  t.gs.activePlayer = 0; t.phase(2);
  let kannLong = null;
  const script = H.loadCardEffect('Guardian Beast Long');
  kannLong = script.canActivateCreatureEffect(t.engine._createContext(long, { event: 'canCreatureEffectCheck' }));
  R.check('Long bleibt aktivierbar, obwohl nur Ausrüstung (kein Held/keine Kreatur) brennt', kannLong === true, { kannLong });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
