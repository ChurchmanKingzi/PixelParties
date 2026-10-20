'use strict';
// N5-12 · Magic Amethyst: „Choose a Hero your opponent controls. Your opponent chooses an Ability attached to that Hero and discards it."
// Abilities in Support Zones (Xal/Xalibur: echte Ability-Stapel; Cloak of Edge: „treated as an Ability") sind laut Engine-Konvention (`collectSupportZoneAbilities`, Befund 5.9. „Karten, die Abilities wählen
// (Fire Bomb & Co.), finden sie nicht"; Weird Doll, Idej Sword - Onima, Jenny, Charme lesen sie) ebenfalls „Abilities, die an dem Helden hängen". Magic Amethyst baut Spielbarkeit (`_heroHasAbilities`),
// Zielliste (`getValidTargets`) und die Auswahlgalerie (`_buildAbilityGallery`) nur aus `ps.abilityZones`: ein Held, dessen einzige Abilities in Support Zones liegen, ist kein Ziel — die Karte ist nicht spielbar;
// hat er zusätzlich eine Ability in der Ability Zone, bietet die Galerie die Support-Zonen-Ability nie an.
// Erwartet: Amethyst ist spielbar, wenn der Gegnerheld nur eine Xalibur-Ability bzw. nur Cloak of Edge trägt, und die Galerie führt sie auf (Gegenprobe: Weird Doll bietet sie an ✓; Ability-Zone ✓).
// Aufruf: node docs/niche-tests/repro/N5-sonstige/12-magic-amethyst-ignoriert-abilities-in-support-zonen.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const [lbl, aufbau, abil, sollSpielbar, sollInGalerie] of [
      ['Ability in der Ability Zone (Gegenprobe)', () => {}, { 0: [['Fighting'], [], []] }, true, 'Fighting'],
      ['nur Leadership im Support (Xalibur)', (t) => { t.put(opp, 0, 0, 'Xalibur'); t.put(opp, 0, 1, 'Leadership'); }, null, true, 'Leadership'],
      ['nur Cloak of Edge', (t) => t.put(opp, 0, 0, 'Cloak of Edge'), null, true, 'Cloak of Edge'],
      ['Ability Zone + Leadership im Support', (t) => { t.put(opp, 0, 0, 'Xalibur'); t.put(opp, 0, 1, 'Leadership'); }, { 0: [['Fighting'], [], []] }, true, 'Leadership'],
    ]) {
      const hand = [[], []]; hand[seat] = ['Magic Amethyst'];
      const ab = {}; if (abil) ab[opp] = abil;
      const t = await H.fresh({ active: seat, hand, abilities: ab });
      aufbau(t);
      let galerie = null;
      t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { galerie = d.cards.map(c => c.name); return { cardName: d.cards[0].name, source: d.cards[0].source }; } });
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === opp && y.heroIdx === 0); return x ? [x.id] : undefined; };
      const r = await t.play(seat, 'Magic Amethyst', {});
      const gespielt = r === true && !t.pile(seat, 'hand').includes('Magic Amethyst');
      R.check(`Sitz ${seat} · ${lbl}: Amethyst spielbar`, gespielt === sollSpielbar, { r });
      R.check(`Sitz ${seat} · ${lbl}: „${sollInGalerie}" steht zur Wahl`, (galerie || []).includes(sollInGalerie), { galerie });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {   // Vergleichskarte: Weird Doll bietet dieselben Support-Zonen-Abilities an
      const hand = [[], []]; hand[seat] = ['Weird Doll'];
      const t = await H.fresh({ active: seat, hand });
      t.put(seat, 0, 0, 'Xalibur'); t.put(seat, 0, 1, 'Leadership');
      let ang = null; t.targetFn = (v) => { ang = v.map(x => x.cardName); return [v[0].id]; };
      await t.play(seat, 'Weird Doll', {});
      R.check(`Sitz ${seat} · Vergleich Weird Doll: Leadership im Support wird angeboten`, (ang || []).includes('Leadership'), ang);
    }
  }
  R.finish();
})();
