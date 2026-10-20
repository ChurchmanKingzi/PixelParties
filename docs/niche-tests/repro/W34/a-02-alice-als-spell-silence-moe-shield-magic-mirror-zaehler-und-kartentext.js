'use strict';
// W34a · Punkt 2 + 3 · Al, 22.10.2026 (Antworten auf W32a-Fragen 2 und 3): Alice, the Puppeteer Girl („Treated as a Destruction Magic Spell") zählt als SPELL.
//  · „Silence ja" – Silence reagiert auch auf Effekte, die als Spell zählen (negiert den Effekt, sperrt Spells, Bonus-Spell wie beim echten Spell); Kartentext „… plays a Spell." (Relikt „that is not a Creature" gestrichen).
//  · „Shamanic Curse nicht" – der Spell müsste in den Ablagestapel geschickt werden können: ein Effekt ohne Karte reagiert nicht (Gegenprobe: echter Spell → reagiert).
//  · „MOE Shield ja" – negiert den als Spell zählenden Effekt (genau 1 Ziel → Zieh-Sperre wie beim echten Spell).
//  · „Storm Ring" – Alice trifft genau EIN Ziel und löst ihn nicht aus; die Kartentext-Bedingung („more than 1 target") bleibt unverändert (Direktprüfung mit 1 und 2 Zielen).
//  · „Magic Mirror funktioniert" – negiert den Effekt; eine Kopie gibt es nur für eine Spell-KARTE; die Pollution Tokens zählen die Stufe der Quelle (Alices Destruction-Magic-Level).
//  · Punkt 3: Alice zählt für den Spell-Zähler (`spellsPlayedThisTurn`: Teleportal „first Spell") und unterliegt den Spell-Sperren (Nulled, Magic Silenced, Frightened/Howling, Berserk, Spell-Sperre des Zuges,
//    Trial of …; der Silence-Bonus lässt EINEN Spell durch und wird verbraucht).
//  · Kartentext: „that is not a Creature" nach „Spell" ist ein Relikt (Creatures waren einmal Spells) – Silence, Clone, Tushu; Rebelliokai Kind Kitsune (Kartenauswahl aus der Ablage) bleibt.
// Aufruf: node docs/niche-tests/repro/W34/a-02-alice-als-spell-silence-moe-shield-magic-mirror-zaehler-und-kartentext.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ALICE = 'Alice, the Puppeteer Girl';
const gefragt = (t, pi, n) => t.prompts.filter(p => p.pi === pi && p.d.title === n).length;
const ps = (t, s) => t.gs.players[s];
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);

/** Szene: `me` hat Alice (Held 0, Destruction `D`) und 3 nicht-frische Kreaturen (150 Schaden); der Gegner hält `opHand`; Alice zielt auf den Gegner-Helden 0. */
async function szene(me, op, o = {}) {
  const hand = [[], []]; hand[op] = o.opHand || []; hand[me] = o.meHand || [];
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
  t.setHero(me, 0, ALICE, 800);
  for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
  t.setAbilities(me, 0, [Array(o.D ?? 2).fill('Destruction Magic'), [], []]);
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => [posHero(v, op, 0).id];
  const hp0 = t.hp(op, 0);
  t.gs.activePlayer = me; t.phase(2);
  const erg = o.nicht ? null : await t.activateHero(me, 0, {});
  return { t, erg, schaden: hp0 - t.hp(op, 0) };
}
const poll = (t, s) => t.engine.cardInstances.filter(c => /Pollution/.test(c.name) && c.zone === 'support' && t.engine.physicalSide(c) === s).length;

