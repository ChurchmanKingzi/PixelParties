// A08-07 · Extra Life (Trial of Coolness) rettet eine Kreatur nur vor SCHADEN, nicht vor einem „defeat"-Effekt (Afflicted Vermin, Trial of Dominance)
//
// Kartentext Trial of Coolness: „Choose a target you control, except the user. The next time that target is defeated, immediately revive it and fully heal its HP."
// Kartentext Afflicted Vermin: „… Choose a different Creature and defeat it, then place this Creature into one of the user's free Support Zones."
// Kartentext Trial of Dominance: „Defeat all Creatures your opponent controls and delete them."
//
// Erwartung: Jedes „defeat" löst das Extraleben aus (so macht es die Engine bei HELDEN auf allen vier Todeswegen).
// Beobachtet: Bei KREATUREN wird die Marke nur im Schadens-Stapel verbraucht (`_engine.js:46964`); `_actionDestroyCardKern` kennt sie nicht.
//   Vermin „besiegt" die markierte Kreatur → sie liegt in der Ablage, die Marke ist unverbraucht. Dominance löscht sie ebenfalls (mit Marke).
// Aufruf: node docs/niche-tests/repro/A08-pacman/07-extraleben-kreatur-nur-bei-schaden.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler, FR = H.INERT.frail;
  const slot0 = (t) => (t.gs.players[1].supportZones[0][0] || [])[0];
  const marke = (inst) => (inst && inst.counters && inst.counters._extraLifeStack || []).length;

  // Kontrolle: tödlicher SCHADEN → Extraleben greift (Kreatur steht wieder auf dem Brett, Marke weg)
  {
    const t = await H.fresh({ hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    const c = t.put(1, 0, 0, FR); c.turnPlayed = 1;
    t.engine.addExtraLife(c.counters, { by: 'Trial of Coolness' });
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    await t.play(0, 'Fireball', { hero: 0 });
    const lebt = slot0(t) === FR;
    R.check('Kontrolle: tödlicher Schaden → Extraleben holt die Kreatur zurück', lebt, { brett: t.gs.players[1].supportZones[0], ablage: t.pile(1, 'discardPile') });
  }
  // Afflicted Vermin „besiegt" die markierte Kreatur
  {
    const t = await H.fresh({ hand: [[], [D]], deck: [Array(20).fill(F), Array(20).fill(F)] });
    const c = t.put(1, 0, 0, D); c.turnPlayed = 1;
    t.engine.addExtraLife(c.counters, { by: 'Trial of Coolness' });
    t.engine.handZugangSync(0, 'Afflicted Vermin');
    await t.play(0, 'Afflicted Vermin', { hero: 0 });
    t.targetFn = (valid) => [valid.find(v => v.owner === 1 && v.cardName === D).id];     // erste Dummy = die markierte
    await t.play(1, D, { hero: 1, slot: 0, active: 1 });                                 // Gegner beschwört → Vermin löst aus
    R.check('Vermin: markierte Kreatur wurde „besiegt" → Extraleben holt sie zurück (Brett Held 0 Slot 0)', slot0(t) === D && t.pile(1, 'discardPile').length === 0, { brett: t.gs.players[1].supportZones[0], ablage: t.pile(1, 'discardPile'), marke: marke(c) });
    R.check('Vermin: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // Trial of Dominance
  {
    const t = await H.fresh({ hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    const c = t.put(1, 0, 0, D); c.turnPlayed = 1;
    t.engine.addExtraLife(c.counters, { by: 'Trial of Coolness' });
    await t.play(0, 'Trial of Dominance', { hero: 0 });
    R.check('Dominance: markierte Kreatur → Extraleben greift (steht noch auf dem Brett)', slot0(t) === D, { brett: t.gs.players[1].supportZones[0], geloescht: t.pile(1, 'deletedPile') });
  }
  R.finish();
})();
