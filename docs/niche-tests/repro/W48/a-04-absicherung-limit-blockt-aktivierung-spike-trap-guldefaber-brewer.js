'use strict';
// W48a · Punkte 1, 2, 4 · Al, 22.10.2026 — Absicherung des Ist-Zustands (kein Code geändert; Exit 0 auf Basis UND Branch).
//   Punkt 1: „Ja, das ist korrekt so." — Mirjam („can never use more than 1 Attack per turn"), Idej Sword - Muras („must be the only Attack") und Idej Sword - Kogarasu („only 1 Spell per turn") BLOCKEN die
//            Aktivierung einer Attack-/Spell-Surprise ihres Helden, wenn das Limit erreicht ist (`_canHeroActivateSurprise` über `canPlayCard` von Held/Ausrüstung). Gegenproben: Limit nicht erreicht → aktivierbar;
//            Surprise der anderen Art (Spell bei Attack-Limit) → aktivierbar; anderer Held → aktivierbar.
//   Punkt 2: „Korrekt, Spike Traps Schaden gilt als Spell und kann entsprechend drauf reagiert werden." — Rückstoß = `decay_spell`, Reaktionen/Surprises des Angreifers dürfen reagieren: `W47/a-03` (hier nur der Verweis
//            plus Kurzprobe: Fireshield/Booby Trap des Angreifers sehen den Rückstoß).
//   Punkt 4: „Ja, das funktioniert beides." — Güldefaber (+10 Gold) und The Brewer's Blade (Potion ziehen) reagieren auf die Attack-/Spell-Surprise ihres Trägers: `W47/a-02` (hier eine Kurzprobe).
// Aufruf: node docs/niche-tests/repro/W48/a-04-absicherung-limit-blockt-aktivierung-spike-trap-guldefaber-brewer.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const MIRJAM = 'Mirjam, the Fallen Cute Angel', GULDE = 'Güldefaber, the King of Dwarfs';
const aktiv = (t, pi, name) => t.logs.filter(l => l.type === 'surprise_activated' && l.data.card === name && l.data.player === 'P' + (pi + 1)).length;

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Punkt 1 — Limit erreicht blockt die Aktivierung (Mirjam, Idej Sword - Muras / Kogarasu)`);
    {   // Mirjam
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      t.setHero(me, 1, MIRJAM, 800); t.putSurprise(me, 1, 'Bluff'); t.grantFor(me, 1, 'Bluff'); t.putSurprise(me, 1, 'Booby Trap'); t.grantFor(me, 1, 'Booby Trap');
      const frei = t.engine._canHeroActivateSurprise(me, 1, 'Bluff');
      t.hero(me, 1)._mirjamAttackTurn = t.gs.turn; t.hero(me, 1)._mirjamAttacksUsed = 1;
      R.check('Mirjam: Attack-Surprise (Bluff) vor dem Limit aktivierbar, nach der ersten Attack NICHT mehr', frei === true && t.engine._canHeroActivateSurprise(me, 1, 'Bluff') === false, { frei });
      R.check('Mirjam: eine Spell-Surprise (Booby Trap) bleibt trotz Attack-Limit aktivierbar', t.engine._canHeroActivateSurprise(me, 1, 'Booby Trap') === true);
    }
    for (const [schwert, held, art, name, markiere] of [
      ['Idej Sword - Muras', 'Idej Lord Nobunakin', 'Attack', 'Bluff', (t) => { (t.gs.players[me].heroesAttackedThisTurn = t.gs.players[me].heroesAttackedThisTurn || []).push(0); }],
      ['Idej Sword - Kogarasu', 'Idej Lord Nobunakin', 'Spell', 'Booby Trap', (t) => { t.hero(me, 0)._idejKogarasuSpellTurn = t.gs.turn; }],
    ]) {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      t.setHero(me, 0, held, 800); t.put(me, 0, 0, schwert, { counters: { treatAsEquip: 1 } }); t.putSurprise(me, 0, name); t.grantFor(me, 0, name); t.grantFor(me, 1, name);
      t.putSurprise(me, 1, name);
      const vor = t.engine._canHeroActivateSurprise(me, 0, name);
      markiere(t);
      R.check(`${schwert}: ${art}-Surprise (${name}) des Trägers vor dem Limit aktivierbar, danach NICHT`, vor === true && t.engine._canHeroActivateSurprise(me, 0, name) === false, { vor });
      R.check(`${schwert}: derselbe ${art}-Surprise an einem ANDEREN Helden (ohne Schwert) bleibt aktivierbar`, t.engine._canHeroActivateSurprise(me, 1, name) === true);
    }

    R.section(`Sitz ${me}: Punkt 2 — Spike Trap: Rückstoß ist Spell-Schaden, der Angreifer darf reagieren (Kurzprobe; Matrix in W47/a-03)`);
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      t.putSurprise(me, 0, 'Spike Trap'); t.grantFor(me, 0, 'Spike Trap'); t.putSurprise(op, 0, 'Booby Trap'); t.grantFor(op, 0, 'Booby Trap');
      t.addHand(op, 'Fireball');
      t.targetFn = (v, cfg) => [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      await t.play(op, 'Fireball', { hero: 0 });
      const rueck = t.logs.filter(l => l.type === 'damage' && l.data.amount === 200 && l.data.damageType === 'decay_spell');
      R.check('Spike Trap: der Rückstoß (200) läuft als Spell-Schaden (decay_spell)', rueck.length === 1, t.logs.filter(l => l.type === 'damage').map(l => l.data));
      R.check('Spike Trap: Booby Trap des Angreifers reagiert auf den Spell-Rückstoß', aktiv(t, op, 'Booby Trap') === 1, aktiv(t, op, 'Booby Trap'));
      R.check('Spike Trap: sauber', sauber(t), { e: t.errors, a: t.audit() });
    }

    R.section(`Sitz ${me}: Punkt 4 — Güldefaber und The Brewer's Blade reagieren auf die Attack-/Spell-Surprise ihres Trägers (Kurzprobe; Matrix in W47/a-02)`);
    for (const name of ['Bluff', 'Booby Trap']) {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      t.setHero(me, 1, GULDE, 800); t.putSurprise(me, 1, name); t.grantFor(me, 1, name);
      const g0 = t.gs.players[me].gold;
      t.addHand(op, 'Fireball'); t.targetFn = (v) => [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 1) || v[0]).id];
      await t.play(op, 'Fireball', { hero: 0 });
      R.check(`Güldefaber × ${name}: +10 Gold auf die aktivierte Surprise`, aktiv(t, me, name) === 1 && t.gs.players[me].gold === g0 + 10, { akt: aktiv(t, me, name), g0, g: t.gs.players[me].gold });
    }
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200, potionDeck: [['ZZ Trinket', 'ZZ Trinket', 'ZZ Trinket'], ['ZZ Trinket', 'ZZ Trinket', 'ZZ Trinket']] });
      t.put(me, 1, 0, "The Brewer's Blade"); t.putSurprise(me, 1, 'Bluff'); t.grantFor(me, 1, 'Bluff');
      const h0 = t.gs.players[me].potionDeck.length;
      t.addHand(op, 'Fireball'); t.targetFn = (v) => [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 1) || v[0]).id];
      await t.play(op, 'Fireball', { hero: 0 });
      R.check("The Brewer's Blade × Bluff: 1 Potion aus dem Potion Deck gezogen", aktiv(t, me, 'Bluff') === 1 && h0 - t.gs.players[me].potionDeck.length === 1, { h0, n: t.gs.players[me].potionDeck.length });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
