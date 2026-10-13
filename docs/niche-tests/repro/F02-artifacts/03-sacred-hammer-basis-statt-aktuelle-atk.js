'use strict';
// F02-03 · Sacred Hammer of the Volcano addiert die BASIS-ATK statt der aktuellen Attack stat
// Kartentext: „The equipped Hero's Attack stat is increased by 30. Additionally, when the equipped Hero hits a Burned target with an Attack, that Attack's damage is increased by the attacker's Attack stat."
// (Gegenprobe im Text: andere Karten sagen ausdrücklich „base Attack stat", z. B. Blow of the Venom Snake / Ferocious Tiger Kick / Javelin Throw – der Hammer sagt es nicht.)
// Aufbau: Held 0 (Tushu, ATK 40) rüstet den Hammer aus (ATK 70); Gegner-Held 0 ist Burned; Karte „Attack" („deal damage equal to the attacker's Attack stat").
// Schritte: 1. Hammer ausrüsten. 2. Mit „Attack" den verbrannten Gegner-Helden treffen.
// Erwartet: Grundschaden 70 (= Attack stat) + Hammerbonus 70 (= Attack stat des Angreifers) = 140.
// Beobachtet: 110 (= 70 + baseAtk 40). Mit einem zusätzlichen +50-Buff (ATK 120) sind es 160 statt 240.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Sacred Hammer of the Volcano', 'Attack'], []] });
  await t.play(0, 'Sacred Hammer of the Volcano', { hero: 0 });
  R.check('Hammer gibt +30 ATK (70)', t.hero(0, 0).atk === 70, t.hero(0, 0).atk);
  t.heroStatus(1, 0, 'burned');
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const hp0 = t.hp(1, 0);
  await t.play(0, 'Attack', { hero: 0 });
  const dmg = hp0 - t.hp(1, 0);
  R.check('Schaden = Attack stat (70) + Attack stat des Angreifers (70) = 140', dmg === 140, { dmg, atk: t.hero(0, 0).atk, baseAtk: t.hero(0, 0).baseAtk });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
