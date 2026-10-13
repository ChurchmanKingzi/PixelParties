'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-07 · Lord Mithuru (dauerhaft übernommen) senkt die Stufe für einen ANDEREN Helden mit gleichem Index
//
//  Karte: Lord Mithuru, the Rotten Mastermind (`cards/effects/lord-mithuru-the-rotten-mastermind.js`, `reduceCardLevel`)
//  Kartentext: „This Hero may perform Double Spells as if their levels were reduced by 2."  ← nur DIESER Held.
//  Aufbau: Sitz 1 hat Mithuru auf Held 0; Sitz 0 übernimmt ihn dauerhaft (`actionTakeHeroPermanently`, Paraseed-Weg). Sitz 0 hat auf
//  Held 0 (eigen: Tushu) KEINE Schulen und „Icebolt" (Lv2 Decay+Destruction, Doppelspell) auf der Hand.
//  Erwartung: Tushu darf Icebolt weiterhin nicht wirken (Lv2 ohne Schule). Nur Mithuru selbst ist begünstigt.
//  Beobachtung (✗): Tushu wirkt Icebolt. `reduceCardLevel` vergleicht nur `heroIdx !== inst.heroIdx` (beides 0), der Kontrolleur-Filter
//  der Engine (`_applyCardLevelReductions`) lässt Mithurus Instanz wegen der Übernahme für Sitz 0 gelten – die Seite des Wirkers kennt der
//  Vertrag `reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx, evalOpts)` nicht (es gibt nur den Index, nicht die Brettseite).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/07-mithuru-uebernommen-senkt-fuer-fremden-helden.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const MITHURU = 'Lord Mithuru, the Rotten Mastermind';
(async () => {
  const R = H.runner();
  async function szene(uebernehmen) {
    const t = await H.fresh({ heroes: [['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], [MITHURU, 'Atta, Speaker of Desires', 'Hulijing, the Foxdemon']], hp: 600, hand: [['Icebolt'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    for (const hi of [0, 1, 2]) t.setAbilities(0, hi, [[], [], []]);
    if (uebernehmen) await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0));
    t.targetFn = (v) => [(v.find(x => x.owner === 1) || v[0]).id];
    return t;
  }
  R.section('Kontrolle: ohne Übernahme');
  let t = await szene(false);
  R.check('Tushu (H0, ohne Schule) kann Icebolt nicht wirken', (await t.play(0, 'Icebolt', { hero: 0, noGrant: true })) === false);

  R.section('Befund: Mithuru von Sitz 0 übernommen, Tushu (gleicher Index 0) wirkt');
  t = await szene(true);
  R.note('Kontrolleur von Mithuru', t.engine.heroSideOf(1, t.hero(1, 0)));
  const r = await t.play(0, 'Icebolt', { hero: 0, noGrant: true });
  R.check('Tushu bekommt KEINE Stufensenkung von Mithuru (Icebolt bleibt unspielbar)', r === false, r);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
