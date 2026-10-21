'use strict';
// W47a · Punkt 4 · Al, 22.10.2026: „Ja!" — Die Aktivierung einer Attack-/Spell-Surprise öffnet ein Kettenfenster „Hero performs": Stealthy Pursuit, die Arrows, Magic Topaz und alle gleichartigen Leser
// reagieren darauf, nach dem cardType der Surprise (Attack → Attack, Spell → Spell; Creature-Surprises führen nichts „aus"). Surprises kosten weiter keine Action. Exit 1 auf der Basis 70453312, Exit 0 auf dem Branch.
// Matrix: Surprise-Quelle (Bluff = Attack · Booby Trap/Jumpscare/Gold Trap = Spell · Water Golem/Cybug ANTS = Creature) × Leser (Stealthy Pursuit, jeder Arrow, Magic Topaz, Silence, Shamanic Curse) × beide Sitze.
// Gegenproben: Quelle vom nicht abgedeckten Typ → keine Reaktion; ohne Leser nichts; Leser des GEGNERS („your Heroes") sehen nichts; nur GESETZTE Surprise öffnet kein Fenster; jede Reaktion genau einmal.
// Aufruf: node docs/niche-tests/repro/W47/a-01-kettenfenster-performs-bei-aktivierter-attack-spell-surprise.js   (Exit 0 = korrekt)
const { H, loadCardEffect, szene, angeboten, anzahlAngebote, surprise, waehleHeld, quelle, QUELLEN } = require('./_w47.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

const ARROWS = ['Angelfeather Arrow', 'Bomb Arrow', 'Flame Arrow', 'Golden Arrow', 'Hydra Blood Arrow', 'Poisoned Arrow', 'Racket Arrow', "Rainbow's Arrow", 'Magic Topaz'];
const EIGENE_LESER = ['Stealthy Pursuit', ...ARROWS];      // lesen „one of YOUR Heroes performs …" → gehören dem Surprise-Steuerer `me`
const GEGNER_LESER = ['Silence', 'Shamanic Curse'];         // lesen „your opponent plays / an opponent's Hero uses a Spell" → gehören dem Gegner `op`

/** Leser in die Hand von `holder` legen (Schulen/Stufe für die Spells, eine Gegnerkreatur für Racket/Bomb Arrow). */
function leser(t, holder, name) {
  t.addHand(holder, name);
  for (let hi = 0; hi < 3; hi++) t.grantFor(holder, hi, name);
}
const kreatur = (t, seite) => { const c = t.put(seite, 1, 0, H.INERT.creature); c.turnPlayed = 1; return c; };

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    // ───────── A · Matrix ─────────
    for (const q of Object.keys(QUELLEN)) {
      const art = QUELLEN[q].art;
      R.section(`Sitz ${me} hält ${q} (${art}-Surprise) — eigene Leser`);
      for (const rd of EIGENE_LESER) {
        const t = await quelle(q, me, op, (t) => { kreatur(t, op); leser(t, me, rd); });
        const soll = rd === 'Stealthy Pursuit' ? (art === 'Attack' || art === 'Spell') : art === 'Attack';
        R.check(`${q} × ${rd}: ${soll ? 'wird im Fenster „performs" angeboten' : 'wird NICHT angeboten'}`, angeboten(t, me, rd) === soll, { ang: angeboten(t, me, rd) });
        R.check(`${q} × ${rd}: Surprise wurde aktiviert, sauber`, surprise(t, me, q) && sauber(t), { s: surprise(t, me, q), e: t.errors, a: t.audit() });
      }
      R.section(`Sitz ${me} hält ${q} (${art}-Surprise) — Leser des Gegners (Silence, Shamanic Curse: „plays / uses a Spell")`);
      for (const rd of GEGNER_LESER) {
        const t = await quelle(q, me, op, (t) => { leser(t, op, rd); });
        const soll = art === 'Spell';
        // Gegenprobe ohne Surprise-Aktivierung: dieselben Karten reagieren auf den Fireball NICHT (sie gehören dem Spieler, der den Fireball selbst wirkt)
        R.check(`${q} × ${rd} (Gegner): ${soll ? 'wird dem Gegner angeboten' : 'wird NICHT angeboten'}`, angeboten(t, op, rd) === soll, { ang: angeboten(t, op, rd) });
        R.check(`${q} × ${rd} (Gegner): sauber`, sauber(t), { e: t.errors, a: t.audit() });
      }
    }

    R.section(`Sitz ${me}: Bow of the Hunt Goddess („when the equipped Hero performs an Attack, you may search your deck for an Arrow …")`);
    for (const q of Object.keys(QUELLEN)) {
      const art = QUELLEN[q].art;
      const t = await quelle(q, me, op, (t) => { t.put(me, 0, 0, 'Bow of the Hunt Goddess'); t.setDeck(me, ['Angelfeather Arrow', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']); });
      const ang = t.prompts.some(p => p.pi === me && p.d.title === 'Bow of the Hunt Goddess');
      R.check(`${q} × Bow of the Hunt Goddess (Träger = Wirt-Held): ${art === 'Attack' ? 'wird angeboten' : 'wird NICHT angeboten'}`, ang === (art === 'Attack'), { ang });
    }

    // ───────── B · Gegenproben ─────────
    R.section(`Sitz ${me}: Gegenproben`);
    for (const q of ['Bluff', 'Booby Trap', 'Gold Trap', 'Water Golem']) {
      const t = await quelle(q, me, op, (t) => { leser(t, op, 'Stealthy Pursuit'); leser(t, op, 'Angelfeather Arrow'); leser(t, op, 'Magic Topaz'); kreatur(t, op); });
      R.check(`${q}: Leser des GEGNERS („one of YOUR Heroes performs") sehen die Aktivierung der Surprise nicht`, !['Stealthy Pursuit', 'Angelfeather Arrow', 'Magic Topaz'].some(n => anzahlAngebote(t, op, n, q) > 0), t.prompts.filter(p => p.pi === op).map(p => p.d.title + ':' + (p.d.message || '').slice(0, 60)));
    }
    {
      const t = await quelle('Booby Trap', me, op);
      R.check('ohne Leser: Booby Trap wirkt wie bisher (100 Schaden auf den Angreifer, Karte in der Ablage)', t.hp(op, 0) === 700 && t.pile(me, 'discardPile').includes('Booby Trap') && !t.prompts.some(p => p.pi === me && /Chain a Reaction/.test(p.d.title || '')), { hp: t.hp(op, 0) });
      R.check('ohne Leser: sauber', sauber(t), { e: t.errors, a: t.audit() });
      const t2 = await quelle('Bluff', me, op);
      R.check('ohne Leser: Bluff zieht seine 3 Karten wie bisher', t2.pile(me, 'hand').length === 3 && t2.pile(me, 'discardPile').includes('Bluff'), { hand: t2.pile(me, 'hand') });
    }
    {   // nur GESETZT (verdeckt gelegt) öffnet kein Fenster
      const t = await szene(me, op, { active: me });
      t.addHand(me, 'Booby Trap'); leser(t, me, 'Stealthy Pursuit'); leser(t, me, 'Magic Topaz'); t.grantFor(me, 0, 'Booby Trap');
      await t.play(me, 'Booby Trap', { hero: 0 });
      R.check('nur gesetzte Surprise: kein Leser wird angeboten, nichts gezählt', !angeboten(t, me, 'Stealthy Pursuit') && !angeboten(t, me, 'Magic Topaz') && (t.gs.players[me].spellsPlayedThisTurn || 0) === 0, { s: t.gs.players[me].spellsPlayedThisTurn, p: t.prompts.map(p => p.pi + ':' + p.d.title) });
    }

    // ───────── C · Wirkung der Reaktionen ─────────
    R.section(`Sitz ${me}: Wirkung`);
    {   // Stealthy Pursuit auf eine Spell-Surprise: der Wirt-Held (Held 0) ist verborgen
      const t = await quelle('Booby Trap', me, op, (t) => { leser(t, me, 'Stealthy Pursuit'); });
      const bl = (t.hero(me, 0)._targetBlockers || []).filter(b => b.card === 'Stealthy Pursuit');
      R.check('Stealthy Pursuit × Booby Trap: der Wirt-Held trägt den Schutz („cannot be chosen"), die Karte ist gelöscht', bl.length === 1 && t.pile(me, 'deletedPile').includes('Stealthy Pursuit'), { bl, del: t.pile(me, 'deletedPile') });
      R.check('Stealthy Pursuit × Booby Trap: das Surprise selbst wirkt weiter (100 Schaden auf den Angreifer)', t.hp(op, 0) === 700, t.hp(op, 0));
      R.check('Stealthy Pursuit × Booby Trap: genau EIN Angebot (kein Doppelfenster)', anzahlAngebote(t, me, 'Stealthy Pursuit') === 1, anzahlAngebote(t, me, 'Stealthy Pursuit'));
    }
    for (const rd of ['Angelfeather Arrow', 'Magic Topaz', 'Bomb Arrow']) {   // Arrows auf eine Attack-Surprise: bewaffnen den Wirt, danach wieder abgeräumt
      const t = await quelle('Bluff', me, op, (t) => { leser(t, me, rd); kreatur(t, op); });
      const log = t.logs.filter(l => l.type === 'arrow_armed' && l.data.arrow === rd);
      R.check(`${rd} × Bluff: genau eine Bewaffnung (kein Doppelfenster), danach ist der Wirt entwaffnet`, log.length === 1 && !(t.hero(me, 0)._armedArrows || []).length && anzahlAngebote(t, me, rd) === 1, { n: log.length, ang: anzahlAngebote(t, me, rd), armed: t.hero(me, 0)._armedArrows });
      R.check(`${rd} × Bluff: Bluff zieht trotzdem seine 3 Karten, Karte verbraucht (Ablage/Hand/gelöscht)`, t.pile(me, 'discardPile').includes('Bluff') && sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // Silence (Gegner) negiert die Spell-Surprise Booby Trap im Kettenfenster: kein Schaden auf den Angreifer, Karte in der Ablage, Fireball trifft weiter
      const t = await quelle('Booby Trap', me, op, (t) => { leser(t, op, 'Silence');
        t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) }); });
      R.check('Silence × Booby Trap: Silence negiert die Aktivierung — kein Schaden auf den Angreifer (Held 0 des Gegners 800)', t.hp(op, 0) === 800, t.hp(op, 0));
      R.check('Silence × Booby Trap: Booby Trap liegt in der Ablage (verbraucht), der Fireball traf trotzdem (Held 0: 650)', t.pile(me, 'discardPile').includes('Booby Trap') && t.hp(me, 0) === 650, { d: t.pile(me, 'discardPile'), hp: t.hp(me, 0) });
      R.check('Silence × Booby Trap: sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // Silence × Gold Trap: der Gold-Gewinn des Gegners wird nicht umgeleitet
      const t = await quelle('Gold Trap', me, op, (t) => { leser(t, op, 'Silence'); t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) }); });
      R.check('Silence × Gold Trap: negierte Surprise — der Gegner behält seine 30 Gold, kein Umleiten an me', t.gs.players[op].gold === 230 && t.gs.players[me].gold === 200, { op: t.gs.players[op].gold, me: t.gs.players[me].gold });
    }

    // ───────── D · Kosten: Surprises verbrauchen keine Aktion / Zusatzaktion ─────────
    R.section(`Sitz ${me}: keine Aktionskosten`);
    {
      const t = await szene(me, op, { active: me });
      t.putSurprise(me, 0, 'Booby Trap'); t.grantFor(me, 0, 'Booby Trap'); t.addHand(op, 'Fireball'); leser(t, me, 'Stealthy Pursuit');
      const ps = t.gs.players[me];
      const vorher = { acted: [...(ps.heroesActedThisTurn || [])], extra: JSON.stringify(ps.bonusActions || null), phase: t.gs.currentPhase };
      await t.run(() => t.engine._activateSurprise(me, 0, 'Booby Trap', { cardName: 'Fireball', owner: op, heroIdx: 0 }, loadCardEffect('Booby Trap')));
      R.check('Aktivierung verbraucht weder die Aktion noch eine Zusatzaktion (heroesActedThisTurn, bonusActions, Phase unverändert)', JSON.stringify(ps.heroesActedThisTurn || []) === JSON.stringify(vorher.acted) && JSON.stringify(ps.bonusActions || null) === vorher.extra && t.gs.currentPhase === vorher.phase, { acted: ps.heroesActedThisTurn, extra: ps.bonusActions, phase: t.gs.currentPhase });
    }

    // ───────── E · Rekursion / Endlosketten ─────────
    R.section(`Sitz ${me}: Surprise reagiert auf Surprise — keine Endlosketten, jede Reaktion genau einmal`);
    for (const s of ['Booby Trap', 'Jumpscare']) {
      const t = await szene(me, op);
      // beide Seiten halten dieselbe Surprise an Held 0 und je einen Stealthy Pursuit
      t.putSurprise(me, 0, s); t.grantFor(me, 0, s); t.putSurprise(op, 0, s); t.grantFor(op, 0, s);
      leser(t, me, 'Stealthy Pursuit'); leser(t, op, 'Stealthy Pursuit');
      t.addHand(op, 'Fireball');
      t.targetFn = (v, cfg) => (cfg && cfg.title === s) ? waehleHeld(op, 0)(v) : waehleHeld(me, 0)(v);
      const r = await t.play(op, 'Fireball', { hero: 0 });
      R.check(`${s} gegen ${s}: kein Hänger/Endlosschleife (play = true), sauber`, r === true && sauber(t), { r, e: t.errors, a: t.audit() });
      const akt = (seite) => t.logs.filter(l => l.type === 'surprise_activated' && l.data.card === s && l.data.player === 'P' + (seite + 1)).length;
      R.check(`${s} gegen ${s}: jedes Kettenfenster höchstens einmal je Aktivierung (Angebote von Stealthy Pursuit auf „${s} was activated" ≤ Aktivierungen der Seite, je Seite ≤ 1)`,
        anzahlAngebote(t, me, 'Stealthy Pursuit', s) <= Math.min(1, akt(me)) && anzahlAngebote(t, op, 'Stealthy Pursuit', s) <= Math.min(1, akt(op)),
        { me: anzahlAngebote(t, me, 'Stealthy Pursuit', s), op: anzahlAngebote(t, op, 'Stealthy Pursuit', s), akt: [akt(me), akt(op)] });
      R.check(`${s} gegen ${s}: beide Seiten haben ihre Surprise aktiviert (Rekursion läuft, endet) — Booby Trap: ${s === 'Booby Trap' ? 'ja' : 'Jumpscare wirkt erst nach der Auflösung'}`, s === 'Booby Trap' ? (akt(me) === 1 && akt(op) === 1) : akt(me) === 1, { akt: [akt(me), akt(op)] });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
