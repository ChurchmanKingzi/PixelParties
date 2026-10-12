'use strict';
// A03-futuretech-04 · Tri Fecta: gestohlene Tokens zählen nicht als „in its Support Zones“ → Held wird fälschlich besiegt
//
// Kartentext Tri Fecta: „… When this Hero has no Tokens in its Support Zones, it is immediately defeated. These effects cannot be negated.“
//   Token-Text: „This does not count as a Creature, but can still be chosen like one. Cannot be moved to a different Support Zone.“
// Erwartung: Ein gestohlenes Token (Kontrollwechsel via actionStealCreature, es bleibt in der Zone des Helden stehen) steht weiter in den
//   Support Zones von Tri Fecta. Wird später das einzige nicht gestohlene Token zerstört, hat der Held noch 2 Tokens in seinen Zonen und lebt.
// Beobachtet: Tri Fecta wird sofort besiegt (HP 0), obwohl die zwei gestohlenen Tokens noch in seinen Zonen stehen.
// Ursache: cards/effects/_puppets-shared.js:218-224 (`puppetTokensInColumn` filtert auf `(c.controller ?? c.owner) === pi`),
//   genutzt von `checkPuppetHeroDefeat` (Z. 232-243). Zonenbelegung ist eine physische Frage, kein Kontrollbegriff.
const H = require('../../lib/h.js');
const PS = require('../../../../cards/effects/_puppets-shared.js');
const FECTA = 'Tri Fecta, the Puppet Master';
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  t.setHero(1, 0, FECTA, 400);
  for (let s = 0; s < 3; s++) await t.run(() => PS.placePuppetToken(t.engine, 1, 0, PS.FECTA_SET[s], s, { source: FECTA }));
  const sh = t.find('Destructive Puppet Shishi', 'support'), br = t.find('Creative Puppet Brammi', 'support'), vi = t.find('Preserving Puppet Vinny', 'support');
  R.check('Aufbau: drei Tokens, Held 400 HP', t.hp(1, 0) === 400 && [0, 1, 2].every(s => t.zone(1, 0, s)));
  const a = await t.run(() => t.engine.actionStealCreature(0, sh));
  const b = await t.run(() => t.engine.actionStealCreature(0, br));
  R.check('zwei Tokens gestohlen (Kontrolle bei Sitz 0, sie stehen weiter in der Spalte von Tri Fecta)', a === true && b === true && sh.controller === 0 && t.zone(1, 0, 0) && t.zone(1, 0, 1));
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 0 }, vi));         // das einzige nicht gestohlene Token
  R.check('Tri Fecta lebt noch: zwei (gestohlene) Tokens stehen in seinen Support Zones', t.hp(1, 0) > 0, { hp: t.hp(1, 0), spalte: [0, 1, 2].map(s => t.zone(1, 0, s)) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
