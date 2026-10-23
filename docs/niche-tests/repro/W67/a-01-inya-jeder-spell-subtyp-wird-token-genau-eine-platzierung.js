'use strict';
// W67a-01 · Card Game Player Inya: JEDER Spell-Subtyp kann im Zug des Inya-Spielers zum Fantasy Buddy werden — genau EINE Platzierung (Token statt Ablage, nie beides)
//
// Al (23.10.2026, Rückfrage 2 aus W66a: „Nein."): „Sofern es der Zug des Inya-Spielers ist, soll JEDER Subtyp von Spell zu einem Token werden können, sofern er nach seinem Effekt nicht auf dem Board
//   bleiben würde (also sind Areas und Attachments fast immer ausgenommen und manche anderen Nischen-Fälle, bei denen Spells auf dem Board bleiben, auch, etwa Glass Wall)."
// W66a hatte Inya auf Handspiel, Sofort-Guss und Kettenglied beschränkt, weil Surprise-/Hand-Reaktions-Wege die Marken `_spellPlacedOnBoard`/`_spellBecameToken` nicht auswerteten (Karte doppelt, nächster
//   Zauber verschluckt). Jetzt trägt jeder Weg ein Ticket im Hook-Kontext (`_buddy`, `engine.neuesBuddyTicket`); Inya trägt den Token ein, der Weg legt die Karte dann NICHT zusätzlich ab.
// Wege je Sitz: Handspiel · Sofort-Guss · Kettenglied (Silence) · Surprise im eigenen Zug (Toxic Trap, Skull Carpet Bombing am Zugende) · Surprise im Gegnerzug (Ablage) · Glass Wall (bleibt offen: kein Buddy) ·
//   Hand-Reaktion im Schadensfenster des eigenen Zugs (Spectral Armor, Sculpture Guards-Gruppe) · Areas/Attachments/Permanents/Delete (kein Buddy) · kein Platz (Ablage) · abgelehnt (Ablage) ·
//   Folgezauber nach jedem Weg unverändert · Sweep über ALLE spielbaren Spells (Token ⇔ die Karte wäre in der Ablage gelandet).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya';

