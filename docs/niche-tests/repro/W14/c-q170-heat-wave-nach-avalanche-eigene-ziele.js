'use strict';
// W14c · Q170 (S02-08) Heat Wave nach Flame Avalanche: die Sperre betrifft nur Schaden an Zielen, die der Gegner kontrolliert (Al 16.10.2026: „Nur Schaden an Gegnerzielen, eigene kann man noch normal treffen.")
// Erwartet: Gegnerziele (Kreatur, Held) vorverbrannt → 0 Schaden; EIGENE vorverbrannte Ziele (Kreatur, Held) → 150; Brennen wird an nicht verbrannten Zielen weiter gesetzt.
//   Spielbarkeit unter der Sperre: Heat Wave ist spielbar, wenn nur ein EIGENES vorverbranntes Ziel noch Schaden nähme (kein Ziel mehr brennbar).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Flame Avalanche', 'Heat Wave'], []] });
    const mk = (s, h) => { const c = t.put(s, h, 0, H.INERT.big); c.counters.currentHp = 1000; c.counters.maxHp = 1000; return c; };
    const mine = mk(0, 1); mine.counters.burned = true;
    const opp = mk(1, 1); opp.counters.burned = true;
    const mineFresh = mk(0, 2);
    t.hero(0, 2).statuses.burned = { permanent: true };
    t.hero(1, 2).statuses.burned = { permanent: true };
    await t.play(0, 'Flame Avalanche', { hero: 0 });
    const oHp = opp.counters.currentHp, mHp = mine.counters.currentHp, m2 = t.hp(0, 2), o2 = t.hp(1, 2);
    const r = await t.play(0, 'Heat Wave', { hero: 0 });
    R.check('Heat Wave gespielt', r === true, r);
    R.check('Gegnerkreatur (vorverbrannt) gesperrt', opp.counters.currentHp === oHp, opp.counters.currentHp);
    R.check('Gegnerheld (vorverbrannt) gesperrt', t.hp(1, 2) === o2, [o2, t.hp(1, 2)]);
    R.check('EIGENE vorverbrannte Kreatur nimmt 150', mine.counters.currentHp === mHp - 150, mine.counters.currentHp);
    R.check('EIGENER vorverbrannter Held nimmt 150', t.hp(0, 2) === m2 - 150, [m2, t.hp(0, 2)]);
    R.check('eine unverbrannte eigene Kreatur wird nur verbrannt, ohne Schaden', !!mineFresh.counters.burned && mineFresh.counters.currentHp === 1000, mineFresh.counters);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Spielbarkeit: unter der Sperre ist alles Gegnerische schon verbrannt/immun, nur ein eigenes Ziel ist vorverbrannt
    const t = await H.fresh({ hand: [['Heat Wave'], []] });
    for (let s = 0; s < 2; s++) for (let h = 0; h < 3; h++) t.hero(s, h).statuses.burned = { permanent: true };
    const cd = t.engine._getCardDB()['Heat Wave'];
    const sc = require(H.ROOT + '/cards/effects/heat-wave.js');
    t.gs.players[0].damageLocked = true;
    R.check('Sperre + alle Helden schon verbrannt, eigene vorverbrannte Ziele nehmen Schaden: Heat Wave spielbar', sc.spellPlayCondition(t.gs, 0, t.engine) === true);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
