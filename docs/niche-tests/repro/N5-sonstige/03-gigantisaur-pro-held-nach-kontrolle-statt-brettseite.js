'use strict';
// N5-03 · Gigantisaur Triceras (und alle Gigantisaur-Kreaturen über `_gigantisaurs-shared.heroHasGigantisaur`): „A Hero can only have 1 "Gigantisaur" Creature in its Support Zones at a time."
// Die Beschwörungssperre zählt nach KONTROLLEUR (`(c.controller ?? c.owner) !== pi`) und vergleicht nur `heroIdx`, nicht die Brettseite. Der Übernahme-Prüfer
// `engine.uebernahmeUnzulaessig` (W16d, A07-31) rechnet für dieselbe Regel nach BRETTSEITE (`physicalSide(c) === zielSeite`). Folge:
//   (b) Gigantisaur des Gegners (kontrolliert vom Gegner) liegt in der Support Zone MEINES Helden 0 → mein Held 0 „hat" sie, trotzdem darf ich eine zweite Gigantisaur auf ihn beschwören;
//   (c) meine Gigantisaur liegt auf Held 0 der GEGENSEITE → sie zählt fälschlich gegen meinen Held 0, die Beschwörung auf ihn wird verweigert.
// Erwartet: Zählung der Support Zones DES HELDEN (Brettseite+Heldenindex), wie in `uebernahmeUnzulaessig`. (a) ist die Gegenprobe (gleiche Seite, gleicher Held: gesperrt ✓).
// Aufruf: node docs/niche-tests/repro/N5-sonstige/03-gigantisaur-pro-held-nach-kontrolle-statt-brettseite.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const auf = (t, name) => t.inst(c => c.name === name && c.zone === 'support').length;
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    const mk = async () => { const hand = [[], []]; hand[seat] = ['Gigantisaur Triceras']; return H.fresh({ active: seat, hand }); };
    R.section(`Sitz ${seat}`);
    { const t = await mk(); t.put(seat, 0, 0, 'Gigantisaur Raptoren');
      const r = await t.play(seat, 'Gigantisaur Triceras', { hero: 0, slot: 1 });
      R.check('(a) Gegenprobe: eigene Gigantisaur auf demselben Helden → Triceras gesperrt', auf(t, 'Gigantisaur Triceras') === 0, { r }); }
    { const t = await mk(); const g = t.put(seat, 0, 0, 'Gigantisaur Raptoren', { controller: opp, counters: { crossSideControlled: opp } });
      const zentral = t.engine.uebernahmeUnzulaessig(t.inst(() => false)[0] || { id: 'x', name: 'Gigantisaur Triceras', controller: seat, owner: seat }, seat, seat, 0);
      const r = await t.play(seat, 'Gigantisaur Triceras', { hero: 0, slot: 1 });
      R.check('(b) fremd kontrollierte Gigantisaur in der Zone meines Helden 0 → 2. Gigantisaur auf diesen Helden gesperrt (zentraler Prüfer sagt: ' + zentral + ')', auf(t, 'Gigantisaur Triceras') === 0, { r, owner: g.owner, controller: g.controller }); }
    { const t = await mk(); const g = t.put(opp, 0, 0, 'Gigantisaur Raptoren', { controller: seat, counters: { crossSideControlled: seat } });
      const r = await t.play(seat, 'Gigantisaur Triceras', { hero: 0, slot: 1 });
      R.check('(c) meine Gigantisaur liegt auf Held 0 der Gegenseite → zählt nicht gegen meinen Held 0: Beschwörung erlaubt', auf(t, 'Gigantisaur Triceras') === 1, { r, owner: g.owner, controller: g.controller }); }
  }
  R.finish();
})();
