'use strict';
// S03-07 · Memory Blast kann einen vom Gegner dauerhaft übernommenen eigenen HELDEN nicht zurückholen
// Kartentext: „Choose a target your opponent controls and deal damage equal to 10 times the number of cards in your opponent's discard pile to it.
//   If that target was originally controlled by you, permanently regain control of it instead."
// Engine: `actionReturnHeroControl` (11.10., Secret Spell Book: „Take permanent control of all cards … originally owned by you – auch HELDEN, z. B. nach Paraseed Control")
//   gibt es; Paraseed Control übernimmt einen Helden dauerhaft (`actionTakeHeroPermanently`, der Held bleibt physisch in der Spalte seines Besitzers).
// Aufbau: Der Gegner übernimmt meinen Held 2 dauerhaft (`actionTakeHeroPermanently(1, 0, 2)`), seine Ablage hat 5 Karten; ich spiele Memory Blast.
// Erwartet: Mein Held 2 (vom Gegner kontrolliert) ist ein legales Ziel; wird er gewählt, bekomme ich ihn zurück (`permaControlBy` weg, 0 Schaden).
// Beobachtet: Der Held steht gar nicht in der Zielliste (`side: 'enemy'` liest nur die Gegenspalte), und das Skript kennt die Abzweigung nur für Kreaturen
//   („Nur Kreaturen koennen den Besitzer wechseln – bei einem Helden greift die Abzweigung nie").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Memory Blast'], []], discard: [[], Array(5).fill('ZZ Filler')], hp: 500 });
  await t.engine.actionTakeHeroPermanently(1, 0, 2); await H.sleep(80);
  const kontrolleur0 = t.engine.heroSideOf(0, t.gs.players[0].heroes[2]);
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 0 && q.heroIdx === 2); return v ? [v.id] : null; };
  const r = await t.play(0, 'Memory Blast', { hero: 0 });
  const angeboten = t.targets.some(q => q.valid.some(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2));
  R.check('Ausgangslage: Gegner kontrolliert meinen Held 2', kontrolleur0 === 1, kontrolleur0);
  R.check('mein vom Gegner kontrollierter Held 2 steht in der Zielliste', angeboten, t.targets.map(q => q.valid.map(v => `${v.owner}/${v.heroIdx}`)));
  R.check('Memory Blast gespielt und Held 2 gehört wieder mir (Kontrolle zurück, kein Schaden)', r === true && t.engine.heroSideOf(0, t.gs.players[0].heroes[2]) === 0 && t.hp(0, 2) === 500, { r, seite: t.engine.heroSideOf(0, t.gs.players[0].heroes[2]), hp: t.hp(0, 2) });
  R.finish();
})();
