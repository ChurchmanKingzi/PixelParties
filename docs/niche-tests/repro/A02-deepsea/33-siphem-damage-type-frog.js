'use strict';
// A02-deepsea-33 · Siphem: Schaden des Heldeneffekts läuft als Typ 'creature' – Frog Race Boat (und Waflav-Auslöser) erkennen ihn nicht als „Schaden des Helden"
//
// Kartentext (Siphem): „You may once per turn remove any number of Deepsea Counters from this Hero to choose a target and deal damage equal to 50 times that number to it."
// Kartentext (Frog Race Boat): „The first damage the equipped Hero deals in any way to a single target each turn is increased by 50 times the number of Creatures in its other Support Zones."
// Aufbau: Seat 0: Siphem (Held 0) mit 2 Deepsea Counters, Frog Race Boat in Slot 0, 2 Kreaturen in Slot 1/2; Seat 1 mit Standardhelden (800 HP). Heldeneffekt, 2 Counter, Ziel Gegnerheld 0.
// Erwartung: 100 (Siphem) + 50 × 2 Kreaturen (Frog) = 200 Schaden -> Gegnerheld 600. Kontrolle: Fireball desselben Helden bekommt den Bonus (150 + 100 = 250 -> 550).
// Beobachtet: 700 (nur 100). `siphem-the-deepsea-demon.js` ruft `ctx.dealDamage(tHero, damage, 'creature')`; `_race-boat-shared.js` `schadenKommtVomTraeger` schließt
//   `type === 'creature'` aus (Kreaturenschaden). Laut CARD_API (v905, Schadenstyp 'hero') ist 'hero' der Typ für Schaden aus aktivierbaren Heldeneffekten
//   (Vena, Kit, Waflav, Logan wurden umgestellt – Logan lief ebenfalls fälschlich als 'creature'); Siphem blieb auf 'creature'. Gleiche Folge für
//   Crocodile Race Boat (Kill durch Siphem zählt nicht) und alles, was `'creature'` ausnimmt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SIPH = 'Siphem, the Deepsea Demon';
  const heroes = [[SIPH, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], ['Atta, Speaker of Desires', 'Hulijing, the Foxdemon', 'George, the Mad Tyrant King']];
  async function szene(art) {
    const t = await H.fresh({ heroes, hand: [art === 'fireball' ? ['Fireball'] : [], []] });
    t.hero(0, 0).deepseaCounters = 2;
    t.put(0, 0, 0, 'Frog Race Boat');
    t.put(0, 0, 1, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'n-2' }) });
    if (art === 'siphem') await t.activateHero(0, 0, {}); else await t.play(0, 'Fireball', { hero: 0 });
    return { hp: t.hp(1, 0), err: t.errors };
  }
  const k = await szene('fireball');
  R.check('Kontrolle: Fireball des Frog-Helden bekommt den Bonus (550)', k.hp === 550, k);
  const s = await szene('siphem');
  R.check('Siphems Heldeneffekt (100) bekommt den Frog-Bonus: 200 Schaden -> 600', s.hp === 600, s);
  R.check('keine Engine-Fehler', s.err.length === 0, s.err);
  R.finish();
})();
