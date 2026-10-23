'use strict';
// W67a-03 · Explosive Drone: Absicherung des Ist-Zustands — „defeated by an opponent's card or effect" SCHLIESST SCHADEN EIN
//
// Kartentext: „You may immediately summon this Creature as an additional Action when a target you control is defeated by an opponent's card or effect. When this Creature is defeated by an opponent's card or
//   effect, choose a target and deal 150 damage to it."
// Al (23.10.2026) hatte kurz gemeint, Schadenstode sollten nicht auslösen, und das sofort zurückgenommen: die Phrase schließt Schaden ein. KEINE Änderung an Explosive Drone; dieses Repro schreibt den Ist-Zustand fest.
//   · Auslöser (Hand) UND Detonation (Support): feuern bei Tod durch Attack-/Spell-/Creature-SCHADEN des Gegners und bei Removal-/Hero-Kill-Effekten des Gegners (Zerstören, „defeat").
//   · feuern NICHT bei: eigener Opferung, Rückstoß (eigene Quelle), Statusschaden ohne Verursacher (Quelle ohne Besitzer).
// Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const DRONE = 'Explosive Drone';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

/** Szene: Halter `s` (Drohne auf der Hand bzw. im Support), Gegner `o`. */
async function szene(s, o2, auf) {
  const o = 1 - s;
  const hand = [[], []]; if (auf === 'hand') hand[s] = [DRONE];
  const t = await H.fresh({ hand, deck: [Array(10).fill(H.INERT.filler), Array(10).fill(H.INERT.filler)], hp: 300, active: o });
  for (let h = 0; h < 3; h++) t.setAbilities(s, h, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.policy.confirm = true;
  t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner ?? s }) });
  t.targetFn = (v) => { const x = v.find(q => q.type === 'hero' && q.owner === o && q.heroIdx === 0); return x ? [x.id] : [v[0].id]; };
  t.o = o; t.s = s;
  return t;
}
const fragenDrone = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === DRONE).length;

// Quellen des Gegners (Besitzer o) bzw. keine/eigene
const QUELLEN = (t) => ({
  attack: { name: 'Attack', owner: t.o, controller: t.o, heroIdx: 0 },
  spell: { name: 'Fireball', owner: t.o, controller: t.o, heroIdx: 0 },
  creature: { name: 'Gegner-Kreatur', owner: t.o, controller: t.o, heroIdx: 0 },
  eigen: { name: 'Eigene Karte', owner: t.s, controller: t.s, heroIdx: 0 },
  status: { name: 'Poison' },
});

