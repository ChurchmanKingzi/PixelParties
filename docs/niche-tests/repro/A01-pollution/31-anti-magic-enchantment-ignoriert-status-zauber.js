'use strict';
// A01-pollution-31 · Anti Magic Enchantment: greift nur bei SCHADEN – Status-Zauber (Cold Coffin, Medusa's Curse, Null Zone) treffen den Helden ungehindert
// Kartentext: „While that Artifact is equipped to a Hero, that Hero's controller may once per turn make the Hero unaffected by a Spell that hits it.“
// Aufbau: Sitz 1: Blade of the Frostbringer an Held 0 mit verzaubertem Zähler (`antiMagicEnchanted {ownerPi:1, charges:1}`, wie ihn das Skript beim Verzaubern setzt); Sitz 1 antwortet überall „Ja“.
//   Sitz 0 wirkt den Zauber auf Held 0 (Cold Coffin: gezielt; Medusa's Curse / Null Zone: alle Helden).
// Erwartet: das AME-Angebot („Negate the Spell with the enchanted …?“) erscheint, bei „Ja“ bleibt Held 0 frei von Frost/Betäubung/Null.
// Beobachtet: kein Angebot, Ladung bleibt 1, Held 0 ist gefroren/betäubt/genullt. Gegenprobe Pyroblast: Angebot erscheint, Ladung 0, kein Schaden.
// Ursache: `_engine.js` ~8180 – `_maybePromptAntiMagicEnchantment` wird nur aus `actionDealDamage` gerufen; `_checkAntiMagicEnchantmentNegation` (~35303, für gezielte Helden vor der Wirkung) hat keinen Aufrufer.
//   `addHeroStatus` liest zwar `_isAmeShieldedHero` (~17817), aber das Schild wird nie gesetzt, wenn zuvor kein Schaden floss.
// Aufruf: node docs/niche-tests/repro/A01-pollution/31-anti-magic-enchantment-ignoriert-status-zauber.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const BLADE = 'Blade of the Frostbringer';
const tgt = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
(async () => {
  const R = H.runner();
  for (const [spell, status] of [['Pyroblast', null], ['Cold Coffin', 'frozen'], ["Medusa's Curse", 'stunned'], ['Null Zone', 'nulled']]) {
    const t = await H.fresh({ hand: [[spell, 'Fireball'], []] });
    const ar = t.put(1, 0, 0, BLADE);
    ar.counters.antiMagicEnchanted = { ownerPi: 1, charges: 1 };
    ar.counters.buffs = { anti_magic_enchanted: { source: 'Anti Magic Enchantment' } };
    t.policy.confirm = true; t.targetFn = tgt;
    await t.play(0, spell, { hero: 0 });
    const h = t.gs.players[1].heroes[0];
    const angebote = t.prompts.filter(p => p.pi === 1 && p.d.title === 'Anti Magic Enchantment').length;
    R.check(`${spell}: AME-Angebot erscheint`, angebote === 1, { angebote });
    if (status) R.check(`${spell}: Held 0 nicht ${status}`, !h.statuses?.[status], Object.keys(h.statuses || {}));
    else R.check(`${spell} (Gegenprobe): kein Schaden`, h.hp === 800, h.hp);
    R.check(`${spell}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
