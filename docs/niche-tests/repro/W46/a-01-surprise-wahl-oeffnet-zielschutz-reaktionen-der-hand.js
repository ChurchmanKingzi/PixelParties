'use strict';
// W46a · Punkt 2 (Teil 1) · Al, 22.10.2026: „Ja, auch für Reactions gelten die Effekte von Surprises jeweils als Attacks/Spells!" (Surprise Creature-Effekte: Creature effects).
// Die Wahl einer AUFLÖSENDEN Surprise gilt für ALLE Fenster nach cardType als Attack (Bluff …), Spell (Gold Trap, Jumpscare, Booby Trap, Mountain Tear River …) oder Creature effect (Water Golem, Cybug ANTS …) —
// nicht nur für Umleiter und Taunt (W43a–W45a). Hier: die ZIELSCHUTZ-REAKTIONEN AUS DER HAND und die Brett-Reaktion Castling (Post-Target-Fenster).
// Regel: `promptEffectTarget`/`_zielwahlAbschliessen` nennt die auflösende Surprise (`_surpriseQuelleFuer`, auch im Hook `onSurpriseCreaturePlaced`) als Quelle ALLER Fenster; die Reaktionen lesen den Kartentyp bzw.
// Schadenstyp der Quelle wie bei jeder Karte. Quelle vom nicht abgedeckten Typ → keine Reaktion; ohne Reaktionskarte freie Wahl.
// Exit 1 auf der Basis ab03cd54 (die Wahl von Jumpscare, Gold Trap, Water Golem … öffnete die Zielschutz-Fenster nicht), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W46/a-01-surprise-wahl-oeffnet-zielschutz-reaktionen-der-hand.js   (Exit 0 = korrekt)
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

// Erwartung je Reaktion: [J, B, M, W, A] (1 = die Reaktion wird angeboten). Quelle der Wahrheit: der Kartentext der Reaktion.
//   J/B/M = Spell-Surprise (Jumpscare / Booby Trap mit Telekinesis / Mountain Tear River), W/A = Creature-Surprise (Water Golem / Cybug ANTS).
//   Attack-/Spell-Reaktionen (Cloak, Escape Device, Test Flight, Anti Magic Shield [nur Spell], MOE Shield [nur Spell]) bleiben für Creature-Quellen zu;
//   „Attack, Spell or Creature effect" (Chaorc Interception) und „card or effect" (Barrier of Faith, Divine Gift of Rain, Castling) sehen beide Arten;
//   Schadensminderer (Bamboo Shield, Cloud in a Bottle, Spectral Armor: „takes damage") nur, wenn die Wahl Schaden macht (Booby Trap, Cybug ANTS).
const ERWARTUNG = {
  'Invisibility Cloak':        [1, 1, 1, 0, 0],
  'Future Tech Escape Device': [1, 1, 1, 0, 0],
  'Test Flight':               [1, 1, 1, 0, 0],
  'Chaorc Interception':       [1, 1, 1, 1, 1],
  'Anti Magic Shield':         [1, 1, 1, 0, 0],
  'MOE Shield':                [1, 1, 1, 0, 0],
  'Barrier of Faith':          [1, 1, 1, 1, 1],
  'Divine Gift of Rain':       [1, 1, 1, 1, 1],
  'Castling':                  [1, 1, 1, 1, 1],
  'Bamboo Shield':             [0, 1, 0, 0, 1],
  'Cloud in a Bottle':         [0, 1, 0, 0, 1],
  'Spectral Armor':            [0, 1, 0, 0, 1],
};
const FLOW_NAMEN = ['J', 'B', 'M', 'W', 'A'];

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} hält die Surprise, Sitz ${op} ist Reaktor`);
    const ist = {};
    for (const [rk, soll] of Object.entries(ERWARTUNG)) {
      ist[rk] = [];
      for (let i = 0; i < FLOW_NAMEN.length; i++) {
        const fn = FLOW_NAMEN[i];
        const { t } = await FLOWS[fn](me, op, rk);
        const fired = rk === 'Castling' ? hand(t, op, 'Castling') : hand(t, op, rk);
        ist[rk].push(fired ? 1 : 0);
        if (!sauber(t)) R.check(`${rk} × ${fn}: sauber`, false, { errors: t.errors, audit: t.audit() });
      }
      R.check(`${rk} [Jumpscare, Booby Trap TK, MTR, Water Golem, Cybug ANTS] = ${soll.join(',')}`, ist[rk].join(',') === soll.join(','), ist[rk].join(','));
    }

    // ── Wirkung: die Reaktion negiert die Surprise-Wahl wirklich ──
    {
      const { t } = await FLOWS.J(me, op, 'Invisibility Cloak');
      R.check('Cloak × Jumpscare: der Stun trifft Held 0 nicht (Wahl negiert), Cloak liegt in der Ablage', !t.hero(op, 0).statuses.stunned && t.pile(op, 'discardPile').includes('Invisibility Cloak'), { st: t.hero(op, 0).statuses, discard: t.pile(op, 'discardPile') });
      R.check('Cloak × Jumpscare: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
      const ohne = await FLOWS.J(me, op, null);
      R.check('Gegenprobe ohne Reaktion: der Stun trifft Held 0 (freie Wahl)', !!ohne.t.hero(op, 0).statuses.stunned && !ohne.t.prompts.some(p => p.pi === op), { st: ohne.t.hero(op, 0).statuses, prompts: ohne.t.prompts.map(p => p.d.title) });
    }
    {
      const { t } = await FLOWS.J(me, op, 'Future Tech Escape Device');
      R.check('Escape Device × Jumpscare: Held 0 ist gegen diese Quelle immun (kein Stun)', !t.hero(op, 0).statuses.stunned, t.hero(op, 0).statuses);
    }
    {
      const { t } = await FLOWS.W(me, op, 'Chaorc Interception');
      const golem = t.find('Water Golem', 'support');
      R.check('Chaorc Interception × Water Golem (Creature effect): die Wahl ist negiert (der Golem hat kein Ziel gestempelt), die Chaorc-Kreatur ist geopfert', !!golem && !(golem.counters && golem.counters._golemTarget) && !t.zone(op, 1, 0), { golem: golem && golem.counters, chaorc: !!t.zone(op, 1, 0) });
      R.check('Chaorc Interception × Water Golem: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {
      const { t } = await FLOWS.A(me, op, 'Divine Gift of Rain');
      R.check('Divine Gift of Rain × Cybug ANTS (Creature effect): der Schaden fällt aus, Held 0 bleibt bei 800 HP', t.hp(op, 0) === 800, t.hp(op, 0));
    }
    {   // Kontrolle ohne Reaktion: der Schaden von Cybug ANTS kommt an
      const { t } = await FLOWS.A(me, op, null);
      R.check('Gegenprobe ohne Reaktion: Cybug ANTS trifft Held 0 für 100 Schaden', t.hp(op, 0) === 700, t.hp(op, 0));
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
