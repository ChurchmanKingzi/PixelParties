'use strict';
// W75 · Audit P4a · Cybug LOCUST × Darion (geteilte Equip-Zone)
// Kartentext: „Activate this Surprise when your opponent equips or attaches a card to a Hero they control by deleting 1 "Treasure Hunter's Backpack" from your hand or deck.
//   That card is equipped/attached to the user instead, then place this Creature into one of the user's free Support Zones."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet:
//   (a) Der Gegner (Darion mit Stapel Club / Blade) legt "Cute Crown" an: LOCUST löst aus, nur die Crown wandert zum Surprise-Besitzer; der Stapel [Club, Blade] bleibt unversehrt.
//   (b) Der Surprise-Besitzer hat Darion mit Stapel [Club, Blade] und nur EINE freie Zone: die umgeleitete Karte kommt in den Stapel (braucht keine freie Zone), LOCUST selbst in die freie Zone —
//       der Surprise wird angeboten (früher verlangte er immer ZWEI freie Zonen). Danach liegt [Club, Blade, Crown] im Stapel und LOCUST in der freien Zone.
//   (c) Darion OHNE Stapel und nur eine freie Zone: LOCUST bleibt aus (die Crown eröffnet den Stapel in der freien Zone, für LOCUST bleibt nichts).
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-01-cybug-locust-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', LOC = 'Cybug LOCUST', FUEL = "Treasure Hunter's Backpack", F = H.INERT.filler;
const CROWN = 'Cute Crown';
function stapel(t, seite, hi, slot, namen) {
  const ps = t.gs.players[seite]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const gefragt = (t, n) => t.prompts.some(p => new RegExp(n).test(JSON.stringify(p.d)));
(async () => {
  const R = H.runner();

  R.section('(a) Gegner mit Darion-Stapel legt die Crown an: nur die Crown wird umgeleitet');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], ['Tushu, the Knowledge Keeper', null, null]], hand: [[CROWN, F], [FUEL]], gold: 100 });
    stapel(t, 0, 0, 1, ['Club of Gobbo', 'Blade of the Frostbringer']);
    t.putSurprise(1, 0, LOC); t.grantFor(1, 0, LOC);
    await t.play(0, CROWN, { hero: 0 });
    await t.drain();
    const z0 = t.gs.players[0].supportZones[0], z1 = t.gs.players[1].supportZones[0];
    R.note('lauf', JSON.stringify({ darion: z0, locust: z1, geloescht: t.pile(1, 'deletedPile') }));
    R.check('LOCUST hat ausgeloest (Backpack geloescht)', t.pile(1, 'deletedPile').includes(FUEL) || gefragt(t, LOC), t.prompts.map(p => p.d.type));
    R.check('Die Crown liegt beim Surprise-Besitzer', z1.flat().includes(CROWN), z1);
    R.check('Darions Stapel [Club, Blade] ist unversehrt', JSON.stringify(z0[1]) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer']), z0);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('(b) Surprise-Besitzer ist Darion mit Stapel und nur EINER freien Zone: LOCUST darf trotzdem');
  {
    const t = await H.fresh({ active: 0, heroes: [['Tushu, the Knowledge Keeper', null, null], [D, 'Tushu, the Knowledge Keeper', null]], hand: [[CROWN, F], [FUEL]], gold: 100 });
    stapel(t, 1, 0, 0, ['Club of Gobbo', 'Blade of the Frostbringer']);
    t.put(1, 0, 1, H.INERT.creature);          // Zone 1 belegt, Zone 2 frei
    t.putSurprise(1, 0, LOC); t.grantFor(1, 0, LOC);
    await t.play(0, CROWN, { hero: 0 });
    await t.drain();
    const z1 = t.gs.players[1].supportZones[0];
    R.note('lauf', JSON.stringify({ darion: z1, geloescht: t.pile(1, 'deletedPile'), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('LOCUST hat ausgeloest (Backpack geloescht)', t.pile(1, 'deletedPile').includes(FUEL), t.pile(1, 'deletedPile'));
    R.check('Die Crown liegt oben auf Darions Stapel: [Club, Blade, Crown]', JSON.stringify(z1[0]) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer', CROWN]), z1);
    R.check('LOCUST steht in der freien Zone 2', z1[2].includes(LOC), z1);
    R.check('Beim Gegner (Sitz 0) liegt keine Crown mehr', !t.gs.players[0].supportZones[0].flat().includes(CROWN), t.gs.players[0].supportZones[0]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('(c) Darion OHNE Stapel, nur eine freie Zone: LOCUST bleibt aus');
  {
    const t = await H.fresh({ active: 0, heroes: [['Tushu, the Knowledge Keeper', null, null], [D, 'Tushu, the Knowledge Keeper', null]], hand: [[CROWN, F], [FUEL]], gold: 100 });
    t.put(1, 0, 0, H.INERT.creature); t.put(1, 0, 1, H.INERT.creature);
    t.putSurprise(1, 0, LOC); t.grantFor(1, 0, LOC);
    await t.play(0, CROWN, { hero: 0 });
    await t.drain();
    R.check('LOCUST loest nicht aus (Backpack bleibt)', !t.pile(1, 'deletedPile').includes(FUEL), t.pile(1, 'deletedPile'));
    R.check('Die Crown bleibt beim Spieler', t.gs.players[0].supportZones[0].flat().includes(CROWN), t.gs.players[0].supportZones[0]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
