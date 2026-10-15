'use strict';
// W13a · A1 (Sandy Blob bei Kreatur-Surprises) · Al, 15.10.2026: „Richtig, *außer* eine Surprise Creature sagt ausdrücklich sowas wie
//   'Activate..... **When this Creature is summoned/placed, do X.....**'"
// Erwartet: Kreatur-Surprises (Pure Advantage Camel, Cybugs, Water Golem …) lösen Sandy Blob NICHT aus, AUSSER ihr Kartentext enthält
//   ausdrücklich einen On-Summon-/On-Place-Satz („When this Creature is summoned/placed, …"). `hatOnSummonText` (`_summon-eligibility.js`) kennt
//   jetzt auch die Form „placed/place" und wird gegen alle Kreatur-Surprises in `data/cards.json` geprüft (keine hat einen solchen Satz).
const H = require('../../lib/h.js');
const { hatOnSummonText } = require('../../../../cards/effects/_summon-eligibility');
const cards = require('../../../../data/cards.json');
(async () => {
  const R = H.runner();

  R.section('(1) Kartentext: alle Kreatur-Surprises der Datenbank');
  const surpriseKreaturen = cards.filter(c => /Creature/.test(JSON.stringify(c.cardType)) && /Surprise/.test(JSON.stringify([c.cardType, c.subtype])));
  R.check('es gibt Kreatur-Surprises (Aufbau)', surpriseKreaturen.length >= 15, surpriseKreaturen.length);
  for (const c of surpriseKreaturen) {
    R.check(`${c.name}: kein ausdrücklicher On-Summon-/On-Place-Satz → Blob löst nicht aus`, hatOnSummonText(c) === false, c.effect);
  }

  R.section('(2) Wortlaut-Formen: ausdrücklicher Satz zählt (summoned / placed / „when you place")');
  const cd = (effect) => ({ name: 'X', cardType: 'Creature', effect });
  R.check('„When this Creature is summoned, …" zählt', hatOnSummonText(cd('Activate this Surprise when your opponent draws. Draw a card. When this Creature is summoned, deal 50 damage to a target.')) === true);
  R.check('„When this Creature is placed, …" zählt', hatOnSummonText(cd('Activate this Surprise when your opponent draws. When this Creature is placed, deal 50 damage to a target.')) === true);
  R.check('„When you place this Creature, …" zählt', hatOnSummonText(cd('Activate this Surprise when your opponent draws. When you place this Creature, draw a card.')) === true);
  R.check('„When you summon this Creature, …" zählt (unverändert)', hatOnSummonText(cd('When you summon this Creature, draw a card.')) === true);
  R.check('„… then place this Creature into one of the user\'s free Support Zones" zählt NICHT (technisches Platzieren)', hatOnSummonText(cd('Activate this Surprise when your opponent draws. Draw a card and place this Creature into one of the user\'s free Support Zones.')) === false);
  R.check('„When this Creature is defeated, …" zählt NICHT', hatOnSummonText(cd('Activate this Surprise when X. Place this Creature into a free Support Zone. When this Creature is defeated, draw a card.')) === false);

  R.section('(3) echter Spielweg: Water Golem (Kreatur-Surprise mit eigener Zielwahl) und Pure Advantage Camel öffnen kein Blob-Fenster');
  const blob = (t) => t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
  {
    const t = await H.fresh({});
    t.grantFor(0, 0, 'Water Golem');
    t.putSurprise(0, 0, 'Water Golem');
    const gw = t.putSurprise(0, 1, 'Glass Wall');
    t.put(0, 2, 2, 'Sandy Blob').turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    await t.run(() => t.engine.actionMoveCard(gw, 'discard', -1, -1, { source: 'Test', sourceOwner: 1 }));
    R.check('Water Golem ist aktiviert (liegt auf dem Brett)', !!t.find('Water Golem', 'support'));
    R.check('Water Golem: kein Sandy-Blob-Fenster', blob(t) === 0, blob(t));
    R.check('Water Golem: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await H.fresh({ deck: [Array(10).fill(H.INERT.filler), Array(10).fill(H.INERT.filler)], hand: [[], ['Heal']] });
    t.grantFor(0, 0, 'Pure Advantage Camel');
    t.putSurprise(0, 0, 'Pure Advantage Camel');
    t.put(0, 2, 2, 'Sandy Blob').turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid[0].id];
    t.policy.confirm = true;
    // Gegner zieht außerhalb seiner Resource Phase (Camel-Auslöser)
    t.gs.activePlayer = 1; t.phase(3);
    await t.run(() => t.engine.actionDrawCards(1, 1));
    await t.run(() => t.engine._flushSurpriseDrawChecks());
    R.check('Pure Advantage Camel ist aktiviert (liegt auf dem Brett)', !!t.find('Pure Advantage Camel', 'support'));
    R.check('Pure Advantage Camel: kein Sandy-Blob-Fenster', blob(t) === 0, blob(t));
    R.check('Camel: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
