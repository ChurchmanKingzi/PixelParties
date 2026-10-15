// W11b · Q73 (C01-14) · Spirit of the Forbidden Grimoire und Kohta, the Silent Observer
// Al: „Beide dürfen explizit Effekte ein weiteres Mal verwenden; bei Kohta ist das sogar der einzige Anwendungsfall. Also ja, sie dürfen sie wiederholen."
// Erwartung: A) Grimoire leiht den Effekt des im selben Zug schon benutzten Cannon Tower (150 + 150); danach ist der Tower für den Rest des Zuges gesperrt
//   („cannot be used another time … in any way afterwards"). B) Kohta wiederholt den Effekt von Mr. Jiggles (Level 2), obwohl dessen „once per turn" verbraucht ist.
//   C) Ein zweites Grimoire kann den vom ersten benutzten Effekt nicht noch einmal leihen. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SG = 'Spirit of the Forbidden Grimoire';
  { // A
    const t = await H.fresh({});
    const gs = t.gs;
    t.put(0, 2, 0, SG).turnPlayed = 1; const tower = t.put(0, 0, 0, 'Cannon Tower'); tower.turnPlayed = 1;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) return valid.filter(x => !x.ineligible && x.cardName === 'Cannon Tower').map(x => x.id).slice(0, 1);
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    gs.currentPhase = 2;
    let h0 = t.hp(1, 0);
    await t.activateCreature(0, 0, 0);
    const normal = h0 - t.hp(1, 0);
    h0 = t.hp(1, 0);
    await t.activateCreature(0, 2, 0);
    const geliehen = h0 - t.hp(1, 0);
    R.check('A) Tower normal 150', normal === 150, normal);
    R.check('A) Grimoire wiederholt den schon benutzten Tower (150)', geliehen === 150, geliehen);
    h0 = t.hp(1, 0);
    const nochmal = await t.activateCreature(0, 0, 0);
    R.check('A) danach ist der Tower für den Zug gesperrt', nochmal === false && h0 === t.hp(1, 0), { nochmal });
    R.check('A) keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // B Kohta
    const t = await H.fresh({ heroes: [['Kohta, the Silent Observer', 'Rick, the Hero', 'Tushu, the Sorcerer'], null] });
    const gs = t.gs;
    t.put(0, 1, 0, 'Mr. Jiggles').turnPlayed = 1;
    const frail = t.put(1, 0, 0, H.INERT.frail), big = t.put(1, 1, 0, H.INERT.big);
    let calls = 0;
    t.targetFn = (valid) => { calls++; const pick = calls === 1 ? frail : big; return [valid.find(v => v.owner === 1 && v.heroIdx === pick.heroIdx && v.type !== 'hero').id]; };
    t.policy.confirm = true;
    gs.currentPhase = 2;
    await t.activateCreature(0, 1, 0);
    R.check('B) Kohta fragt, Jiggles feuert ein zweites Mal (Jiggles hat 100 auf die große Kreatur gemacht)', 1000 - big.counters.currentHp === 100 && gs.players[1].discardPile.includes(H.INERT.frail), { big: 1000 - big.counters.currentHp, ablage: gs.players[1].discardPile, calls });
    R.check('B) keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // C zweites Grimoire
    const t = await H.fresh({});
    const gs = t.gs;
    t.put(0, 2, 0, SG).turnPlayed = 1; t.put(0, 2, 1, SG).turnPlayed = 1; t.put(0, 0, 0, 'Cannon Tower').turnPlayed = 1;
    let angeboten = null;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) { angeboten = valid.filter(x => !x.ineligible).map(x => x.cardName); return valid.filter(x => !x.ineligible && x.cardName === 'Cannon Tower').map(x => x.id).slice(0, 1); }
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    gs.currentPhase = 2;
    await t.activateCreature(0, 2, 0);
    angeboten = null;
    const r2 = await t.activateCreature(0, 2, 1);
    R.check('C) zweites Grimoire: der vom ersten benutzte Tower ist nicht mehr leihbar', r2 === false && !(angeboten || []).includes('Cannon Tower'), { r2, angeboten });
  }
  R.finish();
})();
