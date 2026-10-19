'use strict';
// W18b-4 · Mini-Absicherung der Bestätigungen von Al (19.10.2026, Entscheidung Welle 18), die noch kein eigenes Repro hatten. Exit 0 = Regel gilt.
//   (1) Inheritance Ceremony – Resistance am Zielhelden fängt das Verschieben von Ausrüstung NICHT ab („Nein").
//   (2) Grave Worm – löst nur aus, wenn eine EIGENE Kreatur in die EIGENE Ablage geht, in der der Wurm wartet; eine geliehene Gegnerkreatur löst nicht aus.
//   (3) Mission of the Light Brigade + Victory Phoenix Cannon – der Folgezauber ist eine „andere" Zusatzaktion: unter Mission gesperrt („Gesperrt ist korrekt").
//   (4) Ida – nur die Holy-Selection-Wahl ist abbrechbar; Laser Volley (und `actionAoeHit`) bleiben Pflichtwahl („Nein").
// Schon abgedeckt (nicht doppelt): Resistance blockt Spell-Anhänge „Ja" und Fire Bomb wird nicht geblockt „Nein" → `W16/a-2-…`; Grave Worm mit geliehener Kreatur → `C03-creatures/07`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  R.section('(1) Inheritance Ceremony vs. Resistance am Zielhelden');
  {
    const t = await H.fresh({ hand: [['Inheritance Ceremony'], []] });
    t.gs.players[0].heroes[2].hp = 0;                              // nur ein Zielheld (Held 1) ⇒ keine Heldenwahl
    t.setAbilities(0, 1, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    t.put(0, 0, 0, 'Club of Gobbo');
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip').map(v => v.id);
    const r = await t.play(0, 'Inheritance Ceremony', { hero: 0 });
    const aufH1 = (t.gs.players[0].supportZones[1] || []).flat().includes('Club of Gobbo');
    const aufH0 = (t.gs.players[0].supportZones[0] || []).flat().includes('Club of Gobbo');
    R.check('Inheritance Ceremony gespielt', r === true && !t.pile(0, 'hand').includes('Inheritance Ceremony'), { r, hand: t.pile(0, 'hand') });
    R.check('Club of Gobbo ist trotz Resistance Lv3 am Zielhelden auf Held 1 umgehängt', aufH1 && !aufH0, { aufH1, aufH0 });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(2) Grave Worm: eigene Kreatur in die eigene Ablage löst aus, geliehene Gegnerkreatur nicht');
  {
    const t = await H.fresh({ discard: [['Grave Worm'], []], deck: [['Fireball', 'Slow', 'Fireball', 'Slow'], []] });
    t.grantFor(0, 0, 'Grave Worm');
    const x = t.put(0, 0, 1, H.INERT.frail); x.turnPlayed = 1;
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, x));
    R.check('Grave Worm fragt bei eigener Kreatur in der eigenen Ablage', t.prompts.some(p => p.d.title === 'Grave Worm' || /Grave Worm/.test(p.d.title || '')), t.prompts.map(p => p.d.title));
    const worm = t.inst(c => c.name === 'Grave Worm' && c.zone === 'support');
    R.check('der Wurm steht in derselben Support Zone (Held 0, Slot 1) auf dem Brett', worm.length === 1 && worm[0].heroIdx === 0 && worm[0].zoneSlot === 1 && t.engine.physicalSide(worm[0]) === 0, worm.map(c => [c.heroIdx, c.zoneSlot]));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ discard: [['Grave Worm', H.INERT.frail], []] });
    t.grantFor(0, 0, 'Grave Worm');
    const x = t.put(1, 2, 2, H.INERT.frail); x.turnPlayed = 1;
    t.engine.actionStealCreature(0, x);
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, x));
    R.check('geliehene Gegnerkreatur stirbt (Ablage des Besitzers): Grave Worm fragt NICHT', !t.prompts.some(p => /Grave Worm/.test(p.d.title || '')), t.prompts.map(p => p.d.title));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(3) Mission + Victory Phoenix Cannon: Folgezauber ist unter Mission gesperrt');
  {
    const t = await H.fresh({ hand: [['Mission of the Light Brigade', 'Victory Phoenix Cannon', 'Meteor Crash'], []], hp: 800 });
    t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Support Magic', 'Support Magic', 'Support Magic', 'Support Magic'], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && /Victory/.test(d.title || ''), answer: () => ({ cardName: 'Meteor Crash' }) });
    t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return [v.id]; };
    t.policy.confirm = true;
    await t.play(0, 'Mission of the Light Brigade', { hero: 0, noGrant: true, phase: 3 });
    const r = await t.play(0, 'Victory Phoenix Cannon', { hero: 0, noGrant: true, keepActions: true, phase: 4 });
    R.check('VPC selbst wird als Zusatzaktion gespielt (eine Mission-Ladung verbraucht)', r === true && t.pile(0, 'discardPile').includes('Victory Phoenix Cannon') && t.gs.players[0]._missionCharges === 1, { r, ladung: t.gs.players[0]._missionCharges });
    R.check('der Folgezauber (Meteor Crash) wird unter Mission NICHT ausgespielt (bleibt auf der Hand; nur VPCs eigene 200 Schaden)', t.pile(0, 'hand').includes('Meteor Crash') && !t.pile(0, 'discardPile').includes('Meteor Crash') && t.hp(1, 0) === 600 && t.hp(0, 0) === 800, { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile'), hp1: t.hp(1, 0), hp0: t.hp(0, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(4) Ida: Laser Volley bleibt Pflichtwahl');
  {
    const t = await H.fresh({ hand: [['Laser Volley'], []], heroes: [['Ida, the Adept of Destruction', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], undefined] });
    await t.turnStart(0);
    const k = t.put(1, 0, 0, H.INERT.big);
    let cfg = null;
    t.targetFn = (valid, config) => { cfg = config; return [valid[0].id]; };
    await t.play(0, 'Laser Volley', { hero: 0 });
    R.check('Idas Einzelzielwahl bei Laser Volley wurde angeboten und ist KEIN Abbruch-Fall (cancellable: false)', !!cfg && cfg.cancellable === false, cfg && cfg.cancellable);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
