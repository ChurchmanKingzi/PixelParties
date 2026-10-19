'use strict';
// W18a · Punkt 2 · Al, 19.10.2026 (C04-05): „Auch der Gegner ohne Hammer-Spirit bekommt den Buff einmal pro Runde."
//   Liegt irgendein (wirksamer) Spirit of the Relic Hammer auf dem Brett, bekommt JEDER Spieler die Haste für die erste in SEINEM Zug beschworene
//   Kreatur — einmal pro Zug des jeweiligen Spielers; die zweite Kreatur im selben Zug nicht; ohne Spirit auf dem Brett niemand;
//   ein negierter Spirit gibt nichts. Umgekehrt: Spirit nur beim Gegner (Sitz 1) → auch Sitz 0 bekommt die Haste.
// Erwartet: Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SPR = 'Spirit of the Relic Hammer', SS = 'Sky Shaman';
  const haste = (t, seat, nth = 0) => {
    const l = t.engine.cardInstances.filter(c => c.name === SS && c.zone === 'support' && c.owner === seat);
    return l[nth] ? !!l[nth].counters?._hasHaste : null;
  };
  const sauber = (t, w) => R.check(w + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

  R.section('Spirit bei Sitz 0: Sitz 0 und Sitz 1 je einmal pro eigenem Zug');
  {
    const t = await H.fresh({ hand: [[SS, SS, SS], [SS, SS]] });
    const sp = t.put(0, 2, 0, SPR); sp.turnPlayed = 1;
    await t.play(0, SS, { hero: 0, slot: 0 });
    R.check('Sitz 0, erste Kreatur: Haste', haste(t, 0, 0) === true);
    await t.play(0, SS, { hero: 0, slot: 1, keepActions: false });
    R.check('Sitz 0, zweite Kreatur im selben Zug: keine Haste', haste(t, 0, 1) === false, haste(t, 0, 1));
    await t.endTurn();
    t.gs.activePlayer = 1; t.phase(3); t.resetActions(1);
    await t.play(1, SS, { hero: 0, slot: 0, keepActions: true });
    R.check('Sitz 1 (ohne eigenen Spirit), erste Kreatur: Haste', haste(t, 1, 0) === true, haste(t, 1, 0));
    t.resetActions(1);
    await t.play(1, SS, { hero: 0, slot: 1, keepActions: true });
    R.check('Sitz 1, zweite Kreatur im selben Zug: keine Haste', haste(t, 1, 1) === false, haste(t, 1, 1));
    sauber(t, 'Spirit bei Sitz 0');
  }

  R.section('Spirit nur bei Sitz 1: auch Sitz 0 (ohne eigenen Spirit) bekommt die Haste');
  {
    const t = await H.fresh({ hand: [[SS, SS], [SS]] });
    const sp = t.put(1, 2, 0, SPR); sp.turnPlayed = 1;
    await t.play(0, SS, { hero: 0, slot: 0 });
    R.check('Sitz 0 ohne eigenen Spirit, erste Kreatur: Haste', haste(t, 0, 0) === true, haste(t, 0, 0));
    sauber(t, 'Spirit nur bei Sitz 1');
  }

  R.section('Gegenproben: kein Spirit / negierter Spirit');
  {
    const t = await H.fresh({ hand: [[SS], [SS]] });
    await t.play(0, SS, { hero: 0, slot: 0 });
    R.check('ohne Spirit auf dem Brett: keine Haste', haste(t, 0, 0) === false, haste(t, 0, 0));
    sauber(t, 'ohne Spirit');
  }
  {
    const t = await H.fresh({ hand: [[SS], [SS]] });
    const sp = t.put(1, 2, 0, SPR); sp.turnPlayed = 1; sp.counters.negated = 1;
    await t.play(0, SS, { hero: 0, slot: 0 });
    R.check('negierter Spirit: keine Haste', haste(t, 0, 0) === false, haste(t, 0, 0));
    sauber(t, 'negierter Spirit');
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
