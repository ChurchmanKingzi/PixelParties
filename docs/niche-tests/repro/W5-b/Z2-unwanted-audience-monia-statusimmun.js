'use strict';
// W5b-Z2 (zu R02-05) · Unwanted Audience: statusimmune Kreaturen sind immun, Cool Rescuer Monia kann reagieren – Entscheidung Al (Welle 5):
//   „status-immune Creatures sind immun gegen Audience, Monia kann (glaube ich) darauf reagieren."
// Kartentexte: Unwanted Audience „… This counts as a negative status effect."; Monia „… when 1 or more Creatures either player controls would be affected by a card or effect,
//   you may discard 1 card to negate any effects that card or effect has on all Creatures."
// Erwartung: (a) Light Ball: Kreatur nicht negiert; (b) Monia (Sitz 0) wird gefragt, schützt (Ja): Kreatur nicht negiert, 1 Karte abgeworfen; Monia lehnt ab (Nein = null): negiert, nichts abgeworfen;
//   (c) ohne Monia/Light Ball: negiert (Kontrolle).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const MON = 'Cool Rescuer Monia';
  async function lauf({ monia, lightBall, antwort }) {
    const t = await H.fresh({ heroes: monia ? [[MON, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] : undefined, hand: [['ZZ Filler', 'ZZ Filler'], ['Unwanted Audience']], hp: 800 });
    if (monia) await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(1, 0, [['Support Magic'], [], []]);
    if (lightBall) t.put(0, 0, 2, 'Light Ball');
    const turm = t.put(0, 1, 0, 'Cannon Tower'); turm.turnPlayed = 1;
    const dummy2 = t.put(0, 2, 0, 'Cannon Tower'); dummy2.turnPlayed = 1;
    t.grantFor(1, 0, 'Unwanted Audience');
    t.gs.activePlayer = 1; t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'optionPicker' && /Cool Rescue/.test(d.title || ''), answer: antwort === 'ja' ? (d => ({ optionId: d.options[0].id })) : (() => null) });
    const hand0 = t.pile(0, 'hand').length;
    await t.endTurn();
    const moniaFrage = t.prompts.filter(p => p.d.type === 'optionPicker' && /Cool Rescue/.test(p.d.title || '')).length;
    return { t, turm, dummy2, moniaFrage, abgeworfen: hand0 + 1 - t.pile(0, 'hand').length };   // +1: Zugkarte
  }
  let x = await lauf({});
  R.check('Kontrolle ohne Monia/Light Ball: beide Kreaturen negiert', !!x.turm.counters.negated && !!x.dummy2.counters.negated);
  x = await lauf({ lightBall: true });
  R.check('Light Ball (statusimmun): nicht negiert', !x.turm.counters.negated && !x.dummy2.counters.negated, [x.turm.counters.negated, x.dummy2.counters.negated]);
  x = await lauf({ monia: true, antwort: 'ja' });
  R.check('Monia wird gefragt (genau einmal) und schützt alle Kreaturen', x.moniaFrage === 1 && !x.turm.counters.negated && !x.dummy2.counters.negated, { fragen: x.moniaFrage, n: [x.turm.counters.negated, x.dummy2.counters.negated] });
  R.check('Monia: 1 Handkarte abgeworfen', x.abgeworfen === 1, x.abgeworfen);
  x = await lauf({ monia: true, antwort: 'nein' });
  R.check('Monia lehnt ab: Kreaturen negiert, nichts abgeworfen', !!x.turm.counters.negated && x.abgeworfen === 0, { n: x.turm.counters.negated, abgeworfen: x.abgeworfen });
  R.check('keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  R.finish();
})();
