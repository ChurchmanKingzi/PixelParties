'use strict';
// W75a-01 · Unreasonable Anger (Spell Reaction Lv1, Destruction Magic + Support Magic)
// „Play this Spell immediately when a Hero that can use this Spell is hit by an opponent's Attack, Spell or Creature effect. Until the end of your next turn, any damage the user deals to single targets is increased by 100."
const H = require('../../lib/h.js');
const CARD = 'Unreasonable Anger';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const angebot = (t) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === CARD).length;

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [['Burning Finger', 'ZZ Filler'], [CARD, 'ZZ Filler', 'Burning Finger']], deckSize: 30, gold: [100, 100], active: 0, ...(o.fresh || {}) });
  t.grantFor(0, 0, 'Burning Finger');
  t.setAbilities(1, 0, [o.schulen || ['Destruction Magic'], [], []]);   // Wirker: Held 1:0
  t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-1-0'); return h ? [h.id] : undefined; };
  t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
  return t;
}

(async () => {
  const R = H.runner();

  R.section('A · gegnerischer Spell trifft den Helden: Karte wird gewirkt, der Treffer bleibt, der Held bekommt den Buff');
  {
    const t = await aufbau();
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Angebot an den Treffer-Helden', angebot(t) === 1, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('Karte verbraucht (Ablage von Sitz 1)', t.pile(1, 'discardPile').includes(CARD), t.pile(1, 'discardPile'));
    R.check('der Treffer geht NICHT verloren (100 Schaden)', t.hp(1, 0) === hp0 - 100, [hp0, t.hp(1, 0)]);
    const b = t.gs.players[1].heroes[0].buffs?.unreasonable_anger;
    R.check('Buff am Wirker', !!b, t.gs.players[1].heroes[0].buffs);
    // gespielt im Zug des Gegners (Zug T): nächster eigener Zug = T+1, Ablauf zu Beginn von T+2 für den GEGNER (Sitz 0)
    R.check('Frist: Ablauf zu Beginn von T+2, Spielerzug des Gegners', b && b.expiresAtTurn === t.gs.turn + 2 && b.expiresForPlayer === 0, b);
    const anim = t.evs('play_zone_animation').filter(e => e.type === 'unreasonable_steam');
    R.check('Dampf-Animation am Wirker (Sitz 1, Held 0)', anim.some(e => e.owner === 1 && e.heroIdx === 0), anim);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Gegenproben: eigene Quelle, Held ohne Schule, kein Treffer');
  {
    const t = await H.fresh({ hand: [[CARD, 'Burning Finger'], []], deckSize: 30, gold: [100, 100], active: 0 });
    t.grantFor(0, 0, 'Burning Finger');
    t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
    t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-0-1'); return h ? [h.id] : undefined; };
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('eigener Spell auf den eigenen Helden: kein Angebot (Quelle ist nicht der Gegner)', angebot(t) === 0, angebot(t));
  }
  {
    const t = await aufbau({ schulen: ['Fighting'] });
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Held kann die Karte nicht wirken (keine Schule): kein Angebot, Karte bleibt auf der Hand', angebot(t) === 0 && t.pile(1, 'hand').includes(CARD), t.pile(1, 'hand'));
  }
  {
    // Support Magic reicht (zweite Schule)
    const t = await aufbau({ schulen: ['Support Magic'] });
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Support Magic 1 genügt (zwei Schulen): Angebot, Buff', angebot(t) === 1 && !!t.gs.players[1].heroes[0].buffs?.unreasonable_anger, angebot(t));
  }

  R.section('C · Der Bonus: +100 an EINEM einzelnen Ziel, nicht an Flächenschlägen, nicht an Statusticks');
  {
    const t = await aufbau();
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    t.gs.activePlayer = 1;
    t.grantFor(1, 0, 'Burning Finger');
    t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-0-0'); return h ? [h.id] : undefined; };
    const hp0 = t.hp(0, 0);
    await t.play(1, 'Burning Finger', { hero: 0, noGrant: true, active: 1 });
    R.check('Burning Finger (100) des Wirkers trifft mit +100 → 200', t.hp(0, 0) === hp0 - 200, [hp0, t.hp(0, 0)]);
    R.check('Buff bleibt (kein Verbrauch)', !!t.gs.players[1].heroes[0].buffs?.unreasonable_anger);
    // Zweiter Treffer: weiter +100
    t.resetActions(1);
    const hp1 = t.hp(0, 0);
    t.gs.players[1].hand.push('Burning Finger');
    await t.play(1, 'Burning Finger', { hero: 0, noGrant: true, active: 1, keepActions: false });
    R.check('auch der zweite Treffer bekommt +100', t.hp(0, 0) === hp1 - 200, [hp1, t.hp(0, 0)]);
  }
  {
    // Flächenschlag: Meteor Crash? nein — Cataclysm-artig: ein Held-Effekt mit 2 Zielen
    const t = await aufbau();
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    const hero = t.gs.players[1].heroes[0];
    const q = { name: 'ZZ Test', owner: 1, controller: 1, heroIdx: 0 };
    const hpA = t.hp(0, 0), hpB = t.hp(0, 1);
    await t.run(() => t.engine.dealDamageToTargets(q, [{ type: 'hero', owner: 0, heroIdx: 0 }, { type: 'hero', owner: 0, heroIdx: 1 }], { damage: 100, damageType: 'destruction_spell', sourceName: 'ZZ Test', animationType: 'none' }));
    R.check('Flächenschlag auf 2 Ziele: kein Bonus (je 100)', t.hp(0, 0) === hpA - 100 && t.hp(0, 1) === hpB - 100, [hpA - t.hp(0, 0), hpB - t.hp(0, 1)]);
    const hpC = t.hp(0, 0);
    await t.run(() => t.engine.dealDamageToTargets(q, [{ type: 'hero', owner: 0, heroIdx: 0 }], { damage: 100, damageType: 'destruction_spell', sourceName: 'ZZ Test', animationType: 'none' }));
    R.check('dasselbe auf EIN Ziel: +100', t.hp(0, 0) === hpC - 200, hpC - t.hp(0, 0));
    void hero;
  }

  R.section('D · Ablauf: bis zum Ende des nächsten eigenen Zuges (Zugbeginn des Gegners danach)');
  {
    const t = await aufbau();
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    const b = t.gs.players[1].heroes[0].buffs.unreasonable_anger;
    const T = t.gs.turn;
    // Zug T (Sitz 0) → T+1 (Sitz 1, EIGENER nächster Zug) → T+2 (Sitz 0): hier fällt der Buff
    t.gs.activePlayer = 1; t.gs.turn = T + 1;
    await t.run(() => t.engine._processBuffExpiry({}));
    R.check('im eigenen nächsten Zug (T+1) noch da', !!t.gs.players[1].heroes[0].buffs?.unreasonable_anger, t.gs.players[1].heroes[0].buffs);
    t.gs.activePlayer = 0; t.gs.turn = T + 2;
    await t.run(() => t.engine._processBuffExpiry({}));
    R.check('zu Beginn von T+2 (Zug des Gegners) abgelaufen', !t.gs.players[1].heroes[0].buffs?.unreasonable_anger, t.gs.players[1].heroes[0].buffs);
    void b;
  }

  R.section('E · Creature-Effekt trifft: auch das löst die Karte aus (Fruit Bat, Nosferapple: 150 Schaden an einem Ziel)');
  {
    const t = await H.fresh({ hand: [[], [CARD, 'ZZ Filler']], deckSize: 30, gold: [100, 100], active: 0 });
    t.setAbilities(1, 0, [['Destruction Magic'], [], []]);
    const k = t.put(0, 0, 0, 'Fruit Bat, Nosferapple');
    k.turnPlayed = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    const hp0 = t.hp(1, 0);
    t.gs.activePlayer = 0; t.phase('MAIN1');
    await t.activateCreature(0, 0, 0, {});
    R.check('Creature-Effekt des Gegners: Angebot', angebot(t) === 1, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('Treffer bleibt (150), Buff liegt am Wirker', t.hp(1, 0) === hp0 - 150 && !!t.gs.players[1].heroes[0].buffs?.unreasonable_anger, [hp0, t.hp(1, 0)]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
