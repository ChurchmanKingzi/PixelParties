'use strict';
// W13a · Q120 (H02-heroes-35, Lethe) · Al, 15.10.2026: „Lethe/ihr Kopierer wird gesperrt, selbst wenn der Effekt erst im laufenden Zug angenommen wird,
//   sofern die Sperr-Condition erfüllt ist."
// Kartentext Lethe: „This Hero cannot perform Actions if a target you control was defeated since the end of your last turn."
// Erwartet: Ein Held, der Lethes Effekt erst im laufenden Zug annimmt (Shapeshifter in Lethes Gestalt, Pseudonia mit gewonnenem Effekt, jeder Kopierer), ist ab der
//   Annahme gesperrt, sofern die Bedingung („ein eigenes Ziel wurde seit dem Ende deines letzten Zuges besiegt") erfüllt ist; ohne Verlust bzw. nach Ablauf des Fensters nicht.
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter', LE = 'Lethe, the Forgetful Fixer', PSEUDO = 'Pseudonia, the Skill Devourer';
(async () => {
  const R = H.runner();
  const kreaturStirbt = async (t) => { const c = t.put(0, 1, 0, H.INERT.frail); await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 999, 'spell')); };
  const zuLethe = async (t) => {
    t.addHand(0, LE);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: LE, source: 'hand' }), once: true });
    await t.activateHero(0, 0, { phase: 2 });
  };
  const feuer = async (t) => { t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1).id]; return t.play(0, 'Fireball', { hero: 0 }); };
  const szene = async (hero0) => {
    const t = await H.fresh({ heroes: [[hero0, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  };

  R.section('(1) Shapeshifter: Kreatur stirbt im Gegnerzug, im eigenen Zug wird er zu Lethe → gesperrt');
  {
    const t = await szene(SHAPE);
    await t.endTurn();
    await kreaturStirbt(t);
    await t.endTurn();
    await zuLethe(t);
    R.check('Held heißt jetzt Lethe', t.hero(0, 0).name === LE, t.hero(0, 0).name);
    const r = await feuer(t);
    R.check('Fireball gesperrt', r === false, { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('(2) Shapeshifter: Verlust im EIGENEN Zug, danach Lethe-Gestalt (Fenster läuft noch) → gesperrt');
  {
    const t = await szene(SHAPE);
    await kreaturStirbt(t);
    await zuLethe(t);
    const r = await feuer(t);
    R.check('Fireball gesperrt', r === false, { r });
  }
  R.section('(3) Shapeshifter: Verlust im EIGENEN Zug, Zugende → Fenster zu; im nächsten eigenen Zug Lethe-Gestalt → NICHT gesperrt');
  {
    const t = await szene(SHAPE);
    await kreaturStirbt(t);
    await t.endTurn(); await t.endTurn();
    await zuLethe(t);
    const r = await feuer(t);
    R.check('Fireball wirkt (Bedingung nicht mehr erfüllt)', r === true, { r });
  }
  R.section('(4) Shapeshifter: gar kein Verlust → Lethe-Gestalt nicht gesperrt');
  {
    const t = await szene(SHAPE);
    await zuLethe(t);
    const r = await feuer(t);
    R.check('Fireball wirkt', r === true, { r });
  }
  R.section('(5) Pseudonia mit gewonnenem Lethe-Effekt: Verlust im Gegnerzug, Effekt im eigenen Zug gewonnen → gesperrt');
  {
    const t = await szene(PSEUDO);
    await t.endTurn();
    await kreaturStirbt(t);
    await t.endTurn();
    t.engine.grantHeroEffect(0, 0, LE);
    await t.run(() => t.engine.finishGainedHeroEffects(0, 0));
    const r = await feuer(t);
    R.check('Fireball gesperrt', r === false, { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('(6) echte Lethe, Verlust im Gegnerzug → gesperrt (unverändert); echte Lethe ohne Verlust → frei');
  {
    const t = await szene(LE);
    await t.endTurn(); await kreaturStirbt(t); await t.endTurn();
    R.check('echte Lethe gesperrt', (await feuer(t)) === false);
    const u = await szene(LE);
    R.check('echte Lethe ohne Verlust frei', (await feuer(u)) === true);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
