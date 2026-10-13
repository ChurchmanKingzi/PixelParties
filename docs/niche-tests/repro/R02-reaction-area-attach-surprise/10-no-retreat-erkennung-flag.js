'use strict';
// R02-10 · No Retreat!: die Erkennung hängt an einer Skript-Flagge – Karten, die Karten aus Hand/Ablage/Brett ins Deck mischen, tragen sie nicht (Staff of the Teleporter, Brainstorming, Meditation, Expedition, Mass Routing, …)
// Kartentext No Retreat!: „Play this card immediately when your opponent activates a card or effect that would include shuffling cards from their hand, discard pile or side of the board back into the deck. Negate that card or effect."
// Skript (no-retreat.js): angeboten wird nur, wenn das Skript der aktivierten Karte `shufflesFromHandOrDiscardIntoDeck: true` trägt (15 Karten: u. a. Guard Duty, Renewable Energy, Leadership, Horn in a Bottle).
// Aufbau: Sitz 0 spielt die Karte (Zug 5, Aktionsphase); Sitz 1 hat No Retreat! auf der Hand (Held 0 mit Decay Magic 1) und sagt zu allem Ja.
//   Brainstorming: 4× Fireball in der Ablage (Karte mischt „4 cards with the same name from your discard pile back into your deck"). Staff of the Teleporter: „Shuffle any number of cards from your hand into your deck and draw the same number".
// Erwartet: In allen Fällen kommt die Frage „No Retreat!" (Kontrolle Guard Duty ✓) und die Karte wird negiert (Deck von Sitz 0 wächst nicht).
// Beobachtet: Guard Duty (Flagge) ✓; Brainstorming und Staff of the Teleporter bekommen KEINE Frage – der Effekt läuft (Deck 20 → 23 bzw. Handkarten wandern ins Deck).
// Ursache: `shufflesFromHandOrDiscardIntoDeck` fehlt in brainstorming.js, staff-of-the-teleporter.js, meditation.js, expedition.js, mass-routing.js (Skript-Scan über cards.json: Kartentext „shuffle … back into … deck" ohne Flagge, 29 Treffer, die oben genannten passen eindeutig zum Text von No Retreat!).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(card, o = {}) {
    const t = await H.fresh({ hand: [[card, 'Fireball', 'Heal', 'Fireball'], ['No Retreat!']], hp: 800, discard: [o.discard || ['Fireball', 'Fireball'], []] });
    t.setAbilities(1, 0, [['Decay Magic'], [], []]);
    t.policy.confirm = true;
    t.targetFn = (valid) => valid.length ? [valid[0].id] : [];
    t.script.push({ match: d => d.type === 'handPick', answer: d => ({ selectedIndices: d.eligibleIndices.slice(0, 2) }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.cards && d.cards.length, answer: d => ({ cardName: d.cards[0].name }) });
    const fb = () => t.pile(0, 'mainDeck').filter(x => x === 'Fireball').length;
    const deck0 = t.pile(0, 'mainDeck').length, fb0 = fb();
    await t.play(0, card, { hero: 0 });
    const gefragt = t.prompts.some(p => p.d.title === 'No Retreat!' || /No Retreat/.test(JSON.stringify(p.d).slice(0, 400)));
    return { t, gefragt, deck: [deck0, t.pile(0, 'mainDeck').length], fb: [fb0, fb()] };
  }
  const g = await lauf('Guard Duty');
  R.check('Kontrolle Guard Duty (Flagge gesetzt): No Retreat! wird angeboten', g.gefragt);
  const b = await lauf('Brainstorming', { discard: ['Fireball', 'Fireball', 'Fireball', 'Fireball'] });
  R.check('Brainstorming (mischt 4 Karten aus der Ablage ins Deck): No Retreat! wird angeboten', b.gefragt, { deck: b.deck });
  R.check('Brainstorming: Deck von Sitz 0 wächst nicht (negiert)', b.deck[1] <= b.deck[0], { deck: b.deck });
  const s = await lauf('Staff of the Teleporter');
  R.check('Staff of the Teleporter (mischt Handkarten ins Deck): No Retreat! wird angeboten', s.gefragt, { fireballImDeck: s.fb });
  // Zweites Symptom derselben Ursache: Distracting Crystal („While this card is in your hand, you cannot activate effects that include adding cards from your hand or discard pile to your deck")
  {
    const t = await H.fresh({ hand: [['Brainstorming', 'Distracting Crystal', 'Fireball'], []], hp: 800, discard: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], []] });
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'cardGallery' && d.cards && d.cards.length, answer: d => ({ cardName: d.cards[0].name }) });
    const deck0 = t.pile(0, 'mainDeck').length;
    const r = await t.play(0, 'Brainstorming', { hero: 0 });
    R.check('Nebenbefund: Brainstorming ist mit Distracting Crystal in der Hand NICHT spielbar (Kontrolle Guard Duty wird abgelehnt)', r === false || t.pile(0, 'mainDeck').length <= deck0, { r, deck: [deck0, t.pile(0, 'mainDeck').length] });
  }
  R.check('Keine Engine-Fehler', [g, b, s].every(x => x.t.errors.length === 0));
  R.finish();
})();
