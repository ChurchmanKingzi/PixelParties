'use strict';
// S02-14 · Holy Selection mit Ida: die erzwungene Einzelzielwahl ist nicht abbrechbar (Regel 23.9)
// Regel (CARD_API.md Z. 367ff.): „Jede Zielwahl hat einen Cancel-Button … `cancellable: true`. Ausnahme ist nur … eine Pflichtwahl, die der Kartentext erzwingt – dann steht der Grund als Kommentar daneben."
// Kartentext Ida: „This Hero can never hit more than 1 target with a Destruction Spell." Holy Selection: „Deal 200 damage to all Heroes with the Necromancy Ability and Creatures that were summoned by the effect of Necromancy."
// Aufbau: Ida (Held 0 von Sitz 0, Flagge `forcesSingleTarget` per Zugbeginn-Hook gesetzt); zwei Helden mit Necromancy (eigener Held 1, Gegnerheld 0) ⇒ mehr als ein Ziel ⇒ Ida wählt EIN Ziel.
// Erwartet: die Zielwahl hat einen Abbruch-Knopf (`cancellable !== false`); Abbruch ⇒ Karte bleibt auf der Hand.
// Beobachtet: `cancellable: false` (kein Begründungskommentar); die Abbruch-Antwort (null) wird sauber behandelt (Karte zurück), aber ein Mensch kann den Zauber nach dem Ausspielen nicht mehr zurücknehmen.
// Ursache: `cards/effects/holy-selection.js` Z. 175 (`promptDamageTarget … cancellable: false` im Ida-Zweig).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Holy Selection'], []], heroes: [['Ida, the Adept of Destruction', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], undefined] });
  await t.turnStart(0);
  t.setAbilities(0, 1, [['Necromancy'], [], []]);
  t.setAbilities(1, 0, [['Necromancy'], [], []]);
  let cfg = null;
  t.targetFn = (valid, config) => { cfg = config; return null; };
  const r = await t.play(0, 'Holy Selection', { hero: 0 });
  t.say('gespielt:', r, '| cancellable laut Prompt:', cfg && cfg.cancellable, '| Hand', t.pile(0, 'hand'));
  R.check('Ida-Einzelzielwahl ist abbrechbar', !!cfg && cfg.cancellable !== false, cfg && cfg.cancellable);
  R.check('Abbruch: Karte bleibt auf der Hand, kein Schaden', t.pile(0, 'hand').includes('Holy Selection') && t.hp(0, 1) === 800 && t.hp(1, 0) === 800, [t.pile(0, 'hand'), t.hp(0, 1), t.hp(1, 0)]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
