'use strict';
// W17a · Pollution Piranha (A01-20, Al 19.10.2026) + allgemeine Ersetzen-Regel (Alice-Gegenproben)
//
// Kartentext: „You must remove a Pollution Token from your side of the board to summon this Creature."
// Al: „Ja. Das ist eine generelle Regel für ALLE Creatures, die andere Karten in Support Zonen ersetzen. Aber ACHTUNG: Achte dabei auf
//   ‚Alice, the Transfer Student' - mit ihr ist es möglich, dass das Entfernen einer einzelnen Creature nicht reicht, um eine Zone zu leeren,
//   also darf dieses Replacement NUR für Zonen gelten, in denen exakt eine Karte liegt."
// Erwartung: bei vollem Brett nimmt die Piranha den Platz ihres Tokens ein (Zone nach Kostenzahlung frei); liegt in der Zone des Tokens
//   mehr als eine Karte, ist sie dort nicht spielbar (Pollution Tokens selbst stapeln sich unter Alice nicht - Alice teilt nur Kreaturen -; die
//   Gegenprobe baut deshalb eine Zone „Token + zweite Karte" künstlich; echte Alice-Stapel prüft a-ersetzen-alice-stapel-gegenproben.js). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student';
const PIR = 'Pollution Piranha', TOK = 'Pollution Token';
const tokens = (t, seat) => t.inst(c => c.name === TOK && c.owner === seat && c.zone === 'support').length;
const D = H.INERT.creature;

// Volles Brett (3x3 Dummies); `plan`: { 'h,z': 'token' | ['token','token'] (Stapel) } ersetzt Dummies.
async function brett(plan) {
  const t = await H.fresh({ hand: [[PIR], []], heroes: [[ALICE, 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'], null] });
  t.gs.players[0]._aliceShareActive = true;
  for (let hi = 0; hi < 3; hi++) for (let z = 0; z < 3; z++) {
    const e = plan[`${hi},${z}`];
    const namen = e == null ? [D] : (Array.isArray(e) ? e.map(x => x === 'token' ? TOK : x) : [e === 'token' ? TOK : e]);
    t.put(0, hi, z, namen[0], namen[0] === TOK ? { counters: { placedOnTurn: 1 } } : {});
    for (let k = 1; k < namen.length; k++) {                       // Alice-Stapel: weitere Kopie in dieselbe Zone
      t.gs.players[0].supportZones[hi][z].push(namen[k]);
      t.engine._trackCard(namen[k], 0, 'support', hi, z);
    }
  }
  return t;
}
const piranhaInZone = (t, hi, z) => t.inst(c => c.name === PIR && c.zone === 'support' && c.owner === 0 && c.heroIdx === hi && c.zoneSlot === z).length === 1;

(async () => {
  const R = H.runner();

  R.section('(a) volles Brett, ein einzelner Token: Piranha ersetzt ihn (Platz des Tokens)');
  { const t = await brett({ '1,2': 'token' });
    const r = await t.play(0, PIR, { hero: 1, slot: 2 });
    R.check('gespielt', r === true, r);
    R.check('Piranha steht in der Zone des Tokens (Held 1, Platz 2)', piranhaInZone(t, 1, 2));
    R.check('Token ist weg, Piranha nicht mehr auf der Hand', tokens(t, 0) === 0 && !t.pile(0, 'hand').includes(PIR), { tokens: tokens(t, 0), hand: t.pile(0, 'hand') });
    R.check('Dummies unberührt (8)', t.inst(c => c.name === D && c.zone === 'support' && c.owner === 0).length === 8);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit()); }

  R.section('(b) volles Brett, KEIN Token: nicht spielbar');
  { const t = await brett({});
    const r = await t.play(0, PIR, { hero: 0, slot: 0 });
    R.check('abgelehnt, Karte bleibt auf der Hand', r === false && t.pile(0, 'hand').includes(PIR), { r, hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('(c) Gegenprobe: Token liegt in einer Zone mit 2 Karten und ist der einzige: nicht spielbar');
  { const t = await brett({ '0,0': ['token', D] });
    R.check('Vorbedingung: Zone (0,0) trägt 2 Karten', t.gs.players[0].supportZones[0][0].length === 2);
    const sc = require('../../../../cards/effects/pollution-piranha.js');
    R.check('canPlaceOnOccupiedSlot auf den Stapel: nein', sc.canPlaceOnOccupiedSlot(t.gs, 0, 0, 0, t.engine, 0) === false);
    R.check('keine Wurfziele, kein Bypass', sc.getBouncePlacementTargets(t.gs, 0, t.engine).length === 0 && sc.canBypassFreeZoneRequirement(t.gs, 0, 0, null, t.engine) === false);
    const r = await t.play(0, PIR, { hero: 0, slot: 0 });
    R.check('abgelehnt, Karte bleibt auf der Hand, der Token bleibt', r === false && t.pile(0, 'hand').includes(PIR) && tokens(t, 0) === 1, { r, hand: t.pile(0, 'hand'), tokens: tokens(t, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('(d) Zwei-Karten-Zone UND ein einzelner Token: nur die Einzel-Zone ist ein Ziel');
  { const t = await brett({ '0,0': ['token', D], '2,1': 'token' });
    const sc = require('../../../../cards/effects/pollution-piranha.js');
    const ziele = sc.getBouncePlacementTargets(t.gs, 0, t.engine);
    R.check('einziges Ziel = (Held 2, Platz 1)', ziele.length === 1 && ziele[0].heroIdx === 2 && ziele[0].slotIdx === 1, ziele);
    const r0 = await t.play(0, PIR, { hero: 0, slot: 0 });
    R.check('Wurf auf den Stapel (0,0): abgelehnt', r0 === false && tokens(t, 0) === 2, { r0, tokens: tokens(t, 0) });
    const r = await t.play(0, PIR, { hero: 2, slot: 1 });
    R.check('Wurf auf die Einzel-Zone (2,1): gespielt, Piranha dort', r === true && piranhaInZone(t, 2, 1) && tokens(t, 0) === 1, { r, tokens: tokens(t, 0) });
    R.check('Stapel unberührt (2 Karten in (0,0))', t.gs.players[0].supportZones[0][0].length === 2);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('(e) Kontrolle: freie Zone vorhanden -> bisheriger Weg (Token irgendwo, Piranha in die freie Zone)');
  { const t = await brett({ '1,2': 'token' });
    t.gs.players[0].supportZones[2][2] = []; for (const i of t.inst(c => c.zone === 'support' && c.heroIdx === 2 && c.zoneSlot === 2)) t.engine._untrackCard(i.id);
    const r = await t.play(0, PIR, { hero: 2, slot: 2 });
    R.check('gespielt in die freie Zone, Token entfernt', r === true && piranhaInZone(t, 2, 2) && tokens(t, 0) === 0, { r, tokens: tokens(t, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.finish();
})();
