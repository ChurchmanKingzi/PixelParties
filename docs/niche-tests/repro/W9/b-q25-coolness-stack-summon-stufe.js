'use strict';
// W9b · Q25 (A04-cute-15) · Beschwörung vom Coolness Stack: „summon“ verlangt die Stufe, „place“ nicht
//
// Kartentext Wildur (Lv1, Summoning Magic): „When this Creature is the top card of your Coolness Stack, you may summon it as an additional Action from there during your turn.“
// ENTSCHIEDEN (Al, Welle 9, Q25): „Sagt der Effekt 'summon', ist das Level nötig, bei 'place' nicht.“ → Hipdall/Swagdri/Wildur (alle „summon“) brauchen die Stufe des Helden; Glorious Rebirth
//   („Place that Creature“) nicht.
// Geprüft: (a) Wildur vom Stack, Held ohne Schule: abgelehnt (no_legal_target), Wildur bleibt oben auf dem Stack; (b) Held mit Summoning Magic 1: beschworen; (c) Held 0 ohne Schule, Held 1 mit
//   Summoning Magic 1: nur Held 1 wird angeboten; (d) Hipdall (Lv0) vom Stack ohne Schule: beschworen; (e) Glorious Rebirth platziert Wildur ohne Schule.
const H = require('../../lib/h.js');
const WILDUR = 'Wildur, the Shining Coolness', HIP = 'Hipdall, Protector of Coolness', GR = 'Glorious Rebirth';
async function szene(opts, top) {
  const t = await H.fresh(opts);
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const ps = t.gs.players[0];
  for (const n of ['Cute Bunny', top]) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  t.gs.activePlayer = 0; t.phase(3);
  return t;
}
(async () => {
  const R = H.runner();
  let t = await szene({ deck: [[H.INERT.creature, H.INERT.creature], []] }, WILDUR);
  t.targetFn = (v) => [v.find(x => x.type === 'hero').id];
  let r = await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
  R.check('(a) Wildur vom Stack ohne Summoning Magic: abgelehnt', r?.aborted === true && !t.find(WILDUR, 'support') && t.gs.players[0].coolnessStack.slice(-1)[0] === WILDUR, r);
  R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);

  t = await szene({ deck: [[H.INERT.creature, H.INERT.creature], []] }, WILDUR);
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  t.targetFn = (v) => [v.find(x => x.type === 'hero').id];
  r = await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
  R.check('(b) Wildur vom Stack mit Summoning Magic 1: beschworen', !!t.find(WILDUR, 'support') && r?.played === true, r);
  R.check('(b) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

  t = await szene({ deck: [[H.INERT.creature, H.INERT.creature], []] }, WILDUR);
  t.setAbilities(0, 1, [['Summoning Magic'], [], []]);
  let heroes = null;
  t.targetFn = (v) => { heroes = v.filter(x => x.type === 'hero').map(x => x.heroIdx); return [v.find(x => x.type === 'hero').id]; };
  await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
  R.check('(c) nur der Held mit Summoning Magic wird angeboten (Held 1)', JSON.stringify(heroes) === '[1]' && t.find(WILDUR, 'support')?.heroIdx === 1, { heroes });

  t = await szene({ deck: [[H.INERT.creature, H.INERT.creature], []] }, HIP);
  t.targetFn = (v) => [v.find(x => x.type === 'hero').id];
  r = await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
  R.check('(d) Hipdall (Lv0) vom Stack ohne Schule: beschworen', !!t.find(HIP, 'support') && r?.played === true, r);

  t = await szene({ hand: [[GR], []], deck: [[H.INERT.creature, H.INERT.creature], []] }, WILDUR);
  await t.play(0, GR, { hero: 0, noGrant: true });
  R.check('(e) Glorious Rebirth platziert Wildur ohne Summoning Magic („place“)', !!t.find(WILDUR, 'support'), t.pile(0, 'discardPile'));
  R.check('(e) keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