(async () => {
  const R = H.runner();

  // ── Kartentext ──
  R.section('Kartentext: „that is not a Creature" ist als Spell-Relikt gestrichen');
  { const DB = H.DB;
    R.check('Silence: „Play this card immediately when your opponent plays a Spell. Negate that Spell, …"', /^Play this card immediately when your opponent plays a Spell\. Negate that Spell, but/.test(DB['Silence'].effect), DB['Silence'].effect);
    R.check('Clone: „… uses a Normal Attack or Spell, this Creature may perform an exact copy …"', /uses a Normal Attack or Spell, this Creature may perform an exact copy/.test(DB['Clone'].effect), DB['Clone'].effect);
    R.check('Tushu: „The next time you play a Normal Spell this turn, you may place it …"', /you play a Normal Spell this turn, you may place it/.test(DB['Tushu, the Knowledge Keeper'].effect), DB['Tushu, the Knowledge Keeper'].effect);
    const rest = Object.values(DB).filter(c => /Spell[^.]{0,40}(that is|which is|is) not a Creature|Non-Creature Spell|non-Creature Spell/.test(c.effect || '')).map(c => c.name);
    R.check('kein Kartentext nennt „Spell … not a Creature" / „Non-Creature Spell" mehr', rest.length === 0, rest);
    R.check('bewusst belassen: Rebelliokai Kind Kitsune („a card from your discard pile that is not a Creature" – Kartenauswahl, kein Spell-Relikt)', /that is not a Creature and add it to your hand/.test(DB['Rebelliokai Kind Kitsune'].effect), null);
    // Creatures sind keine Spells: Silence reagiert nicht auf das Spielen einer Kreatur (Unterscheidung läuft über cardType)
    const t = await H.fresh({ hand: [[H.INERT.creature], ['Silence']], deckSize: 20, active: 0 });
    t.grantFor(1, 1, 'Silence');
    await t.play(0, H.INERT.creature, { hero: 0 });
    R.check('Gegenprobe: Silence reagiert NICHT auf das Beschwören einer Kreatur (keine Spell-Karte)', gefragt(t, 1, 'Silence') === 0, t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  for (const [me, op] of [[0, 1], [1, 0]]) {
    // ── Gegenprobe ohne Reaktion ──
    R.section(`Sitz ${me}: Alice ohne Reaktion`);
    { const r = await szene(me, op);
      R.check('Alice trifft (150 Schaden = 3 × 50), Spell-Zähler 1, Attack-Zähler 0', r.schaden === 150 && (ps(r.t, me).spellsPlayedThisTurn || 0) === 1 && (ps(r.t, me).attacksPlayedThisTurn || 0) === 0, { s: r.schaden, sp: ps(r.t, me).spellsPlayedThisTurn, a: ps(r.t, me).attacksPlayedThisTurn });
      R.check('der Gegner hat nichts gezählt', (ps(r.t, op).spellsPlayedThisTurn || 0) === 0 && (ps(r.t, op).attacksPlayedThisTurn || 0) === 0, null);
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }

    // ── Silence ──
    R.section(`Sitz ${me}: Silence × Alice (zählt als Spell)`);
    { const r = await szene(me, op, { opHand: ['Silence'], vorbereiten: (t) => t.grantFor(op, 1, 'Silence') });
      R.check('Silence wird dem Gegner angeboten und negiert den Effekt (kein Schaden)', gefragt(r.t, op, 'Silence') >= 1 && r.schaden === 0, { g: gefragt(r.t, op, 'Silence'), s: r.schaden });
      R.check('Silence-Folgen wie beim echten Spell: Spells für den Rest des Zuges gesperrt, EIN Bonus-Spell erlaubt, „1 pro Spiel" verbraucht', ps(r.t, me)._spellLockTurn === r.t.gs.turn && ps(r.t, me)._silenceBonusSpell === r.t.gs.turn && ps(r.t, op)._oncePerGameUsed && ps(r.t, op)._oncePerGameUsed.has('silence'), { lock: ps(r.t, me)._spellLockTurn, bonus: ps(r.t, me)._silenceBonusSpell });
      R.check('der negierte Effekt zählte als gespielter Spell (Spell-Zähler 1), Silence liegt in der Ablage', (ps(r.t, me).spellsPlayedThisTurn || 0) === 1 && r.t.pile(op, 'discardPile').includes('Silence'), { sp: ps(r.t, me).spellsPlayedThisTurn });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { // Gegenprobe: echter Spell → Silence reagiert (unverändert)
      const t = await H.fresh({ hand: me === 0 ? [['Fireball'], ['Silence']] : [['Silence'], ['Fireball']], deckSize: 20, hp: 800, active: me });
      t.grantFor(op, 1, 'Silence'); t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [posHero(v, op, 0).id];
      await t.play(me, 'Fireball', { hero: 0 });
      R.check('Gegenprobe: Silence negiert einen ECHTEN Spell (Fireball) weiterhin', gefragt(t, op, 'Silence') >= 1 && t.hp(op, 0) === 800, { g: gefragt(t, op, 'Silence'), hp: t.hp(op, 0) });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { // Gegenprobe: ein Effekt, der als ATTACK zählt (Broghan), ist kein Spell → Silence reagiert nicht
      const t = await H.fresh({ hand: me === 0 ? [[], ['Silence']] : [['Silence'], []], deckSize: 30, hp: 800, active: me });
      t.setHero(me, 0, 'Broghan, the Frozen Guardian of the North', 800); t.grantFor(op, 1, 'Silence');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [posHero(v, op, 0).id];
      await t.activateHero(me, 0, {});
      R.check('Gegenprobe: Broghan (zählt als ATTACK) löst Silence nicht aus', gefragt(t, op, 'Silence') === 0, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── Shamanic Curse ──
    R.section(`Sitz ${me}: Shamanic Curse × Alice – reagiert NICHT (kein Kartenspiel, der Spell kann nicht in die Ablage); echter Spell → reagiert`);
    { const r = await szene(me, op, { opHand: ['Shamanic Curse'], vorbereiten: (t) => t.grantFor(op, 1, 'Shamanic Curse') });
      R.check('Shamanic Curse wird NICHT angeboten, Alice trifft', gefragt(r.t, op, 'Shamanic Curse') === 0 && r.schaden === 150, { g: gefragt(r.t, op, 'Shamanic Curse'), s: r.schaden });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { const t = await H.fresh({ hand: me === 0 ? [['Fireball'], ['Shamanic Curse']] : [['Shamanic Curse'], ['Fireball']], deckSize: 20, hp: 800, active: me });
      t.grantFor(op, 1, 'Shamanic Curse'); t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [posHero(v, op, 0).id];
      await t.play(me, 'Fireball', { hero: 0 });
      R.check('Gegenprobe: gegen einen ECHTEN Spell (Fireball) wird Shamanic Curse angeboten', gefragt(t, op, 'Shamanic Curse') >= 1, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── MOE Shield ──
    R.section(`Sitz ${me}: MOE Shield × Alice`);
    { const r = await szene(me, op, { opHand: ['MOE Shield'], vorbereiten: (t) => t.grantFor(op, 1, 'MOE Shield') });
      R.check('MOE Shield wird angeboten und negiert den Effekt (kein Schaden)', gefragt(r.t, op, 'MOE Shield') >= 1 && r.schaden === 0, { g: gefragt(r.t, op, 'MOE Shield'), s: r.schaden });
      R.check('genau 1 Ziel → Zieh-Sperre (wie beim echten Spell)', ps(r.t, op).drawLocked === true, ps(r.t, op).drawLocked);
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { // Gegenprobe Broghan (Attack): kein Spell → kein MOE Shield
      const t = await H.fresh({ hand: me === 0 ? [[], ['MOE Shield']] : [['MOE Shield'], []], deckSize: 30, hp: 800, active: me });
      t.setHero(me, 0, 'Broghan, the Frozen Guardian of the North', 800); t.grantFor(op, 1, 'MOE Shield');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [posHero(v, op, 0).id];
      await t.activateHero(me, 0, {});
      R.check('Gegenprobe: Broghan (Attack) löst MOE Shield nicht aus', gefragt(t, op, 'MOE Shield') === 0, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── Storm Ring ──
    R.section(`Sitz ${me}: Storm Ring × Alice (genau 1 Ziel → löst nicht aus)`);
    { const r = await szene(me, op, { opHand: ['Storm Ring'] });
      R.check('Storm Ring wird bei Alice (1 Ziel) NICHT angeboten, Alice trifft', gefragt(r.t, op, 'Storm Ring') === 0 && r.schaden === 150, { g: gefragt(r.t, op, 'Storm Ring'), s: r.schaden });
      const SR = H.loadCardEffect('Storm Ring'), e = r.t.engine, g = r.t.gs;
      const quelleAlice = { name: ALICE, owner: me, controller: me, heroIdx: 0, zone: 'hero' };
      const z = (i, h) => ({ id: `hero-${op}-${h}`, type: 'hero', owner: op, heroIdx: h, cardName: 'x' });
      R.check('Kartentext-Bedingung bleibt: 1 Ziel → nein, 2 Ziele → ja (Effekt, der als Spell zählt), 2 Ziele eines GEWÖHNLICHEN Heldeneffekts (Siphem) → nein',
        SR.postTargetCondition(g, op, e, [z(0, 0)], quelleAlice) === false && SR.postTargetCondition(g, op, e, [z(0, 0), z(0, 1)], quelleAlice) === true
        && SR.postTargetCondition(g, op, e, [z(0, 0), z(0, 1)], { name: 'Siphem, the Deepsea Demon', owner: me, controller: me, heroIdx: 0, zone: 'hero' }) === false, null);
      R.check('Gegenprobe: 2 Ziele eines Spell-Treffers der EIGENEN Seite (Storm Ring ist eine Gegner-Reaktion) → nein', SR.postTargetCondition(g, me, e, [z(0, 0), z(0, 1)], quelleAlice) === false, null);
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }

    // ── Magic Mirror ──
    R.section(`Sitz ${me}: Magic Mirror × Alice`);
    for (const D of [2, 0]) {
      const r = await szene(me, op, { D, vorbereiten: (t) => { t.putSurprise(op, 0, 'Magic Mirror'); t.grantFor(op, 0, 'Magic Mirror'); } });
      R.check(`Destruction ${D}: Magic Mirror aktiviert und negiert den Effekt (kein Schaden), die Surprise ist aufgebraucht`, gefragt(r.t, op, 'Magic Mirror') >= 1 && r.schaden === 0 && ps(r.t, op).surpriseZones[0].length === 0, { g: gefragt(r.t, op, 'Magic Mirror'), s: r.schaden });
      R.check(`Destruction ${D}: ${D} Pollution Token(s) in die freien Support Zones des Spiegel-Besitzers (Stufe der Quelle = Alices Destruction-Level), keine Kopie (Alice trifft nicht den Besitzer zurück)`, poll(r.t, op) === D && r.t.hp(me, 0) === 800, { p: poll(r.t, op), hp: r.t.hp(me, 0) });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() });
    }
    { // Gegenprobe: ein ATTACK-Effekt (Broghan) löst Magic Mirror nicht aus
      const t = await H.fresh({ hand: [[], []], deckSize: 30, hp: 800, active: me });
      t.setHero(me, 0, 'Broghan, the Frozen Guardian of the North', 800);
      t.putSurprise(op, 0, 'Magic Mirror'); t.grantFor(op, 0, 'Magic Mirror');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [posHero(v, op, 0).id];
      await t.activateHero(me, 0, {});
      R.check('Gegenprobe: Broghan (Attack) löst Magic Mirror nicht aus', gefragt(t, op, 'Magic Mirror') === 0, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── weitere Leser der virtuellen Spell-Kette ──
    R.section(`Sitz ${me}: weitere Spell-Leser – Stealthy Pursuit („performs a different Attack or Spell"), Idej Projector („opponent's Attack, Spell or Creature effect")`);
    { const r = await szene(me, op, { meHand: ['Stealthy Pursuit'], vorbereiten: (t) => { for (const h of [0, 1, 2]) t.grantFor(me, h, 'Stealthy Pursuit'); } });
      R.check('Stealthy Pursuit wird dem Besitzer von Alice angeboten (Alice führt einen Spell aus)', gefragt(r.t, me, 'Stealthy Pursuit') >= 1, r.t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { const r = await szene(me, op, { opHand: ['Idej Projector', 'Idej Projection'], vorbereiten: (t) => { t.setHero(op, 1, 'Idej Lord Daiyo', 800); } });
      R.check('Idej Projector wird dem Gegner angeboten (Alices Effekt zählt als Spell)', gefragt(r.t, op, 'Idej Projector') >= 1, r.t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { // Gegenprobe: derselbe Aufbau mit einem gewöhnlichen Heldeneffekt (Siphem) – weder Stealthy Pursuit noch Idej Projector
      const t = await H.fresh({ hand: me === 0 ? [['Stealthy Pursuit'], ['Idej Projector', 'Idej Projection']] : [['Idej Projector', 'Idej Projection'], ['Stealthy Pursuit']], deckSize: 30, hp: 800, active: me });
      t.setHero(me, 0, 'Siphem, the Deepsea Demon', 800); t.hero(me, 0).deepseaCounters = 2; t.setHero(op, 1, 'Idej Lord Daiyo', 800);
      for (const h of [0, 1, 2]) t.grantFor(me, h, 'Stealthy Pursuit');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [posHero(v, op, 0).id];
      await t.activateHero(me, 0, {});
      R.check('Gegenprobe: gewöhnlicher Heldeneffekt (Siphem) → kein Stealthy Pursuit, kein Idej Projector', gefragt(t, me, 'Stealthy Pursuit') === 0 && gefragt(t, op, 'Idej Projector') === 0, t.prompts.map(p => p.pi + ':' + p.d.title));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── Spell-Zähler: Teleportal („first Spell"), Eraser Beam („only Spell") ──
    R.section(`Sitz ${me}: Spell-Zähler (Teleportal „first Spell", Eraser Beam)`);
    { const TP = H.loadCardEffect('Teleportal');
      const a = await szene(me, op);
      R.check('nach Alice ist Teleportal NICHT mehr der erste Spell (keine Zusatzaktion)', TP.inherentAction(a.t.gs, me) === false, null);
      const b = await szene(me, op, {}); b.t.gs.players[me].spellsPlayedThisTurn = 0;
      R.check('Gegenprobe: ohne Spell ist Teleportal der erste Spell', TP.inherentAction(b.t.gs, me) === true, null);
      const EB = H.loadCardEffect('Eraser Beam');
      R.check('nach Alice ist Eraser Beam („the only Spell you play this turn") nicht mehr spielbar', EB.spellPlayCondition(a.t.gs, me, a.t.engine) === false, null); }

    { // Fire Bolts: „first Destruction Magic Spell you use this turn" (liest das Aktionsprotokoll) – Alice ist ein Destruction-Magic-Spell
      const FB = H.loadCardEffect('Fire Bolts');
      const vor = await szene(me, op, { D: 3, nicht: true });
      R.check('Gegenprobe: ohne Alice ist Fire Bolts der erste Destruction-Magic-Spell (Zusatzaktion in der Main Phase)', FB.inherentAction(vor.t.gs, me, 0, vor.t.engine) === true, null);
      const nach = await szene(me, op, { D: 3 });
      R.check('nach Alice (zählt als Destruction-Magic-Spell) ist Fire Bolts NICHT mehr der erste', FB.inherentAction(nach.t.gs, me, 0, nach.t.engine) === false, null);
      R.check('sauber', sauber(vor.t) && sauber(nach.t), { e: [...vor.t.errors, ...nach.t.errors], a: [...vor.t.audit(), ...nach.t.audit()] }); }

    // ── Spell-Sperren: Nulled, Magic Silenced, Frightened, Berserk, Spell-Sperre des Zuges, Trial ──
    R.section(`Sitz ${me}: Spell-Sperren sperren Alice (gleiche Wirkung wie bei einer Spell-Karte)`);
    const SPERREN = {
      'Nulled (Null Zone)': (t) => t.heroStatus(me, 0, 'nulled'),
      'Magic Silenced': (t) => t.heroStatus(me, 0, 'magic_silenced'),
      'Frightened (Howling in the Night)': (t) => t.heroStatus(me, 0, 'frightened'),
      'Berserked': (t) => t.heroStatus(me, 0, 'berserked'),
      'Spell-Sperre des Zuges (Eraser Beam)': (t) => { ps(t, me)._spellLockTurn = t.gs.turn; },
      'Attack-/Spell-Sperre (Trial of …)': (t) => { ps(t, me)._attackSpellLockedTurn = t.gs.turn; },
    };
    for (const [n, f] of Object.entries(SPERREN)) {
      const r = await szene(me, op, { vorbereiten: (t) => f(t) });
      R.check(`${n}: Alice ist gesperrt (kein Schaden, nichts gezählt)`, r.schaden === 0 && (ps(r.t, me).spellsPlayedThisTurn || 0) === 0, { s: r.schaden, sp: ps(r.t, me).spellsPlayedThisTurn });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() });
    }
    { const r = await szene(me, op, { vorbereiten: (t) => { ps(t, me)._spellLockTurn = t.gs.turn; ps(t, me)._silenceBonusSpell = t.gs.turn; } });
      R.check('Spell-Sperre MIT Silence-Bonus: Alice ist der EINE erlaubte Spell (trifft) und verbraucht den Bonus', r.schaden === 150 && ps(r.t, me)._silenceBonusSpell === -1, { s: r.schaden, b: ps(r.t, me)._silenceBonusSpell });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    { // Gegenproben: Attack-Sperren betreffen Alice nicht (sie ist ein Spell); Nulled sperrt Attack-Effekte nicht
      const r = await szene(me, op, { vorbereiten: (t) => { ps(t, me)._soleAttackTurn = t.gs.turn; t.hero(me, 0)._attacksThisTurn = 5; } });
      R.check('Gegenprobe: Knife-Throw-Sperre („only Attack") und Attack-Limit sperren Alice (Spell) nicht', r.schaden === 150, r.schaden);
      const t2 = await H.fresh({ hand: [[], []], deckSize: 30, hp: 800, active: me });
      t2.setHero(me, 0, 'Broghan, the Frozen Guardian of the North', 800); t2.heroStatus(me, 0, 'nulled');
      t2.targetFn = (v) => [posHero(v, op, 0).id];
      const hp0 = t2.hp(op, 0); await t2.activateHero(me, 0, {});
      R.check('Gegenprobe: Nulled sperrt einen als ATTACK zählenden Effekt (Broghan) nicht (Nulled hindert nur Spells)', t2.hp(op, 0) < hp0, t2.hp(op, 0));
      R.check('sauber', sauber(r.t) && sauber(t2), { e: [...r.t.errors, ...t2.errors], a: [...r.t.audit(), ...t2.audit()] }); }
  }
  R.finish();
})();
