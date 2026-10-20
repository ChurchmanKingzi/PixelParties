'use strict';
// W31a · Frage 4 aus W28a · Al, 22.10.2026: Forbidden Zone / `bound` („cannot perform an Action") sperrt Kreatur-Surprises? – „Nein, Creature Surprises kosten und gelten als KEINE Actions!"
// Regel: Kreatur-Surprises werden von `bound` und anderen reinen Action-Sperren NICHT gesperrt (sie kosten und zählen nicht als Aktion). Gesperrt bleiben sie, wenn dem Helden/Spieler das BESCHWÖREN
//   verboten ist: Berserk („cannot use any Spells or summon Creatures", `berserked`), spielerweite Beschwörungssperre (`summonLocked`: Living Illusion, Old Couple …) und Grinning Cat auf der Hand
//   (Al, W28a: „auch keine Creature-Surprises"). Reine Zauber-Sperren (magic_silenced/nulled/frightened) sperren Kreatur-Surprises ohnehin nicht.
// Aufbau: Sitz 0/1 hält die Surprise am Helden 0 (`_canHeroActivateSurprise`, das zentrale Tor aller Surprise-Fenster); dazu der echte Spielweg mit Pure Advantage Camel.
// Aufruf: node docs/niche-tests/repro/W31/a-04-creature-surprises-sind-keine-actions.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const KREATUR_SURPRISES = ['Pure Advantage Camel', 'Cactus Creature', 'Afflicted Vermin', 'Jumper Spider', 'Man-Eater Birds', 'Mischief Militia - Banner Bearer'];
const bau = async () => H.fresh({ hand: [[], []], deckSize: 30 });
const kann = (t, seite, hi, name, opts) => !!t.engine._canHeroActivateSurprise(seite, hi, name, opts || {});

(async () => {
  const R = H.runner();
  for (const halter of [0, 1]) for (const name of KREATUR_SURPRISES) {
    R.section(`${name} · Halter Sitz ${halter}`);
    { const t = await bau(); t.grantFor(halter, 0, name); t.heroStatus(halter, 0, 'bound');
      R.check(`${name}: gebundener Held (bound, „cannot perform an Action") → Kreatur-Surprise AKTIVIERBAR`, kann(t, halter, 0, name), null); }
    { const t = await bau(); t.grantFor(halter, 0, name); t.heroStatus(halter, 0, 'berserked');
      R.check(`${name}: Berserk-Held („cannot … summon Creatures") → NICHT aktivierbar`, !kann(t, halter, 0, name), null); }
    { const t = await bau(); t.grantFor(halter, 0, name); t.gs.players[halter].summonLocked = true;
      R.check(`${name}: spielerweite Beschwörungssperre (summonLocked) → NICHT aktivierbar`, !kann(t, halter, 0, name), null); }
    { const t = await bau(); t.grantFor(halter, 0, name); t.heroStatus(halter, 0, 'bound'); t.gs.players[halter].summonLocked = true;
      R.check(`${name}: bound UND summonLocked → NICHT aktivierbar (die Beschwörungssperre gilt weiter)`, !kann(t, halter, 0, name), null); }
  }

  // Echter Spielweg: Pure Advantage Camel (Gegner zieht ausserhalb der Resource Phase)
  for (const [status, erwartet] of [[null, true], ['bound', true], ['berserked', false]]) {
    const t = await H.fresh({ hand: [[], []], deckSize: 30, active: 0, phase: 3 });
    t.putSurprise(1, 0, 'Pure Advantage Camel'); t.grantFor(1, 0, 'Pure Advantage Camel');
    if (status) t.heroStatus(1, 0, status);
    await t.run(async () => { await t.engine.actionDrawCards(0, 1); await t.engine._flushSurpriseDrawChecks(); });
    const fenster = t.prompts.some(p => p.pi === 1 && p.d.title === 'Pure Advantage Camel');
    const liegt = t.gs.players[1].surpriseZones[0].includes('Pure Advantage Camel');
    const steht = t.inst(i => i.name === 'Pure Advantage Camel' && i.zone === 'support').length;
    R.check(`Camel / Halter-Held ${status || 'normal'}: ${erwartet ? 'Surprise löst aus, Camel steht auf dem Brett' : 'kein Fenster, Camel liegt verdeckt weiter'}`,
      erwartet ? (fenster || steht === 1) && !liegt : !fenster && liegt && steht === 0, { fenster, liegt, steht });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // Grinning Cat auf der Hand des Auslösers: nur „Grinning Cat" selbst darf beschworen werden → andere Kreatur-Surprises gesperrt (W28a, Al: „auch keine Creature-Surprises")
  { const t = await bau(); t.grantFor(0, 0, 'Pure Advantage Camel'); t.setHand(0, ['Grinning Cat']);
    R.check('Grinning Cat auf der Hand des Auslösers: Pure Advantage Camel NICHT aktivierbar', !kann(t, 0, 0, 'Pure Advantage Camel'), null);
    t.setHand(0, []);
    R.check('… ohne Grinning Cat wieder aktivierbar', kann(t, 0, 0, 'Pure Advantage Camel'), null); }
  R.finish();
})();
