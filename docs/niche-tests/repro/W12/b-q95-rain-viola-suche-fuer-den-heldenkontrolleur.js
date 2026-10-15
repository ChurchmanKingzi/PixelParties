// W12b · Q95 (F02-07) · Rain Viola: die Suche gehört IMMER dem Spieler, dessen Held mit der Viola ausgerüstet war – egal, wem die Karte gehört
// Al: „Rain Viola soll immer für den Spieler suchen, dessen Hero ausgerüstet war, egal, wem die Viola selbst eigentlich gehört."
// CARD_API-Ruling „erlaubt, aber wirkungslos" bezieht sich NICHT auf den Träger: am Gegner-Helden profitiert der Spieler, dem der Held gehört/den er kontrolliert.
// Erwartung: (a) Viola (Besitzer Sitz 0) am Helden von Sitz 1, zerstört → Sitz 1 sucht (Galerie, +1 Handkarte), Sitz 0 nicht; die Karte liegt in der Ablage von Sitz 0.
//   (b) Viola am eigenen Helden → der Besitzer sucht. (c) Held mit der Viola dauerhaft vom Gegner übernommen (Paraseed Control & Co.) → der Übernehmende sucht.
//   Dasselbe für die Geschwister Communication-Device/Thunder-Trumpet-Muster ist nicht Teil dieser Prüfung (gleiche Hilfsfunktion `instrumentDiscardTrigger`). Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const deck = ['Fireball', 'Attack', 'ZZ Dummy', 'Fireball', 'Heavy Hit', 'ZZ Dummy'];
  async function aufbau() {
    const t = await H.fresh({ hand: [['Rain Viola'], []], deck: [deck, deck] });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d, pi) => ({ cardName: d.cards[0].name }), once: false });
    return t;
  }
  { // (a) Viola am Gegner-Helden
    const t = await aufbau();
    await t.play(0, 'Rain Viola', { hero: 0, targetOwner: 1 });
    const vi = t.inst(c => c.name === 'Rain Viola' && c.zone === 'support')[0];
    R.check('(a) Viola liegt am Gegnerhelden', t.zone(1, 0, 0) === 'Rain Viola' && !!vi, t.zone(1, 0, 0));
    const h0 = t.pile(0, 'hand').length, h1 = t.pile(1, 'hand').length;
    t.reset();
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, vi));
    R.check('(a) Viola ist in der Ablage ihres Besitzers (Sitz 0)', t.pile(0, 'discardPile').includes('Rain Viola'), t.pile(0, 'discardPile'));
    R.check('(a) Sitz 1 (Heldenkontrolleur) sucht: Galerie an Sitz 1, +1 Handkarte', t.pile(1, 'hand').length === h1 + 1 && t.prompts.some(p => p.pi === 1 && p.d.type === 'cardGallery'), { hand1: t.pile(1, 'hand'), prompts: t.prompts.map(p => p.pi + ':' + p.d.type) });
    R.check('(a) Sitz 0 (Besitzer der Viola) sucht NICHT', t.pile(0, 'hand').length === h0 && !t.prompts.some(p => p.pi === 0 && p.d.type === 'cardGallery'), t.pile(0, 'hand'));
    R.check('(a) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (b) eigener Held
    const t = await aufbau();
    await t.play(0, 'Rain Viola', { hero: 0 });
    const vi = t.inst(c => c.name === 'Rain Viola' && c.zone === 'support')[0];
    const h0 = t.pile(0, 'hand').length, h1 = t.pile(1, 'hand').length;
    t.reset();
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, vi));
    R.check('(b) eigener Held: der Besitzer sucht (+1), der Gegner nicht', t.pile(0, 'hand').length === h0 + 1 && t.pile(1, 'hand').length === h1, { h0: t.pile(0, 'hand'), h1: t.pile(1, 'hand') });
  }
  { // (c) Held mit Viola wird dauerhaft vom Gegner übernommen
    const t = await aufbau();
    await t.play(0, 'Rain Viola', { hero: 0 });
    const ok = await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 0, { sourceName: 'test' }));
    const vi = t.inst(c => c.name === 'Rain Viola' && c.zone === 'support')[0];
    const h0 = t.pile(0, 'hand').length, h1 = t.pile(1, 'hand').length;
    t.reset();
    if (vi) await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, vi));
    R.check('(c) Viola am dauerhaft übernommenen Helden: der Übernehmende (Sitz 1) sucht', !!vi && t.pile(1, 'hand').length === h1 + 1 && t.pile(0, 'hand').length === h0, { ok, vi: !!vi, h0: t.pile(0, 'hand'), h1: t.pile(1, 'hand') });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
