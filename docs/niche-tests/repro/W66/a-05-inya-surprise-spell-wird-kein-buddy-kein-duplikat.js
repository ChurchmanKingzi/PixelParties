'use strict';
// W66a-05 · Card Game Player Inya × aktivierte Surprise-/Reaktions-Spells: kein Fantasy Buddy, kein Duplikat, keine Rest-Flags
//
// Fund des generischen Laufs (W66/a-03): Skull Carpet Bombing (Surprise-Spell, zündet am Ende des EIGENEN Zuges) feuert `afterSpellResolved` — Inya (eigener Zug) beschwor die aktivierte Surprise als Buddy,
//   AUSSERDEM schob der Surprise-Weg die Karte in die Ablage (Karte doppelt: Token UND Ablage), und `gs._spellPlacedOnBoard`/`gs._spellBecameToken` blieben stehen (der NÄCHSTE normal gespielte Zauber
//   wäre weder in der Ablage noch sonstwo gelandet). Inya wirkt jetzt nur auf Wegen, die den Token auswerten: Handspiel (`doPlaySpell`), Sofort-Guss, Kettenglied (`_inyaBuddyWeg`).
// Erwartet (je Sitz): Surprise zündet normal (Schaden), KEIN Buddy, Karte genau einmal in der Ablage, keine Rest-Flags, der nächste Zauber kommt normal in die Ablage; ein normal gespielter Spell macht
//   weiterhin einen Buddy. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya', SCB = 'Skull Carpet Bombing';
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    const eigene = [IN, H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
    const heroes = seat === 0 ? [eigene, H.BLANK_HEROES_B] : [H.BLANK_HEROES_B, eigene];
    const hand = [[], []]; hand[seat] = [SCB, 'Fireball', 'Heal'];
    const t = await H.fresh({ heroes, hand, turn: 5, active: seat, deckSize: 20, seed: 5 });
    t.put(opp, 0, 0, H.INERT.big);
    let fragen = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === IN, answer: () => { fragen++; return { confirmed: true }; } });
    t.targetFn = (v) => { const x = v.find(q => q.owner === opp && q.type === 'hero' && q.heroIdx === 0); return x ? [x.id] : undefined; };
    const r = await t.play(seat, SCB, { hero: 0 });                    // Surprise setzen (zündet am Zugende)
    R.check(`[S${seat}] Surprise gesetzt (verdeckt in der Surprise Zone)`, r === true && t.gs.players[seat].surpriseZones[0].includes(SCB), { r });
    const hp0 = t.hp(opp, 0);
    await t.endTurn();                                                 // Ende des eigenen Zuges: Skull Carpet Bombing zündet
    const tokens = t.inst(c => c.counters && c.counters._fantasyBuddyToken);
    R.check(`[S${seat}] die Surprise ist gezündet (100 Schaden an den Gegner-Helden)`, t.hp(opp, 0) < hp0, { hp0, hp: t.hp(opp, 0) });
    R.check(`[S${seat}] Inya macht daraus KEINEN Fantasy Buddy (keine Frage, kein Token)`, tokens.length === 0 && fragen === 0, { n: tokens.length, fragen });
    R.check(`[S${seat}] die Karte liegt genau einmal in der Ablage, nicht doppelt`, t.gs.players[seat].discardPile.filter(c => c === SCB).length === 1, t.gs.players[seat].discardPile);
    R.check(`[S${seat}] keine Rest-Flags (_spellPlacedOnBoard / _spellBecameToken)`, !t.gs._spellPlacedOnBoard && !t.gs._spellBecameToken, { a: t.gs._spellPlacedOnBoard, b: t.gs._spellBecameToken });
    await t.endTurn();                                                 // Gegnerzug → wieder eigener Zug
    const r2 = await t.play(seat, 'Fireball', { hero: 0 });
    const t2 = t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.name === 'Fireball');
    R.check(`[S${seat}] ein normal gespielter Spell macht weiterhin einen Buddy (Inya-Wirkung unverändert), die Frage kam genau einmal`, r2 === true && t2.length === 1 && fragen === 1, { r2, n: t2.length, fragen });
    await t.endTurn(); await t.endTurn();
    t.setHand(seat, ['Fireball']);
    const r3 = await t.play(seat, 'Fireball', { hero: 0 });
    const t3 = t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.name === 'Fireball');
    R.check(`[S${seat}] im nächsten Zug wirkt Inya weiter normal (zweiter Buddy), nichts geht verloren`, r3 === true && t3.length === 2 && fragen === 2, { r3, n: t3.length, fragen });
    R.check(`[S${seat}] keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
