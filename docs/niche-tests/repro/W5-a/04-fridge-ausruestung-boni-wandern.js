'use strict';
// W5-a-04 · Slippery Fridge: bei JEDER Ausrüstung wandern die Boni sauber vom alten auf den neuen Träger (Al, 14.10.2026)
// Al: „Ja, alle Equips sollen ihre Boni vom alten auf den neuen Träger übertragen." (Slippery Fridge, A03-27; erweitert auf alle Ausrüstungen)
// Batterie: jede Ausrüstung (Typ Equipment) wird per echtem Spielweg an Held 0 gelegt, die Fridge schiebt sie auf Held 1.
// Erwartung: BEIDE Helden (alle Felder außer „_"-Marken, ATK/HP/Status/Buffs) und die Zähler der Ausrüstung entsprechen dem Zustand
//   einer Szene, in der dieselbe Ausrüstung direkt an Held 1 gelegt wurde (alter Träger verliert den Bonus, neuer bekommt ihn genau einmal).
// Ausgenommen: Ancient Tech Infinite Energy Core (Bonus hängt live an der Ablage; die Fridge liegt nach dem Zug darin → bewusst anderer Wert).
// Sonderaufbauten: Crusader's (Cecilia), Idej-Klingen/-Schwerter (Idej-Helden), Lunatic Cycle (Vorgänger-Mond auf Held 2); Modnir/Swellpnir (nur aus
//   dem Coolness Stack spielbar) per Platzieren + onPlay.
const H = require('../../lib/h.js');
const SF = 'Slippery Fridge';
const SPECIAL = new Set(['Modnir, Hammer of Coolness', 'Swellpnir, Mount of Coolness']);
const LUN = { 'Lunatic Cycle - Crescent Moon': 'Lunatic Cycle - New Moon', 'Lunatic Cycle - Half Moon': 'Lunatic Cycle - Crescent Moon', 'Lunatic Cycle - Gibbous Moon': 'Lunatic Cycle - Half Moon', 'Lunatic Cycle - Full Moon': 'Lunatic Cycle - Gibbous Moon' };
const AUSNAHME = new Set(['Ancient Tech Infinite Energy Core', 'Cool Tech Jetpack']);   // Jetpack: geht beim Spielen sofort in die Ablage (nie ein Träger)
const IGNORIERT = /\.additionalActionType|\.aaGrants|turnPlayed|\.id\b|heroIdx|zoneSlot/;
function opts(E) {
  const o = { hand: [[E, SF], []], gold: 500 };
  if (/^Crusader's/.test(E)) o.heroes = [['Cecilia, the Harrowing Crusader', 'Cecilia, the Harrowing Crusader', H.BLANK_HEROES[2]], null];
  if (/^Idej (Blade|Sword)/.test(E)) o.heroes = [['Idej Lord Daiyo', 'Idej Lord Nobunakin', 'Idej Lord Shoguwana'], null];
  return o;
}
const leer = (v) => v === undefined || v === null || v === 0 || v === '' || v === false || (typeof v === 'object' && Object.keys(v).length === 0);
function diff(a, b, path = '', out = []) {
  if (leer(a) && leer(b)) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (k.startsWith('_')) continue; diff(a[k], b[k], path + '.' + k, out); } return out; }
  out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); return out;
}
const heroSnap = (t, hi) => JSON.parse(JSON.stringify(t.gs.players[0].heroes[hi]));
async function lege(t, E, hi) {
  if (LUN[E]) t.put(0, 2, 0, LUN[E]);
  if (SPECIAL.has(E)) { const inst = t.put(0, hi, 0, E); await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: E, zone: 'support', heroIdx: hi, zoneSlot: 0 })); return true; }
  return t.play(0, E, { hero: hi, slot: 0 });
}
(async () => {
  const R = H.runner();
  const eqs = Object.values(H.DB).filter(c => (c.subtype || '').toLowerCase() === 'equipment').map(c => c.name).filter(n => !AUSNAHME.has(n));
  let geprueft = 0;
  for (const E of eqs) {
    const t = await H.fresh(opts(E));
    const ok = await lege(t, E, 0);
    const inst = t.inst(c => c.name === E && c.zone === 'support')[0];
    if (ok !== true || !inst) { R.note(`${E}: nicht spielbar im Harness`, ok); continue; }
    t.targetFn = (valid, cfg) => {
      const ti = (cfg && cfg.title) || '';
      if (ti === SF) { const v = valid.find(x => x.cardName === E); return v ? [v.id] : undefined; }
      if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(x => x.type === 'hero' && x.heroIdx === 1); return v ? [v.id] : undefined; }
      return undefined;
    };
    await t.play(0, SF);
    const moved = t.inst(c => c.name === E && c.zone === 'support')[0];
    if (!moved || moved.heroIdx !== 1) { R.check(`${E}: von der Fridge verschoben`, false, { hero: moved && moved.heroIdx }); continue; }
    const M = [heroSnap(t, 0), heroSnap(t, 1)], Mc = JSON.parse(JSON.stringify(moved.counters || {}));
    const t2 = await H.fresh(opts(E));
    await lege(t2, E, 1);
    const d = t2.inst(c => c.name === E && c.zone === 'support')[0];
    const D = [heroSnap(t2, 0), heroSnap(t2, 1)], Dc = JSON.parse(JSON.stringify((d && d.counters) || {}));
    const f = [...diff(D[0], M[0]).map(s => 'Held0' + s), ...diff(D[1], M[1]).map(s => 'Held1' + s), ...diff(Dc, Mc).map(s => 'Zähler' + s)].filter(s => !IGNORIERT.test(s));
    geprueft++;
    R.check(`${E}: Boni wandern von Held 0 auf Held 1 (wie direkt gelegt)`, f.length === 0 && t.errors.length === 0, f.slice(0, 4).concat(t.errors.slice(0, 1)));
  }
  R.check('mindestens 85 Ausrüstungen geprüft', geprueft >= 85, geprueft);
  R.finish();
})();
