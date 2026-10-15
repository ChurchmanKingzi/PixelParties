'use strict';
// W13a · Q121 (H03-heroes-02, Pseudonia mit Damsels Effekt) · Al, 15.10.2026: „Ja, bekommt sie."
// Erwartet: Pseudonia bekommt mit dem gewonnenen Effekt von Rescued Damsel Cecilia das Extra-Leben („immediately revive it and heal its HP completely"),
//   obwohl sie kein Ascended Hero ist — einmal; danach wächst es nicht nach (auch nicht zum nächsten Zugbeginn); der zweite tödliche Schlag tötet sie.
const H = require('../../lib/h.js');
const PSEUDO = 'Pseudonia, the Skill Devourer';
const DAMSEL = 'Rescued Damsel Cecilia';
const FILL = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[PSEUDO, ...FILL], null], hp: 400 });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.engine.grantHeroEffect(0, 0, DAMSEL);
  await t.run(() => t.engine.finishGainedHeroEffects(0, 0));
  R.check('Pseudonia trägt das Extra-Leben (Damsels Effekt)', !!t.hero(0, 0)._extraLife, t.hero(0, 0)._extraLife);
  await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 0), 9999, 'spell'));
  R.check('erster tödlicher Schlag: Pseudonia steht auf (volle HP)', t.hp(0, 0) === 400, t.hp(0, 0));
  R.check('das Extra-Leben ist verbraucht', !t.hero(0, 0)._extraLife, t.hero(0, 0)._extraLife);
  await t.endTurn(); await t.endTurn();
  R.check('nach zwei Zugwechseln wächst es nicht nach', !t.hero(0, 0)._extraLife, t.hero(0, 0)._extraLife);
  await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 0), 9999, 'spell'));
  R.check('zweiter tödlicher Schlag: Pseudonia bleibt tot', t.hp(0, 0) <= 0, t.hp(0, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  // (Hinweis: `t.audit()` meldet nach dem Tod eines Trägers die unsichtbare Träger-Instanz des gewonnenen Effekts als „Geister-Instanz" — bei JEDEM gewonnenen
  //  Effekt (auch Pete), nicht Teil dieser Frage.)
  // Gegenprobe: der echte Ascended Hero verhält sich wie bisher
  const u = await H.fresh({ heroes: [[DAMSEL, ...FILL], null], hp: 400 });
  await u.run(() => u.engine.runHooks('onGameStart', {}));
  await u.run(() => u.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, u.hero(0, 0), 9999, 'spell'));
  R.check('Gegenprobe: echte Damsel steht beim ersten tödlichen Schlag auf', u.hp(0, 0) > 0, u.hp(0, 0));
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
