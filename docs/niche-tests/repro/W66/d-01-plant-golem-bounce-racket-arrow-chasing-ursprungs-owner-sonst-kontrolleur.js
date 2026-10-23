'use strict';
// W66d-01 · Plant Golem: Racket Arrow / Chasing the Legend → Hand des URSPRÜNGLICHEN Owners; allgemeiner Bounce → Hand des Kontrolleurs (Al, 23.10.2026)
//
// Plant Golem („Summon this card into a free Support Zone of a Hero your opponent controls"): der Besitzer S beschwört ihn zum Gegner O. Die Instanz liegt auf dem Brett von O,
// `controller` = O, `owner` = `originalOwner` = S (Ruling 29.8.). Entscheidung Al:
//   · Racket Arrow („return it to its original owner's hand") und Chasing the Legend („Add that Creature to its owner's hand") → Hand des URSPRÜNGLICHEN Owners S
//   · jeder ALLGEMEINE Bounce (returnSupportCreatureToHand ohne toPlayer, actionMoveCard Brett → Hand, Winged Skeleton) → Hand des KONTROLLEURS O, die Herkunft (Platzmarke) bleibt S:
//     späterer Austritt aus der Hand (Abwerfen, Löschen, Spielen/Sterben, Mischen) → Stapel von S
// Geprüft wird jeweils: Hand, Herkunft/Platzmarke, kein Geisternamen auf dem Brett (beide Brettseiten) und keine Geister-Instanz, Aktionssperre des Wirtshelden weg, Besitzer-Wächter ohne Verstoß, t.audit() sauber.
// Spielweg: Golem wirklich über `host.doPlayCreature` mit Server-Hinweis (`_chillyWizardHint`, wie `play_creature` mit crossSideHost) UND ohne Hinweis (Zonenabfrage); beide Sitze.
// Aufruf: node docs/niche-tests/repro/W66/d-01-….js   (Exit 0 = korrekt)
const B = require('../../lib/besitzer.js');
const { H } = B;
const { returnSupportCreatureToHand } = require('../../../../cards/effects/_deepsea-shared.js');
process.on('unhandledRejection', e => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const GOLEM = 'Plant Golem';
const HOST = { heroIdx: 1, slotIdx: 2 };   // Zone auf dem Brett des Gegners, in die der Golem gelegt wird
(async () => {
  const R = H.runner();
  const decks = [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')];

  /** Szene: Besitzer S beschwört den Plant Golem über den Spielweg zu O. `hand`: weitere Karten (je Sitz) · `hinweis`: Server-Hinweis-Zone (sonst Zonenabfrage). */
  const szene = async (S, o = {}) => {
    const O = 1 - S;
    const hand = [[], []]; hand[S] = [GOLEM, ...((o.handS) || [])]; hand[O] = [...((o.handO) || [])];
    const t = await H.fresh({ hand, gold: [100, 100], deck: decks });
    const w = B.waechter(t);
    t.S = S; t.O = O;
    t.gs.turn = 7;
    if (o.hinweis !== false) t.gs._chillyWizardHint = { [S]: { ownerIdx: O, heroIdx: HOST.heroIdx, slotIdx: HOST.slotIdx } };
    else t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: HOST.heroIdx, slotIdx: HOST.slotIdx }) });
    await t.play(S, GOLEM, { hero: 0 });
    delete t.gs._chillyWizardHint;
    // Harness: die beim Einlegen in die Hand getrackte Hand-Instanz bleibt nach dem Ausspielen stehen (gilt für jede Karte) — hier weg, damit „Geister-Handinstanz" echte Fehler meldet.
    t.engine.cardInstances.filter(c => c.name === GOLEM && c.zone === 'hand').forEach(c => t.engine._untrackCard(c.id));
    return { t, w, S, O };
  };
  const golem = (t) => t.engine.cardInstances.find(c => c.name === GOLEM && c.zone === 'support');
  const instanzen = (t) => t.engine.cardInstances.filter(c => c.name === GOLEM).map(c => ({ zone: c.zone, owner: c.owner, ctrl: c.controller, orig: c.originalOwner }));
  const brettNamen = (t) => { const out = []; for (let s = 0; s < t.n; s++) t.gs.players[s].supportZones.forEach((h, hi) => (h || []).forEach((z, zi) => (z || []).forEach(nm => { if (nm === GOLEM) out.push(`s${s}/h${hi}/z${zi}`); }))); return out; };
  const aufHand = (t, seat) => B.anzahl(t, seat, 'hand', GOLEM) === 1 && B.anzahl(t, 1 - seat, 'hand', GOLEM) === 0;
  const herkunft = (t, seat) => Object.values(t.gs.players[seat]._handOriginals || {}).some(o => o && o.n === GOLEM);
  const herkunftVon = (t, seat, besitzer) => Object.values(t.gs.players[seat]._handOriginals || {}).some(o => o && o.n === GOLEM && o.o === besitzer);
  /** Gemeinsame Nachprüfung: weg vom Brett, keine Geister, Sperre weg, Wächter/Audit sauber. */
  const sauber = (label, { t, w, O }) => {
    R.check(`${label}: Golem nicht mehr auf dem Brett (keine Brett-Instanz)`, !golem(t), instanzen(t));
    R.check(`${label}: kein Geister-Name in irgendeiner Support Zone (beide Brettseiten)`, brettNamen(t).length === 0, brettNamen(t));
    R.check(`${label}: keine Geister-Instanz (alle Golem-Instanzen liegen auf der Hand, höchstens eine)`, instanzen(t).length <= 1 && instanzen(t).every(i => i.zone === 'hand'), instanzen(t));
    R.check(`${label}: Aktionssperre des Wirtshelden (Sitz ${O}, Held ${HOST.heroIdx}) ist weg`, t.engine.canHeroPerformAction(O, HOST.heroIdx) === true);
    R.check(`${label}: Besitzer-Wächter ohne Verstoß`, w.echte().length === 0, w.echte().map(f => f.karte + '→' + f.stapel));
    R.check(`${label}: t.audit() sauber, keine Engine-Fehler`, t.audit().length === 0 && t.errors.length === 0, { audit: t.audit(), err: t.errors });
  };
  /** Danach: Abwerfen aus der Hand von `seat` → Ablage des Besitzers S. */
  const dannAbwerfen = async (label, ctx, seat) => {
    const { t, S } = ctx;
    await t.run(() => t.engine.actionDiscardHandCard(seat, GOLEM, t.pile(seat, 'hand').indexOf(GOLEM), {}));
    B.erwarteStapel(R, t, label, GOLEM, S, 'discardPile');
  };

  for (const S of [0, 1]) {
    const O = 1 - S;
    // ═══ 0) Spielweg: die Beschwörung selbst ═══
    for (const hinweis of [true, false]) {
      R.section(`══ Beschwörung durch Sitz ${S} (${hinweis ? 'Server-Hinweis-Zone' : 'Zonenabfrage ohne Hinweis'}) ══`);
      const { t, w } = await szene(S, { hinweis });
      const g = golem(t);
      R.check('Golem liegt auf dem Brett des Gegners (Zone der Wahl), nicht auf dem eigenen', !!g && t.gs.players[O].supportZones[HOST.heroIdx][HOST.slotIdx][0] === GOLEM && brettNamen(t).join() === `s${O}/h${HOST.heroIdx}/z${HOST.slotIdx}`, brettNamen(t));
      R.check(`controller = Gegner (Sitz ${O}); owner = originalOwner = Beschwörer (Sitz ${S})`, g && g.controller === O && g.owner === S && (g.originalOwner ?? g.owner) === S, g && { c: g.controller, o: g.owner, oo: g.originalOwner });
      R.check('engine.physicalSide = Gegner, kontrolleurVon = Gegner, kartenBesitzerVon = Beschwörer', g && t.engine.physicalSide(g) === O && t.engine.kontrolleurVon(g) === O && t.engine.kartenBesitzerVon(g) === S);
      R.check(`Aktionssperre: Wirtsheld (Sitz ${O}, Held ${HOST.heroIdx}) kann nicht handeln, Held 0 und der eigene Held des Beschwörers schon`, t.engine.canHeroPerformAction(O, HOST.heroIdx) === false && t.engine.canHeroPerformAction(O, 0) === true && t.engine.canHeroPerformAction(S, HOST.heroIdx) === true);
      R.check('Hand des Beschwörers ohne Golem, keine Platzmarke', B.anzahl(t, S, 'hand', GOLEM) === 0 && !herkunft(t, S) && !herkunft(t, O));
      R.check('Brettkonsistenz: der Zonenname steht genau einmal, auf der Brettseite des Kontrolleurs (t.audit prüft nach `owner` und kennt seitenfremde Kreaturen nicht)', brettNamen(t).length === 1 && instanzen(t).filter(i => i.zone === 'support').length === 1, { namen: brettNamen(t), inst: instanzen(t) });
      R.check('Wächter ohne Verstoß, keine Engine-Fehler', w.echte().length === 0 && t.errors.length === 0, { w: w.echte().map(f => f.karte + '→' + f.stapel), err: t.errors });
    }

    // ═══ 1) Racket Arrow ═══
    {
      R.section(`══ Racket Arrow: Sitz ${S} (Golem-Besitzer) greift an und bounct den Golem seines Gegners (Sitz ${O}) ══`);
      const ctx = await szene(S, { handS: ['Racket Arrow', 'Attack'] });
      const { t } = ctx;
      t.setAbilities(S, 0, [['Fighting'], [], []]);
      let angeboten = null;
      t.targetFn = (valid) => { const eq = valid.filter(v => v.type === 'equip'); if (eq.length && angeboten === null) angeboten = eq.map(v => v.cardName); const g = eq.find(v => v.cardName === GOLEM); return [(g || eq[0] || valid[0]).id]; };
      await t.play(S, 'Attack', { hero: 0 });
      R.check('Zielwahl: der Golem (vom Gegner kontrolliert) ist ein wählbares Ziel', angeboten && angeboten.includes(GOLEM), angeboten);
      R.check(`Golem in der Hand des URSPRÜNGLICHEN Owners (Sitz ${S}), nicht des Kontrolleurs (Sitz ${O})`, aufHand(t, S), B.ort(t, GOLEM));
      R.check('  eigene Karte: keine Fremd-Platzmarke nötig (Herkunft = Hand-Besitzer)', !herkunft(t, O) && !herkunft(t, S) || herkunftVon(t, S, S), t.gs.players[S]._handOriginals);
      sauber('Racket Arrow', ctx);
      await dannAbwerfen('Racket Arrow → Abwerfen', ctx, S);
    }
    {
      R.section(`══ Racket Arrow: erneut spielbar — der zurückgeholte Golem lässt sich wieder zum Gegner beschwören ══`);
      const ctx = await szene(S, { handS: ['Racket Arrow', 'Attack'] });
      const { t } = ctx;
      t.setAbilities(S, 0, [['Fighting'], [], []]);
      t.targetFn = (valid) => { const g = valid.find(v => v.type === 'equip' && v.cardName === GOLEM); return g ? [g.id] : [valid[0].id]; };
      await t.play(S, 'Attack', { hero: 0 });
      t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 1 }) });
      t.gs._chillyWizardHint = { [S]: { ownerIdx: O, heroIdx: 0, slotIdx: 1 } };
      await t.play(S, GOLEM, { hero: 0 });
      delete t.gs._chillyWizardHint;
      const g = golem(t);
      R.check(`zweite Beschwörung: wieder beim Gegner (Zone 0/1), controller Sitz ${O}, owner Sitz ${S}`, !!g && g.controller === O && g.owner === S && t.gs.players[O].supportZones[0][1][0] === GOLEM, g && { c: g.controller, o: g.owner });
      R.check('  genau ein Golem auf dem Brett, nirgends sonst', brettNamen(t).length === 1 && B.anzahl(t, S, 'hand', GOLEM) === 0, brettNamen(t));
      R.check('  Wirtsheld 0 gesperrt, der alte Wirtsheld 1 wieder frei', t.engine.canHeroPerformAction(O, 0) === false && t.engine.canHeroPerformAction(O, HOST.heroIdx) === true);
      R.check('  Wächter/Fehler sauber, genau ein Zonenname am Brett', ctx.w.echte().length === 0 && t.errors.length === 0 && brettNamen(t).length === 1, { namen: brettNamen(t), err: t.errors });
    }
    {
      R.section(`══ Racket Arrow: Sitz ${O} (Kontrolleur) — der eigene Golem ist KEIN Ziel („Creature your opponent controls") ══`);
      const hand = [[], []]; hand[S] = [GOLEM]; hand[O] = ['Racket Arrow', 'Attack'];
      const t = await H.fresh({ hand, gold: [100, 100], deck: decks });
      t.gs.turn = 7;
      t.gs._chillyWizardHint = { [S]: { ownerIdx: O, heroIdx: HOST.heroIdx, slotIdx: HOST.slotIdx } };
      await t.play(S, GOLEM, { hero: 0 }); delete t.gs._chillyWizardHint;
      const fremd = t.put(S, 2, 2, 'ZZ Dummy'); fremd.turnPlayed = 1;   // ein echtes Ziel für O
      t.setAbilities(O, 0, [['Fighting'], [], []]);
      let angeboten = null;
      t.targetFn = (valid) => { const eq = valid.filter(v => v.type === 'equip'); if (eq.length && angeboten === null) angeboten = eq.map(v => v.cardName); return [(eq[0] || valid[0]).id]; };
      await t.play(O, 'Attack', { hero: 0 });
      R.check('Zielliste von Sitz ' + O + ' enthält den Golem nicht (nur die Kreatur des Gegners)', angeboten && !angeboten.includes(GOLEM) && angeboten.includes('ZZ Dummy'), angeboten);
      R.check('Golem bleibt auf dem Brett, Sperre bleibt', !!golem(t) && t.engine.canHeroPerformAction(O, HOST.heroIdx) === false);
    }

    // ═══ 2) Chasing the Legend: alle vier Kombinationen aus Schadensverursacher × Halter der Karte ═══
    for (const att of [S, O]) for (const holder of [S, O]) {
      R.section(`══ Chasing the Legend: ${att === S ? 'Fireball' : 'Effekt-Schaden'} von Sitz ${att} auf den Golem, Chasing hält Sitz ${holder} (${holder === S ? 'Besitzer' : 'Kontrolleur'}) ══`);
      const hs = [], ho = [];
      if (att === S) hs.push('Fireball'); (holder === S ? hs : ho).push('Chasing the Legend');
      const ctx = await szene(S, { handS: hs, handO: ho });
      const { t } = ctx;
      t.grantFor(holder, 0, 'Chasing the Legend');
      if (att === S) {
        t.targetFn = (valid) => { const g = valid.find(v => v.type === 'equip' && v.cardName === GOLEM); return g ? [g.id] : undefined; };
        await t.play(att, 'Fireball', { hero: 0 });
      } else {
        // Der Kontrolleur O kann seinen eigenen Golem nicht mit Fireball wählen („Seite" nach Kontrolle) — der Schaden kommt als Effekt-Schaden von O (z. B. Flächen-/Eigenschaden).
        t.gs.activePlayer = O; t.phase(3);
        await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: O }, golem(t), 30, 'fire'));
      }
      const gespielt = t.pile(S, 'discardPile').includes('Chasing the Legend') || t.pile(O, 'discardPile').includes('Chasing the Legend');
      R.check('Chasing the Legend wurde gespielt', gespielt, { s: t.pile(S, 'discardPile'), o: t.pile(O, 'discardPile') });
      R.check(`Golem in der Hand des Owners (Sitz ${S}), nicht des Kontrolleurs (Sitz ${O})`, aufHand(t, S), B.ort(t, GOLEM));
      R.check('  der Schaden wurde geblankt: Golem nicht in der Ablage', B.anzahl(t, S, 'discardPile', GOLEM) + B.anzahl(t, O, 'discardPile', GOLEM) === 0, B.ort(t, GOLEM));
      sauber('Chasing', ctx);
      await dannAbwerfen('Chasing → Abwerfen', ctx, S);
    }

    // ═══ 3) Gegenprobe: allgemeiner Bounce → Hand des Kontrolleurs, Herkunft = Besitzer ═══
    {
      R.section(`══ Allgemeiner Bounce (returnSupportCreatureToHand ohne toPlayer): Hand des Kontrolleurs (Sitz ${O}), Herkunft Sitz ${S} ══`);
      const ctx = await szene(S);
      const { t } = ctx;
      await t.run(() => returnSupportCreatureToHand(t.engine, golem(t), 'Test', {}));
      R.check(`Golem in der Hand des KONTROLLEURS (Sitz ${O})`, aufHand(t, O), B.ort(t, GOLEM));
      R.check(`  Herkunft/Platzmarke = Besitzer (Sitz ${S})`, herkunftVon(t, O, S), t.gs.players[O]._handOriginals);
      sauber('Bounce', ctx);
      await dannAbwerfen('Bounce → Abwerfen (Kontrolleur)', ctx, O);
    }
    {
      R.section(`══ Allgemeiner Bounce (actionMoveCard Brett → Hand) ══`);
      const ctx = await szene(S);
      const { t } = ctx;
      await t.run(() => t.engine.actionMoveCard(golem(t), 'hand', -1, -1, { source: 'Test' }));
      R.check(`Golem in der Hand des KONTROLLEURS (Sitz ${O}), Herkunft Sitz ${S}`, aufHand(t, O) && herkunftVon(t, O, S), { ort: B.ort(t, GOLEM), p: t.gs.players[O]._handOriginals });
      sauber('actionMoveCard', ctx);
      await dannAbwerfen('actionMoveCard → Abwerfen', ctx, O);
    }
    {
      R.section(`══ Allgemeiner Bounce, dann Kontrolleur spielt den Golem selbst und lässt ihn sterben → Ablage des Besitzers ══`);
      const ctx = await szene(S);
      const { t } = ctx;
      await t.run(() => returnSupportCreatureToHand(t.engine, golem(t), 'Test', {}));
      t.gs.activePlayer = O; t.resetActions(O);
      t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
      t.gs._chillyWizardHint = { [O]: { ownerIdx: S, heroIdx: 0, slotIdx: 0 } };
      await t.play(O, GOLEM, { hero: 0 }); delete t.gs._chillyWizardHint;
      const g = golem(t);
      R.check(`Kontrolleur Sitz ${O} spielt den Golem: er liegt beim Gegner (Sitz ${S}), controller Sitz ${S}`, !!g && g.controller === S && t.gs.players[S].supportZones[0][0][0] === GOLEM, g && { c: g.controller, o: g.owner, oo: g.originalOwner });
      await t.run(() => t.engine.actionDestroyCard(null, golem(t), {}));
      B.erwarteStapel(R, t, 'gespielt und zerstört', GOLEM, S, 'discardPile');
      R.check('  Besitzer-Wächter ohne Verstoß', ctx.w.echte().length === 0, ctx.w.echte().map(f => f.karte + '→' + f.stapel));
    }
    {
      R.section(`══ Allgemeiner Bounce, Kontrolleur (Sitz ${O}) spielt den Golem selbst aus — sein Racket Arrow schickt ihn zum URSPRÜNGLICHEN Owner (Sitz ${S}) ══`);
      const ctx = await szene(S, { handO: ['Racket Arrow', 'Attack'] });
      const { t } = ctx;
      await t.run(() => returnSupportCreatureToHand(t.engine, golem(t), 'Test', {}));
      t.engine.cardInstances.filter(c => c.name === GOLEM && c.zone === 'hand').forEach(c => t.engine._untrackCard(c.id));
      t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
      t.gs._chillyWizardHint = { [O]: { ownerIdx: S, heroIdx: 0, slotIdx: 0 } };
      await t.play(O, GOLEM, { hero: 0 }); delete t.gs._chillyWizardHint;
      t.engine.cardInstances.filter(c => c.name === GOLEM && c.zone === 'hand').forEach(c => t.engine._untrackCard(c.id));
      t.setAbilities(O, 0, [['Fighting'], [], []]);
      let angeboten = null;
      t.targetFn = (valid) => { const eq = valid.filter(v => v.type === 'equip'); if (eq.length && angeboten === null) angeboten = eq.map(v => v.cardName); const g = eq.find(v => v.cardName === GOLEM); return [(g || eq[0] || valid[0]).id]; };
      await t.play(O, 'Attack', { hero: 0 });
      R.check(`der von Sitz ${O} gespielte Golem (controller Sitz ${S}) ist für Sitz ${O} ein Ziel`, angeboten && angeboten.includes(GOLEM), angeboten);
      R.check(`Golem in der Hand des ursprünglichen Owners (Sitz ${S}), nicht in der des Spielers (Sitz ${O})`, aufHand(t, S), B.ort(t, GOLEM));
      R.check('  kein Geister-Name am Brett, Wächter ohne Verstoß', brettNamen(t).length === 0 && ctx.w.echte().length === 0 && t.errors.length === 0, { b: brettNamen(t), w: ctx.w.echte().map(f => f.karte + '→' + f.stapel), e: t.errors });
      await dannAbwerfen('Racket Arrow (Golem von Sitz ' + O + ' gespielt) → Abwerfen', ctx, S);
    }
    // Kidnapping („Choose a Creature your opponent controls and add it to your hand"): der Golem gehört dem Wirker S, den Gegner O kontrolliert ihn → wählbar, Hand des Wirkers
    {
      R.section(`══ Kidnapping von Sitz ${S} auf den eigenen, vom Gegner kontrollierten Golem: Hand des Wirkers = Besitzers ══`);
      const ctx = await szene(S, { handS: ['Kidnapping'] });
      const { t } = ctx;
      let angeboten = null;
      t.targetFn = (valid) => { const eq = valid.filter(v => v.type === 'equip'); if (eq.length && angeboten === null) angeboten = eq.map(v => v.cardName); const g = eq.find(v => v.cardName === GOLEM); return g ? [g.id] : undefined; };
      await t.play(S, 'Kidnapping', { hero: 0 });
      R.check('Kidnapping: Golem war ein wählbares Ziel', angeboten && angeboten.includes(GOLEM), angeboten);
      R.check(`Golem in der Hand von Sitz ${S} (Wirker und Besitzer)`, aufHand(t, S), B.ort(t, GOLEM));
      sauber('Kidnapping', ctx);
      await dannAbwerfen('Kidnapping → Abwerfen', ctx, S);
    }
    // Capture Net („Choose a Creature on the board and add it to your hand"): beide Sitze dürfen den Golem wählen — er geht auf die Hand des NUTZERS; fremd (Kontrolleur O) mit Herkunft S
    for (const nutzer of [S, O]) {
      R.section(`══ Capture Net von Sitz ${nutzer} (${nutzer === S ? 'Besitzer' : 'Kontrolleur'}) auf den Golem: Hand des Nutzers ══`);
      const ctx = await szene(S, nutzer === S ? { handS: ['Capture Net'] } : { handO: ['Capture Net'] });
      const { t } = ctx;
      t.targetFn = (valid) => { const g = valid.find(v => v.type === 'equip' && v.cardName === GOLEM); return g ? [g.id] : undefined; };
      await t.play(nutzer, 'Capture Net', { hero: 0 });
      R.check(`Golem in der Hand des Nutzers (Sitz ${nutzer})`, aufHand(t, nutzer), B.ort(t, GOLEM));
      if (nutzer === O) R.check(`  Herkunft Sitz ${S} vermerkt`, herkunftVon(t, O, S), t.gs.players[O]._handOriginals);
      sauber('Capture Net', ctx);
      await dannAbwerfen('Capture Net → Abwerfen', ctx, nutzer);
    }
    // Schmale Engine-Probe des Empfängers (`actionMoveCard … toPlayer`, Weg von Chasing the Legend / Surprising Opportunity „add them to YOUR hand")
    for (const empf of [S, O]) {
      R.section(`══ actionMoveCard Brett → Hand mit toPlayer = Sitz ${empf} (${empf === S ? 'Besitzer' : 'Kontrolleur'}) ══`);
      const ctx = await szene(S);
      const { t } = ctx;
      await t.run(() => t.engine.actionMoveCard(golem(t), 'hand', -1, -1, { source: 'Test', sourceOwner: empf, toPlayer: empf }));
      R.check(`Golem in der Hand von Sitz ${empf}`, aufHand(t, empf), B.ort(t, GOLEM));
      if (empf === O) R.check(`  Herkunft Sitz ${S} vermerkt`, herkunftVon(t, O, S), t.gs.players[O]._handOriginals);
      sauber('toPlayer', ctx);
      await dannAbwerfen('toPlayer → Abwerfen', ctx, empf);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