(async () => {
  const R = H.runner();
  for (const s of [0, 1]) {
    const o = 1 - s;
    R.section(`── Halter Sitz ${s} ──`);

    // ── A) Auslöser aus der Hand: eigene CREATURE stirbt ──
    for (const [wie, soll] of [['attack-Schaden', true], ['spell-Schaden', true], ['creature-Schaden', true], ['Zerstören (actionDestroyCard)', true], ['eigener Schaden (Rückstoß)', false], ['Statusschaden ohne Verursacher', false], ['eigene Opferung', false]]) {
      const t = await szene(s, o, 'hand');
      const q = QUELLEN(t);
      const opfer = t.put(s, 0, 0, H.INERT.creature); opfer.turnPlayed = 1;
      t.put(o, 0, 0, H.INERT.big);
      if (wie === 'attack-Schaden') await t.run(() => t.engine.actionDealCreatureDamage(q.attack, opfer, 5000, 'attack', { sourceOwner: o }));
      else if (wie === 'spell-Schaden') await t.run(() => t.engine.actionDealCreatureDamage(q.spell, opfer, 5000, 'fire_spell', { sourceOwner: o }));
      else if (wie === 'creature-Schaden') await t.run(() => t.engine.actionDealCreatureDamage(q.creature, opfer, 5000, 'creature', { sourceOwner: o }));
      else if (wie === 'Zerstören (actionDestroyCard)') await t.run(() => t.engine.actionDestroyCard(q.spell, opfer));
      else if (wie === 'eigener Schaden (Rückstoß)') await t.run(() => t.engine.actionDealCreatureDamage(q.eigen, opfer, 5000, 'recoil', { sourceOwner: s }));
      else if (wie === 'Statusschaden ohne Verursacher') await t.run(() => t.engine.actionDealCreatureDamage(q.status, opfer, 5000, 'status'));
      else await t.run(() => t.engine.actionDestroyCard(q.eigen, opfer, { isSacrifice: true }));
      const tot = t.inst(c => c.id === opfer.id && c.zone === 'support').length === 0;
      const da = !!t.find(DRONE, 'support');
      R.check(`[S${s}] Creature-Tod durch ${wie}: Opfer tot, Drone ${soll ? 'wird angeboten und beschworen' : 'bleibt auf der Hand (kein Angebot)'}`, tot && (soll ? (fragenDrone(t) === 1 && da) : (fragenDrone(t) === 0 && !da && t.pile(s, 'hand').includes(DRONE))) && sauber(t), { tot, f: fragenDrone(t), da });
    }

    // ── B) Auslöser aus der Hand: eigener HELD stirbt ──
    for (const [wie, soll] of [['attack-Schaden', true], ['spell-Schaden', true], ['creature-Schaden', true], ['Hero-Kill-Effekt (actionDefeatHero)', true], ['Hero-Kill-Effekt (actionDefeat, Hand of Death)', true], ['eigener Schaden (Rückstoß)', false], ['Statusschaden ohne Verursacher', false]]) {
      const t = await szene(s, o, 'hand');
      const q = QUELLEN(t);
      const held = t.hero(s, 0); held.hp = 50;
      if (wie === 'attack-Schaden') await t.run(() => t.engine.actionDealDamage(q.attack, held, 500, 'attack'));
      else if (wie === 'spell-Schaden') await t.run(() => t.engine.actionDealDamage(q.spell, held, 500, 'spell'));
      else if (wie === 'creature-Schaden') await t.run(() => t.engine.actionDealDamage(q.creature, held, 500, 'creature'));
      else if (wie === 'Hero-Kill-Effekt (actionDefeatHero)') await t.run(() => t.engine.actionDefeatHero(q.spell, held, { reason: 'Test' }));
      else if (wie === 'Hero-Kill-Effekt (actionDefeat, Hand of Death)') await t.run(() => t.engine.actionDefeat({ name: 'Hand of Death', owner: o, controller: o, heroIdx: 0 }, held, { sourceOwner: o, reason: 'Hand of Death', damageType: 'destruction_spell', wirkungsSchutz: true }));
      else if (wie === 'eigener Schaden (Rückstoß)') await t.run(() => t.engine.actionDealDamage(q.eigen, held, 500, 'recoil'));
      else await t.run(() => t.engine.actionDealDamage(q.status, held, 500, 'status'));
      const tot = held.hp <= 0;
      const da = !!t.find(DRONE, 'support');
      R.check(`[S${s}] Helden-Tod durch ${wie}: Held tot, Drone ${soll ? 'wird angeboten und beschworen' : 'bleibt auf der Hand (kein Angebot)'}`, tot && (soll ? (fragenDrone(t) === 1 && da) : (fragenDrone(t) === 0 && !da)) && sauber(t), { tot, f: fragenDrone(t), da });
    }

    // ── C) Detonation: die Drohne im Support stirbt ──
    for (const [wie, soll] of [['attack-Schaden', true], ['spell-Schaden', true], ['creature-Schaden', true], ['Zerstören (actionDestroyCard)', true], ['eigener Schaden (Rückstoß)', false], ['Statusschaden ohne Verursacher', false], ['eigene Opferung', false]]) {
      const t = await szene(s, o, 'support');
      const q = QUELLEN(t);
      const drohne = t.put(s, 0, 0, DRONE); drohne.turnPlayed = 1;
      t.put(o, 0, 0, H.INERT.big);
      const hp0 = t.hp(o, 0);
      if (wie === 'attack-Schaden') await t.run(() => t.engine.actionDealCreatureDamage(q.attack, drohne, 5000, 'attack', { sourceOwner: o }));
      else if (wie === 'spell-Schaden') await t.run(() => t.engine.actionDealCreatureDamage(q.spell, drohne, 5000, 'fire_spell', { sourceOwner: o }));
      else if (wie === 'creature-Schaden') await t.run(() => t.engine.actionDealCreatureDamage(q.creature, drohne, 5000, 'creature', { sourceOwner: o }));
      else if (wie === 'Zerstören (actionDestroyCard)') await t.run(() => t.engine.actionDestroyCard(q.spell, drohne));
      else if (wie === 'eigener Schaden (Rückstoß)') await t.run(() => t.engine.actionDealCreatureDamage(q.eigen, drohne, 5000, 'recoil', { sourceOwner: s }));
      else if (wie === 'Statusschaden ohne Verursacher') await t.run(() => t.engine.actionDealCreatureDamage(q.status, drohne, 5000, 'status'));
      else await t.run(() => t.engine.actionDestroyCard(q.eigen, drohne, { isSacrifice: true }));
      const tot = t.inst(c => c.id === drohne.id && c.zone === 'support').length === 0;
      const detoniert = t.lg('explosive_drone_detonate').length === 1 && hp0 - t.hp(o, 0) === 150;
      R.check(`[S${s}] Drohnen-Tod durch ${wie}: Drohne tot, ${soll ? 'Detonation (150 Schaden auf das gewählte Ziel)' : 'keine Detonation'}`, tot && (soll ? detoniert : (t.lg('explosive_drone_detonate').length === 0 && hp0 === t.hp(o, 0))) && sauber(t), { tot, det: t.lg('explosive_drone_detonate').length, dmg: hp0 - t.hp(o, 0) });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
