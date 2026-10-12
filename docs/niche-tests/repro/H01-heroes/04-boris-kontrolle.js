'use strict';
// H01-heroes-04 · Boris: Sperre und Abwurf-Verzicht hängen an der Spalte, nicht am Kontrolleur
//
// Kartentext: „Your opponent cannot add any cards originally owned by you to their hand and cannot activate effects that would take control
//   of any targets you control. You may once per turn ignore any effect that would force you to discard cards from your hand …"
// Regel (CARD_API.md „Übernommene Helden gelten als Helden des Kontrolleurs (Styx 28.9.)"): you/your = Kontrolleur, auch für Effekte.
// Erwartung: Steht Boris in Spalte 0, wird aber von Sitz 1 dauerhaft kontrolliert, hat Sitz 1 den wirksamen Boris (Sitz 0 ist der „Gegner",
//   dem Charme gesperrt ist) – Sitz 0 nicht mehr.
// Beobachtet: `borisActive(engine, pi)` / `borisHeroIdx` in cards/effects/boris-the-guardian-of-blackport.js lesen `gs.players[pi].heroes`
//   (Spalte); der Kontrolleur bleibt ohne Schutz, der alte Besitzer behält ihn (Charme ist für Sitz 1 gesperrt, nicht für Sitz 0).
const H = require('../../lib/h.js');
const BORIS = 'Boris, the Guardian of Blackport';
(async () => {
  const R = H.runner();
  const boris = H.loadCardEffect(BORIS);
  const t = await H.fresh({ heroes: [[BORIS, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Charme'], ['Charme']] });
  R.section('Kontrolle: eigener Boris in Spalte 0, unkontrolliert');
  R.check('Charme von Sitz 1 ist gesperrt (Boris-Spalte 0 aktiv)', t.engine.isBorisBlocked('Charme', 1) === true);
  R.check('Charme von Sitz 0 ist frei', t.engine.isBorisBlocked('Charme', 0) === false);
  R.section('Sitz 1 übernimmt Boris dauerhaft');
  await t.engine.actionTakeHeroPermanently(1, 0, 0, { sourceName: 'Test' });
  R.check('Vorprobe: Kontrolleur ist Sitz 1', t.engine.heroSideOf(0, t.hero(0, 0)) === 1);
  R.check('jetzt ist Sitz 0 (Gegner des Boris-Kontrolleurs) gesperrt', t.engine.isBorisBlocked('Charme', 0) === true, { s0: t.engine.isBorisBlocked('Charme', 0), s1: t.engine.isBorisBlocked('Charme', 1) });
  R.check('Sitz 1 (Kontrolleur) ist frei', t.engine.isBorisBlocked('Charme', 1) === false, { s1: t.engine.isBorisBlocked('Charme', 1) });
  R.check('Abwurf-Verzicht: Sitz 1 darf ihn nutzen, Sitz 0 nicht', boris.waivesDiscardCosts(t.engine, 1) === true && boris.waivesDiscardCosts(t.engine, 0) === false,
    { s0: boris.waivesDiscardCosts(t.engine, 0), s1: boris.waivesDiscardCosts(t.engine, 1) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
