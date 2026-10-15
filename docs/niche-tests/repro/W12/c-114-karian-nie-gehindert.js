'use strict';
// W12 / Q114 (H02-heroes-11) · Grand Inquisitor Karian wird NIEMALS durch Freeze/Stun/Negation am Handeln gehindert
// (Al: „Ja, Karian wird NIEMALS durch Freeze/Stun/Negation daran gehindert, irgendetwas zu tun.")
// Kartentext: „…While this Hero is Stunned or Frozen, you may perform a second Action with it during your Action Phase and it is otherwise not affected by those effects. Other negative status effects don't affect this Hero."
// Erwartung: (a) gefroren/betäubt: Reaktion im Gegnerzug spielbar; (b) die zentralen Prüfer (`canHeroPerformAction`, `isHeroIncapacitated`, `_heroCanAct`, `_isHeroEffectSilenced`) sehen sie
//   in JEDER Phase beider Züge als handlungsfähig; (c) Frost/Betäubung laufen trotzdem ab (Zugende ihrer Seite) und kommen nicht zurück; (d) Bonus-Aktion in der Action Phase bleibt;
//   (e) Negierung (Weakening Crystal in der Hand, Decisive Defeat) legt sich bei Karian nicht an und hindert sie nicht; (f) eine Heilung entfernt den stillgelegten Status.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KA = 'Grand Inquisitor Karian';
function pickHero(owner, hi) { return (valid) => [valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi).id]; }
function frei(t, hi = 0) {
  const e = t.engine;
  return e.canHeroPerformAction(0, hi) && !e.isHeroIncapacitated(0, hi) && e._heroCanAct(0, hi) && !e._isHeroEffectSilenced(0, hi);
}
(async () => {
  const R = H.runner();
  async function bauen(opts = {}) {
    const t = await H.fresh({ heroes: [[KA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], ...opts });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  }
  for (const status of ['frozen', 'stunned']) {
    // (a) Reaktion im Gegnerzug
    {
      const t = await bauen({ hand: [['Spectral Armor'], ['Fireball']], active: 1 });
      t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts'], []]);
      t.gs.currentPhase = 3; t.gs.activePlayer = 1;
      await t.run(() => t.engine.addHeroStatus(0, 0, status, { duration: 2, appliedBy: 1 }));
      t.policy.confirm = true; t.targetFn = pickHero(0, 0);
      const r = await t.play(1, 'Fireball', { hero: 0 });
      R.check(`(a/${status}) Reaktion im Gegnerzug (Spectral Armor): 150 → 75`, r === true && t.hp(0, 0) === 725, { r, hp: t.hp(0, 0) });
      R.check(`(a/${status}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
    // (b)+(c) alle Phasen beider Züge, Ablauf
    {
      const t = await bauen();
      await t.run(() => t.engine.addHeroStatus(0, 0, status, { duration: 1, appliedBy: 1 }));   // im eigenen Zug aufgelegt (Dauer 1 = bis Zugende)
      R.check(`(b/${status}) sofort nach dem Auflegen handlungsfähig`, frei(t) && !t.hero(0, 0).statuses[status], { st: Object.keys(t.hero(0, 0).statuses) });
      const phasen = [];
      const orig = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = async (name, ctx) => { const r = await orig(name, ctx); if (name === 'onPhaseStart' || name === 'onPhaseEnd') phasen.push([name, ctx && ctx.phaseIndex, frei(t) ? 1 : 0, t.hero(0, 0).statuses[status] ? 1 : 0]); return r; };
      await t.endTurn();                      // Zugende Sitz 0 (END-Zählung), Sitz 1 am Zug
      t.engine.runHooks = orig;
      R.check(`(b/${status}) nach Zugende: Status abgelaufen, nicht zurückgekehrt`, !t.hero(0, 0).statuses[status] && !t.hero(0, 0)._karianSuspendedParalysis, { st: Object.keys(t.hero(0, 0).statuses), stash: t.hero(0, 0)._karianSuspendedParalysis });
      const sichtbar = phasen.filter(p => p[3] === 1);
      R.note(`(b/${status}) Phasen mit sichtbarem Status (nur das Ablauf-Fenster erlaubt)`, JSON.stringify(sichtbar));
      const sichtbarUnfrei = phasen.filter(p => p[2] === 0 && !(p[1] === 5 && p[0] === 'onPhaseStart'));
      R.check(`(b/${status}) außerhalb des Ablauf-Fensters nie gehindert`, sichtbarUnfrei.length === 0, sichtbarUnfrei);
      R.check(`(b/${status}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
    // Gegnerzug: im Zug des Gegners aufgelegt, in allen Phasen frei, taut am Ende IHRES nächsten Zuges
    {
      const t = await bauen();
      await t.endTurn();                                           // Sitz 1 am Zug
      await t.run(() => t.engine.addHeroStatus(0, 0, status, { duration: 1, appliedBy: 1 }));
      R.check(`(c/${status}) im Gegnerzug aufgelegt: sofort handlungsfähig`, frei(t) && !t.hero(0, 0).statuses[status]);
      await t.endTurn();                                           // Sitz 0 am Zug (Action Phase erreichbar)
      R.check(`(c/${status}) in ihrem Zug handlungsfähig`, frei(t), { st: Object.keys(t.hero(0, 0).statuses) });
      await t.endTurn();                                           // Zugende Sitz 0: Zählung → abgelaufen
      R.check(`(c/${status}) nach ihrem Zugende abgelaufen`, !t.hero(0, 0).statuses[status] && !t.hero(0, 0)._karianSuspendedParalysis, { st: Object.keys(t.hero(0, 0).statuses), stash: t.hero(0, 0)._karianSuspendedParalysis });
      R.check(`(c/${status}) keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  {   // (d) Bonus-Aktion in der Action Phase
    const t = await bauen();
    await t.run(() => t.engine.addHeroStatus(0, 0, 'frozen', { duration: 2, appliedBy: 1 }));
    t.gs.currentPhase = 3;
    await t.run(() => t.engine.runHooks('onPhaseStart', { phase: 'ACTION', phaseIndex: 3 }));
    const b = t.gs.players[0].bonusActions;
    R.check('(d) Bonus-Aktion in der Action Phase', !!b && b.remaining === 1 && b.heroIdx === 0, b);
  }
  {   // (e) Negierung: Weakening Crystal in der Hand
    const t = await bauen({ hand: [['Weakening Crystal'], []] });
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('(e) Weakening Crystal: Karian nicht negiert', !t.hero(0, 0).statuses.negated, Object.keys(t.hero(0, 0).statuses));
    R.check('(e) Weakening Crystal: andere Helden negiert (Kontrolle)', !!t.hero(0, 1).statuses.negated && !!t.hero(0, 2).statuses.negated);
    R.check('(e) Karian handlungsfähig', frei(t));
  }
  {   // (e2) Decisive Defeat
    const t = await bauen({ hand: [[], ['Decisive Defeat']] });
    t.targetFn = pickHero(0, 0);
    await t.play(1, 'Decisive Defeat', { hero: 0, targetOwner: 0 });
    R.check('(e2) Decisive Defeat: Karian nicht negiert', !t.hero(0, 0).statuses.negated, Object.keys(t.hero(0, 0).statuses));
    R.check('(e2) Karian handlungsfähig', frei(t));
    R.check('(e2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (f) Heilung/Entfernen des stillgelegten Status
    const t = await bauen();
    await t.run(() => t.engine.addHeroStatus(0, 0, 'frozen', { duration: 3, appliedBy: 1 }));
    R.check('(f) Vorprobe: Status liegt im Stash', !!t.hero(0, 0)._karianSuspendedParalysis?.frozen);
    await t.run(() => t.engine.removeHeroStatus(0, 0, 'frozen'));
    R.check('(f) Entfernen räumt den Stash', !t.hero(0, 0)._karianSuspendedParalysis, t.hero(0, 0)._karianSuspendedParalysis);
  }
  {   // (g) Kontrolle: andere Helden werden weiter gehindert
    const t = await bauen();
    await t.run(() => t.engine.addHeroStatus(0, 1, 'frozen', { duration: 2, appliedBy: 1 }));
    R.check('(g) Kontrolle: ein anderer gefrorener Held bleibt gehindert', !t.engine._heroCanAct(0, 1) && t.engine.isHeroIncapacitated(0, 1));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
