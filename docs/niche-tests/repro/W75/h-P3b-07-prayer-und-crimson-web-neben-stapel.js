'use strict';
// W75 · Darion — Audit P3b: Anhaengsel mit Klick-Wirkung (Prayer, Crimson Web) neben einem Equip-Stapel.
// Kartentexte: Prayer „… Once per turn you may discard any number of Abilities from your hand and draw 1 card for each …"; Crimson Web „Activate this Surprise when the user is chosen by an Attack or Spell. Negate … attach this card to the attacker …
//   You may at any time discard a card to send this card attached to a Hero you control to the discard pile."
// Erwartet: (1) Darion traegt Prayer in Platz 1 und den Stapel Club / Blade / Crown in Platz 2: Prayer ist einmal aktivierbar (zoneSlot 0), die Stapel-Karten loesen Prayer nicht aus; der Stapel bleibt unberuehrt.
//          (2) Crimson Web (Surprise des Gegners) haengt sich an Darion als Angreifer in eine FREIE Zone (nicht in den Stapel). Verlaesst danach ein Equip den Stapel, bleibt das Netz wirksam (Darion bleibt webbed).
//              Entwirren (Karte abwerfen) nimmt nur das Netz weg, der Rest des Stapels bleibt.
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-07-prayer-und-crimson-web-neben-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  R.section('(1) Prayer neben dem Stapel');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Fighting', F, F], [F]], deck: [Array(15).fill(F), Array(15).fill(F)], gold: 500 });
    const insts = stapel(t, 0, NAMEN);
    const prayer = t.put(0, 0, 0, 'Prayer'); prayer.turnPlayed = 1;
    t.phase(2);
    const act = t.engine.getActivatableEquips(0);
    R.note('act', JSON.stringify(act));
    R.check('Prayer erscheint genau einmal in der Aktivierungsliste', act.filter(a => a.cardName === 'Prayer').length === 1, act);
    t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ handIndex: 0, cardName: 'Fighting' }] }) });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Prayer', answer: () => ({ confirmed: false }) });
    const ra = await t.activateEquip(0, 0, 0);
    R.note('ra', JSON.stringify(ra) + JSON.stringify({ hand: t.pile(0, 'hand'), abl: t.pile(0, 'discardPile') }));
    R.check('Prayer wirkte: Fighting abgeworfen, eine Karte gezogen', t.pile(0, 'discardPile').includes('Fighting') && t.pile(0, 'hand').length === 3, [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
    R.check('Stapel unveraendert', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(NAMEN) && insts.every(i => i.zone === 'support'), t.gs.players[0].supportZones[0]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('(2) Crimson Web haengt sich an Darion (Angreifer) neben den Stapel');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Burning Finger', F], [F, F]], deck: [Array(15).fill(F), Array(15).fill(F)], gold: 500 });
    const insts = stapel(t, 0, NAMEN);
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);
    t.putSurprise(1, 0, 'Crimson Web');
    t.grantFor(0, 0, 'Burning Finger');
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return [(h || valid[0]).id]; };
    t.policy.confirm = true;
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    await t.drain();
    const web = t.find('Crimson Web', 'support');
    R.note('lauf', JSON.stringify({ zonen: t.gs.players[0].supportZones[0], web: web && { slot: web.zoneSlot, ctrl: web.controller }, webbed: !!t.hero(0, 0).statuses.webbed }));
    R.check('Crimson Web liegt bei Darion in einer freien Zone, nicht im Stapel', !!web && web.zoneSlot !== 1 && !t.gs.players[0].supportZones[0][1].includes('Crimson Web'), t.gs.players[0].supportZones[0]);
    R.check('Darion ist webbed, der Stapel unveraendert', !!t.hero(0, 0).statuses.webbed && JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(NAMEN) && insts.every(i => i.zone === 'support'), t.gs.players[0].supportZones[0]);
    // Ein Equip verlaesst den Stapel: das Netz bleibt wirksam (webbed bleibt) — der Abgang einer ANDEREN Karte hebt es nicht auf
    if (web) {
      await t.run(() => t.engine.sendBoardCardToDiscard(insts[2], { source: 'Test' }));
      R.check('Ein Equip aus dem Stapel abgeworfen: Darion bleibt webbed, Netz liegt noch', !!t.hero(0, 0).statuses.webbed && web.zone === 'support', [t.hero(0, 0).statuses, web.zone]);
    }
    // Entwirren: Karte abwerfen, das Netz geht in die Ablage seines Besitzers (Sitz 1), webbed endet
    if (web) {
      t.script.push({ match: d => d.type === 'confirm' && /untangle/i.test(d.message || ''), answer: () => ({ confirmed: true }) });
      const handVor = t.pile(0, 'hand').length;
      await t.activateEquip(0, 0, web.zoneSlot);
      R.note('entwirrt', JSON.stringify({ zonen: t.gs.players[0].supportZones[0], webbed: !!t.hero(0, 0).statuses.webbed, abl1: t.pile(1, 'discardPile') }));
      R.check('Netz in der Ablage von Sitz 1, webbed weg', t.pile(1, 'discardPile').includes('Crimson Web') && !t.hero(0, 0).statuses.webbed, [t.pile(1, 'discardPile'), t.hero(0, 0).statuses]);
      R.check('Stapel nach dem Entwirren: Club + Blade (Crown wurde vorher abgeworfen)', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify([NAMEN[0], NAMEN[1]]) && insts[0].zone === 'support' && insts[1].zone === 'support', t.gs.players[0].supportZones[0]);
    }
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
