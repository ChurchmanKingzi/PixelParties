'use strict';
// W48a · Punkt 5 · Al, 22.10.2026: „Ja, auch wenn eine Surprise auf eine Surprise reagiert, soll die ein Fenster öffnen, die Verschachtelungstiefe soll theoretisch beliebig tief gehen können."
// → Eine Surprise, die aus der Auflösung einer Kette / aus einer anderen Surprise heraus auslöst, öffnet ihr EIGENES Kettenfenster „Hero performs" (nach cardType) und zählt genau einmal; die künstliche
//   Tiefenkappe (10) und das Verbot „kein zweites Fenster mitten in einer offenen Kette" (`_inReactionCheck`) sind entfallen. Endlosschleifen schließt die Natur der Sache aus (jede Surprise löst einmal aus,
//   danach liegt sie nicht mehr verdeckt); die Per-Hero-Sperre `_activeSurpriseHeroes` (Re-Entrancy desselben Helden-Slots) bleibt.
// Aufbau A: sechs Gold Traps (Spell-Surprise, „opponent would gain Gold through an effect: you gain that Gold instead") im Wechsel — A@me0, B@op0, C@me1, D@op1, E@me2, F@op2: Auslöser: `me`-Gegner gewinnt Gold →
//   A zieht es um → B reagiert auf das Gold von A … bis F. Leser: Stealthy Pursuit beider Seiten (liest „one of your Heroes performs a different Spell"). Je Stufe öffnet sich das Fenster genau einmal.
// Aufbau B: dasselbe mitten in einer offenen Kette (`_inReactionCheck` = true; z. B. Aufloesung einer Kette), plus der echte Weg: Racket Arrow (Reaktion des Angreifers) wählt eine Kreatur im Support von me0 →
//   Mountain Tear River (me0) löst aus der Kettenauflösung aus und öffnet sein eigenes Fenster (Spell, Stealthy Pursuit liest es).
// Exit 1 auf der Basis 581e4ca6, Exit 0 auf dem Branch. Beide Sitze.
// Aufruf: node docs/niche-tests/repro/W48/a-05-surprise-auf-surprise-oeffnet-eigenes-performs-fenster-beliebig-tief.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const aktiv = (t, pi, name) => t.logs.filter(l => l.type === 'surprise_activated' && l.data.card === name && l.data.player === 'P' + (pi + 1)).length;
/** Wie oft wurde `pi` Stealthy Pursuit als Reaktion auf die Aktivierung von `auf` angeboten? */
const angebote = (t, pi, auf) => t.prompts.filter(p => p.pi === pi && p.d && p.d.title === 'Stealthy Pursuit' && p.d.type === 'confirm' && (p.d.message || '').startsWith(auf + ' was activated')).length;

/** Sechs Gold Traps im Wechsel; `a` hält die erste Stufe (A). Jede Seite hält 3 Stealthy Pursuit als Leser. */
async function kette(a, o = {}) {
  const b = 1 - a;
  const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: b, gold: 200 });
  const stufen = [[a, 0], [b, 0], [a, 1], [b, 1], [a, 2], [b, 2]].slice(0, o.tiefe ?? 6);
  for (const [s, hi] of stufen) { t.putSurprise(s, hi, 'Gold Trap'); t.grantFor(s, hi, 'Gold Trap'); }
  for (const s of [a, b]) for (let k = 0; k < 3; k++) { t.addHand(s, 'Stealthy Pursuit'); }
  for (const s of [a, b]) for (let hi = 0; hi < 3; hi++) t.grantFor(s, hi, 'Stealthy Pursuit');
  t.policy.confirm = true;
  const eintrag = async () => {
    if (o.imFenster) t.engine._inReactionCheck = true;   // simuliert: die Surprise löst mitten aus der Auflösung einer offenen Kette aus
    try { await t.engine.actionGainGold(b, 30); } finally { if (o.imFenster) t.engine._inReactionCheck = false; }
  };
  await t.run(eintrag);
  return { t, stufen };
}

