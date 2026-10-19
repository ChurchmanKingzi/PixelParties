'use strict';
// W16b · A03-futuretech-03 (Erweiterung) · Future Tech Magic Modifier: die AUFGEDECKTE Kopie trägt die Stufensenkung und ist spielbar (Gegenprobe zu A03/03)
// Kartentext: „Reveal a Spell in your hand until the end of the turn. That Spell's level is reduced by the number of "Future Tech Magic Modifier" cards in your discard pile while it stays revealed."
// Auslegung (Al Q165/W15b „der Rabatt gilt genau die ausgewählte Kopie", Muster Divine Gift of Magic): nur die aufgedeckte Kopie (Handindex) ist Lv 1 und spielbar.
const H = require('../../lib/h.js');
const MM = 'Future Tech Magic Modifier';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[MM, 'Fireball', 'Fireball'], []], discard: [[MM], []], gold: 100 });
  t.setAbilities(0, 0, [['Destruction Magic'], [], []]);                  // Lv 1: reicht für Fireball (Lv 2) nur mit −1
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: 'Fireball', handIndex: 1 }), once: true });   // aufgedeckt wird die ERSTE Fireball
  await t.play(0, MM, { hero: 0 });
  const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true, handIndex: 0 });     // die aufgedeckte Kopie (nach dem Ausspielen des Modifiers rückt sie auf Platz 0)
  R.check('die aufgedeckte Kopie ist spielbar (Lv 2 − 1 = 1)', r === true && t.hp(1, 0) === 650, { r, hp: t.hp(1, 0), hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
