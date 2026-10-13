'use strict';
// A09-16 · Pet Snake: Unter Stinky Stables wird die Zusatzbeschwörung ohne Bezahlung gewährt
// Kartentext Pet Snake: „You may heal a Poisoned Hero from its Poison to summon this Creature as an additional Action. You can only summon 1 "Pet Snake" per turn this way."
// Kartentext Stinky Stables: „While this Area remains in play, Poisoned targets cannot be healed (not their HP and not from being Poisoned)."
// Skriptkopf pet-snake.js: „If Stinky Stables is in play, poison removal is engine-blocked, so the alt summon also fails gracefully (the Area gate takes precedence)."
// Aufbau: Seed 1234. Sitz 0: Held 0 (Summoning Magic 1) mit 2 Gift-Stacks, Hand [Pet Snake], Main Phase 1. Stinky Stables liegt in der Area-Zone von Sitz 1 (Kontrolle: ohne Area).
// Schritte: Pet Snake aus der Hand beschwören (Zusatzaktion; Heilung des vergifteten Helden als Kosten).
// Erwartet: Unter Stinky Stables lässt sich das Gift nicht entfernen -> die Kosten sind nicht zahlbar -> die Zusatzbeschwörung findet nicht statt (Snake bleibt auf der Hand, kein "pet-snake-alt"-Stempel).
// Beobachtet: Der Snake wird beschworen, das Gift bleibt, das Einmal-pro-Zug "pet-snake-alt" ist gestempelt, keine Aktion verbraucht – eine Gratis-Zusatzbeschwörung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (stables) => {
    const t = await H.fresh({ hand: [['Pet Snake'], []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    await t.run(() => t.engine.addHeroStatus(0, 0, 'poisoned', { appliedBy: 1, addStacks: 2 }));
    if (stables) t.putArea(1, 'Stinky Stables');
    const r = await t.play(0, 'Pet Snake', { hero: 0, phase: 2 });
    return { r, snakeAufBrett: !!t.find('Pet Snake', 'support'), giftBleibt: !!t.gs.players[0].heroes[0].statuses.poisoned, stempel: !!(t.gs.hoptUsed || {})['pet-snake-alt:0'], aktionen: t.gs.players[0]._actionsPlayedThisPhase, errors: t.errors };
  };
  R.section('Kontrolle ohne Stinky Stables');
  const k = await lauf(false);
  R.check('Snake beschworen, Gift geheilt (Kosten bezahlt)', k.snakeAufBrett && !k.giftBleibt, k);
  R.section('Unter Stinky Stables');
  const s = await lauf(true);
  R.check('Gift bleibt -> Snake darf nicht als (bezahlte) Zusatzaktion beschworen werden', !(s.snakeAufBrett && s.giftBleibt), s);
  R.check('kein Einmal-pro-Zug-Stempel ohne bezahlte Kosten', !(s.stempel && s.giftBleibt), s);
  R.check('keine Engine-Fehler', k.errors.length === 0 && s.errors.length === 0, [k.errors, s.errors]);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
