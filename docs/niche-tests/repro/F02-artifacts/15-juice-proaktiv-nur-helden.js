'use strict';
// F02-15 · Juice ist im eigenen Zug nicht spielbar, wenn nur eine Kreatur einen negativen Status trägt
// Kartentext: „You may play this card between phases of your opponent's turn. Choose any target on the board and heal it from any number of negative status effects."
// Skriptkopf juice.js: „Choose any 1 target on the board … Can also be activated proactively on own turn." – `getValidTargets` führt Helden UND Kreaturen.
// Aufbau: Sitz 0: Hand [Juice], eigene (Fall a) bzw. gegnerische (Fall b) gefrorene „ZZ Dummy"; kein Held hat einen Status.
// Schritte: Juice im eigenen Zug (Main 1) über den echten Weg spielen.
// Erwartet: spielbar, die gefrorene Kreatur ist wählbar und wird geheilt (Vergleich: Cure/Tea haben genau diese Lücke laut Kommentar in cure.js Z. ~152 schon geschlossen).
// Beobachtet: `doUseArtifactEffect` lehnt ab (`false`), Juice bleibt auf der Hand, die Kreatur bleibt gefroren. Mit gefrorenem HELDEN: spielbar ✓ (Gegenprobe).
// Vermutete Ursache: juice.js `canActivate(gs, pi)` (ohne `engine`-Parameter) prüft nur `hero.statuses`; die Kreatur-Prüfung steht nur in `reactionCondition`/`getValidTargets`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [fall, side] of [['a) eigene gefrorene Kreatur', 0], ['b) gegnerische gefrorene Kreatur', 1]]) {
    const t = await H.fresh({ hand: [['Juice'], []], gold: [100, 100] });
    const c = t.put(side, 0, 0, H.INERT.creature);
    await t.run(() => t.engine.applyCreatureStatus(c, 'frozen', { sourceOwner: 1 - side }));
    t.script.push({ match: d => d.type === 'statusSelect', answer: (d) => ({ selectedStatuses: d.statuses.map(s => s.key) }) });
    const r = await t.play(0, 'Juice', { noAutoConfirm: true });
    const pt = t.gs.potionTargeting;
    R.check(`${fall}: Juice spielbar (Zielwahl öffnet sich)`, r !== false && !!pt, { r, hand: t.pile(0, 'hand') });
    if (pt) {
      const v = (pt.validTargets || []).filter(x => !x.ineligible);
      await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: [v[0].id] }));
      R.check(`${fall}: Kreatur nicht mehr gefroren`, !c.counters.frozen, c.counters);
    }
  }
  // Gegenprobe: gefrorener Held
  const t = await H.fresh({ hand: [['Juice'], []], gold: [100, 100] });
  t.heroStatus(0, 0, 'frozen');
  const r = await t.play(0, 'Juice', { noAutoConfirm: true });
  R.check('Gegenprobe: mit gefrorenem Helden spielbar', r !== false && !!t.gs.potionTargeting, { r });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
