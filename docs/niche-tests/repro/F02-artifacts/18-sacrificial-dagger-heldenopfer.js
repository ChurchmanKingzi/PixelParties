'use strict';
// F02-18 · Sacrificial Dagger reagiert nur auf geopferte KREATUREN, nicht auf geopferte HELDEN
// Kartentext: „Equip this card to a Hero you control. Once per turn, when you sacrifice a target you control, you may choose a target and deal damage equal to the equipped Hero's Attack stat to it. This counts as the equipped Hero hitting that target with an Attack."
// Aufbau: Sitz 0 (3 Helden): Sacrificial Dagger an Held 0, Hand [Divine Gift of Sacrifice]; Held 1 wird geopfert, Held 2 bekommt die HP.
// Schritte: Divine Gift of Sacrifice spielen (Opfer Held 1, Empfänger Held 2).
// Erwartet (Lesart „target" = Held oder Kreatur; Divine Gift of Sacrifice: „Sacrifice a Hero you originally control"): der Dagger bietet seinen Schlag an (Zielwahl, ATK des Trägers als Schaden).
// Beobachtet: Held 1 ist geopfert (HP 0), Held 2 +800 HP – der Dagger meldet sich nicht (keine Zielwahl, 0 Schaden). Kreaturenopfer lösen ihn aus ✓ (t18 a).
// Vermutete Ursache: sacrificial-dagger.js hört nur auf `hooks.onCreatureSacrificed`; Heldenopfer laufen über `actionDefeatHero(…, { isSacrifice: true })` (`onHeroKO` mit `isSacrifice`), das der Dagger nicht liest.
// Frage an Al: siehe Bericht (F02-18).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Sacrificial Dagger', 'Divine Gift of Sacrifice'], []], gold: [100, 100] });
  await t.play(0, 'Sacrificial Dagger', { hero: 0 });
  t.reset();
  const hp = t.hp(1, 0);
  let wahl = 0;
  t.targetFn = (valid, cfg) => {
    wahl++;
    if (cfg && /Sacrificial Dagger/.test(cfg.title || '')) { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return v ? [v.id] : null; }
    const idx = wahl === 1 ? 1 : 2;   // 1. Wahl: Opfer (Held 1), 2. Wahl: Empfänger (Held 2)
    const v = valid.find(q => q.type === 'hero' && q.owner === 0 && q.heroIdx === idx);
    return v ? [v.id] : [valid[0].id];
  };
  const r = await t.play(0, 'Divine Gift of Sacrifice', { hero: 2 });
  R.check('Divine Gift of Sacrifice gespielt, Held 1 geopfert', r === true && t.hp(0, 1) === 0, { r, hps: [0, 1, 2].map(i => t.hp(0, i)) });
  R.check('Dagger bietet seinen Schlag auf das Heldenopfer an (Zielwahl vorhanden und Schaden = ATK des Trägers)', hp - t.hp(1, 0) === t.hero(0, 0).atk, { dmg: hp - t.hp(1, 0), atk: t.hero(0, 0).atk, auswahlen: wahl });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
