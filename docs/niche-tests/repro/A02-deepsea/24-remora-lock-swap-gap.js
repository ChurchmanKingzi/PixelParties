'use strict';
// A02-deepsea-24 · Greatmaw Remora: die Teil-Sperre „no Creatures except Greatmaw" greift bei Shapeshift / Deepsea Castle nicht
//
// Kartentext (Greatmaw Remora): „… you may summon this Creature from your hand as an additional Action, but if you do, you
// cannot summon Creatures for the rest of the turn afterwards, except "Greatmaw" Creatures."
// Engine (`actionPlaceCreature`, _engine.js ~Z. 25999): die Teil-Sperre gilt „including effect placements"; `atomicSwap`
// (`_deepsea-shared.js` ~Z. 961) sperrt dagegen nur die Voll-Sperre `ps.summonLocked` („blocks ANY path that adds a new
// Creature to the board, including atomic swaps from Castle / Shapeshift") – `summonLockExceptGreatmaw` fehlt dort, und auch in
// `shapeshift.js` (`spellPlayCondition`/`inherentAction`) und `deepsea-castle.js` (`canActivateAreaEffect`).
//
// Aufbau: Seat 0: Greatmaw Shark (Held 0) + Deepsea Skeleton (Held 1, eine Runde alt); Hand: Remora, Shapeshift (bzw. Castle), Deepsea Zombie.
// Schritte: Remora als Gratis-Zusatzaktion spielen (Teil-Sperre aktiv); danach Shapeshift/Castle: Skeleton → Zombie tauschen.
// Erwartung: Der Zombie (kein Greatmaw) darf nicht auf das Brett kommen („cannot summon Creatures … except Greatmaw").
// Beobachtet: Der Tausch läuft; der Zombie steht auf dem Brett und löst seinen Einsatz-Effekt aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const spell of ['Shapeshift', 'Deepsea Castle']) {
    R.section(spell);
    const t = await H.fresh({ hand: [['Greatmaw Remora', spell, 'Deepsea Zombie'], []] });
    t.hero(0, 0).atk = 100;
    const sh = t.put(0, 0, 0, 'Greatmaw Shark'); sh.turnPlayed = 1;
    const sk = t.put(0, 1, 0, 'Deepsea Skeleton'); sk.turnPlayed = 1;
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Greatmaw Remora', answer: () => null });   // „Free (lock non-Greatmaw)"
    await t.play(0, 'Greatmaw Remora', { hero: 0, slot: 1, keepActions: true });
    R.check('Vorbedingung: Teil-Sperre aktiv', t.gs.players[0].summonLockExceptGreatmaw === true, t.gs.players[0].summonLockExceptGreatmaw);
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones.find(z => /Skeleton/.test(z.label)) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
    t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t.pile(0, 'hand').indexOf('Deepsea Zombie'); return { cardName: 'Deepsea Zombie', handIndex: i, selectedCards: [{ cardName: 'Deepsea Zombie', handIndex: i }] }; } });
    if (spell === 'Shapeshift') await t.play(0, 'Shapeshift', { hero: 0, keepActions: true });
    else { await t.play(0, 'Deepsea Castle', { hero: 0, keepActions: true }); t.phase(2); await t.run(() => t.engine.activateAreaEffect(0, 0, 'Deepsea Castle')); }
    const board = t.gs.players[0].supportZones.map(h => h.map(z => z[0] || null));
    R.check('Der Zombie (Nicht-Greatmaw) wird nicht eingetauscht', !board.some(h => h.includes('Deepsea Zombie')), { board, hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
