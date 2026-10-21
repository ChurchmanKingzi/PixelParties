'use strict';
// W46a · Punkt 2 (Absicherung) · Al, 22.10.2026: „Ja, auch für Reactions gelten die Effekte von Surprises jeweils als Attacks/Spells!" — Gegenproben und Sicherungen zur Umstellung der Surprise-Fenster (a-01/a-02/a-03):
//   • KEINE Doppelfenster: jede Reaktion wird je Surprise-Wahl genau EINMAL angeboten (die Quelle kommt aus `_surpriseQuelleFuer`, nicht zusätzlich aus der Umgebungsquelle);
//   • Kontrollen ohne Surprise-Quelle unverändert: Fireball (Spell) und Elven Archer (Creature effect) lösen dieselben Reaktionen aus wie vorher (Cloak: nur Spell; Chaorc Interception: beide);
//   • Ketten: zwei Jumpscares gegeneinander (Surprise-Fenster innerhalb der Surprise-Auflösung) enden ohne Hänger, Fehler und Geister-Instanzen; Surprise-Wahl ohne Reaktor = freie Wahl;
//   • Surprise-Wahl einer Spell-Surprise auf eine KREATUR (Jumpscare): kein Held-Fenster, Betäubung kommt an.
// Hinweis zum Ist-Zustand (keine Änderung): eine während des Abarbeitens der aufgeschobenen Surprises erneut ausgelöste Jumpscare bleibt bis zur nächsten Auflösungsgrenze in `gs._deferredSurprises` (wie auf der Basis).
// Exit 1 auf der Basis ab03cd54 (dort waren die Fenster für Jumpscare/Gold Trap/Water Golem zu: kein Angebot statt genau eines), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W46/a-04-absicherung-keine-doppelfenster-kontrollen-und-ketten.js   (Exit 0 = korrekt)
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

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} hält die Surprise, Sitz ${op} ist Reaktor`);
    // ── Keine Doppelfenster ──
    for (const rk of ['Invisibility Cloak', 'Chaorc Interception', 'Divine Gift of Rain']) {
      for (const fn of ['J', 'B', 'M', 'W', 'A']) {
        const { t } = await FLOWS[fn](me, op, rk);
        const n = t.prompts.filter(p => p.pi === op && p.d && p.d.title === rk).length;
        const soll = (rk === 'Invisibility Cloak' && (fn === 'W' || fn === 'A')) ? 0 : 1;
        R.check(`${rk} × ${fn}: höchstens ein Angebot (erwartet ${soll}, kein Doppelfenster)`, n === soll, n);
      }
    }
    // ── Kontrollen ohne Surprise-Quelle ──
    {
      const spell = async (rk) => {
        const t = await szene(me, op, { active: me });
        t.addHand(me, 'Fireball'); rxSetup(t, op, rk, 0);
        t.targetFn = (v) => [(v.find(x => x.id === `hero-${op}-0` && !x.ineligible) || v.find(x => !x.ineligible) || v[0]).id];
        await t.play(me, 'Fireball', { hero: 0 });
        return t;
      };
      const creature = async (rk) => {
        const t = await szene(me, op, { active: me });
        const a = t.put(me, 1, 0, 'Elven Archer'); a.turnPlayed = 1; rxSetup(t, op, rk, 0);
        t.targetFn = (v) => [(v.find(x => x.id === `hero-${op}-0` && !x.ineligible) || v.find(x => !x.ineligible) || v[0]).id];
        t.gs.activePlayer = me; t.phase(2);
        await t.run(() => t.host.doActivateCreatureEffect(t.room, me, { heroIdx: 1, zoneSlot: 0 }));
        return t;
      };
      const sCloak = await spell('Invisibility Cloak'), sChaorc = await spell('Chaorc Interception'), cChaorc = await creature('Chaorc Interception');
      R.check('Kontrollen: sauber (kein Endlos-Prompt der Opferwahl von Chaorc Interception)', sauber(sCloak) && sauber(sChaorc) && sauber(cChaorc), { s: sChaorc.errors, c: cChaorc.errors });
      R.check('Kontrolle Fireball (Spell) × Invisibility Cloak: wird angeboten', hand(sCloak, op, 'Invisibility Cloak'));
      R.check('Kontrolle Elven Archer (Creature effect) × Invisibility Cloak: wird NICHT angeboten', !hand(await creature('Invisibility Cloak'), op, 'Invisibility Cloak'));
      R.check('Kontrolle Fireball × Chaorc Interception: wird angeboten', hand(sChaorc, op, 'Chaorc Interception'));
      R.check('Kontrolle Elven Archer × Chaorc Interception: wird angeboten', hand(cChaorc, op, 'Chaorc Interception'));
    }
    // ── Ketten: Jumpscare gegen Jumpscare ──
    {
      const t = await szene(me, op, { active: op });
      t.addHand(op, 'Attack');
      t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
      t.putSurprise(op, 0, 'Jumpscare'); t.grantFor(op, 0, 'Jumpscare');
      t.targetFn = (v, cfg) => {
        if (cfg && cfg.title === 'Jumpscare') { const p = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0 && !x.ineligible) || v.find(x => x.type === 'hero' && !x.ineligible); return [p.id]; }
        return [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      };
      const r = await t.play(op, 'Attack', { hero: 0 });
      R.check('Jumpscare gegen Jumpscare: der Zug läuft durch (kein Hänger, keine Endlosschleife, keine Engine-Fehler, Audit sauber)', r === true && !t.hung && !t.runaway && sauber(t), { r, hung: t.hung, errors: t.errors, audit: t.audit() });
      R.check('Jumpscare gegen Jumpscare: beide Surprises wurden angeboten und liegen danach nicht mehr verdeckt', t.prompts.filter(p => p.d && p.d.title === 'Jumpscare').length === 2 && t.pile(me, 'discardPile').includes('Jumpscare') && t.pile(op, 'discardPile').includes('Jumpscare'), { prompts: t.prompts.map(p => p.pi + ':' + p.d.title), d0: t.pile(0, 'discardPile'), d1: t.pile(1, 'discardPile') });
    }
    // ── Spell-Surprise wählt eine KREATUR (Jumpscare): kein Helden-Fenster, die Betäubung kommt an ──
    {
      const t = await szene(me, op, { active: op });
      t.addHand(op, 'Attack'); t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
      const c = t.put(op, 0, 1, H.INERT.creature); c.turnPlayed = 1;
      rxSetup(t, op, 'Invisibility Cloak', 0);
      t.targetFn = (v, cfg) => (cfg && cfg.title === 'Jumpscare') ? [`equip-${op}-0-1`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      await t.play(op, 'Attack', { hero: 0 });
      R.check('Jumpscare wählt eine Kreatur: kein Cloak-Fenster (Heldenschutz), die Kreatur ist betäubt', !hand(t, op, 'Invisibility Cloak') && !!(c.counters && (c.counters.stunned || (c.statuses && c.statuses.stunned))), { prompts: t.prompts.map(p => p.d.title), c: c.counters });
      R.check('Jumpscare × Kreatur: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
