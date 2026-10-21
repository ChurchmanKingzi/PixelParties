'use strict';
// W46a · Punkt 2 (Teil 2) · Al, 22.10.2026: „Ja, auch für Reactions gelten die Effekte von Surprises jeweils als Attacks/Spells!" (Surprise Creature-Effekte: Creature effects).
// Hier: die SURPRISE-FENSTER (Spike Trap, Bluff, Flooding, Crimson Web, Tharxian Horse, Frost Rune, Glass Wall, Booby Trap, Firewall, Toxic Trap, Spider Avalanche, Jumpscare, Mountain Tear River,
// Magic Mirror, Jumper Spider) sehen die Wahl bzw. Wirkung einer AUFLÖSENDEN Surprise nach deren cardType (Jumpscare/Booby Trap = Spell, Water Golem/Cybug ANTS = Creature effect).
// Vorher öffnete die Zielwahl ohne eigene Quelle (Jumpscare, Water Golem …) das Surprise-Fenster nicht (`_inSurpriseResolution`-Sperre, keine Quelle); die aufgeschobene Jumpscare trug keinen Träger-Helden.
// Zusätzlich: Firewall/Toxic Trap/Mountain Tear River schlagen bei einer Creature-Surprise als Angreifer NICHT auf deren Träger-Helden zurück; Jumper Spider braucht keine lebende Quelle.
// Exit 1 auf der Basis ab03cd54, Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W46/a-02-surprise-wahl-oeffnet-surprise-fenster.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

/** Szene: `me` hält die Surprise, `op` ist der Reaktor (hält die Reaktion, ist Ziel der Surprise-Wahl). */
async function szene(me, op, o = {}) {
  const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: o.active ?? op, gold: 200 });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(me, hi).atk = 100; }
  return t;
}
const HAND_REAKTIONEN = ['Invisibility Cloak', 'Future Tech Escape Device', 'Test Flight', 'Chaorc Interception', 'Anti Magic Shield', 'MOE Shield', 'Barrier of Faith', 'Divine Gift of Rain', 'Bamboo Shield', 'Cloud in a Bottle', 'Spectral Armor'];
const SURPRISE_REAKTIONEN = ['Spike Trap', 'Bluff', 'Flooding', 'Crimson Web', 'Tharxian Horse', 'Frost Rune', 'Glass Wall', 'Booby Trap', 'Firewall', 'Toxic Trap', 'Spider Avalanche', 'Jumpscare', 'Mountain Tear River', 'Magic Mirror', 'Jumper Spider'];

/** Reaktion beim Reaktor `op` einrichten; `rh` = der Held, der gewählt wird (Surprise bzw. Castling liegen dort). */
function rxSetup(t, op, R, rh = 0) {
  if (SURPRISE_REAKTIONEN.includes(R)) { t.putSurprise(op, rh, R); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, R); return; }
  if (R === 'Castling') { t.put(op, rh, 2, 'Castling'); t.grantFor(op, rh, 'Castling'); t.addHand(op, 'Knight of Kings [W]'); return; }
  t.addHand(op, R);
  for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, R, R === 'Test Flight' ? 2 : 0);
  if (R === 'Future Tech Escape Device') t.setDiscard(op, ['Future Tech Escape Device', 'Future Tech Escape Device', 'Future Tech Escape Device']);
  if (R === 'Chaorc Interception') { const c = t.put(op, 1, 0, 'Chaorc Cannon Fodder'); c.turnPlayed = 1; }
  if (R === 'Barrier of Faith') t.setAbilities(op, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Fighting'], ['Magic Arts']]);
}
/** Hat der Reaktor die Hand-Reaktion `R` angeboten bekommen? */
const hand = (t, op, R) => t.prompts.some(p => p.pi === op && p.d && p.d.title === R);
/** Hat die Surprise `R` des Reaktors aktiviert (Log `surprise_activated` des Reaktors)? */
const surp = (t, op, R) => t.logs.some(l => l.type === 'surprise_activated' && l.data.card === R && l.data.player === 'P' + (op + 1));

