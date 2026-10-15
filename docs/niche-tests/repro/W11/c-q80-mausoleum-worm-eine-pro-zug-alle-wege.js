'use strict';
// W11c · Q80 (C03-15) · Mausoleum Worm: „You can only play 1 'Mausoleum Worm' per turn" gilt für ALLE Wege aufs Brett zusammen
//
// Kartentext: „When a Hero you control is defeated by an opponent's card or effect, you may immediately place this Creature from your discard pile into one of the
//   defeated Hero's free Support Zones, and if you do, draw until you have 8 cards in your hand. You can only play 1 "Mausoleum Worm" per turn."
// ENTSCHIEDEN (Al, Welle 11, Q80): „Für alle Wege kombiniert." -> Handspiel UND Platzierung aus der Ablage teilen sich das Limit (je Spieler und Zug).
// Umsetzung: `mausoleum-worm.js`: `hooks.onPlay` stempelt `hoptUsed['mausoleum-worm:<Kontrolleur>']` bei jedem Eintritt aufs Brett, `canSummon` sperrt das
//   Handspiel danach, das Ablage-Angebot prüft denselben Stempel.
// Geprüft: (A) Hand zuerst -> Ablage-Angebot bleibt aus; (B) Ablage zuerst -> Handspiel abgelehnt und nicht summonbar gemeldet; (C) Gegenproben: ohne ersten Worm
//   darf der Hand-Worm gespielt werden; (D) im nächsten eigenen Zug wieder erlaubt; (E) der Gegner hat sein eigenes Limit (anderer Spieler, anderer Stempel).
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const W = 'Mausoleum Worm';
  const wuermer = (t) => t.inst(c => c.name === W && c.zone === 'support').length;
  const zone = (t) => t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  const toeteHeld = async (t, seat, hi) => {
    t.hero(seat, hi).hp = 50;
    await t.run(() => t.engine.actionDealDamage({ name: 'Fireball', owner: 1 - seat }, t.hero(seat, hi), 100, 'spell'));
  };

  R.section('(A) Hand zuerst, dann Heldentod im selben Zug: kein Ablage-Angebot');
  {
    const t = await H.fresh({ hand: [[W], []], discard: [[W], []], deckSize: 30 });
    zone(t);
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    const p = await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    await toeteHeld(t, 0, 1);
    R.check('(A) erster Worm von der Hand gespielt', p === true, p);
    R.check('(A) kein Ablage-Angebot (keine Rückfrage)', t.prompts.filter(x => x.d.title === W).length === 0, t.prompts.map(x => x.d.title));
    R.check('(A) genau 1 Mausoleum Worm auf dem Brett, 1 bleibt in der Ablage', wuermer(t) === 1 && t.gs.players[0].discardPile.includes(W), [wuermer(t), t.gs.players[0].discardPile]);
    R.check('(A) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(B) Ablage zuerst, dann zweiter Worm von der Hand');
  {
    const t = await H.fresh({ hand: [[W], []], discard: [[W], []], deckSize: 30 });
    zone(t);
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    await toeteHeld(t, 0, 1);
    R.check('(B) erster Worm aus der Ablage platziert', wuermer(t) === 1, wuermer(t));
    R.check('(B) die Engine meldet den Worm jetzt als nicht summonbar', t.engine.isCreatureSummonable(W, 0, 2) === false, t.engine.isCreatureSummonable(W, 0, 2));
    const r = await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    R.check('(B) Handspiel wird abgelehnt', r === false, r);
    R.check('(B) der Worm bleibt auf der Hand', t.gs.players[0].hand.includes(W), t.gs.players[0].hand);
    R.check('(B) weiterhin genau 1 Worm auf dem Brett', wuermer(t) === 1, wuermer(t));
    R.check('(B) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(C) Gegenprobe: ohne ersten Worm ist das Handspiel erlaubt');
  {
    const t = await H.fresh({ hand: [[W], []], deckSize: 30 });
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    R.check('(C) summonbar gemeldet', t.engine.isCreatureSummonable(W, 0, 2) === true, t.engine.isCreatureSummonable(W, 0, 2));
    const r = await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    R.check('(C) Handspiel gelingt', r === true && wuermer(t) === 1, [r, wuermer(t)]);
    R.check('(C) keine Engine-Fehler', t.errors.length === 0, t.errors);

    R.section('(D) nächster eigener Zug: wieder erlaubt');
    t.addHand(0, W);
    await t.endTurn(); await t.endTurn();
    const r2 = await t.play(0, W, { hero: 2, slot: 1, noGrant: true });
    R.check('(D) zweiter Worm im nächsten eigenen Zug gespielt', r2 === true && wuermer(t) === 2, [r2, wuermer(t)]);
    R.check('(D) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(E) das Limit ist je Spieler: Sitz 1 darf im eigenen Zug seinen Worm spielen');
  {
    const t = await H.fresh({ hand: [[W], [W]], deckSize: 30 });
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    t.setAbilities(1, 2, [Array(3).fill('Summoning Magic'), [], []]);
    const r0 = await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    await t.endTurn();
    const r1 = await t.play(1, W, { hero: 2, slot: 0, noGrant: true, phase: 3 });
    R.check('(E) Sitz 0 und Sitz 1 haben je einen Worm auf dem Brett', r0 === true && r1 === true && wuermer(t) === 2, [r0, r1, wuermer(t)]);
    R.check('(E) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
