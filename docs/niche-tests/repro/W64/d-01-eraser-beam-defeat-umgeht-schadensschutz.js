'use strict';
// W64d-01 · (W66a: ZURÜCKGENOMMEN) Eraser Beam läuft wieder als 999999 Schaden durch die Schadens-Pipeline: SCHADENS-Schutz UND EFFEKT-Schutz halten ihn ab.
//   Dateiname bleibt (Verlauf); der Inhalt ist auf den Stand VOR W64a zurückgestellt. Neu seit W66a: Resistance fängt das Helden-„defeat" ab (Al: „JEDE Form von defeat").
//   Die ursprüngliche W64a-Auslegung („defeat umgeht Schadensimmunität", Al 23.10.) beruhte auf einer Verwechslung — Al meinte Hand of Death (siehe W66/a-01 … a-04).
//
// Kartentext Eraser Beam: „This must be the only Spell you play this turn. Place 3 Pollution Tokens into your free Support Zones to use this Spell. Choose a target
//   your opponent controls and defeat it. This Spell can never hit more than 1 target. You can only play 1 "Eraser Beam" per game."
// Al (23.10.2026): „Ja, 'defeat' umgeht Schadensimmunität, das ist ein Kill via Effekt statt via Schaden."
// Vorher (W63b-Auslegung): Eraser Beam lief als 999999 Schaden durch die Schadens-Pipeline — Inyas „takes no damage" (lebender Fantasy Buddy), Immortal, Carris,
//   Storm Piano (`damage_proof`), The Egg of God („damage negated"), Resilient Monkee hielten ihn ab. Jetzt: SCHADENS-Schutz greift NICHT; EFFEKT-Schutz (Erstrunden-Schutz,
//   Resistance, Anti Magic, Charmed/Submerged/Petrified, Zielschutz, Cardinal/Time-Bomblebee-Immunität, „would be defeated"-Reaktionen) greift weiter.
// Szene (je Sitz): Wirker: Held 0/1 neutral, Held 2 neutral; Gegner: Held 0 = Ziel (je Fall), Held 1/2 neutral (andere Ziele für Submerged), Ziel-Kreatur in Zone (0,0).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const EB = 'Eraser Beam', IN = 'Card Game Player Inya', CARRIS = 'Carris, the Time Keeper';

async function lauf(seat, fall) {
  const opp = 1 - seat;
  const eigene = [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const gegner = [fall.held || H.BLANK_HEROES_B[0], H.BLANK_HEROES_B[1], H.BLANK_HEROES_B[2]];
  const heroes = seat === 0 ? [eigene, gegner] : [gegner, eigene];
  const hand = [[], []]; hand[seat] = [EB, H.INERT.filler];
  const t = await H.fresh({ heroes, hand, turn: 5, active: seat });
  if (fall.kreatur) t.put(opp, 0, 0, fall.kreatur, { counters: fall.counters });
  else t.put(opp, 0, 0, H.INERT.creature);   // Held-Fälle: irgendeine Kreatur, damit die Zielwahl Alternativen hat
  const h0 = t.gs.players[opp].heroes[0];
  if (fall.prep) fall.prep(t, opp, seat);
  t.targetFn = (v) => {
    const x = fall.kreatur ? v.find(q => q.owner === opp && q.type === 'equip' && q.slotIdx === 0) : v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0);
    return x ? [x.id] : undefined;
  };
  const kontrolle = fall.kontrolle ? await fall.kontrolle(t, opp, seat) : null;
  const r = await t.play(seat, EB, { hero: 2 });
  const inst = fall.kreatur ? t.inst(c => c.zone === 'support' && c.owner === opp && c.heroIdx === 0 && c.zoneSlot === 0)[0] : null;
  const tot = fall.kreatur ? (!inst || inst.zone !== 'support') : h0.hp <= 0;
  return { t, r, opp, seat, h0, inst, tot, kontrolle };
}

