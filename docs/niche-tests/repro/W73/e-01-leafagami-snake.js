'use strict';
// W73e-01 · Leafagami Snake (Creature Normal Lv1, 50 HP)
// „When Abilities would be removed from Heroes you control, don't remove them and draw a card for each affected Ability instead."
const H = require('../../lib/h.js');
const CARD = 'Leafagami Snake';
const abil = (t, seat, hi) => (t.gs.players[seat].abilityZones[hi] || []).map(z => z.slice());
const gezogen = (t, seat) => t.pile(seat, 'hand').length;

(async () => {
  const R = H.runner();

  R.section('A · zerstört / bewegt: bleibt liegen, Karte gezogen');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 12 });
    t.setAbilities(0, 0, [['Fighting', 'Fighting'], ['Toughness'], []]);
    t.put(0, 1, 0, CARD);
    const inst = t.find('Toughness', 'ability');
    const vor = gezogen(t, 0);
    await t.run(() => t.engine.actionDestroyCard({ name: 'Gegnerzauber', owner: 1 }, inst));
    R.check('Ability bleibt liegen (zerstören)', abil(t, 0, 0)[1].includes('Toughness') && inst.zone === 'ability', abil(t, 0, 0));
    R.check('der Kontrolleur zieht 1 Karte', gezogen(t, 0) === vor + 1, [vor, gezogen(t, 0)]);
    R.check('Laub-Wirbel an der Ability-Zone', t.evs('play_zone_animation').some(e => e.type === 'leafagami_leaves' && e.zoneType === 'ability' && e.owner === 0 && e.heroIdx === 0 && e.zoneSlot === 1), t.evs('play_zone_animation'));
    await t.run(() => t.engine.actionMoveCard(inst, 'hand', -1, -1, { source: 'Gegner', sourceOwner: 1 }));
    R.check('Bounce auf die Hand: bleibt auch liegen, wieder +1 Karte', inst.zone === 'ability' && gezogen(t, 0) === vor + 2, [inst.zone, gezogen(t, 0)]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  {
    // Gegner ohne Schlange: wirkt normal; Schlange stumm (Frost): wirkt normal
    const t = await H.fresh({ hand: [[], []], deckSize: 12 });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    const inst = t.find('Fighting', 'ability');
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, inst));
    R.check('ohne Schlange wird die Ability abgeworfen', inst.zone !== 'ability' && t.pile(0, 'discardPile').includes('Fighting'), [inst.zone]);
    const t2 = await H.fresh({ hand: [[], []], deckSize: 12 });
    t2.setAbilities(0, 0, [['Fighting'], [], []]);
    const sn = t2.put(0, 1, 0, CARD); sn.counters.frozen = 1;
    const i2 = t2.find('Fighting', 'ability');
    await t2.run(() => t2.engine.actionDestroyCard({ name: 'x', owner: 1 }, i2));
    R.check('gefrorene Schlange schützt nicht', i2.zone !== 'ability');
  }
  {
    // Schlange des GEGNERS schützt meine Helden nicht — und seine eigenen schon
    const t = await H.fresh({ hand: [[], []], deckSize: 12 });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    t.setAbilities(1, 0, [['Toughness'], [], []]);
    t.put(1, 1, 0, CARD);
    const mein = t.find('Fighting', 'ability'), sein = t.find('Toughness', 'ability');
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, mein));
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, sein));
    R.check('Schlange des Gegners: meine Ability fällt, seine bleibt', mein.zone !== 'ability' && sein.zone === 'ability', [mein.zone, sein.zone]);
    R.check('der Gegner zog (seine Ability geschützt)', gezogen(t, 1) === 1 && gezogen(t, 0) === 0, [gezogen(t, 0), gezogen(t, 1)]);
  }

  R.section('B · eigene Kosten feuern trotzdem: Barrier of Faith, Weapon Storm');
  {
    const t = await H.fresh({ hand: [['Weapon Storm'], []], deckSize: 12 });
    t.setAbilities(0, 0, [['Fighting', 'Fighting'], ['Toughness'], []]);
    t.put(0, 1, 0, CARD);
    t.gs.players[0].heroes[0].atk = 100;
    t.script.length = 0;
    // Zielwahl der Ability-Kosten: dreimal eine Ability schicken (je Klick eine Karte), dann angreifen
    let klicks = 0;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg._abilityCost) { klicks++; if (klicks > 3) return []; const a = valid.find(v => v.type === 'ability' || v.cardName === 'Fighting' || v.cardName === 'Toughness'); return a ? [a.id] : []; }
      return valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    };
    const vor = gezogen(t, 0), hp0 = t.hp(1, 0);
    t.grantFor(0, 0, 'Weapon Storm');
    const r = await t.play(0, 'Weapon Storm', { hero: 0 });
    t.targetFn = null;
    const verblieben = abil(t, 0, 0).flat().length;
    R.check(`Weapon Storm gespielt (r=${r})`, r === true, r);
    R.check('alle drei Ability-Karten liegen noch (Fighting ×2, Toughness)', verblieben === 3, abil(t, 0, 0));
    R.check(`Schaden wie bei drei abgeworfenen Karten (40/50/60 je Karte): HP ${hp0} → ${t.hp(1, 0)}`, hp0 - t.hp(1, 0) > 0, [hp0, t.hp(1, 0)]);
    R.check(`der Spieler zog für jede betroffene Ability (+3, ohne die gespielte Karte)`, gezogen(t, 0) >= vor - 1 + 3, [vor, gezogen(t, 0)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C · Entfernung durch den Gegner: Memory Wipe (bis zu 3 Abilities nach Wahl des Opfers)');
  {
    const t = await H.fresh({ hand: [[], ['Memory Wipe']], deckSize: 12, active: 1 });
    t.setAbilities(0, 0, [['Fighting'], ['Toughness'], ['Leadership']]);
    t.put(0, 1, 0, CARD);
    t.grantFor(1, 0, 'Memory Wipe');
    let n = 0;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg._abilityCost) { n++; return n > 6 ? [] : [valid[0].id]; }
      return valid.filter(v => v.id === 'hero-0-0').map(v => v.id);
    };
    const vor = gezogen(t, 0);
    const r = await t.play(1, 'Memory Wipe', { hero: 0 });
    t.targetFn = null;
    R.check(`Memory Wipe gespielt (r=${r})`, r === true, r);
    R.check('alle drei Abilities des Opfers liegen noch', abil(t, 0, 0).flat().length === 3, abil(t, 0, 0));
    R.check('das Opfer zog für jede betroffene Ability: +3', gezogen(t, 0) === vor + 3, [vor, gezogen(t, 0)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
