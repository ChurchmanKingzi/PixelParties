'use strict';
// W17a · Gegenproben zur Ersetzen-Regel (Al, 19.10.2026): Kreaturen, die zur Beschwörung eine andere Karte aus einer Support Zone entfernen
//   (Opfer/Tribut/Rückgabe), dürfen den Platz bei vollem Brett nur einnehmen, wenn in der Zone exakt EINE Karte liegt.
//
// Al: „… mit ‚Alice, the Transfer Student' ist es möglich, dass das Entfernen einer einzelnen Creature nicht reicht, um eine Zone zu leeren,
//   also darf dieses Replacement NUR für Zonen gelten, in denen exakt eine Karte liegt."
// Szene: volles Brett; Alice teilt Zonen (zwei gleichnamige Kreaturen in EINER Zone = Stapel). Erwartung:
//   (N) alle belegten Zonen sind Stapel -> die Karte ist nicht spielbar (kein Wurfziel, Spielweg lehnt ab, Karte bleibt auf der Hand, nichts geopfert);
//   (P) eine Zone mit genau einer Karte -> dort spielbar, im Stapel nicht.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student';
const BIG = H.INERT.big;
const FX = require('path').join(__dirname, '../../../../cards/effects/');

// Karte -> Besatzung der Stapel-Zonen (Deepsea-Tausch braucht Deepsea-Kreaturen, Trex Gigantisaurs)
const KARTEN = [
  { n: 'Guardian of Teocuilatl' }, { n: 'Archer of Teocuilatl' }, { n: 'Warrior of Teocuilatl' }, { n: 'Suspicious Monster' },
  { n: 'The Egg of God' }, { n: 'Blue-Ice Dragon', opfer: 2 }, { n: 'Foresta, the Guard', opfer: 2 }, { n: 'Steam Dwarf Dragon Pilot', opfer: 2 },
  { n: 'Deepsea Bats', bewohner: 'Deepsea Zombie' }, { n: 'Gigantisaur King Trex', bewohner: 'Gigantisaur Ankylos' },
];

async function brett(karte, form) {   // form: 'N' = alle Zonen Stapel; 'P' = Held 0: Stapel / EINZEL / Stapel
  const bew = karte.bewohner || BIG;
  const t = await H.fresh({ hand: [[karte.n], []], heroes: [[ALICE, 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'], null] });
  t.gs.players[0]._aliceShareActive = true;
  for (let hi = 0; hi < 3; hi++) for (let z = 0; z < 3; z++) {
    const einzel = form === 'P' && hi === 0 && z === 1;
    const i = t.put(0, hi, z, bew); i.turnPlayed = 1;
    if (!einzel) { t.gs.players[0].supportZones[hi][z].push(bew); const j = t.engine._trackCard(bew, 0, 'support', hi, z); j.turnPlayed = 1; }
  }
  t.gs.turn = 5;
  return t;
}
const imStapel = (t) => t.gs.players[0].supportZones.flat().filter(z => z.length === 2).length;

(async () => {
  const R = H.runner();
  for (const k of KARTEN) {
    const sc = require(FX + k.n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.js');
    R.section(`${k.n} - (N) nur Stapel-Zonen`);
    { const t = await brett(k, 'N');
      const vorher = t.census();
      const ziele = typeof sc.getBouncePlacementTargets === 'function' ? (sc.getBouncePlacementTargets(t.gs, 0, t.engine) || []) : [];
      R.check('keine Wurfziele auf Stapel-Zonen', ziele.length === 0, ziele);
      R.check('Wurf auf Stapel (0,0) nicht erlaubt', !(typeof sc.canPlaceOnOccupiedSlot === 'function' && sc.canPlaceOnOccupiedSlot(t.gs, 0, 0, 0, t.engine, 0)));
      const r = await t.play(0, k.n, { hero: 0, slot: 0 });
      R.check('Spielweg lehnt ab (Karte bleibt auf der Hand, nichts geopfert, alle Stapel intakt)',
        r === false && t.pile(0, 'hand').includes(k.n) && imStapel(t) === 9, { r, hand: t.pile(0, 'hand'), stapel: imStapel(t) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(`${k.n} - (P) eine Einzel-Zone (Held 0, Platz 1)`);
    { const t = await brett(k, 'P');
      const ziele = typeof sc.getBouncePlacementTargets === 'function' ? (sc.getBouncePlacementTargets(t.gs, 0, t.engine) || []) : [];
      const stapelZiel = ziele.some(z => !(z.heroIdx === 0 && z.slotIdx === 1));
      R.check('Stapel-Zonen sind keine Wurfziele', !stapelZiel, ziele);
      R.check('Wurf auf Stapel (0,0) nicht erlaubt', !(typeof sc.canPlaceOnOccupiedSlot === 'function' && sc.canPlaceOnOccupiedSlot(t.gs, 0, 0, 0, t.engine, 0)));
      if (k.einzeln !== false) {
        t.targetFn = (valid) => { const w = valid.find(v => v.heroIdx === 0 && v.slotIdx === 1 && v.owner === 0); return [(w || valid[0]).id]; };   // Pflicht-Opfer: die Einzel-Zone
        const r = await t.play(0, k.n, { hero: 0, slot: 1 });
        const da = t.inst(c => c.name === k.n && c.zone === 'support' && c.owner === 0 && c.heroIdx === 0 && c.zoneSlot === 1);
        R.check('Wurf auf die Einzel-Zone (0,1): gespielt, die Karte steht dort', r === true && da.length === 1, { r, da: da.length, hand: t.pile(0, 'hand') });
        R.check('Stapel unberührt (bis auf das zweite Opfer der 2-Opfer-Karten)', imStapel(t) >= 8 - (k.opfer || 1) + 1, imStapel(t));
      }
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
