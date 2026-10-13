'use strict';
// H01-heroes-14 · Shapeshifter nach der Rückverwandlung: weitere Reste fremder Heldeneffekte (Karian, Taio, Nao, Alice the Transfer Student)
//
// Gleiche Klasse wie -02 (Broghan/Beato), aber andere Karten mit anderer Folge. Kartentext Shapeshifter: „This Hero gains the effects and name of the
// Hero equipped to it this way. At the end of your opponent's turn, send all Heroes equipped this way to the discard pile." Skript-Ruling ②: nach dem
// Abfallen gilt wieder nur der eigene Effekt. `initGainedHeroEffect` führt die `onGameStart`-Routine der Gestalt aus, ein Rückbau fehlt bei diesen Karten
// (`onIdentityLost` haben nur Pseudonia und Sol Rym).
// Erwartet je Karte (Kontrolle: gleiche Szene mit Tushu als Gestalt, bzw. nie verwandelter Shapeshifter):
//   Karian: negierbar (Karian: „Other negative status effects don't affect this Hero" – nur solange Karian)  Taio: ATK 40 (+20 je Artefakt, keines mehr)
//   Nao: Heilung über Max-HP nur mit Nao           Alice, the Transfer Student: gleichnamige Kreaturen teilen KEINE Zone mehr
// Beobachtet: alle vier Reste bleiben nach dem Abfallen bestehen.
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter';
async function shift(t, name) {
  t.addHand(0, name);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: name, source: 'hand' }), once: true });
  await t.activateHero(0, 0, {});
}
async function zurueck(name, opts = {}) {
  const t = await H.fresh(Object.assign({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] }, opts));
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  await shift(t, name);
  await t.endTurn(); await t.endTurn();            // Ende des Gegnerzuges: Gestalt fällt ab
  t.gs.activePlayer = 0;
  return t;
}
(async () => {
  const R = H.runner();
  let t = await zurueck('Grand Inquisitor Karian');
  R.check('Vorprobe: Held heißt wieder Shapeshifter', t.hero(0, 0).name === SHAPE, t.hero(0, 0).name);
  await t.engine.addHeroStatus(0, 0, 'negated', { duration: 1, appliedBy: 1 });
  R.check('Karian-Rest: der zurückverwandelte Shapeshifter ist negierbar', !!t.hero(0, 0).statuses.negated, Object.keys(t.hero(0, 0).statuses));

  t = await zurueck('Taio, the Sun Fencer');
  R.check('Taio-Rest: ATK wieder 40 (kein Artefakt angelegt)', t.hero(0, 0).atk === 40, t.hero(0, 0).atk);

  t = await zurueck('Nao, the Barrier Priestess');
  t.hero(0, 0).hp = t.hero(0, 0).maxHp;
  await t.run(() => t.engine.actionHealHero({ name: 'Cure', owner: 0, heroIdx: 0 }, t.hero(0, 0), 50));
  R.check('Nao-Rest: Heilung über Max-HP nicht mehr möglich', t.hero(0, 0).hp <= t.hero(0, 0).maxHp, [t.hero(0, 0).hp, t.hero(0, 0).maxHp]);

  t = await zurueck('Alice, the Transfer Student', { hand: [[H.INERT.creature, H.INERT.creature], []] });
  const a = await t.play(0, H.INERT.creature, { hero: 0, slot: 0, noGrant: true });
  t.setHand(0, [H.INERT.creature]);
  const b = await t.play(0, H.INERT.creature, { hero: 0, slot: 0, noGrant: true });
  R.check('Alice-Rest: zweite gleichnamige Kreatur darf NICHT auf den belegten Platz', a === true && b === false, [a, b, t.gs.players[0].supportZones[0][0]]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
