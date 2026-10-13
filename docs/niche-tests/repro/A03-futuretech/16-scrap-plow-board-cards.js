'use strict';
// A03-futuretech-16 · Debt-O-Tron Model Scrap Plow: „any card on the board that is not a Hero“ – Areas (und Surprises) fehlen in der Zielliste
//
// Kartentext: „… you may choose any card on the board that is not a Hero and send it to the discard pile. Creatures sent this way count as being defeated.“
// Vergleich: Destructive Puppet Shishi / The Yeeting / Smug Mastermind Antonia lesen denselben Satz („non-Hero cards on the board“) über
//   `collectNonHeroBoardTargets` (_targeting-shared.js:61): Support, Ability-Stapel-Spitze, Permanent, **Area**, **Surprise**, Coolness-Stack-Spitze.
// Erwartung: Eine Area auf dem Brett (Rioting Village) ist als Ziel wählbar (Area-Karten verlassen das Brett in die Ablage).
// Beobachtet: Die Liste enthält nur Karten aus Support Zones und Ability Zones (Ausrüstung, Kreaturen, Abilities, eigene Modelle); Areas fehlen, verdeckte
//   Surprises ebenfalls (letzteres: Regelfrage, siehe Bericht), auch Permanents/Coolness Stack.
// Ursache: cards/effects/debt-o-tron-model-scrap-plow.js:60 baut die Liste selbst und lässt alles außer `support`/`ability` weg.
const H = require('../../lib/h.js');
const KENT = 'Kent, the Indebted Apprentice', SP = 'Debt-O-Tron Model Scrap Plow';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Future Tech Fists'], []], gold: [0, 100] });
  t.setHero(0, 0, KENT, 400);
  t.putArea(1, 'Rioting Village');
  t.put(0, 2, 2, SP).turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.creature);
  let liste = null;
  t.targetFn = (valid) => { liste = valid.map(v => `${v.type}:${v.cardName}`); return null; };
  await t.play(0, 'Future Tech Fists', { hero: 0, slot: 0 });        // Kent: 20 Gold bei 0 → −20 → Überziehung 20 → Scrap Plow löst aus
  R.check('Scrap Plow hat die Zielwahl geöffnet', Array.isArray(liste), liste);
  R.check('Area „Rioting Village“ ist als Ziel wählbar', (liste || []).some(x => /Rioting Village/.test(x)), liste);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
