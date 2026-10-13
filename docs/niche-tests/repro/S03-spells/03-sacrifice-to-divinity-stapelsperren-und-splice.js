'use strict';
// S03-03 · Sacrifice to Divinity zieht per eigenem splice an den Stapel-Sperren vorbei
// Kartentext: „Sacrifice a Creature you control to play this card. Choose a Divinity Ability from your hand, deck or discard pile and attach it to one of your Heroes
//   as an additional attachment."
// Regel CARD_API.md „KEIN DIREKTES SPLICEN AN DECK UND ABLAGE" + `engine.pileOutAllowed` („Synchrones Prädikat … für Kartenskripte, die selbst splicen (MANDATORY)")
//   + Stab-Sperre `_discardOutAllowed` („Wer Karten aus dem Discard bewegt, geht durch einen dieser Wege – nie per discardPile.splice vorbei").
// Aufbau: Sitz 0: Sacrifice to Divinity auf der Hand, eine alte Kreatur als Opfer, je eine Divinity in Ablage / Deck / Hand.
//   (a) Knight of Kings [B] + Rook of Kings [B] bei Sitz 1, Board of Kings liegt: „your opponent cannot move cards from their deck or discard pile to anywhere else"
//   (b) Stab-Sperre `ps._discardLockedTurn = gs.turn` („You cannot move cards out of your discard pile for the rest of the turn").
// Erwartet: Aus gesperrtem Deck/Ablage lässt sich keine Divinity anhängen (Karte nicht spielbar oder Quelle nicht anbietbar).
// Beobachtet: Die Karte wird gespielt, Opfer bezahlt, Divinity hängt am Helden – in allen drei Fällen. (Zusatz: Quelle „Hand" lässt eine Phantom-Instanz zone 'hand' zurück.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const opfer = (t) => { t.find(H.INERT.creature, 'support').turnPlayed = 1; };
  async function knight(src) {
    const t = await H.fresh({ hand: [['Sacrifice to Divinity'], []], discard: [src === 'discard' ? ['Divinity'] : [], []], deck: [src === 'deck' ? ['Divinity', 'ZZ Dummy'] : ['ZZ Dummy'], []] });
    t.put(0, 0, 0, H.INERT.creature); opfer(t);
    t.putArea(0, 'Board of Kings');
    t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]');
    const gate = t.engine.pileOutAllowed(0, src, { sourceOwner: 0 });
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: src }) });
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    return { r, gate, attached: t.gs.players[0].abilityZones[0].flat().includes('Divinity'), errors: t.errors.length };
  }
  for (const src of ['discard', 'deck']) {
    const o = await knight(src);
    R.check(`Knight of Kings [B] sperrt (pileOutAllowed=${o.gate}) – Divinity aus ${src} wird nicht angehängt`, o.gate === false && !o.attached, o);
  }
  {
    const t = await H.fresh({ hand: [['Sacrifice to Divinity'], []], discard: [['Divinity'], []] });
    t.put(0, 0, 0, H.INERT.creature); opfer(t);
    t.gs.players[0]._discardLockedTurn = t.gs.turn;
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'discard' }) });
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    R.check('Stab-Sperre: Divinity aus der Ablage wird nicht angehängt', !t.gs.players[0].abilityZones[0].flat().includes('Divinity'), { r });
  }
  {
    const t = await H.fresh({ hand: [['Sacrifice to Divinity', 'Divinity'], []] });
    t.put(0, 0, 0, H.INERT.creature); opfer(t);
    await t.play(0, 'Sacrifice to Divinity', { hero: 0, handIndex: 0 });
    const phantom = t.inst(c => c.name === 'Divinity' && c.zone === 'hand' && !t.pile(0, 'hand').includes('Divinity'));
    R.check('Quelle Hand: keine Phantom-Instanz einer nicht mehr vorhandenen Handkarte', phantom.length === 0, { phantom: phantom.length, hand: t.pile(0, 'hand') });
  }
  R.finish();
})();
