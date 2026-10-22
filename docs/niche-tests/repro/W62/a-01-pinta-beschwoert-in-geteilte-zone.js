'use strict';
// W62a-01 · Pinta, the Singing Ship: die Zonenfrage der Beschwörung kennt die Alice-Teilung (Al, 22.10.2026)
//
// Kartentext Pinta: „… You may once per turn reveal the top card of your Potion Deck and immediately summon it with this Hero as an additional Action,
//   if possible. Shuffle your Potion Deck afterwards. …"
// Kartentext Alice, the Transfer Student: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone. This effect
//   persists even when this Hero is defeated and cannot be negated."
// Befund (Al): Pintas Effekt erkannte keine Zonen, in denen schon Slimes (gleichnamige Creatures) liegen: er nahm eine freie Zone, falls vorhanden, und lehnte die
//   Creature sonst als unbeschwörbar ab, obwohl dank Alice eine geteilte Zone verfügbar war. Ursache: `eligibleSummonZones` (EINE Zonenfrage aller
//   „summon … as an additional Action"-Effekte) kannte nur LEERE Zonen — der Hand-Weg (`validateActionPlay`/`doPlayCreature`) kennt `canShareInto` schon.
// Szene (je Sitz 0 und 1): Pinta = Held 0, Alice = Held 1 (Alice-Teilung ab dem Spielstart); oberste Karte des Potion Decks: Infinitely Reproducing Slime.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const PINTA = 'Pinta, the Singing Ship', ALICE = 'Alice, the Transfer Student', SLIME = 'Infinitely Reproducing Slime';
const BIG = H.INERT.big, CRE = H.INERT.creature;
const FUELLER = 'Healing Potion';

