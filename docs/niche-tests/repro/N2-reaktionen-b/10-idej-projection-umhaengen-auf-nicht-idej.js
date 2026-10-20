'use strict';
// N2-10 · Idej Projection lässt sich per Inheritance Ceremony auf einen NICHT-Idej-Helden umhängen
// Kartentext (Idej Projection): „… This Spell can only be attached to an "Idej" Hero by its own effect. When the attached Hero would take any damage, you may discard this card from that Hero to negate that damage …"
// Skriptkopf idej-projection.js: „It is only ever ATTACHED (into a Support Zone slot of an Idej Hero) by the Idej Lords' start-of-game effect or by Idej Projector."
// Vergleich: die acht Idej-Equips tragen `canEquipToHero` (_idej-shared.js Z. ~246-268: nur Idej-Helden) — Inheritance Ceremony und `engine.canEquipCardToHero` respektieren das.
// Erwartung: Inheritance Ceremony bietet die Projection nicht an bzw. verschiebt sie nicht auf einen Helden ohne den Archetyp „Idej" (wie den Idej Sword).
// Beobachtet: Die Projection steht in der Auswahlliste und liegt danach am Nicht-Idej-Helden (und schützt ihn dort wie am Idej-Helden).
// Ursache: idej-projection.js trägt kein `canEquipToHero`; inheritance-ceremony.js filtert nur über `engine.canEquipCardToHero(name, …)`.
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Idej Lord Daiyo (Held 0) trägt eine Projection und einen Idej Sword; Inheritance Ceremony auf Held 1 (kein Idej)`);
    const heroes = [null, null]; heroes[me] = ['Idej Lord Daiyo', H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
    const t = await H.fresh({ heroes, hand: me === 0 ? [['Inheritance Ceremony'], []] : [[], ['Inheritance Ceremony']], deckSize: 30 });
    t.put(me, 0, 0, 'Idej Projection'); t.put(me, 0, 1, 'Idej Sword - Kogarasu');
    t.gs.players[me].heroes[1].hp = 500;   // W24b: Fehl-HP, damit die Zeremonie (HP-Übertrag) spielbar bleibt, auch wenn keine Karte verschiebbar ist
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    let angebot = null;
    t.targetFn = (v, cfg) => {
      if (v.some(x => x.type === 'equip')) { angebot = v.map(x => x.cardName); return v.map(x => x.id); }
      return [v.find(x => x.type === 'hero' && x.heroIdx === 1).id];
    };
    const r = await t.play(me, 'Inheritance Ceremony', { hero: 0 });
    R.check('Zauber behandelt', r === true, r);
    R.check('Auswahlliste enthält den Idej Sword NICHT (Nicht-Idej-Ziel)', !(angebot || []).includes('Idej Sword - Kogarasu'), angebot);
    R.check('Auswahlliste enthält die Idej Projection nicht (nur an Idej-Helden anhängbar)', !(angebot || []).includes('Idej Projection'), angebot);
    R.check('Held 1 (kein Idej) trägt keine Idej Projection', !sup(t, me, 1).includes('Idej Projection'), { held0: sup(t, me, 0), held1: sup(t, me, 1) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
