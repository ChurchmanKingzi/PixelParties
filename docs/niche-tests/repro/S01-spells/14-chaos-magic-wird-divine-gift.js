'use strict';
// S01-14 · Chaos Magic, die zu einem „Divine Gift" wird: kein Einmal-pro-Spiel-Stempel (und die Zusatzaktion des Gifts entfällt)
// Kartentext Chaos Magic: „… This Spell's name, level and effect become the revealed Spell's name, level and effect, …"
// Kartentext Divine Gift of …: „You can only activate 1 "Divine Gift" card per game. … This counts as an additional Action."
// Aufbau: Sitz 0 hat Chaos Magic, Divine Gift of Skill und 2 Fireballs auf der Hand; das Deck besteht nur aus Divine Gift of Biseria.
// Schritte: 1. Chaos Magic spielen (enthüllt Divine Gift of Biseria, friert ein Ziel ein). 2. Im selben Zug (keepActions) Divine Gift of Skill spielen. 3. (zweiter Lauf) statt 2.: einen Fireball spielen.
// Erwartet: (a) Chaos Magic IST jetzt ein Divine Gift → „divineGift" gestempelt, Divine Gift of Skill nicht mehr spielbar.
//           (b) (Stufe C) Chaos Magic IST Divine Gift of Biseria → „This counts as an additional Action": der Fireball ist danach als Hauptaktion spielbar.
// Beobachtet: (a) `_oncePerGameUsed` bleibt leer, Divine Gift of Skill wirkt (4 Bonus-Anhänge); (b) der Fireball wird abgelehnt (Chaos Magic verbraucht die Aktion).
// Ursache: `chaos-magic.js` ruft `onPlay` des gefundenen Zaubers direkt auf (nicht `_castSpellImmediately`, das den Stempel setzt, _engine.js ~Z. 21895) und wertet `inherentAction` nicht aus.
// ★ W14 (Q161, Al: „Chaos Magic verbraucht die Action, die für es aufgewandt wurde, immer, egal, ob der Ziel-Spell additional ist."): Teil (b) prüft seit Welle 14 die NEUE Regel –
//   der Fireball ist nach Chaos Magic NICHT spielbar (die Zusatzaktion des gefundenen Zaubers gilt nicht zusätzlich).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['Chaos Magic', 'Divine Gift of Skill'], []], deck: [['Divine Gift of Biseria'], []] });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Chaos Magic', { hero: 0 });
  R.check('Kontrolle: Chaos Magic wirkte als Divine Gift of Biseria (Ziel eingefroren)', t.gs.players[1].heroes[0].statuses.frozen != null, Object.keys(t.gs.players[1].heroes[0].statuses));
  const stempelVorher = [...(t.gs.players[0]._oncePerGameUsed || [])];
  const r2 = await t.play(0, 'Divine Gift of Skill', { hero: 0, keepActions: true });
  R.check('(a) „divineGift" ist nach Chaos Magic gestempelt, ein weiteres Divine Gift ist nicht spielbar', stempelVorher.includes('divineGift') && r2 === false, { stempelVorher, r2 });
  t = await H.fresh({ hand: [['Chaos Magic', 'Fireball'], []], deck: [['Divine Gift of Biseria'], []] });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Chaos Magic', { hero: 0 });
  const r3 = await t.play(0, 'Fireball', { hero: 0, keepActions: true });
  R.check('(b, W14/Q161) Chaos Magic verbraucht seine Aktion immer: ein weiterer Zauber ist NICHT spielbar', r3 === false, { r3 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
