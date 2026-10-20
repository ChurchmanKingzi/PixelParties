'use strict';
// N1-05 · Corpse Explosion reagiert nicht, wenn ein Ziel von einer Attack/einem Spell DIREKT „besiegt" wird (ohne Schaden)
// Kartentext: „Play this card immediately when a target is defeated by an Attack or Spell. Deal 50 damage to all targets the opponent of the defeated target controls."
// Vergleich: Core Explosion und Crushing Defeat melden auch Besiegen ohne Schaden („by an opponent's card or effect", Ruling 23.9.); Corpse Explosion hängt nur an den
//   Nach-Schaden-Fenstern (`isAfterDamageReaction` / `isAfterCreatureDamageReaction`, `defeatedByAttackOrSpell(type)`), kennt also nur Tod durch Schaden.
// Aufbau: Sitz 1 hält Corpse Explosion (Destruction Magic 2), hat einen Helden (100 HP) bzw. eine 10-HP-Kreatur; Sitz 0 wirkt
//   a) Trial of Dominance (Spell: „Defeat all Creatures your opponent controls"), b) Goldify (Spell: „Choose a Creature and defeat it").
//   (Midnight Assault bleibt bewusst draußen: „Your opponent cannot react to this Attack".)
// Erwartet: In allen Fällen wurde ein Ziel von einer Attack/einem Spell besiegt → Fenster „Corpse Explosion", Sitz 0 verliert 50 je Held.
// Beobachtet: Kein Fenster, kein Schaden. Gegenprobe (Schaden tötet, Boiling Oil / Fireball): Fenster + 50 Schaden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const hp0 = (t) => [0, 1, 2].map(h => t.hp(0, h));
  const lauf = async (label, karte, ziel, aufbau) => {
    const t = await H.fresh({ hand: [[karte], ['Corpse Explosion']] });
    t.grantFor(1, 1, 'Corpse Explosion');
    if (aufbau) aufbau(t);
    if (ziel === 'kreatur') t.put(1, 1, 0, H.INERT.frail); else t.setHero(1, 0, t.hero(1, 0).name, 100);
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1 && (ziel === 'kreatur' ? x.type === 'equip' : (x.type === 'hero' && x.heroIdx === 0))); return v ? [v.id] : undefined; };
    await t.play(0, karte, { hero: 0 });
    const tot = ziel === 'kreatur' ? t.inst(i => i.zone === 'support' && i.owner === 1).length === 0 : t.hp(1, 0) <= 0;
    R.check(`${label}: Ziel ist besiegt`, tot, { hp: t.hp(1, 0) });
    R.check(`${label}: Corpse Explosion wurde angeboten`, t.prompts.some(p => p.pi === 1 && p.d.title === 'Corpse Explosion'), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`${label}: Sitz 0 verliert 50 je Held`, hp0(t).every(h => h === 750), hp0(t));
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  };
  R.section('Gegenprobe (Tod durch Schaden)');
  await lauf('Boiling Oil → Kreatur', 'Boiling Oil', 'kreatur');
  R.section('Besiegen ohne Schaden');
  await lauf('Trial of Dominance → Kreatur', 'Trial of Dominance', 'kreatur');
  await lauf('Goldify → Kreatur', 'Goldify', 'kreatur', (t) => t.put(0, 2, 0, 'Pollution Token'));
  R.finish();
})();
