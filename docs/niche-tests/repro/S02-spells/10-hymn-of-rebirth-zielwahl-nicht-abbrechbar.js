'use strict';
// S02-10 · Hymn of Rebirth: Zielwahl ist NICHT abbrechbar (Regel 23.9) – die Einmal-pro-Spiel-Karte lässt sich nach dem Ausspielen nicht zurücknehmen
// Regel (CARD_API.md „ZIELENDE KARTEN SIND IMMER ABBRECHBAR", Als Regel 23.9): „Jede Zielwahl hat einen Cancel-Button … `cancellable: true`. Ausnahme ist nur … eine
//   Pflichtwahl, die der Kartentext erzwingt – dann steht der Grund als Kommentar daneben." und „Abbruch heißt: nichts ist passiert. Die Karte bleibt auf der Hand."
// Kartentext: „Choose a defeated Hero either player controls and revive it, healing its HP completely. You can only play 1 'Hymn of Rebirth' per game."
// Aufbau: Held 1 von Sitz 0 ist besiegt; Held 0 hat Magic Arts 3 + Singing 1 (Stufe 4 − 1). Hymn wird gespielt, die Zielwahl wird abgebrochen (null = Abbruch-Knopf).
// Erwartet: die Zielwahl ist abbrechbar (`cancellable !== false`); nach dem Abbruch liegt die Karte wieder auf der Hand.
// Beobachtet: die Zielwahl wird mit `cancellable: false` angeboten (kein Begründungskommentar); eine Abbruch-Antwort wirft die Karte in die Ablage (verbrannt, Held bleibt tot).
// Ursache: `cards/effects/hymn-of-rebirth.js` Z. 66-70 (`promptEffectTarget … cancellable: false`) und Z. 71 (`if (!chosen || chosen.length === 0) return;` ohne `gs._spellCancelled = true`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Hymn of Rebirth'], []] });
  await t.engine.actionDefeatHero(null, t.hero(0, 1));
  t.setAbilities(0, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], ['Singing'], []]);
  let cfg = null;
  t.targetFn = (valid, config) => { cfg = config; return null; };
  const r = await t.play(0, 'Hymn of Rebirth', { hero: 0, noGrant: true });
  t.say('gespielt:', r, '| cancellable laut Prompt:', cfg && cfg.cancellable, '| Hand', t.pile(0, 'hand'), '| Ablage', t.pile(0, 'discardPile'));
  R.check('Zielwahl ist abbrechbar (cancellable !== false)', !!cfg && cfg.cancellable !== false, cfg && cfg.cancellable);
  R.check('nach Abbruch liegt die Karte wieder auf der Hand', t.pile(0, 'hand').includes('Hymn of Rebirth'), { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