// ───────── Flows: die Surprise von `me` wählt/trifft den Helden `rh` des Reaktors `op` ─────────
const FLOWS = {
  /** Jumpscare (Spell-Surprise): aufgeschobene Stun-Wahl nach einem Attack von op */
  async J(me, op, R, o = {}) {
    const rh = 0;
    const t = await szene(me, op, { active: op });
    t.addHand(op, 'Attack'); t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
    const c = t.put(op, 1, 1, H.INERT.creature); c.turnPlayed = 1;
    if (R) rxSetup(t, op, R, rh);
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Jumpscare') ? [`hero-${op}-${rh}`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
    await t.play(op, 'Attack', { hero: 0 });
    return { t, rh };
  },
  /** Booby Trap mit Telekinesis (Spell-Surprise, ctx.promptDamageTarget): 100 Schaden auf einen frei gewählten Helden */
  async B(me, op, R) {
    const rh = 0;
    const t = await szene(me, op, { active: me });
    t.addHand(me, 'Telekinesis'); t.setAbilities(me, 1, [['Magic Arts'], [], []]);
    t.putSurprise(me, 0, 'Booby Trap'); t.grantFor(me, 0, 'Booby Trap');
    const c = t.put(op, 1, 1, H.INERT.creature); c.turnPlayed = 1;
    if (R) rxSetup(t, op, R, rh);
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Booby Trap') ? [`hero-${op}-${rh}`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
    await t.play(me, 'Telekinesis', { hero: 1, noGrant: true });
    return { t, rh };
  },
  /** Mountain Tear River mit Destruction Magic 3 (Spell-Surprise, promptMultiTarget): Zusatz-Brand auf Held 1 des Reaktors */
  async M(me, op, R) {
    const rh = 1;
    const t = await szene(me, op, { active: op });
    t.addHand(op, 'Attack');
    t.setAbilities(me, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
    t.putSurprise(me, 0, 'Mountain Tear River');
    if (R) rxSetup(t, op, R, rh);
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Mountain Tear River') ? [`hero-${op}-${rh}`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
    await t.play(op, 'Attack', { hero: 0 });
    return { t, rh };
  },
  /** Water Golem (Creature-Surprise): wählt NACH der Platzierung ein Ziel des Gegners (Hook `onSurpriseCreaturePlaced`) */
  async W(me, op, R) {
    const rh = 0;
    const t = await szene(me, op, { active: op });
    t.putSurprise(me, 0, 'Water Golem'); t.grantFor(me, 0, 'Water Golem');
    const c = t.put(op, 1, 1, H.INERT.creature); c.turnPlayed = 1;
    if (R) rxSetup(t, op, R, rh);
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Water Golem') ? [`hero-${op}-${rh}`] : [(v.find(x => !x.ineligible) || v[0]).id];
    await t.run(() => t.engine._activateSurprise(me, 0, 'Water Golem', { cardName: 'x', owner: op, heroIdx: 0 }, loadCardEffect('Water Golem')));
    return { t, rh };
  },
  /** Cybug ANTS (Creature-Surprise, ctx.promptDamageTarget): derselbe Schaden auf ein Ziel des Gegners (Kreatur noch in der Surprise Zone) */
  async A(me, op, R) {
    const rh = 0;
    const t = await szene(me, op, { active: op });
    t.putSurprise(me, 0, 'Cybug ANTS'); t.grantFor(me, 0, 'Cybug ANTS'); t.addHand(me, 'Future Tech Gun');
    const c = t.put(op, 1, 1, H.INERT.creature); c.turnPlayed = 1;
    if (R) rxSetup(t, op, R, rh);
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Cybug ANTS') ? [`hero-${op}-${rh}`] : [(v.find(x => !x.ineligible) || v[0]).id];
    await t.run(() => t.engine._activateSurprise(me, 0, 'Cybug ANTS', { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect('Cybug ANTS')));
    return { t, rh };
  },
};
const ART = { J: 'Spell', B: 'Spell', M: 'Spell', W: 'Creature', A: 'Creature' };

// Erwartung je Surprise des Reaktors: [J, B, W, A] (1 = sie aktiviert). Quelle der Wahrheit: der Kartentext der Surprise.
//   J/B = Spell-Surprise (Jumpscare-Stun-Wahl / Booby Trap mit Telekinesis: 100 Schaden), W = Water Golem (Creature effect, Golem steht schon auf dem Brett: wählt ein Ziel),
//   A = Cybug ANTS (Creature effect, Schaden; die Kreatur liegt noch in ihrer Surprise Zone).
//   • „chosen by an Attack or Spell" (Spike Trap, Bluff, Flooding, Crimson Web, Tharxian Horse; Magic Mirror: „hit by a Spell") → nur Spell-Quellen.
//   • „Attack, Spell or Creature effect" (Frost Rune, Glass Wall, Booby Trap, Firewall, Toxic Trap, Spider Avalanche, Jumpscare, Mountain Tear River, Jumper Spider) → alle drei Arten;
//     Surprises, die „den Angreifer" treffen (Frost Rune, Booby Trap, Firewall, Toxic Trap, Mountain Tear River), brauchen einen Angreifer AUF DEM BRETT — die Cybug ANTS liegt noch in der Surprise Zone,
//     also lösen sie dort nicht aus (und treffen NICHT ersatzweise ihren Träger-Helden); Glass Wall (Negation), Spider Avalanche, Jumpscare und Jumper Spider brauchen keinen Angreifer.
const ERWARTUNG = {
  'Spike Trap':          [1, 1, 0, 0],
  'Bluff':               [1, 1, 0, 0],
  'Flooding':            [1, 1, 0, 0],
  'Crimson Web':         [1, 1, 0, 0],
  'Tharxian Horse':      [1, 1, 0, 0],
  'Magic Mirror':        [1, 1, 0, 0],
  'Frost Rune':          [1, 1, 1, 0],
  'Glass Wall':          [1, 1, 1, 1],
  'Booby Trap':          [1, 1, 1, 0],
  'Firewall':            [1, 1, 1, 0],
  'Toxic Trap':          [1, 1, 1, 0],
  'Spider Avalanche':    [1, 1, 1, 1],
  'Jumpscare':           [1, 1, 1, 1],
  'Mountain Tear River': [1, 1, 1, 0],
  'Jumper Spider':       [1, 1, 1, 1],
};
const FLOW_NAMEN = ['J', 'B', 'W', 'A'];

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} hält die Surprise, Sitz ${op} ist Reaktor (Surprise im Surprise Zone von Held 0)`);
    for (const [rk, soll] of Object.entries(ERWARTUNG)) {
      const ist = [];
      for (const fn of FLOW_NAMEN) {
        const { t } = await FLOWS[fn](me, op, rk);
        ist.push(surp(t, op, rk) ? 1 : 0);
        // Crimson Web hängt sich an den Angreifer: der Zustands-Audit meldet dort schon auf der Basis eine Geister-Instanz (auch bei einem gewöhnlichen Fireball) — nur die Engine-Fehler zählen.
        if (rk === 'Crimson Web' ? t.errors.length > 0 : !sauber(t)) R.check(`${rk} × ${fn}: sauber`, false, { errors: t.errors, audit: t.audit() });
      }
      R.check(`${rk} [Jumpscare, Booby Trap TK, Water Golem, Cybug ANTS] = ${soll.join(',')}`, ist.join(',') === soll.join(','), ist.join(','));
    }

    // ── Wirkung ──
    {   // Spike Trap negiert den Stun von Jumpscare und trifft den Träger-Helden der Jumpscare (er ist „der Angreifer")
      const { t } = await FLOWS.J(me, op, 'Spike Trap');
      t.script.length = 0;
      R.check('Spike Trap × Jumpscare: der Stun ist negiert (Held 0 des Reaktors nicht betäubt)', !t.hero(op, 0).statuses.stunned, t.hero(op, 0).statuses);
      R.check('Spike Trap × Jumpscare: 200 Schaden auf den Träger-Helden der Jumpscare (Held 0 der Surprise-Seite)', t.hp(me, 0) <= 600 + 0, t.hp(me, 0));
    }
    {   // Frost Rune friert den Water Golem (Creature effect, auf dem Brett) und negiert seine Wahl
      const { t } = await FLOWS.W(me, op, 'Frost Rune');
      const golem = t.find('Water Golem', 'support');
      R.check('Frost Rune × Water Golem: der Golem ist gefroren, seine Wahl ist negiert (kein Ziel gestempelt)', !!golem && !!(golem.statuses && golem.statuses.frozen || golem.counters && golem.counters.frozen) && !(golem.counters && golem.counters._golemTarget), { st: golem && golem.statuses, c: golem && golem.counters });
    }
    {   // Firewall × Cybug ANTS: kein Treffer auf den Träger-Helden der ANTS (Held 0 von `me`)
      const { t } = await FLOWS.A(me, op, 'Firewall');
      R.check('Firewall × Cybug ANTS (Angreifer noch nicht auf dem Brett): der Träger-Held der ANTS bleibt unversehrt und unverbrannt', t.hp(me, 0) === 800 && !t.hero(me, 0).statuses.burned, { hp: t.hp(me, 0), st: t.hero(me, 0).statuses });
    }
    {   // Glass Wall (Creature effect, Stufe ≤ 1) negiert den Schaden von Cybug ANTS
      const { t } = await FLOWS.A(me, op, 'Glass Wall');
      R.check('Glass Wall × Cybug ANTS: der Schaden ist negiert (Held 0 bei 800 HP)', t.hp(op, 0) === 800, t.hp(op, 0));
    }
    {   // Gegenprobe ohne Surprise: freie Wahl, keine Reaktion
      for (const fn of FLOW_NAMEN) {
        const { t } = await FLOWS[fn](me, op, null);
        R.check(`Gegenprobe ohne Reaktor-Surprise (${fn}): kein Reaktions-Prompt an den Reaktor`, !t.prompts.some(p => p.pi === op), t.prompts.map(p => p.pi + ':' + p.d.title));
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
