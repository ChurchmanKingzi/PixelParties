'use strict';
// W13a · Q124 (H03-heroes-16, Nicolas, the Hidden Alchemist, Randfall „tot") · Al, 15.10.2026: „Ja, soll sie"
// Kartentext Nicolas: „After you have played your second Potion during a turn, you cannot play Potions for the rest of that turn (even if this Hero gets defeated before then)."
// Erwartet: Die Trank-Sperre entsteht auch, wenn Nicolas zwischen dem 1. und 2. Trank (im selben Zug) fällt. Weiter unverändert: ein Nicolas, dessen Effekt beim Fall
//   ruht (negiert/gefroren/betäubt), sperrt nicht; ein in einem früheren Zug gefallener Nicolas sperrt nicht; ohne Fall bleibt es bei der normalen Sperre.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  const NICOLAS = 'Nicolas, the Hidden Alchemist';
  async function lauf(zwischen) {
    const t = await H.fresh({ heroes: [[NICOLAS, ...fill], null], hp: 600, hand: [Array(4).fill('Elixir of Quickness'), []], deck: [Array(30).fill('Heal'), Array(30).fill('Heal')] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const res = [];
    for (let i = 0; i < 4; i++) {
      if (i === 1 && zwischen) await zwischen(t);
      res.push(await t.play(0, 'Elixir of Quickness', { hero: 0 }));
    }
    return { res, t };
  }
  const toeten = (t) => t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 0), 9999, 'spell'));

  let x = await lauf(null);
  R.check('Kontrolle (lebt): 3. und 4. Trank gesperrt', x.res.join() === 'true,true,false,false', x.res);

  x = await lauf(toeten);
  R.check('Nicolas fällt nach dem 1. Trank: Held ist tot', x.t.hp(0, 0) <= 0, x.t.hp(0, 0));
  R.check('Nicolas fällt nach dem 1. Trank: 3. und 4. Trank dennoch gesperrt', x.res.join() === 'true,true,false,false', x.res);
  R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  await x.t.endTurn(); await x.t.endTurn();
  R.check('im nächsten eigenen Zug ist die Sperre weg', x.t.gs.players[0].potionLocked === false, x.t.gs.players[0].potionLocked);

  x = await lauf(async (t) => { t.heroStatus(0, 0, 'frozen', { appliedTurn: t.gs.turn, duration: 3 }); await toeten(t); });
  R.check('Nicolas fällt im gefrorenen Zustand (Effekt ruht): keine Sperre', x.res.every(r => r === true), x.res);

  // früherer Zug gefallen: Nicolas stirbt im Gegnerzug, im eigenen Zug werden vier Tränke gespielt
  {
    const t = await H.fresh({ heroes: [[NICOLAS, ...fill], null], hp: 600, hand: [Array(4).fill('Elixir of Quickness'), []], deck: [Array(30).fill('Heal'), Array(30).fill('Heal')] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    await t.endTurn();
    await toeten(t);
    await t.endTurn();
    const res = [];
    for (let i = 0; i < 4; i++) res.push(await t.play(0, 'Elixir of Quickness', { hero: 1 }));
    R.check('Nicolas in einem früheren Zug gefallen: keine Sperre', res.every(r => r === true), res);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
