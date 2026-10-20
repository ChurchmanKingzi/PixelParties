'use strict';
// W25a · N1-12 (Al 21.10.2026: „Ocean verhindert Surprises (cannot react to)"). Dark Ocean: „neither player can react to or negate the effects of their opponent's Creatures".
// Prüft: unter Dark Ocean öffnet KEINE Surprise (Booby Trap, Rolling Boulder, Frost Rune) ein Fenster gegen den Effekt einer GEGNERISCHEN Kreatur (Burning Skeleton wählt den Helden);
// Gegenproben: ohne Dark Ocean lösen sie aus; unter Dark Ocean lösen Surprises gegen einen Spell (Fireball) weiter aus; gegen die EIGENE Kreatur darf man reagieren;
// ein gewöhnliches Beschwören (Afflicted Vermin) ist kein Kreatureneffekt und lässt die Surprise weiter auslösen.
// Aufruf: node docs/niche-tests/repro/W25/a-01-dark-ocean-surprises-kreatureneffekt.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const gegenKreatur = async (surprise, ocean) => {
    const t = await H.fresh({ hand: [[], []] });
    if (ocean) t.putArea(1, 'Dark Ocean');
    t.putSurprise(1, 0, surprise); t.grantFor(1, 0, surprise);
    const sk = t.put(0, 0, 0, 'Burning Skeleton'); sk.turnPlayed = t.gs.turn - 1;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : undefined; };
    t.gs.currentPhase = 2; t.resetActions(0);
    await t.activateCreature(0, 0, 0);
    return { t, fenster: t.prompts.some(p => p.pi === 1 && p.d.title === surprise) };
  };
  for (const s of ['Booby Trap', 'Rolling Boulder', 'Frost Rune']) {
    R.section(s);
    { const { t, fenster } = await gegenKreatur(s, false);
      R.check(`${s} ohne Dark Ocean: Fenster gegen den Kreatureneffekt`, fenster, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { const { t, fenster } = await gegenKreatur(s, true);
      R.check(`${s} unter Dark Ocean: KEIN Fenster gegen den Effekt der gegnerischen Kreatur`, !fenster, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check(`${s} unter Dark Ocean: der Effekt lief (Held 1:0 verbrannt), die Surprise liegt noch verdeckt`, !!t.hero(1, 0).statuses.burned && t.gs.players[1].surpriseZones[0].length === 1, { st: t.hero(1, 0).statuses, sz: t.gs.players[1].surpriseZones[0] });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  }
  R.section('Gegenproben unter Dark Ocean');
  { // Surprise gegen einen Spell: unberührt
    const t = await H.fresh({ hand: [['Fireball'], []] });
    t.putArea(1, 'Dark Ocean');
    t.putSurprise(1, 0, 'Booby Trap'); t.grantFor(1, 0, 'Booby Trap');
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : undefined; };
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Dark Ocean: Booby Trap gegen einen Fireball löst weiter aus', t.prompts.some(p => p.pi === 1 && p.d.title === 'Booby Trap'), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  { // eigene Kreatur (direkt am Gate: oberstes Glied = Kreatureneffekt von Sitz 1 bzw. Sitz 0, Surprise gehört Sitz 1)
    const t = await H.fresh({ hand: [[], []] });
    t.putArea(1, 'Dark Ocean');
    t.putSurprise(1, 0, 'Booby Trap'); t.grantFor(1, 0, 'Booby Trap');
    t.engine._currentEffectSource = { cardName: 'Burning Skeleton', owner: 1, cardType: 'CreatureEffect', heroIdx: 0 };
    R.check('Dark Ocean: Effekt der EIGENEN Kreatur → die eigene Surprise darf reagieren', t.engine._canHeroActivateSurprise(1, 0, 'Booby Trap', {}) === true);
    t.engine._currentEffectSource = { cardName: 'Burning Skeleton', owner: 0, cardType: 'CreatureEffect', heroIdx: 0 };
    R.check('Dark Ocean: Effekt der GEGNERISCHEN Kreatur → gesperrt', t.engine._canHeroActivateSurprise(1, 0, 'Booby Trap', {}) === false);
    t.engine._currentEffectSource = { cardName: 'Fireball', owner: 0, cardType: 'Spell', heroIdx: 0 };
    R.check('Dark Ocean: Effekt eines Spells → erlaubt', t.engine._canHeroActivateSurprise(1, 0, 'Booby Trap', {}) === true);
    t.engine._currentEffectSource = null;
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  for (const ocean of [false, true]) for (const sname of ['Firewall', 'Toxic Trap']) { // Nach-Schaden-Fenster: Treffer durch den Effekt einer gegnerischen Kreatur
    const t = await H.fresh({ hand: [[], []] });
    if (ocean) t.putArea(1, 'Dark Ocean');
    t.putSurprise(1, 0, sname); t.grantFor(1, 0, sname);
    const k = t.put(0, 0, 0, H.INERT.big);
    t.engine._currentEffectSource = { cardName: H.INERT.big, owner: 0, cardType: 'CreatureEffect', heroIdx: 0, instId: k.id };
    await t.run(() => t.engine.actionDealDamage({ name: H.INERT.big, owner: 0, controller: 0, heroIdx: 0, cardType: 'Creature', counters: {}, cardInstance: k }, t.hero(1, 0), 50, 'creature'));
    t.engine._currentEffectSource = null;
    const f = t.prompts.some(p => p.pi === 1 && p.d.title === sname);
    R.check(`${sname} gegen Kreatur-Schaden (Nach-Schaden-Fenster): ${ocean ? 'unter Dark Ocean KEIN Fenster' : 'ohne Dark Ocean Fenster'}`, f === !ocean, t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // gewöhnliches Beschwören ist kein Kreatureneffekt
    const t = await H.fresh({ hand: [[], []] });
    t.setHand(0, [H.INERT.creature]);
    t.putArea(1, 'Dark Ocean');
    t.put(1, 0, 0, H.INERT.creature);
    t.putSurprise(1, 0, 'Afflicted Vermin'); t.grantFor(1, 0, 'Afflicted Vermin');
    await t.play(0, H.INERT.creature, { hero: 0 });
    R.check('Dark Ocean: Afflicted Vermin reagiert weiter auf das Beschwören', t.prompts.some(p => p.pi === 1 && p.d.title === 'Afflicted Vermin'), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  R.finish();
})();
