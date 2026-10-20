'use strict';
// N1-12 · Dark Ocean: Surprises (Booby Trap) lösen gegen Effekte gegnerischer Kreaturen weiterhin aus – nur die Hand-/Ketten-Reaktionsfenster sind gesperrt
// Kartentext Dark Ocean: „While this Area Spell remains on the board, neither player can react to or negate the effects of their opponent's Creatures and Creatures take no damage, except from Attacks and Spells."
// Kartentext Booby Trap: „Activate this Surprise when the user would be hit by an Attack, Spell or Creature effect. Deal 100 damage to the attacker. If this damage defeats the attacker, negate the Attack, Spell or effect."
// Ruling Dark Ocean (5.8., Kopf von dark-ocean.js): Sperre „in jedem Hand-Reaktionsfenster einzeln" (`darkOceanBlocksReaction`); `_checkSurpriseWindow` (Surprise-Fenster „chosen/hit by") fragt sie nicht.
// Aufbau: Dark Ocean liegt; Sitz 1 hat Booby Trap verdeckt am Helden 1:0; Sitz 0 aktiviert Burning Skeleton (wählt Held 1:0 als Ziel, „Burn it").
// Erwartet (zwei Lesarten, deshalb Stufe C): „react to" schließt Surprises ein → kein Surprise-Fenster, Held 1:0 wird verbrannt, Skelett bleibt unversehrt (Gegenprobe ohne Dark Ocean: Booby Trap löst aus, tötet das 50-HP-Skelett und negiert den Effekt).
// Beobachtet: Booby Trap löst auch unter Dark Ocean aus, tötet das Skelett und negiert den Effekt – ein Surprise reagiert auf einen Kreatureneffekt des Gegners.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const ocean of [false, true]) {
    const t = await H.fresh({ hand: [[], []] });
    if (ocean) t.putArea(1, 'Dark Ocean');
    t.putSurprise(1, 0, 'Booby Trap'); t.grantFor(1, 0, 'Booby Trap');
    const sk = t.put(0, 0, 0, 'Burning Skeleton'); sk.turnPlayed = t.gs.turn - 1;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : undefined; };
    t.gs.currentPhase = 2; t.resetActions(0);
    await t.activateCreature(0, 0, 0);
    const ausgeloest = t.prompts.some(p => p.pi === 1 && p.d.title === 'Booby Trap');
    if (!ocean) R.check('Gegenprobe ohne Dark Ocean: Booby Trap löst aus und negiert (Held nicht verbrannt)', ausgeloest && !t.hero(1, 0).statuses.burned, { ausgeloest, st: t.hero(1, 0).statuses });
    else {
      R.check('Dark Ocean: kein Surprise-Fenster gegen den Kreatureneffekt', !ausgeloest, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('Dark Ocean: Held 1:0 ist verbrannt (der Effekt lief)', !!t.hero(1, 0).statuses.burned, t.hero(1, 0).statuses);
    }
    R.check(`ocean=${ocean}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
