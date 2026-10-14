'use strict';
// W4-H1 · Rebelliokai-Karten mit Ablage-Kosten „Delete 1 … from your discard pile to play this card" (Kirin Firebreath, Tanuki Escape, Tengu Windstorm, Kappa Sword Slash):
//   die Kosten werden VOR dem Reaktionsfenster bezahlt und bleiben bei Ganz-Negierung (The Master's Plan) bezahlt; die Wirkung entfällt. Das ersetzt die frühere Hausregel
//   „Kosten nach der ersten Zielwahl" (Al, Welle 4); die Zielwahl selbst läuft unverändert (Reihenfolge der Ziele gleich), ist nach der Kostenzahlung aber nicht mehr abbrechbar.
// Erwartung je Karte: (1) negiert: Kostenkarte schon BEIM Fenster gelöscht, bleibt gelöscht, keine Wirkung; (2) Kontrolle ohne Negation: Kosten + Wirkung;
//   (3) Kosten nicht zahlbar (Kostenkarte fehlt): Karte nicht spielbar, nichts passiert.
// Aufruf: node docs/niche-tests/repro/W4-kosten/H1-rebelliokai-kosten-bleiben-bezahlt.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const PLAN = "The Master's Plan";
const D = H.INERT.creature;
const geloescht = (t, name) => t.pile(0, 'deletedPile').includes(name);
const REB = ['Rebelliokai Timid Tanuki', 'Rebelliokai Kind Kitsune', 'Rebelliokai Backup Bakus'];
const FALLE = [
  { name: 'Kirin Firebreath', kosten: 'Rebelliokai Courtly Kirin', ablage: ['Rebelliokai Courtly Kirin', ...REB.slice(0, 2)],
    wirkung: (t) => t.hp(1, 0) < 800 },
  { name: 'Tanuki Escape', kosten: 'Rebelliokai Timid Tanuki', ablage: ['Rebelliokai Timid Tanuki', 'Rebelliokai Kind Kitsune'], hand: ['Tanuki Escape', 'Fireball'],
    wirkung: (t) => t.prompts.some(p => p.d.type === 'handPick') },
  { name: 'Tengu Windstorm', kosten: 'Rebelliokai Terror Tengu', ablage: ['Rebelliokai Terror Tengu'], bau: (t) => { t.put(1, 0, 0, D); },
    wirkung: (t) => t.inst(c => c.zone === 'support' && c.owner === 1 && c.name === D).length === 0 },
  { name: 'Kappa Sword Slash', kosten: 'Rebelliokai Camouflaged Kappa', ablage: ['Rebelliokai Camouflaged Kappa', ...REB],
    wirkung: (t) => t.hp(1, 0) < 800 },
];
async function bau(f, negieren, mitKosten = true) {
  const t = await H.fresh({ hand: [f.hand || [f.name], negieren ? [PLAN] : []], discard: [mitKosten ? f.ablage : f.ablage.filter(n => n !== f.kosten), []] });
  if (negieren) t.grantFor(1, 0, PLAN);
  if (f.bau) f.bau(t);
  t.policy.confirm = true;
  t.targetFn = (v) => {
    const e = v.filter(x => !x.ineligible);
    const h = e.find(x => x.owner === 1 && (x.type === 'hero' ? x.heroIdx === 0 : true)) || e[0];
    return h ? [h.id] : [];
  };
  t.script.push({ match: d => d.type === 'optionPicker' && /Windstorm/.test(JSON.stringify(d)), answer: () => ({ optionId: 'top' }) });
  t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.slice(0, 1).map(i => ({ handIndex: i, cardName: t.gs.players[0].hand[i] })) }) });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: [] }) });
  return t;
}
(async () => {
  const R = H.runner();
  for (const f of FALLE) {
    {
      const t = await bau(f, true);
      let beimFenster = null;
      t.script.unshift({ match: d => d.type === 'confirm' && d.title === PLAN, answer: () => { beimFenster = geloescht(t, f.kosten); return { confirmed: true }; }, once: true });
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (1) The Master's Plan gespielt, Kostenkarte lag schon beim Fenster im Gelöscht-Stapel`, beimFenster === true && !t.pile(1, 'hand').includes(PLAN), { beimFenster, r, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
      R.check(`${f.name}: (1) negiert: Kosten bleiben bezahlt, keine Wirkung`, geloescht(t, f.kosten) && !f.wirkung(t), { bezahlt: geloescht(t, f.kosten), wirkung: f.wirkung(t) });
      R.check(`${f.name}: (1) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(f, false);
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (2) Kontrolle ohne Negation: Kosten gezahlt und Wirkung`, geloescht(t, f.kosten) && f.wirkung(t), { r, bezahlt: geloescht(t, f.kosten), wirkung: f.wirkung(t) });
      R.check(`${f.name}: (2) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(f, false, false);
      const r = await t.play(0, f.name, { hero: 0 });
      R.check(`${f.name}: (3) ohne Kostenkarte nicht spielbar: Karte bleibt auf der Hand, keine Wirkung`, r === false && t.pile(0, 'hand').includes(f.name) && !f.wirkung(t), { r, hand: t.pile(0, 'hand') });
    }
  }
  R.finish();
})();
