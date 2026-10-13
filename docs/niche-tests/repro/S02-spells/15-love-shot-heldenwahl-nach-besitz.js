'use strict';
// S02-15 · Love Shot: die Heldenwahl liest die Spalte des Gegners statt „Held, den dein Gegner kontrolliert"
// Kartentext: „Draw a card from your opponent's deck. Then, choose a Hero your opponent controls and perform an Attack or Spell from your hand with it, if possible. …"
// Ruling (CARD_API.md „Kontrolle statt Seite"; „Übernommene Helden gelten als Helden des Kontrolleurs"): maßgeblich ist, wer den Helden KONTROLLIERT.
// Aufbau: Gegnerheld 0 per `actionTakeHeroPermanently(0, 1, 0)` dauerhaft von Sitz 0 kontrolliert; MEIN Held 2 per `actionTakeHeroPermanently(1, 0, 2)` vom Gegner kontrolliert.
//   Sitz 0 spielt Love Shot; die angebotene Heldenliste wird mitgeschnitten, gewählt wird nichts (Abbruch).
// Erwartet: angeboten werden die Helden, die der GEGNER kontrolliert: Gegnerheld 1 und 2 sowie mein Held 2 – nicht der von mir kontrollierte Gegnerheld 0.
// Beobachtet: angeboten werden alle drei physischen Helden der Gegnerspalte (1:0, 1:1, 1:2); der von mir kontrollierte Gegnerheld 0 steht zur Wahl, mein vom Gegner kontrollierter Held 2 fehlt.
// Ursache: `cards/effects/love-shot.js` (`heroTargets`-Schleife, Z. 158): `for (hi …) ops.heroes[hi]` ohne `heroesControlledBy(oi)`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Love Shot', 'Fireball'], []], deckSize: 30 });
  await t.engine.actionTakeHeroPermanently(0, 1, 0);
  await t.engine.actionTakeHeroPermanently(1, 0, 2);
  let offered = null;
  t.targetFn = (valid, cfg) => { if (/Love Shot/.test((cfg && cfg.title) || '')) offered = valid.map(v => `${v.owner}:${v.heroIdx}`); return null; };
  const r = await t.play(0, 'Love Shot', { hero: 0 });
  t.say('Love Shot ->', r, '| angebotene Helden (physisch Sitz:Held):', JSON.stringify(offered));
  R.check('von mir kontrollierter Gegnerheld (1:0) wird NICHT angeboten', !!offered && !offered.includes('1:0'), offered);
  R.check('vom Gegner kontrollierter eigener Held (0:2) wird angeboten', !!offered && offered.includes('0:2'), offered);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
