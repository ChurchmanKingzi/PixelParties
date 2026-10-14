'use strict';
// W5b-Z1b (zu R02-10) · No Retreat! erkennt die Priests – Entscheidung Al (Welle 5): „No Retreat soll die Priests erkennen!"
// Priest of Luna / Tempeste: „You may shuffle 5 Creatures with different names from your discard pile back into your deck to summon this Creature as an additional Action."
// Erwartung: Aktiviert der Gegner die Zusatzbeschwörung (Main Phase), öffnet sich das No-Retreat!-Fenster VOR den Kosten.
//   Negiert: nichts gemischt/bezahlt (Ablage und Deck unverändert), der Priest bleibt auf der Hand, kein Priest auf dem Brett.
//   Nicht negiert (echtes „Nein"): Priest steht, die 5 Kreaturen sind im Deck.
//   Normale Beschwörung (Aktionsphase, Held hat noch nicht gehandelt) mischt nichts: kein Angebot.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const NAMEN = ['Cute Bunny', 'Cute Familiar', 'Cute Phoenix', 'Cute Hydra', 'Cute Dog'];
  for (const priest of ['Priest of Luna', 'Priest of Tempeste']) {
    for (const negieren of [true, false]) {
      const t = await H.fresh({ hand: [[priest], ['No Retreat!']], discard: [NAMEN, []], hp: 800, gold: [100, 100] });
      t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
      t.setAbilities(1, 0, [['Decay Magic'], [], []]);
      let gefragt = 0;
      t.script.push({ match: d => /No Retreat/.test(JSON.stringify(d).slice(0, 500)) && d.type === 'confirm', answer: () => { gefragt++; return negieren ? { confirmed: true } : null; } });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === priest, answer: (d) => ({ cardName: d.cards[0].name, source: 'discard' }) });
      const deck0 = t.pile(0, 'mainDeck').length;
      const r = await t.play(0, priest, { hero: 0, phase: 2, noGrant: true });
      const tag = `${priest} (${negieren ? 'negiert' : 'nicht negiert'})`;
      const auf = t.inst(c => c.name === priest && c.zone === 'support').length;
      R.check(`${tag}: No Retreat! wird gefragt`, gefragt === 1 || t.prompts.some(p => /No Retreat/.test(JSON.stringify(p.d).slice(0, 500))), { gefragt, r });
      if (negieren) {
        R.check(`${tag}: nichts gemischt, nichts bezahlt (Ablage 5, Deck unverändert)`, t.pile(0, 'discardPile').length === 5 && t.pile(0, 'mainDeck').length === deck0, { ablage: t.pile(0, 'discardPile'), deck: [deck0, t.pile(0, 'mainDeck').length] });
        R.check(`${tag}: Priest bleibt auf der Hand, nicht auf dem Brett`, t.pile(0, 'hand').includes(priest) && auf === 0, { hand: t.pile(0, 'hand'), auf });
        R.check(`${tag}: No Retreat! verbraucht (Ablage Sitz 1)`, t.pile(1, 'discardPile').includes('No Retreat!'), t.pile(1, 'discardPile'));
      } else {
        R.check(`${tag}: Priest steht, 5 Kreaturen im Deck`, auf === 1 && t.pile(0, 'mainDeck').length === deck0 + 5 && t.pile(0, 'discardPile').length === 0, { auf, deck: [deck0, t.pile(0, 'mainDeck').length], ablage: t.pile(0, 'discardPile') });
      }
      R.check(`${tag}: keine Engine-Fehler, Audit leer`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  {   // normale Beschwörung (Aktionsphase, noch nicht gehandelt): kein Mischen => kein Angebot
    const t = await H.fresh({ hand: [['Priest of Luna'], ['No Retreat!']], discard: [NAMEN, []], hp: 800, gold: [100, 100] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.setAbilities(1, 0, [['Decay Magic'], [], []]);
    t.policy.confirm = true;
    await t.play(0, 'Priest of Luna', { hero: 0, phase: 3, noGrant: true });
    R.check('normale Beschwörung (ohne Mischkosten): No Retreat! wird nicht angeboten', !t.prompts.some(p => /No Retreat/.test(JSON.stringify(p.d).slice(0, 500))), t.prompts.map(p => p.d.type));
  }
  R.finish();
})();
