'use strict';
// F01-artifacts-20 · Arcane Lamp: ein Held mit dem Auftau-Puffer „immune" (1 Zug Immunität gegen Frozen/Stunned/Negated/Bound) ist kein Brand-Ziel
// Kartentext: „Choose a target your opponent controls and Burn it."
// Aufbau: Sitz 1: Held 0 trägt `statuses.immune` (so entsteht er nach jedem Auftauen/Ende einer Betäubung, `_engine.js` ~45143), Helden 1 und 2 sind besiegt, keine Kreaturen.
// Erwartung: Held 0 ist ein gültiges Ziel; die Engine bringt Brand trotz „immune" an (`CC_STATUSES = frozen/stunned/negated/bound`, `_engine.js` Z. 44861; Gegenprobe unten).
// Beobachtet: Arcane Lamp ist nicht spielbar (r = false, Karte bleibt auf der Hand), obwohl das Ziel brennen würde.
// Ursache: `cards/effects/arcane-lamp.js` Z. 42 `if (hero.statuses?.immune) return false;` in `heroCanBeBurned` (gleiches Muster in `heat-wave.js` Z. 75, nicht Teil dieser Gruppe).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {   // Gegenprobe: die Engine selbst verbrennt einen „immune"-Helden
    const t = await H.fresh({ hand: [[], []] });
    t.hero(1, 0).statuses.immune = { appliedTurn: 5 };
    await t.engine.addHeroStatus(1, 0, 'burned', { permanent: true, appliedBy: 0 });
    R.check('Gegenprobe: Engine setzt Brand auf einen „immune"-Helden', !!t.hero(1, 0).statuses.burned, Object.keys(t.hero(1, 0).statuses));
  }
  {
    const t = await H.fresh({ hand: [['Arcane Lamp'], []], gold: [100, 100] });
    t.hero(1, 1).hp = 0; t.hero(1, 2).hp = 0;
    t.hero(1, 0).statuses.immune = { appliedTurn: 5 };
    let ziele = null;
    t.targetFn = (v) => { ziele = v.map(x => x.id); return [v[0].id]; };
    const r = await t.play(0, 'Arcane Lamp', { hero: 0 });
    R.check('Arcane Lamp ist spielbar und bietet den „immune"-Helden an', r === true && (ziele || []).includes('hero-1-0'), { r, ziele, hand: t.pile(0, 'hand') });
    R.check('Held brennt danach', !!t.hero(1, 0).statuses.burned, Object.keys(t.hero(1, 0).statuses));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
