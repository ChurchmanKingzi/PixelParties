'use strict';
// S02-02 · Howling in the Night trifft „Heroes your opponent controls" nach Besitz der Spalte, nicht nach Kontrolle
// Kartentext: „Heroes your opponent controls cannot use Spells until the beginning of your next turn. This counts as a negative status effect."
// Erwartung (CARD_API.md „Kontrolle statt Seite", Skriptkopf „nach KONTROLLE, nicht Besitz"): ein Held MEINER Spalte, den der Gegner
//   (dauerhaft, `permaControlBy`) kontrolliert, ist ein „Hero your opponent controls" und wird mit `frightened` belegt;
//   ein Gegnerheld, den ICH kontrolliere, nicht.
// Beobachtet: Der Gegnerheld unter meiner Kontrolle bleibt richtig frei (✓), mein vom Gegner kontrollierter Held wird NICHT getroffen (✗) –
//   er kann weiter Spells für den Gegner wirken.
// Ursache: howling-in-the-night.js Z. 88–104 läuft nur über `gs.players[oi].heroes` (physische Spalte des Gegners) und überspringt dort
//   `permaControlBy/charmedBy === pi`; `heroesControlledBy(oi)` wird nicht benutzt. Gleiches gilt für `spellPlayCondition`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Howling in the Night'], []] });
  await t.engine.actionTakeHeroPermanently(0, 1, 0);   // ich kontrolliere dauerhaft Gegnerheld 0
  await t.engine.actionTakeHeroPermanently(1, 0, 2);   // der Gegner kontrolliert dauerhaft MEINEN Held 2
  R.note('Kontrolle', { gegnerHeld0_kontrolliertVon: t.engine.heroSideOf(1, t.hero(1, 0)), meinHeld2_kontrolliertVon: t.engine.heroSideOf(0, t.hero(0, 2)) });
  const r = await t.play(0, 'Howling in the Night', { hero: 0 });
  R.check('Zauber gespielt', r === true, r);
  R.check('Gegnerheld 1 und 2 sind frightened', !!t.hero(1, 1).statuses.frightened && !!t.hero(1, 2).statuses.frightened);
  R.check('von mir kontrollierter Gegnerheld 0 ist NICHT frightened', !t.hero(1, 0).statuses.frightened, t.hero(1, 0).statuses);
  R.check('MEIN Held 2, den der Gegner kontrolliert, ist frightened', !!t.hero(0, 2).statuses.frightened, t.hero(0, 2).statuses);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
