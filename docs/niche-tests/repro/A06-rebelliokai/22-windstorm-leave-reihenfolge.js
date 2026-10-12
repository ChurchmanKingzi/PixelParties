'use strict';
// A06-rebelliokai-22 · Tengu Windstorm feuert onCardLeaveZone VOR dem Entfernen der Karte: Zustandslisten (Bishop [B]) rechnen mit der schon gegangenen Karte
// Kartentexte: Bishop of Kings [B]: „While you control at least 1 "Knight of Kings" and "Board of Kings" is on the board, the effects of all Heroes your
//   opponent controls are negated." · Tengu Windstorm: „…place it on top or bottom of its controller's deck."
// Beobachtung: `_bounceToDeck` (tengu-windstorm.js) ruft `runHooks('onCardLeaveZone', …)` und nimmt die Karte erst danach per `_removeCardFromState` vom Brett.
//   Alle anderen Entfernungswege (removeArea/deleteArea, Tod, Sculpture Theft) haben die Karte beim Leave-Hook schon aus der Zone/dem Bereich genommen.
//   Bishop [B] gleicht in seinem `onCardLeaveZone` ab und sieht Knight bzw. Board noch auf dem Brett → die Gegner-Helden bleiben negiert, bis der nächste
//   Zugbeginn/Zugende den Abgleich nachholt.
// Erwartung: nach dem Bounce von Board of Kings bzw. Knight of Kings sind die Gegner-Helden sofort nicht mehr negiert (wie bei removeArea).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BB = 'Bishop of Kings [B]';
  const negOpp = (t) => [0, 1, 2].map(hi => !!t.hero(1, hi).statuses.negated);
  for (const ziel of ['Board of Kings', 'Knight of Kings [W]']) {
    const t = await H.fresh({ hand: [['Tengu Windstorm', BB], []], discard: [['Rebelliokai Terror Tengu'], []] });
    t.putArea(0, 'Board of Kings'); t.put(0, 0, 0, 'Knight of Kings [W]');
    await t.play(0, BB, { hero: 0, slot: 1 });
    R.check(`[${ziel}] Aufbau: Gegner-Helden negiert`, negOpp(t).every(x => x), negOpp(t));
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'top' }) });
    t.targetFn = (valid) => { const a = valid.find(v => v.cardName === ziel && v.owner === 0); return [a ? a.id : valid[0].id]; };
    await t.play(0, 'Tengu Windstorm', { hero: 0 });
    R.check(`[${ziel}] Windstorm hat ${ziel} vom Brett genommen`, ziel === 'Board of Kings' ? !t.gs.areaZones[0].includes(ziel) : !t.find(ziel, 'support'));
    R.check(`[${ziel}] Gegner-Helden sind sofort wieder nicht negiert`, negOpp(t).every(x => !x), negOpp(t));
    R.check(`[${ziel}] keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
