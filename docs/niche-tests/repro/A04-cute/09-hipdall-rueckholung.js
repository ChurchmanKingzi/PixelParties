'use strict';
// A04-cute-09 · Hipdall: die "Rückholung" einer vom Coolness Stack entfernten Karte funktioniert nie (Ablage/Gelöscht)
//
// Kartentext (Hipdall): "Once per turn, when a card is removed from your Coolness Stack, you may add it to your hand, and if you do,
//   place the top card of your deck on top of your Coolness Stack."
// Erwartung: Wird die oberste Stack-Karte entfernt (in die Ablage, gelöscht, auf die Hand), kann Hipdall sie auf die Hand holen
//   und die Deckoberseite auf den Stack legen.
// Beobachtet: Hipdall fragt "Hipdall, Protector of Coolness is leaving your Coolness Stack. Add it to your hand …" (falscher Name),
//   nach "Ja" passiert bei Ablage und Gelöscht NICHTS (Karte bleibt, Stack bleibt, Einmal-pro-Zug ist verbraucht). Nur beim Ziel 'hand'
//   (Cool Rescue) läuft der Deck-Teil.
// Ursache: cards/effects/hipdall-protector-of-coolness.js `onCardLeaveZone` (Z. ~72-120) liest `const cardName = ctx.cardName`.
//   In der Hook-Ctx ist cardName/card der ZUHÖRER (Hipdall selbst), nicht die gehende Karte → takeFromPile sucht "Hipdall" in
//   Ablage/Gelöscht und findet nichts. (Die gehende Karte steckt nicht in der Ctx; actionPopCoolnessStackTo übergibt sie als
//   `cardName`/`card`, die von der Ctx-Erzeugung überschrieben werden.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const dest of ['discard', 'delete', 'hand']) {
    R.section('Stack-Spitze (Cute Dog) wird nach "' + dest + '" entfernt, Hipdall liegt auf dem Brett, Antwort "Ja"');
    const t = await H.fresh({ deck: [['Fireball', H.INERT.creature, H.INERT.creature, H.INERT.creature], []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const hd = t.put(0, 0, 0, 'Hipdall, Protector of Coolness'); hd.turnPlayed = 0;
    const ps = t.gs.players[0];
    for (const n of ['Cute Bunny', 'Cute Dog']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
    await t.run(() => t.engine.actionPopCoolnessStackTo(0, dest, { source: 'Test' }));
    R.check('Cute Dog liegt auf der Hand', ps.hand.includes('Cute Dog'), { hand: ps.hand.slice(), ablage: ps.discardPile.slice(), geloescht: ps.deletedPile.slice() });
    R.check('Deckoberseite (Fireball) liegt oben auf dem Stack', ps.coolnessStack[ps.coolnessStack.length - 1] === 'Fireball', ps.coolnessStack.slice());
    R.check('keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
