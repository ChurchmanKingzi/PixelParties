'use strict';
// A03-futuretech-12 · Gunslinger Riffel: „no copies … equipped“ übersieht eine Copy Device, die gerade eine Gun IST
//
// Kartentext Riffel: „You may once per turn choose an equippable Artifact in your discard pile that this Hero has no copies of equipped to it yet.
//   Search your deck for a copy of that Artifact and equip it to this Hero without paying its Cost.“
// Kartentext Copy Device: „This Artifact's name, Cost and effect become that Artifact's original name, Cost and effect for the rest of the turn.“
// Erwartung: Ist an Riffel eine Copy Device als „Future Tech Gun“ ausgerüstet, hat der Held bereits eine Kopie der Gun → Gun wird nicht angeboten
//   (genau wie bei einer echten Gun, Kontrolle unten).
// Beobachtet: Gun wird angeboten und als zweite Gun ausgerüstet (Copy Device-als-Gun + echte Gun an einem Helden).
// Ursache: cards/effects/future-tech-gunslinger-riffel.js:59-64 (`schonAngelegt`) vergleicht Zonennamen (`slot.includes(name)`); eine Karte mit geliehener
//   Identität steht unter IHREM Namen in der Zone (CARD_API.md „A card must not look for ITSELF by name“). `hasEquipped` in _riffel-shared.js macht es richtig.
const H = require('../../lib/h.js');
const RIF = 'Future Tech Gunslinger Riffel', CD = 'Future Tech Copy Device', GUN = 'Future Tech Gun';
(async () => {
  const R = H.runner();
  for (const modus of ['echte Gun (Kontrolle)', 'Copy Device als Gun']) {
    const t = await H.fresh({ hand: [[modus.startsWith('echte') ? GUN : CD], []], discard: [[GUN, GUN], []], deck: [[GUN, H.INERT.creature, H.INERT.creature], []], gold: 100 });
    t.setHero(0, 0, RIF, 400);
    if (!modus.startsWith('echte')) t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: GUN }), once: true });
    await t.play(0, modus.startsWith('echte') ? GUN : CD, { hero: 0 });
    t.reset(); t.script.length = 0;
    let angeboten = [];
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { angeboten = d.cards.map(c => c.name); return { cardName: GUN }; }, once: true });
    await t.activateHero(0, 0, {});
    const gunAnzahl = [0, 1, 2].map(s => t.zone(0, 0, s)).filter(Boolean).length;
    R.check(`${modus}: Riffel bietet keine weitere Gun an`, !angeboten.includes(GUN) && gunAnzahl === 1, { angeboten, zonen: [0, 1, 2].map(s => t.zone(0, 0, s)) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
