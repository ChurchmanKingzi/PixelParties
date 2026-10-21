'use strict';
// W46a · Punkt 1 · Al, 22.10.2026: „Ja. Generell gilt: Surprise Creature-Effekt sind immer noch Creature-Effekte." — Shield of Wisdom („when the user or a Creature in its Support Zones is chosen by an opponent's
// Creature effect. Redirect that effect to any target your opponent controls, except the attacking Creature itself") muss auch die Zielwahl einer AUFGELÖSTEN Creature-Surprise umleiten.
// Allgemeine Regel + Audit aller Leser von „Creature effect": Quelle in Zone 'surprise', cardType Creature = Creature effect.
//   • `_targeting-shared.isOppCreatureEffect` (Shield of Wisdom, Rolling Boulder) las nur die Zone 'support' → auch 'surprise' (Afflicted Vermin, Cybug ANTS …).
//   • Rolling Boulder: „Negate the effect and defeat that Creature" → die Creature-Surprise ist besiegt, bevor sie das Brett erreicht (Ablage statt Support Zone).
//   • Deepsea Encounter („chosen … with an Attack, Spell or Creature effect") las `zone === 'support'` → auch 'surprise'.
//   • Dark Ocean („neither player can react to … the effects of their opponent's Creatures"): die auflösende Creature-Surprise ist die Creature-Quelle ihres Steuerers.
//   • Jumpscare (Spell-Surprise): die aufgeschobene Betäubung steht auf dem Spell-Stapel → Spell-Immunität (Anti Magic) greift; Creature-Surprises bleiben für Anti Magic „Creature effects".
//   • Level-Schutz (Stealth: „Attacks/Spells"): Jumpscare = Spell wird geblockt, Water Golem = Creature effect nicht.
// Shield of Wisdom: der Umleitungs-Pool enthält nur Ziele, die der Effekt überhaupt wählen konnte (Afflicted Vermin wählt nur Kreaturen — ein Held als Umleitungsziel wäre verworfen, der Schild verbraucht).
// Exit 1 auf der Basis ab03cd54, Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W46/a-03-creature-surprise-ist-creature-effect-shield-boulder-und-leser.js   (Exit 0 = korrekt)
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

const { isOppCreatureEffect } = require('../../../../cards/effects/_targeting-shared');
const db = require('../../../../data/cards.json');
const karten = Array.isArray(db) ? db : Object.values(db);

/** Afflicted Vermin (Creature-Surprise von `me`) wählt die Kreatur `ziel`; `op` hält `reaktion` (Surprise im Zone von Held 0). */
async function vermin(me, op, o = {}) {
  const t = await szene(me, op, { active: op });
  t.putSurprise(me, 0, 'Afflicted Vermin'); t.grantFor(me, 0, 'Afflicted Vermin');
  if (o.reaktion) { t.putSurprise(op, 0, o.reaktion); t.grantFor(op, 0, o.reaktion); }
  const c = t.put(op, 0, 1, H.INERT.creature); c.turnPlayed = 1;           // das gewählte Ziel
  const x = t.put(op, 1, 1, H.INERT.creature); x.turnPlayed = 1;           // „die soeben beschworene" Kreatur (ausgenommen)
  const m2 = t.put(me, 2, 0, H.INERT.creature); m2.turnPlayed = 1;         // eigene Kreatur des Vermin-Besitzers = mögliches Umleitungsziel
  t.targetFn = (v, cfg) => {
    if (cfg && cfg.title === 'Afflicted Vermin') return [`equip-${op}-0-1`];
    if (cfg && cfg.title === 'Shield of Wisdom') return [`equip-${me}-2-0`];
    return [(v.find(q => !q.ineligible) || v[0]).id];
  };
  await t.run(() => t.engine._activateSurprise(me, 0, 'Afflicted Vermin', { cardName: 'x', owner: op, heroIdx: 0, cardInstance: x }, loadCardEffect('Afflicted Vermin')));
  return { t, c, m2 };
}

