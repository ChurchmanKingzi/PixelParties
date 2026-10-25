'use strict';
// W75 · Darion (Audit P3a) — Ergaenzung zu g-02 (dort immer die MITTLERE Karte): Overheat, Tengu Windstorm, Coolness Overcharge, Sun Beam und Pressure Projectile treffen im Stapel Club / Blade / Crown
// genau die gewaehlte Karte, ob UNTERSTE, MITTLERE oder OBERSTE, auf der Gegnerseite und auf der eigenen Seite.
// Kartentexte: Overheat „Choose an Artifact that is equipped to a Hero and send it to the discard pile. That Hero takes 150 damage."; Tengu Windstorm „Choose any card on the board that is not a Hero and place it
//   on top or bottom of its controller's deck."; Coolness Overcharge „Choose any card on the board that isn't a Hero and send it to the discard pile."; Sun Beam „Choose up to 3 cards on the board that aren't
//   Heroes and send them to the discard pile."; Pressure Projectile „You may then choose any number of Spells attached/Artifacts equipped to the target and send them to the discard pile."
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-12-zerstoerer-treffen-unterste-mittlere-oberste.js   (Exit 0 = korrekt; ca. 1 Minute)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
const KARTEN = ['Overheat', 'Tengu Windstorm', 'Coolness Overcharge', 'Sun Beam', 'Pressure Projectile'];
async function lauf(karte, eigene, wahl) {
  const seite = eigene ? 0 : 1;
  const heroes = eigene ? [[D, T, null], [F, null, null]] : [[T, null, null], [D, null, null]];
  const t = await H.fresh({ active: 0, heroes, hand: [[karte, F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)], discard: [karte === 'Tengu Windstorm' ? ['Rebelliokai Terror Tengu'] : [], []] });
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
  if (karte === 'Coolness Overcharge') t.gs.players[0].coolnessStack = Array(6).fill(F);
  let n = 0;
  t.script.push({ match: d => d.type === 'instancePick', answer: () => (n++ === 0 ? { instId: insts[wahl].id } : { done: true }) });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Tengu Windstorm', answer: () => ({ optionId: 'top' }) });
  t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === seite && v.heroIdx === 0 && v.slotIdx === 1) || valid.find(v => v.type === 'hero' && v.owner === seite) || valid[0]).id];
  t.policy.confirm = true;
  await t.play(0, karte, { hero: eigene ? 1 : 0 });
  await t.drain();
  const bleibt = ps.supportZones[0][1].slice();
  const weg = NAMEN.filter(nm => !bleibt.includes(nm));   // nach den Namen im Platz (ein untrackter Tengu-Abgang laesst die Instanz mit alten Koordinaten zurueck)
  return { t, weg, bleibt };
}
(async () => {
  const R = H.runner();
  for (const karte of KARTEN) {
    for (const eigene of [false, true]) {
      for (let wahl = 0; wahl < 3; wahl++) {
        const wo = eigene ? 'eigener' : 'gegnerischer';
        const { t, weg, bleibt } = await lauf(karte, eigene, wahl);
        const rest = NAMEN.filter((_, i) => i !== wahl);
        R.check(`${karte}, ${wo} Stapel, gewaehlt ${['unterste', 'mittlere', 'oberste'][wahl]}: nur ${NAMEN[wahl]} weg`, weg.length === 1 && weg[0] === NAMEN[wahl] && JSON.stringify(bleibt) === JSON.stringify(rest) && t.errors.length === 0 && t.audit().length === 0, { weg, bleibt, fehler: t.errors.slice(0, 1), audit: t.audit().slice(0, 1) });
      }
    }
  }
  R.finish();
})();
