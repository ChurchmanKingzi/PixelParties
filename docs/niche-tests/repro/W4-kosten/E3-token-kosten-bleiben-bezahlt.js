'use strict';
// W4-E3 · Token-Kosten „Place N Pollution Tokens … to use this Spell / to play this card" (Befund A01-17): Medusa's Curse, Null Zone, Goldify, Reincarnation,
//   Mass Multiplication, Golden Wings (Cold Coffin/Eraser Beam als Referenz, die schon vor dem Fenster zahlen).
// Regel (Al, Welle 3/4): ganz negierte Karte (Silence) verbraucht nichts, aber bezahlte Kosten bleiben bezahlt; Kosten werden VOR dem Reaktionsfenster gezahlt.
// Erwartung je Karte: (1) Silence in der Kette: die Tokens liegen schon BEIM Fenster und bleiben liegen, der Effekt tritt nicht ein;
//                     (2) Kontrolle ohne Negation: dieselbe Zahl Tokens, Effekt tritt ein.
// Aufruf: node docs/niche-tests/repro/W4-kosten/E3-token-kosten-bleiben-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
const D = H.INERT.creature;
const FALLE = [
  { spell: 'Cold Coffin', kosten: 2 },
  { spell: 'Eraser Beam', kosten: 3 },
  { spell: "Medusa's Curse", kosten: 2, effekt: (t) => t.gs.players[1].heroes[0].statuses?.stunned },
  { spell: 'Null Zone', kosten: 2, effekt: (t) => t.gs.players[1].heroes[0].statuses?.nulled },
  { spell: 'Goldify', kosten: 1, bau: (t) => { t.put(1, 0, 0, D); }, effekt: (t) => t.inst(c => c.zone === 'support' && c.owner === 1 && c.name === D).length === 0 },
  { spell: 'Reincarnation', kosten: 2, bau: (t) => { t.gs.players[0].heroes[2].hp = 0; }, effekt: (t) => t.hp(0, 2) > 0 },
  { spell: 'Mass Multiplication', kosten: 1, hand: ['Mass Multiplication', 'Fireball'], deck: ['Fireball', 'Fireball', 'Fireball', D, D], effekt: (t) => t.pile(0, 'hand').filter(n => n === 'Fireball').length === 3 },
  { spell: 'Golden Wings', kosten: 1, bau: (t) => { t.put(0, 0, 0, D); }, effekt: (t) => t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === D)[0]?.counters?._gwImmune === true },
];
async function bau(f, silence) {
  const t = await H.fresh({ hand: [f.hand || [f.spell], silence ? ['Silence'] : []], discard: [['Soul Shard Ba'], []], deck: f.deck ? [f.deck, []] : undefined });
  if (silence) t.grantFor(1, 0, 'Silence');
  t.put(1, 0, 2, 'Soul Shard Ba');                       // nicht nötig, nur Füllung (wie A01-17)
  if (f.bau) f.bau(t);
  t.policy.confirm = true;
  t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0) || v.find(x => x.owner === 0) || v[0]; return h ? [h.id] : []; };
  return t;
}
(async () => {
  const R = H.runner();
  for (const f of FALLE) {
    {
      const t = await bau(f, true);
      if (f.spell === 'Reincarnation') t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'revive' }) });
      let beimFenster = null;
      t.script.unshift({ match: d => d.type === 'confirm' && /Silence/.test(JSON.stringify(d)), answer: () => { beimFenster = tokens(t, 0); return { confirmed: true }; }, once: true });
      await t.play(0, f.spell, { hero: 0 });
      R.check(`${f.spell}: (1) Silence gespielt, Tokens lagen schon beim Fenster (${f.kosten})`, beimFenster === f.kosten && !t.pile(1, 'hand').includes('Silence'), { beimFenster, silenceHand: t.pile(1, 'hand') });
      R.check(`${f.spell}: (1) negiert: ${f.kosten} Token bleiben bezahlt`, tokens(t, 0) === f.kosten, tokens(t, 0));
      if (f.effekt) R.check(`${f.spell}: (1) negiert: Effekt tritt nicht ein`, !f.effekt(t), null);
      R.check(`${f.spell}: (1) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    if (f.effekt) {
      const t = await bau(f, false);
      if (f.spell === 'Reincarnation') t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'revive' }) });
      await t.play(0, f.spell, { hero: 0 });
      R.check(`${f.spell}: (2) Kontrolle ohne Negation: ${f.kosten} Token und Effekt`, tokens(t, 0) === f.kosten && !!f.effekt(t), { tokens: tokens(t, 0), effekt: !!f.effekt(t) });
      R.check(`${f.spell}: (2) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
