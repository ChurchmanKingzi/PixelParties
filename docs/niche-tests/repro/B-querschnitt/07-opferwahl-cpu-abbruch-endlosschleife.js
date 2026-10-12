'use strict';
// `engine.resolveSacrificeCost` (_engine.js ~26873): Bei einer ABBRECHBAREN Opferwahl liefert der CPU-Standard (`_getCpuTargetResponse`: „Cancellable → decline (return empty)") `[]`.
// Die Schleife behandelt `[]` nicht als Abbruch (nur `null` bricht ab), sondern als „zu wenig gewählt" und fragt neu – unbegrenzt. Die einzige Notbremse (`_cpuGibtAuf`) ist an
// `gs.isSkillTest` gebunden und gilt im Normalspiel nicht. Ein Mensch liefert beim Abbruch `null` (kein Problem); betroffen wäre nur ein CPU-Sitz (Einzelspieler/Puzzle) vor einer
// abbrechbaren Opferwahl, dessen Antwort `[]` ist.
// Erwartung: Abbruch ⇒ Karte bleibt auf der Hand, keine Endlosschleife. Beobachtung: >300 Wiederholungen derselben Frage (die Harness bricht dann ab).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const stil of ['null', 'empty']) {
    const t = await H.fresh({ hand: [['Sacrifice to Divinity'], []], maxPrompts: 120 });
    t.put(0, 0, 0, H.INERT.creature, {});
    t.t0 = t.gs.turn;
    for (const c of t.inst(c => c.zone === 'support')) c.turnPlayed = 0;           // nicht „diesen Zug beschworen"
    t.grantFor(0, 0, 'Sacrifice to Divinity');
    t.policy.cancelTargets = true; t.policy.cancelStyle = stil;
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0, noGrant: true });
    R.check(`Abbruch der Opferwahl als ${stil === 'null' ? 'null (Mensch)' : '[] (CPU-Standard)'}: keine Endlosschleife, Karte bleibt auf der Hand`, !(r && r.runaway) && t.pile(0, 'hand').includes('Sacrifice to Divinity'), { r: r && (r.runaway ? 'runaway' : r), prompts: t.targets.length });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
