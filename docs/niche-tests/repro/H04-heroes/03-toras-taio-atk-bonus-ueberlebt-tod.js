'use strict';
// H04-03 · Toras / Taio the Sun Fencer: ATK-Bonus der Ausrüstung überlebt Heldentod und Wiederbelebung
//
// Kartentext Toras: „This Hero's Attack stat is increased by 40 for each Artifact with a different name equipped to it."
// Kartentext Taio:  „This Hero's Attack stat is increased by 20 for every Artifact equipped to it."
// Beim Heldentod wirft die Engine alle Ausrüstungen ab (`handleHeroDeathCleanup`, feuert `onCardLeaveZone` nur an der
// ausscheidenden KARTE – `_onlyCard`). Toras/Taio berechnen/ziehen ihren Bonus aber in ihrem EIGENEN `onCardLeaveZone`
// (läuft hier nie); `hero.atk` wird weder beim Tod noch bei `actionReviveHero` zurückgesetzt, Torasʼ `onHeroKO`-Aufräumen
// liest `ctx.deadHero` (das Feld gibt es nicht, der Hook liefert `ctx.hero`) und läuft nie.
// Erwartung: Der wiederbelebte Held hat ohne Ausrüstung seine gedruckte ATK (Toras 120, Taio 80); neue Ausrüstung zählt ab null.
// Beobachtet: Toras 200 statt 120, Taio 120 statt 80 (Phantom-Bonus bleibt); bei Taio addiert neue Ausrüstung obendrauf (140 statt 100), bei Toras
//   korrigiert sich der Wert erst, wenn wieder Ausrüstung kommt/geht.
// Ursache: toras-master-of-all-weapons.js (`onHeroKO` liest `ctx.deadHero`; `torasAtkBonus` bleibt stehen),
//          taio-the-sun-fencer.js (`_taioAtkGranted` liegt auf der abgeworfenen Instanz, Revoke nur im Hero-Hook).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BLANK = ['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'];
  async function lauf(name, basis, proArtefakt) {
    const t = await H.fresh({ heroes: [[name, ...BLANK]], hand: [['Glass Sword', 'Truth-Seeing Eye', 'Communication Device'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const atk = () => t.hero(0, 0).atk;
    await t.play(0, 'Glass Sword', { hero: 0, slot: 0 });
    await t.play(0, 'Truth-Seeing Eye', { hero: 0, slot: 1 });
    R.check(`${name}: Vorbereitung – zwei Artefakte → ATK ${basis + 2 * proArtefakt}`, atk() === basis + 2 * proArtefakt, atk());
    await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1 }, t.hero(0, 0), 5000, 'attack'));
    await t.run(() => t.engine.actionReviveHero(0, 0, 300, { source: 'Test' }));
    R.check(`${name}: wiederbelebt ohne Ausrüstung → gedruckte ATK ${basis}`, atk() === basis, { atk: atk(), ausruestung: [0, 1, 2].map(i => t.zone(0, 0, i)) });
    await t.play(0, 'Communication Device', { hero: 0, slot: 0 });
    R.check(`${name}: ein neues Artefakt → ATK ${basis + proArtefakt}`, atk() === basis + proArtefakt, atk());
    R.check(`${name}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  await lauf('Toras, Master of all Weapons', 120, 40);
  await lauf('Taio, the Sun Fencer', 80, 20);
  R.finish();
})();
