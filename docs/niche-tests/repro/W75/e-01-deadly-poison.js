'use strict';
// W75e-01 · "Deadly Poison" (Spell Normal Lv1, Magic Arts + Support Magic, inherente Zusatzaktion)
// „Choose a Poisoned Hero. The Poison heals that Hero instead of dealing damage to it until it is healed. It still counts as a negative status effect. This counts as an additional Action."
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

  R.section('B · Tick heilt statt zu schaden — bis das GIFT entfernt wird (nicht bis der Held voll ist)');
  {
    const t = await H.fresh({ hand: [[CARD], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 2, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    const h = t.gs.players[1].heroes[0];
    h.hp = 700;
    await tick(t, 1);
    R.check('1. Tick: +60 (700 → 760), Marke bleibt', t.hp(1, 0) === 760 && !!h.statuses.poisoned.deadly, [t.hp(1, 0), h.statuses.poisoned]);
    await tick(t, 1);
    R.check('2. Tick: gedeckelt auf die Max-HP (800), Marke bleibt', t.hp(1, 0) === 800 && !!h.statuses.poisoned?.deadly, [t.hp(1, 0), h.statuses.poisoned]);
    await tick(t, 1);
    R.check('3. Tick bei vollem Helden: weder Schaden noch Verlust der Marke', t.hp(1, 0) === 800 && !!h.statuses.poisoned?.deadly, [t.hp(1, 0), h.statuses.poisoned]);
    h.hp = 400;
    await tick(t, 1);
    R.check('Held später wieder verletzt: das Gift heilt weiter (+60)', t.hp(1, 0) === 460, t.hp(1, 0));
    R.check('Heil-Tick-Animation lief', t.evs('play_zone_animation').filter(e => e.type === 'deadly_poison_heal').length >= 3, t.evs('play_zone_animation').map(e => e.type));
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('C · weitere Stapel erhöhen nur die Heilung; entferntes Gift nimmt die Marke mit, neues Gift schadet wieder');
  {
    const t = await H.fresh({ hand: [[CARD], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    const h = t.gs.players[1].heroes[0];
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    R.check('weiterer Stapel: Marke bleibt, 2 Stapel', h.statuses.poisoned.stacks === 2 && !!h.statuses.poisoned.deadly, h.statuses.poisoned);
    h.hp = 500;
    await tick(t, 1);
    R.check('Heilung = 2 Stapel × 30 = 60', t.hp(1, 0) === 560, t.hp(1, 0));
    await t.run(() => t.engine.removeHeroStatus(1, 0, 'poisoned', {}));
    R.check('Gift entfernt (Beer/Cure/Juice): kein Gift, keine Marke', !h.statuses.poisoned, h.statuses);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    R.check('neues Gift trägt keine Marke', !!h.statuses.poisoned && !h.statuses.poisoned.deadly, h.statuses.poisoned);
    await tick(t, 1);
    R.check('neues Gift schadet wieder normal (560 → 530)', t.hp(1, 0) === 530, t.hp(1, 0));
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('D · inhärente Zusatzaktion');
  {
    const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    R.check('cardHasInherentAction = true', t.engine.cardHasInherentAction(0, 0, H.DB[CARD]) === true);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    t.gs.activePlayer = 0; t.phase('ACTION'); t.resetActions(0);
    const r = await t.play(0, CARD, { noGrant: true });
    R.check('Action Phase: gespielt, ohne dass der Held eine Aktion verbraucht', r === true && t.gs.players[0].heroesActedThisTurn.length === 0, { r, acted: t.gs.players[0].heroesActedThisTurn });
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], gold: [100, 100], active: 0 });
    t.grantFor(0, 0, CARD);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 1, appliedBy: 0 }));
    t.targetFn = (valid) => valid.filter(v => v.id === 'hero-1-0').map(v => v.id);
    const r = await t.play(0, CARD, { noGrant: true, phase: 'MAIN1' });
    R.check('Main Phase: spielbar (Zusatzaktion)', r === true && t.pile(0, 'discardPile').includes(CARD) && !!t.gs.players[1].heroes[0].statuses.poisoned.deadly, { r });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
