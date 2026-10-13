'use strict';
// F02-08 · Magic Cobalt wählt „a Hero you control" nach Brettseite statt nach Kontrolle
// Kartentext: „Choose a Hero you control and heal its HP by 50." (Konvention seit Styx 28.9., CARD_API „Kontrolle statt Seite": „Hero you control" = `engine.heroSideOf`/`heroesControlledBy`)
// Aufbau: Sitz 0 (Spieler) hat Magic Cobalt auf der Hand; Sitz 1 hat Held 0 von Sitz 0 dauerhaft übernommen (`actionTakeHeroPermanently(1, 0, 0)`, wie Paraseed Control)
//   UND Sitz 0 hat Held 0 von Sitz 1 dauerhaft übernommen (`actionTakeHeroPermanently(0, 1, 0)`).
// Schritte: Magic Cobalt über den echten Weg anspielen (`doUseArtifactEffect` → Ziel-Modus, `gs.potionTargeting.validTargets` lesen).
// Erwartet: gültig = Held 1:0 (übernommen, ich kontrolliere ihn) und die eigenen Helden 0:1, 0:2; NICHT 0:0 (kontrolliert der Gegner).
// Beobachtet: 0:0 ist wählbar, 1:0 nicht (das Skript läuft über `ps.heroes` der eigenen Spalte).
// Zusatz (Ruby): `normalizeValidTargets` filtert übernommene Helden korrekt heraus (1:0 nicht wählbar ✓), aber der Held 0:0 in MEINER Spalte, den der Gegner kontrolliert,
//   wird von Magic Ruby / Amethyst / Golden Apple nie angeboten (die Skripte lesen nur die Gegnerspalte).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Magic Cobalt', 'ZZ Filler'], []] });
  await t.engine.actionTakeHeroPermanently(1, 0, 0, { sourceName: 'Test' });
  await t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Test' });
  R.check('Aufbau: Held 0:0 gehört dem Gegner, 1:0 mir', t.engine.heroSideOf(0, t.hero(0, 0)) === 1 && t.engine.heroSideOf(1, t.hero(1, 0)) === 0, [t.hero(0, 0).permaControlBy, t.hero(1, 0).permaControlBy]);
  await t.play(0, 'Magic Cobalt', { noAutoConfirm: true });
  const pt = t.gs.potionTargeting;
  const ids = pt ? (pt.validTargets || []).filter(v => !v.ineligible).map(v => v.owner + ':' + v.heroIdx) : null;
  R.check('Ziel-Modus offen', !!pt, ids);
  R.check('übernommener Held 1:0 ist wählbar', !!ids && ids.includes('1:0'), ids);
  R.check('vom Gegner kontrollierter Held 0:0 ist NICHT wählbar', !!ids && !ids.includes('0:0'), ids);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  // Gegenstück: „Choose a Hero your opponent controls" (Magic Ruby, Textvorlage der Karte) – derselbe Aufbau.
  const t2 = await H.fresh({ hand: [['Magic Ruby', 'ZZ Filler'], []] });
  await t2.engine.actionTakeHeroPermanently(1, 0, 0, { sourceName: 'Test' });
  await t2.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Test' });
  await t2.play(0, 'Magic Ruby', { noAutoConfirm: true });
  const pt2 = t2.gs.potionTargeting;
  const ids2 = pt2 ? (pt2.validTargets || []).filter(v => !v.ineligible).map(v => v.owner + ':' + v.heroIdx) : null;
  R.check('Magic Ruby: vom Gegner kontrollierter Held 0:0 (in meiner Spalte) ist wählbar', !!ids2 && ids2.includes('0:0'), ids2);
  R.check('Magic Ruby: ich selbst kontrollierter Held 1:0 ist NICHT wählbar', !!ids2 && !ids2.includes('1:0'), ids2);
  R.finish();
})();
