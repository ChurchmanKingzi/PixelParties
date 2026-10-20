'use strict';
// W36a · Punkt 3 · Al, 22.10.2026 (Antwort auf W35a-Rückfrage 3): „Ja, auf jeden Fall." — `_castSpellImmediately` (Guardian Beast Hu, Coffee, Elixir of Rage, Junshi, Call for Help, Friedhelm …) zählte
//  gewirkte Spell-KARTEN nicht (anders als Attack-Karten seit W35a): `spellsPlayedThisTurn` blieb 0, `onEffectCountedAsArt` kam nicht, der Silence-Bonus-Spell wurde nicht verbraucht. Teleportal („first Spell"),
//  Trial of … („nothing played yet"), Eraser Beam und Fire Bolts („first Destruction Magic Spell") sahen so einen Spell nicht (die letzten beiden lesen allerdings das Aufloesungs-Log/-Stempel und sahen
//  ihn schon). Jetzt zählt EIN Zählschritt je Spell (`engine.zaehleAlsArt('spell', { karte: true })`): `doPlaySpell` (beide Zweige), `_castSpellImmediately`, Love Shot, Archibald, Taio, Chaorc Friendly Fireballer.
//  Matrix: Quelle (Karte normal [Gegenprobe] · Sofort-Guss `performImmediateAction` · `performImmediateActionAnyHero` [Hu] · `_castSpellImmediately` aus dem Deck [Call for Help] · negierter Sofort-Guss
//  [MOE Shield] · abgebrochener Sofort-Guss) × Leser (Zähler == 1 [kein Doppelzählen] · Teleportal `inherentAction` · Trial of Annoyance `trialTurnIsClean` · Silence-Bonus-Spell verbraucht · Eraser Beam
//  `spellPlayCondition` · Fire Bolts `inherentAction`). Zusätzlich die Karten, die ihren Guss selbst auffuehren: Love Shot, Archibald, Chaorc, Taio.
//  Exit 1 auf der Basis 98a18e17 (Zähler 0 bei Sofort-Güssen), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W36/a-03-spell-zaehler-bei-sofort-guessen.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ps = (t, s) => t.gs.players[s];
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const SPELL = 'Fireball';   // Destruction Magic, braucht ein Ziel
const HELD = 1;
const MODUS = process.argv[2] || 'matrix';

const QUELLEN = {
  normal: 'Spell-Karte normal gespielt (Gegenprobe, schon korrekt)',
  sofort: 'Sofort-Guss `performImmediateAction` (Zusatzaktion: Coffee, Elixir of Rage, Junshi, Friedhelm …)',
  sofortAny: 'Sofort-Guss `performImmediateActionAnyHero` (Zusatzaktion: Guardian Beast Hu …)',
  deck: '`_castSpellImmediately` direkt aus dem Deck (Call for Help)',
  negiert: 'Sofort-Guss, dessen Effekt MOE Shield nach der Zielwahl negiert',
  abgebrochen: 'Sofort-Guss, dessen Zielwahl der Spieler abbricht (zählt NICHT)',
};

async function szene(me, op, quelle) {
  const hand = [[], []];
  if (quelle !== 'deck') hand[me] = [SPELL];
  if (quelle === 'negiert') hand[op] = ['MOE Shield'];
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
  t.grantFor(me, HELD, SPELL);
  t.setAbilities(me, HELD, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
  if (quelle === 'negiert') t.grantFor(op, 1, 'MOE Shield');
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => quelle === 'abgebrochen' ? null : [(posHero(v, op, 0) || v[0]).id];
  return t;
}
async function wirke(t, me, quelle) {
  if (quelle === 'normal' || quelle === 'negiert') return (await t.play(me, SPELL, { hero: HELD, keepActions: true })) === true;
  if (quelle === 'deck') {
    ps(t, me).mainDeck.unshift(SPELL);
    const r = await t.run(() => t.engine._castSpellImmediately(me, HELD, SPELL, { fromZone: 'deck', pool: ps(t, me).mainDeck, poolIndex: 0, by: 'Call for Help', alsZusatzaktion: true }));
    return !!r && !r.cancelled;
  }
  t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cardName: SPELL, handIndex: 0, heroIdx: HELD }) });
  const r = quelle === 'sofort' || quelle === 'abgebrochen' ? await t.run(() => t.engine.performImmediateAction(me, HELD, { title: 'Test' }))
    : await t.run(() => t.engine.performImmediateActionAnyHero(me, { title: 'Test' }));
  return !!(r && r.played);
}

