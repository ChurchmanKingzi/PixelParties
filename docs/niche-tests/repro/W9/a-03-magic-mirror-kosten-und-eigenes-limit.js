'use strict';
// W9a · Q3 (A01-pollution-16) · Al, 15.10.2026: „3a: Ja. B: sollte das eigene Limit verbrauchen und bei schon verbrauchtem Limit nicht nutzbar sein!“
// Erwartet:
//  (a) Die Magic-Mirror-Kopie zahlt die „… to use this Spell“-Kosten des gespiegelten Zaubers (Cold Coffin +2, Eraser Beam +3 Tokens zusätzlich zum Mirror-Preis).
//      Reicht der Platz für diese Kosten nicht mehr, gibt es keine Kopie (das Original bleibt negiert).
//  (b) Die Kopie eines „once per game“-Zaubers (Eraser Beam) verbraucht das EIGENE Limit des Spiegel-Besitzers (Sitz 1), nicht das des Wirkers (Sitz 0).
//      Ist das eigene Limit schon verbraucht, wird der Spiegel gar nicht angeboten (der Zauber wird nicht gespiegelt, trifft den Helden).
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
async function lauf(spell, opts = {}) {
  const t = await H.fresh({ hand: [[spell], []] });
  t.putSurprise(1, 0, 'Magic Mirror'); t.grantFor(1, 0, 'Magic Mirror');
  t.put(0, 0, 0, 'Soul Shard Ba');
  if (opts.fuellen) for (let i = 0; i < opts.fuellen; i++) t.put(1, Math.floor(i / 3), i % 3, H.INERT.creature);
  if (opts.limitVerbraucht) { t.gs.players[1]._oncePerGameUsed = new Set(['eraserBeam']); }
  let n = 0;
  t.targetFn = (v) => { n++; return [v.find(x => x.type === 'hero' && x.owner === (n === 1 ? 1 : 0) && x.heroIdx === 0).id]; };
  t.policy.confirm = true;
  await t.play(0, spell, { hero: 0 });
  return t;
}
(async () => {
  const R = H.runner();
  let t = await lauf('Cold Coffin');
  R.check('(a) Cold Coffin-Kopie: 1 (Mirror) + 2 (Zauber) = 3 Tokens bei Sitz 1', tokens(t, 1) === 3, tokens(t, 1));
  R.check('(a) Kopie wirkt: Wirker-Held 0 (Sitz 0) gefroren', !!(t.engine.gs.players[0].heroes[0].statuses && t.engine.gs.players[0].heroes[0].statuses.frozen) || JSON.stringify(t.engine.gs.players[0].heroes[0].statuses || {}).includes('frozen'), t.engine.gs.players[0].heroes[0].statuses);
  R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);

  t = await lauf('Eraser Beam');
  R.check('(a) Eraser Beam-Kopie: 2 (Mirror) + 3 (Zauber) = 5 Tokens', tokens(t, 1) === 5, tokens(t, 1));
  R.check('(b) Kopie verbraucht das EIGENE Limit von Sitz 1', !!t.gs.players[1]._oncePerGameUsed?.has('eraserBeam'), [...(t.gs.players[1]._oncePerGameUsed || [])]);
  R.check('(b) Limit des Wirkers (Sitz 0) unverbraucht', !t.gs.players[0]._oncePerGameUsed?.has('eraserBeam'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
  R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);

  // (b2) eigenes Limit schon verbraucht → Spiegel nicht nutzbar: Held 0 von Sitz 1 wird getroffen (Eraser Beam), Spiegel bleibt liegen
  t = await lauf('Eraser Beam', { limitVerbraucht: true });
  R.check('(b2) Limit schon verbraucht: Spiegel wird nicht angeboten (keine Kopie, keine Mirror-Tokens bei Sitz 1)', tokens(t, 1) === 0, tokens(t, 1));
  R.check('(b2) Spiegel-Träger (Sitz 1, Held 0) wird vom Original getroffen', t.hp(1, 0) <= 0, t.hp(1, 0));
  R.check('(b2) Magic Mirror bleibt unaktiviert liegen (nicht in der Ablage)', !t.pile(1, 'discardPile').includes('Magic Mirror'), t.pile(1, 'discardPile'));

  // (a2) zu wenig freier Platz für die Kosten der Kopie: 7 von 9 Plätzen belegt → 2 frei; der Mirror (Lv1) legt 1, Cold Coffin bräuchte weitere 2
  t = await lauf('Cold Coffin', { fuellen: 7 });
  R.check('(a2) Platz knapp: Spiegel legt nur seinen Token (1), keine Kopie', tokens(t, 1) === 1, tokens(t, 1));
  R.check('(a2) Original bleibt negiert: Held 0 von Sitz 1 nicht gefroren, Wirker-Held 0 nicht gefroren', !JSON.stringify(t.engine.gs.players[1].heroes[0].statuses || {}).includes('frozen') && !JSON.stringify(t.engine.gs.players[0].heroes[0].statuses || {}).includes('frozen'), [t.engine.gs.players[0].heroes[0].statuses, t.engine.gs.players[1].heroes[0].statuses]);
  R.check('(a2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
