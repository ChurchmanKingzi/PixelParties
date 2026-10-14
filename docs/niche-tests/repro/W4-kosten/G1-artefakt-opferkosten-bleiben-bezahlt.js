'use strict';
// W4-G1 · Artefakt-Opferkosten „… to play this card" (Hive's Crown, Ladder to the Sky, Remote Detonator): das Opfer/Löschen ist ein Kostenpunkt, wird VOR dem Reaktionsfenster bezahlt
//   und bleibt bei ganz negiertem Artefakt (The Master's Plan) bezahlt; die Wirkung entfällt.
// Erwartung je Karte: (1) negiert: Kosten schon BEIM Fenster bezahlt, bleiben bezahlt, keine Wirkung; (2) Kontrolle ohne Negation: Kosten + Wirkung;
//                     (3) Abbruch der Opferwahl (Ladder): nichts bezahlt, Karte bleibt auf der Hand.
// Aufruf: node docs/niche-tests/repro/W4-kosten/G1-artefakt-opferkosten-bleiben-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const PLAN = "The Master's Plan";
const D = H.INERT.creature;
const auf = (t, name, seat = 0) => t.inst(c => c.zone === 'support' && c.owner === seat && c.name === name).length;
const alt = (t) => { for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0; };
const FALLE = [
  { name: "Hive's Crown", hand: ["Hive's Crown", 'Sparkfly Queen'],
    bau: (t) => { t.put(0, 0, 0, 'Sparkfly Worker'); alt(t); },
    bezahlt: (t) => auf(t, 'Sparkfly Worker') === 0, wirkung: (t) => auf(t, 'Sparkfly Queen') === 1 },
  { name: 'Ladder to the Sky', deck: ['Afflicted Pests', 'Afflicted Pests', D, D, D, D],
    bau: (t) => { t.put(0, 0, 0, D); alt(t); },
    bezahlt: (t) => auf(t, D) === 0, wirkung: (t) => t.inst(c => c.name === 'Ladder to the Sky' && c.zone === 'discard' && c.counters?._ladderArmedTurn != null).length === 1 },
  { name: 'Remote Detonator', bau: (t) => { t.put(0, 0, 0, 'Sentient Bomb Golems'); t.put(0, 0, 1, 'Sentient Bomb Golems'); },
    bezahlt: (t) => auf(t, 'Sentient Bomb Golems') === 0 && t.pile(0, 'deletedPile').filter(n => n === 'Sentient Bomb Golems').length === 2, wirkung: (t) => t.hp(1, 0) === 400 },
];
async function bau(f, negieren) {
  const t = await H.fresh({ hand: [f.hand || [f.name], negieren ? [PLAN] : []], deck: f.deck ? [f.deck, []] : undefined });
  if (negieren) t.grantFor(1, 0, PLAN);
  f.bau(t);
  t.policy.confirm = true;
  t.targetFn = (v) => {
    const e = v.filter(x => !x.ineligible);
    const h = e.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0);
    return h && f.name === 'Remote Detonator' ? [h.id] : e.slice(0, 1).map(x => x.id);
  };
  return t;
}
(async () => {
  const R = H.runner();
  for (const f of FALLE) {
    {
      const t = await bau(f, true);
      let beimFenster = null;
      t.script.unshift({ match: d => d.type === 'confirm' && d.title === PLAN, answer: () => { beimFenster = f.bezahlt(t); return { confirmed: true }; }, once: true });
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (1) The Master's Plan gespielt, Kosten lagen schon beim Fenster`, beimFenster === true && !t.pile(1, 'hand').includes(PLAN), { beimFenster, r, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
      R.check(`${f.name}: (1) negiert: Kosten bleiben bezahlt, keine Wirkung`, f.bezahlt(t) && !f.wirkung(t), { bezahlt: f.bezahlt(t), wirkung: f.wirkung(t) });
      R.check(`${f.name}: (1) negiert: Karte in der Ablage`, t.pile(0, 'discardPile').includes(f.name) || t.inst(c => c.name === f.name && c.zone === 'discard').length > 0, t.pile(0, 'discardPile'));
      R.check(`${f.name}: (1) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(f, false);
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (2) Kontrolle ohne Negation: Kosten und Wirkung`, f.bezahlt(t) && f.wirkung(t), { r, bezahlt: f.bezahlt(t), wirkung: f.wirkung(t) });
      R.check(`${f.name}: (2) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  {
    const f = FALLE[1];
    const t = await bau(f, true);
    t.targetFn = () => null;   // Mensch: Abbrechen-Knopf der Opferwahl
    const r = await t.play(0, f.name, { hero: 0 });
    R.check('Ladder to the Sky: (3) Abbruch der Opferwahl: Karte bleibt auf der Hand, Kreatur bleibt, Master\'s Plan nicht verbraucht', t.pile(0, 'hand').includes(f.name) && auf(t, D) === 1 && t.pile(1, 'hand').includes(PLAN), { r, hand: t.pile(0, 'hand'), kreatur: auf(t, D), plan: t.pile(1, 'hand') });
    R.check('Ladder to the Sky: (3) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
