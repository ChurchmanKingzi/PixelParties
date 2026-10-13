// H02-heroes-31 · Hel: der Zugende-Zwang „by paying its Cost" ignoriert Kents Kreditrahmen – Hel stirbt trotz bezahlbarer Karte
//
// Kartentext Hel: „At the end of your turn, if this Hero does not have an Artifact equipped to it by its own effect, immediately equip an Artifact with the same name from your hand or discard pile to this Hero by paying its Cost. If you can't, defeat this Hero."
// Kartentext Kent: „If you spend Gold on a card or effect while you have 0 or more Gold, you may spend up to 20 Gold more than you own, going into negative Gold."
// Engine: `canAffordGold(pi, cost)` rechnet den Heldenvertrag `goldOverdraft` ein (`_engine.js` ~24396). Hel prüft `(ps.gold || 0) < cost` (hel-the-bound-specter.js `onTurnEnd`, „cant_pay") und bucht mit `actionSpendGold`.
// Aufbau: Hel (Held 0) + Kent (Held 1) auf Sitz 0, Gold 5, Hels Bezugsname „Cute Crown" (Kosten 8) liegt in der Ablage, kein Artefakt an Hel. `t.endTurn()`.
// Erwartung: Hel rüstet die Cute Crown aus (Gold 5 → −3, wie beim Handspiel mit Kent: Kontrolle ✓). Beobachtung: Hel wird besiegt („cant_pay"), Gold bleibt 5.
// Aufruf: node docs/niche-tests/repro/H02-heroes/31-hel-kent-kreditrahmen.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const HEL = 'Hel, the Bound Specter', KENT = 'Kent, the Indebted Apprentice', ART = 'Cute Crown';
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ heroes: [[HEL, KENT, H.BLANK_HEROES[2]], null], gold: 5, hand: [[ART], []] });
    const r = await t.play(0, ART, { hero: 1 });
    R.check('Kontrolle: mit Kent ist die Cute Crown (Kosten 8) bei 5 Gold spielbar', r === true && t.gs.players[0].gold === -3, { r, gold: t.gs.players[0].gold }); }
  { const t = await H.fresh({ heroes: [[HEL, KENT, H.BLANK_HEROES[2]], null], gold: 5, hand: [[], []], discard: [[ART], []] });
    t.hero(0, 0)._helEffectArtifactName = ART;
    await t.endTurn();
    const ausgeruestet = t.inst(c => c.name === ART && c.zone === 'support' && c.heroIdx === 0).length;
    R.check('Hel lebt und trägt die Cute Crown (Kent erlaubt die Schuld)', t.hp(0, 0) > 0 && ausgeruestet === 1, { hp: t.hp(0, 0), ausgeruestet, gold: t.gs.players[0].gold });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
