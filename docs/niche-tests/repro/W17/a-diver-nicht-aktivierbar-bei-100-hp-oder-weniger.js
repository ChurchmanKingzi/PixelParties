'use strict';
// W17a · Steam Dwarf Diver (A03-06, Al 19.10.2026): „Der Diver sollte bei <=100 HP (current oder max) gar nicht aktivierbar sein!"
//
// Kartentext: „You may once per turn reduce this Creature's current and max HP by 100 to search your deck for a card, reveal it and add it to your hand."
// Regel: Sind die aktuellen ODER die maximalen HP <= 100, ist der Effekt nicht aktivierbar (`canActivateCreatureEffect` false: nicht angeboten, kein Einsatz,
//   keine Suche, HP unverändert). Der Boden „aktuelle HP mindestens 1" entfällt: bei > 100 zahlt der Diver immer voll (aktuell - 100, max - 100).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (max, cur) => {
    const t = await H.fresh({ deck: [['Future Tech Gun', H.INERT.creature], []] });
    const d = t.put(0, 0, 1, 'Steam Dwarf Diver', { counters: { maxHp: max, currentHp: cur } }); d.turnPlayed = 1;
    t.script.push({ match: dd => dd.type === 'cardGallery', answer: () => ({ cardName: 'Future Tech Gun' }), once: true });
    t.phase(2);
    const r = await t.activateCreature(0, 0, 1);
    return { t, d, r, gesucht: t.pile(0, 'hand').includes('Future Tech Gun') };
  };
  // nicht aktivierbar: (max, cur)
  for (const [max, cur] of [[100, 100], [50, 50], [200, 100], [200, 60], [100, 40], [300, 1]]) {
    const { t, d, r, gesucht } = await lauf(max, cur);
    R.check(`Diver ${max}/${cur}: nicht aktivierbar (keine Suche, HP unverändert, kein Einsatz)`,
      !gesucht && d.counters.maxHp === max && d.counters.currentHp === cur && Object.keys(t.gs.hoptUsed || {}).filter(k => /Diver/.test(k)).length === 0 && t.prompts.filter(p => p.d.type === 'cardGallery').length === 0,
      { r, gesucht, max: d.counters.maxHp, cur: d.counters.currentHp, hopt: t.gs.hoptUsed });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // aktivierbar: (max, cur) -> (max-100, cur-100), ohne Boden 1
  for (const [max, cur, erwMax, erwCur] of [[101, 101, 1, 1], [200, 101, 100, 1], [200, 200, 100, 100], [150, 150, 50, 50]]) {
    const { t, d, gesucht } = await lauf(max, cur);
    R.check(`Diver ${max}/${cur}: aktivierbar, zahlt voll → max ${erwMax} / aktuell ${erwCur}`, gesucht && d.counters.maxHp === erwMax && d.counters.currentHp === erwCur, { gesucht, max: d.counters.maxHp, cur: d.counters.currentHp });
    R.check('Diver lebt noch', d.zone === 'support');
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
