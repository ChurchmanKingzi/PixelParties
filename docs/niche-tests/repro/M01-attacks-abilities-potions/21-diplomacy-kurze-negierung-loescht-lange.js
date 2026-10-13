'use strict';
// M01-21 · Diplomacy: die kurze „Negate … for the rest of the turn"-Negierung löscht eine längere, noch laufende Negierung derselben Kreatur
// Kartentext Diplomacy: „… take permanent control of that Creature. Negate the Creature's effects for the rest of the turn."
// Aufbau: Sitz 1 hat „Arcane Eyes" (Lv1); sie ist durch eine andere Quelle 6 Züge lang negiert (`actionNegateCreature(inst,'Forbidden Zone',{expiresAtTurn: turn+6})`);
//         Sitz 0 (Diplomacy Lv1, 50 Gold) übernimmt sie; danach 1× `t.endTurn()`.
// Erwartet: Die Kreatur bleibt negiert, solange die lange Negierung (Buff `forbidden_zone_negated`, 6 Züge) läuft; Diplomacys Negierung endet am Zugende, nichts weiter.
// Beobachtet: Nach dem Zugende ist `counters.negated` weg, der Buff `forbidden_zone_negated` steht aber noch auf der Kreatur (negiert „auf dem Papier", wirksam nicht): der Status-Zähler wird von beiden Buffs geteilt (`clearCountersOnExpire`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ gold: 50, abilities: { 0: { 0: [['Diplomacy'], [], []] } } });
  const c = t.put(1, 0, 0, 'Arcane Eyes');
  await t.engine.actionNegateCreature(c, 'Forbidden Zone', { expiresAtTurn: t.gs.turn + 6, expiresForPlayer: 1 });
  t.targetFn = (valid) => [valid[0].id];
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
  t.gs.activePlayer = 0; t.phase(2);
  const r = await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
  R.check('Diplomacy übernimmt die Kreatur', r === true && c.controller === 0, { r, controller: c.controller });
  await t.endTurn();
  R.check('lange Negierung läuft noch (Buff steht)', !!(c.counters.buffs && c.counters.buffs.forbidden_zone_negated), Object.keys(c.counters.buffs || {}));
  R.check('Kreatur ist weiterhin negiert, solange die lange Negierung steht', !!c.counters.negated, c.counters.negated);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
