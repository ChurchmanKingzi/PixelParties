'use strict';
// N4-archetypen-18 · Spider Silk Bridge: Schaden des Gegners an einem von MIR übernommenen Helden zählt nicht als „damage to any target you control"
// Kartentext (Spider Silk Bridge): „Activate this Surprise when your opponent ends their turn without dealing damage to any target you control that turn. Draw 2 cards. …"
// Ruling (CARD_API.md, Kontroll-Regeln „Wer ist du"/Z1): „you control" = aktueller Kontrolleur, nicht die Brettseite; für Kreaturen gilt das hier bereits (`dealtDamageToOpponent` liest `controller`),
//   die offen liegende Bridge verwirkt über `surpriseKontrolleur` korrekt.
// Aufbau: Sitz 0: Bridge verdeckt in Held 0; Sitz 0 hat Held 1 von Sitz 1 übernommen (actionStealHero 0,1,1). Sitz 1 (am Zug) schadet genau diesem Helden (50) und beendet den Zug.
// Erwartung: Der Gegner hat einem Ziel, das ich kontrolliere, Schaden zugefügt → die Bridge löst NICHT aus. (Gegenproben: Schaden an meinem eigenen Helden → löst nicht aus; ganz ohne Schaden → löst aus.)
// Beobachtet: `actionDealDamage` setzt `dealtDamageToOpponent` nur, wenn der Zielheld im Heldenarray eines ANDEREN Spielers als des Schadenden steht (_engine.js:~9372 `heroes.includes(target)`: Brettseite) →
//   der übernommene Held (im Array von Sitz 1, Schadender Sitz 1) setzt die Marke nicht → die Bridge aktiviert und zieht 2.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function lauf(modus) {
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 1 });
  t.gs.activePlayer = 1;
  t.setAbilities(0, 0, [['Support Magic'], [], []]);
  t.putSurprise(0, 0, 'Spider Silk Bridge');
  t.put(0, 1, 0, H.INERT.big).turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  if (modus === 'uebernommen') { await t.run(() => t.engine.actionStealHero(0, 1, 1)); await sleep(300); }
  if (modus === 'eigener') await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: 1, heroIdx: 0 }, t.hero(0, 2), 50, 'spell'));
  if (modus === 'uebernommen') await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: 1, heroIdx: 0 }, t.hero(1, 1), 50, 'spell'));
  t.reset();
  await t.endTurn();
  return { t, aktiviert: t.logs.some(l => l.type === 'spider_silk_bridge_draw' && l.data.phase === 'activation') };
}
(async () => {
  const R = H.runner();
  R.check('Gegenprobe: ohne jeden Schaden aktiviert die Bridge', (await lauf('keiner')).aktiviert);
  R.check('Gegenprobe: Schaden an meinem eigenen Helden → keine Aktivierung', !(await lauf('eigener')).aktiviert);
  const u = await lauf('uebernommen');
  R.check('Schaden an dem von mir übernommenen Helden → keine Aktivierung (Ziel, das ich kontrolliere)', !u.aktiviert, u.aktiviert);
  R.check('keine Engine-Fehler', u.t.errors.length === 0, u.t.errors);
  R.finish();
})();
