'use strict';
// W13a · Q136 (M01-06, Friendship Lv1: Zusatzaktion gesperrt, wenn vorher schon ein Support-Magic-Spell gewirkt wurde) · Al, 15.10.2026: „Nein"
// Absicherung des Ist-Zustands (keine Änderung): Friendship Lv1 darf die Zusatzaktion NICHT nutzen, wenn in diesem Zug schon ein Support-Magic-Spell gewirkt
//   wurde; in der Gegenrichtung (erst Friendship-Zusatz, dann normal) sperrt `supportSpellLocked`. Lv2 bleibt unverändert erlaubt (Zusatzaktion, danach Ziehen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const neu = async (lvl) => {
    const t = await H.fresh({ hand: [['Haste', 'Haste', 'Haste'], []], hp: 800, deckSize: 30, abilities: { 0: { 0: [['Support Magic'], Array(lvl).fill('Friendship'), []] } } });
    await t.run(() => t.engine.runHooks('onTurnStart', { turn: t.gs.turn, activePlayer: 0 }));
    return t;
  };
  R.section('Lv1: erst normales Support-Spell, dann Friendship-Zusatz → abgelehnt');
  {
    const t = await neu(1);
    const r1 = await t.play(0, 'Haste', { hero: 0, noGrant: true });
    const r2 = await t.play(0, 'Haste', { hero: 0, noGrant: true, keepActions: true });
    R.check('erstes Haste (normale Aktion) gewirkt', r1 === true, r1);
    R.check('zweites Haste (Friendship-Zusatzaktion) abgelehnt', r2 === false, r2);
    R.check('Hand: zwei Haste bleiben', t.pile(0, 'hand').filter(c => c === 'Haste').length === 2, t.pile(0, 'hand'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('Lv2: unverändert erlaubt');
  {
    const t = await neu(2);
    const r1 = await t.play(0, 'Haste', { hero: 0, noGrant: true });
    const r2 = await t.play(0, 'Haste', { hero: 0, noGrant: true, keepActions: true });
    R.check('Lv2: beide Haste gewirkt', r1 === true && r2 === true, { r1, r2 });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
