// W11b · Q58 (A08-27) · Rusting Crystal
// Text: „While this card is in your hand, the Costs of all your other Artifacts are doubled. This effect does not stack with itself."
// Al: „2 Kopien machen einander teurer." → zwei Kopien auf der Hand: jede kostet 30 statt 15; normale Artefakte bleiben bei ×2 (nicht ×4);
//   eine einzelne Kopie kostet 15. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const { applyRustingCrystalCostMultiplier: mult } = require('../../../../cards/effects/_crystals-shared.js');
(async () => {
  const R = H.runner();
  const RC = 'Rusting Crystal';
  // reine Kostenrechnung
  const t0 = await H.fresh({ hand: [[], []], gold: [100, 100] });
  const ps = t0.gs.players[0];
  ps.hand = [RC];
  R.check('1 Kopie: Kristall kostet 15', mult(t0.gs, 0, RC, 15, t0.engine) === 15);
  R.check('1 Kopie: anderes Artefakt ×2', mult(t0.gs, 0, 'Beer', 4, t0.engine) === 8);
  ps.hand = [RC, RC];
  R.check('2 Kopien: Kristall kostet 30', mult(t0.gs, 0, RC, 15, t0.engine) === 30);
  R.check('2 Kopien: anderes Artefakt nur ×2 (stapelt nicht)', mult(t0.gs, 0, 'Beer', 4, t0.engine) === 8);
  ps.hand = [RC, RC, RC];
  R.check('3 Kopien: Kristall immer noch 30', mult(t0.gs, 0, RC, 15, t0.engine) === 30);
  // Spielweg
  const a = await H.fresh({ hand: [[], []], gold: [15, 100] });
  a.engine.handZugangSync(0, RC);
  R.check('1 Kopie, 15 Gold: gespielt', (await a.play(0, RC, {})) === true && a.gs.players[0].gold === 0, a.gs.players[0].gold);
  const b = await H.fresh({ hand: [[], []], gold: [29, 100] });
  b.engine.handZugangSync(0, RC); b.engine.handZugangSync(0, RC);
  R.check('2 Kopien, 29 Gold: abgelehnt', (await b.play(0, RC, {})) === false && b.gs.players[0].gold === 29, b.gs.players[0].gold);
  const c = await H.fresh({ hand: [[], []], gold: [30, 100] });
  c.engine.handZugangSync(0, RC); c.engine.handZugangSync(0, RC);
  R.check('2 Kopien, 30 Gold: gespielt, 30 bezahlt', (await c.play(0, RC, {})) === true && c.gs.players[0].gold === 0, c.gs.players[0].gold);
  R.check('eine Kopie bleibt auf der Hand', c.pile(0, 'hand').filter(n => n === RC).length === 1, c.pile(0, 'hand'));
  R.check('keine Engine-/Audit-Fehler', a.errors.length + b.errors.length + c.errors.length + c.audit().length === 0);
  R.finish();
})();
