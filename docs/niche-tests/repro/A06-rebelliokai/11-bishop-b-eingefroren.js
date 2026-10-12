'use strict';
// A06-rebelliokai-11 · Bishop of Kings [B], stummgeschaltet (Snowstorm Mischief/gefroren): die Negation der Gegner-Helden bleibt liegen
// Kartentext Bishop of Kings [B]: „While you control at least 1 "Knight of Kings" and "Board of Kings" is on the board, the effects of
//   all Heroes your opponent controls are negated. This counts as a negative status effect."
// Beobachtung: `syncBishopNegation` (bishop-of-kings-b.js) wird nur von den EIGENEN Hooks des Bishop ausgelöst (onCardEnterZone,
//   onTurnStart …). Ist der Bishop eingefroren/betäubt/negiert, filtert die Engine seine Hooks (`isCreatureEffectSuppressed`) –
//   der Abgleich, der die Negation beenden würde, läuft nie. Die Gegner-Helden bleiben negiert, solange der Bishop gefroren ist
//   (und auch nach den Zugwechseln, in denen er noch gefroren ist). Natürliche Quelle: Snowstorm Mischief friert ALLE Kreaturen ein (eigene und fremde); der Gegner kann wegen der
//   Negation seiner Helden selbst keinen Zauber mehr wirken.
// Erwartung: ein stummgeschalteter Bishop hat keine Wirkung → Heldeneffekte des Gegners sind nicht mehr negiert.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BB = 'Bishop of Kings [B]';
  const negOpp = (t) => [0, 1, 2].map(hi => !!t.hero(1, hi).statuses.negated);
  const t = await H.fresh({ hand: [[BB, 'Snowstorm Mischief'], []] });
  t.putArea(0, 'Board of Kings'); t.put(0, 0, 0, 'Knight of Kings [W]');
  await t.play(0, BB, { hero: 0, slot: 1 });
  R.check('Aufbau: Gegner-Helden durch den Bishop negiert', negOpp(t).every(x => x), negOpp(t));
  // Sitz 0 spielt Snowstorm Mischief (alle Kreaturen für 2 Züge gefroren, auch der eigene Bishop)
  const r = await t.play(0, 'Snowstorm Mischief', { hero: 0 });
  const bishop = t.find(BB, 'support');
  R.check('Snowstorm hat den Bishop eingefroren', r === true && !!bishop.counters.frozen, { r, frozen: bishop && bishop.counters.frozen });
  R.check('eingefrorener Bishop: Heldeneffekte des Gegners sind NICHT mehr negiert', negOpp(t).every(x => !x), negOpp(t));
  await t.endTurn(); await t.endTurn();
  R.check('auch nach einem vollen Zugumlauf (Bishop noch gefroren) sind die Gegner-Helden nicht mehr negiert', !bishop.counters.frozen || negOpp(t).every(x => !x), { frozen: !!bishop.counters.frozen, neg: negOpp(t) });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
