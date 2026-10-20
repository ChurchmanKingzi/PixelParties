'use strict';
// N3-02 · Disgruntled Forest Warden: „while you control at least 1 Ascended Hero" liest die eigene Heldenreihe statt der kontrollierten Helden
// Kartentext: „You can only summon this Creature while you control at least 1 Ascended Hero."
// Regel: „Karten mit ‚Hero you control': Nur der aktuelle Kontrolleur, inklusive eines temporären Kontrolleurs" (Al, Welle 22; FIXES-WELLE-22.md);
//   „Kontrolle statt Seite" (CARD_API.md v1482: nie `gs.players[x].heroes`, sondern `engine.heroesControlledBy`/`heroSideOf`).
// Aufbau: Sitz 0 will den Warden beschwören. (a) Ein Aufgestiegener des GEGNERS (Seite 1, Held 1) ist von Sitz 0 übernommen (Charme): Sitz 0 kontrolliert ihn.
//   (b) Ein Aufgestiegener von Sitz 0 (Held 1) ist vom Gegner übernommen: Sitz 0 kontrolliert ihn nicht mehr.
// Erwartet: (a) beschwörbar, (b) nicht beschwörbar.   Beobachtet: (a) nicht beschwörbar, (b) beschwörbar (`canSummon` zählt `ps.heroes` der Seite).
// Ursache: cards/effects/disgruntled-forest-warden.js `controlsAscendedHero` (Z. 34-39) liest `engine.gs.players[pi].heroes`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ASC = 'Sparrow, the Buffoon of the Treasure Cave';   // Ascended Hero
  const W = 'Disgruntled Forest Warden';
  const SCRIPT = require('../../../../cards/effects/disgruntled-forest-warden.js');
  const kannBeschwoeren = (t) => SCRIPT.canSummon({ _engine: t.engine, cardOwner: 0 });
  {
    const t = await H.fresh({ hand: [[W], []] });
    R.check('Gegenprobe: ohne Aufgestiegenen nicht beschwörbar', kannBeschwoeren(t) === false);
    t.setHero(0, 1, ASC, 600);
    R.check('Gegenprobe: eigener Aufgestiegener (Held 1) → beschwörbar', kannBeschwoeren(t) === true);
    R.check('Gegenprobe: echter Spielweg nimmt die Karte an', (await t.play(0, W, { hero: 0 })) === true && !!t.find(W, 'support'));
  }
  {
    const t = await H.fresh({ hand: [[W], []] });
    t.setHero(1, 1, ASC, 600);
    const ok = t.engine.actionStealHero(0, 1, 1, { sourceName: 'test' });
    R.check('Aufbau (a): Aufgestiegener des Gegners (1/1) von Sitz 0 übernommen', ok === true && t.engine.heroSideOf(1, t.hero(1, 1)) === 0, ok);
    R.check('(a) Sitz 0 kontrolliert einen Aufgestiegenen → Warden beschwörbar', kannBeschwoeren(t) === true);
    const r = await t.play(0, W, { hero: 0 });
    R.check('(a) echter Spielweg: Warden liegt auf dem Brett', r === true && !!t.find(W, 'support'), { r, hand: t.pile(0, 'hand') });
  }
  {
    const t = await H.fresh({ hand: [[W], []] });
    t.setHero(0, 1, ASC, 600);
    const ok = t.engine.actionStealHero(1, 0, 1, { sourceName: 'test' });
    R.check('Aufbau (b): eigener Aufgestiegener (0/1) vom Gegner übernommen', ok === true && t.engine.heroSideOf(0, t.hero(0, 1)) === 1, ok);
    R.check('(b) Sitz 0 kontrolliert keinen Aufgestiegenen mehr → Warden NICHT beschwörbar', kannBeschwoeren(t) === false);
    const r = await t.play(0, W, { hero: 0 });
    R.check('(b) echter Spielweg: Warden bleibt auf der Hand', !t.find(W, 'support') && t.pile(0, 'hand').includes(W), { r });
  }
  R.finish();
})();
