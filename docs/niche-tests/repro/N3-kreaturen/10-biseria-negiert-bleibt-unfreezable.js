'use strict';
// N3-10 · Embodiment of Biseria: „cannot be Frozen" gilt weiter, wenn die Kreatur negiert oder betäubt ist
// Kartentext: „This Creature cannot be Frozen."  (passiver Kartentext-Effekt)
// Ruling (Welle 7, FIXES-WELLE-7.md): „Gefroren / betäubt / negiert unterbrechen alle laufenden Passive der Karte (… Kreatur: ganzer Kartentext-Passiv)";
//   Welle 8 (Al): Broghans „cannot be Frozen" entfällt, solange sein Heldeneffekt ruht, und ist danach wieder da.
// Aufbau: Biseria auf dem Brett (Stempel `counters.freeze_immune` aus `onPlay`). (a) normal → Frost wirkungslos. (b) negiert (`actionNegateCreature`) → Frost muss landen.
//   (c) betäubt → Frost muss landen.
// Beobachtet: in (b) und (c) bleibt sie immun – `canApplyCreatureStatus` (_engine.js ~Z. 19606) liest `inst.counters[immuneKey]` ohne Ruhend-Prüfung (`isCardPassiveDormant`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const B = 'Embodiment of Biseria';
  async function lauf(zustand) {
    const t = await H.fresh({});
    const b = t.put(0, 0, 0, B); b.turnPlayed = 1;
    b.counters.freeze_immune = 1;                    // wie `onPlay`
    if (zustand === 'negiert') await t.run(() => t.engine.actionNegateCreature(b, 'Dark Gear'));
    if (zustand === 'betaeubt') await t.run(() => t.engine.applyCreatureStatus(b, 'stunned', { sourceOwner: 1, duration: 2 }));
    const ruht = t.engine.isCardPassiveDormant(b);
    await t.run(() => t.engine.applyCreatureStatus(b, 'frozen', { duration: 1, sourceOwner: 1 }));
    return { ruht, gefroren: !!b.counters.frozen, errors: t.errors };
  }
  const n = await lauf('normal');
  R.check('(a) gesunde Biseria bleibt unfreezable (Gegenprobe)', n.gefroren === false && n.ruht === false, n);
  const g = await (async () => { const t = await H.fresh({}); const x = t.put(0, 0, 0, H.INERT.big); await t.run(() => t.engine.applyCreatureStatus(x, 'frozen', { duration: 1, sourceOwner: 1 })); return !!x.counters.frozen; })();
  R.check('Gegenprobe: eine gewöhnliche Kreatur ist einfrierbar', g === true);
  const ng = await lauf('negiert');
  R.check('(b) negierte Biseria: Passiv ruht (Prädikat sagt „dormant")', ng.ruht === true, ng);
  R.check('(b) negierte Biseria ist einfrierbar', ng.gefroren === true, ng);
  const st = await lauf('betaeubt');
  R.check('(c) betäubte Biseria: Passiv ruht', st.ruht === true, st);
  R.check('(c) betäubte Biseria ist einfrierbar', st.gefroren === true, st);
  R.check('keine Engine-Fehler', [n, ng, st].every(x => x.errors.length === 0));
  R.finish();
})();
