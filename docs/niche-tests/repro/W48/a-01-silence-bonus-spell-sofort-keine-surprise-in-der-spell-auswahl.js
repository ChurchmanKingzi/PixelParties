'use strict';
// W48a · Punkt 3 · Al, 22.10.2026: „Nein – und das dürfte eigentlich überhaupt nicht möglich sein. Silence soll den Gegner SOFORT einen zusätzlichen Spell ausführen lassen, wie beispielsweise Victory
// Phoenix Cannon. In diesem Timeframe von ‚Choose a Spell to activate' sollte überhaupt keine Surprise aktivierbar sein!"
//   a) Eine aktivierte Spell-Surprise verbraucht den Silence-Bonus-Spell NICHT.
//   b) Im Zeitfenster der Spell-Auswahl (Silence-Bonus-Spell, Victory Phoenix Cannon, Zusatzaktions-Auswahl) ist keine Surprise aktivierbar — vom Öffnen der Auswahl bis zur Wahl/zum Abbruch.
// Silence: der Bonus-Spell wird nach der Kette SOFORT angeboten (heroAction-Prompt, abbrechbar); wird er nicht gewählt, ist er verfallen. Messung: im offenen Auswahl-Prompt wird die Surprise
// „Gold Trap" des gewählten Spielers durch einen Gold-Gewinn des Gegners ausgelöst (Antwortfunktion des Prompts) — im Fenster darf sie nicht aktivieren; Gegenprobe: derselbe Auslöser VOR/NACH dem
// Fenster aktiviert sie. Exit ≠ 0 auf der Basis 581e4ca6 (Fehlschläge bzw. Absturz, weil `spellAuswahlOffen` fehlt), Exit 0 auf dem Branch. Beide Sitze.
// Aufruf: node docs/niche-tests/repro/W48/a-01-silence-bonus-spell-sofort-keine-surprise-in-der-spell-auswahl.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const aktiv = (t, pi, name) => t.logs.filter(l => l.type === 'surprise_activated' && l.data.card === name && l.data.player === 'P' + (pi + 1)).length;
const waehleHeld = (seite, hi = 0) => (v) => [(v.find(x => x.type === 'hero' && x.owner === seite && x.heroIdx === hi) || v[0]).id];

/**
 * Szene: `op` ist am Zug und wirkt Fireball auf einen Helden von `me`; `me` hält Silence und negiert. `op` hält die Surprise Gold Trap (Held 1). `fenster(d, t)` ist die Antwort auf den Auswahl-Prompt.
 */
