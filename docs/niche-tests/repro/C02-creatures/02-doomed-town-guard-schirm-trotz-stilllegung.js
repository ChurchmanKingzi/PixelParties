'use strict';
// C02-creatures-02 · Doomed Town Guard: Schutzschirm bleibt bei Frost / Betäubung / Negation bestehen
// Kartentext: „… Your opponent can't choose other Creatures you control. At the end of your turn, this Creature is defeated."
// Engine-Konvention (CARD_API.md Z. 1902): `engine.isCreatureEffectSuppressed(inst)` ist DAS Prädikat für „die Effekte dieser Kreatur sind stumm";
//   neue Stellen, die Kreaturstatus prüfen, nehmen es. Vgl. B-querschnitt B-01..B-03 (gleiche Klasse: Dauereffekt ohne Statusprüfung).
// Aufbau: Sitz 0 hat zwei Dummies (X, Y) und Doomed Town Guard auf der Hand; X wird durch Sitz 1 besiegt → Wachposten kommt (Schirm gesetzt).
//   Danach friert/betäubt/negiert Sitz 1 den Wachposten und wählt per Field Cannon ein Ziel.
// Erwartung: Normal: Y nicht wählbar ✓. Gefroren/betäubt/negiert: der Schirm entfällt, Y ist wieder wählbar.
// Beobachtet: Y bleibt in allen drei Zuständen unwählbar (`_applyForcesTargetingFilter` liest nur `counters.forcesTargeting`, _engine.js ~Z. 294-380).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ids = (t) => t.targets.length ? t.targets[t.targets.length - 1].valid.map(v => `${v.type}:${v.owner}/${v.heroIdx}/${v.slotIdx ?? ''}`) : [];
  for (const zustand of ['normal', 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ hand: [['Doomed Town Guard'], []] });
    const mk = (s, h, z, n) => { const i = t.put(s, h, z, n); i.turnPlayed = 1; return i; };
    const x = mk(0, 0, 0, H.INERT.creature); mk(0, 1, 0, H.INERT.creature); mk(1, 0, 0, 'Field Cannon');
    await t.run(() => t.engine.actionDestroyCard({ name: 'Field Cannon', owner: 1, controller: 1 }, x));
    const dtg = t.find('Doomed Town Guard', 'support');
    if (!dtg) { R.check(zustand + ': Wachposten beschworen', false, t.prompts.map(p => p.d.type)); continue; }
    if (zustand === 'frozen' || zustand === 'stunned') await t.engine.applyCreatureStatus(dtg, zustand, { sourceOwner: 1, duration: 2 });
    if (zustand === 'negated') await t.run(() => t.engine.actionNegateCreature(dtg, 'Dark Gear'));
    t.targetFn = () => null; t.reset();
    t.gs.activePlayer = 1; t.phase(2);
    await t.activateCreature(1, 0, 0);
    const L = ids(t);
    const yWaehlbar = L.includes('equip:0/1/0');
    if (zustand === 'normal') R.check('normal: andere Kreatur Y NICHT wählbar (Schirm wirkt)', !yWaehlbar, L);
    else R.check(zustand + ': Schirm entfällt – Y wieder wählbar', yWaehlbar, L);
  }
  R.finish();
})();
