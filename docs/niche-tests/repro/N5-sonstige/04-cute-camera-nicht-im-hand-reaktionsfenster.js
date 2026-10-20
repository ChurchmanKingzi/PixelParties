'use strict';
// N5-04 · Cute Camera: „Play this card immediately when your opponent plays a Reaction Spell or Artifact in reaction to your card or effect. Negate that reaction."
// Die Kamera hängt nur am KETTENFENSTER (`reactionCondition`, `onChainAdd`/`resolve`). Reaktionen, die der Gegner in den Hand-Reaktionsfenstern der Engine spielt
// (hier MOE Shield im „post_target_reaction"-Fenster nach der Zielwahl; ebenso Schadens-/Tod-Fenster) lösen weder einen Kamera-Hook aus, noch bietet die Engine die Kamera an:
// Front Soldier (gleiche Textform „when your opponent plays a Reaction") bekam dafür den Hook `onReactionPlayed` (CARD_API „FRONT SOLDIER", Weg ③); die Kamera hat ihn nicht.
// Erwartet: die Kamera wird auch gegen MOE Shield angeboten (Kamera gespielt → MOE Shield negiert → Fireball trifft: 150 Schaden). Gegenprobe (Silence im Kettenfenster): Kamera wird angeboten und negiert ✓.
// Aufruf: node docs/niche-tests/repro/N5-sonstige/04-cute-camera-nicht-im-hand-reaktionsfenster.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const rx of ['Silence', 'MOE Shield']) {
      const hand = [[], []]; hand[seat] = ['Fireball', 'Cute Camera']; hand[opp] = [rx];
      const t = await H.fresh({ active: seat, hand });
      t.grantFor(opp, 0, rx);
      t.policy.confirm = true;
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === opp && x.heroIdx === 0); return h ? [h.id] : undefined; };
      const hp0 = t.hp(opp, 0);
      await t.play(seat, 'Fireball', { hero: 0 });
      const kameraGespielt = !t.pile(seat, 'hand').includes('Cute Camera');
      R.check(`Sitz ${seat} · ${rx} gegen Fireball: Cute Camera wird angeboten/gespielt (${rx === 'Silence' ? 'Kettenfenster, Gegenprobe' : 'Hand-Reaktionsfenster'})`, kameraGespielt, { hand: t.pile(seat, 'hand'), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
      R.check(`Sitz ${seat} · ${rx}: Fireball trifft (150), weil die Reaktion negiert wurde`, hp0 - t.hp(opp, 0) === 150, { schaden: hp0 - t.hp(opp, 0) });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
