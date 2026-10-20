'use strict';
// N1-08 · Barrier of Faith gegen Anhänge-Zauber: Decisive Defeat negiert den Helden TROTZDEM, Curse/Berserk bleiben als wirkungslose Karten am Helden hängen
// Kartentext: „Play this card immediately when a Hero you control would be affected by a card or effect. Send 3/2/1 Abilities from that Hero to the discard pile to negate any effects that card or effect would have on the Hero, including damage."
// Skript: `postTargetResolve` → `engine.grantEffectImmunity(...)`; die Immunität greift nur dort, wo ein Zauber über `addHeroStatus`/Schaden/Buff läuft.
//   `decisive-defeat.js` schreibt `wirt.statuses.negated = {…}` DIREKT (onPlay, nach `attachToHero`) → die Immunität sieht das nie.
//   Curse/Berserk laufen über `addHeroStatus` (Status wird abgewehrt), ihr Karten-Anhang wird aber vorher gesetzt und bleibt liegen.
// Aufbau: Sitz 1 hält Barrier of Faith; Held 1:0 hat Support Magic 3 (→ 1 Ability zu senden) und Fighting 2. Sitz 0 wirkt Decisive Defeat / Curse / Berserk (Wirt Held 1:0).
// Erwartet (Kartentext „negate any effects that card … would have on the Hero"): Held 1:0 trägt danach weder Status `negated`/`cursed`/`berserked` noch den Anhang (Zauber verpufft → Ablage von Sitz 0),
//   die Ability wurde gesendet.  (Gegenprobe: Anti Magic Shield auf demselben Wirt lässt den Zauber vollständig verpuffen: kein Status, kein Anhang.)
// Beobachtet: Decisive Defeat: `negated` liegt am Helden; Curse/Berserk: kein Status, aber der Anhang steckt in der Support Zone. Die Ability wurde bezahlt.
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid, cfg) => {
  if (cfg && /Barrier/.test(cfg.title || '')) return valid.slice(0, Math.max(1, cfg.minTargets || 1)).map(x => x.id);   // Ability-Auswahl von Barrier of Faith
  const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
const STATUS = { 'Decisive Defeat': 'negated', 'Curse': 'cursed', 'Berserk': 'berserked' };
(async () => {
  const R = H.runner();
  for (const [reaktion, label] of [['Anti Magic Shield', 'Gegenprobe Anti Magic Shield'], ['Barrier of Faith', 'Barrier of Faith']]) {
    for (const zauber of ['Decisive Defeat', 'Curse', 'Berserk']) {
      const t = await H.fresh({ hand: [[zauber], [reaktion]] });
      t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic', 'Magic Arts'].slice(0, reaktion === 'Barrier of Faith' ? 3 : 4), ['Fighting', 'Fighting'], []]);
      if (reaktion === 'Anti Magic Shield') t.setAbilities(1, 0, [['Magic Arts', 'Magic Arts'], ['Fighting', 'Fighting'], []]);
      t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
      t.targetFn = heroPick(1, 0);
      await t.play(0, zauber, { hero: 0, noGrant: true });
      const nachher = (t.gs.players[1].supportZones[0] || []).flat();
      R.check(`${label} vs ${zauber}: Reaktion wurde gewirkt`, t.prompts.some(p => p.pi === 1 && p.d.title === reaktion), t.prompts.map(p => p.d.title));
      R.check(`${label} vs ${zauber}: Held trägt keinen Status ${STATUS[zauber]}`, !t.hero(1, 0).statuses[STATUS[zauber]], Object.keys(t.hero(1, 0).statuses));
      R.check(`${label} vs ${zauber}: kein Anhang am Helden`, !nachher.includes(zauber), nachher);
      R.check(`${label} vs ${zauber}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})();
