'use strict';
// Erste-Runden-Immunität, Spielgate (CARD_API.md „Turn-1 Immunity": „What you DO have to handle: your play gate … If EVERY mode of your card targets the opponent, gate the whole card off …
// Fizzling mid-resolution instead is worse – the activation was already offered and its once-per-turn slot already spent.").
// Aufbau: echter Spielstart (`engine.startGame()`), Sitz 0 spielt in seinem ERSTEN Zug eine Karte, die ausschließlich den (geschützten, noch leeren) Gegner trifft.
// Erwartung: die Karte ist nicht spielbar bzw. bleibt auf der Hand (Gate). Beobachtung: sie wird ausgespielt, landet in der Ablage, die Aktion ist weg (und bei „once per game"-Karten
// auch das Einmal-Kontingent) – ohne irgendeine Wirkung.
const H = require('../../lib/h.js');
const KARTEN = ['Butterfly Cloud', 'Flame Avalanche', 'Boiling Oil', 'Rain of Arrows', 'Forbidden Zone', 'Future Tech Bomb', 'Laser Volley', 'Poisoned Well', 'Smoke Vial', 'Iceage',
  'Trial of Dominance', 'Trial of Annoyance', 'Divine Gift of Forgetting', 'Slow', 'Chain Lightning', 'Big Oopsie'];
(async () => {
  const R = H.runner();
  for (const card of KARTEN) {
    const cd = H.DB[card];
    const t = await H.fresh({ hand: [[card], Array(5).fill('ZZ Filler')], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], gold: [0, 20], turn: 0, phase: 0 });
    t.gs.turn = 0; t.gs.activePlayer = 0; t.gs.currentPhase = 0;
    t.grantFor(0, 0, card);
    await t.run(() => t.engine.startGame());
    t.gs.players[0].gold = 30;
    if (t.gs.currentPhase === 2 && cd.cardType !== 'Potion') await t.engine.advancePhase(0);
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : (valid.length ? [valid[0].id] : []); };
    t.reset();
    const heroesVorher = JSON.stringify(t.gs.players[1].heroes.map(h => [h.hp, Object.keys(h.statuses || {}).sort()]));
    const r = await t.play(0, card, { hero: 0, noGrant: true, phase: t.gs.currentPhase, keepActions: true });
    const verbraucht = r === true && !t.pile(0, 'hand').includes(card);
    const wirkung = JSON.stringify(t.gs.players[1].heroes.map(h => [h.hp, Object.keys(h.statuses || {}).sort()])) !== heroesVorher || t.pile(1, 'hand').length !== 5;
    const once = t.gs.players[0]._oncePerGameUsed ? [...t.gs.players[0]._oncePerGameUsed] : [];
    R.check(`${card}: gegen den geschützten Gegner nicht verbrennbar (Karte bleibt auf der Hand oder wirkt wirklich)`, !verbraucht || wirkung, { r, ablage: t.pile(0, 'discardPile'), onceStempel: once, phase: t.gs.currentPhase });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
