'use strict';
// W14b · Q163 (S01-18, Detection und Create Secret Room) · Al, 16.10.2026: „Nur Karten mit Subtype Surprise. Aber eine verdeckte Nicht-Surprise sollte vorübergehend aufgedeckt werden,
//   der Gegner soll sie, wie eine Suche, bestätigen müssen, und dann wird sie wieder verdeckt."
// Erwartet: (a) eine per Create Secret Room verdeckt gelegte Nicht-Surprise (Fireball) zählt nicht: ist sie die einzige Karte, ist Detection nicht spielbar; (b) neben einer echten Surprise
//   (Booby Trap): nur die Booby Trap wird entfernt, 2 Karten gezogen; der Detection-Nutzer bekommt den Fireball gezeigt (Bestätigung `deckSearchReveal`), der Fireball bleibt danach verdeckt
//   und unverändert in der Surprise Zone liegen (nicht entfernt, nicht gezählt, Geheimraum-Marke bleibt); (c) ohne verdeckte Nicht-Surprise: kein Zeigen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function szene(mitBoobyTrap) {
    const t = await H.fresh({ hand: [['Detection'], ['Create Secret Room']], deck: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], ['Fireball', 'Fireball', 'Fireball', 'Fireball']] });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Secret Room', answer: () => ({ cardName: 'Fireball' }) });
    await t.play(1, 'Create Secret Room', { hero: 0, active: 1 });
    if (mitBoobyTrap) t.putSurprise(1, 1, 'Booby Trap');
    return t;
  }
  R.section('(a) nur die Nicht-Surprise');
  {
    const t = await szene(false);
    R.check('Aufbau: Fireball liegt verdeckt in der Surprise Zone von Sitz 1', (t.gs.players[1].surpriseZones[0] || []).includes('Fireball'), t.gs.players[1].surpriseZones);
    const r = await t.play(0, 'Detection', { hero: 0 });
    R.check('Detection ist nicht spielbar (keine Surprise des Gegners), Fireball bleibt liegen', r === false && (t.gs.players[1].surpriseZones[0] || []).includes('Fireball'), { r });
    R.check('keine Fehler', t.errors.length === 0, t.errors);
  }
  R.section('(b) Nicht-Surprise + echte Surprise');
  {
    const t = await szene(true);
    const hand0 = t.pile(0, 'hand').length;           // Detection
    const marke = t.engine.cardInstances.find(c => c.owner === 1 && c.zone === 'surprise' && c.name === 'Fireball')?.counters?.secretRoom;
    t.prompts.length = 0;
    const r = await t.play(0, 'Detection', { hero: 0 });
    const zeigen = t.prompts.filter(p => p.d.type === 'deckSearchReveal' && p.pi === 0);
    R.check('Detection wurde gespielt', r === true, r);
    R.check('der Detection-Nutzer bekam den Fireball gezeigt (genau 1 Bestätigung, Titel Detection)', zeigen.length === 1 && zeigen[0].d.cardName === 'Fireball' && zeigen[0].d.title === 'Detection', zeigen.map(p => p.d));
    R.check('Booby Trap entfernt (Ablage von Sitz 1), 2 Karten gezogen', t.pile(1, 'discardPile').includes('Booby Trap') && t.pile(0, 'hand').length - (hand0 - 1) === 2, { abl1: t.pile(1, 'discardPile'), hand: t.pile(0, 'hand').length });
    const inst = t.engine.cardInstances.find(c => c.owner === 1 && c.zone === 'surprise' && c.name === 'Fireball');
    R.check('der Fireball liegt weiter verdeckt in der Surprise Zone (nicht entfernt, nicht gezählt, wieder verdeckt)', (t.gs.players[1].surpriseZones[0] || []).includes('Fireball') && inst && inst.faceDown === true, { zone: t.gs.players[1].surpriseZones[0], fd: inst?.faceDown });
    R.check('Geheimraum-Marke unverändert', JSON.stringify(inst?.counters?.secretRoom) === JSON.stringify(marke), { marke, jetzt: inst?.counters?.secretRoom });
    R.check('keine Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.section('(c) nur echte Surprise: nichts zu zeigen');
  {
    const t = await H.fresh({ hand: [['Detection'], []] });
    t.putSurprise(1, 0, 'Booby Trap');
    t.prompts.length = 0;
    const r = await t.play(0, 'Detection', { hero: 0 });
    R.check('Detection wirkt, keine Aufdeck-Bestätigung', r === true && !t.prompts.some(p => p.d.type === 'deckSearchReveal') && t.pile(1, 'discardPile').includes('Booby Trap'), { r, pr: t.prompts.map(p => p.d.type) });
  }
  R.finish();
})();