/** Brett: `zonen` = Namen je Pinta-Zone (Stapel = mehrere Namen). Optionen: alice: 'lebt' | 'tot' | 'flagge' | 'keine' | 'gegner'. */
async function brett(seat, zonen, o = {}) {
  const alice = o.alice || 'lebt';
  const eigene = [PINTA, alice === 'lebt' || alice === 'tot' ? ALICE : 'Rick, the Trigger Happy Undertaker', 'Tushu, the Knowledge Keeper'];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const potionDeck = [[], []]; potionDeck[seat] = [o.oben || SLIME, FUELLER, FUELLER, FUELLER, FUELLER];
  const t = await H.fresh({ heroes, potionDeck });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const ps = t.gs.players[seat];
  if (alice === 'flagge') ps._aliceShareActive = true;          // Alice hat das Brett verlassen: der Schalter persistiert
  else if (alice === 'keine') delete ps._aliceShareActive;
  if (alice === 'tot') ps.heroes[1].hp = 0;                      // „persists even when this Hero is defeated"
  if (alice === 'gegner') { t.gs.players[1 - seat].heroes[0] = { ...t.gs.players[1 - seat].heroes[0], name: ALICE }; }   // Alice beim GEGNER: teilt nur dessen Seite
  t.grantFor(seat, 0, o.oben || SLIME);
  zonen.forEach((namen, z) => namen.forEach((n, k) => {
    let i;
    if (k === 0) i = t.put(seat, 0, z, n);
    else { ps.supportZones[0][z].push(n); i = t.engine._trackCard(n, seat, 'support', 0, z); }
    i.turnPlayed = 1;
  }));
  t.gs.turn = 5;
  return t;
}
const zone = (t, seat, z) => t.gs.players[seat].supportZones[0][z].slice();
const instIn = (t, seat, z, nm) => t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === z && c.name === nm).length;
const ohneStapel = (t) => t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m));
const potion = (t, seat) => t.gs.players[seat].potionDeck.slice();

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const S = `Sitz ${seat}: `;

    R.section(S + 'alle drei Zonen belegt, Zone A = Slime-Stapel (×2), B und C = andere Kreaturen: Pinta beschwört den Slime in die geteilte Zone A');
    { const t = await brett(seat, [[SLIME, SLIME], [BIG], [BIG]]);
      const r = await t.activateHero(seat, 0);
      R.check('Effekt lief durch', r === true, r);
      R.check('Zone A hält jetzt DREI Slimes (Stapel wächst)', JSON.stringify(zone(t, seat, 0)) === JSON.stringify([SLIME, SLIME, SLIME]), zone(t, seat, 0));
      R.check('drei Slime-Instanzen in Zone A (jede Kopie ein eigenes Wesen)', instIn(t, seat, 0, SLIME) === 3, instIn(t, seat, 0, SLIME));
      R.check('B und C unberührt', zone(t, seat, 1).length === 1 && zone(t, seat, 2).length === 1, [zone(t, seat, 1), zone(t, seat, 2)]);
      R.check('Log: pinta_summon ok (geteilte Zone)', t.lg('pinta_summon').some(l => l.ok === true && l.shared === true) && t.lg('pinta_reveal_unsummonable').length === 0, t.lg('pinta_summon'));
      R.check('Aufdecken flog direkt auf die geteilte Zone A (mill_center_reveal dest support, Slot 0)', t.evs('mill_center_reveal').some(e => e.dest === 'support' && e.destSlotIdx === 0 && e.destHeroIdx === 0), t.evs('mill_center_reveal'));
      R.check('Potion Deck: Slime ist raus (4 Karten übrig), gemischt', potion(t, seat).length === 4 && !potion(t, seat).includes(SLIME), potion(t, seat));
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
      R.check('Zustand sauber (bis auf die Alice-Stapel)', ohneStapel(t).length === 0, ohneStapel(t)); }

    R.section(S + 'Alice ist GEFALLEN (hp 0): die Teilung persistiert, Pinta beschwört trotzdem in die geteilte Zone');
    { const t = await brett(seat, [[SLIME], [BIG], [BIG]], { alice: 'tot' });
      const r = await t.activateHero(seat, 0);
      R.check('Zone A = 2 Slimes', JSON.stringify(zone(t, seat, 0)) === JSON.stringify([SLIME, SLIME]) && r === true, { r, z: zone(t, seat, 0) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'Alice hat das Brett verlassen (nur der Schalter `_aliceShareActive` ist übrig): die Teilung gilt weiter');
    { const t = await brett(seat, [[SLIME], [BIG], [BIG]], { alice: 'flagge' });
      const r = await t.activateHero(seat, 0);
      R.check('Zone A = 2 Slimes', JSON.stringify(zone(t, seat, 0)) === JSON.stringify([SLIME, SLIME]) && r === true, { r, z: zone(t, seat, 0) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'GEGENPROBE keine gleichnamige Creature, alle Zonen voll: nicht beschwörbar (Einsatz verbraucht, Potion Deck trotzdem gemischt)');
    { const t = await brett(seat, [[BIG], [BIG], [CRE, CRE]]);
      const vorher = potion(t, seat);
      const r = await t.activateHero(seat, 0);
      R.check('nichts beschworen: Zonen unverändert', zone(t, seat, 0).length === 1 && zone(t, seat, 1).length === 1 && zone(t, seat, 2).length === 2 && instIn(t, seat, 0, SLIME) + instIn(t, seat, 1, SLIME) + instIn(t, seat, 2, SLIME) === 0, [0, 1, 2].map(z => zone(t, seat, z)));
      R.check('Log: unbeschwörbar, kein pinta_summon', t.lg('pinta_reveal_unsummonable').length === 1 && t.lg('pinta_summon').length === 0, { u: t.lg('pinta_reveal_unsummonable'), s: t.lg('pinta_summon') });
      R.check('Potion Deck gemischt und vollständig (der Slime liegt noch drin)', potion(t, seat).length === vorher.length && potion(t, seat).includes(SLIME), potion(t, seat));
      R.check('Einsatz verbraucht (zweiter Versuch im selben Zug nicht möglich)', (await t.activateHero(seat, 0)) !== true, null);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'GEGENPROBE ohne Alice (kein Alice-Held, kein Schalter): auch mit gleichnamiger Creature nicht beschwörbar');
    { const t = await brett(seat, [[SLIME], [BIG], [BIG]], { alice: 'keine' });
      const r = await t.activateHero(seat, 0);
      R.check('Zone A bleibt bei einem Slime, nichts beschworen', JSON.stringify(zone(t, seat, 0)) === JSON.stringify([SLIME]) && t.lg('pinta_summon').length === 0, { r, z: zone(t, seat, 0) });
      R.check('Log: unbeschwörbar', t.lg('pinta_reveal_unsummonable').length === 1, t.lg('pinta_reveal_unsummonable'));
      R.check('Potion Deck gemischt und vollständig', potion(t, seat).length === 5 && potion(t, seat).includes(SLIME), potion(t, seat));
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'GEGENPROBE Alice liegt beim GEGNER: sie teilt nur dessen Zonen — Pintas Seite teilt nicht');
    { const t = await brett(seat, [[SLIME], [BIG], [BIG]], { alice: 'gegner' });
      const r = await t.activateHero(seat, 0);
      R.check('Zone A bleibt bei einem Slime, nichts beschworen', JSON.stringify(zone(t, seat, 0)) === JSON.stringify([SLIME]) && t.lg('pinta_summon').length === 0, { r, z: zone(t, seat, 0) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'GEGENPROBE gemischte Zone [Slime + andere Creature]: „identical names" — keine Teilung für den Slime');
    { const t = await brett(seat, [[SLIME, BIG], [BIG], [BIG]]);
      const r = await t.activateHero(seat, 0);
      R.check('nichts beschworen, Zone A unverändert', JSON.stringify(zone(t, seat, 0)) === JSON.stringify([SLIME, BIG]) && t.lg('pinta_summon').length === 0, { r, z: zone(t, seat, 0) });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'freie Zone UND geteilte Zone: Pinta nimmt wie bisher die ERSTE FREIE Zone (keine Zonenwahl) — freie Zone C hinter dem Stapel A');
    { const t = await brett(seat, [[SLIME, SLIME], [BIG], []]);
      const r = await t.activateHero(seat, 0);
      R.check('der neue Slime steht in der freien Zone C, der Stapel A bleibt bei 2', zone(t, seat, 2).join() === SLIME && zone(t, seat, 0).length === 2 && r === true, [0, 1, 2].map(z => zone(t, seat, z)));
      R.check('keine Zonenwahl gestellt', t.prompts.filter(p => p.d.type === 'zonePick').length === 0, t.prompts.map(p => p.d.type));
      R.check('Aufdecken flog auf Zone C (Slot 2)', t.evs('mill_center_reveal').some(e => e.dest === 'support' && e.destSlotIdx === 2), t.evs('mill_center_reveal'));
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'zwei geteilte Zonen (A = 2 Slimes, B = 1 Slime), keine freie: die erste geteilte Zone nimmt ihn');
    { const t = await brett(seat, [[SLIME, SLIME], [SLIME], [BIG]]);
      const r = await t.activateHero(seat, 0);
      R.check('A = 3 Slimes, B = 1 Slime', zone(t, seat, 0).length === 3 && zone(t, seat, 1).length === 1 && r === true, [0, 1, 2].map(z => zone(t, seat, z)));
      R.check('keine Zonenwahl', t.prompts.filter(p => p.d.type === 'zonePick').length === 0, t.prompts.map(p => p.d.type));
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

    R.section(S + 'Hilfsfrage `engine.beschwoerZonenFuer`: frei vor geteilt, Gegenproben, Held-Filter');
    { const t = await brett(seat, [[SLIME, SLIME], [], [BIG]]);
      const z = t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 0 });
      R.check('Reihenfolge: freie Zone B, dann geteilte Zone A', JSON.stringify(z.map(e => [e.slotIdx, !!e.shared])) === JSON.stringify([[1, false], [0, true]]), z);
      R.check('andere Karte: nur die freie Zone', JSON.stringify(t.engine.beschwoerZonenFuer(seat, CRE, { heroIdx: 0 }).map(e => e.slotIdx)) === '[1]', t.engine.beschwoerZonenFuer(seat, CRE, { heroIdx: 0 }));
      R.check('Held ohne Zonen-Treffer (Held 1) liefert dessen drei freien Zonen, keine geteilte', t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 1 }).length === 3 && t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 1 }).every(e => !e.shared), t.engine.beschwoerZonenFuer(seat, SLIME, { heroIdx: 1 }));
      R.check('der Gegner (ohne Alice) bekommt keine geteilte Zone auf Pintas Seite', t.engine.beschwoerZonenFuer(1 - seat, SLIME, {}).every(e => !e.shared), null);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  }
  R.finish();
})();
