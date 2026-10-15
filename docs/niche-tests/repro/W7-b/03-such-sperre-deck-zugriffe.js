'use strict';
// W7-b/03 · Sperren-Fälle der Welle 7 (Entscheidung Al 14.10.2026): „ein Effekt, der so nicht feuern kann, ist nicht aktivierbar – keine Kosten ohne Wirkung"
//   a) A06-rebelliokai-10  Camouflaged Kappa: unter Knight of Kings [B] (Stapelsperre) und unter der Such-Sperre nicht aktivierbar, das Opfer bleibt erspart
//   e) F03-17  Spice Mortar unter der Such-Sperre gesperrt (Karte aus dem Gegnerdeck auf die eigene Hand)
//   f) H01-heroes-22  Shapeshifter/Throne Robber sind von der Such-Sperre NICHT erfasst (siehe auch H01-heroes/22)
//   h) M02-17  Magnetic Potion / Elixir of Mana: serverseitig gesperrt
//   i) M02-23  Navigation (legt eine Karte auf die Hand) unter der Such-/Hand-Sperre nicht aktivierbar. Al (15.10.): Trapping, Premonition und Training (Deck-Option) legen NICHTS auf die Hand
//      und werden von der Such-/Hand-Sperre NICHT erfasst – sie bleiben aktivierbar
//   j) S03-26  Shooting Star unter Hand-/Stab-Sperre nicht spielbar
const H = require('../../lib/h.js');
const D = H.INERT.creature;
const sperren = {
  'Such-Sperre (Cats)': (ps) => { ps.searchLocked = true; },
  'Hand-Sperre': (ps) => { ps.handLocked = true; },
};

