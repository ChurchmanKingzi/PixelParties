'use strict';
// W12 / Q111 (H01-heroes-19) · Dajan: ein bereits aktiviertes/begonnenes Scharfstellen läuft durch (Al: „Solange der Effekt bereits aktiviert und begonnen wurde, läuft er durch,
//   selbst wenn Dajan am Ende der Exekutierung nicht mehr einsatzfähig ist."); VOR dem Scharfstellen gelten die normalen Ruhe-Regeln (Wellen 7/8).
// Absicherungs-Repro (Ist-Zustand). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const DJ = 'Dajan, Conqueror of the Treasure Cave', ART = 'Ancient Tech Infinite Energy Core';
(async () => {
  const R = H.runner();
  async function bauen() {
    const t = await H.fresh({ heroes: [[DJ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[ART], []], gold: [100, 100] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  }
  // (a) nach dem Scharfstellen ausgefallen → bleibt gratis
  for (const [name, wake] of [['negiert', t => t.heroStatus(0, 0, 'negated')], ['gefroren', t => t.heroStatus(0, 0, 'frozen')], ['betäubt', t => t.heroStatus(0, 0, 'stunned')],
                              ['besiegt', t => { t.hero(0, 0).hp = 0; t.hero(0, 0).diedOnTurn = t.gs.turn; }]]) {
    const t = await bauen();
    await t.activateHero(0, 0, { phase: 2 });
    R.check(`(a/${name}) Vorprobe: scharfgestellt`, !!t.engine.freeArtifactArmed(0));
    wake(t);
    const g0 = t.gs.players[0].gold;
    const r = await t.play(0, ART, { hero: 1, phase: 2 });
    R.check(`(a/${name}) Scharfstellen verfällt nicht: Artefakt gratis`, r === true && g0 - t.gs.players[0].gold === 0, { r, kosten: g0 - t.gs.players[0].gold });
    R.check(`(a/${name}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  // (b) vor dem Scharfstellen: ein negierter/gefrorener Dajan kann nicht scharfstellen (normale Ruhe-Regel)
  for (const [name, status] of [['negiert', 'negated'], ['gefroren', 'frozen']]) {
    const t = await bauen();
    t.heroStatus(0, 0, status);
    await t.activateHero(0, 0, { phase: 2 });
    R.check(`(b/${name}) vor dem Scharfstellen: ruht – nicht scharf`, !t.engine.freeArtifactArmed(0), t.engine.freeArtifactArmed(0));
    const g0 = t.gs.players[0].gold;
    await t.play(0, ART, { hero: 1, phase: 2 });
    R.check(`(b/${name}) Artefakt kostet 10 Gold`, g0 - t.gs.players[0].gold === 10, g0 - t.gs.players[0].gold);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
