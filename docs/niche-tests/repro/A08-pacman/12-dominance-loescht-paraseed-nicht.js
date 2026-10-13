// A08-12 · Trial of Dominance: gegnerische Paraseeds werden nicht gelöscht, sondern nisten sich beim Wirker ein (und vergiften ihn)
//
// Kartentext Trial of Dominance: „Defeat all Creatures your opponent controls and delete them."
// Kartentext Paraseed: „When this Creature is defeated by a Hero or Creature, place it into one of the attacking or corresponding Hero's free Support Zones
//   INSTEAD OF SENDING IT TO THE DISCARD PILE. While this Creature is in a Hero's Support Zone, that Hero is Poisoned. …"
//
// Erwartung: Dominance schickt die Kreaturen nicht auf den Ablagestapel, sondern löscht sie – die Ersetzung der Paraseed („statt sie auf den Ablagestapel zu legen")
//   greift nicht, beide Paraseeds liegen im Gelöscht-Stapel ihres Besitzers, der Wirker bleibt ungiftig.
// Beobachtet: Beide Paraseeds ziehen in die freien Support Zones des Wirkers (Held 0), der Wirker ist vergiftet, im Gelöscht-Stapel liegt nur die andere Kreatur.
//   `actionDestroyCard` löst den Todes-Anspruch `_deathClaim` der Paraseed vor der Löschumleitung (`_redirectToDeleted`) ein (`_engine.js` ~12422-12440).
// Aufruf: node docs/niche-tests/repro/A08-pacman/12-dominance-loescht-paraseed-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, D = H.INERT.creature;
  const t = await H.fresh({ hand: [[], []], deck: [Array(6).fill(F), Array(6).fill(F)] });
  t.put(1, 0, 0, 'Paraseed').turnPlayed = 1;
  t.put(1, 0, 1, 'Paraseed').turnPlayed = 1;
  t.put(1, 1, 0, D).turnPlayed = 1;
  const { syncAllParaseedPoison } = require('../../../../cards/effects/_paraseed-shared.js');
  await t.run(() => syncAllParaseedPoison(t.engine));
  const r = await t.play(0, 'Trial of Dominance', { hero: 0 });
  const para = t.inst(c => c.name === 'Paraseed');
  R.check('Dominance wurde gespielt', r === true, r);
  R.check('beide Paraseeds sind gelöscht (Gelöscht-Stapel von Sitz 1)', t.pile(1, 'deletedPile').filter(n => n === 'Paraseed').length === 2, { geloescht1: t.pile(1, 'deletedPile'), instanzen: para.map(c => ({ owner: c.owner, hi: c.heroIdx, zone: c.zone })) });
  R.check('der Wirker (Sitz 0, Held 0) ist nicht vergiftet', !t.hero(0, 0).statuses.poisoned, Object.keys(t.hero(0, 0).statuses));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
