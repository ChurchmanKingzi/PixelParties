'use strict';
// A01-pollution-17 · „Place N Pollution Tokens … to use this Spell“: bei Negation nur bei Cold Coffin/Eraser Beam bezahlt
// Kartentexte (wortgleich): Cold Coffin/Eraser Beam/Medusa's Curse/Null Zone/Reincarnation: „Place 2 (3) Pollution Tokens into your free Support Zones to use this Spell.“,
//   Goldify/Golden Wings: „Place 1 Pollution Token … to use this Spell.“, Mass Multiplication: „… to play this card.“
// Regel (CARD_API.md, Tabelle der Karten-Hooks, Zeile `payActivationCost`): „Use for costs that must be paid at activation and are NOT refunded by negation (e.g. Cold Coffin's
//   Pollution placement) … If the spell is later negated … the cost stays paid.“
// Erwartung: wird der Zauber in der Kette negiert (Silence), bleiben die Kosten-Tokens liegen – bei ALLEN diesen Karten.
// Beobachtet: Cold Coffin (2) und Eraser Beam (3) behalten ihre Tokens; Medusa's Curse, Null Zone, Goldify und Reincarnation setzen die Tokens erst in `onPlay` – nach einer
//   Negation in der Kette liegen 0 Tokens (die Kosten sind „gratis“). (Mass Multiplication und Golden Wings zahlen laut Skript ebenfalls erst in `onPlay`, hier nicht ausgeführt.)
// Ursache: nur cold-coffin.js und eraser-beam.js implementieren `payActivationCost`; die übrigen Karten zahlen im `onPlay`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/17-token-kosten-bei-negation-uneinheitlich.js   (✗ = Kosten nicht bezahlt)
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
(async () => {
  const R = H.runner();
  for (const [spell, kosten] of [['Cold Coffin', 2], ['Eraser Beam', 3], ["Medusa's Curse", 2], ['Null Zone', 2], ['Goldify', 1], ['Reincarnation', 2]]) {
    const t = await H.fresh({ hand: [[spell], ['Silence']], discard: [['Soul Shard Ba'], []] });
    t.grantFor(1, 0, 'Silence');
    t.put(1, 0, 0, 'Soul Shard Ba');
    t.gs.players[0].heroes[2].hp = 0;                 // gefallener Held (Reincarnation spielbar)
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    t.policy.confirm = true;                          // Silence wird gespielt
    await t.play(0, spell, { hero: 0 });
    R.check(`${spell}: negiert (Silence gespielt), Kosten von ${kosten} Token(s) bleiben bezahlt`, t.pile(1, 'hand').length === 0 && tokens(t, 0) === kosten, { silenceGespielt: t.pile(1, 'hand').length === 0, tokens: tokens(t, 0) });
  }
  R.finish();
})();