const token = (t, name) => t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support' && (!name || c.name === name));
const ablage = (t, seat, name) => t.gs.players[seat].discardPile.filter(c => c === name).length;
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0 && !t.hung;
const keineMarken = (t) => !t.gs._spellPlacedOnBoard && !t.gs._spellBecameToken && !t.gs._spellKeepInstance;
/** Szene: Inya = Held 0 auf `seat`; Antwort auf Inyas Frage: `ja`. */
async function szene(seat, o = {}) {
  const opp = 1 - seat;
  const eigene = [IN, H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const heroes = seat === 0 ? [eigene, H.BLANK_HEROES_B] : [H.BLANK_HEROES_B, eigene];
  const hand = [[], []]; hand[seat] = o.hand || []; hand[opp] = o.handOpp || [];
  const t = await H.fresh({ heroes, hand, turn: 5, active: o.aktiv ?? seat, deckSize: 20, gold: [300, 300], seed: 11 });
  t.fragen = 0; t.ja = o.ja !== false;
  t.script.push({ match: d => d.type === 'confirm' && d.title === IN, answer: () => { t.fragen++; return { confirmed: t.ja }; } });
  t.policy.confirm = true;
  t.opp = opp;
  t.targetFn = (v) => { const x = v.find(q => q.owner === opp && q.type === 'hero' && q.heroIdx === 0); return x ? [x.id] : undefined; };
  return t;
}
/** Folgezauber: nach dem Weg wird ein normaler Zauber gespielt — er muss wie immer in Ablage (abgelehnt) bzw. als Buddy (angenommen) landen, nichts geht verloren. */
async function folgezauber(R, t, seat, was) {
  t.ja = false;
  const F = H.INERT.filler;
  t.setHand(seat, [F]);
  t.resetActions?.(seat);
  const r = await t.play(seat, F, { hero: 0 });
  R.check(`[S${seat}] ${was}: der nächste Zauber (Filler, Inya lehnt ab) geht normal in die Ablage (nichts verschluckt, nichts doppelt)`, r === true && ablage(t, seat, F) === 1 && token(t, F).length === 0, { r, abl: t.gs.players[seat].discardPile, tok: token(t).map(c => c.name) });
  R.check(`[S${seat}] ${was}: keine Rest-Marken, keine Geister, keine Engine-Fehler`, keineMarken(t) && sauber(t), { m: [t.gs._spellPlacedOnBoard, t.gs._spellBecameToken, t.gs._spellKeepInstance], e: t.errors, a: t.audit() });
}

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`── Sitz ${seat} ──`);

    // ── 1) Handspiel ──────────────────────────────────────────────────────────
    {
      const t = await szene(seat, { hand: ['Fireball', 'Fireball'] });
      const r = await t.play(seat, 'Fireball', { hero: 0 });
      R.check(`[S${seat}] Handspiel: genau ein Buddy, Karte NICHT in der Ablage, eine Frage`, r === true && token(t, 'Fireball').length === 1 && ablage(t, seat, 'Fireball') === 0 && t.fragen === 1, { r, tok: token(t).length, abl: t.gs.players[seat].discardPile, fragen: t.fragen });
      R.check(`[S${seat}] Handspiel: keine Geister-Instanz (Hand 1 Karte), keine Marken`, t.gs.players[seat].hand.length === 1 && keineMarken(t) && sauber(t), { h: t.gs.players[seat].hand, m: keineMarken(t), a: t.audit() });
      await folgezauber(R, t, seat, 'Handspiel');
    }
    // abgelehnt
    {
      const t = await szene(seat, { hand: ['Fireball'], ja: false });
      await t.play(seat, 'Fireball', { hero: 0 });
      R.check(`[S${seat}] Handspiel abgelehnt: Karte genau einmal in der Ablage, kein Token`, ablage(t, seat, 'Fireball') === 1 && token(t).length === 0 && t.fragen === 1 && sauber(t), { abl: t.gs.players[seat].discardPile, fragen: t.fragen });
    }
    // kein Platz
    {
      const t = await szene(seat, { hand: ['Fireball'] });
      for (let z = 0; z < 3; z++) t.put(seat, 0, z, H.INERT.creature);
      await t.play(seat, 'Fireball', { hero: 0 });
      R.check(`[S${seat}] kein freier Support-Platz: keine Frage, Karte in der Ablage`, t.fragen === 0 && ablage(t, seat, 'Fireball') === 1 && token(t).length === 0 && sauber(t), { fragen: t.fragen, abl: t.gs.players[seat].discardPile });
    }
    // Gegnerzug: Inya wirkt nur im EIGENEN Zug
    {
      const t = await szene(seat, { hand: ['Fireball'], aktiv: opp });
      t.gs.players[seat].hand = ['Fireball'];
      const r = await t.run(() => t.engine.runHooks('afterSpellResolved', { heroOwner: seat, spellName: 'Fireball', spellCardData: H.DB['Fireball'], heroIdx: 0, casterIdx: seat, damageTargets: [], isSecondCast: false, _buddy: t.engine.neuesBuddyTicket ? t.engine.neuesBuddyTicket('hand') : undefined, _inyaBuddyWeg: true, _skipReactionCheck: true }));
      R.check(`[S${seat}] Gegnerzug: Inya macht keinen Buddy (keine Frage, kein Token)`, t.fragen === 0 && token(t).length === 0, { fragen: t.fragen });
    }

    // ── 2) Sofort-Guss ────────────────────────────────────────────────────────
    for (const ja of [true, false]) {
      const t = await szene(seat, { hand: ['Fireball'], ja });
      t.grantFor(seat, 0, 'Fireball');
      t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cardName: 'Fireball', handIndex: 0, heroIdx: 0 }) });
      const r = await t.run(() => t.engine.performImmediateAction(seat, 0, { title: 'Test' }));
      const gespielt = !!(r && r.played);
      if (ja) R.check(`[S${seat}] Sofort-Guss angenommen: Buddy statt Ablage, Hand leer, kein Geist`, gespielt && token(t, 'Fireball').length === 1 && ablage(t, seat, 'Fireball') === 0 && t.gs.players[seat].hand.length === 0 && keineMarken(t) && sauber(t), { gespielt, tok: token(t).length, abl: t.gs.players[seat].discardPile, a: t.audit() });
      else R.check(`[S${seat}] Sofort-Guss abgelehnt: Karte genau einmal in der Ablage`, gespielt && ablage(t, seat, 'Fireball') === 1 && token(t).length === 0 && sauber(t), { gespielt, abl: t.gs.players[seat].discardPile });
      if (ja) await folgezauber(R, t, seat, 'Sofort-Guss');
    }

    // ── 3) Kettenglied (Silence antwortet auf Silence, eigener Zug) ──────────
    for (const ja of [true, false]) {
      const t = await szene(seat, { hand: ['Fireball', 'Silence'], handOpp: ['Silence'], ja });
      t.grantFor(seat, 0, 'Silence'); t.grantFor(opp, 0, 'Silence');
      await t.play(seat, 'Fireball', { hero: 0 });
      const sil = ablage(t, seat, 'Silence'), tokS = token(t, 'Silence').length;
      R.check(`[S${seat}] Kettenglied (${ja ? 'angenommen' : 'abgelehnt'}): Silence genau EINMAL platziert (${ja ? 'Buddy' : 'Ablage'}), nie beides`, tokS + sil === 1 && (ja ? tokS === 1 : sil === 1), { tokS, sil, abl: t.gs.players[seat].discardPile, tok: token(t).map(c => c.name) });
      R.check(`[S${seat}] Kettenglied (${ja ? 'angenommen' : 'abgelehnt'}): Gegner-Silence in seiner Ablage (Gegnerzug-Karte, kein Buddy), keine Marken/Geister`, ablage(t, opp, 'Silence') === 1 && keineMarken(t) && sauber(t), { oppAbl: t.gs.players[opp].discardPile, a: t.audit() });
      if (ja) await folgezauber(R, t, seat, 'Kettenglied');
    }

    // ── 4) Surprise ───────────────────────────────────────────────────────────
    // 4a) Toxic Trap im EIGENEN Zug aktiviert → Buddy, nicht in der Ablage, Surprise Zone leer, nur eine Instanz
    for (const ja of [true, false]) {
      const t = await szene(seat, { ja });
      t.putSurprise(seat, 0, 'Toxic Trap');
      await t.run(() => t.engine._activateSurprise(seat, 0, 'Toxic Trap', { cardName: 'Fireball', owner: opp, heroIdx: 0, amount: 100 }, H.loadCardEffect('Toxic Trap')));
      const inst = t.inst(c => c.name === 'Toxic Trap');
      if (ja) R.check(`[S${seat}] Surprise (Toxic Trap) im eigenen Zug: Buddy, NICHT in der Ablage, Surprise Zone leer, genau eine Instanz (der Token)`, token(t, 'Toxic Trap').length === 1 && ablage(t, seat, 'Toxic Trap') === 0 && t.gs.players[seat].surpriseZones[0].length === 0 && inst.length === 1 && keineMarken(t) && sauber(t), { tok: token(t).length, abl: t.gs.players[seat].discardPile, sz: t.gs.players[seat].surpriseZones[0], inst: inst.map(c => c.zone), a: t.audit() });
      else R.check(`[S${seat}] Surprise (Toxic Trap) im eigenen Zug abgelehnt: genau einmal in der Ablage`, token(t).length === 0 && ablage(t, seat, 'Toxic Trap') === 1 && t.gs.players[seat].surpriseZones[0].length === 0 && sauber(t), { abl: t.gs.players[seat].discardPile });
      if (ja) await folgezauber(R, t, seat, 'Surprise');
    }
    // 4b) Skull Carpet Bombing: gesetzt, zündet am Ende des eigenen Zugs (echter Zugwechsel) → Buddy; der Folgezauber geht nicht verloren
    {
      const t = await szene(seat, { hand: ['Skull Carpet Bombing', 'Fireball', 'Fireball'] });
      t.put(opp, 0, 0, H.INERT.big);
      const r = await t.play(seat, 'Skull Carpet Bombing', { hero: 0 });
      R.check(`[S${seat}] Skull Carpet Bombing gesetzt (verdeckt), noch kein Buddy/keine Ablage`, r === true && t.gs.players[seat].surpriseZones[0].includes('Skull Carpet Bombing') && token(t).length === 0 && t.fragen === 0, { r, f: t.fragen });
      const hp0 = t.hp(opp, 0);
      await t.endTurn();
      R.check(`[S${seat}] Skull Carpet Bombing zündet am Zugende (Schaden) und wird zum Buddy — nicht doppelt in der Ablage`, t.hp(opp, 0) < hp0 && token(t, 'Skull Carpet Bombing').length === 1 && ablage(t, seat, 'Skull Carpet Bombing') === 0 && keineMarken(t) && sauber(t), { hp0, hp: t.hp(opp, 0), tok: token(t).map(c => c.name), abl: t.gs.players[seat].discardPile, a: t.audit() });
      await t.endTurn();                                              // Gegnerzug → wieder eigener Zug
      const r2 = await t.play(seat, 'Fireball', { hero: 0 });
      R.check(`[S${seat}] der nächste Zauber nach der Surprise macht (angenommen) seinen Buddy — nichts verschluckt`, r2 === true && token(t, 'Fireball').length === 1 && ablage(t, seat, 'Fireball') === 0 && ablage(t, seat, 'Skull Carpet Bombing') === 0, { r2, tok: token(t).map(c => c.name), abl: t.gs.players[seat].discardPile });
    }
    // 4c) Surprise im GEGNERZUG: normal in die Ablage, keine Frage
    {
      const t = await szene(seat, { aktiv: opp });
      t.putSurprise(seat, 0, 'Toxic Trap');
      await t.run(() => t.engine._activateSurprise(seat, 0, 'Toxic Trap', { cardName: 'Fireball', owner: opp, heroIdx: 0, amount: 100 }, H.loadCardEffect('Toxic Trap')));
      R.check(`[S${seat}] Surprise im Gegnerzug: keine Frage, Karte genau einmal in der Ablage, kein Token`, t.fragen === 0 && token(t).length === 0 && ablage(t, seat, 'Toxic Trap') === 1 && sauber(t), { f: t.fragen, abl: t.gs.players[seat].discardPile });
    }
    // 4d) Glass Wall bleibt offen liegen: kein Buddy; „Discard it" → in die Ablage, dann Buddy möglich
    for (const offen of [true, false]) {
      const t = await szene(seat);
      t.script.unshift({ match: d => d.type === 'confirm' && d.title === 'Glass Wall', answer: () => offen });
      t.putSurprise(seat, 0, 'Glass Wall');
      await t.run(() => t.engine._activateSurprise(seat, 0, 'Glass Wall', { cardName: 'Fireball', owner: opp, heroIdx: 0, amount: 100 }, H.loadCardEffect('Glass Wall')));
      if (offen) R.check(`[S${seat}] Glass Wall bleibt offen liegen: kein Buddy, keine Frage, nicht in der Ablage`, t.fragen === 0 && token(t).length === 0 && ablage(t, seat, 'Glass Wall') === 0 && t.gs.players[seat].surpriseZones[0].includes('Glass Wall') && sauber(t), { f: t.fragen, sz: t.gs.players[seat].surpriseZones[0] });
      else R.check(`[S${seat}] Glass Wall „Discard it": würde in die Ablage gehen → Buddy statt Ablage`, token(t, 'Glass Wall').length === 1 && ablage(t, seat, 'Glass Wall') === 0 && t.gs.players[seat].surpriseZones[0].length === 0 && sauber(t), { tok: token(t).length, abl: t.gs.players[seat].discardPile, sz: t.gs.players[seat].surpriseZones[0] });
    }

    // ── 5) Hand-Reaktion im Schadensfenster des EIGENEN Zugs (Spectral Armor, Wirker = Inya) ─────────────
    for (const [ja, aktiv] of [[true, seat], [false, seat], [true, opp]]) {
      const t = await szene(seat, { hand: ['Spectral Armor'], ja, aktiv });
      t.grantFor(seat, 0, 'Spectral Armor');
      const src = t.put(opp, 0, 0, H.INERT.big);
      const hero = t.hero(seat, 0), hp0 = hero.hp;
      await t.run(() => t.engine.actionDealDamage(src, hero, 100, 'creature'));
      const eigenerZug = aktiv === seat;
      const was = `Hand-Reaktion Spectral Armor (${eigenerZug ? 'eigener Zug' : 'Gegnerzug'}, ${ja ? 'angenommen' : 'abgelehnt'})`;
      R.check(`[S${seat}] ${was}: Reaktion wirkte (Schaden halbiert), Hand leer`, hp0 - hero.hp === 50 && t.gs.players[seat].hand.length === 0, { schaden: hp0 - hero.hp, h: t.gs.players[seat].hand });
      if (eigenerZug && ja) R.check(`[S${seat}] ${was}: Buddy statt Ablage (genau eine Platzierung), keine Geister`, token(t, 'Spectral Armor').length === 1 && ablage(t, seat, 'Spectral Armor') === 0 && keineMarken(t) && sauber(t), { tok: token(t).length, abl: t.gs.players[seat].discardPile, a: t.audit() });
      else R.check(`[S${seat}] ${was}: Karte genau einmal in der Ablage, kein Token${eigenerZug ? '' : ', keine Frage'}`, token(t).length === 0 && ablage(t, seat, 'Spectral Armor') === 1 && (eigenerZug || t.fragen === 0) && sauber(t), { abl: t.gs.players[seat].discardPile, f: t.fragen });
      if (eigenerZug && ja) await folgezauber(R, t, seat, 'Hand-Reaktion');
    }
    // Post-Target-Fenster (Flächenzauber), Wirker Inya, Halbierung eines ANDEREN Helden bleibt wirksam
    for (const ja of [true, false]) {
      const eigene = [H.BLANK_HEROES[0], IN, H.BLANK_HEROES[2]];
      const heroes = seat === 0 ? [eigene, H.BLANK_HEROES_B] : [H.BLANK_HEROES_B, eigene];
      const hand = [[], []]; hand[seat] = ['Cataclysm', 'Spectral Armor'];
      const t = await H.fresh({ heroes, hand, turn: 5, active: seat, deckSize: 20, gold: [300, 300], seed: 11 });
      t.fragen = 0;
      t.script.push({ match: d => d.type === 'confirm' && d.title === IN, answer: () => { t.fragen++; return { confirmed: ja }; } });
      t.script.push({ match: d => d.type === 'effectTarget', answer: () => undefined });
      t.policy.confirm = true;
      t.grantFor(seat, 1, 'Spectral Armor');
      const hp0 = [0, 1, 2].map(h => t.hp(seat, h));
      await t.play(seat, 'Cataclysm', { hero: 2 });
      const dmg = [0, 1, 2].map(h => hp0[h] - t.hp(seat, h));
      R.check(`[S${seat}] Post-Target-Reaktion Spectral Armor (${ja ? 'Buddy' : 'Ablage'}): Halbierung des gewählten Helden wirkt wie ohne Buddy (50), Ablage/Token genau eine Platzierung`,
        dmg[0] === 50 && ablage(t, seat, 'Spectral Armor') + token(t, 'Spectral Armor').length === 1 && (ja ? token(t, 'Spectral Armor').length === 1 : ablage(t, seat, 'Spectral Armor') === 1) && sauber(t), { dmg, tok: token(t).map(c => c.name), abl: t.gs.players[seat].discardPile, a: t.audit() });
    }

    // ── 6) Sweep über ALLE spielbaren Spells: Buddy ⇔ die Karte wäre in der Ablage gelandet ─────────────────
    {
      const namen = Object.values(H.DB).filter(c => c.cardType === 'Spell' && c.subtype !== 'Reaction' && c.subtype !== 'Surprise').map(c => c.name).filter(n => H.loadCardEffect(n));
      let gespielt = 0, buddys = 0, ohne = 0; const bad = []; const keine = [];
      for (const name of namen) {
        const lauf = async (ja) => {
          const t = await szene(seat, { hand: [name, H.INERT.filler], ja });
          t.put(opp, 0, 0, H.INERT.big); t.put(opp, 1, 1, H.INERT.creature); t.put(seat, 1, 0, H.INERT.creature); t.put(seat, 2, 2, H.INERT.big);
          t.gs.players[seat].discardPile = [];
          const r = await t.play(seat, name, { hero: 0 });
          return { r, abl: ablage(t, seat, name), tok: token(t, name).length, hand: t.gs.players[seat].hand.filter(c => c === name).length, ok: sauber(t) && keineMarken(t), fragen: t.fragen, t };
        };
        const a = await lauf(false);
        if (a.r !== true) continue;
        if (a.t.hp(seat, 0) <= 0 || a.t.gs.result || name === 'Chaos Magic' || name === 'Eraser Beam') continue;   // Wirker besiegt/geopfert (Divine Gift of Sacrifice, Last Resort), Spielende (Eraser Beam besiegt den letzten Gegner-Helden) bzw. Zufall (Chaos Magic) bzw. Eraser Beam (seine 3 Pollution Tokens füllen Inyas Zonen — kein freier Platz): kein Buddy möglich
        gespielt++;
        const b = await lauf(true);
        if (a.abl === 1 && a.tok === 0) {            // Referenz: die Karte wäre in der Ablage gelandet → Inya MUSS fragen, Buddy statt Ablage
          if (!(b.tok === 1 && b.abl === 0 && a.fragen === 1 && b.fragen === 1 && a.ok && b.ok)) bad.push([name, 'Ablage-Karte: kein sauberer Buddy', { a: [a.abl, a.tok, a.fragen, a.ok], b: [b.abl, b.tok, b.fragen, b.ok] }]);
          buddys++;
        } else {                                      // Referenz: bleibt auf dem Board / Hand / gelöscht → KEIN Buddy, KEINE Frage, gleiches Ergebnis
          if (!(b.tok === 0 && b.abl === a.abl && b.hand === a.hand && b.fragen === 0 && a.ok && b.ok)) bad.push([name, 'Board-Karte: Buddy/Frage/Abweichung', { a: [a.abl, a.tok, a.hand, a.fragen, a.ok], b: [b.abl, b.tok, b.hand, b.fragen, b.ok] }]);
          ohne++; keine.push(name);
        }
      }
      R.check(`[S${seat}] Sweep: ${gespielt} Spells (${buddys} → Buddy statt Ablage, ${ohne} bleiben auf dem Board/gelöscht/zurück → kein Buddy)`, bad.length === 0, bad.slice(0, 6));
      R.check(`[S${seat}] Sweep-Abdeckung plausibel (≥ 150 gespielt, ≥ 90 Buddy, ≥ 20 Board-bleibt)`, gespielt >= 150 && buddys >= 90 && ohne >= 20, { gespielt, buddys, ohne });
      if (process.env.W67_LISTE) process.stdout.write(`LISTE S${seat}: ${keine.join(', ')}\n`);
      R.note(`[S${seat}] Spells, die auf dem Board bleiben / gelöscht / zurück auf die Hand (kein Buddy)`, keine.join(', '));
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
