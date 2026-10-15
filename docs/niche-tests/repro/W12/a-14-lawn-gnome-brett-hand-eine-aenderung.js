'use strict';
// W12a · Rückfrage 14 (Lawn Gnome: Hand -> Brett -> Hand im selben Zug) · Al, 15.10.2026: „Ja"
//   Lawn Gnome: „You may once per turn change this card's level in your hand or on the board while you control it to any level from 0 to 3."
// Erwartet: Die Einmal-Grenze für die Stufenänderung gilt auch dann, wenn der Gnom im selben Zug vom Brett zurück auf die Hand geht - die Sperre wandert mit der Karte:
//   (a) Brett geändert -> zurück auf die Hand: dort im selben Zug nicht noch einmal änderbar (Hand->Brett->Hand bleibt eine Änderung); (b) im nächsten eigenen Zug wieder erlaubt;
//   (c) Brett NICHT geändert -> zurück auf die Hand: die Änderung in der Hand ist erlaubt (nichts verbraucht); (d) Hand geändert -> gespielt -> zurück -> noch gesperrt
//   (die Sperre aus der Hand wandert über das Brett wieder in die Hand); (e) die Kopie ohne Änderung wird nicht mit gesperrt (Sperre je KOPIE).
// Umsetzung: `counters._stufeGeaendertZug` auch bei der Brettänderung, `beimRueckgangInHand` (Skriptvertrag) über `handZugangSync(…, { vonInst })` der Bounce-Wege in
//   `_deepsea-shared.js`, `canHandActivateAt` je Handindex (`getHandActivatableCards`, `doHandActivate`).
const H = require('../../lib/h.js');
const { returnSupportCreatureToHand } = require('../../../../cards/effects/_deepsea-shared');
const G = 'Inconspicuous Lawn Gnome';
(async () => {
  const R = H.runner();
  const wahl = (t, id) => { t.script.length = 0; t.script.push({ match: d => d.title === G, answer: () => ({ optionId: id }), once: false }); };
  const nachBrett = async (t, extra = {}) => {
    const p = await t.play(0, G, { hero: 0, slot: 0, noGrant: true, ...extra });
    const g = t.inst(c => c.name === G && c.zone === 'support')[0];
    if (g) g.turnPlayed = 1;
    return { p, g };
  };
  const brettAendern = async (t, id) => {
    wahl(t, id); t.gs.activePlayer = 0; t.phase(2);
    return t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
  };
  const handAendern = async (t, idx, id) => {
    wahl(t, id); t.gs.activePlayer = 0; t.phase(2);
    return t.run(() => t.engine.doHandActivate(0, G, idx));
  };
  const zurueck = async (t, g) => t.run(() => returnSupportCreatureToHand(t.engine, g, 'Test-Bounce'));
  const aktivierbar = (t, idx) => t.engine.getHandActivatableCards(0).some(c => c.cardName === G && c.handIndex === idx);

  R.section('(a) Brett geändert -> zurück auf die Hand: in der Hand gesperrt');
  {
    const t = await H.fresh({ hand: [[G], []] });
    t.setAbilities(0, 0, [Array(3).fill('Summoning Magic'), [], []]);
    const { p, g } = await nachBrett(t);
    R.check('(a) Gnom auf dem Brett', p === true && !!g, p);
    const r1 = await brettAendern(t, 'lvl3');
    R.check('(a) Brettänderung angenommen', r1 === true, r1);
    const b = await zurueck(t, g);
    R.check('(a) Gnom zurück auf der Hand', b?.returned === true && t.gs.players[0].hand.includes(G), { b, hand: t.gs.players[0].hand });
    t.gs.activePlayer = 0; t.phase(2);
    R.check('(a) die Hand-Aktivierung wird im Client nicht angeboten', aktivierbar(t, t.gs.players[0].hand.indexOf(G)) === false, t.engine.getHandActivatableCards(0));
    wahl(t, 'lvl1');
    const r2 = await t.run(() => t.engine.doHandActivate(0, G, t.gs.players[0].hand.indexOf(G)));
    R.check('(a) zweite Änderung im selben Zug (Hand) wird NICHT angenommen', r2 === false, r2);
    R.check('(a) kein Prompt dafür geöffnet', !t.prompts.some(x => x.d.title === G && /Set this copy/.test(x.d.message || '')), t.prompts.map(x => x.d.title));

    R.section('(b) im nächsten eigenen Zug wieder erlaubt');
    await t.endTurn(); await t.endTurn();
    t.gs.activePlayer = 0; t.phase(2);
    const idx = t.gs.players[0].hand.indexOf(G);
    R.check('(b) Hand-Aktivierung wird wieder angeboten', aktivierbar(t, idx) === true, t.engine.getHandActivatableCards(0));
    wahl(t, 'lvl2');
    const r3 = await t.run(() => t.engine.doHandActivate(0, G, idx));
    R.check('(b) Änderung in der Hand angenommen', r3 === true, r3);
    R.check('(a/b) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(c) Brett NICHT geändert -> zurück auf die Hand: eine Änderung in der Hand ist erlaubt');
  {
    const t = await H.fresh({ hand: [[G], []] });
    t.setAbilities(0, 0, [Array(3).fill('Summoning Magic'), [], []]);
    const { g } = await nachBrett(t);
    const b = await zurueck(t, g);
    t.gs.activePlayer = 0; t.phase(2);
    const idx = t.gs.players[0].hand.indexOf(G);
    R.check('(c) zurück auf der Hand', b?.returned === true && idx >= 0, b);
    R.check('(c) Hand-Aktivierung wird angeboten (nichts verbraucht)', aktivierbar(t, idx) === true, t.engine.getHandActivatableCards(0));
    const r = await handAendern(t, idx, 'lvl2');
    R.check('(c) Änderung in der Hand angenommen', r === true, r);
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(d) Hand geändert -> gespielt -> zurück auf die Hand: noch gesperrt');
  {
    const t = await H.fresh({ hand: [[G], []] });
    t.setAbilities(0, 0, [Array(3).fill('Summoning Magic'), [], []]);
    const r0 = await handAendern(t, 0, 'lvl2');
    const { g } = await nachBrett(t);
    const b = await zurueck(t, g);
    t.gs.activePlayer = 0; t.phase(2);
    const idx = t.gs.players[0].hand.indexOf(G);
    R.check('(d) Hand geändert, gespielt, zurück', r0 === true && b?.returned === true && idx >= 0, { r0, b });
    R.check('(d) in der Hand im selben Zug nicht noch einmal änderbar', aktivierbar(t, idx) === false, t.engine.getHandActivatableCards(0));
    R.check('(d) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(e) die Sperre gehört der geänderten KOPIE: eine zweite Kopie in der Hand bleibt änderbar');
  {
    const t = await H.fresh({ hand: [[G, G], []] });
    t.setAbilities(0, 0, [Array(3).fill('Summoning Magic'), [], []]);
    const { g } = await nachBrett(t, { handIndex: 0 });
    await brettAendern(t, 'lvl3');
    await zurueck(t, g);
    t.gs.activePlayer = 0; t.phase(2);
    const hand = t.gs.players[0].hand;
    const frei = [0, 1].filter(i => aktivierbar(t, i));
    R.check('(e) zwei Gnome auf der Hand, genau EINER ist änderbar (die unveränderte Kopie)', hand.filter(n => n === G).length === 2 && frei.length === 1, { hand, frei });
    R.check('(e) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
