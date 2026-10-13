'use strict';
// R01-08 · Dark Deal bietet sich bei Mr. Jiggles und Land Sharks nicht an (Zielwahl-Erkennung per Regex greift nicht)
// Kartentext: „Play this card immediately when your opponent activates the active effect of one of their Creatures that chooses a target. You choose the target of that effect.
//   For that moment only, the Creature is treated as being controlled by you."
// Mr. Jiggles: „You may once per turn choose up to 2 targets your opponent controls and inflict 100 damage to them." Land Sharks: „… choose up to 1/2/3 targets on the board … deal 100 damage to them."
// Aufbau: Sitz 0 hat die Kreatur (alt, kein Summoning Sickness) auf dem Brett; Sitz 1 hat Dark Deal (Decay Magic 1 per grantFor); Phase Main 1.
// Schritte: 1. Sitz 0 aktiviert den Kreatureneffekt (`t.activateCreature`). 2. Kontrolle: Gigantisaur Ankylos („choose a target … Stun") auf dieselbe Weise.
// Erwartet: Sitz 1 bekommt in allen drei Fällen das Reaktionsfenster „Dark Deal".
// Beobachtet: Ankylos ✓ (Prompt „Dark Deal"); Mr. Jiggles und Land Sharks: kein Fenster – Dark Deal bleibt auf der Hand.
// Ursache: `dark-deal.js` `waehltZiel()`: `requiresTarget` oder Regex `/prompt(Damage|Effect)?Target\s*\(|promptTarget\s*\(|promptZonePick|zonePick/` über den Skript-Quelltext – beide
//   Kreaturen wählen mit `ctx.promptMultiTarget(` (nicht erfasst) und tragen kein `requiresTarget`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const nm of ['Gigantisaur Ankylos', 'Mr. Jiggles', 'Land Sharks']) {
    const t = await H.fresh({ hand: [['ZZ Filler'], ['Dark Deal']] });
    t.grantFor(1, 0, 'Dark Deal');
    const inst = t.put(0, 0, 0, nm); inst.turnPlayed = 1;
    t.put(1, 1, 0, H.INERT.creature);
    t.targetFn = (valid) => valid.filter(x => x.owner === 1).slice(0, 2).map(x => x.id);
    t.gs.activePlayer = 0; t.phase(2);
    const r = await t.activateCreature(0, 0, 0);
    R.check(nm + ': Effekt wurde aktiviert', r === true, r);
    R.check(nm + ': Dark-Deal-Fenster ging auf', t.prompts.some(p => p.d.title === 'Dark Deal'), t.prompts.map(p => p.d.title || p.d.type));
    R.check(nm + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
