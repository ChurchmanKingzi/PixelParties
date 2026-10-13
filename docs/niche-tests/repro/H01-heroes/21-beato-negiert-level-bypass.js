'use strict';
// H01-heroes-21 · Beato, the Butterfly Witch NEGIERT: „can use any level 1 Spells and Creatures" gilt weiter
//
// Kartentext: „This Hero can use any level 1 Spells and Creatures."
// Konvention: negierte Helden verlieren ihre Heldeneffekte; ihre Abilities zählen nicht (Kontrolle: negierte Inya mit Fireball → abgelehnt, siehe -20).
//   Beatos Skript setzt `bypassStatusFilter: true` nur, damit `onGameStart` bei Frost/Negation den Orb-Zähler anlegt, und stellt den Statusfilter für den
//   Orb-Zähler wieder her ("Guard against incapacitation") – nicht aber für die Stufen-Umgehung `bypassLevelReq` / `hero.bypassLevelReq`.
// Aufbau: Sitz 0: Beato (Held 0) ohne jede Ability, `onGameStart` gefeuert; „Burning Finger" (Destruction Magic Lv1) und „Hell Fox" (Creature Lv1) auf der Hand.
// Erwartet: negiert → beide Karten sind ohne Schule nicht spielbar (wie jeder Held ohne Schule). Gesund: spielbar.
// Beobachtet: negiert werden beide gespielt. (Frozen/Stunned: abgelehnt – dort ist der Held handlungsunfähig.)
// Ursache: `beato-the-butterfly-witch.js` `bypassLevelReq` (~Z. 99) und das Heldenobjekt-Flag `hero.bypassLevelReq` (Z. 106) ohne Statusprüfung.
const H = require('../../lib/h.js');
const BEATO = 'Beato, the Butterfly Witch';
(async () => {
  const R = H.runner();
  async function lauf(status, karte) {
    const t = await H.fresh({ heroes: [[BEATO, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[karte], []] });
    t.setAbilities(0, 0, [[], [], []]);
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    if (status) t.heroStatus(0, 0, status);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
    const r = await t.play(0, karte, { hero: 0, noGrant: true });
    return { t, r };
  }
  for (const karte of ['Burning Finger', 'Hell Fox']) {
    const g = await lauf(null, karte);
    R.check(`Kontrolle gesund: ${karte} ohne Schule spielbar`, g.r === true, g.r);
    const n = await lauf('negated', karte);
    R.check(`negiert: ${karte} ohne Schule NICHT spielbar`, n.r !== true, n.r);
    R.check(`keine Engine-Fehler (${karte})`, n.t.errors.length === 0, n.t.errors);
  }
  // Beato, the Eternal Butterfly (Ascended): dasselbe Feld `hero.bypassLevelReq` (maxLevel 99), gesetzt von `onAscendSetup`
  {
    const t = await H.fresh({ heroes: [['Beato, the Eternal Butterfly', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Burning Finger'], []] });
    t.setAbilities(0, 0, [[], [], []]);
    H.loadCardEffect('Beato, the Eternal Butterfly').onAscendSetup(t.gs, 0, 0, t.engine);
    t.heroStatus(0, 0, 'negated');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
    const r = await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Eternal negiert: Burning Finger ohne Schule NICHT spielbar', r !== true, r);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
