'use strict';
// N1-07 · Cottage at the Forest's Edge: „one of THEIR Ascended Heroes" – die Karte sucht nach der Brettspalte, nicht nach dem Kontrolleur
// Kartentext: „While this Area remains in play, both players may once per turn choose one of their Ascended Heroes and revive it with 100 HP. …"
// Ruling (Welle 22, Al 20.10.): Bei „Hero you control" gilt „nur der aktuelle Kontrolleur" (Kontrolle statt Seite, Styx 28.9.; abgegebene Helden zählen nicht, übernommene der Gegenspalte schon).
// Skript (`revivableHeroes`): liest nur `gs.players[activator].heroes` (physische Spalte).
// Aufbau: Cottage liegt im Spiel. Sitz 0 besitzt einen (gefallenen) Ascended Hero in Spalte 0:0, den Sitz 1 dauerhaft übernommen hat (`actionTakeHeroPermanently`).
// Erwartet: Sitz 1 (Kontrolleur) darf ihn in SEINEM Zug mit der Area wiederbeleben; Sitz 0 (nur noch Besitzer) darf es nicht.
// Beobachtet: genau umgekehrt – der Besitzer belebt den Helden wieder, der Kontrolleur sieht ihn nicht (`activateAreaEffect` liefert false).
// Gegenprobe: ohne Übernahme belebt der Besitzer den eigenen Ascended Hero (100 HP).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ASC = 'Fern, the Liberated Fairy', COTTAGE = "Cottage at the Forest's Edge";
const aufbau = async (uebernommen) => {
  const t = await H.fresh({ hand: [[], []] });
  t.putArea(0, COTTAGE);
  t.setHero(0, 0, ASC, 800);
  if (uebernommen) { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(250); }
  t.hero(0, 0).hp = 0;
  return t;
};
const nutzen = async (t, seat) => { t.gs.activePlayer = seat; t.gs.currentPhase = 2; t.resetActions(seat); return t.run(() => t.engine.activateAreaEffect(seat, 0, COTTAGE)); };
(async () => {
  const R = H.runner();
  { const t = await aufbau(false);
    await nutzen(t, 0);
    R.check('Gegenprobe: Besitzer belebt den eigenen Ascended Hero (100 HP)', t.hp(0, 0) === 100, t.hp(0, 0));
    R.check('Gegenprobe: keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const t = await aufbau(true);
    R.check('Aufbau: Sitz 1 kontrolliert den gefallenen Helden', t.engine.heroSideOf(0, t.hero(0, 0)) === 1, t.engine.heroSideOf(0, t.hero(0, 0)));
    await nutzen(t, 0);
    R.check('Besitzer (Sitz 0) darf den abgegebenen Helden NICHT wiederbeleben', t.hp(0, 0) === 0, t.hp(0, 0)); }
  { const t = await aufbau(true);
    await nutzen(t, 1);
    R.check('Kontrolleur (Sitz 1) belebt den übernommenen Ascended Hero wieder (100 HP)', t.hp(0, 0) === 100, t.hp(0, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
