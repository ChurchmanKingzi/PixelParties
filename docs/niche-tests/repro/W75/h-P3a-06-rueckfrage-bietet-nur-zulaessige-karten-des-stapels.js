'use strict';
// W75 · Darion (Audit P3a) — die Stapel-Rueckfrage („welches Equip?") bietet nur Karten an, die der Zauber auch treffen DARF.
// Karten: Overheat „Choose an Artifact that is equipped to a Hero and send it to the discard pile.", Tengu Windstorm „Choose any card on the board that is not a Hero and place it on top or bottom of its controller's deck.",
//   Sun Beam „Choose up to 3 cards on the board that aren't Heroes and send them to the discard pile.", Treasure Theft „Choose an Artifact equipped to a Hero your opponent controls and equip it to the user.",
//   Pressure Projectile „You may then choose any number of Spells attached/Artifacts equipped to the target and send them to the discard pile."
// Erwartet: Darion (Gegner) traegt Club / Blade / Crown, die MITTLERE Karte (Blade) ist `immovable` (Divine-Gift-Schutz). Die Rueckfrage nennt nur Club und Crown; die Wahl der obersten (Crown) trifft sie,
//   Blade bleibt liegen. Vorher bot die Engine alle drei an (die Skripte filtern je Karte, die Rueckfrage kannte den Filter nicht) und eine Wahl von Blade verpuffte.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-06-rueckfrage-bietet-nur-zulaessige-karten-des-stapels.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
async function szene(karte, extra = {}) {
  const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [[karte, F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)], discard: [extra.ablage || [], []] });
  const ps = t.gs.players[1];
  ps.supportZones[0][1] = [];
  const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 1, 'support', 0, 1); i.turnPlayed = 1; return i; });
  insts[1].counters.immovable = true;
  const gefragt = [];
  t.script.push({ match: d => d.type === 'instancePick', answer: (d) => {
    gefragt.push(d.instances.map(i => i.name));
    const crown = d.instances.find(i => i.name === NAMEN[2]);
    return crown ? { instId: crown.instId } : { done: true };
  } });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Tengu Windstorm', answer: () => ({ optionId: 'top' }) });
  t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1) || valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
  t.policy.confirm = true;
  if (extra.vorher) extra.vorher(t);
  await t.play(0, karte, { hero: 0 });
  await t.drain();
  return { t, ps, gefragt };
}
const SAUBER = (R, t) => R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
(async () => {
  const R = H.runner();
  const faelle = [
    ['Overheat', {}, (t, ps) => t.pile(1, 'discardPile').includes(NAMEN[2])],
    ['Tengu Windstorm', { ablage: ['Rebelliokai Terror Tengu'] }, (t, ps) => !ps.supportZones[0][1].includes(NAMEN[2])],
    ['Sun Beam', {}, (t, ps) => t.pile(1, 'discardPile').includes(NAMEN[2])],
    ['Treasure Theft', {}, (t, ps) => t.gs.players[0].supportZones.flat(2).includes(NAMEN[2])],
    ['Pressure Projectile', {}, (t, ps) => t.pile(1, 'discardPile').includes(NAMEN[2])],
  ];
  for (const [karte, extra, trifft] of faelle) {
    R.section(karte);
    const { t, ps, gefragt } = await szene(karte, extra);
    R.note('lauf', JSON.stringify({ gefragt, zone: ps.supportZones[0][1], ablage1: t.pile(1, 'discardPile'), tushu: t.gs.players[0].supportZones.map(z => z.flat()) }));
    R.check('Rueckfrage kam und nannte nur Club und Crown', gefragt.length >= 1 && gefragt[0].length === 2 && !gefragt[0].includes(NAMEN[1]), gefragt);
    R.check('die gewaehlte Crown wurde getroffen', trifft(t, ps), [ps.supportZones[0][1], t.pile(1, 'discardPile')]);
    R.check('Blade (immovable) liegt unveraendert im Stapel', ps.supportZones[0][1].includes(NAMEN[1]), ps.supportZones[0][1]);
    SAUBER(R, t);
  }
  R.finish();
})();
