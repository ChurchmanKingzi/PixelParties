'use strict';
// H04-10 · Wall Breaker General Ralzish: Kreaturen des GEGNERS in Ralzishs Support Zones werden nach Besitzer statt nach Ort gezählt,
//          und ihre Ziel-ID kollidiert mit einer Gegner-Kreatur auf der eigenen Seite des Gegners  [Stufe B]
//
// Kartentext: „Once per turn, if there are exactly 2 Creatures in this Hero's Support Zones, you may choose any card on the board that is
//   not a Hero and send it to the discard pile. You cannot choose a Creature that was summoned since the end of your last turn with this effect."
// Seitenfremde Kreaturen (Elusive Hind, Plant Golem …) liegen in der Zone des Gegners; der Skript-Vertrag setzt dabei NUR `controller` = Gegner
//   (Brettseite), `owner` bleibt der Beschwörer (siehe elusive-hind.js Kopfkommentar, `engine.physicalSide(inst)` = controller ?? owner).
// Beobachtet: `creaturesInSupport` (wall-breaker-general-ralzish.js) filtert mit `inst.owner !== ownerIdx` – die fremde Kreatur zählt nicht mit.
//   (a) 1 eigene + 1 Elusive Hind (physisch GENAU 2) → Ralzish nicht aktivierbar. (b) 2 eigene + 1 Hind (physisch 3) → Ralzish wirkt trotzdem.
//   (c) `collectTargets` baut die Ziel-ID aus `inst.owner`: der Hind (liegt bei Sitz 0, Held 0, Slot 2) bekommt dieselbe ID `equip-1-0-2` wie die echte
//       Gegner-Kreatur bei Sitz 1, Held 0, Slot 2 → die ID ist nicht eindeutig; der Hind ist faktisch nicht wählbar (und der Klick auf Sitz 0 findet keine ID).
// Ursache: wall-breaker-general-ralzish.js `creaturesInSupport` (inst.owner) und `collectTargets` (`equip-${inst.owner}-…`); statt dessen
//   `engine.physicalSide(inst)` (wie Sett, Tarleinn, Stellan).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RA = 'Wall Breaker General Ralzish';
  const heroes = [[RA, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']];
  const alt = (t, s, h, z, n) => { const i = t.put(s, h, z, n); i.turnPlayed = 1; return i; };
  async function szene(eigene) {
    const t = await H.fresh({ heroes, hand: [[], ['Elusive Hind']] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    for (let i = 0; i < eigene; i++) alt(t, 0, 0, i, H.INERT.creature);
    alt(t, 1, 0, 2, H.INERT.big);                         // Gegner-Kreatur auf der EIGENEN Seite des Gegners (Held 0, Slot 2)
    t.script.push({ match: d => d.type === 'zonePick', answer: undefined });
    await t.play(1, 'Elusive Hind', { hero: 0 });         // landet (Zonenwahl: erste freie) in Ralzishs Support Zones, controller = Sitz 0, owner = Sitz 1
    const hind = t.inst(c => c.name === 'Elusive Hind' && c.zone === 'support')[0];
    hind.turnPlayed = 1;                                  // „nicht seit Ende des letzten Zuges beschworen"
    t.reset();
    return { t, hind };
  }
  // (a) 1 eigene + Hind = physisch genau 2
  let { t, hind } = await szene(1);
  const ziele = [];
  t.targetFn = (valid) => { ziele.push(...valid.map(v => v.id)); const v = valid.find(x => x.owner === 1 && x.cardName === H.INERT.big); return v ? [v.id] : null; };
  t.gs.activePlayer = 0;
  let act = await t.activateHero(0, 0, { effect: RA });
  R.check('(a) 1 eigene + 1 fremde Kreatur in Ralzishs Zonen (physisch genau 2) → Ralzish aktivierbar', act === true && t.zone(1, 0, 2) === null, { act, hind: { o: hind.owner, c: hind.controller, h: hind.heroIdx, s: hind.zoneSlot } });
  // (b) 2 eigene + Hind = physisch 3
  ({ t, hind } = await szene(2));
  t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1 && x.cardName === H.INERT.big); return v ? [v.id] : null; };
  t.gs.activePlayer = 0;
  act = await t.activateHero(0, 0, { effect: RA });
  R.check('(b) 2 eigene + 1 fremde (physisch 3) → Ralzish NICHT aktivierbar', act !== true && t.zone(1, 0, 2) !== null, { act });
  // (c) Ziel-IDs
  ({ t, hind } = await szene(2));
  let seen = [];
  t.targetFn = (valid) => { seen = valid.map(v => v.id + ':' + v.cardName); return null; };
  t.gs.activePlayer = 0;
  await t.activateHero(0, 0, { effect: RA });
  const ids = seen.map(s => s.split(':')[0]);
  R.check('(c) Ziel-IDs der Zielliste sind eindeutig (Hind bei Sitz 0 ≠ Gegner-Kreatur bei Sitz 1 am selben Platz)', new Set(ids).size === ids.length, seen);
  R.finish();
})();
