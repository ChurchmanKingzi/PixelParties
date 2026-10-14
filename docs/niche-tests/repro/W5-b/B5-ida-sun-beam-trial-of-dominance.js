'use strict';
// W5b-B5 (zu H02-05) · Ida, the Adept of Destruction deckelt auch Sun Beam und Trial of Dominance – Entscheidung Al (Welle 5): „Ja"
// Kartentext Ida: „This Hero can never hit more than 1 target with a Destruction Spell."
// Sun Beam (Destruction Magic): „Choose up to 3 cards on the board that aren't Heroes and send them to the discard pile. Place the same number of Pollution Tokens into your free Support Zones."
// Trial of Dominance (Destruction Magic): „… Defeat all Creatures your opponent controls and delete them. …"
// Erwartung unter Ida: Sun Beam trifft höchstens 1 Karte (und setzt 1 Pollution Token); Trial of Dominance besiegt/löscht genau 1 gewählte gegnerische Kreatur.
//   Gegenprobe ohne Ida: Sun Beam 3 Karten + 3 Token, Trial alle.
const H = require('../../lib/h.js');
const IDA = 'Ida, the Adept of Destruction';
(async () => {
  const R = H.runner();
  for (const mitIda of [true, false]) {
    const tag = mitIda ? 'Ida' : 'ohne Ida';
    {   // Sun Beam
      const t = await H.fresh({ heroes: mitIda ? [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] : undefined, hand: [['Sun Beam'], []] });
      if (mitIda) await t.run(() => t.engine.runHooks('onGameStart', {}));
      for (let s = 0; s < 3; s++) t.put(1, 0, s, H.INERT.big);
      t.targetFn = (valid, cfg) => { const n = (cfg && cfg.maxTotal) || valid.length; return valid.filter(v => v.owner === 1 && v.type === 'equip').slice(0, Math.max(n, 3)).map(v => v.id); };
      await t.play(0, 'Sun Beam', { hero: 0 });
      const weg = 3 - t.inst(c => c.name === H.INERT.big && c.zone === 'support' && c.owner === 1).length;
      const token = t.inst(c => c.name === 'Pollution Token' && c.zone === 'support' && (c.controller ?? c.owner) === 0).length;
      R.check(`Sun Beam (${tag}): ${mitIda ? 'höchstens 1' : '3'} Karte(n) abgelegt`, mitIda ? weg === 1 : weg === 3, weg);
      R.check(`Sun Beam (${tag}): ${mitIda ? '1' : '3'} Pollution Token(s) gesetzt`, mitIda ? token === 1 : token === 3, token);
      R.check(`Sun Beam (${tag}): keine Engine-Fehler, Audit leer`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {   // Trial of Dominance
      const t = await H.fresh({ heroes: mitIda ? [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] : undefined, hand: [['Trial of Dominance'], []] });
      if (mitIda) await t.run(() => t.engine.runHooks('onGameStart', {}));
      for (let s = 0; s < 3; s++) t.put(1, 0, s, H.INERT.big);
      t.targetFn = (valid) => valid.filter(v => v.owner === 1 && v.type === 'equip').slice(1, 2).map(v => v.id);
      const r = await t.play(0, 'Trial of Dominance', { hero: 0 });
      const rest = t.inst(c => c.name === H.INERT.big && c.zone === 'support' && c.owner === 1).length;
      R.check(`Trial of Dominance (${tag}): ${mitIda ? 'genau 1 Kreatur besiegt' : 'alle 3 besiegt'} (gespielt=${r})`, r === true && (mitIda ? rest === 2 : rest === 0), rest);
      if (mitIda) R.check('Trial of Dominance (Ida): die GEWÄHLTE (mittlere) Kreatur ist gefallen', !t.zone(1, 0, 1) || (t.zone(1, 0, 1) || []).length === 0, [0, 1, 2].map(s => t.zone(1, 0, s)));
      R.check(`Trial of Dominance (${tag}): gelöscht, nicht in der Ablage; keine Engine-Fehler, Audit leer`, t.pile(1, 'deletedPile').length >= 0 && t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
