'use strict';
// H01-heroes-01 · Archibald bietet seinen Nachguss auch beim Abwurf im Zug des GEGNERS an
//
// Kartentext: „Once per turn, during your turn, when you discard a Normal Spell from your hand, you may immediately use that Spell
//   as an additional Action with this Hero after you have discarded it, but if you do, increase its level by 1 for the duration of this use.
//   This Hero can never perform 2 of the same Spell during 1 turn."
// Erwartung: Wird der Normal Spell im Zug des GEGNERS abgeworfen (Sitz 1 ist am Zug), löst Archibald nicht aus.
// Beobachtet: Archibald fragt auch im Gegnerzug „cast it as an additional Action?" und wirkt den Zauber (Log `archibald_cast`).
// Ursache: cards/effects/archibald-the-archmage.js – Kopfkommentar „Triggers on ANY discard, including during the opponent's turn";
//   `hooks.onDiscard` / `resolveTrigger` prüfen nie `gs.activePlayer === ctx.cardOwner`.
const H = require('../../lib/h.js');
const ARCH = 'Archibald, the Archmage';
(async () => {
  const R = H.runner();
  async function lauf(aktiv) {
    const t = await H.fresh({ heroes: [[ARCH, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler], []] });
    t.setAbilities(0, 0, [['Wisdom', 'Wisdom'], [], []]);
    t.gs.activePlayer = aktiv; t.phase(3);
    await t.run(() => t.engine.actionPromptForceDiscard(0, 1, { title: 'Test-Zwangsabwurf', source: 'Test' }));
    return { t, fragt: t.prompts.some(p => /Archibald/.test(p.d.title || '')), gewirkt: t.lg('archibald_cast').length };
  }
  R.section('Kontrollprobe: Abwurf im EIGENEN Zug (Sitz 0 am Zug)');
  const a = await lauf(0);
  R.check('eigener Zug: Archibald bietet den Nachguss an', a.fragt && a.gewirkt === 1, { fragt: a.fragt, gewirkt: a.gewirkt });
  R.section('Abwurf im Zug des GEGNERS (Sitz 1 am Zug)');
  const b = await lauf(1);
  R.check('Gegnerzug: Archibald löst NICHT aus („during your turn")', !b.fragt && b.gewirkt === 0, { fragt: b.fragt, gewirkt: b.gewirkt });
  R.check('keine Engine-Fehler', a.t.errors.length === 0 && b.t.errors.length === 0, [a.t.errors, b.t.errors]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
