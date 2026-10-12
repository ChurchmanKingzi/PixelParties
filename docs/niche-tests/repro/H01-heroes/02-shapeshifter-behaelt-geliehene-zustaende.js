'use strict';
// H01-heroes-02 · „???, the Shapeshifter" behält nach der Rückverwandlung Zustände, die der Anfangsroutine des fremden Helden entstammen
//
// Kartentext: „This Hero gains the effects and name of the Hero equipped to it this way. At the end of your opponent's turn,
//   send all Heroes equipped this way to the discard pile." (Ruling im Skript ②: nach der Rückverwandlung gilt wieder nur der eigene Effekt.)
//   Broghan: „This Hero cannot be Frozen."   Beato, the Butterfly Witch: „This Hero can use any level 1 Spells and Creatures."
// Erwartung: Nach dem Abfallen der Gestalt (Ende des Gegnerzugs) ist der Shapeshifter wieder einfrierbar und kann ohne Destruction Magic
//   keinen Lv-1-Destruction-Zauber wirken – wie ein nie verwandelter Shapeshifter.
// Beobachtet: `initGainedHeroEffect` führt die Anfangsroutine (`onGameStart`) des fremden Skripts aus; sie schreibt Marken ans Heldenobjekt
//   (`statuses.freeze_immune`, `bypassLevelReq`, `ascensionOrbs`). Beim Abfallen läuft `loseHeroEffect` → `onIdentityLost`, das Broghan und
//   beide Beato-Skripte nicht haben. Ergebnis: dauerhaft nicht einfrierbar bzw. dauerhaft Lv-1-Zauber ohne Schule.
// Ursache: cards/effects/broghan-the-frozen-guardian-of-the-north.js (applyFreezeImmunity ohne onIdentityLost),
//   cards/effects/beato-the-butterfly-witch.js (onGameStart setzt hero.bypassLevelReq/initOrbs ohne onIdentityLost);
//   Engine-Vertrag: _engine.js `initGainedHeroEffect` / `loseHeroEffect` (CARD_API.md „KOPIERTE UND GEERBTE HELDENEFFEKTE").
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter';
(async () => {
  const R = H.runner();
  const BROG = 'Broghan, the Frozen Guardian of the North';
  const BEATO = 'Beato, the Butterfly Witch';
  const SP = 'Burning Finger';           // Destruction Magic, Lv 1
  async function shift(t, name) {
    t.addHand(0, name);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: name, source: 'hand' }), once: true });
    return t.activateHero(0, 0, {});
  }
  R.section('Kontrolle: nie verwandelter Shapeshifter');
  {
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
    R.check('Burning Finger (Lv1 Destruction) ohne Schule: abgelehnt', (await t.play(0, SP, { hero: 0, noGrant: true })) === false);
    await t.engine.addHeroStatus(0, 0, 'frozen', { duration: 1, appliedBy: 1 });
    R.check('einfrierbar', !!t.hero(0, 0).statuses.frozen);
  }
  R.section('Beato, the Butterfly Witch → Gestalt fällt ab');
  {
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
    await shift(t, BEATO);
    R.check('als Beato verwandelt', t.hero(0, 0).name === BEATO, t.hero(0, 0).name);
    await t.endTurn(); await t.endTurn();                         // eigenes Zugende, Gegnerzugende → Gestalt fällt ab
    R.check('Shapeshifter ist zurück', t.hero(0, 0).name === SHAPE, t.hero(0, 0).name);
    R.check('Burning Finger (Lv1) ohne Destruction Magic wird wieder abgelehnt', (await t.play(0, SP, { hero: 0, noGrant: true })) === false);
    R.check('Beatos Orbs sind weg', !t.hero(0, 0).ascensionOrbs, t.hero(0, 0).ascensionOrbs && t.hero(0, 0).ascensionOrbs.length);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('Broghan → Gestalt fällt ab');
  {
    const t = await H.fresh({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    await shift(t, BROG);
    await t.endTurn(); await t.endTurn();
    R.check('Shapeshifter ist zurück', t.hero(0, 0).name === SHAPE, t.hero(0, 0).name);
    await t.engine.addHeroStatus(0, 0, 'frozen', { duration: 1, appliedBy: 1 });
    R.check('wieder einfrierbar', !!t.hero(0, 0).statuses.frozen, JSON.stringify(t.hero(0, 0).statuses));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