async function silenceSzene(me, op, fenster, o = {}) {
  const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.hero(me, hi).atk = 100; }
  t.addHand(op, 'Fireball'); t.addHand(op, 'Fireball'); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Fireball');
  t.addHand(me, 'Silence'); for (let hi = 0; hi < 3; hi++) t.grantFor(me, hi, 'Silence');
  t.putSurprise(op, 1, 'Gold Trap'); t.grantFor(op, 1, 'Gold Trap');
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) });
  const fenster_log = [];
  t.script.push({ match: d => d.type === 'heroAction', answer: async (d, pi) => { fenster_log.push({ pi, eligible: d.eligibleCards, title: d.title }); return fenster(d, pi, t); } });
  t.targetFn = (v, cfg) => waehleHeld(me, 0)(v);
  const r = await t.play(op, 'Fireball', { hero: 0 });
  await t.run(() => t.engine._runPostChainActions());   // die Spielhandler leeren die Nach-Ketten-Aktionen in `.finally` (server.js)
  t._fenster = fenster_log; t._r = r;
  return t;
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} hält Silence, Sitz ${op} wirkt Fireball — Bonus-Spell wird SOFORT angeboten`);
    {   // 1) Fenster offen: Gold Trap des Silenced-Spielers darf im Fenster nicht aktivieren; Abbruch → Bonus verfallen
        let imFenster = null;
        const t = await silenceSzene(me, op, async (d, pi, t) => {
          const vor = aktiv(t, op, 'Gold Trap');
          await t.engine.actionGainGold(me, 30);   // Auslöser: der Gegner gewinnt Gold durch einen Effekt
          imFenster = { vor, nach: aktiv(t, op, 'Gold Trap'), gold: [t.gs.players[me].gold, t.gs.players[op].gold], offen: t.engine.spellAuswahlOffen() };
          return { cancelled: true };
        });
        R.check('Silence negiert den Fireball (Held 0 von me unverletzt) und gewährt sofort das Auswahlfenster (heroAction an den Gegner)', t._fenster.length === 1 && t._fenster[0].pi === op && t._fenster[0].eligible.includes('Fireball') && t.hp(me, 0) === 800, { f: t._fenster, hp: t.hp(me, 0) });
        R.check('Auswahlfenster: nur SPELLS werden angeboten', t._fenster[0] && t._fenster[0].eligible.every(n => t.DB[n] && t.DB[n].cardType === 'Spell'), t._fenster[0]);
        R.check('IM Fenster ist keine Surprise aktivierbar: Gold Trap aktiviert nicht, der Gold-Gewinn des Gegners läuft normal (me 230)', imFenster && imFenster.offen === true && imFenster.nach === imFenster.vor && imFenster.gold[0] === 230 && imFenster.gold[1] === 200, imFenster);
        R.check('Abbruch des Fensters: der Bonus-Spell ist verfallen (Token weg), Spell-Sperre gilt weiter', t.gs.players[op]._silenceBonusSpell !== t.gs.turn && t.gs.players[op]._spellLockTurn === t.gs.turn, { tok: t.gs.players[op]._silenceBonusSpell });
        R.check('Fenster geschlossen: kein Zähler mehr offen', t.engine.spellAuswahlOffen() === false, t.engine._spellAuswahlTiefe);
        const vor = aktiv(t, op, 'Gold Trap');
        await t.run(() => t.engine.actionGainGold(me, 30));
        R.check('Gegenprobe NACH dem Fenster: derselbe Auslöser aktiviert Gold Trap (die Surprise lag unverändert verdeckt)', aktiv(t, op, 'Gold Trap') === vor + 1, { vor, nach: aktiv(t, op, 'Gold Trap') });
        R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // 2) Bonus-Spell wird gewählt und gewirkt: Fireball trifft, Bonus verbraucht, Sperre danach absolut; Surprise im Fenster weiter gesperrt
      let imFenster = null;
      const t = await silenceSzene(me, op, async (d, pi, t) => {
        t.targetFn = (v) => waehleHeld(me, 1)(v);
        const vor = aktiv(t, op, 'Gold Trap');
        await t.engine.actionGainGold(me, 30);
        imFenster = { vor, nach: aktiv(t, op, 'Gold Trap') };
        const hand = t.gs.players[op].hand;
        return { cardName: 'Fireball', handIndex: hand.indexOf('Fireball'), heroIdx: 0 };
      });
      R.check('Bonus-Spell gewählt: Fireball trifft Held 1 von me (-150), kein Treffer auf Held 0', t.hp(me, 1) === 650 && t.hp(me, 0) === 800, { h0: t.hp(me, 0), h1: t.hp(me, 1) });
      R.check('Bonus-Spell gewählt: im Auswahlfenster war Gold Trap gesperrt', imFenster && imFenster.nach === imFenster.vor, imFenster);
      R.check('Bonus-Spell gewirkt: Token verbraucht, kein dritter Spell möglich (Sperre absolut)', t.gs.players[op]._silenceBonusSpell !== t.gs.turn && t.gs.players[op]._spellLockTurn === t.gs.turn, { tok: t.gs.players[op]._silenceBonusSpell });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }

    R.section(`Sitz ${me}: Punkt 3a — eine aktivierte Spell-Surprise verbraucht den Silence-Bonus-Spell NICHT`);
    for (const name of ['Booby Trap', 'Gold Trap', 'Jumpscare']) {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      t.putSurprise(me, 0, name); t.grantFor(me, 0, name);
      const ps = t.gs.players[me];
      ps._spellLockTurn = t.gs.turn; ps._silenceBonusSpell = t.gs.turn;   // der Spieler `me` hält (noch) den Bonus
      const zaehler0 = ps.spellsPlayedThisTurn || 0;
      await t.run(() => t.engine._activateSurprise(me, 0, name, { cardName: 'Fireball', owner: op, heroIdx: 0, amount: 100 }, loadCardEffect(name)));
      R.check(`${name}: aktiviert, zählt als Spell (+1), der Bonus-Spell bleibt stehen`, aktiv(t, me, name) === 1 && (ps.spellsPlayedThisTurn || 0) === zaehler0 + 1 && ps._silenceBonusSpell === t.gs.turn, { akt: aktiv(t, me, name), sp: ps.spellsPlayedThisTurn, tok: ps._silenceBonusSpell });
    }
    {   // Gegenprobe: ein GEWIRKTER Spell (Karte) verbraucht den Bonus weiter (Alice-Weg: Effekt ohne `surprise`)
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me, gold: 200 });
      const ps = t.gs.players[me];
      ps._spellLockTurn = t.gs.turn; ps._silenceBonusSpell = t.gs.turn;
      await t.run(() => t.engine.zaehleAlsArt('spell', { pi: me, heroIdx: 0, heroOwner: me, name: 'Alice, the Puppeteer Girl' }));
      R.check('Gegenprobe: ein Effekt, der als Spell zählt (Alice), verbraucht den Bonus wie bisher', ps._silenceBonusSpell === -1, { tok: ps._silenceBonusSpell });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
