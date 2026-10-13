'use strict';
// M01-01 · Flashbang: ein Trank / ein Normal-Artefakt in der Main Phase des Betroffenen zählt als „first Action" und beendet den Zug sofort
// Kartentext Flashbang: „Your opponent's next turn immediately ends after they perform their first Action."
// Engine-Konvention: Tränke und Artefakte sind keine Aktionen – `engine._bleedTriggersForAction` (_engine.js:2733) listet 'equipment, artifact, potion, area' ausdrücklich als „kein Action".
// Skript: flashbang.js hört auf `onAnyActionResolved` OHNE `ctx.actionType` zu filtern; `doUsePotion` (server.js:12036), `doConfirmPotion` (server.js:11588) und `doUseArtifactEffect`
// feuern den Hook mit actionType 'potion' bzw. 'artifact'.
// Aufbau: Sitz 0 spielt Flashbang, Zugwechsel (Sitz 1 hat Main Phase 1, noch keine Aktion). Sitz 1 trinkt in der Main Phase 1 einen Healing Potion (verwundeter Held).
// Erwartet: Der Zug von Sitz 1 läuft weiter (Sitz 1 bleibt aktiv, Phase 2 – er hat noch keine Aktion ausgeführt).
// Beobachtet: Nach dem Trank ist sofort Sitz 0 am Zug (Turn 7) – Sitz 1 verliert seine Action Phase, ohne eine Aktion ausgeführt zu haben. Gleiches gilt für Elixir of Strength und Cloud Pillow (Normal-Artefakt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [name, card, prep] of [
    ['Healing Potion (Ziel-Trank)', 'Healing Potion', (t) => { t.gs.players[1].heroes[0].hp = 500; }],
    ['Elixir of Strength (Ziel-Trank)', 'Elixir of Strength', () => {}],
    ['Cloud Pillow (Normal-Artefakt)', 'Cloud Pillow', () => {}],
  ]) {
    R.section(name);
    const t = await H.fresh({ hand: [['Flashbang'], [card]], gold: 100 });
    await t.play(0, 'Flashbang');
    await t.endTurn();
    R.check('Vorbedingung: Sitz 1 am Zug, Main Phase 1', t.gs.activePlayer === 1 && t.gs.currentPhase === 2, [t.gs.activePlayer, t.gs.currentPhase]);
    prep(t);
    const turnVorher = t.gs.turn;
    const r = await t.play(1, card);
    R.check('Karte wurde gespielt', r === true, r);
    R.check('Der Zug von Sitz 1 läuft weiter (kein Zugende durch Trank/Artefakt – keine Aktion)', t.gs.activePlayer === 1 && t.gs.turn === turnVorher, { active: t.gs.activePlayer, turn: t.gs.turn, phase: t.gs.currentPhase });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('Gegenprobe: ohne Flashbang beendet derselbe Trank den Zug nicht');
  {
    const t = await H.fresh({ hand: [[], ['Elixir of Strength']], gold: 100, active: 1 });
    await t.play(1, 'Elixir of Strength');
    R.check('ohne Flashbang bleibt Sitz 1 am Zug', t.gs.activePlayer === 1, t.gs.activePlayer);
  }
  R.section('Gegenprobe: eine echte Aktion (Attack) beendet den Zug unter Flashbang wie vorgesehen');
  {
    const t = await H.fresh({ hand: [['Flashbang'], ['Attack']], gold: 100 });
    t.grantFor(1, 0, 'Attack');
    await t.play(0, 'Flashbang');
    await t.endTurn();
    await t.play(1, 'Attack', { hero: 0 });
    R.check('nach der ersten echten Aktion ist Sitz 0 am Zug', t.gs.activePlayer === 0, t.gs.activePlayer);
  }
  R.finish();
})();
