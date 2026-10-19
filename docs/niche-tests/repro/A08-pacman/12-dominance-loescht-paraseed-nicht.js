// A08-12 · Trial of Dominance: gegnerische Paraseeds werden nicht gelöscht, sondern nisten sich beim Wirker ein (und vergiften ihn)
//
// Kartentext Trial of Dominance: „Defeat all Creatures your opponent controls and delete them."
// Kartentext Paraseed: „When this Creature is defeated by a Hero or Creature, place it into one of the attacking or corresponding Hero's free Support Zones
//   INSTEAD OF SENDING IT TO THE DISCARD PILE. While this Creature is in a Hero's Support Zone, that Hero is Poisoned. …"
//
// Ursprüngliche Erwartung (verworfen): Dominance löscht die Paraseeds; die Ersetzung der Paraseed greift nicht, der Wirker bleibt ungiftig.
// ★ W18b (Entscheidung Al, 19.10.2026, A08-12: „Trial of Dominance + Paraseed: Einnisten oder Löschen?" – „Einnisten"): Von Trial of Dominance besiegte Paraseeds NISTEN SICH EIN – sie
//   werden besiegt („Defeat all Creatures …"), die Paraseed-Ersetzung („statt auf den Ablagestapel") greift also, und das Löschen trifft sie nicht mehr. Beide Paraseeds ziehen in die
//   freien Support Zones des Wirkers (Held 0), der Wirker ist vergiftet, im Gelöscht-Stapel von Sitz 1 liegt nur die andere Kreatur. Das Repro prüft jetzt diese Regel
//   (Ist-Zustand, Skript unverändert; `actionDestroyCard` löst den Todes-Anspruch `_deathClaim` der Paraseed vor der Löschumleitung ein).
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
  R.check('beide Paraseeds nisten sich beim Wirker ein (Support Zones von Sitz 0, Held 0)', para.length === 2 && para.every(c => c.zone === 'support' && t.engine.physicalSide(c) === 0 && c.heroIdx === 0), { instanzen: para.map(c => ({ owner: c.owner, hi: c.heroIdx, zone: c.zone })) });
  R.check('die Paraseeds liegen NICHT im Gelöscht-Stapel', t.pile(1, 'deletedPile').filter(n => n === 'Paraseed').length === 0, t.pile(1, 'deletedPile'));
  R.check('die andere Kreatur ist gelöscht (Kontrolle: Dominance löscht)', t.pile(1, 'deletedPile').includes(D), t.pile(1, 'deletedPile'));
  R.check('der Wirker (Sitz 0, Held 0) ist vergiftet', !!t.hero(0, 0).statuses.poisoned, Object.keys(t.hero(0, 0).statuses));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
