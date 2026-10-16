'use strict';
// W14a · Rückfrage 3 (Welle 13 / W13a; H03-heroes-16 Nicolas, the Hidden Alchemist) · Al, 16.10.2026: „Ja" —
//   die Trank-Sperre greift auch, wenn Nicolas schon VOR dem ersten Trank im selben Zug fiel (Ist-Zustand, Absicherung).
// Kartentext: „After you have played your second Potion during a turn, you cannot play Potions for the rest of that turn (even if this Hero gets defeated before then)."
// Erwartet: Nicolas fällt zu Beginn des Zuges (0 Tränke gespielt) → 1. und 2. Trank gehen, ab dem 3. gesperrt. Im nächsten eigenen Zug ist die Sperre weg.
//   Gegenprobe: ein in einem früheren Zug gefallener Nicolas sperrt nicht; ein im gefrorenen Zustand gefallener (Effekt ruht) auch nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  const NICOLAS = 'Nicolas, the Hidden Alchemist';
  const mk = async () => {
    const t = await H.fresh({ heroes: [[NICOLAS, ...fill], null], hp: 600, hand: [Array(4).fill('Elixir of Quickness'), []], deck: [Array(30).fill('Heal'), Array(30).fill('Heal')] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  };
  const toeten = (t) => t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 0), 9999, 'spell'));
  const tranke = async (t, n = 4) => { const res = []; for (let i = 0; i < n; i++) res.push(await t.play(0, 'Elixir of Quickness', { hero: 1 })); return res; };

  R.section('Nicolas fällt VOR dem ersten Trank desselben Zuges');
  {
    const t = await mk();
    await toeten(t);
    R.check('Nicolas ist tot', t.hp(0, 0) <= 0, t.hp(0, 0));
    const res = await tranke(t);
    R.check('1. und 2. Trank gehen, 3. und 4. sind gesperrt', res.join() === 'true,true,false,false', res);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    await t.endTurn(); await t.endTurn();
    R.check('im nächsten eigenen Zug ist die Sperre weg', t.gs.players[0].potionLocked === false, t.gs.players[0].potionLocked);
  }
  R.section('Gegenproben');
  {
    const t = await mk();
    await t.endTurn();
    await toeten(t);
    await t.endTurn();
    const res = await tranke(t);
    R.check('in einem früheren Zug gefallen: keine Sperre', res.every(r => r === true), res);
  }
  {
    const t = await mk();
    t.heroStatus(0, 0, 'frozen', { appliedTurn: t.gs.turn, duration: 3 });
    await toeten(t);
    const res = await tranke(t);
    R.check('gefroren gefallen (Effekt ruht): keine Sperre', res.every(r => r === true), res);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