// Schadens-Schutz: Eraser Beam läuft als Schaden → der Schutz hält ihn ab, das Ziel überlebt (W66a: wie vor W64a)
const schaden = {
  'Inya mit lebendem Fantasy Buddy („takes no damage")': { held: IN, prep: (t, opp) => { t.put(opp, 0, 1, 'Fireball', { counters: { _fantasyBuddyToken: true, currentHp: 10, maxHp: 10, _cardDataOverride: { ...H.DB['Fireball'], name: 'Fantasy Buddy Token', cardType: 'Creature/Token', subtype: 'Token', hp: 10 } } }); },
    kontrolle: async (t, opp, seat) => { const n0 = t.hp(opp, 0); await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: seat, heroIdx: 0, heroOwner: seat }, t.hero(opp, 0), 50, 'physical')); return t.hp(opp, 0) === n0; } },
  'Held mit Immortal (HP-Boden)': { prep: (t, opp) => { t.hero(opp, 0).buffs = { immortal: { turns: 9 } }; },
    kontrolle: async (t, opp, seat) => { await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: seat, heroIdx: 0, heroOwner: seat }, t.hero(opp, 0), 5000, 'physical')); const ok = t.hp(opp, 0) === 1; t.hero(opp, 0).hp = 800; return ok; } },
  'Held mit Storm-Piano-Status damage_proof': { prep: (t, opp) => { t.heroStatus(opp, 0, 'damage_proof'); },
    kontrolle: async (t, opp, seat) => { const n0 = t.hp(opp, 0); await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: seat, heroIdx: 0, heroOwner: seat }, t.hero(opp, 0), 50, 'physical')); return t.hp(opp, 0) === n0; } },
  'Carris (Schaden wird 0)': { held: CARRIS,
    kontrolle: async (t, opp, seat) => { const n0 = t.hp(opp, 0); await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: seat, heroIdx: 0, heroOwner: seat }, t.hero(opp, 0), 50, 'physical')); return t.hp(opp, 0) === n0; } },
  'Held mit Schadens-Multiplikator 0 (Cloudy-Bauart)': { prep: (t, opp) => { t.hero(opp, 0).buffs = { cloudy_test: { damageMultiplier: 0 } }; },
    kontrolle: async (t, opp, seat) => { const n0 = t.hp(opp, 0); await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: seat, heroIdx: 0, heroOwner: seat }, t.hero(opp, 0), 50, 'physical')); return t.hp(opp, 0) === n0; } },
  'The Egg of God („damage this Creature takes is negated")': { kreatur: 'The Egg of God',
    kontrolle: async (t, opp, seat) => { const i = t.inst(c => c.zone === 'support' && c.owner === opp && c.zoneSlot === 0)[0]; await t.run(() => t.engine.processCreatureDamageBatch([{ inst: i, amount: 999, type: 'physical', source: { name: 'X', owner: seat, heroIdx: 0, heroOwner: seat }, sourceOwner: seat, canBeNegated: true, isStatusDamage: false, animType: null }])); return i.zone === 'support'; } },
  'Resilient Monkee (Schadensschild bis zum nächsten Zug)': { kreatur: H.INERT.big, counters: { _monkeeShieldUntilTurn: 99 },
    kontrolle: async (t, opp, seat) => { const i = t.inst(c => c.zone === 'support' && c.owner === opp && c.zoneSlot === 0)[0]; await t.run(() => t.engine.processCreatureDamageBatch([{ inst: i, amount: 5000, type: 'physical', source: { name: 'X', owner: seat, heroIdx: 0, heroOwner: seat }, sourceOwner: seat, canBeNegated: true, isStatusDamage: false, animType: null }])); return i.zone === 'support'; } },
};
// Effekt-Schutz: wirkt weiter, das Ziel überlebt (auch auf dem alten Stand)
const effekt = {
  'Erstrunden-Schutz (Held)': { prep: (t, opp) => { t.gs.firstTurnProtectedPlayer = opp; } },
  'Erstrunden-Schutz (Kreatur)': { kreatur: H.INERT.creature, prep: (t, opp) => { t.gs.firstTurnProtectedPlayer = opp; } },
  'Anti Magic (Buff magic_immune Lv3 ≥ Eraser Beam Lv2)': { prep: (t, opp) => { t.hero(opp, 0).buffs = { magic_immune: { level: 3 } }; } },
  'Submerged (andere Ziele vorhanden)': { prep: (t, opp) => { t.hero(opp, 0).buffs = { submerged: { turns: 9 } }; } },
  'Charme Lv 3 (charmed, Kontrolle beim Wirker)': { prep: (t, opp, seat) => { t.hero(opp, 0).statuses.charmed = { controller: 1 - opp, appliedTurn: 0 }; } },
  'Versteinert (stunned + _petrified)': { prep: (t, opp) => { t.hero(opp, 0).statuses.stunned = { _petrified: true, appliedTurn: 0, duration: 9 }; } },
  'Cardinal-Beast-Kreatur (unaffected by all cards and effects)': { kreatur: H.INERT.creature, counters: { _cardinalImmune: 1 } },
  'Time Bomblebee mit Bomb Counters (_damageDestroyImmune)': { kreatur: H.INERT.creature, counters: { _damageDestroyImmune: 1 } },
};
// W66a: Resistance (Al 23.10.: „sollte JEDE Form von defeat abdecken") fängt das Helden-„defeat" von Eraser Beam ab — Lv1 die erste Karte des Zuges, Lv3 alles außer Schaden
const resist = {
  'Resistance Lv1 (erste Karte des Zuges)': { prep: (t, opp) => { t.setAbilities(opp, 0, [['Resistance'], [], []]); } },
  'Resistance Lv3 (alles außer Schaden)': { prep: (t, opp) => { t.setAbilities(opp, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]); } },
};

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    // Kontrolle ohne Schutz
    const k = await lauf(seat, {});
    R.check(`[S${seat}] Kontrolle (Held ohne Schutz): Eraser Beam besiegt den Helden`, k.r === true && k.tot, { r: k.r, hp: k.h0.hp });
    const kk = await lauf(seat, { kreatur: H.INERT.creature });
    R.check(`[S${seat}] Kontrolle (Kreatur ohne Schutz): Eraser Beam besiegt die Kreatur`, kk.r === true && kk.tot, { r: kk.r });
    for (const [name, f] of Object.entries(schaden)) {
      const s = await lauf(seat, f);
      R.check(`[S${seat}] Schadens-Schutz „${name}": die Schadens-Probe ist wirklich geschützt (Kontrolle)`, s.kontrolle === true, s.kontrolle);
      R.check(`[S${seat}] Schadens-Schutz „${name}": Eraser Beam läuft als Schaden → das Ziel überlebt, Eraser Beam ist verbraucht`, s.r === true && !s.tot && s.t.gs.players[seat]._oncePerGameUsed.has('eraserBeam'), { r: s.r, hp: s.h0.hp, inst: s.inst && s.inst.zone });
      R.check(`[S${seat}] Schadens-Schutz „${name}": keine Engine-Fehler, Zustand sauber`, s.t.errors.length === 0 && s.t.audit().length === 0, { errors: s.t.errors, audit: s.t.audit() });
    }
    for (const [name, f] of Object.entries(effekt)) {
      const s = await lauf(seat, f);
      R.check(`[S${seat}] Effekt-Schutz „${name}": das Ziel überlebt, Eraser Beam ist verbraucht`, s.r === true && !s.tot && s.t.gs.players[seat]._oncePerGameUsed.has('eraserBeam'), { r: s.r, hp: s.h0.hp, inst: s.inst && s.inst.zone });
    }
    // „Besiegt durch einen Spell" bleibt sichtbar: der Gegner kann auf die besiegte Kreatur mit Corpse Explosion reagieren (Fenster „Kreatur besiegt", auch ohne Schaden — W24a/W25a)
    {
      const opp2 = 1 - seat;
      const c = await lauf(seat, { kreatur: H.INERT.creature, prep: (t, o) => { t.setHand(o, ['Corpse Explosion']); t.grantFor(o, 0, 'Corpse Explosion'); } });
      R.check(`[S${seat}] Corpse Explosion des Gegners antwortet auf die von Eraser Beam besiegte Kreatur (Kill via Effekt zählt als „besiegt durch einen Spell"): 50 Schaden an die Helden des Wirkers`, c.tot && c.t.hp(seat, 0) === 750 && c.t.gs.players[opp2].discardPile.includes('Corpse Explosion'), { tot: c.tot, hp: c.t.hp(seat, 0), abl: c.t.gs.players[opp2].discardPile });
    }
    for (const [name, f] of Object.entries(resist)) {
      const s = await lauf(seat, f);
      R.check(`[S${seat}] Effekt-Schutz „${name}": der Held überlebt`, s.r === true && !s.tot, { r: s.r, hp: s.h0.hp });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
