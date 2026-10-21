'use strict';
// W37/a-00 · Bonded Companion (alle vier): Beschwören (Hand) und Platzieren (Barker) – der Companion sperrt seine eigene Spalte nicht
// Meldung von Al (22.10.2026): „Beschwört man einen Bonded Companion, egal ob normal von der Hand oder per Barkers Effekt, stirbt sofort der zugehörige Hero und der
//   Companion geht auf die Hand."
// Kartentext: „A Hero can only have 1 "Bonded Companion" Creature in its Support Zones. … share 1 HP pool. … When this Creature leaves the board, defeat the corresponding Hero."
// Ursache (vorher): `_enforceSupportZoneLock` (onCardEnterZone) fragte `isSupportZoneLocked` ohne die eigene Instanz; die schon in der Spalte liegende Karte meldete
//   sich über `companionZonenSperre` als „weiterer Bonded Companion" -> Platzierung zurückgenommen (Karte auf die Hand) -> Abgang besiegt den Helden.
// Erwartet: Companion bleibt in seiner Support Zone, Held lebt mit voller HP, Hand ohne Companion, HP-Pool geteilt; ein ZWEITER Companion in derselben Spalte bleibt gesperrt.
// Aufruf: node docs/niche-tests/repro/W37/a-00-bonded-companion-beschwoerung-sperrt-sich-nicht-selbst.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const NAMEN = ['Bonded Companion Humby', 'Bonded Companion Mellvy', 'Bonded Companion Orphy', 'Bonded Companion Thuly'];
const lebende = (t, seat, nm) => t.engine.cardInstances.filter(c => c.name === nm && c.zone === 'support' && (c.owner === seat));
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) for (const nm of NAMEN) {
    const tag = `${nm.replace('Bonded Companion ', '')} Sitz ${seat}`;
    R.section(`${tag}: von der Hand beschworen`);
    { const t = await H.fresh({ hp: 500 });
      const r = await t.play(seat, nm, { hero: 0 });
      await wait(300);
      const c = lebende(t, seat, nm)[0];
      R.check(`${tag}: Spielzug erfolgreich`, r === true, r);
      R.check(`${tag}: Companion liegt in der Support Zone von Held 0`, !!c && c.heroIdx === 0, c && { z: c.zone, h: c.heroIdx });
      R.check(`${tag}: der Held lebt mit voller HP`, t.hp(seat, 0) === 500, t.hp(seat, 0));
      R.check(`${tag}: nicht (mehr) auf der Hand, nicht in der Ablage`, !t.pile(seat, 'hand').includes(nm) && !t.pile(seat, 'discardPile').includes(nm), { hand: t.pile(seat, 'hand'), abl: t.pile(seat, 'discardPile') });
      if (c) {
        await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1 - seat, heroIdx: 0 }, c, 100, 'spell'));
        R.check(`${tag}: HP-Pool geteilt (Schaden an der Kreatur trifft den Helden 500 -> 400)`, t.hp(seat, 0) === 400, t.hp(seat, 0));
        R.check(`${tag}: Zweiter Companion in derselben Spalte bleibt gesperrt`, t.engine.isSupportZoneLocked(seat, 0, { cardName: NAMEN.find(n => n !== nm), via: 'summon' }) === true);
        R.check(`${tag}: die Karte selbst sperrt sich nicht (instId)`, t.engine.isSupportZoneLocked(seat, 0, { cardName: nm, via: 'enter', instId: c.id }) === false);
      }
      R.check(`${tag}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }

    R.section(`${tag}: platziert wie Barker (Direkt-Platzierung + onCardEnterZone)`);
    { const t = await H.fresh({ hp: 500 });
      const ps = t.engine.gs.players[seat];
      ps.supportZones[0][1] = [nm];
      const inst = t.engine._trackCard(nm, seat, 'support', 0, 1); inst.counters.isPlacement = 1;
      await t.run(() => t.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: 0, toZoneSlot: 1, cardName: nm, owner: seat }));
      await wait(300);
      R.check(`${tag}: Platzierung bleibt bestehen`, inst.zone === 'support' && inst.heroIdx === 0, { z: inst.zone, h: inst.heroIdx });
      R.check(`${tag}: der Held lebt mit voller HP`, t.hp(seat, 0) === 500, t.hp(seat, 0));
      R.check(`${tag}: nicht auf der Hand`, !t.pile(seat, 'hand').includes(nm), t.pile(seat, 'hand'));
      R.check(`${tag}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
