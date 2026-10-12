'use strict';
// A04-cute-19 · Modnir: Der +100-ATK-Bonus verschwindet, sobald IRGENDEINE Karte eine Support Zone verlässt
//
// Kartentext (Modnir): "… If this is the top card of your Coolness Stack, you may equip it to one of your Heroes from there. The equipped Hero's
//   Attack stat is increased by 100."
// Erwartung: Der Bonus gilt, solange Modnir ausgerüstet ist.
// Beobachtet: Modnir wird von der Stack-Spitze ausgerüstet (ATK 40 → 140). Stirbt danach irgendeine Kreatur (hier eine gegnerische),
//   steht der Held wieder auf ATK 40, Modnir liegt weiter am Helden (counters.atkGranted = 0). Mit zwei Modnir verlieren beide ihren Bonus,
//   sobald EIN Modnir geht.
// Ursache: cards/effects/modnir-hammer-of-coolness.js `onCardLeaveZone` (Z. 31-34): `if (ctx.fromZone !== 'support') return; ctx.revokeAtk();`
//   ohne Prüfung, ob die gehende Karte Modnir selbst ist (Lunatic Full/Gibbous Moon prüfen Held/Slot, die Second-Action-Karten `leavingCard.id`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [Array(6).fill(H.INERT.creature), []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const ps = t.gs.players[0]; for (const n of ['Modnir, Hammer of Coolness']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
  const atk0 = t.hero(0, 0).atk;
  t.gs.activePlayer = 0; t.phase(3);
  await t.run(() => t.engine.actionPlayTopOfCoolnessStack(0));
  R.check('Modnir ausgerüstet: ATK +100', t.hero(0, 0).atk === atk0 + 100, { atk0, atk: t.hero(0, 0).atk });
  const opfer = t.put(1, 0, 0, H.INERT.frail);
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0 }, opfer));
  R.check('nach dem Tod einer fremden Kreatur: Modnir liegt noch am Helden', !!t.find('Modnir, Hammer of Coolness', 'support'));
  R.check('… und der Bonus +100 gilt weiter', t.hero(0, 0).atk === atk0 + 100, { atk: t.hero(0, 0).atk });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
