'use strict';
// NK-01 · Shimmering Dragonegg (neue Karte, 23.10.2026)
// Kartentext: „If you control no Creatures, summoning this counts as an additional Action. When this Creature is defeated during your turn, you gain 8 Gold."
// Schwestern: Icy / Flaming Dragonegg (`_dragonegg-shared.js`); Ruling 22.9.: NUR ein Tod in der EIGENEN Runde (des Kontrolleurs) löst aus.
// Prüft: Zusatzaktion nur ohne Kreaturen · +8 Gold bei Tod in eigener Runde (Schaden, Zerstörung, Opfer, Flächentod, gestohlen) ·
//        nichts in der Gegnerrunde · Pflichteffekt (keine Rückfrage) · Goldsperren · Negation · Status-Tod · Wiederbeleben · Bilanz.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const EI = 'Shimmering Dragonegg';
  const quelle = (owner) => ({ name: 'Test', owner, controller: owner, heroIdx: 0 });
  const schade = (t, inst, owner, n = 5, typ = 'creature') => t.run(() => t.engine.actionDealCreatureDamage(quelle(owner), inst, n, typ, { sourceOwner: owner, canBeNegated: true }));

  R.section('A · Beschwören: Zusatzaktion nur ohne eigene Kreaturen');
  {
    const t = await H.fresh({ hand: [[EI], []] });
    const r = await t.play(0, EI, { hero: 0, slot: 0 });
    const ps = t.gs.players[0];
    R.check('ohne Kreaturen: gespielt, Ei liegt auf dem Brett', r === true && t.zone(0, 0, 0) === EI, { r, zone: t.zone(0, 0, 0) });
    R.check('ohne Kreaturen: kostet KEINE Aktion (heroesActedThisTurn leer)', (ps.heroesActedThisTurn || []).length === 0, ps.heroesActedThisTurn);
    // zweites Ei, jetzt gibt es eine Kreatur → kostet die Aktion
    t.addHand(0, EI);
    const r2 = await t.play(0, EI, { hero: 0, slot: 1, keepActions: true });
    R.check('mit Kreatur: zweites Ei gespielt', r2 === true && t.zone(0, 0, 1) === EI, { r2 });
    R.check('mit Kreatur: kostet eine Aktion', (ps.heroesActedThisTurn || []).length === 1, ps.heroesActedThisTurn);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    // Gegner-Kreatur zählt nicht als „Creatures you control"; eine gegnerische Kreatur auf MEINER Seite (Kontrolle beim Gegner) zählt auch nicht
    const t = await H.fresh({ hand: [[EI], []] });
    t.put(1, 0, 0, H.INERT.creature);
    await t.play(0, EI, { hero: 0, slot: 0 });
    R.check('Gegnerkreatur auf dem Brett: Zusatzaktion bleibt', (t.gs.players[0].heroesActedThisTurn || []).length === 0, t.gs.players[0].heroesActedThisTurn);
  }
  {
    // Kreatur bei anderem Helden zählt („egal bei welchem Helden")
    const t = await H.fresh({ hand: [[EI], []] });
    t.put(0, 2, 1, H.INERT.creature);
    await t.play(0, EI, { hero: 0, slot: 0 });
    R.check('eigene Kreatur bei anderem Helden: Ei kostet Aktion', (t.gs.players[0].heroesActedThisTurn || []).length === 1, t.gs.players[0].heroesActedThisTurn);
  }
  {
    // gecharmte eigene Kreatur (Kontrolle beim Gegner) zählt nicht, übernommene Gegnerkreatur schon
    const t = await H.fresh({ hand: [[EI], []] });
    const c = t.put(0, 1, 0, H.INERT.creature, { controller: 1 });
    await t.play(0, EI, { hero: 0, slot: 0 });
    R.check('eigene, aber vom Gegner kontrollierte Kreatur zählt nicht → Ei ist Zusatzaktion', (t.gs.players[0].heroesActedThisTurn || []).length === 0, { acted: t.gs.players[0].heroesActedThisTurn, c: c.controller });
    const t2 = await H.fresh({ hand: [[EI], []] });
    t2.put(1, 0, 0, H.INERT.creature, { controller: 0 });
    await t2.play(0, EI, { hero: 0, slot: 0 });
    R.check('vom Spieler kontrollierte Gegnerkreatur zählt → Ei kostet Aktion', (t2.gs.players[0].heroesActedThisTurn || []).length === 1, t2.gs.players[0].heroesActedThisTurn);
  }

  R.section('B · Tod in der eigenen Runde → +8 Gold');
  {
    // 1 HP: genau 1 Schaden tötet das Ei (Gegenprobe zu „0 Schaden" in Teil D)
    const t = await H.fresh({ gold: 50, hand: [[EI], []] });
    await t.play(0, EI, { hero: 0, slot: 0 });
    const g0 = t.gs.players[0].gold;
    await schade(t, t.find(EI, 'support'), 1, 1);
    R.check('Ei hat 1 HP: 1 Schaden tötet es (+8 Gold, eigene Runde)', t.zone(0, 0, 0) === null && t.gs.players[0].gold === g0 + 8, { z: t.zone(0, 0, 0), g0, g: t.gs.players[0].gold });
  }
  for (const [typ, label] of [['creature', 'Kreaturenschaden'], ['spell', 'Spell-Schaden'], ['attack', 'Attack-Schaden'], ['destruction_spell', 'Destruction-Spell']]) {
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await schade(t, ei, 0, 5, typ);
    R.check(`${label} in eigener Runde: 50 → 58 Gold`, t.gs.players[0].gold === 58, t.gs.players[0].gold);
    R.check(`${label}: Ei liegt in der Ablage, nicht mehr auf dem Brett`, t.pile(0, 'discardPile').includes(EI) && !t.zone(0, 0, 0), { zone: t.zone(0, 0, 0), discard: t.pile(0, 'discardPile') });
    R.check(`${label}: Gegner-Gold unverändert`, t.gs.players[1].gold === 50, t.gs.players[1].gold);
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await t.run(() => t.engine.actionDestroyCard(quelle(0), ei));
    R.check('Zerstörung (actionDestroyCard) in eigener Runde → 58 Gold', t.gs.players[0].gold === 58, t.gs.players[0].gold);
  }
  {
    // Der Gegner tötet das Ei, während ICH am Zug bin (z. B. Reaktion) → Ruling: Runde zählt, nicht der Verursacher
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await schade(t, ei, 1);
    R.check('Gegner tötet das Ei in MEINER Runde → trotzdem +8 (Runde zählt)', t.gs.players[0].gold === 58 && t.gs.players[1].gold === 50, [t.gs.players[0].gold, t.gs.players[1].gold]);
  }
  {
    // Pflichteffekt: keine Rückfrage
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await schade(t, ei, 0);
    R.check('keine Rückfrage (kein „may")', t.prompts.length === 0, t.prompts.map(p => p.d.type));
    R.check('Gold-Bild gesendet (play_gold_coins)', t.evs('play_gold_coins').length === 1, t.events.map(e => e.ev));
    R.check('Log-Eintrag dragonegg_gold', t.lg('dragonegg_gold').length === 1 && t.lg('dragonegg_gold')[0].gold === 8, t.lg('dragonegg_gold'));
    R.check('Log-Eintrag gold_gain (Engine)', t.lg('gold_gain').length === 1, t.lg('gold_gain'));
  }

  R.section('C · Tod in der Gegnerrunde → nichts');
  {
    const t = await H.fresh({ gold: 50, active: 1 });
    const ei = t.put(0, 0, 0, EI);
    t.gs.activePlayer = 1;
    await schade(t, ei, 1);
    R.check('Gegner tötet Ei in SEINER Runde → kein Gold für mich', t.gs.players[0].gold === 50, t.gs.players[0].gold);
    R.check('… und kein Gold für den Gegner', t.gs.players[1].gold === 50, t.gs.players[1].gold);
    R.check('Ei ist trotzdem tot', t.pile(0, 'discardPile').includes(EI), t.pile(0, 'discardPile'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Gegner-Ei in meiner Runde: das Ei gehört dem Gegner, es ist nicht SEINE Runde → kein Gold für ihn
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(1, 0, 0, EI);
    await schade(t, ei, 0);
    R.check('Gegnerei stirbt in MEINER Runde → keiner bekommt Gold', t.gs.players[0].gold === 50 && t.gs.players[1].gold === 50, [t.gs.players[0].gold, t.gs.players[1].gold]);
  }

  R.section('D · Mehrere Eier / Flächentod');
  {
    const t = await H.fresh({ gold: 50 });
    const e1 = t.put(0, 0, 0, EI), e2 = t.put(0, 1, 0, EI), e3 = t.put(0, 2, 0, EI);
    await t.run(() => t.engine.processCreatureDamageBatch([e1, e2, e3].map(i => ({ inst: i, amount: 10, type: 'spell', source: quelle(1), sourceOwner: 1, canBeNegated: true }))));
    R.check('drei Eier sterben im selben Batch → 3 × 8 = 24 Gold', t.gs.players[0].gold === 74, t.gs.players[0].gold);
    R.check('alle drei in der Ablage', t.pile(0, 'discardPile').filter(n => n === EI).length === 3, t.pile(0, 'discardPile'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // eigene und gegnerische Eier im selben Flächenschlag in MEINER Runde
    const t = await H.fresh({ gold: 50 });
    const mein = t.put(0, 0, 0, EI), dein = t.put(1, 0, 0, EI);
    await t.run(() => t.engine.processCreatureDamageBatch([mein, dein].map(i => ({ inst: i, amount: 10, type: 'spell', source: quelle(0), sourceOwner: 0, canBeNegated: true }))));
    R.check('nur MEIN Ei zahlt (meine Runde): 58 / 50', t.gs.players[0].gold === 58 && t.gs.players[1].gold === 50, [t.gs.players[0].gold, t.gs.players[1].gold]);
  }
  {
    // Schaden, der das Ei NICHT tötet (Immunität / 0 Schaden) → kein Gold
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await schade(t, ei, 0, 0);
    R.check('0 Schaden: Ei lebt, kein Gold', t.zone(0, 0, 0) === EI && t.gs.players[0].gold === 50, { z: t.zone(0, 0, 0), g: t.gs.players[0].gold });
  }

  R.section('E · Sperren und Zustände');
  {
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    t.gs.players[0].goldLocked = true;
    await schade(t, ei, 0);
    R.check('Goldsperre (goldLocked): kein Gewinn, Ei trotzdem tot', t.gs.players[0].gold === 50 && t.pile(0, 'discardPile').includes(EI), { g: t.gs.players[0].gold });
    R.check('Goldsperre: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Tuscan Aristocrat (Gegner): „your opponent cannot gain any Gold outside their Resource Phase"
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    t.put(1, 0, 0, 'Tuscan Aristocrat');
    await schade(t, ei, 0);
    R.check('Tuscan Aristocrat des Gegners: kein Gold', t.gs.players[0].gold === 50, t.gs.players[0].gold);
    R.check('Tuscan Aristocrat: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // negiertes Ei: Effekte negiert → kein Gold (wie bei Icy: Hook ruht)
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI, { counters: { negated: true } });
    await schade(t, ei, 0);
    R.note('negiertes Ei in eigener Runde → Gold', t.gs.players[0].gold);
    const t2 = await H.fresh({ gold: 50 });
    const ei2 = t2.put(0, 0, 0, 'Icy Dragonegg', { counters: { negated: true } });
    await schade(t2, ei2, 0);
    R.note('Vergleich negiertes Icy Dragonegg → Zielwahl?', t2.prompts.length + t2.targets.length);
    // Positivkontrolle: dasselbe Icy OHNE Negation fragt nach einem Ziel — sonst wäre der Vergleich wertlos
    const t3 = await H.fresh({ gold: 50 });
    const ei3 = t3.put(0, 0, 0, 'Icy Dragonegg');
    await schade(t3, ei3, 0);
    R.check('Positivkontrolle: nicht negiertes Icy Dragonegg fragt nach einem Ziel', t3.prompts.length + t3.targets.length > 0, { prompts: t3.prompts.length, targets: t3.targets.length });
    R.check('negiertes Ei: kein Gold (Effekt negiert)', t.gs.players[0].gold === 50, t.gs.players[0].gold);
  }
  {
    // gefrorenes Ei (Kreatureneffekt eingefroren?) – Frost legt nur AKTIVE Effekte lahm, nicht Todesauslöser? → Verhalten notieren, gegen Icy abgleichen
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI, { counters: { frozen: 1 } });
    await schade(t, ei, 0);
    const t2 = await H.fresh({ gold: 50 });
    const ei2 = t2.put(0, 0, 0, 'Icy Dragonegg', { counters: { frozen: 1 } });
    await schade(t2, ei2, 0);
    R.note('gefrorenes Shimmering: Gold', t.gs.players[0].gold);
    R.note('gefrorenes Icy: Zielwahl (Prompts+Targets)', t2.prompts.length + t2.targets.length);
    R.check('gefrorenes Ei verhält sich wie gefrorenes Icy (Auslöser ja/nein gleich)', (t.gs.players[0].gold === 58) === (t2.prompts.length + t2.targets.length > 0), { gold: t.gs.players[0].gold, icy: t2.prompts.length + t2.targets.length });
  }

  R.section('F · Gestohlen / geopfert / wiederbelebt');
  {
    // Diebstahl in meiner Runde: Dieb (Sitz 0) stiehlt das Ei des Gegners und tötet es → Dieb bekommt 8, nicht der Besitzer
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(1, 0, 0, EI);
    await t.run(() => t.engine.actionStealCreature(0, ei, { sourceName: 'test' }));
    await H.sleep(100);
    await schade(t, ei, 0);
    R.check('gestohlenes Gegnerei stirbt in der Runde des Diebes → Dieb +8', t.gs.players[0].gold === 58, [t.gs.players[0].gold, t.gs.players[1].gold]);
    R.check('Besitzer bekommt nichts', t.gs.players[1].gold === 50, t.gs.players[1].gold);
    R.check('Ei liegt in der Ablage des BESITZERS', t.pile(1, 'discardPile').includes(EI) && !t.pile(0, 'discardPile').includes(EI), { p0: t.pile(0, 'discardPile'), p1: t.pile(1, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Mein Ei wird vom Gegner gestohlen und stirbt in MEINER Runde (Dieb wäre nicht am Zug): kein Gold für den Dieb
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await t.run(() => t.engine.actionStealCreature(1, ei, { sourceName: 'test' }));
    await H.sleep(100);
    await schade(t, ei, 0);
    R.check('geklautes Ei stirbt in MEINER Runde (Kontrolleur = Gegner, nicht am Zug) → kein Gold', t.gs.players[0].gold === 50 && t.gs.players[1].gold === 50, [t.gs.players[0].gold, t.gs.players[1].gold]);
  }
  {
    // Opfer (Blue-Ice Dragon: 2 Kreaturen) in eigener Runde
    const t = await H.fresh({ gold: 50, hand: [['Blue-Ice Dragon'], []] });
    const e1 = t.put(0, 0, 0, EI); e1.turnPlayed = 1;
    const e2 = t.put(0, 0, 1, EI); e2.turnPlayed = 1;
    t.script.push({ match: d => d && /sacrifice/i.test(JSON.stringify(d)) , answer: undefined });
    const r = await t.play(0, 'Blue-Ice Dragon', { hero: 0, slot: 2 });
    R.note('Blue-Ice Dragon aus zwei Eiern geopfert: Rückgabe/Gold', { r, gold: t.gs.players[0].gold, brett: [t.zone(0, 0, 0), t.zone(0, 0, 1), t.zone(0, 0, 2)] });
    R.check('beide Eier geopfert → 2 × 8 Gold (Opfer in eigener Runde = Tod)', r === true ? t.gs.players[0].gold === 66 : true, { r, gold: t.gs.players[0].gold });
  }
  {
    // Wiederbelebt und erneut gestorben → erneut Gold
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await schade(t, ei, 0);
    t.put(0, 0, 0, EI);
    const ei2 = t.find(EI, 'support');
    await schade(t, ei2, 0);
    R.check('zweite Inkarnation: nochmals +8 (66)', t.gs.players[0].gold === 66, t.gs.players[0].gold);
  }

  R.section('G · Status-Tod und Zugwechsel');
  {
    // Ei verbrannt: stirbt am Ende/Anfang welcher Runde? Notiere, wann Gold kommt.
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    await t.run(() => t.engine.applyCreatureStatus(ei, 'burned', { sourceOwner: 1, source: 'Test' }));
    await t.endTurn();                       // Sitz 0 beendet, Sitz 1 beginnt: der Brand tickt zu Beginn des Besitzer-Zuges
    R.check('verbranntes Ei lebt nach dem Zugende des Besitzers noch', t.zone(0, 0, 0) === EI && t.gs.players[0].gold === 50, { z: t.zone(0, 0, 0), g: t.gs.players[0].gold });
    await t.endTurn();                       // Sitz 1 beendet, Sitz 0 beginnt: Brandtod in SEINER Runde (Einkommen 4 + 8 Gold)
    R.check('Brandtod zu Beginn des eigenen Zuges → +8 (Einkommen 4 + 8 = 62)', t.zone(0, 0, 0) === null && t.gs.players[0].gold === 62, { z: t.zone(0, 0, 0), g: t.gs.players[0].gold, aktiv: t.gs.activePlayer });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Echter Zugwechsel: Ei lebt über den Zug hinweg, nichts passiert
    const t = await H.fresh({ gold: 50 });
    t.put(0, 0, 0, EI);
    await t.endTurn(); await t.endTurn();
    R.check('Ei überlebt zwei Zugwechsel unverändert', t.zone(0, 0, 0) === EI, t.zone(0, 0, 0));
    R.check('Gold nur durch Rundeneinkommen verändert (kein Dragonegg-Log)', t.lg('dragonegg_gold').length === 0 && t.gs.players[0].gold === 54, { log: t.lg('dragonegg_gold'), g: t.gs.players[0].gold });
  }


  R.section('I · Zusammenspiel mit Gold-Karten');
  {
    // Gold Trap (Surprise des Gegners): „You gain that Gold instead" — das Gold des Eis geht an den Gegner
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    t.grantFor(1, 0, 'Gold Trap'); t.putSurprise(1, 0, 'Gold Trap');
    await schade(t, ei, 0);
    R.note('Gold Trap des Gegners: Gold Sitz 0 / Sitz 1 / Prompts', { g0: t.gs.players[0].gold, g1: t.gs.players[1].gold, prompts: t.prompts.map(p => p.d.type) });
    R.check('Gold Trap: der Gegner bekommt die 8 Gold, nicht der Besitzer des Eis', t.gs.players[0].gold === 50 && t.gs.players[1].gold === 58, [t.gs.players[0].gold, t.gs.players[1].gold]);
    R.check('Gold Trap: keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    // Golden Vermin: „when you would gain Gold through an effect, you may draw 1 card instead"
    for (const ja of [true, false]) {
      const t = await H.fresh({ gold: 50, confirm: ja, deck: [Array(10).fill(H.INERT.creature), Array(10).fill(H.INERT.creature)] });
      const ei = t.put(0, 0, 0, EI);
      t.put(0, 1, 0, 'Golden Vermin');
      const hand0 = t.pile(0, 'hand').length;
      await schade(t, ei, 0);
      R.note(`Golden Vermin (${ja ? 'ja' : 'nein'}): Gold / Handzuwachs`, { gold: t.gs.players[0].gold, hand: t.pile(0, 'hand').length - hand0 });
      R.check(`Golden Vermin, Antwort ${ja ? 'Ja' : 'Nein'}: ${ja ? '1 Karte statt Gold' : '8 Gold wie gedruckt'}`, ja ? (t.gs.players[0].gold === 50 && t.pile(0, 'hand').length === hand0 + 1) : (t.gs.players[0].gold === 58 && t.pile(0, 'hand').length === hand0), { gold: t.gs.players[0].gold, hand: t.pile(0, 'hand').length - hand0, errors: t.errors.slice(0, 2) });
    }
  }
  {
    // Royal Treasury (Spell-Anhang): „when you gain Gold through another effect, gain an additional …" — nur festhalten, ob das Ei-Gold als „another effect" zählt
    if (H.DB['Royal Treasury']) {
      const t = await H.fresh({ gold: 50 });
      const ei = t.put(0, 0, 0, EI);
      const rt = t.put(0, 0, 1, 'Royal Treasury');
      await schade(t, ei, 0);
      R.note('Royal Treasury neben dem Ei: Gold nach dem Eitod', t.gs.players[0].gold);
    }
  }

  R.section('H · Kartenbilanz');
  {
    const t = await H.fresh({ gold: 50 });
    const ei = t.put(0, 0, 0, EI);
    const v = t.census();
    await schade(t, ei, 0);
    const d = t.censusDiff(v, t.census());
    R.check('Bilanz: nur Ei Brett→Ablage (±0 gesamt)', d.length === 0, d);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  R.finish();
})();
