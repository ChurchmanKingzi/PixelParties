'use strict';
// A04-cute-15 (C) · Wildur (Lv1) von der Stack-Spitze: der Held braucht keine Summoning Magic
//
// Kartentext (Wildur): "When this Creature is the top card of your Coolness Stack, you may summon it as an additional Action from there
//   during your turn."  (Hipdall und Swagdri sind Lv0, Wildur ist Lv1 Summoning Magic.)
// Beobachtet: Ein Held ohne jede Fähigkeit beschwört Wildur von der Stack-Spitze; aus der Hand wird derselbe Versuch abgelehnt
//   (Gegenprobe). `summonFromStack` (hipdall-protector-of-coolness.js) prüft nur lebt / nicht gefroren / nicht betäubt / Negated nur Lv0 /
//   nicht mumifiziert / freie Zone – nicht `heroMeetsLevelReq` und nicht `canSummon`/`canPlayCard` des Helden (Cute Crown, Princess Mary).
// ENTSCHIEDEN (Al, Welle 9, Q25): „Sagt der Effekt 'summon', ist das Level nötig, bei 'place' nicht.“ → Wildur braucht Summoning Magic 1 auch vom Stack.
//   Das Repro prüft seitdem: Held ohne Schule kann Wildur weder vom Stack noch aus der Hand beschwören (Stack-Ergebnis: no_legal_target).
// Frage an Al (beantwortet): Soll die Stack-Beschwörung die Stufe des Helden (Summoning Magic 1 für Wildur) verlangen – ja oder nein?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ deck: [[H.INERT.creature, H.INERT.creature], []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const ps = t.gs.players[0]; for (const n of ['Cute Bunny', 'Wildur, the Shining Coolness']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  t.targetFn = (v) => [v.find(x => x.type === 'hero').id];
  t.gs.activePlayer = 0; t.phase(3);
  const r = await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
  R.note('Wildur von der Stack-Spitze, Held ohne Schule → Ergebnis', r);
  const vomStack = !!t.find('Wildur, the Shining Coolness', 'support');
  t = await H.fresh({ hand: [['Wildur, the Shining Coolness'], []], deck: [[H.INERT.creature], []] });
  await t.play(0, 'Wildur, the Shining Coolness', { hero: 0, noGrant: true });
  const ausHand = !!t.find('Wildur, the Shining Coolness', 'support');
  R.check('Ohne Summoning Magic 1 ist die Beschwörung vom Stack wie aus der Hand verboten', vomStack === false && ausHand === false, { vomStack, ausHand });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
