'use strict';
// N1-02 · Berserk: Der Berserk-Träger „cannot … summon Creatures" – Effekt-Beschwörungen „as an additional Action" (Call of the Deepsea & Co.) setzen trotzdem eine Kreatur in seine Zone
// Kartentext Berserk: „The Hero this Spell is attached to cannot use any Spells or summon Creatures, but it can perform an Attack as an additional Action once per turn. …"
// Ruling `_summon-eligibility.js` (8.8.): „‚summon as an additional Action' ist eine ganz normale Beschwörung … Ein tauglicher Caster ist also weiterhin Pflicht."
//   Dort prüft `canHeroSummon` lebendig / Frozen / Stunned / Webbed / Bound / Sperren / Level – aber NICHT den Berserk-Status (`berserked`).
//   Der normale Spielweg (`validateActionPlay`) sperrt das Beschwören für `berserked` (Gegenprobe unten).
// Aufbau: Sitz 0: Held 0 mit Berserk (Anhang + Status `berserked`), eine Kreatur in seiner Zone 0; an Held 1 liegt Call of the Deepsea; auf der Hand ZZ Dummy.
//   Die Kreatur wird besiegt → Call of the Deepsea bietet „delete it and summon a Creature … into the same Support Zone as an additional Action".
// Erwartet: Der Berserk-Held kann nicht beschwören → kein Angebot, die Zone bleibt leer (wie bei Frozen/Stunned, Kontrolle).
// Beobachtet: Das Angebot kommt, die Kreatur steht danach in der Zone des Berserk-Helden.
const H = require('../../lib/h.js');
const lauf = async (variant) => {
  const t = await H.fresh({ hand: [[H.INERT.creature], []] });
  t.put(0, 1, 0, 'Call of the Deepsea');
  const c = t.put(0, 0, 0, H.INERT.frail);
  if (variant === 'berserk') { t.put(0, 0, 1, 'Berserk'); t.heroStatus(0, 0, 'berserked'); }
  if (variant === 'frozen') t.heroStatus(0, 0, 'frozen');
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 1, controller: 1, heroIdx: 0 }, c, 200, 'destruction_spell'));
  return { t, angebot: t.prompts.some(p => p.pi === 0 && p.d.title === 'Call of the Deepsea'), zone: t.gs.players[0].supportZones[0][0][0] || null };
};
(async () => {
  const R = H.runner();
  { const { t, angebot, zone } = await lauf('normal');
    R.check('Gegenprobe normal: Angebot + Beschwörung in die Zone', angebot && zone === H.INERT.creature, { angebot, zone });
    R.check('Gegenprobe normal: keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const { t, angebot, zone } = await lauf('frozen');
    R.check('Gegenprobe frozen: kein Angebot, Zone leer', !angebot && zone === null, { angebot, zone }); }
  // Gegenprobe: der normale Spielweg sperrt das Beschwören für den Berserk-Helden
  { const t = await H.fresh({ hand: [[H.INERT.creature], []] });
    t.put(0, 0, 1, 'Berserk'); t.heroStatus(0, 0, 'berserked');
    await t.play(0, H.INERT.creature, { hero: 0, slot: 0 });
    R.check('Gegenprobe: normales Ausspielen durch den Berserk-Helden wird abgelehnt', t.gs.players[0].supportZones[0][0].length === 0 && t.pile(0, 'hand').includes(H.INERT.creature), { zone: t.gs.players[0].supportZones[0], hand: t.pile(0, 'hand') }); }
  // Befund
  { const { t, angebot, zone } = await lauf('berserk');
    R.check('Berserk-Held: Call of the Deepsea bietet keine Beschwörung an', !angebot, { angebot });
    R.check('Berserk-Held: in seiner Zone steht keine neue Kreatur', zone === null, { zone });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
