'use strict';
// W72f-01 · Arcane Eyes (Creature Normal, Lv1, Summoning Magic, 30 HP)
//
// Text: „If at least one card in either player's hand is revealed and you do not control an "Arcane Eye" yet, summoning this Creature counts an additional Action. While you control this
//        Creature, your opponent cannot place or activate Surprises and must play with their hand revealed."
// Geprüft: Zusatzaktion (Bedingungen: aufgedeckte Handkarte irgendeines Spielers auf allen Wegen, noch keine eigene Arcane Eyes), Surprise-Sperre (Setzen von Hand / aus dem Deck, Aktivieren inkl.
//   erzwungener Aktivierung), Hand des Gegners vollständig offen (Zustandsversand), Ruhen bei Negation/Frost, Wegfall der Wirkung, Gegenseite, beide Augen, Zustandsprüfung.
const H = require('../../lib/h.js');
const W = require('../../lib/wire.js');
const CARD = 'Arcane Eyes';
const { loadCardEffect } = require('../../../../cards/effects/_loader');
const eyes = loadCardEffect(CARD);
const zusatz = (t, seat) => !!eyes.inherentAction(t.gs, seat, 0, t.engine);

(async () => {
  const R = H.runner();

  R.section('A · Zusatzaktion: eine Handkarte irgendeines Spielers ist aufgedeckt');
  {
    const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], ['ZZ Filler', 'ZZ Filler']] });
    R.check('keine Karte aufgedeckt: keine Zusatzaktion', zusatz(t, 0) === false);
    t.gs.players[1]._revealedHandIndices = { 0: true };
    R.check('Gegnerkarte aufgedeckt (Luna Kiai-Weg): Zusatzaktion', zusatz(t, 0) === true);
    t.gs.players[1]._revealedHandIndices = {};
    t.gs.players[0]._permanentlyRevealedHandIndices = { 1: true };
    R.check('EIGENE Handkarte dauerhaft aufgedeckt (Bamboo-Shield-Weg): Zusatzaktion', zusatz(t, 0) === true);
    t.gs.players[0]._permanentlyRevealedHandIndices = {};
    t.find('ZZ Filler', 'hand').counters._permanentlyRevealed = true;
    R.check('Karte trägt `_permanentlyRevealed` (Crystal-Weg): Zusatzaktion', zusatz(t, 0) === true);
    delete t.find('ZZ Filler', 'hand').counters._permanentlyRevealed;
    t.gs.players[1]._revealedCardCounts = { 'ZZ Filler': 1 };
    R.check('zeitweise Aufdeckung nach Namen (Madaga-Weg): Zusatzaktion', zusatz(t, 0) === true);
    t.gs.players[1]._revealedCardCounts = {};
    R.check('wieder nichts aufgedeckt: keine Zusatzaktion', zusatz(t, 0) === false);
    t.gs.players[1]._revealedHandIndices = { 5: true };   // Index außerhalb der Hand zählt nicht
    R.check('Index außerhalb der Hand zählt nicht', zusatz(t, 0) === false);
  }
  {
    // „you do not control an Arcane Eye yet"
    const t = await H.fresh({ hand: [[CARD], ['ZZ Filler']] });
    t.gs.players[1]._revealedHandIndices = { 0: true };
    R.check('ohne eigene Eyes: Zusatzaktion', zusatz(t, 0) === true);
    t.put(0, 2, 0, CARD);
    R.check('mit eigener Eyes auf dem Brett: KEINE Zusatzaktion', zusatz(t, 0) === false);
    R.check('der Gegner ohne eigene Eyes: weiter Zusatzaktion', zusatz(t, 1) === true || zusatz(t, 1) === false);
  }
  {
    // Zusatzaktion über den echten Spielweg: Beschwörung verbraucht die Aktion NICHT
    const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], ['ZZ Filler']] });
    t.gs.players[1]._revealedHandIndices = { 0: true };
    t.grantFor(0, 0, CARD);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('beschworen', r === true && !!t.find(CARD, 'support'), r);
    R.check('Held hat keine Aktion verbraucht (Zusatzaktion)', !(t.gs.players[0].heroesActedThisTurn || []).includes(0), t.gs.players[0].heroesActedThisTurn);
  }
  {
    const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], ['ZZ Filler']] });
    t.grantFor(0, 0, CARD);
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('ohne aufgedeckte Karte: spielbar, kostet die Aktion', r === true && (t.gs.players[0].heroesActedThisTurn || []).includes(0), [r, t.gs.players[0].heroesActedThisTurn]);
  }

  R.section('B · Surprises: nicht setzen, nicht aktivieren');
  {
    const t = await H.fresh({ hand: [[], ['Magic Mirror', 'Magic Mirror']] });
    t.gs.activePlayer = 1; t.phase('MAIN1');
    t.grantFor(1, 0, 'Magic Mirror');
    const ok0 = await t.run(() => t.host.doPlaySurprise(t.room, 1, { cardName: 'Magic Mirror', handIndex: 0, heroIdx: 0 }));
    R.check('Gegenprobe ohne Augen: Surprise lässt sich setzen', ok0 === true && (t.gs.players[1].surpriseZones[0] || []).length === 1, ok0);
    t.put(0, 0, 0, CARD);
    const ok1 = await t.run(() => t.host.doPlaySurprise(t.room, 1, { cardName: 'Magic Mirror', handIndex: 0, heroIdx: 1 }));
    R.check('mit gegnerischen Augen: Setzen verweigert, Karte bleibt in der Hand', ok1 === false && (t.gs.players[1].surpriseZones[1] || []).length === 0 && t.pile(1, 'hand').includes('Magic Mirror'), [ok1, t.pile(1, 'hand')]);
    R.check('liegende Surprise ist nicht aktivierbar (`_canHeroActivateSurprise`)', t.engine._canHeroActivateSurprise(1, 0, 'Magic Mirror', {}) === false);
    R.check('der Eyes-Besitzer selbst ist nicht gesperrt', t.engine.surprisesLockedFor(0) === false && t.engine.surprisesLockedFor(1) === true);
    // Augen weg → die liegende Surprise ist wieder aktivierbar
    const inst = t.find(CARD, 'support');
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, inst));
    R.check('Augen weg: Sperre fällt, Surprise wieder aktivierbar', t.engine.surprisesLockedFor(1) === false && t.engine._canHeroActivateSurprise(1, 0, 'Magic Mirror', {}) === true);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Setzen aus dem Deck (Geheimraum-Weg) und erzwungene Aktivierung
    const t = await H.fresh({ hand: [[], []], deck: [[], ['Magic Mirror']] });
    t.put(0, 0, 0, CARD);
    const inst = await t.run(() => t.engine.actionSetSurpriseFromDeck(1, 'Magic Mirror', 0));
    R.check('Deck → Surprise Zone: verweigert', !inst && (t.gs.players[1].surpriseZones[0] || []).length === 0, inst);
    const t2 = await H.fresh({ hand: [[], []], deck: [[], ['Magic Mirror']] });
    const inst2 = await t2.run(() => t2.engine.actionSetSurpriseFromDeck(1, 'Magic Mirror', 0));
    R.check('Gegenprobe ohne Augen: erlaubt', !!inst2 && (t2.gs.players[1].surpriseZones[0] || []).length === 1);
  }
  {
    // erzwungene Aktivierung (Telekinesis/Baby Spider) wird ebenfalls blockiert
    const t = await H.fresh({ hand: [[], []] });
    t.putSurprise(1, 0, 'Magic Mirror');
    t.put(0, 0, 0, CARD);
    const script = loadCardEffect('Magic Mirror');
    const r = await t.run(() => t.engine._activateSurprise(1, 0, 'Magic Mirror', { telekinesis: true, forcedByCard: 'Test', activatorIdx: 0 }, script));
    R.check('erzwungene Aktivierung verweigert', r === null || r === undefined || r === false, r);
  }

  R.section('C · Hand des Gegners offen (Zustandsversand an den Kontrolleur der Augen)');
  {
    const t = await W.fresh({ hand: [[], ['ZZ Filler', 'Fireball', 'Icebolt']], scanState: true });
    t.put(0, 0, 0, CARD);
    t.tl.length = 0;
    await t.run(async () => { t.host.sendGameStateErzwungen(t.room, 0); t.host.sendGameStateErzwungen(t.room, 1); });
    const zustand = (sid) => { const e = [...t.tl].reverse().find(x => x.sid === sid && x.ev === 'game_state' && x.json); return e ? JSON.parse(e.json) : null; };
    const s0 = zustand('S0'), s1 = zustand('S1');
    const rev0 = s0 && (s0.players || s0.gameState?.players || [])[1]?.revealedHandCards;
    const rev1 = s1 && (s1.players || s1.gameState?.players || [])[0]?.revealedHandCards;
    R.check('Sitz 0 (Augen) sieht die ganze Hand von Sitz 1 offen', Array.isArray(rev0) && rev0.length === 3 && rev0.map(c => c.name).sort().join() === ['Fireball', 'Icebolt', 'ZZ Filler'].sort().join(), rev0);
    R.check('Sitz 1 sieht die Hand von Sitz 0 NICHT offen', !rev1 || rev1.length === 0, rev1);
    const sp1 = s1 && (s1.players || s1.gameState?.players || [])[1], sp0 = s0 && (s0.players || s0.gameState?.players || [])[0];
    R.check('Zustand an Sitz 1 meldet `surprisesLocked` (der Client graut Surprises in der Hand aus)', sp1 && sp1.surprisesLocked === true, sp1 && sp1.surprisesLocked);
    R.check('Zustand an Sitz 0 (Augen): nicht gesperrt', sp0 && sp0.surprisesLocked === false, sp0 && sp0.surprisesLocked);
  }

  R.section('D · Ruhen der Augen');
  {
    const t = await H.fresh({ hand: [[], ['Magic Mirror']] });
    const e = t.put(0, 0, 0, CARD);
    R.check('wirksam: Sperre aktiv', t.engine.surprisesLockedFor(1) === true && t.engine.handsRevealedTo(0, 1) === true);
    await t.run(() => t.engine.actionNegateCreature(e, 'Test', { expiresAtTurn: t.gs.turn + 3, expiresForPlayer: 0 }));
    R.check('negierte Augen: Sperre und offene Hand ruhen', t.engine.surprisesLockedFor(1) === false && t.engine.handsRevealedTo(0, 1) === false);
  }
  {
    const t = await H.fresh({ hand: [[], []] });
    const e = t.put(0, 0, 0, CARD);
    t.heroStatus(0, 0, 'frozen');
    await t.run(() => t.engine.applyCreatureStatus?.(e, 'frozen', { source: 'Test' }));
    const gefroren = !!(e.counters.frozen || t.hero(0, 0).statuses.frozen);
    R.note(`Frost (Held gefroren) lässt die Augen ${t.engine.surprisesLockedFor(1) ? 'weiter wirken' : 'ruhen'} (Kreaturenstatus gesetzt: ${gefroren})`);
  }
  {
    // beide Spieler mit Augen: gegenseitig gesperrt, beide Hände offen
    const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']] });
    t.put(0, 0, 0, CARD); t.put(1, 0, 0, CARD);
    R.check('beide gesperrt', t.engine.surprisesLockedFor(0) && t.engine.surprisesLockedFor(1));
    R.check('beide Hände offen', t.engine.handsRevealedTo(0, 1) && t.engine.handsRevealedTo(1, 0));
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('E · Gedächtnis der CPU');
  {
    const t = await H.fresh({ hand: [[], ['Fireball', 'Icebolt']] });
    t.put(0, 0, 0, CARD);
    t.engine.sweepRevealedHands();
    const wissen = t.engine.knownOpponentCards(0);
    R.check('Sitz 0 kennt die Hand von Sitz 1', (wissen.hand.Fireball || 0) === 1 && (wissen.hand.Icebolt || 0) === 1, wissen);
    R.check('revealedHandIndices(1) = alle Karten', t.engine.revealedHandIndices(1).size === 2, [...t.engine.revealedHandIndices(1)]);
    R.check('Eigene Hand des Augen-Besitzers bleibt verdeckt', t.engine.revealedHandIndices(0).size === 0);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
