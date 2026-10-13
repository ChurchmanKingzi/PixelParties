'use strict';
// S02-08 · Heat Wave nach Flame Avalanche: die Schadenssperre unterdrückt auch den Schaden an EIGENEN vorverbrannten Zielen (Regelfrage)
// Kartentexte: Flame Avalanche „You cannot deal any other damage to targets your opponent controls this turn."
//   Heat Wave „Burn all targets on the board, except the user, for the rest of the game. Targets that are already Burned take 150 damage instead."
// Aufbau: Sitz 0 hat zwei Zusatzaktionen simuliert (t.play setzt die Aktion zurück): erst Flame Avalanche, dann Heat Wave. Vorverbrannt: eine eigene Kreatur
//   (Held 1) und der eigene Held 2; ebenso eine Gegnerkreatur und der Gegnerheld 2.
// Erwartet: Gegnerziele gesperrt (0 Schaden); EIGENE vorverbrannte Ziele nehmen 150 – die Sperre betrifft nur „targets your opponent controls".
// Beobachtet: Auch die eigenen vorverbrannten Ziele nehmen keinen Schaden.
// Ursache: `cards/effects/heat-wave.js` Z. ~204: `amount = (preBurned[i] && !damageLocked) ? DAMAGE : 0` – `ps.damageLocked` nullt den Schaden für ALLE Ziele
//   (Kopfkommentar Z. 19-24 nennt das als Absicht „damage branch suppressed"); die Engine selbst (`_engine.js` ~8790) sperrt nur Gegnerziele.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Flame Avalanche', 'Heat Wave'], []] });
  const mk = (s, h) => { const c = t.put(s, h, 0, H.INERT.big); c.counters.currentHp = 1000; c.counters.maxHp = 1000; return c; };
  const mine = mk(0, 1); mine.counters.burned = true;
  const opp = mk(1, 1); opp.counters.burned = true;
  t.hero(0, 2).statuses.burned = { permanent: true };
  t.hero(1, 2).statuses.burned = { permanent: true };
  await t.play(0, 'Flame Avalanche', { hero: 0 });
  const oHp = opp.counters.currentHp, mHp = mine.counters.currentHp, m2 = t.hp(0, 2), o2 = t.hp(1, 2);
  const r = await t.play(0, 'Heat Wave', { hero: 0 });
  t.say('Heat Wave gespielt:', r, '| eigene Kreatur', mHp, '->', mine.counters.currentHp, '| eigener Held 2', m2, '->', t.hp(0, 2));
  R.check('Heat Wave gespielt', r === true, r);
  R.check('Kontrolle: Gegnerziele gesperrt', opp.counters.currentHp === oHp && t.hp(1, 2) === o2, [opp.counters.currentHp, t.hp(1, 2)]);
  R.check('EIGENE vorverbrannte Kreatur nimmt 150', mine.counters.currentHp === mHp - 150, mine.counters.currentHp);
  R.check('EIGENER vorverbrannter Held 2 nimmt 150', t.hp(0, 2) === m2 - 150, t.hp(0, 2));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
