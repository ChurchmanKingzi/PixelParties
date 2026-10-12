'use strict';
// A07-03 · Cardinal Beast Baihu: eine „versteinerte" Kreatur ist NICHT betäubt – sie darf weiter aktivieren
//
// Kartentext Baihu: „This Creature is unaffected by all cards and effects. You may once per turn choose a target your
//   opponent controls and Stun it for 3 turns. A target Stunned by this effect takes no damage from any sources. …"
//
// Erwartung: Eine von Baihu betäubte Kreatur ist wie jede betäubte Kreatur stillgelegt (kein aktiver Effekt, keine
//   Passiv-Hooks, `counters.stunned`), zusätzlich schadensimmun.
// Beobachtet: Baihu schreibt für Kreaturen nur `_baihuStunned`/`_baihuPetrify` (cardinal-beast-baihu.js:105-108),
//   nie `counters.stunned` und geht an `applyCreatureStatus` vorbei. `isCreatureEffectSuppressed` (_engine.js:18819)
//   und der Server (doActivateCreatureEffect) lesen aber nur `stunned/negated/nulled/frozen/magic_silenced`.
//   → Die versteinerte Kreatur nutzt ihren aktiven Effekt im eigenen Zug ganz normal. Nebenbefund: ein Ziel mit
//   `stun_immune` wird trotzdem schadensimmun gemacht (Baihu prüft keine Status-Immunität).
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const t = await H.fresh({ deckSize: 30 });
  const baihu = t.put(0, 0, 0, 'Cardinal Beast Baihu'); baihu.turnPlayed = 1;
  const drag = t.put(1, 0, 0, 'Dragolfin'); drag.turnPlayed = 1;     // aktiver Effekt: Schaden = 10 × ⌈Deck/2⌉
  const immun = t.put(1, 0, 1, H.INERT.creature, { counters: { stun_immune: 1 } }); immun.turnPlayed = 1;

  t.targetFn = (v) => [v.find(x => x.cardName === 'Dragolfin').id];
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Vorbedingung: Dragolfin trägt den Baihu-Marker', !!drag.counters._baihuStunned, drag.counters);
  R.check('versteinerte Kreatur trägt das Stunned-Flag', !!drag.counters.stunned, drag.counters);

  await t.endTurn();                                               // Zug 6: Sitz 1
  t.gs.activePlayer = 1; t.phase(2);
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
  const hp0 = t.hp(0, 0);
  const r = await t.activateCreature(1, 0, 0);
  R.check('betäubte Dragolfin darf ihren aktiven Effekt NICHT einsetzen', r === false && t.hp(0, 0) === hp0, { activate: r, verloreneHP: hp0 - t.hp(0, 0) });

  // Nebenbefund: stun_immune-Ziel
  t.gs.activePlayer = 0; t.gs.turn = 7; t.phase(2);
  t.gs.hoptUsed = {};
  t.targetFn = (v) => [v.find(x => x.cardInstance && x.cardInstance.id === immun.id).id];
  await t.activateCreature(0, 0, 0);
  R.check('Ziel mit stun_immune wird NICHT versteinert (Stun haftet nicht → kein „takes no damage")', !immun.counters._baihuStunned && !immun.counters._baihuPetrify, immun.counters);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
