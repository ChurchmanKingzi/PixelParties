'use strict';
// W75e-01 · "Deadly Poison" (Spell Normal Lv1, Magic Arts + Support Magic)
// „Choose a Poisoned Hero. The Poison heals that Hero instead of dealing damage to it until it is healed. It still counts as a negative status effect."
const H = require('../../lib/h.js');
const CARD = '"Deadly Poison"';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const tick = async (t, seat) => { t.gs.activePlayer = seat; await t.run(() => t.engine.processPoisonDamage()); };

(async () => {
  const R = H.runner();

  R.section('A · spielbar nur mit einem vergifteten Helden; Wahl markiert den Giftstatus');
  {
    const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    const r0 = await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('ohne Giftopfer: nicht spielbar, Karte bleibt auf der Hand', !r0 && t.pile(0, 'hand').includes(CARD), [r0, t.pile(0, 'hand')]);
  }
  {
    const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 2, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    const st = t.gs.players[1].heroes[0].statuses.poisoned;
    R.check('Marke „deadly" liegt am Giftstatus', !!st && !!st.deadly, st);
    R.check('der Status bleibt „poisoned" (negativ, 2 Stapel)', !!st && st.stacks === 2, st);
    R.check('Animation deadly_poison_heal am Ziel', t.evs('play_zone_animation').some(e => e.type === 'deadly_poison_heal' && e.owner === 1 && e.heroIdx === 0));
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Tick heilt statt zu schaden — bis der Held voll ist; danach schadet das Gift wieder');
  {
    const t = await H.fresh({ hand: [[CARD], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 2, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    t.gs.players[1].heroes[0].hp = 700;
    await tick(t, 1);
    R.check('1. Tick: +60 (700 → 760), Marke bleibt', t.hp(1, 0) === 760 && !!t.gs.players[1].heroes[0].statuses.poisoned.deadly, [t.hp(1, 0), t.gs.players[1].heroes[0].statuses.poisoned]);
    await tick(t, 1);
    R.check('2. Tick: bis zur Max-HP (800), Marke fällt, Gift bleibt', t.hp(1, 0) === 800 && !!t.gs.players[1].heroes[0].statuses.poisoned && !t.gs.players[1].heroes[0].statuses.poisoned.deadly, [t.hp(1, 0), t.gs.players[1].heroes[0].statuses.poisoned]);
    await tick(t, 1);
    R.check('3. Tick: wieder normaler Schaden (−60)', t.hp(1, 0) === 740, t.hp(1, 0));
    R.check('Heil-Tick-Animation lief', t.evs('play_zone_animation').filter(e => e.type === 'deadly_poison_heal').length >= 3, t.evs('play_zone_animation').map(e => e.type));
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  {
    // Held beim Tick schon voll → gewöhnlicher Schadens-Tick, Marke weg
    const t = await H.fresh({ hand: [[CARD], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    await tick(t, 1);
    R.check('voller Held: normaler Tick (−30), Marke weg', t.hp(1, 0) === 770 && !t.gs.players[1].heroes[0].statuses.poisoned.deadly, [t.hp(1, 0), t.gs.players[1].heroes[0].statuses.poisoned]);
  }

  R.section('C · Heilung des Status nimmt die Marke mit; weitere Stapel erhöhen den Heilbetrag');
  {
    const t = await H.fresh({ hand: [[CARD], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    R.check('weiterer Stapel: Marke bleibt, 2 Stapel', t.gs.players[1].heroes[0].statuses.poisoned.stacks === 2 && !!t.gs.players[1].heroes[0].statuses.poisoned.deadly, t.gs.players[1].heroes[0].statuses.poisoned);
    t.gs.players[1].heroes[0].hp = 500;
    await tick(t, 1);
    R.check('Heilung = 2 Stapel × 30 = 60', t.hp(1, 0) === 560, t.hp(1, 0));
    await t.run(() => t.engine.removeHeroStatus(1, 0, 'poisoned', {}));
    R.check('Status entfernt (Cure/Juice): kein Gift, keine Marke', !t.gs.players[1].heroes[0].statuses.poisoned, t.gs.players[1].heroes[0].statuses);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
