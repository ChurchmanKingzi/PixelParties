'use strict';
// R02-05 · Unwanted Audience „counts as a negative status effect" – Light Ball schützt die Kreaturen trotzdem nicht
// Kartentexte: Unwanted Audience – „Play this card at the beginning of your opponent's turn. Creatures your opponent controls cannot activate their active effects this turn. This counts as a negative status effect."
//              Light Ball – „… all other targets you control are immune to all negative status effects."
// Engine-Konvention (_engine.js ~18150): eine Negation, die NICHT „unpreventable" ist, ist ein Statuseffekt (v1444: nur Dark Gear/Diplomacy sind es ausdrücklich nicht).
// Aufbau: Sitz 0: Held 0 trägt Light Ball (Support Zone 2), Kreaturen Cannon Tower (Held 1) und Dummy (Held 2). Sitz 1: Unwanted Audience auf der Hand (Decay + Magic Arts).
//   Sitz 1 beendet seinen Zug; zu Beginn des Zuges von Sitz 0 bietet die Karte sich an (Ja).
// Erwartet: Kreaturen von Sitz 0 bleiben unbeeinflusst (Light Ball: immun gegen alle negativen Status); Kontrolle ohne Light Ball: Cannon Tower wird negiert.
// Beobachtet: auch mit Light Ball wird der Cannon Tower negiert (`counters.negated`). Direkt über `applyCreatureStatus(…, 'negated')` blockt Light Ball dagegen (Gegenprobe ✓).
// Ursache: Unwanted Audience negiert über `engine.actionNegateCreature` (unwanted-audience.js `sleepCreature`); dieser Weg (_engine.js ~18150) prüft weder `_lightBallProtects` noch
//   `_creatureNegStatusImmune` (beides sitzt nur in `canApplyCreatureStatus`, ~18540–18575). Gleiches gilt für Kreaturen mit dem Buff `negative_status_immune` (Lunatic Golem) – nicht Teil dieser Gruppe.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const mitLightBall of [false, true]) {
    const t = await H.fresh({ hand: [[], ['Unwanted Audience']], hp: 800 });
    t.setAbilities(0, 0, [['Support Magic'], [], []]);
    if (mitLightBall) t.put(0, 0, 2, 'Light Ball');
    const turm = t.put(0, 1, 0, 'Cannon Tower'); turm.turnPlayed = 1;
    const dummy = t.put(0, 2, 0, H.INERT.creature);
    t.grantFor(1, 0, 'Unwanted Audience');
    t.gs.activePlayer = 1; t.policy.confirm = true;
    await t.endTurn();
    const angeboten = t.prompts.some(p => p.d.title === 'Unwanted Audience');
    R.check(`${mitLightBall ? 'mit' : 'ohne'} Light Ball: Unwanted Audience wurde zu Beginn des Gegnerzugs gespielt`, angeboten, t.prompts.map(p => p.d.title));
    if (mitLightBall) {
      R.check('mit Light Ball: Cannon Tower ist NICHT negiert (immun gegen negative Status)', !turm.counters.negated, turm.counters);
      // Gegenprobe: derselbe Schutz über den Status-Standardweg
      const x = t.put(0, 2, 1, H.INERT.creature);
      await t.engine.applyCreatureStatus(x, 'negated', { sourceOwner: 1 });
      R.check('Gegenprobe: applyCreatureStatus(…, "negated") wird von Light Ball geblockt', !x.counters.negated);
    } else {
      R.check('Kontrolle ohne Light Ball: Cannon Tower ist negiert', !!turm.counters.negated, turm.counters);
    }
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