(async () => {
  const R = H.runner();

  // ── a) Camouflaged Kappa ──
  R.section('a) Camouflaged Kappa');
  async function kappa(setup) {
    const t = await H.fresh({ deck: [['Fireball', ...Array(10).fill(D)], []] });
    setup(t);
    const k = t.put(0, 0, 0, 'Rebelliokai Camouflaged Kappa'); k.turnPlayed = t.gs.turn - 1;
    t.gs.currentPhase = 2; t.resetActions(0);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball' }) });
    const r = await t.activateCreature(0, 0, 0);
    return { t, r };
  }
  let o = await kappa(() => {});
  R.check('Kontrolle ohne Sperre: Kappa opfert sich und holt die Karte (ins Ablagefach)', o.t.zone(0, 0, 0) !== 'Rebelliokai Camouflaged Kappa', { slot: o.t.zone(0, 0, 0) });
  o = await kappa(t => { t.putArea(1, 'Board of Kings'); t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]'); });
  R.check('Knight of Kings [B]: Kappa nicht aktivierbar, bleibt auf dem Brett, Einmal-Sperre frei', o.t.zone(0, 0, 0) === 'Rebelliokai Camouflaged Kappa' && o.t.pile(0, 'discardPile').length === 0, { slot: o.t.zone(0, 0, 0), ablage: o.t.pile(0, 'discardPile') });
  o = await kappa(t => { t.gs.players[0].searchLocked = true; });
  R.check('Such-Sperre: Kappa nicht aktivierbar, bleibt auf dem Brett', o.t.zone(0, 0, 0) === 'Rebelliokai Camouflaged Kappa' && o.t.pile(0, 'discardPile').length === 0, { slot: o.t.zone(0, 0, 0) });
  R.check('keine Engine-Fehler', o.t.errors.length === 0, o.t.errors);

  // ── e) Spice Mortar ──
  R.section('e) Spice Mortar');
  for (const [name, fn] of [['ohne Sperre (Kontrolle)', null], ...Object.entries(sperren)]) {
    const potionDeck = ['Acid Vial', ...Array(11).fill('Bird')];
    const t = await H.fresh({ hand: [['Spice Mortar'], []], deck: [[], potionDeck] });
    if (fn) fn(t.gs.players[0]);
    t.script.push({ match: d => d.type === 'deckPeekPick' && d.title === 'Spice Mortar', answer: () => ({ cardName: 'Acid Vial', source: 'deck' }), once: false });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Spice Mortar', answer: () => ({ confirmed: false }), once: false });
    const r = await t.play(0, 'Spice Mortar');
    if (!fn) R.check(`Spice Mortar ${name}: holt die Potion`, t.pile(0, 'hand').includes('Acid Vial'), { r, hand: t.pile(0, 'hand') });
    else R.check(`Spice Mortar unter ${name}: nicht spielbar, bleibt auf der Hand`, r === false && t.pile(0, 'hand').includes('Spice Mortar') && !t.pile(0, 'hand').includes('Acid Vial'), { r, hand: t.pile(0, 'hand') });
  }

  // ── h) Magnetic Potion / Elixir of Mana (serverseitig) ──
  R.section('h) Magnetic Potion / Elixir of Mana');
  for (const [name, lock] of [['Magnetic Potion', { searchLocked: true }], ['Elixir of Mana', { searchLocked: true, searchLockedIncludesDiscard: true }]]) {
    const t = await H.fresh({ hand: [[], []], deck: [['Fighting', 'Toughness', 'Wealth', 'ZZ Dummy'], ['ZZ Dummy']], discard: [['Fighting', 'Fireball'], []] });
    Object.assign(t.gs.players[0], lock);
    t.setHand(0, [name, 'ZZ Filler']);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
    const r = await t.play(0, name, { hero: 0, noGrant: true, handIndex: 0 });
    R.check(`${name} unter Such-Sperre: Server lehnt ab, Karte bleibt auf der Hand, kein Stempel`, r === false && t.pile(0, 'hand').includes(name) && !t.pile(0, 'deletedPile').includes(name), { r, hand: t.pile(0, 'hand') });
  }

  // ── i) Navigation, Trapping, Premonition (freie Abilities), Training (Deck-Option) ──
  R.section('i) Navigation gesperrt; Trapping, Premonition, Training unberührt');
  async function frei(ability, lv, setup, hand) {
    const zones = [Array(lv).fill(ability), [], []];
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [['Booby Trap', 'Fighting', 'Wealth', 'ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy']] });
    t.setAbilities(0, 0, zones);
    t.setHand(0, hand || []);
    if (setup) setup(t.gs.players[0]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.gs.activePlayer = 0; t.phase(2);
    const r = await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    return { t, r };
  }
  {
    const x = await frei('Navigation', 2, null, ['Fireball', 'Fireball', 'ZZ Filler']);
    R.check('Navigation: Kontrolle ohne Sperre läuft', x.t.pile(0, 'discardPile').length > 0 || x.t.pile(0, 'hand').length > 0, { r: x.r });
    for (const [lbl, fn] of Object.entries(sperren)) {
      const y = await frei('Navigation', 2, fn, ['Fireball', 'Fireball', 'ZZ Filler']);
      R.check(`Navigation unter ${lbl}: nicht aktivierbar, nichts abgeworfen, Einmal-Sperre frei`, !y.r && y.t.pile(0, 'discardPile').length === 0 && !y.t.gs.hoptUsed?.['free-ability:Navigation:0'], { r: y.r, ablage: y.t.pile(0, 'discardPile') });
      R.check('keine Engine-Fehler', y.t.errors.length === 0, y.t.errors);
    }
  }
  // Trapping / Premonition legen nichts auf die Hand: auch unter Such- und Hand-Sperre aktivierbar (Al 15.10.)
  for (const ab of ['Trapping', 'Premonition']) {
    for (const [lbl, fn] of Object.entries(sperren)) {
      const x = await frei(ab, 1, fn, []);
      const gelegt = x.t.gs.players[0].surpriseZones[0].length > 0 || (x.t.gs.players[0].deckTopVisible || []).length > 0;
      R.check(`${ab} unter ${lbl}: weiter aktivierbar (legt nichts auf die Hand)`, gelegt, { r: x.r });
      R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
    }
  }
  // Training: Deck-Option bleibt unter der Such-Sperre aktivierbar
  {
    async function trainingKann(lv, hand, lock) {
      const t = await H.fresh({ hand: [[], []], hp: 800, deck: [['Fighting', 'Wealth', 'ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy']] });
      t.setAbilities(0, 0, [Array(lv).fill('Training'), [], []]);
      t.setHand(0, hand);
      if (lock) lock(t.gs.players[0]);
      t.gs.activePlayer = 0; t.phase(2);
      const liste = t.engine.getFreeActivatableAbilities(0).filter(e => (e.abilityName || e.cardName || e.name) === 'Training');
      return liste.some(e => e.canActivate !== false);
    }
    R.check('Training Lv3, nur Deck-Option möglich, Such-Sperre: weiter aktivierbar', (await trainingKann(3, [], sperren['Such-Sperre (Cats)'])) === true);
    R.check('Training Lv2, Deck-Option (Abwurf + Deck), Such-Sperre: weiter aktivierbar', (await trainingKann(2, ['ZZ Filler'], sperren['Such-Sperre (Cats)'])) === true);
  }

  // ── j) Shooting Star ──
  R.section('j) Shooting Star');
  for (const [lbl, fn] of [['Hand-Sperre', (t) => { t.gs.players[0].handLocked = true; }], ['Stab-Sperre', (t) => { t.gs.players[0]._discardLockedTurn = t.gs.turn; }]]) {
    const t = await H.fresh({ hand: [['Shooting Star'], []], hp: 800, discard: [['Fireball', 'Meteor Crash'], []], deckSize: 10 });
    fn(t);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    const r = await t.play(0, 'Shooting Star', { hero: 0 });
    R.check(`Shooting Star unter ${lbl}: nicht spielbar, Karte bleibt auf der Hand`, r === false && t.pile(0, 'hand').includes('Shooting Star'), { r, hand: t.pile(0, 'hand') });
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + "\n"); process.exit(2); });
