'use strict';
// Z7c-A1c · Selbstopfer des Wirkers + Kette ohne Negation: Sitz 1 antwortet mit Shamanic Curse („Increase that Spell's level by 1 … if now too high, negated"). Der Wirker hat
// Decay Magic Lv2 ⇒ Stufe 2 reicht, der Zauber wird NICHT negiert. Opfert sich der Wirker (Held 0) als Kosten vor der Kette, darf die Karte nicht fizzeln: Empfänger bekommt die Max-HP.
// Gegenprobe: derselbe Aufbau, Opfer = Held 1 ⇒ identisches Ergebnis.
// Aufruf: node docs/niche-tests/repro/Z7c/A1c-selbstopfer-in-nicht-negierender-kette.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
async function lauf(opferIdx, empf) {
  const t = await H.fresh({ hand: [['Divine Gift of Sacrifice'], ['Shamanic Curse']], abilities: { 0: { 0: [['Decay Magic', 'Decay Magic'], [], []] } } });
  t.grantFor(1, 0, 'Shamanic Curse'); t.policy.confirm = true;
  t.targetFn = (v, cfg) => {
    const idx = /sacrifice\./i.test((cfg && cfg.description) || '') ? opferIdx : empf;
    return [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === idx).id];
  };
  const max0 = t.gs.players[0].heroes.map(h => h.maxHp);
  await t.play(0, 'Divine Gift of Sacrifice', { hero: 0 });
  const h = t.gs.players[0].heroes;
  return { t, curseGespielt: !t.pile(1, 'hand').includes('Shamanic Curse'), gefallen: h.map((x, i) => x.hp <= 0 ? i : -1).filter(i => i >= 0), delta: h.map((x, i) => x.maxHp - max0[i]) };
}
(async () => {
  const R = H.runner();
  for (const [name, opfer, empf] of [['Opfer = Wirker (Held 0)', 0, 1], ['Opfer = Held 1', 1, 2]]) {
    const r = await lauf(opfer, empf);
    R.check(`${name}: Shamanic Curse wurde in der Kette gespielt`, r.curseGespielt);
    R.check(`${name}: Opfer gefallen`, r.gefallen.length === 1 && r.gefallen[0] === opfer, r.gefallen);
    R.check(`${name}: Karte nicht negiert und nicht gefizzelt — Empfänger ${empf} bekommt +800 Max-HP`, r.delta[empf] === 800, r.delta);
    R.check(`${name}: keine Engine-Fehler / Zustand sauber`, r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
  }
  R.finish();
})();
