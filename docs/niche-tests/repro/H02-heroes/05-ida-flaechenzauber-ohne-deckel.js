// H02-heroes-05 · Ida, the Adept of Destruction – Destruction-Zauber, die Idas Einzelziel-Deckel umgehen
//
// Kartentext Ida: „This Hero can never hit more than 1 target with a Destruction Spell."
// Ruling (CARD_API.md Z. 11832): „Ida macht aus einem Flächenzauber einen Einzelzauber."
// Erwartung: jeder Destruction-Zauber trifft unter Ida höchstens 1 Ziel.
// Beobachtung: Boiling Oil, Chain Lightning, Explosion, Fireball, Flame Avalanche, Rain of Arrows sind gedeckelt (1 Treffer),
//   aber Pyroblast, Dance of the Flame Pillars, Laser Volley, Cataclysm und Armageddon treffen unter Ida weiter alle gewählten bzw. alle Ziele.
// Ursache: Pyroblast/Dance rufen `promptMultiTarget` ohne `damageType: 'destruction_spell'` (der Deckel in `_engine.js` ~5786 verlangt es);
//   Laser Volley/Cataclysm/Armageddon haben einen eigenen Schadensweg ohne Idas Flagge.
// Aufruf: node docs/niche-tests/repro/H02-heroes/05-ida-flaechenzauber-ohne-deckel.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const IDA = 'Ida, the Adept of Destruction';
function snap(t) {
  const o = {};
  for (let s = 0; s < t.n; s++) t.gs.players[s].heroes.forEach((h, hi) => { if (h && h.name) o[`H${s}-${hi}`] = h.hp; });
  for (const c of t.engine.cardInstances) if (c.zone === 'support' && H.DB[c.name] && H.DB[c.name].cardType === 'Creature') o[`C${c.owner}-${c.heroIdx}-${c.zoneSlot}`] = c.counters.currentHp ?? H.DB[c.name].hp;
  return o;
}
function hits(a, b, selfSeat) {
  const out = [];
  for (const k of Object.keys(a)) if (b[k] !== a[k]) out.push(k);   // gefallen (Kreatur-Instanz verschwunden → undefined)
  return out;
}
(async () => {
  const R = H.runner();
  // Voraussetzung der Stufe: Idas Flagge wird beim Spielstart gesetzt (hier von Hand, `fresh()` startet nicht).
  const SPELLS = ['Fireball', 'Explosion', 'Pyroblast', 'Dance of the Flame Pillars', 'Laser Volley', 'Cataclysm', 'Armageddon'];
  for (const name of SPELLS) {
    const t = await H.fresh({ heroes: [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[name], []],
      discard: [['Fireball', 'Magic Hammer', 'Rockfall', 'Burning Finger'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.put(1, 0, 0, H.INERT.big); t.put(1, 1, 0, H.INERT.big);
    t.targetFn = (valid, cfg) => { const n = (cfg && (cfg.maxTotal || cfg.max)) || valid.length; return valid.filter(v => v.owner === 1).slice(0, n).map(v => v.id); };
    const a = snap(t);
    const r = await t.play(0, name, { hero: 0 });
    const hit = hits(a, snap(t));
    R.check(`${name}: unter Ida höchstens 1 Ziel getroffen (gespielt=${r === true})`, r === true && hit.length <= 1, { r, hit });
    if (t.errors.length) R.note('Engine-Fehler ' + name, t.errors);
  }
  R.finish();
})();
