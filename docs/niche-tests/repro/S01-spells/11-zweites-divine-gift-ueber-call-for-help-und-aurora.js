'use strict';
// S01-11 · Call for Help und Aurora Borealis führen ein zweites „Divine Gift" aus (Einmal-pro-Spiel-Grenze umgangen)
// Kartentext Divine Gift of …: „You can only activate 1 "Divine Gift" card per game."
// Call for Help: „Choose a level 2 or lower Spell from your deck or hand and play it immediately as an additional Action, regardless of its level."
// Aurora Borealis (Magic Arts 3): „… delete 2 of your chosen Spells to immediately perform the third one as an additional Action."
// Ruling CARD_API.md ~Z. 4553-4575: `_castSpellImmediately` prüft KEINE Anforderung – „Sperren … prüft der Aufrufer selbst". Der normale Immediate-Pick (`_resolveImmediateActionPick`,
//   _engine.js ~Z. 19735) filtert `oncePerGame`; Call for Help (`call-for-help.js`, `eligible`) und Aurora Borealis (`wirkbar`) filtern es nicht.
// Aufbau: Sitz 0 hat „divineGift" schon gestempelt (Divine Gift of Skill normal gespielt); danach (a) Call for Help bzw. (b) Aurora Borealis → Divine Gift of Fire.
// Erwartet: Divine Gift of Fire wird nicht angeboten bzw. nicht gewirkt (kein Brand beim Gegner).
// Beobachtet: Es wird angeboten und gewirkt – alle Gegner-Helden brennen.
const H = require('../../lib/h.js');
async function lauf(wie) {
  const hand = wie === 'cfh' ? ['Divine Gift of Skill', 'Call for Help'] : ['Divine Gift of Skill', 'Aurora Borealis'];
  const deck = wie === 'cfh' ? ['Divine Gift of Fire'] : ['Divine Gift of Fire', 'Fireball', 'Burning Finger', 'Boiling Oil'];
  const t = await H.fresh({ hand: [hand, []], deck: [deck, []],
    abilities: { 0: { 0: [['Magic Arts', 'Magic Arts', 'Magic Arts'], ['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], []] } } });
  if (wie === 'cfh') { t.put(0, 0, 0, H.INERT.frail); await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, t.find(H.INERT.frail, 'support'))); }
  await t.play(0, 'Divine Gift of Skill', { hero: 0, noGrant: true });                    // stempelt „divineGift"
  let angeboten = null;
  t.script.push({ match: d => d.type === 'playerPicker', answer: () => ({ playerIdx: 1 }) });
  if (wie === 'cfh') {
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Call for Help', answer: (d) => { angeboten = d.cards.map(c => c.name); return { cardName: 'Divine Gift of Fire', source: 'deck' }; } });
  } else {
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Divine Gift of Fire', 'Fireball', 'Burning Finger'] }) });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Aurora Borealis', answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Aurora Borealis', answer: (d) => { angeboten = d.cards.map(c => c.name); return { cardName: 'Divine Gift of Fire' }; } });
  }
  await t.play(0, wie === 'cfh' ? 'Call for Help' : 'Aurora Borealis', { hero: 0, noGrant: true, keepActions: true });
  const brennt = t.gs.players[1].heroes.some(h => h.statuses.burned);
  return { t, angeboten, brennt };
}
(async () => {
  const R = H.runner();
  const a = await lauf('cfh');
  R.check('(a) Call for Help: ein zweites Divine Gift wird nicht gewirkt', !a.brennt, { angeboten: a.angeboten });
  const b = await lauf('aurora');
  R.check('(b) Aurora Borealis: ein zweites Divine Gift wird nicht gewirkt', !b.brennt, { angeboten: b.angeboten });
  R.check('keine Engine-Fehler', a.t.errors.length === 0 && b.t.errors.length === 0, [...a.t.errors, ...b.t.errors]);
  R.finish();
})();
