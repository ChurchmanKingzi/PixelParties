'use strict';
// C01-creatures-17 · Cats of the Pharaoh: „if you control no Creatures" ignoriert Kreatur-Tokens (Mummy/Invader/Leprochaun Token)
// Kartentext: „At the start of your turn, if you control no Creatures, you may summon this Creature from your discard pile as an additional Action …"
// Die Kreatur-Tokens haben `cardType: 'Token'`, `subtype: 'Creature'`, 50 HP; `hasCardType(cd, 'Creature')` (_hooks.js ~515) zählt sie als Kreatur (so fragen Bunny Bombs, Orkallion, Bomb Mite …).
// Aufbau: Seed 1234. Sitz 0: Held 0 mit Summoning Magic Lv1, Cats in der Ablage, ein „Mummy Token" in Held 1 / Zone 0. Zugwechsel (Sitz 1 beendet, Sitz 0 beginnt).
// Erwartung: Sitz 0 kontrolliert eine Kreatur (den Token) – Cats wird NICHT angeboten.
// Beobachtet: Das Angebot (Ja/Nein + Zonenwahl) erscheint, Cats wird beschworen und `searchLocked` gesetzt.
// Ursache: cards/effects/cats-of-the-pharaoh.js `kontrolliertKreaturen` (Z. ~48-60): `(cd.cardType || '').toLowerCase() !== 'creature'` statt `hasCardType(cd, 'Creature')`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const C = 'Cats of the Pharaoh';
  const t = await H.fresh({ discard: [[C], []], abilities: { 0: { 0: [['Summoning Magic'], [], []], 1: [[], [], []], 2: [[], [], []] } } });
  const gs = t.gs, e = t.engine, ps = gs.players[0];
  await t.run(() => e.actionPlaceCreature('Mummy Token', 0, 1, 0, { source: 'external', sourceName: 'Test', fireHooks: false }));
  R.check('Vorbedingung: ein Mummy Token liegt auf dem Brett', !!t.find('Mummy Token', 'support'));
  t.script.push({ match: d => d.type === 'confirm' && d.title === C, answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'zonePick' && d.title === C, answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
  await t.endTurn(); t.reset();
  await t.endTurn();
  const angebot = t.prompts.some(p => p.d.title === C);
  R.note('Ausgang', { angebot, catsAufBrett: !!t.find(C, 'support'), searchLocked: !!ps.searchLocked });
  R.check('Cats wird nicht angeboten, solange ich eine Kreatur (den Token) kontrolliere', !angebot && !t.find(C, 'support'), { angebot });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
