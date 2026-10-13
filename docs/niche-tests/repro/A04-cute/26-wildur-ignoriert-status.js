'use strict';
// A04-cute-26 (B) · Wildurs Umleitung wirkt auch, wenn Wildur negiert / gefroren / betäubt ist
//
// Kartentext (Wildur): "The first card that would be sent to your discard pile every turn while you control this Creature is placed on top of your Coolness Stack instead."
// Konvention (CARD_API.md Z. ~1902 „EIN Stummschalt-Prädikat"): `isCreatureEffectSuppressed(inst)` – negierte/gefrorene/betäubte Kreaturen sind stumm; Wowkyrie, Nornstellar, Hawk halten sich daran (A04-Statusmatrix).
// Erwartung: bei stummem Wildur landet die erste Ablage-Karte regulär in der Ablage.
// Beobachtet: in allen drei Zuständen wird die Karte auf den Coolness Stack umgeleitet (`isCreatureEffectSuppressed` = true).
// Ursache: wildur-the-shining-coolness.js: der `discardPile.push`-Override fragt nie `isCreatureEffectSuppressed`; er bleibt nach Installation bis Wildur das Brett verlässt aktiv.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WI = 'Wildur, the Shining Coolness';
  for (const st of ['normal', 'negated', 'frozen', 'stunned']) {
    const t = await H.fresh({ hand: [[H.INERT.filler, H.INERT.filler], []], deck: [Array(8).fill(H.INERT.creature), []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0]; ps.coolnessStack.push('Cute Phoenix'); t.engine._trackCard('Cute Phoenix', 0, 'coolnessStack');
    const w = t.put(0, 0, 0, WI); w.turnPlayed = 0;
    await t.turnStart(0);
    if (st === 'negated') await t.run(() => t.engine.actionNegateCreature(w, 'Test'));
    else if (st !== 'normal') await t.run(() => t.engine.applyCreatureStatus(w, st, { sourceOwner: 1 }));
    const supp = t.engine.isCreatureEffectSuppressed(w);
    await t.run(() => t.engine.actionDiscardHandCard(0, H.INERT.filler, 0, { source: 'Test', selfInflicted: true }));
    const umgeleitet = ps.coolnessStack.length === 2;
    if (st === 'normal') R.check('Gegenprobe normal: umgeleitet', umgeleitet, { supp });
    else R.check(st + ': Wildur stumm (' + supp + ') -> NICHT umgeleitet', supp && !umgeleitet, { supp, stack: ps.coolnessStack.slice(), abl: t.pile(0, 'discardPile') });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