(async () => {
  const R = H.runner();
  // ── Klassifikation: die auflösende Creature-Surprise ist ein gegnerischer Creature effect ──
  {
    const t = await szene(0, 1);
    const e = t.engine;
    const creatureSurprises = karten.filter(c => /Surprise/.test(JSON.stringify(c.subtype)) && /Creature/.test(c.cardType) && require('fs').existsSync(require('path').join(__dirname, '../../../../cards/effects', c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.js')));
    const andere = karten.filter(c => /Surprise/.test(JSON.stringify(c.subtype)) && !/Creature/.test(c.cardType));
    const q = (name, owner = 0) => ({ name, owner, controller: owner, heroIdx: 0, zone: 'surprise' });
    const falsch = creatureSurprises.filter(c => !isOppCreatureEffect(e, 1, q(c.name, 0))).map(c => c.name);
    R.check(`isOppCreatureEffect: alle ${creatureSurprises.length} Creature-Surprises mit Skript (Zone 'surprise', Gegner) = Creature effect`, creatureSurprises.length >= 15 && falsch.length === 0, falsch);
    const falsch2 = andere.filter(c => isOppCreatureEffect(e, 1, q(c.name, 0))).map(c => c.name);
    R.check(`isOppCreatureEffect: die ${andere.length} Spell-/Attack-/Artifact-Surprises (Gold Trap, Jumpscare, Bluff, Shield of Wisdom …) sind KEIN Creature effect`, andere.length >= 25 && falsch2.length === 0, falsch2);
    R.check('isOppCreatureEffect: eigene Creature-Surprise (gleicher Spieler) = nein; Board-Creature in der Support Zone = ja (unverändert)', !isOppCreatureEffect(e, 0, q('Afflicted Vermin', 0)) && isOppCreatureEffect(e, 1, { name: 'Elven Archer', owner: 0, controller: 0, zone: 'support' }));
    R.check('sourceEffectKind (unverändert, W45a): Afflicted Vermin → creature, Jumpscare → spell, Bluff → attack, Shield of Wisdom → surprise', e.sourceEffectKind(q('Afflicted Vermin')) === 'creature' && e.sourceEffectKind(q('Jumpscare')) === 'spell' && e.sourceEffectKind(q('Bluff')) === 'attack' && e.sourceEffectKind(q('Shield of Wisdom')) === 'surprise');
  }

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} hält die Creature-Surprise, Sitz ${op} den Schutz`);
    // ── Shield of Wisdom × Afflicted Vermin ──
    {
      const { t, m2 } = await vermin(me, op, { reaktion: 'Shield of Wisdom' });
      const sh = t.prompts.filter(p => p.d && p.d.title === 'Shield of Wisdom');
      R.check('Shield of Wisdom × Afflicted Vermin (Creature-Surprise): der Schild wird dem Besitzer des Ziels angeboten', sh.length === 1 && sh[0].pi === op, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('Shield of Wisdom: die umgeleitete Kreatur (m2) ist besiegt, die ursprüngliche (c) lebt', !t.zone(me, 2, 0) && !!t.zone(op, 0, 1), { m2: !!t.zone(me, 2, 0), c: !!t.zone(op, 0, 1) });
      R.check('Shield of Wisdom: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
      const ohne = await vermin(me, op, {});
      R.check('Gegenprobe ohne Schild: das gewählte Ziel c wird besiegt (freie Wahl)', !ohne.t.zone(op, 0, 1) && !!ohne.t.zone(me, 2, 0) && !ohne.t.prompts.some(p => p.d.title === 'Shield of Wisdom'), { c: !!ohne.t.zone(op, 0, 1) });
    }
    // ── Gegenproben: Quelle vom nicht abgedeckten Typ (Spell-Surprise Jumpscare) → kein Shield ──
    {
      const t = await szene(me, op, { active: op });
      t.addHand(op, 'Attack'); t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
      t.putSurprise(op, 0, 'Shield of Wisdom'); t.grantFor(op, 0, 'Shield of Wisdom');
      t.targetFn = (v, cfg) => (cfg && cfg.title === 'Jumpscare') ? [`hero-${op}-0`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      await t.play(op, 'Attack', { hero: 0 });
      R.check('Gegenprobe Shield of Wisdom × Jumpscare (Spell-Surprise): kein Shield-Angebot, der Stun trifft Held 0', !t.prompts.some(p => p.d && p.d.title === 'Shield of Wisdom') && !!t.hero(op, 0).statuses.stunned, { prompts: t.prompts.map(p => p.d.title), st: t.hero(op, 0).statuses });
    }
    {   // Cybug ANTS wählt nur Ziele des Gegners: ein Umleitungsziel des Schilds (Ziel der ANTS-Besitzerin) wäre unwählbar → der Schild bleibt zu (kein verbrauchter Schild ohne Wirkung)
      const t = await szene(me, op, { active: op });
      t.putSurprise(me, 0, 'Cybug ANTS'); t.grantFor(me, 0, 'Cybug ANTS'); t.addHand(me, 'Future Tech Gun');
      t.putSurprise(op, 0, 'Shield of Wisdom'); t.grantFor(op, 0, 'Shield of Wisdom');
      t.targetFn = (v, cfg) => (cfg && cfg.title === 'Cybug ANTS') ? [`hero-${op}-0`] : [(v.find(x => !x.ineligible) || v[0]).id];
      await t.run(() => t.engine._activateSurprise(me, 0, 'Cybug ANTS', { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect('Cybug ANTS')));
      R.check('Shield of Wisdom × Cybug ANTS: kein legales Umleitungsziel (ANTS wählt nur Ziele des Gegners) → kein Angebot, der Schild bleibt verdeckt liegen', !t.prompts.some(p => p.d && p.d.title === 'Shield of Wisdom') && t.pile(op, 'discardPile').indexOf('Shield of Wisdom') < 0, { prompts: t.prompts.map(p => p.d.title), discard: t.pile(op, 'discardPile') });
    }

    // ── Rolling Boulder × Afflicted Vermin: Negation + „defeat that Creature" ──
    {
      const { t } = await vermin(me, op, { reaktion: 'Rolling Boulder' });
      const rb = t.prompts.filter(p => p.d && p.d.title === 'Rolling Boulder');
      R.check('Rolling Boulder × Afflicted Vermin: der Fels wird dem Besitzer des gewählten Ziels angeboten', rb.length === 1 && rb[0].pi === op, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('Rolling Boulder: die Wahl ist negiert (Ziel c lebt), die Creature-Surprise ist besiegt (Ablage ihres Besitzers, nicht auf dem Brett)', !!t.zone(op, 0, 1) && !t.find('Afflicted Vermin', 'support') && t.pile(me, 'discardPile').includes('Afflicted Vermin'), { c: !!t.zone(op, 0, 1), vermin: (t.find('Afflicted Vermin') || {}).zone, discard: t.pile(me, 'discardPile') });
      R.check('Rolling Boulder: sauber (Kartenbilanz: der Fels in der Ablage des Besitzers, kein Geist)', sauber(t) && t.pile(op, 'discardPile').includes('Rolling Boulder'), { errors: t.errors, audit: t.audit() });
    }
    {   // × Cybug ANTS (ctx.promptDamageTarget)
      const t = await szene(me, op, { active: op });
      t.putSurprise(me, 0, 'Cybug ANTS'); t.grantFor(me, 0, 'Cybug ANTS'); t.addHand(me, 'Future Tech Gun');
      t.putSurprise(op, 0, 'Rolling Boulder'); t.grantFor(op, 0, 'Rolling Boulder');
      t.targetFn = (v, cfg) => (cfg && cfg.title === 'Cybug ANTS') ? [`hero-${op}-0`] : [(v.find(x => !x.ineligible) || v[0]).id];
      await t.run(() => t.engine._activateSurprise(me, 0, 'Cybug ANTS', { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect('Cybug ANTS')));
      R.check('Rolling Boulder × Cybug ANTS (genau 1 Ziel): der Schaden ist negiert (Held 0 bei 800 HP), die Cybug ist besiegt (Ablage)', t.hp(op, 0) === 800 && t.pile(me, 'discardPile').includes('Cybug ANTS') && !t.find('Cybug ANTS', 'support'), { hp: t.hp(op, 0), discard: t.pile(me, 'discardPile') });
      R.check('Rolling Boulder × Cybug ANTS: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Gegenprobe Spell-Surprise: Boulder reagiert nur auf den Effekt einer CREATURE
      const t = await szene(me, op, { active: op });
      t.addHand(op, 'Attack'); t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
      t.putSurprise(op, 0, 'Rolling Boulder'); t.grantFor(op, 0, 'Rolling Boulder');
      t.targetFn = (v, cfg) => (cfg && cfg.title === 'Jumpscare') ? [`hero-${op}-0`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      await t.play(op, 'Attack', { hero: 0 });
      R.check('Gegenprobe Rolling Boulder × Jumpscare (Spell): kein Angebot', !t.prompts.some(p => p.d && p.d.title === 'Rolling Boulder'), t.prompts.map(p => p.d.title));
    }

    // ── Deepsea Encounter: „a Creature … is chosen with an Attack, Spell or Creature effect" ──
    {
      const setup = async (flow) => {
        const t = await szene(me, op, { active: flow === 'A' ? op : me });
        const c = t.put(op, 0, 1, H.INERT.creature); c.turnPlayed = 1;
        t.addHand(op, 'Deepsea Encounter'); t.addHand(op, 'Elven Archer');
        for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Deepsea Encounter', 1);
        if (flow === 'A') {
          t.putSurprise(me, 0, 'Cybug ANTS'); t.grantFor(me, 0, 'Cybug ANTS'); t.addHand(me, 'Future Tech Gun');
          t.targetFn = (v, cfg) => (cfg && cfg.title === 'Cybug ANTS') ? [`equip-${op}-0-1`] : [(v.find(x => !x.ineligible) || v[0]).id];
          await t.run(() => t.engine._activateSurprise(me, 0, 'Cybug ANTS', { cardName: 'x', owner: op, heroIdx: 0, amount: 50 }, loadCardEffect('Cybug ANTS')));
        } else {
          t.addHand(me, 'Telekinesis'); t.setAbilities(me, 1, [['Magic Arts'], [], []]);
          t.putSurprise(me, 0, 'Booby Trap'); t.grantFor(me, 0, 'Booby Trap');
          t.targetFn = (v, cfg) => (cfg && cfg.title === 'Booby Trap') ? [`equip-${op}-0-1`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
          await t.play(me, 'Telekinesis', { hero: 1, noGrant: true });
        }
        return t;
      };
      const a = await setup('A');
      R.check('Deepsea Encounter × Cybug ANTS (Creature effect, Kreatur gewählt): wird angeboten', hand(a, op, 'Deepsea Encounter'), a.prompts.map(p => p.pi + ':' + p.d.title));
      const b = await setup('B');
      R.check('Deepsea Encounter × Booby Trap mit Telekinesis (Spell, Kreatur gewählt): wird angeboten (Kontrolle)', hand(b, op, 'Deepsea Encounter'), b.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('Deepsea Encounter: sauber', sauber(a) && sauber(b), { a: a.errors, b: b.errors, au: a.audit(), bu: b.audit() });
    }

    // ── Dark Ocean: unter der Area reagiert der Gegner nicht auf die Effekte gegnerischer Creatures (auch nicht auf die einer Creature-Surprise); auf Spells schon ──
    {
      const mitOcean = async (flow, R_) => {
        const t = await szene(me, op, { active: flow === 'B' ? me : op });
        t.putArea(op, 'Dark Ocean');
        // Szene wie FLOWS, aber im selben Spiel: eigene Aufbauten
        t.addHand(op, 'Divine Gift of Rain'); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Divine Gift of Rain');
        if (flow === 'A') {
          t.putSurprise(me, 0, 'Cybug ANTS'); t.grantFor(me, 0, 'Cybug ANTS'); t.addHand(me, 'Future Tech Gun');
          t.targetFn = (v, cfg) => (cfg && cfg.title === 'Cybug ANTS') ? [`hero-${op}-0`] : [(v.find(x => !x.ineligible) || v[0]).id];
          await t.run(() => t.engine._activateSurprise(me, 0, 'Cybug ANTS', { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect('Cybug ANTS')));
        } else {
          t.addHand(me, 'Telekinesis'); t.setAbilities(me, 1, [['Magic Arts'], [], []]);
          t.putSurprise(me, 0, 'Booby Trap'); t.grantFor(me, 0, 'Booby Trap');
          t.targetFn = (v, cfg) => (cfg && cfg.title === 'Booby Trap') ? [`hero-${op}-0`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
          await t.play(me, 'Telekinesis', { hero: 1, noGrant: true });
        }
        return t;
      };
      const a = await mitOcean('A');
      R.check('Dark Ocean × Cybug ANTS (Creature effect): der Gegner kann nicht mit Divine Gift of Rain reagieren — der Schaden trifft (Held 0 bei 700 HP)', !hand(a, op, 'Divine Gift of Rain') && a.hp(op, 0) === 700, { prompts: a.prompts.map(p => p.d.title), hp: a.hp(op, 0) });
      const b = await mitOcean('B');
      R.check('Gegenprobe Dark Ocean × Booby Trap mit Telekinesis (Spell): Divine Gift of Rain wird angeboten', hand(b, op, 'Divine Gift of Rain'), b.prompts.map(p => p.d.title));
      R.check('Dark Ocean: sauber', sauber(a) && sauber(b), { a: a.errors, b: b.errors, au: a.audit(), bu: b.audit() });
    }

    // ── Spell-Immunität (Anti Magic: „immune to all other Spells up to level N"): die aufgeschobene Jumpscare-Betäubung ist ein Spell ──
    {
      const j = await szene(me, op, { active: op });
      j.addHand(op, 'Attack'); j.putSurprise(me, 0, 'Jumpscare'); j.grantFor(me, 0, 'Jumpscare');
      j.hero(op, 0).buffs = { ...(j.hero(op, 0).buffs || {}), magic_immune: { level: 3 } };
      j.targetFn = (v, cfg) => (cfg && cfg.title === 'Jumpscare') ? [`hero-${op}-0`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      await j.play(op, 'Attack', { hero: 0 });
      R.check('Anti Magic (magic_immune 3) × Jumpscare (Spell, Stufe 1): die Betäubung wird geblockt', !j.hero(op, 0).statuses.stunned && j.lg('status_blocked').some(l => l.reason === 'magic_immune'), { st: j.hero(op, 0).statuses, blocked: j.lg('status_blocked') });
      const a = await szene(me, op, { active: op });
      a.putSurprise(me, 0, 'Cybug ANTS'); a.grantFor(me, 0, 'Cybug ANTS'); a.addHand(me, 'Future Tech Gun');
      a.hero(op, 0).buffs = { ...(a.hero(op, 0).buffs || {}), magic_immune: { level: 3 } };
      a.targetFn = (v, cfg) => (cfg && cfg.title === 'Cybug ANTS') ? [`hero-${op}-0`] : [(v.find(x => !x.ineligible) || v[0]).id];
      await a.run(() => a.engine._activateSurprise(me, 0, 'Cybug ANTS', { cardName: 'x', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect('Cybug ANTS')));
      R.check('Gegenprobe Anti Magic × Cybug ANTS (Creature effect): kein Spell, der Schaden kommt an', a.hp(op, 0) === 700, a.hp(op, 0));
      R.check('Spell-Immunität: sauber', sauber(j) && sauber(a), { j: j.errors, a: a.errors, ju: j.audit(), au: a.audit() });
    }

    // ── Level-Schutz Stealth („cannot be chosen by your opponent's level N or lower Attacks/Spells") ──
    {
      const wahl = async (flow) => {
        const t = await szene(me, op, { active: op });
        t.setAbilities(op, 0, [['Stealth', 'Stealth'], [], []]);
        if (flow === 'J') { t.addHand(op, 'Attack'); t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare'); } else { t.putSurprise(me, 0, 'Water Golem'); t.grantFor(me, 0, 'Water Golem'); }
        let liste = null;
        t.targetFn = (v, cfg) => {
          if (cfg && (cfg.title === 'Jumpscare' || cfg.title === 'Water Golem')) { liste = v.filter(x => !x.ineligible).map(x => x.id); return [liste[0]]; }
          return [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
        };
        if (flow === 'J') await t.play(op, 'Attack', { hero: 0 });
        else await t.run(() => t.engine._activateSurprise(me, 0, 'Water Golem', { cardName: 'x', owner: op, heroIdx: 0 }, loadCardEffect('Water Golem')));
        return { t, liste };
      };
      const j = await wahl('J'), w = await wahl('W');
      R.check('Stealth 2 × Jumpscare (Spell Lv1): der Stealth-Held ist nicht wählbar', !!j.liste && !j.liste.includes(`hero-${op}-0`), j.liste);
      R.check('Gegenprobe Stealth 2 × Water Golem (Creature effect): der Stealth-Held bleibt wählbar', !!w.liste && w.liste.includes(`hero-${op}-0`), w.liste);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
