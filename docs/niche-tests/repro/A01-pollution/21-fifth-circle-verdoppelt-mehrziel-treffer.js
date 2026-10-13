'use strict';
// A01-pollution-21 · The Fifth Circle of Hell: „the next damage that EXACTLY 1 target takes" verdoppelt den ersten Helden eines Mehrziel-Treffers
// Kartentext: „When this card is sent to the discard pile or deleted from the board, the next damage that exactly 1 target takes this turn is doubled.
//   You can only activate this effect once per turn.“
// Skriptkopf (the-fifth-circle-of-hell.js): der Stempel `gs._naechsterEinzelschadenX2` gilt „nicht mitten in einem Flächenschlag (`_deferGameOverCheck`)“, d. h. Mehrziel-Treffer
//   sollen den Stempel nicht verbrauchen.
// Aufbau: Fifth Circle liegt in der Area-Zone von Sitz 0; Reality Crack schickt sie in die Ablage (Stempel gesetzt). Danach trifft ein Mehrziel-Zauber die Helden des Gegners.
// Erwartung: bei 2+ getroffenen Zielen wird NICHTS verdoppelt (jeder Held verliert den normalen Schaden), der Stempel bleibt für den nächsten Einzelschaden stehen.
// Beobachtet: der erste getroffene Held erleidet den doppelten Schaden und der Stempel ist verbraucht – bei Pyroblast (2 Helden, 200 statt 100), Flame Avalanche, Forbidden Zone und
//   Chain Lightning (alle Helden-Treffer). Nur bei zwei KREATUREN-Zielen (ein Stapel mit 2 Einträgen) bleibt der Stempel richtig stehen.
// Ursache: cards/effects/_engine.js `_naechsterEinzelschadenVerdoppeln` (~12565) prüft nur `gs._deferGameOverCheck`; der Heldenpfad (`actionDealDamage`, ~8458) ruft sie je Held,
//   der Mehrfachtreffer-Rahmen von `dealDamageToTargets` setzt aber `_multiHitScope` (`beginMultiHit`), nicht `_deferGameOverCheck`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/21-fifth-circle-verdoppelt-mehrziel-treffer.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const arm = async (t) => {
    t.putArea(0, 'The Fifth Circle of Hell');
    t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Reality Crack', answer: () => ({ cancelled: true }) });
    t.policy.confirm = true;
    await t.play(0, 'Reality Crack', { hero: 0 });
  };
  // a) Pyroblast auf zwei Helden
  let t = await H.fresh({ hand: [['Reality Crack', 'Pyroblast'], []] });
  await arm(t);
  R.check('Aufbau: Stempel „nächster Einzelschaden ×2“ ist gesetzt', !!t.gs._naechsterEinzelschadenX2, t.gs._naechsterEinzelschadenX2);
  t.targetFn = (v) => [0, 1].map(i => v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === i).id);
  await t.play(0, 'Pyroblast', { hero: 0 });
  R.check('Pyroblast auf 2 Helden: jeder verliert 100 (nichts verdoppelt)', t.hp(1, 0) === 700 && t.hp(1, 1) === 700, [t.hp(1, 0), t.hp(1, 1)]);
  R.check('Stempel bleibt für einen späteren Einzelschaden stehen', !!t.gs._naechsterEinzelschadenX2, t.gs._naechsterEinzelschadenX2);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  // b) Flächenzauber (alle drei Helden)
  t = await H.fresh({ hand: [['Reality Crack', 'Flame Avalanche'], []] });
  await arm(t);
  await t.play(0, 'Flame Avalanche', { hero: 0 });
  const hps = t.gs.players[1].heroes.map(h => h.hp);
  R.check('Flame Avalanche trifft alle Helden gleich (kein Held doppelt)', hps[0] === hps[1] && hps[1] === hps[2], hps);
  R.finish();
})();
