'use strict';
// W35a · Frage 1 · Al, 22.10.2026 (Antwort auf W34a-Rückfrage 1): „Nein, wenn Alices Effekt abgeblockt/negiert wird, ist er für die Runde verbraucht."
//  → Wird Alices Effekt („Treated as a Destruction Magic Spell") von Silence, MOE Shield oder Magic Mirror
//    negiert, ist der Einmal-pro-Zug-Stempel (`hoptUsed`, Schlüssel `engine.heroHoptKey(Heldenname, Spieler)`) VERBRAUCHT: ein zweiter Versuch im selben Zug ist nicht möglich
//    (`canActivate`/Server lehnt ab), im nächsten eigenen Zug dagegen wieder.
//    ★ BEFUND beim Absichern (Basis 7cc4e94): Silence verbrauchte den Stempel schon (virtuelle Spell-Kette → `true`), MOE Shield und Magic Mirror dagegen NICHT – die Negierung im Zielfenster ließ
//      `promptDamageTarget` `null` liefern, Alices `onHeroEffect` las das als Abbruch (`false`) und gab die Aktivierung frei (zweiter Versuch im selben Zug traf!). Behoben in
//      `alice-the-puppeteer-girl.js` (Muster Javelin Throw: `null` + `_spellNegatedByEffect` = negiert, nicht abgebrochen). Exit 1 auf der Basis (MOE Shield, Magic Mirror), Exit 0 auf dem Branch.
//  · Gegenprobe: ohne Reaktion verbraucht Alice den Stempel ebenso (Normalfall).
// Aufruf: node docs/niche-tests/repro/W35/a-01-alice-negiert-einmal-stempel-bleibt-verbraucht.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ALICE = 'Alice, the Puppeteer Girl';
const ps = (t, s) => t.gs.players[s];
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const gefragt = (t, pi, n) => t.prompts.filter(p => p.pi === pi && p.d.title === n).length;

async function szene(me, op, o = {}) {
  const hand = [[], []]; hand[op] = o.opHand || [];
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
  t.setHero(me, 0, ALICE, 800);
  for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
  t.setAbilities(me, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => [posHero(v, op, 0).id];
  return t;
}
const stempel = (t, me) => t.gs.hoptUsed?.[t.engine.heroHoptKey(ALICE, me)] === t.gs.turn;
/** Alice feuern; liefert den Schaden am Gegner-Helden 0. */
async function feuer(t, me, op) {
  const hp0 = t.hp(op, 0);
  t.gs.activePlayer = me;
  await t.activateHero(me, 0, {});
  return hp0 - t.hp(op, 0);
}

(async () => {
  const R = H.runner();
  const FAELLE = {
    'Silence': { opHand: ['Silence'], vorbereiten: (t, me, op) => t.grantFor(op, 1, 'Silence'), frage: 'Silence' },
    'MOE Shield': { opHand: ['MOE Shield'], vorbereiten: (t, me, op) => t.grantFor(op, 1, 'MOE Shield'), frage: 'MOE Shield' },
    'Magic Mirror': { vorbereiten: (t, me, op) => { t.putSurprise(op, 0, 'Magic Mirror'); t.grantFor(op, 0, 'Magic Mirror'); }, frage: 'Magic Mirror' },
  };
  for (const [me, op] of [[0, 1], [1, 0]]) {
    // ── Normalfall ──
    R.section(`Sitz ${me}: ohne Reaktion – Alice trifft, Stempel verbraucht, zweiter Versuch im selben Zug nicht möglich`);
    { const t = await szene(me, op);
      R.check('Vorher: Stempel frei', !stempel(t, me), null);
      const s1 = await feuer(t, me, op);
      R.check('Alice trifft (150) und der Stempel ist verbraucht', s1 === 150 && stempel(t, me), { s1 });
      const s2 = await feuer(t, me, op);
      R.check('zweiter Versuch im selben Zug: kein Schaden', s2 === 0, { s2 });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── Negierung: Stempel bleibt verbraucht ──
    for (const [n, f] of Object.entries(FAELLE)) {
      R.section(`Sitz ${me}: ${n} negiert Alice – Stempel verbraucht (Al: „für die Runde verbraucht")`);
      const t = await szene(me, op, f);
      const s1 = await feuer(t, me, op);
      R.check(`${n} wurde angeboten, Alice richtet keinen Schaden an`, gefragt(t, op, f.frage) >= 1 && s1 === 0, { g: gefragt(t, op, f.frage), s1 });
      R.check('der Einmal-pro-Zug-Stempel ist VERBRAUCHT', stempel(t, me), t.gs.hoptUsed);
      R.check('der negierte Effekt zählt als gespielter Spell (Spell-Zähler 1, Attack-Zähler 0), auch wenn er nie aufgelöst hat', (ps(t, me).spellsPlayedThisTurn || 0) === 1 && (ps(t, me).attacksPlayedThisTurn || 0) === 0, { sp: ps(t, me).spellsPlayedThisTurn });
      R.check('kein Flag-Rest: `_spellNegatedByEffect` ist nach dem Effekt wieder frei', !t.gs._spellNegatedByEffect, t.gs._spellNegatedByEffect);
      // zweiter Versuch im selben Zug: weder Schaden noch eine neue Reaktionsabfrage
      const fragen0 = t.prompts.length;
      const s2 = await feuer(t, me, op);
      R.check('zweiter Versuch im selben Zug nicht möglich (kein Schaden, keine neue Abfrage)', s2 === 0 && t.prompts.length === fragen0, { s2, neu: t.prompts.length - fragen0 });
      // nächster eigener Zug: wieder möglich (Reaktion hier nicht mehr im Spiel -> Schaden)
      t.setHand(op, []); for (const s of ps(t, op).surpriseZones || []) s.length = 0;
      await t.endTurn(); await t.endTurn();
      R.check('wieder am Zug: der Stempel stammt aus dem alten Zug (frei)', t.gs.activePlayer === me && !stempel(t, me), { ap: t.gs.activePlayer, turn: t.gs.turn });
      for (let i = 0; i < 3; i++) { const c = t.engine.cardInstances.find(x => x.zone === 'support' && x.owner === me && x.heroIdx === 1 && x.zoneSlot === i); if (c) c.turnPlayed = 1; }
      const s3 = await feuer(t, me, op);
      R.check('im nächsten Zug ist Alice wieder nutzbar (trifft)', s3 > 0 && stempel(t, me), { s3 });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
