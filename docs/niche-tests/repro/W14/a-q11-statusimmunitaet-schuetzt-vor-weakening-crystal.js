'use strict';
// W14a · Rückfrage 11 (Welle 13 / W13c; A08-28 Weakening Crystal × Petrification Break) · Al, 16.10.2026: „Ja, Immunität gegen jeden Status negiert auch Crystal."
// Weakening Crystal: „While this card is in your hand, the effects of all your Heroes are negated. This counts as a negative status effect."
// Erwartet: ein Held mit Immunität gegen negative Status (Petrification Break-Träger, Buff `negative_status_immune` [Divine Gift of Coolness], Light Ball der Geschwister,
//   `negate_immune`) bekommt die Negation des Kristalls NICHT — beim Eintritt in die Hand UND bei der Neuanlage zu Rundenbeginn. Alle anderen Helden sind negiert.
//   Karian bleibt wie in W13c immun gegen den Kristall; Petrification Break wirkt auf Karian wie auf jeden Helden (unverändert, nur der Kristall ist Gegenstand).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const neg = (t, hi) => !!t.hero(0, hi).statuses.negated;
  const mk = async (heroes) => {
    const t = await H.fresh({ heroes: heroes ? [heroes, null] : undefined, hand: [['Weakening Crystal'], []], deck: [Array(30).fill(F), Array(30).fill(F)] });
    return t;
  };

  R.section('Petrification Break-Träger (A08-28)');
  {
    const t = await mk();
    const pb = t.put(0, 0, 0, 'Petrification Break'); pb.turnPlayed = 1;
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('Held 0 (Petrification Break) bleibt unnegiert, Held 1 und 2 sind negiert', !neg(t, 0) && neg(t, 1) && neg(t, 2), [neg(t, 0), neg(t, 1), neg(t, 2)]);
    await t.endTurn(); await t.endTurn();   // Neuanlage zu Beginn der eigenen Runde
    t.engine._refreshWeakeningCrystalNegation({ reapply: true, onlyFor: 0 });
    R.check('auch nach Rundenwechsel/Neuanlage: Held 0 unnegiert, Held 1/2 negiert', !neg(t, 0) && neg(t, 1) && neg(t, 2), [neg(t, 0), neg(t, 1), neg(t, 2)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('Immunitäts-Buff (negative_status_immune) und Light Ball');
  {
    const t = await mk();
    t.hero(0, 1).buffs = { ...(t.hero(0, 1).buffs || {}), negative_status_immune: { appliedTurn: t.gs.turn } };
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('Held 1 mit Immunitäts-Buff unnegiert, Held 0/2 negiert', neg(t, 0) && !neg(t, 1) && neg(t, 2), [neg(t, 0), neg(t, 1), neg(t, 2)]);
  }
  {
    const t = await mk();
    t.put(0, 2, 0, 'Light Ball');
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('Light Ball (Held 2): Held 0 und 1 geschützt, Held 2 (Träger, nicht sein eigenes Ziel) negiert', !neg(t, 0) && !neg(t, 1) && neg(t, 2), [neg(t, 0), neg(t, 1), neg(t, 2)]);
  }
  R.section('Kontrolle ohne Immunität und Karian');
  {
    const t = await mk();
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('ohne Immunität: alle drei Helden negiert', neg(t, 0) && neg(t, 1) && neg(t, 2), [neg(t, 0), neg(t, 1), neg(t, 2)]);
    t.setHand(0, [F]);
    t.engine._refreshWeakeningCrystalNegation();
    R.check('Kristall weg: Negation fällt sofort', !neg(t, 0) && !neg(t, 1) && !neg(t, 2), [neg(t, 0), neg(t, 1), neg(t, 2)]);
  }
  // Karian (immun gegen den Kristall, nicht gegen Petrification Break): bleibt in `W13/c-rf10-karian-immun-gegen-weakening-crystal.js` abgesichert.
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
