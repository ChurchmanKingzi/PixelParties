'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-10 · Monia Bot: der „True Damage"-Stempel bleibt nach einer Umleitung OHNE Schaden liegen und trifft den nächsten, unbeteiligten Treffer
//
//  Karte: Monia Bot, the Foretold Rescuer of Coolness (`cards/effects/monia-bot-the-foretold-rescuer-of-coolness.js`, `onHeroRedirect` → `gs._redirectedTrueDamage`;
//         Verbraucher `_engine.js` in `actionDealDamage` ~Z. 8431)
//  Kartentext: „Whenever another target you control would be affected by an opponent's card or effect, you may redirect that card or effect onto this Hero.
//  Damage this Hero receives from effects redirected this way cannot be reduced or negated."
//  Erwartung: Nur Schaden, der aus dem UMGELEITETEN Effekt stammt, ist unverringerbar. Wird ein Effekt ohne Schaden umgeleitet (hier: „The Warlord's Bite" = Gift),
//  verfällt der Stempel mit dem Effekt; ein späterer, nicht umgeleiteter Fireball auf Monia ist normaler Schaden.
//  Beobachtung (✗): Der Stempel (`{ owner, heroIdx, turn }`) lebt bis zum NÄCHSTEN Treffer auf Monia im selben Zug (oder Zugbeginn) – der spätere Fireball wird zu
//  True Damage (Log `true_damage`; ignoriert nach Engine-Kommentar auch immortal / capAtHPMinus1 / lethalProtection).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/10-monia-bot-true-damage-stempel-bleibt.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const MONIA = 'Monia Bot, the Foretold Rescuer of Coolness';
const FILL = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[MONIA, ...FILL], null], hp: 800, active: 1, hand: [[], ["The Warlord's Bite", 'Fireball']] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.script.push({ match: d => d.type === 'confirm' && /Monia/.test(d.title || ''), answer: () => ({ confirmed: true }) });

  R.section('1) Gegner wirkt „The Warlord\'s Bite" (Gift, kein Schaden) auf Held 1 – Monia leitet um');
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 1).id];
  const r1 = await t.play(1, "The Warlord's Bite", { hero: 0 });
  R.check('Umleitung hat stattgefunden (Monia vergiftet, Tushu nicht)', r1 === true && !!t.hero(0, 0).statuses.poisoned && !t.hero(0, 1).statuses.poisoned, [r1, Object.keys(t.hero(0, 0).statuses), Object.keys(t.hero(0, 1).statuses)]);
  R.check('Der Stempel „True Damage" ist nach dem schadenlosen Effekt weg', !t.gs._redirectedTrueDamage, t.gs._redirectedTrueDamage);

  R.section('2) Im selben Zug: normaler Fireball direkt auf Monia (nicht umgeleitet)');
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
  t.reset();
  const r2 = await t.play(1, 'Fireball', { hero: 0 });
  R.note('Fireball', { r2, hp: t.hp(0, 0) });
  R.check('Der spätere Fireball ist KEIN True Damage', t.lg('true_damage').length === 0, t.lg('true_damage'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
