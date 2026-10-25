'use strict';
// W64c-04 · Bounce einer gestohlenen/übernommenen Kreatur geht in die HAND IHRES KONTROLLEURS, die Herkunft bleibt (Al, 23.10.2026)
//
// Entscheidung: „Bounce geht an den aktuellen Kontrolleur" — eine Kreatur, die vom Brett auf die Hand zurückgeht (return to hand, Bounce, Deepsea-Tausch, Selbst-Bounce …),
// landet in der Hand des Spielers, der sie kontrolliert (Diplomacy, Dark Gear, Charme, Hunting, Kontrollwechsel). Sie trägt weiter ihren permanenten Besitzer (Platzmarke
// `_handOriginals`): Abwerfen, Löschen, Spielen, Mischen, Mulligan → STAPEL des Besitzers (Regel „Karten gehen IMMER in die Stapel ihres permanenten Besitzers").
// Selbst-Bounce-Kreaturen (Moonlight Butterfly, Winged Skeleton): ihr Effekt wird nur vom aktuellen KONTROLLEUR ausgelöst/gefragt (W33a), nicht vom Besitzer.
// Wege: `returnSupportCreatureToHand` (Racket Arrow, Deepsea Encounter/Monstrosity, Divine Gift of the Deepsea …), `actionMoveCard` Brett → Hand, Deepsea-Tausch
// (`tryBouncePlace`: Deepsea Skeleton), Moonlight Butterfly, Winged Skeleton, Dark Deepsea God (Tribut).
// Exit 0 = korrekt.
const B = require('../../lib/besitzer.js');
const { H } = B;
const { returnSupportCreatureToHand } = require('../../../../cards/effects/_deepsea-shared.js');
process.on('unhandledRejection', e => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });
(async () => {
  const R = H.runner();
  const decks = [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')];
  /** Szene: `name` gehört `besitzer`, wird dauerhaft von `ktrl` übernommen (echter Weg actionTransferCreature). */
  const gestohlen = async (name, ktrl, o = {}) => {
    const besitzer = 1 - ktrl;
    const t = await H.fresh({ gold: [100, 100], deck: decks, ...(o.fresh || {}) });
    const w = B.waechter(t);
    t.ktrl = ktrl; t.besitzer = besitzer;
    const inst = t.put(besitzer, 0, 0, name); inst.turnPlayed = 1;
    const r = await t.run(() => t.engine.actionTransferCreature(inst, ktrl, 0, 0, { _skipAffectedWindow: true }));   // W71b: Testaufbau ohne Verursacher — kein Schutzfenster (Winged Skeleton würde sonst die Übernahme selbst negieren)
    R.check(`${name}: von Sitz ${ktrl} übernommen`, r && r.success && inst.controller === ktrl && inst.originalOwner === besitzer, { r: r && r.success, c: inst.controller, o: inst.originalOwner });
    return { t, w, inst };
  };
  const ort = (t, n) => B.ort(t, n);
  const amHand = (t, seat, n) => B.anzahl(t, seat, 'hand', n) === 1 && B.anzahl(t, 1 - seat, 'hand', n) === 0;
  const dannAbwerfen = async (t, label, n) => {
    await t.run(() => t.engine.actionDiscardHandCard(t.ktrl, n, t.pile(t.ktrl, 'hand').indexOf(n), {}));
    B.erwarteStapel(R, t, label, n, t.besitzer, 'discardPile');
  };

  for (const ktrl of [0, 1]) {
    R.section(`══ Kontrolleur = Sitz ${ktrl}, Besitzer = Sitz ${1 - ktrl} ══`);
    // 1) returnSupportCreatureToHand (Standardweg ohne „YOUR hand": Racket Arrow, Deepsea Encounter/Monstrosity, Divine Gift …)
    {
      const { t, w } = await gestohlen('ZZ Dummy', ktrl);
      await t.run(() => returnSupportCreatureToHand(t.engine, t.engine.cardInstances.find(c => c.name === 'ZZ Dummy' && c.zone === 'support'), 'Test', {}));
      R.check(`returnSupportCreatureToHand: Hand des KONTROLLEURS (Sitz ${ktrl})`, amHand(t, ktrl, 'ZZ Dummy'), ort(t, 'ZZ Dummy'));
      R.check('  Herkunft bleibt: Platzmarke = Besitzer', Object.values(t.gs.players[ktrl]._handOriginals || {}).some(o => o && o.n === 'ZZ Dummy' && o.o === t.besitzer), t.gs.players[ktrl]._handOriginals);
      await dannAbwerfen(t, `  Rückgabe → Abwerfen (Kontrolleur ${ktrl})`, 'ZZ Dummy');
      R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
    }
    // 2) actionMoveCard Brett → Hand
    {
      const { t, w } = await gestohlen('ZZ Dummy', ktrl);
      const inst = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy' && c.zone === 'support');
      await t.run(() => t.engine.actionMoveCard(inst, 'hand', -1, -1, { source: 'Test' }));
      R.check(`actionMoveCard Brett → Hand: Hand des KONTROLLEURS (Sitz ${ktrl})`, amHand(t, ktrl, 'ZZ Dummy'), ort(t, 'ZZ Dummy'));
      await dannAbwerfen(t, `  actionMoveCard → Abwerfen (Kontrolleur ${ktrl})`, 'ZZ Dummy');
      R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
    }
    // 3) Rückgabe, dann wieder zurückmischen / Zwangslöschen / Spielen: immer Stapel des Besitzers
    {
      const { t } = await gestohlen('ZZ Dummy', ktrl);
      await t.run(() => returnSupportCreatureToHand(t.engine, t.engine.cardInstances.find(c => c.name === 'ZZ Dummy' && c.zone === 'support'), 'Test', {}));
      await t.run(() => t.engine.actionShuffleBackToDeck(ktrl, ['ZZ Dummy'], 'Test'));
      B.erwarteStapel(R, t, `Rückgabe → zurück ins Deck (Kontrolleur ${ktrl})`, 'ZZ Dummy', t.besitzer, 'mainDeck');
    }
    {
      const { t } = await gestohlen('ZZ Dummy', ktrl);
      await t.run(() => returnSupportCreatureToHand(t.engine, t.engine.cardInstances.find(c => c.name === 'ZZ Dummy' && c.zone === 'support'), 'Test', {}));
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'ZZ Dummy', handIndex: t.pile(ktrl, 'hand').indexOf('ZZ Dummy') }) });
      await t.run(() => t.engine.actionPromptForceDiscard(ktrl, 1, { selfInflicted: true, deleteMode: true }));
      B.erwarteStapel(R, t, `Rückgabe → Zwangs-Löschen (Kontrolleur ${ktrl})`, 'ZZ Dummy', t.besitzer, 'deletedPile');
    }
    // 4) Deepsea-Tausch (Bounce-Place): Deepsea Skeleton ersetzt die übernommene Deepsea Stein; sie geht in die Hand des Kontrolleurs, Herkunft bleibt
    {
      const { t, w } = await gestohlen('Deepsea Stein', ktrl, { fresh: { hand: ktrl === 0 ? [['Deepsea Skeleton'], []] : [[], ['Deepsea Skeleton']] } });
      t.gs.turn = 7;
      await t.play(ktrl, 'Deepsea Skeleton', { hero: 0, slot: 0 });
      R.check(`Deepsea-Tausch: übernommene Deepsea Stein in der Hand des Kontrolleurs (Sitz ${ktrl})`, amHand(t, ktrl, 'Deepsea Stein'), ort(t, 'Deepsea Stein'));
      await dannAbwerfen(t, `  Deepsea-Tausch → Abwerfen (Kontrolleur ${ktrl})`, 'Deepsea Stein');
      R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
    }

    // 5) Selbst-Bounce: Moonlight Butterfly („At the end of your opponent's turn, you may add this Creature you control back to your hand") — gefragt wird nur der KONTROLLEUR
    {
      const { t, w } = await gestohlen('Moonlight Butterfly', ktrl);
      const fragen = () => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === 'Moonlight Butterfly').map(p => p.pi);
      // Zugende des KONTROLLEURS: für ihn ist es der eigene Zug, für den Besitzer „der Zug des Gegners" — niemand wird gefragt
      t.gs.activePlayer = ktrl; await t.endTurn();
      R.check(`Moonlight Butterfly: am Ende des Zuges des Kontrolleurs (Sitz ${ktrl}) wird NIEMAND gefragt`, fragen().length === 0, fragen());
      R.check('  Falter liegt noch auf dem Brett', t.engine.cardInstances.some(c => c.name === 'Moonlight Butterfly' && c.zone === 'support'), ort(t, 'Moonlight Butterfly'));
      // Zugende des GEGNERS des Kontrolleurs (= des Besitzers): der Kontrolleur wird gefragt, nicht der Besitzer
      t.reset(); t.gs.activePlayer = t.besitzer; await t.endTurn();
      R.check(`Moonlight Butterfly: am Ende des Zuges des Besitzers (Sitz ${t.besitzer}) fragt der Falter den KONTROLLEUR (Sitz ${ktrl})`, fragen().length >= 1 && fragen().every(pi => pi === ktrl), fragen());
      R.check(`  Falter auf der Hand des Kontrolleurs (Sitz ${ktrl}), Herkunft = Besitzer`, amHand(t, ktrl, 'Moonlight Butterfly') && Object.values(t.gs.players[ktrl]._handOriginals || {}).some(o => o && o.n === 'Moonlight Butterfly' && o.o === t.besitzer), ort(t, 'Moonlight Butterfly'));
      await dannAbwerfen(t, `  Falter abgeworfen (Kontrolleur ${ktrl})`, 'Moonlight Butterfly');
      R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
    }
    // 6) Selbst-Bounce: Winged Skeleton — reagiert nur für den KONTROLLEUR; die zurückgegebene Kreatur geht in dessen Hand, Herkunft bleibt
    {
      // a) übernommener Winged Skeleton (Kontrolleur ktrl) schützt ein eigenes Skelett des Kontrolleurs; der Besitzer greift an
      const { t, w } = await gestohlen('Winged Skeleton', ktrl);
      const eigen = t.put(ktrl, 1, 0, 'Winged Skeleton'); eigen.turnPlayed = 1;
      const geschuetzt = eigen;
      t.gs.activePlayer = t.besitzer;
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: t.besitzer }, geschuetzt, 30, 'fire'));
      const frag = t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === 'Winged Skeleton').map(p => p.pi);
      R.check(`Winged Skeleton (übernommen): fragt den KONTROLLEUR (Sitz ${ktrl}), nie den Besitzer`, frag.length >= 1 && frag.every(pi => pi === ktrl), frag);
      R.check(`  das geschützte eigene Skelett liegt in der Hand des Kontrolleurs (Sitz ${ktrl})`, B.anzahl(t, ktrl, 'hand', 'Winged Skeleton') === 1, ort(t, 'Winged Skeleton'));
    }
    {
      // b) das GESCHÜTZTE Skelett ist die übernommene Kreatur: Hand des Kontrolleurs, Herkunft = Besitzer, später Ablage des Besitzers
      const { t, w } = await gestohlen('Winged Skeleton', ktrl);
      const schuetzer = t.put(ktrl, 1, 0, 'ZZ Dummy');   // nur ein Platzhalter für den Aufbau, kein Schützer
      t.engine._untrackCard(schuetzer.id); t.gs.players[ktrl].supportZones[1][0] = [];
      const wsk = t.put(ktrl, 1, 0, 'Winged Skeleton'); wsk.turnPlayed = 1;   // zweiter, EIGENER Winged Skeleton des Kontrolleurs als Schützer
      const ziel = t.engine.cardInstances.find(c => c.name === 'Winged Skeleton' && c.zone === 'support' && c.originalOwner === t.besitzer);
      t.gs.activePlayer = t.besitzer;
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: t.besitzer }, ziel, 30, 'fire'));
      R.check(`Winged Skeleton schützt die übernommene Kreatur: Hand des Kontrolleurs (Sitz ${ktrl}), nicht des Besitzers`, B.anzahl(t, ktrl, 'hand', 'Winged Skeleton') === 1 && B.anzahl(t, t.besitzer, 'hand', 'Winged Skeleton') === 0, ort(t, 'Winged Skeleton'));
      R.check('  Herkunft bleibt (Platzmarke = Besitzer)', Object.values(t.gs.players[ktrl]._handOriginals || {}).some(o => o && o.n === 'Winged Skeleton' && o.o === t.besitzer), t.gs.players[ktrl]._handOriginals);
      await dannAbwerfen(t, `  Winged Skeleton abgeworfen (Kontrolleur ${ktrl})`, 'Winged Skeleton');
    }

    // 7) Dark Deepsea God: Tribute = Kreaturen, die der SPIELER AKTUELL KONTROLLIERT (Dark Gear/Diplomacy-Übernahme zählt, die vom Gegner übernommene eigene nicht);
    //    sie gehen in die Hand des Spielers (Kontrolleur), die Herkunft bleibt (übernommene Kreatur → später Ablage des Besitzers)
    {
      const A = 'Carpet Bomblebee', Bn = 'Elven Leader', D = 'Elven Druid';   // A: dem Gegner abgenommen · B: eigene · D: meine, vom Gegner übernommen
      const hand = [[], []]; hand[ktrl] = ['Dark Deepsea God'];
      const t = await H.fresh({ gold: [100, 100], hand, deck: decks });
      const w = B.waechter(t);
      t.ktrl = ktrl; t.besitzer = 1 - ktrl;
      t.gs.turn = 7;
      const a = t.put(t.besitzer, 0, 0, A); a.turnPlayed = 1;
      await t.run(() => t.engine.actionTransferCreature(a, ktrl, 0, 0, {}));
      const b = t.put(ktrl, 0, 1, Bn); b.turnPlayed = 1;
      const d = t.put(ktrl, 1, 0, D); d.turnPlayed = 1;
      await t.run(() => t.engine.actionTransferCreature(d, t.besitzer, 1, 0, {}));
      const kandidat = (seat) => t.engine.getSacrificableCreatures(seat).map(c => c.inst.name).sort();
      R.check(`DDG-Tribute (Sitz ${ktrl}): übernommene ${A} und eigene ${Bn} zählen, die vom Gegner übernommene ${D} nicht`, JSON.stringify(kandidat(ktrl).filter(n => [A, Bn, D].includes(n))) === JSON.stringify([A, Bn].sort()), kandidat(ktrl));
      R.check(`DDG-Tribute (Sitz ${t.besitzer}): nur die von ihm kontrollierte ${D} (nicht die ihm gehörende, aber übernommene ${A})`, JSON.stringify(kandidat(t.besitzer).filter(n => [A, Bn, D].includes(n))) === JSON.stringify([D]), kandidat(t.besitzer));
      t.targetFn = (valid) => valid.filter(v => v.cardName === A || v.cardName === Bn).map(v => v.id);
      t.script.push({ match: d2 => d2.type === 'zonePick', answer: (d2) => { const z = d2.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, ...(z.owner != null ? { owner: z.owner } : {}) }; } });
      await t.play(ktrl, 'Dark Deepsea God', { hero: 0 });
      R.check(`DDG: beide Tribute in der Hand des Spielers (Sitz ${ktrl})`, B.anzahl(t, ktrl, 'hand', A) === 1 && B.anzahl(t, ktrl, 'hand', Bn) === 1, { ort: ort(t, A), b: ort(t, Bn) });
      R.check('  die übernommene Kreatur trägt ihren Besitzer als Herkunft', Object.values(t.gs.players[ktrl]._handOriginals || {}).some(o => o && o.n === A && o.o === t.besitzer), t.gs.players[ktrl]._handOriginals);
      R.check('  die eigene Kreatur trägt keine Fremdherkunft', !Object.values(t.gs.players[ktrl]._handOriginals || {}).some(o => o && o.n === Bn), t.gs.players[ktrl]._handOriginals);
      R.check(`  die vom Gegner übernommene ${D} wurde nicht als Tribut zurückgegeben (nicht auf der Hand; sie stirbt am 150-Schaden und liegt in der Ablage ihres Besitzers, Sitz ${ktrl})`, B.anzahl(t, ktrl, 'hand', D) === 0 && B.anzahl(t, ktrl, 'discardPile', D) === 1, ort(t, D));
      await t.run(() => t.engine.actionDiscardHandCard(ktrl, A, t.pile(ktrl, 'hand').indexOf(A), {}));
      await t.run(() => t.engine.actionDiscardHandCard(ktrl, Bn, t.pile(ktrl, 'hand').indexOf(Bn), {}));
      R.check(`  ${A} abgeworfen → Ablage des Besitzers (Sitz ${t.besitzer}); ${Bn} → eigene Ablage (Sitz ${ktrl})`, B.anzahl(t, t.besitzer, 'discardPile', A) === 1 && B.anzahl(t, ktrl, 'discardPile', Bn) === 1 && B.anzahl(t, ktrl, 'discardPile', A) === 0, { a: ort(t, A), b: ort(t, Bn) });
      R.check('  Besitzer-Wächter ohne Verstoß', w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
      R.check('  keine Engine-Fehler', t.errors.length === 0, t.errors);
    }

    // 8) Deepsea-Kosten („add a Deepsea Creature from one of YOUR Heroes' Support Zones to your hand"): nur Kreaturen, die der Spieler AKTUELL KONTROLLIERT
    {
      const { getBounceableDeepseaCreatures } = require('../../../../cards/effects/_deepsea-shared.js');
      const { t } = await gestohlen('Deepsea Stein', ktrl);
      t.gs.turn = 7;
      const namen = (seat) => getBounceableDeepseaCreatures(t.engine, seat).map(e => e.cardName);
      R.check(`Deepsea-Kosten: der Kontrolleur (Sitz ${ktrl}) darf die übernommene Deepsea Stein zurückgeben`, namen(ktrl).includes('Deepsea Stein'), namen(ktrl));
      R.check(`Deepsea-Kosten: der Besitzer (Sitz ${t.besitzer}) darf sie NICHT (er kontrolliert sie nicht)`, !namen(t.besitzer).includes('Deepsea Stein'), namen(t.besitzer));
    }
  }
  R.finish();
})();
