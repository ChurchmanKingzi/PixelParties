'use strict';
// H01-heroes-19 · Dajan: der scharfgestellte Gratis-Artefaktkauf bleibt gültig, wenn Dajan danach negiert/gefroren/besiegt wird
//
// Kartentext: „You may once per turn play an Artifact with a set Cost from your hand without paying its Cost."
// Aufbau: Sitz 0: Dajan (Held 0), 100 Gold, „Ancient Tech Infinite Energy Core" (Equipment, Cost 10) auf der Hand. Dajan wird per Klick scharfgestellt
//   (`doActivateHeroEffect` → `armFreeArtifact`), danach wird er negiert / gefroren / besiegt, dann wird das Artefakt gespielt.
// Erwartet (Konvention: Heldeneffekte ruhen bei Negation/Frost/Tod): ein ausgefallener Dajan gewährt den Gratiskauf nicht mehr – das Artefakt kostet 10 Gold.
// Beobachtet: in allen drei Zuständen kostet es 0 Gold, der Once-per-turn-Stempel wird gesetzt.
// Ursache: `_engine.js` `artifactPlayCost` (~24363) und `consumeFreeArtifact` (~24490) lesen nur `ps._freeArtifactArmed` (turn-gestempelt); die Heldenverfassung
//   wird nach dem Scharfstellen nicht mehr geprüft.
const H = require('../../lib/h.js');
const DJ = 'Dajan, Conqueror of the Treasure Cave', ART = 'Ancient Tech Infinite Energy Core';
(async () => {
  const R = H.runner();
  async function lauf(wake) {
    const t = await H.fresh({ heroes: [[DJ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[ART], []], gold: [100, 100] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    await t.activateHero(0, 0, { phase: 2 });
    const scharf = !!t.engine.freeArtifactArmed(0);
    if (wake) await wake(t);
    const g0 = t.gs.players[0].gold;
    const r = await t.play(0, ART, { hero: 1, phase: 2 });
    return { t, scharf, r, kosten: g0 - t.gs.players[0].gold };
  }
  const n = await lauf(null);
  R.check('Kontrolle: Dajan gesund – scharfgestellt, Artefakt gratis gespielt', n.scharf && n.r === true && n.kosten === 0, [n.scharf, n.r, n.kosten]);
  for (const [name, wake] of [['negiert', async t => t.heroStatus(0, 0, 'negated')], ['gefroren', async t => t.heroStatus(0, 0, 'frozen')], ['besiegt', async t => { t.hero(0, 0).hp = 0; t.hero(0, 0).diedOnTurn = t.gs.turn; }]]) {
    const x = await lauf(wake);
    R.check(`Dajan ${name}: Artefakt nicht mehr gratis (10 Gold) oder nicht spielbar`, x.r !== true || x.kosten === 10, { gespielt: x.r, kosten: x.kosten });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