(async () => {
  const R = H.runner();
  for (const a of [0, 1]) {
    const b = 1 - a;
    for (const imFenster of [false, true]) {
      R.section(`Sitz ${a} startet: sechs Gold Traps im Wechsel${imFenster ? ' — mitten in einer offenen Kette (_inReactionCheck)' : ''}`);
      const { t, stufen } = await kette(a, { imFenster });
      const akt = (s) => aktiv(t, s, 'Gold Trap');
      R.check('alle sechs Stufen lösen aus (3 je Seite), kein Hänger, sauber', akt(a) === 3 && akt(b) === 3 && sauber(t) && t.runaway !== true, { a: akt(a), b: akt(b), e: t.errors });
      // jede Stufe öffnet ihr EIGENES Fenster „Gold Trap was activated" für Stealthy Pursuit des Steuerers (nach cardType Spell), genau einmal je Aktivierung
      const sp = (s) => angebote(t, s, 'Gold Trap');
      R.check('jede der sechs Aktivierungen öffnet ihr EIGENES „performs"-Fenster: Stealthy Pursuit wird jeder Seite genau dreimal angeboten (einmal je Aktivierung, kein Doppelfenster)', sp(a) === 3 && sp(b) === 3, { a: sp(a), b: sp(b) });
      const spells = (s) => t.gs.players[s].spellsPlayedThisTurn || 0;
      R.check('jede Stufe zählt genau einmal als Spell (3 je Seite)', spells(a) === 3 && spells(b) === 3, { a: spells(a), b: spells(b) });
      const gold = (s) => t.gs.players[s].gold;
      R.check('Gold-Bilanz: die letzte Stufe (F, Seite des Auslösers) behält die 30 Gold — Kette endet, nichts doppelt', gold(a) + gold(b) === 430, { a: gold(a), b: gold(b) });
    }
  }

  // ── B · der echte Weg: Racket Arrow → Kreaturenwahl in der Kettenauflösung → Mountain Tear River (me0) öffnet sein eigenes Fenster ──
  for (const me of [0, 1]) {
    const op = 1 - me;
    R.section(`Sitz ${me}: Mountain Tear River löst aus der Auflösung einer Kette aus (Racket Arrow des Angreifers) und öffnet sein eigenes Fenster`);
    const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
    t.putSurprise(me, 0, 'Mountain Tear River'); t.grantFor(me, 0, 'Mountain Tear River');
    const k = t.put(me, 0, 1, H.INERT.creature); k.turnPlayed = 1;
    t.addHand(me, 'Stealthy Pursuit'); for (let hi = 0; hi < 3; hi++) t.grantFor(me, hi, 'Stealthy Pursuit');
    t.addHand(op, 'Racket Arrow'); t.addHand(op, 'Attack'); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Racket Arrow');
    t.targetFn = (v, cfg) => (cfg && cfg.title === 'Racket Arrow') ? [`equip-${me}-0-1`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 1) || v[0]).id];
    await t.play(op, 'Attack', { hero: 0 });
    R.check('Racket Arrow wurde angeboten und gewählt (Kreatur von me0 zurück auf die Hand) bzw. Mountain Tear River löste aus', aktiv(t, me, 'Mountain Tear River') === 1 || t.prompts.some(p => p.pi === op && p.d.title === 'Racket Arrow'), { akt: aktiv(t, me, 'Mountain Tear River') });
    if (aktiv(t, me, 'Mountain Tear River') === 1) {
      R.check('Mountain Tear River (aus der Kettenauflösung ausgelöst) öffnet sein eigenes Fenster „performs" (Stealthy Pursuit wird angeboten) und zählt als Spell', angebote(t, me, 'Mountain Tear River') === 1 && (t.gs.players[me].spellsPlayedThisTurn || 0) === 1, { ang: angebote(t, me, 'Mountain Tear River'), sp: t.gs.players[me].spellsPlayedThisTurn });
    }
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
