'use strict';
// W75 · Audit P5 · Darion × Legendary Explorer Dajan / Lolek, the Shard Knight / Lolek, Mender of the Shattered Trident — Equip per Heldeneffekt auf einen Helden mit Equip-Stapel.
// Kartentexte: Dajan „…search your deck for an Artifact and play it immediately…"; Shard Knight „…equip it to a Hero you control by paying half its Cost."; Mender „…equip it to any Hero you control without paying its Cost."
// Befund (vorher): wer als ZIEL-PLATZ den Stapel anklickte, bekam die Engine-Rueckfrage „welches Equip meinst du?" (instancePick) — obwohl ein Zielplatz gewaehlt wird, keine Karte; die Antwort blieb ohne Wirkung.
// Erwartet: Darion (Held 1) traegt Club / Blade / Crown in Platz 1. Klick auf den Stapel-Platz bzw. auf den Helden: KEINE Rueckfrage, das Equip (Glass Sword) landet als vierte Karte im selben Platz, kein zweiter Platz.
// Aufruf: node docs/niche-tests/repro/W75/h-P5-02-dajan-lolek-zielplatz-ohne-rueckfrage.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, hi, slot) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return NAMEN.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  const faelle = [
    ['Legendary Explorer Dajan', 'equip', 'dajan'], ['Legendary Explorer Dajan', 'hero', 'dajan'],
    ['Lolek, the Shard Knight', 'equip', 'lolek'], ['Lolek, Mender of the Shattered Trident', 'equip', 'lolek'],
  ];
  for (const [held, klick, art] of faelle) {
    R.section(`${held}: Klick auf ${klick === 'equip' ? 'den Stapel-Platz' : 'den Helden'}`);
    const t = await H.fresh({ active: 0, heroes: [[held, D, 'Tushu, the Knowledge Keeper'], [F, null, null]], hand: [[F], [F]], gold: 500,
      discard: [['Glass Sword'], []], deck: [['Glass Sword', ...Array(15).fill(F)], Array(15).fill(F)] });
    stapel(t, 0, 1, 1);
    let ziele = null;
    if (art === 'dajan') t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Glass Sword' }) });
    else {
      t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'equip' }) });
      t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: 'Glass Sword', source: d.cards.find(c => c.source === 'discard') ? 'discard' : 'deck' }) });
    }
    t.targetFn = (valid) => { ziele = valid.map(v => v.id); const v = valid.find(x => x.type === klick && x.owner === 0 && x.heroIdx === 1); return [(v || valid[0]).id]; };
    const r = await t.activateHero(0, 0, { phase: art === 'dajan' ? 3 : 2 });
    await t.drain();
    const zonen = t.gs.players[0].supportZones[1];
    const fragen = t.prompts.filter(p => p.d.type === 'instancePick');
    R.note('lauf', JSON.stringify({ r, ziele, zonen, fragen: fragen.length }));
    R.check('Effekt gewirkt', r === true, r);
    R.check('keine Rueckfrage „welches Equip?"', fragen.length === 0, fragen.map(f => f.d.title));
    R.check('Glass Sword liegt als vierte Karte im Stapel-Platz', JSON.stringify(zonen[1]) === JSON.stringify([...NAMEN, 'Glass Sword']), zonen);
    R.check('die anderen Plaetze des Helden bleiben leer', zonen[0].length === 0 && zonen[2].length === 0, zonen);
    R.check('Instanz-Zahl passt (4 im Platz)', t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 1 && c.zoneSlot === 1).length === 4);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
