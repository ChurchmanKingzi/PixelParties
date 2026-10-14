'use strict';
// F03-artifacts-12 · Sickly Cheese: Kosten „inflict 1 Stack of Poison" – ein giftimmuner Held ist KEIN wählbares Ziel (Welle 7, Entscheidung Al 14.10.)
// Kartentext: „Choose a Hero you control and inflict 1 Stack of Poison to it to play this card. Choose a Decay Magic Spell from your deck, reveal it and add it to your hand."
// Al: „Sickly Cheese ist nur komplett gesperrt, wenn es *gar keine* eligible targets gibt. Giftimmun macht ein Ziel ineligible."
// Aufbau: Held 1 trägt den Buff `negative_status_immune`; Deck mit Accusation (Decay-Spell).
// Erwartet: (a) Held 1 steht in der Zielwahl als `ineligible`, die Wahl eines wählbaren Helden (Held 0) zahlt das Gift und holt die Karte;
//           (b) ist jeder lebende Held giftimmun, ist die Karte nicht spielbar (nichts gezahlt, Karte bleibt auf der Hand).
// (Bis Welle 6 prüfte dieses Skript „Kosten nicht gezahlt ⇒ keine Suche" mit Held 1 als einziger Wahl; die Regel ist jetzt „nicht wählbar".)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Sickly Cheese'], []], deck: [['Accusation', 'Bird', 'Bird']], gold: 100 });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Sickly Cheese', answer: () => ({ cardName: 'Accusation', source: 'deck' }), once: false });
    t.hero(0, 1).buffs = { negative_status_immune: { source: 'Test' } };
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return v ? [v.id] : undefined; };
    const r = await t.play(0, 'Sickly Cheese');
    R.note('Ergebnis', { r, poisoned0: !!t.hero(0, 0).statuses.poisoned, hand: t.pile(0, 'hand') });
    R.check('(a) Held 0 gewählt: vergiftet und Decay-Spell auf der Hand', r === true && !!t.hero(0, 0).statuses.poisoned && t.pile(0, 'hand').includes('Accusation'), { r, hand: t.pile(0, 'hand') });
    R.check('(a) giftimmuner Held 1 bleibt unvergiftet', !t.hero(0, 1).statuses.poisoned);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Das Angebot der Zielwahl: Held 1 ist als Ziel markiert (`ineligible`) – gemessen an der Zielliste des Skripts selbst.
    const t = await H.fresh({ hand: [['Sickly Cheese'], []], deck: [['Accusation', 'Bird']], gold: 100 });
    t.hero(0, 1).buffs = { negative_status_immune: { source: 'Test' } };
    const ziele = H.loadCardEffect('Sickly Cheese').getValidTargets(t.gs, 0, t.engine);
    R.check('(a) Held 1 ist als Ziel ineligible, Held 0 und 2 sind wählbar', ziele.find(z => z.heroIdx === 1)?.ineligible === true && !ziele.find(z => z.heroIdx === 0)?.ineligible && !ziele.find(z => z.heroIdx === 2)?.ineligible, ziele);
  }
  {
    const t = await H.fresh({ hand: [['Sickly Cheese'], []], deck: [['Accusation', 'Bird', 'Bird']], gold: 100 });
    for (let h = 0; h < 3; h++) t.hero(0, h).buffs = { negative_status_immune: { source: 'Test' } };
    const r = await t.play(0, 'Sickly Cheese');
    R.check('(b) alle Helden giftimmun: Cheese nicht spielbar, bleibt auf der Hand, Gold unverändert', r === false && t.pile(0, 'hand').includes('Sickly Cheese') && t.gs.players[0].gold === 100, { r, hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
