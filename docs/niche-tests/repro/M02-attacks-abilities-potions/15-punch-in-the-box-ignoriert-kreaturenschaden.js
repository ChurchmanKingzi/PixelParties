'use strict';
// M02-15 · Punch in the Box wird nur bei Heldenschaden angeboten, nicht wenn eine eigene KREATUR Schaden nimmt
// Kartentext: „Play this card immediately when a target you control takes damage from an opponent's card or effect. Choose a target your opponent controls and deal half that damage to it (rounded up)."
// („target" = Held ODER Kreatur, vgl. Escape Device / Fireball „targets"; Punch hat selbst Kreaturen als Rückschlag-Ziele.)
// Erwartung: Sitz 0 trifft mit Fireball (150) eine Kreatur von Sitz 1 und überlebt sie ⇒ Sitz 1 bekommt das Reaktionsfenster, Rückschlag 75 auf einen Sitz-0-Helden.
// Beobachtet: Kreatur verliert 150 HP (850/1000), es erscheint kein Fenster, Punch bleibt auf der Hand. Kontrolle: derselbe Fireball auf einen Held öffnet das Fenster (Rückschlag 75).
// Ursache: `punch-in-the-box.js` trägt nur `isAfterDamageReaction` (Helden-Fenster, _engine.js ~33700); für Kreaturenschaden gibt es das separate Fenster
//   `isAfterCreatureDamageReaction` (nur corpse-explosion.js, decapitating-strike.js, spiky-armor.js nutzen es).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const chp = (c) => (c.counters.currentHp ?? H.DB[c.name].hp);
  // Kontrolle: Heldenschaden
  {
    const t = await H.fresh({ hand: [[], ['Punch in the Box']], hp: 800 });
    t.policy.confirm = true;
    t.targetFn = (valid, cfg) => (cfg && /Punch/.test(cfg.title || '')) ? [valid.find(x => x.owner === 0 && x.type === 'hero' && x.heroIdx === 0).id] : [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Kontrolle: Fireball auf Held ⇒ Punch löst aus (Rückschlag 75 auf Sitz-0-Held)', t.hp(0, 0) === 725, t.hp(0, 0));
  }
  // Kreatur
  {
    const t = await H.fresh({ hand: [[], ['Punch in the Box']], hp: 800 });
    const c = t.put(1, 0, 0, H.INERT.big);
    t.policy.confirm = true;
    t.targetFn = (valid, cfg) => (cfg && /Punch/.test(cfg.title || '')) ? [valid.find(x => x.owner === 0 && x.type === 'hero' && x.heroIdx === 0).id] : [valid.find(x => x.type === 'equip' && x.owner === 1).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Kreatur hat 150 Schaden genommen (Voraussetzung)', chp(c) === 850, chp(c));
    R.check('Kreatur getroffen ⇒ Punch löst aus (Rückschlag 75 auf Sitz-0-Held)', t.hp(0, 0) === 725 && !t.pile(1, 'hand').includes('Punch in the Box'), { hp0: t.hp(0, 0), hand1: t.pile(1, 'hand') });
  }
  R.finish();
})();
