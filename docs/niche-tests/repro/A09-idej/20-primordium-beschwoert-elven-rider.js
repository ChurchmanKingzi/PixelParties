'use strict';
// A09-20 · Tamed Primordium bietet Elven Rider an und beschwört ihn – obwohl Rider „nur mit dem eigenen Effekt" beschworen werden darf
// Kartentext Elven Rider: „You cannot summon this Creature, except with its own effect."
// Kartentext Tamed Primordium: „When this Creature is summoned via an effect … you may immediately summon up to 2 level 1 or lower Creatures from your hand as additional Actions."
// Skript: tamed-primordium.js `eligibleHand` filtert nur Kreaturentyp, Stufe und freie Zone. Elven Druid schließt den Rider ausdrücklich aus (`EXCLUDE_SET`).
// Das Skript des Riders verlässt sich darauf, dass `validateActionPlay` Reaction-Karten am proaktiven Spielen hindert (elven-rider.js Kopfkommentar) –
// `summonFromPile` (Weg des Primordium) hat diese Sperre nicht.
// Aufbau: Seed 1234. Sitz 0: Held 0 mit Summoning Magic 1, Hand [Elven Rider, Elven Archer], Deck mit Elven Leader. Main 1. Primordium wird per Effekt beschworen (summonCreatureWithHooks).
// Schritte: Primordium beschwören, Ja, im Katalog die erste Karte wählen (Rider ist dort gelistet).
// Erwartet: Rider wird nicht angeboten.
// Beobachtet: Rider steht in der Galerie, landet auf dem Brett, und seine Beschwörungs-Suche läuft (Elven Leader kommt auf die Hand) – ohne dass je ein Elven-Kamerad die Zone verlassen hat.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Elven Rider', 'Elven Archer'], []], gold: [100, 100], phase: 2,
    deck: [['Elven Leader', ...Array(10).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Tamed Primordium', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Tamed Primordium', answer: (d) => ({ cardName: d.cards.find(c => c.name === 'Elven Rider') ? 'Elven Rider' : d.cards[0].name, source: 'hand' }) });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Elven Rider', answer: (d) => ({ cardName: d.cards[0].name }) });
  await t.run(() => t.engine.summonCreatureWithHooks('Tamed Primordium', 0, 0, 0, { source: 'x' }));
  const galerie = t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === 'Tamed Primordium').map(p => p.d.cards.map(c => c.name));
  R.check('Elven Rider wird in der Primordium-Galerie nicht angeboten', !galerie.some(g => g.includes('Elven Rider')), galerie);
  R.check('Elven Rider steht nicht auf dem Brett', !t.find('Elven Rider', 'support'), [0, 1, 2].map(s => t.zone(0, 0, s)));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
