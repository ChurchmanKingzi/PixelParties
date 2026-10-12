'use strict';
// A06-rebelliokai-02 · Loyal Bone Dog wird bei „defeated" ohne Schaden (Zerstören/Opfer) nicht angeboten
// Kartentext (Loyal Bone Dog): „When a "Loyal" or "Skeleton" Creature you control is defeated, you may discard this card
//   from your hand to revive that Creature immediately into the same Support Zone it occupied."
// Beobachtung: Das Vor-Niederlage-Fenster öffnet sich bei Zerstörung/Opfer nur für Karten mit `preDefeatOnDestroy`
//   (_engine.js:32905, CARD_API.md „v1313"); Bone Dog trägt das Flag nicht (loyal-bone-dog.js) → bei einem Zerstören-Effekt
//   des Gegners (Censpartan, Ralzish, The Yeeting …) oder einem Opfer kommt KEIN Angebot, die Kreatur bleibt tot.
//   Bei tödlichem SCHADEN funktioniert die Karte (Gegenprobe unten ✓).
// Erwartung laut Text: „defeated" ist nicht auf Schaden beschränkt (vgl. Chess-Ruling 6.9: Opfer = defeated).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Opp Source', owner: 1, heroIdx: 0 };
  const dog = 'Loyal Bone Dog';
  // Gegenprobe: tödlicher Schaden
  let t = await H.fresh({ hand: [[dog], []] });
  t.grantFor(0, 0, dog);
  let b = t.put(0, 0, 0, 'Loyal Beagle');
  await t.run(() => t.engine.actionDealCreatureDamage(src, b, 500, 'creature', { sourceOwner: 1 }));
  R.check('Gegenprobe: bei tödlichem Schaden wird Beagle wiederbelebt', t.zone(0, 0, 0) === 'Loyal Beagle', t.zone(0, 0, 0));
  // Zerstören durch den Gegner
  t = await H.fresh({ hand: [[dog], []] });
  t.grantFor(0, 0, dog);
  b = t.put(0, 0, 0, 'Loyal Beagle');
  await t.run(() => t.engine.actionDestroyCard(src, b));
  R.check('Zerstören durch den Gegner: Bone Dog wird angeboten und belebt die Beagle wieder', t.zone(0, 0, 0) === 'Loyal Beagle',
    { zone: t.zone(0, 0, 0), hand: t.pile(0, 'hand'), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
