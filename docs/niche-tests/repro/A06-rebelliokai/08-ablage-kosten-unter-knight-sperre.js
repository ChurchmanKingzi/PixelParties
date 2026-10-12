'use strict';
// A06-rebelliokai-08 · Rebelliokai-Karten mit „Delete X from your discard pile to play this card" wirken unter der Knight-of-Kings-[B]-Sperre
//   OHNE die Kosten zu bezahlen
// Kartentexte: Kirin Firebreath / Kappa Sword Slash / Tengu Windstorm / Tanuki Escape: „Delete 1 "…" from your discard pile to play
//   this card." · Knight of Kings [B]: „While you control at least 1 "Rook of Kings" and "Board of Kings" is on the board, your
//   opponent cannot move cards from their deck or discard pile to anywhere else (but they can still draw)."
// Beobachtung: `payRebelliokaiCost` (_rebelliokai-shared.js) ruft `takeFromPileSync`, das unter der Sperre `null` liefert (Log
//   `pile_out_blocked`). Die vier Skripte werten den Rückgabewert nicht aus – die Karte wirkt weiter, das Opfer-/Löschgut bleibt in
//   der Ablage. `spellPlayCondition` prüft nur „liegt in der Ablage", nicht die Sperre.
// Erwartung: Kosten nicht zahlbar → Karte nicht spielbar bzw. ohne Wirkung; auf keinen Fall die volle Wirkung ohne Kosten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const lock = (t) => { t.putArea(1, 'Board of Kings'); t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]'); };
  const heroOnly = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1); return h ? [h.id] : []; };

  // 1. Kirin Firebreath
  let t = await H.fresh({ hand: [['Kirin Firebreath'], []], discard: [['Rebelliokai Courtly Kirin', 'Rebelliokai Kind Kitsune', 'Rebelliokai Timid Tanuki'], []] });
  lock(t); t.targetFn = heroOnly;
  let r = await t.play(0, 'Kirin Firebreath', { hero: 0 });
  const kirinGeloescht = t.pile(0, 'deletedPile').includes('Rebelliokai Courtly Kirin');
  R.check('Kirin Firebreath: ohne gelöschten Kirin keine Wirkung', kirinGeloescht || t.hp(1, 0) === 800, { r, hp1: t.hp(1, 0), deleted: t.pile(0, 'deletedPile') });

  // 2. Kappa Sword Slash (Fighting 3+3 für Lv5 minus 5 verschiedene Rebelliokai in der Ablage)
  t = await H.fresh({ hand: [['Kappa Sword Slash'], []], discard: [['Rebelliokai Camouflaged Kappa', 'Rebelliokai Kind Kitsune', 'Rebelliokai Timid Tanuki', 'Rebelliokai Backup Bakus', 'Rebelliokai Courtly Kirin'], []] });
  lock(t); t.setAbilities(0, 0, [['Fighting', 'Fighting', 'Fighting']]);
  t.targetFn = (valid) => heroOnly(valid);
  r = await t.play(0, 'Kappa Sword Slash', { hero: 0, noGrant: true });
  R.check('Kappa Sword Slash: ohne gelöschten Camouflaged Kappa keine Wirkung', t.pile(0, 'deletedPile').includes('Rebelliokai Camouflaged Kappa') || t.hp(1, 0) === 800, { r, hp1: t.hp(1, 0), deleted: t.pile(0, 'deletedPile') });

  // 3. Tengu Windstorm
  t = await H.fresh({ hand: [['Tengu Windstorm'], []], discard: [['Rebelliokai Terror Tengu'], []] });
  lock(t);
  const opfer = t.put(1, 0, 2, D);
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'top' }) });
  t.targetFn = (valid) => { const x = valid.find(v => v.cardName === D); return [x ? x.id : valid[0].id]; };
  r = await t.play(0, 'Tengu Windstorm', { hero: 0 });
  R.check('Tengu Windstorm: ohne gelöschten Terror Tengu keine Wirkung', t.pile(0, 'deletedPile').includes('Rebelliokai Terror Tengu') || t.zone(1, 0, 2) === D, { r, slot: t.zone(1, 0, 2), deleted: t.pile(0, 'deletedPile') });

  // 4. Tanuki Escape
  t = await H.fresh({ hand: [['Tanuki Escape', 'Fireball'], []], discard: [['Rebelliokai Timid Tanuki', 'Rebelliokai Kind Kitsune'], []] });
  lock(t);
  t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.slice(0, 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: [] }) });
  const turn0 = t.gs.turn;
  r = await t.play(0, 'Tanuki Escape', { hero: 0 });
  R.check('Tanuki Escape: ohne gelöschten Timid Tanuki keine Wirkung (Zug nicht beendet, nichts zurückgemischt)',
    t.pile(0, 'deletedPile').includes('Rebelliokai Timid Tanuki') || t.gs.turn === turn0,
    { r, turnNow: t.gs.turn, turn0, deleted: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
