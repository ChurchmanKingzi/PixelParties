'use strict';
// H02-heroes-19 · Shapeshifter nach der Rückverwandlung: Reste von Ida, Fiedel und Friedhelm (Erweiterung von H01-02/-14, dort „nicht gemessen")
//
// Kartentext Shapeshifter: „This Hero gains the effects and name of the Hero equipped to it this way. At the end of your opponent's turn, send all Heroes equipped this way to the discard pile."
// Skript-Ruling ②: nach dem Abfallen gilt wieder nur der eigene Effekt. `initGainedHeroEffect` führt die `onGameStart`/`onPlay`-Routine der Gestalt aus; Rückbau gibt es nur bei Pseudonia/Sol Rym (`onIdentityLost`).
// Erwartet je Karte (Kontrolle: nie verwandelter Shapeshifter):
//   Ida:       Explosion trifft alle 3 Ziele (kein Einzelziel-Deckel)
//   Fiedel:    Reaction Spectral Armor (Lv 1) ohne Schule NICHT spielbar (kein „-1 Stufe")
//   Friedhelm: mit Zusatzaktion darf der Held ein zweites Mal handeln (kein `_maxActionsPerTurn`)
// Beobachtet: Ida-Deckel (heroFlags `forcesSingleTarget`), Fiedel-Rabatt (`hero.levelOverrideCards`) und Friedhelm-Grenze (`hero._maxActionsPerTurn = 1`) bleiben für immer am Shapeshifter.
// Aufruf: node docs/niche-tests/repro/H02-heroes/19-shapeshifter-reste-ida-fiedel-friedhelm.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter';
async function mk(name, opts = {}) {
  const t = await H.fresh(Object.assign({ heroes: [[SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] }, opts));
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  if (name) {
    t.addHand(0, name);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: name, source: 'hand' }), once: true });
    await t.activateHero(0, 0, {});
    await t.endTurn(); await t.endTurn();           // Ende des Gegnerzuges: Gestalt fällt ab
    t.gs.activePlayer = 0;
  }
  return t;
}
(async () => {
  const R = H.runner();
  // --- Ida: Einzelziel-Deckel ---
  for (const nm of [null, 'Ida, the Adept of Destruction']) {
    const t = await mk(nm, { hand: [['Explosion'], []] });
    t.put(1, 0, 0, H.INERT.big); t.put(1, 1, 0, H.INERT.big);
    t.targetFn = (valid, cfg) => { const n = (cfg && (cfg.maxTotal || cfg.max)) || valid.length; return valid.filter(v => v.owner === 1).slice(0, n).map(v => v.id); };
    const before = t.gs.players[1].heroes.map(h => h.hp);
    const r = await t.play(0, 'Explosion', { hero: 0 });
    const treffer = t.gs.players[1].heroes.map((h, i) => before[i] - h.hp).filter(x => x > 0).length;
    R.check(`Ida${nm ? ' (verwandelt und zurück)' : ' (Kontrolle)'}: Explosion trifft alle 3 Helden (Held heißt ${t.hero(0, 0).name})`, r === true && treffer === 3, { r, treffer });
  }
  // --- Fiedel: Reaction-Rabatt ---
  for (const nm of [null, 'Fiedel, the Mercenary Mage']) {
    const t = await mk(nm, { hand: [['Fireball'], ['Spectral Armor']], active: 0 });
    t.setHand(0, ['Spectral Armor']); t.setHand(1, ['Fireball']);
    t.setAbilities(0, 0, [[], [], []]);
    t.gs.currentPhase = 3; t.gs.activePlayer = 1; t.policy.confirm = true;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(1, 'Fireball', { hero: 0 });
    R.check(`Fiedel${nm ? ' (verwandelt und zurück)' : ' (Kontrolle)'}: Spectral Armor ohne Schule NICHT gespielt (Held 650 HP)`, t.hp(0, 0) === 650, { hp: t.hp(0, 0), hand: t.pile(0, 'hand') });
  }
  // --- Friedhelm: eine Aktion je Zug ---
  for (const nm of [null, 'Friedhelm, the Misled Avenger']) {
    const t = await mk(nm, { hand: [['Fireball', 'Fireball'], []] });
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.grantFor(0, 0, 'Fireball');
    const r1 = await t.play(0, 'Fireball', { hero: 0 });
    t.gs.players[0].bonusActions = { heroIdx: 0, remaining: 1, allowedTypes: null };   // Zusatzaktion für Held 0
    const r2 = await t.play(0, 'Fireball', { hero: 0, keepActions: true });
    R.check(`Friedhelm${nm ? ' (verwandelt und zurück)' : ' (Kontrolle)'}: zweite Aktion mit Zusatzaktion erlaubt (r1=${r1}, r2=${r2}, _maxActionsPerTurn=${t.hero(0, 0)._maxActionsPerTurn})`, r1 === true && r2 === true, { r1, r2 });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
