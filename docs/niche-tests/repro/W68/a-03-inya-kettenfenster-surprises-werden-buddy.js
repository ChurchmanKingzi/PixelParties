'use strict';
// W68a-03 · Card Game Player Inya × Kettenfenster-Surprises (Lunar Eclipse & Co.): auch sie können im Zug des Inya-Spielers zum Fantasy Buddy werden — genau EINE Platzierung (Token statt Ablage, nie beides)
//
// Al (23.10.2026, Rückfrage 4 aus W67a: „Ja, sollen sie."): Surprise-Spells, die im Kettenfenster aktiviert werden (Lunar Eclipse: Reaktion aus der Surprise Zone auf eine Handkarte des Gegners), melden kein
//   `afterSpellResolved` mit Ticket und gingen am KETTENENDE in die Ablage (`_pendingSurpriseReactionCleanup`). Jetzt trägt ihr Kettenglied (`link.fromSurprise`) ein Buddy-Ticket (`engine.neuesBuddyTicket('kette')`);
//   wird die Karte zum Token, räumt das Kettenende nur noch die Surprise Zone ab und legt sie NICHT zusätzlich ab (`surprise_reaction_became_buddy`).
// Szene: A (Inya = Held `k`, Lunar Eclipse verdeckt in Inyas Surprise Zone, ein „Lunatic Cycle" auf dem Brett als Kosten) spielt im EIGENEN Zug Fireball; B reagiert mit Silence aus der Hand → A's Eclipse wird aktiviert,
//   negiert und löscht Silence. Gesetzliche Bedingungen des Buddys: Inya ist die Wirtin der Surprise, Zug des Inya-Spielers, die Karte ginge in die Ablage, freie Support Zone, Spieler sagt „Ja".
// Fälle je Sitz: Inya@0/1/2 mit Eclipse an Inya (Buddy) · abgelehnt (Ablage) · Zug des Gegners (kein Buddy, Ablage) · Eclipse an einem ANDEREN Helden als Inya (kein Buddy) · drei Eclipses (Inya + 2 Helden):
// nur die an Inya zählt, wenn sie aktiviert wird · kein freier Platz (Ablage) · zwei Runden hintereinander (zwei Tokens, keine Marken, keine Duplikate) · Tod des Tokens → Ablage des Besitzers · Folgezauber normal.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya', LE = 'Lunar Eclipse';

const token = (t, name) => t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support' && (!name || c.name === name));
const abl = (t, seat, name) => t.gs.players[seat].discardPile.filter(c => c === name).length;
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0 && !t.hung;
const keineMarken = (t) => !t.gs._spellPlacedOnBoard && !t.gs._spellBecameToken && !t.gs._spellKeepInstance && !t.engine._pendingSurpriseReactionCleanup?.length;
/** Karten gleichen Namens überall (Zonen, Ablage, Gelöscht, Surprise Zonen, Tokens): die Bilanz. */
const bilanz = (t, name) => t.census().get(name) || 0;

/**
 * Szene. `inya`: Heldenindex von Inya bei A; `eclipse`: Liste der Helden von A mit verdecktem Lunar Eclipse; `aktiv`: Zug (Standard A); `ja`: Antwort auf Inyas Frage für Lunar Eclipse;
 * `jaFireball`: Antwort für den Fireball selbst (Standard nein, damit nur die Eclipse zählt).
 */
