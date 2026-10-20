'use strict';
// N1-06 · Cure: im eigenen Zug nicht spielbar, wenn das einzige Ziel mit negativem Status eine KREATUR ist
// Kartentext: „… Choose any target on the board, except the user, and heal it from all negative status effects. Additionally, heal that target's HP by 100 for every effect removed that way."
// Skript (`cure.js`): `getValidTargets`/`onPlay` kennen Kreaturen (Typ 'equip', `getCleansableCreatureStatusKeys`) – die Spielbarkeitsprüfung `spellPlayCondition` schaut aber
//   nur auf `hero.statuses` und lehnt die Karte ab, bevor die Zielwahl überhaupt öffnet.
// Aufbau: Sitz 0 (Support Magic 1) hält Cure; auf dem Brett von Sitz 1 steht eine gefrorene (bzw. vergiftete) Kreatur, kein Held hat einen Status.
// Erwartet: Cure ist spielbar, die Kreatur wird geheilt (Status weg, +100 HP je entferntem Status). Gegenprobe: ein gefrorener Held als Ziel → spielbar.
// Beobachtet: `t.play` meldet false – die Karte bleibt auf der Hand. (Der Reaktionsweg im Gegnerzug nutzt `getValidTargets` und bietet Kreaturen an.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const variante of ['hero-frozen', 'creature-frozen', 'creature-poisoned']) {
    const t = await H.fresh({ hand: [['Cure'], []] });
    t.setAbilities(0, 0, [['Support Magic'], [], []]);
    let c = null;
    if (variante === 'hero-frozen') t.heroStatus(1, 1, 'frozen');
    else { c = t.put(1, 1, 0, H.INERT.creature); await t.run(() => t.engine.applyCreatureStatus(c, variante === 'creature-frozen' ? 'frozen' : 'poisoned', { sourceOwner: 0 })); }
    t.targetFn = (valid) => [valid[0].id];
    const r = await t.play(0, 'Cure', { hero: 0 });
    R.check(`${variante}: Cure wird gespielt (landet in der Ablage)`, r === true && t.pile(0, 'discardPile').includes('Cure'), { r, hand: t.pile(0, 'hand') });
    if (c) R.check(`${variante}: Status der Kreatur entfernt`, !c.counters.frozen && !c.counters.poisoned, c.counters);
    R.check(`${variante}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
