'use strict';
// W47a · Punkte 1–3 (Absicherung, Al 22.10.2026: „Ja, das ist in Ordnung." / „Passt" / „Passt.") — der Ist-Zustand aus W46a bleibt, auch mit dem neuen Kettenfenster „performs" (Punkt 4) und der Kreaturenwahl der River (Punkt 7):
//   1 · Eine Creature-Surprise als Angreifer (noch in der Surprise Zone: Cybug ANTS) löst Booby Trap, Frost Rune, Firewall, Toxic Trap, Mountain Tear River und Fireshield NICHT aus.
//       Sie öffnet auch kein Kettenfenster „Hero performs" (Stealthy Pursuit, Arrows, Magic Topaz: nur Attack/Spell) und zählt nicht als Attack/Spell.
//   2 · Rolling Boulder gegen eine Creature-Surprise: Negation + die Creature geht in die Ablage, ohne je auf dem Brett gestanden zu haben (kein Tod-Trigger).
//   3 · Shield of Wisdom leitet nur auf Ziele um, die der Effekt wählen konnte; bei Water Golem/Cybug ANTS bleibt der Schild zu, bei Afflicted Vermin wirkt er.
// Exit 0 auf der Basis 70453312 UND auf dem Branch (Absicherung: unverändert grün).
// Aufruf: node docs/niche-tests/repro/W47/a-05-absicherung-creature-surprise-boulder-shield.js   (Exit 0 = korrekt)
const { H, loadCardEffect, szene, angeboten, surprise } = require('./_w47.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

const ERWARTUNG = {   // Surprise des Reaktors `op` an Held 0 → löst gegen eine Cybug ANTS (Creature-Surprise als Angreifer) aus? (1 = ja)
  'Booby Trap': 0, 'Frost Rune': 0, Firewall: 0, 'Toxic Trap': 0, 'Mountain Tear River': 0,
  'Glass Wall': 1, 'Spider Avalanche': 1, Jumpscare: 1, 'Jumper Spider': 1,
};
async function ants(me, op, setup) {
  const t = await szene(me, op, { active: op });
  t.putSurprise(me, 0, 'Cybug ANTS'); t.grantFor(me, 0, 'Cybug ANTS'); t.addHand(me, 'Future Tech Gun');
  if (setup) await setup(t);
  t.targetFn = (v, cfg) => (cfg && cfg.title === 'Cybug ANTS') ? [`hero-${op}-0`] : [(v.find(x => !x.ineligible) || v[0]).id];
  await t.run(() => t.engine._activateSurprise(me, 0, 'Cybug ANTS', { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect('Cybug ANTS')));
  return t;
}
async function vermin(me, op, reaktion) {
  const t = await szene(me, op, { active: op });
  t.putSurprise(me, 0, 'Afflicted Vermin'); t.grantFor(me, 0, 'Afflicted Vermin');
  if (reaktion) { t.putSurprise(op, 0, reaktion); t.grantFor(op, 0, reaktion); }
  const c = t.put(op, 0, 1, H.INERT.creature); c.turnPlayed = 1;
  const x = t.put(op, 1, 1, H.INERT.creature); x.turnPlayed = 1;
  const m2 = t.put(me, 2, 0, H.INERT.creature); m2.turnPlayed = 1;
  t.targetFn = (v, cfg) => cfg && cfg.title === 'Afflicted Vermin' ? [`equip-${op}-0-1`] : cfg && cfg.title === 'Shield of Wisdom' ? [`equip-${me}-2-0`] : [(v.find(q => !q.ineligible) || v[0]).id];
  await t.run(() => t.engine._activateSurprise(me, 0, 'Afflicted Vermin', { cardName: 'x', owner: op, heroIdx: 0, cardInstance: x }, loadCardEffect('Afflicted Vermin')));
  return { t, c, m2 };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} hält die Creature-Surprise, Sitz ${op} den Schutz`);
    // ── Punkt 1 ──
    for (const [s, soll] of Object.entries(ERWARTUNG)) {
      const t = await ants(me, op, (t) => { t.putSurprise(op, 0, s); t.grantFor(op, 0, s); });
      R.check(`Cybug ANTS (Creature-Surprise) × ${s}: ${soll ? 'löst aus' : 'löst NICHT aus (kein Angreifer auf dem Brett)'}`, surprise(t, op, s) === !!soll, { aktiv: surprise(t, op, s) });
    }
    {
      const t = await ants(me, op, (t) => { t.addHand(op, 'Fireshield'); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Fireshield'); });
      R.check('Cybug ANTS × Fireshield (Hand): kein Angebot, kein Rückstoß auf den Träger-Helden der ANTS', !angeboten(t, op, 'Fireshield') && t.hp(me, 0) === 800, { ang: angeboten(t, op, 'Fireshield'), hp: t.hp(me, 0) });
    }
    {   // kein Kettenfenster „performs", kein Zählen
      const t = await ants(me, op, (t) => { for (const r of ['Stealthy Pursuit', 'Angelfeather Arrow', 'Magic Topaz']) { t.addHand(me, r); for (let hi = 0; hi < 3; hi++) t.grantFor(me, hi, r); } });
      R.check('Creature-Surprise: kein Kettenfenster „performs" (Stealthy Pursuit, Arrow, Magic Topaz bleiben ungefragt), nichts gezählt', !['Stealthy Pursuit', 'Angelfeather Arrow', 'Magic Topaz'].some(n => angeboten(t, me, n)) && !(t.gs.players[me].spellsPlayedThisTurn || 0) && !(t.gs.players[me].attacksPlayedThisTurn || 0), t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    // ── Punkt 2 ──
    {
      const { t, c } = await vermin(me, op, 'Rolling Boulder');
      R.check('Rolling Boulder × Afflicted Vermin: Wahl negiert (Ziel lebt), Vermin in der Ablage seines Besitzers, nie auf dem Brett', !!t.zone(op, 0, 1) && !t.find('Afflicted Vermin', 'support') && t.pile(me, 'discardPile').includes('Afflicted Vermin'), { c: !!t.zone(op, 0, 1), d: t.pile(me, 'discardPile') });
      R.check('Rolling Boulder: kein Tod-Trigger (kein Brett-Tod der Vermin im Log), sauber', !t.logs.some(l => /creature_(died|defeated|destroyed)/.test(l.type) && l.data && l.data.card === 'Afflicted Vermin') && sauber(t), { logs: t.logs.map(l => l.type), e: t.errors, a: t.audit() });
    }
    {
      const t = await ants(me, op, (t) => { t.putSurprise(op, 0, 'Rolling Boulder'); t.grantFor(op, 0, 'Rolling Boulder'); });
      R.check('Rolling Boulder × Cybug ANTS: Schaden negiert (800), die Cybug ist besiegt (Ablage), sauber', t.hp(op, 0) === 800 && t.pile(me, 'discardPile').includes('Cybug ANTS') && !t.find('Cybug ANTS', 'support') && sauber(t), { hp: t.hp(op, 0), d: t.pile(me, 'discardPile') });
    }
    // ── Punkt 3 ──
    {
      const { t, m2 } = await vermin(me, op, 'Shield of Wisdom');
      R.check('Shield of Wisdom × Afflicted Vermin (wählt nur Kreaturen): der Schild leitet um (m2 besiegt, c lebt)', !t.zone(me, 2, 0) && !!t.zone(op, 0, 1) && t.prompts.filter(p => p.d && p.d.title === 'Shield of Wisdom').length === 1, { m2: !!t.zone(me, 2, 0), c: !!t.zone(op, 0, 1) });
    }
    for (const s of ['Cybug ANTS', 'Water Golem']) {
      const t = await szene(me, op, { active: op });
      t.putSurprise(me, 0, s); t.grantFor(me, 0, s); t.addHand(me, 'Future Tech Gun');
      t.putSurprise(op, 0, 'Shield of Wisdom'); t.grantFor(op, 0, 'Shield of Wisdom');
      t.targetFn = (v, cfg) => (cfg && cfg.title === s) ? [`hero-${op}-0`] : [(v.find(x => !x.ineligible) || v[0]).id];
      await t.run(() => t.engine._activateSurprise(me, 0, s, { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect(s)));
      R.check(`Shield of Wisdom × ${s}: kein legales Umleitungsziel → kein Angebot, der Schild bleibt verdeckt liegen`, !t.prompts.some(p => p.d && p.d.title === 'Shield of Wisdom') && t.pile(op, 'discardPile').indexOf('Shield of Wisdom') < 0, { prompts: t.prompts.map(p => p.d.title), d: t.pile(op, 'discardPile') });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