if (MODUS === 'matrix') {
  (async () => {
    const R = H.runner();
    const TP = H.loadCardEffect('Teleportal'), ER = H.loadCardEffect('Eraser Beam'), FB = H.loadCardEffect('Fire Bolts');
    const TR = require('../../../../cards/effects/_trials-shared.js');
    for (const [me, op] of [[0, 1], [1, 0]]) {
      for (const [q, titel] of Object.entries(QUELLEN)) {
        const zaehlt = q !== 'abgebrochen';
        R.section(`Sitz ${me}: ${titel}`);
        // ── Zähler und Leser ──
        { const t = await szene(me, op, q);
          R.check('Vorher: Teleportal „first Spell" ja, Trial sauber, Eraser Beam spielbar, Fire Bolts erster DM-Spell', TP.inherentAction(t.gs, me) === true && TR.trialTurnIsClean(t.gs, me) === true, null);
          const gewirkt = await wirke(t, me, q);
          const n = ps(t, me).spellsPlayedThisTurn || 0;
          R.check(zaehlt ? 'der Spell wurde gewirkt' : 'der Sofort-Guss wurde abgebrochen', zaehlt ? gewirkt : !gewirkt, { gewirkt });
          R.check(zaehlt ? 'Zähler: spellsPlayedThisTurn == 1 (genau einmal, kein Doppelzählen)' : 'Zähler: spellsPlayedThisTurn == 0 (Abbruch zählt nicht)', n === (zaehlt ? 1 : 0), { n });
          R.check('Attack-Zähler unberührt (0)', (ps(t, me).attacksPlayedThisTurn || 0) === 0, null);
          R.check('Teleportal („first Spell"): ' + (zaehlt ? 'nicht mehr der erste Spell' : 'noch der erste Spell'), TP.inherentAction(t.gs, me) === !zaehlt, { n });
          R.check('Trial of … („nothing played yet"): ' + (zaehlt ? 'der Zug ist nicht mehr sauber' : 'noch sauber'), TR.trialTurnIsClean(t.gs, me) === !zaehlt, { n });
          if (q !== 'negiert') {
            R.check('Eraser Beam („only Spell"): ' + (zaehlt ? 'nicht mehr spielbar' : 'noch spielbar'), ER.spellPlayCondition(t.gs, me, t.engine) === !zaehlt, null);
            R.check('Fire Bolts („first Destruction Magic Spell"): ' + (zaehlt ? 'nicht mehr der erste' : 'noch der erste'), FB.inherentAction({ ...t.gs, currentPhase: 2 }, me, HELD, t.engine) === !zaehlt, null);
          }
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
        // ── Silence-Bonus-Spell ──
        { const t = await szene(me, op, q);
          const p = ps(t, me); p._spellLockTurn = t.gs.turn; p._silenceBonusSpell = t.gs.turn;   // Silence: der Bonus-Spell darf noch
          const gewirkt = await wirke(t, me, q);
          R.check('Silence-Bonus-Spell: ' + (zaehlt ? 'verbraucht (kein zweiter Spell trotz Sperre)' : 'bei Abbruch nicht verbraucht'), (p._silenceBonusSpell === t.gs.turn) === !zaehlt, { gewirkt, tok: p._silenceBonusSpell });
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
      }
    }
    // ── Zweimal hintereinander: die Zähler addieren sich (kein Verschlucken durch den zweiten Weg) ──
    for (const [me, op] of [[0, 1], [1, 0]]) {
      R.section(`Sitz ${me}: Sofort-Guss danach normaler Spell: Zähler == 2`);
      const t = await szene(me, op, 'sofort');
      t.addHand(me, SPELL);
      await wirke(t, me, 'sofort');
      const n1 = ps(t, me).spellsPlayedThisTurn || 0;
      await wirke(t, me, 'normal');
      R.check('erst 1 (Sofort-Guss), dann 2 (normal)', n1 === 1 && (ps(t, me).spellsPlayedThisTurn || 0) === 2, { n1, n2: ps(t, me).spellsPlayedThisTurn });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    // ── Karten, die ihren Guss selbst auffuehren (nicht über `_castSpellImmediately`) ──
    const spells = (t, me) => ps(t, me).spellsPlayedThisTurn || 0;
    const attacks = (t, me) => ps(t, me).attacksPlayedThisTurn || 0;
    for (const [me, op] of [[0, 1], [1, 0]]) {
      // Love Shot: Love Shot selbst (Spell) + der innere Spell aus der Hand des Spielers
      R.section(`Sitz ${me}: Love Shot – der innere Spell zählt (Love Shot + Fireball = 2)`);
      { const hand = [[], []]; hand[me] = ['Love Shot', SPELL];
        const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
        t.setAbilities(op, 1, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: () => ({ selectedCards: [{ handIndex: t.pile(me, 'hand').indexOf(SPELL), cardName: SPELL }] }) });
        t.targetFn = (v, cfg) => /Love Shot/.test((cfg && cfg.title) || '') ? [`hero-${op}-1`] : [(posHero(v, op, 0) || v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx !== 1) || v[0]).id];
        const r = await t.play(me, 'Love Shot', { hero: 0 });
        R.check('Love Shot gespielt, Fireball liegt in der Ablage', r === true && t.pile(me, 'discardPile').includes(SPELL), { r, abl: t.pile(me, 'discardPile') });
        R.check('spellsPlayedThisTurn == 2 (Love Shot + der innere Fireball)', spells(t, me) === 2, { n: spells(t, me) });
        R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
      // Taio: Burning Finger (DM-Spell) → Nachguss Quick Attack (Attack) und umgekehrt
      R.section(`Sitz ${me}: Taio, Absorber of the Mountain's Heart – der Nachguss zählt (Spell-Auslöser + Attack-Nachguss und umgekehrt)`);
      for (const [ausloeser, nachguss] of [['Burning Finger', 'Quick Attack'], ['Quick Attack', 'Burning Finger']]) {
        const TA = "Taio, Absorber of the Mountain's Heart";
        const hand = [[], []]; hand[me] = [ausloeser, nachguss];
        const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
        await t.run(() => t.engine.runHooks('onGameStart', {}));
        t.setHero(me, 0, TA, 600);
        t.setAbilities(me, 0, [['Fighting', 'Fighting', 'Fighting'], ['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], []]);
        t.script.push({ match: d => d.type === 'cardGallery' && d.title === TA, answer: () => ({ cardName: nachguss, source: 'hand' }) });
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
        await t.play(me, ausloeser, { hero: 0, noGrant: true });
        R.check(`${ausloeser} → Nachguss ${nachguss}: beide liegen in der Ablage`, t.pile(me, 'discardPile').includes(ausloeser) && t.pile(me, 'discardPile').includes(nachguss), t.pile(me, 'discardPile'));
        R.check('Zähler: spellsPlayedThisTurn == 1 und attacksPlayedThisTurn == 1 (je eine gespielte Karte, auch der Nachguss)', spells(t, me) === 1 && attacks(t, me) === 1, { sp: spells(t, me), at: attacks(t, me) });
        R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
      }
      // Chaorc Friendly Fireballer: der Fireball zählt als gespielter Spell
      R.section(`Sitz ${me}: Chaorc Friendly Fireballer – der Fireball zählt als gespielter Spell`);
      { const hand = [[], []]; hand[me] = [SPELL];
        const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
        const fb = t.put(me, 0, 0, 'Chaorc Friendly Fireballer'); fb.turnPlayed = t.gs.turn - 1;
        const opfer = t.put(me, 0, 1, H.INERT.creature); opfer.turnPlayed = t.gs.turn - 1;
        t.gs.currentPhase = 2; t.resetActions(me);
        t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
        t.targetFn = (v) => { const e = v.find(x => x.type === 'equip' && x.owner === me && x.cardName === H.INERT.creature); const h = posHero(v, op, 0); return [(h || e || v[0]).id]; };
        await t.activateCreature(me, 0, 0);
        R.check('der Fireball wurde gewirkt (Gegner-Held 0 getroffen)', t.hp(op, 0) < 800, t.hp(op, 0));
        R.check('spellsPlayedThisTurn == 1', spells(t, me) === 1, { n: spells(t, me) });
        R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    }
    R.finish();
  })();
}