async function szene(seat, o = {}) {
  const opp = 1 - seat;
  const k = o.inya ?? 0;
  const names = [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]; names[k] = IN;
  const heroes = seat === 0 ? [names, H.BLANK_HEROES_B] : [H.BLANK_HEROES_B, names];
  const hand = [[], []];
  const aktiv = o.aktiv ?? seat;
  if (aktiv === seat) { hand[seat] = ['Fireball']; hand[opp] = ['Silence']; } else { hand[opp] = ['Fireball']; }
  const t = await H.fresh({ heroes, hand, turn: 5, active: aktiv, deckSize: 20, gold: [300, 300], seed: 11 });
  t.seat = seat; t.opp = opp; t.k = k;
  t.fragenEclipse = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === IN && /Lunar Eclipse/.test(d.message), answer: () => { t.fragenEclipse++; return { confirmed: o.ja !== false }; } });
  t.script.push({ match: d => d.type === 'confirm' && d.title === IN, answer: () => ({ confirmed: !!o.jaFireball }) });
  for (const hi of (o.eclipse ?? [k])) { t.putSurprise(seat, hi, LE); t.grantFor(seat, hi, LE); t.put(seat, o.zyklusBei ?? hi, 2, 'Lunatic Cycle - New Moon'); }
  t.grantFor(opp, 0, 'Silence');
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) });
  t.targetFn = (v) => { const x = v.find(q => q.owner === opp && q.type === 'hero' && q.heroIdx === 0) || v.find(q => q.owner === seat && q.type === 'hero' && q.heroIdx === 0); return x ? [x.id] : undefined; };
  return t;
}
const spielen = (t, k) => (t.gs.activePlayer === t.seat ? t.play(t.seat, 'Fireball', { hero: k ?? t.k }) : t.play(t.opp, 'Fireball', { hero: 0 }));

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`════ Sitz ${seat} ════`);

    // ── 1) Eclipse an Inya (Held k) im EIGENEN Zug: wird Buddy, nicht Ablage ─────────────────────────────────────
    for (const k of [0, 1, 2]) {
      const t = await szene(seat, { inya: k });
      const vor = bilanz(t, LE);
      const r = await spielen(t);
      R.check(`[S${seat}] Inya@${k}: Lunar Eclipse (Kettenglied) wird Fantasy Buddy — genau ein Token, NICHT in der Ablage, genau eine Frage`, r === true && token(t, LE).length === 1 && abl(t, seat, LE) === 0 && t.fragenEclipse === 1, { r, tok: token(t).map(c => c.name), abl: t.gs.players[seat].discardPile, fragen: t.fragenEclipse });
      R.check(`[S${seat}] Inya@${k}: Bilanz Lunar Eclipse unverändert (${vor}), Silence gelöscht (Eclipse negiert+löscht), Surprise Zone leer, Eclipse-Token am richtigen Besitzer`, bilanz(t, LE) === vor && t.gs.players[opp].deletedPile.includes('Silence') && (t.gs.players[seat].surpriseZones[k] || []).length === 0 && token(t, LE)[0]?.originalOwner === seat, { bil: bilanz(t, LE), vor, del: t.gs.players[opp].deletedPile, orig: token(t, LE)[0]?.originalOwner });
      R.check(`[S${seat}] Inya@${k}: Fireball (Inya sagt nein) geht normal in die Ablage; keine Marken/Geister; sauber`, abl(t, seat, 'Fireball') === 1 && token(t, 'Fireball').length === 0 && keineMarken(t) && sauber(t), { abl: t.gs.players[seat].discardPile, m: keineMarken(t), e: t.errors, a: t.audit() });
      // Folgezauber (Inya lehnt ab): normal in die Ablage, nichts verschluckt
      t.setHand(seat, [H.INERT.filler]); t.resetActions(seat);
      const r2 = await t.play(seat, H.INERT.filler, { hero: 0 });
      R.check(`[S${seat}] Inya@${k}: der nächste Zauber (Filler, Inya lehnt ab) landet in der Ablage — kein verschluckter Zauber`, r2 === true && abl(t, seat, H.INERT.filler) === 1 && keineMarken(t), { r2, abl: t.gs.players[seat].discardPile });
    }

    // ── 2) abgelehnt → Ablage wie bisher ─────────────────────────────────────────────────────────────────────────
    {
      const t = await szene(seat, { ja: false });
      await spielen(t);
      R.check(`[S${seat}] abgelehnt: Lunar Eclipse in der Ablage (genau 1), kein Token, genau eine Frage`, abl(t, seat, LE) === 1 && token(t, LE).length === 0 && t.fragenEclipse === 1 && keineMarken(t) && sauber(t), { abl: t.gs.players[seat].discardPile, fragen: t.fragenEclipse });
    }

    // ── 3) Zug des GEGNERS: kein Inya-Zug → keine Frage, Ablage ─────────────────────────────────────────────────
    {
      const t = await szene(seat, { aktiv: opp });
      await spielen(t);
      R.check(`[S${seat}] Zug des Gegners: Eclipse in der Ablage, KEIN Token, keine Inya-Frage`, abl(t, seat, LE) === 1 && token(t, LE).length === 0 && t.fragenEclipse === 0 && t.logs.some(l => l.type === 'lunar_eclipse_negate') && keineMarken(t) && sauber(t), { abl: t.gs.players[seat].discardPile, fragen: t.fragenEclipse });
    }

    // ── 4) Eclipse an einem ANDEREN Helden als Inya → Ablage (Inya ist nicht die Wirtin) ────────────────────────────
    {
      const t = await szene(seat, { inya: 1, eclipse: [0] });
      await spielen(t, 0);
      R.check(`[S${seat}] Eclipse an Held 0, Inya = Held 1: Eclipse in der Ablage, kein Token, keine Inya-Frage zur Eclipse`, abl(t, seat, LE) === 1 && token(t, LE).length === 0 && t.fragenEclipse === 0 && keineMarken(t) && sauber(t), { abl: t.gs.players[seat].discardPile, tok: token(t).map(c => c.name), fragen: t.fragenEclipse });
    }

    // ── 5) mehrere Eclipses gleichzeitig (Helden 0/1/2): nur das aktivierte Glied zählt, nur an Inya wird es Buddy ─────
    for (const k of [0, 1, 2]) {
      const t = await szene(seat, { inya: k, eclipse: [0, 1, 2] });
      const vor = bilanz(t, LE);
      await spielen(t);
      const aktiviert = t.logs.filter(l => l.type === 'lunar_eclipse_negate').length;
      // die Engine bietet je Name die Eclipse des ersten Helden an (Held 0): nur wenn dies Inya ist, entsteht ein Buddy
      R.check(`[S${seat}] drei Eclipses (Inya@${k}): ${aktiviert} aktiviert — Buddy genau dann, wenn die aktivierte an Inya hängt (${k === 0 ? 'ja' : 'nein'}); nie beides; Bilanz ${vor}`,
        aktiviert === 1 && token(t, LE).length === (k === 0 ? 1 : 0) && abl(t, seat, LE) === (k === 0 ? 0 : 1) && bilanz(t, LE) === vor && keineMarken(t) && sauber(t),
        { aktiviert, tok: token(t).map(c => c.name), abl: t.gs.players[seat].discardPile, bil: bilanz(t, LE), vor, z: t.gs.players[seat].surpriseZones });
    }

    // ── 6) kein freier Platz → Ablage ───────────────────────────────────────────────────────────────────────────────
    {
      const t = await szene(seat, { zyklusBei: 1 });   // der Cycle (Kosten) liegt bei Held 1 — die Kosten geben bei Inya keinen Platz frei
      for (let z = 0; z < 3; z++) if ((t.gs.players[seat].supportZones[0][z] || []).length === 0) t.put(seat, 0, z, H.INERT.creature);
      await spielen(t);
      R.check(`[S${seat}] kein freier Platz bei Inya: Eclipse in der Ablage, kein Token, keine Frage`, abl(t, seat, LE) === 1 && token(t, LE).length === 0 && t.fragenEclipse === 0 && keineMarken(t) && sauber(t), { abl: t.gs.players[seat].discardPile, fragen: t.fragenEclipse });
    }

    // ── 7) zwei Runden hintereinander: zwei Tokens, keine Marken, keine Duplikate ───────────────────────────────────
    {
      const t = await szene(seat);
      const vor = bilanz(t, LE);
      await spielen(t);
      // zweite Runde: neue Eclipse an Inya, neuer Cycle, neuer Fireball/Silence
      t.putSurprise(seat, t.k, LE); t.grantFor(seat, t.k, LE); t.put(seat, t.k, 2, 'Lunatic Cycle - Full Moon');
      t.addHand(seat, 'Fireball'); t.addHand(opp, 'Silence'); t.resetActions(seat);
      t.gs.players[opp].hoptUsed = {}; t.gs.hoptUsed = {};
      await spielen(t);
      R.check(`[S${seat}] zwei Runden: zwei Eclipse-Tokens, keine Eclipse in der Ablage, Bilanz ${vor + 1}, keine Marken`, token(t, LE).length === 2 && abl(t, seat, LE) === 0 && bilanz(t, LE) === vor + 1 && keineMarken(t) && sauber(t), { tok: token(t).map(c => c.name), abl: t.gs.players[seat].discardPile, bil: bilanz(t, LE), vor, fragen: t.fragenEclipse });
      // Tod eines Tokens → Ablage des Besitzers (genau einmal), der andere bleibt
      const tok = token(t, LE)[0];
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: opp }, tok));
      R.check(`[S${seat}] Tod eines Eclipse-Tokens: Karte in der Ablage des Besitzers (genau 1), anderer Token bleibt, Bilanz erhalten`, abl(t, seat, LE) === 1 && token(t, LE).length === 1 && bilanz(t, LE) === vor + 1 && sauber(t), { abl: t.gs.players[seat].discardPile, tok: token(t).map(c => c.name), bil: bilanz(t, LE) });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
