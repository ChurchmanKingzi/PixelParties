'use strict';
// W75d-01 · Explosion Toss (Spell Reaction Lv1, Destruction Magic)
// „Play this card immediately when a Creature is moved from one of your Heroes' Support Zones to an opponent's Hero's Support Zone. Defeat that Creature and deal 100/200/300 damage to the opponent's Hero, depending on the Creature's level."
const H = require('../../lib/h.js');
const CARD = 'Explosion Toss';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const angebot = (t) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === CARD).length;
const auf = (t, name) => t.engine.cardInstances.some(c => c.name === name && c.zone === 'support');

async function aufbau(kreatur, o = {}) {
  const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], []], deckSize: 30, gold: [100, 100], active: 1 });
  if (!o.keineSchule) t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
  const k = t.put(0, 1, 0, kreatur); k.turnPlayed = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ optionId: 'hero-0' }) });
  return { t, k };
}
const wegnehmen = (t, k, hi = 2, slot = 1) => t.run(() => t.engine.actionTransferCreature(k, 1, hi, slot, { sourceName: 'Dark Gear', skipAnimation: true }));

(async () => {
  const R = H.runner();

  R.section('A · Level 1/2/3: Kreatur wird besiegt, der Zielzonen-Held bekommt 100/200/300');
  for (const [name, lv, dmg] of [['Cute Bird', 1, 100], ['Haressassin', 2, 200], ['Fruit Bat, Nosferapple', 3, 300]]) {
    const { t, k } = await aufbau(name);
    const hp0 = t.hp(1, 2);
    const r = await wegnehmen(t, k);
    R.check(`${name} (Lv${lv}): Angebot an den bisherigen Kontrolleur (Sitz 0)`, angebot(t) === 1 && t.prompts.some(p => p.pi === 0), t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check(`${name}: Kreatur besiegt (nicht mehr auf dem Brett)`, !auf(t, name), t.engine.cardInstances.filter(c => c.name === name).map(c => c.zone));
    R.check(`${name}: der Gastgeber-Held (1:2) erleidet ${dmg}`, t.hp(1, 2) === hp0 - dmg, [hp0, t.hp(1, 2)]);
    R.check(`${name}: Karte in der Ablage von Sitz 0`, t.pile(0, 'discardPile').includes(CARD), t.pile(0, 'discardPile'));
    R.check(`${name}: Explosion am Platz der Kreatur`, t.evs('play_zone_animation').some(e => e.type === 'explosion_toss_blast' && e.owner === 1 && e.heroIdx === 2 && e.zoneSlot === 1), t.evs('play_zone_animation').map(e => e.type));
    R.check(`${name}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit(), r });
  }

  R.section('B · Gegenproben: Held ohne Schule, Kreatur bleibt in der eigenen Seite, fremde Kreatur wird bewegt');
  {
    const { t, k } = await aufbau('Cute Bird', { keineSchule: true });
    await wegnehmen(t, k);
    R.check('ohne Destruction Magic: kein Angebot, Kreatur wechselt die Seite', angebot(t) === 0 && auf(t, 'Cute Bird'), angebot(t));
  }
  {
    // Bewegung INNERHALB der eigenen Seite zählt nicht (Zielzone gehört dem eigenen Held)
    const { t, k } = await aufbau('Cute Bird');
    await t.run(() => t.engine.actionTransferCreature(k, 0, 2, 1, { sourceName: 'Test', skipAnimation: true }));
    R.check('Umzug innerhalb der eigenen Seite: kein Angebot', angebot(t) === 0 && auf(t, 'Cute Bird'), angebot(t));
  }
  {
    // Der Gegner bewegt SEINE eigene Kreatur nach drüben: nicht „aus einer Zone EINES MEINER Helden"
    const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], []], deckSize: 30, gold: [100, 100], active: 1 });
    t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
    const k = t.put(1, 1, 0, 'Cute Bird'); k.turnPlayed = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
    await t.run(() => t.engine.actionTransferCreature(k, 0, 2, 1, { sourceName: 'Test', skipAnimation: true }));
    R.check('gegnerische Kreatur wandert zu MIR: kein Angebot (nicht aus meinen Zonen)', angebot(t) === 0, angebot(t));
  }

  R.section('C · Hot Skull Potato weitergereicht: der bisherige Halter darf Explosion Toss spielen (Schaden an den Gastgeber-Held; die Kartoffel ist „unaffected")');
  {
    const t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler', CARD], ['ZZ Filler']], deckSize: 30, gold: [100, 100], active: 0 });
    t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
    const p = t.put(0, 0, 0, 'Hot Skull Potato'); p.counters.skullCounter = 1; p.counters._cardinalImmune = 1; p.turnPlayed = 0; p.controller = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Hot Skull Potato', answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
    t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ optionId: 'hero-0' }) });
    const hpV = [0, 1, 2].map(h => t.hp(1, h));
    t.gs.activePlayer = 0;
    await t.run(async () => { await t.engine.runHooks('onTurnEnd', { turn: t.gs.turn, activePlayer: 0 }); await t.engine._runPostChainActions(); });
    const q = t.engine.cardInstances.find(c => c.name === 'Hot Skull Potato' && c.zone === 'support');
    R.check('Kartoffel wurde weitergereicht (liegt auf Sitz 1)', q && t.engine.physicalSide(q) === 1, q && t.engine.physicalSide(q));
    R.check('der bisherige Halter bekam das Angebot', angebot(t) === 1 && t.prompts.some(pr => pr.pi === 0 && pr.d && pr.d.title === CARD), t.prompts.map(pr => [pr.pi, pr.d && pr.d.title]));
    R.check('die Kartoffel steht weiter (unaffected), Karte verbraucht', !!q && t.pile(0, 'discardPile').includes(CARD), t.pile(0, 'discardPile'));
    const hpN = [0, 1, 2].map(h => t.hp(1, h));
    R.check('der Gastgeber-Held der Zielzone erlitt 100 (Kartoffel ohne Stufe zählt ≤ 1)', hpV.some((v, h) => hpN[h] === v - 100) || hpV.some((v, h) => hpN[h] < v), [hpV, hpN]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
