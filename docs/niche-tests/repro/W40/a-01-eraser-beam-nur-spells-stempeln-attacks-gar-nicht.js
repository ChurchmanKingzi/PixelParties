'use strict';
// W40a · Punkt 4 · Al, 22.10.2026 (Antwort auf W39a-Rückfrage 4): „Attacks sollen den Stempel (… ‚This must be the only Spell you play this turn'?) GAR NICHT setzen, sondern nur Spells! Und in dem Fall würden auch
//  solche ohne Karte (etwa Alices Effekt) den Stempel setzen und Eraser Beam verbieten."
// Kartentext Eraser Beam: „This must be the only Spell you play this turn. Place 3 Pollution Tokens … Choose a target your opponent controls and defeat it. … You can only play 1 "Eraser Beam" per game."
// Lesart: Eraser Beam ist spielbar, solange der Spieler in diesem Zug noch keinen SPELL gewirkt hat — gewirkt = eine Spell-Karte (auch Sofort-Guss, auch als Zusatzaktion) ODER ein Effekt, der als Spell zählt
//  (Alice: Destruction Magic Spell, ohne Karte). Gespielte Attack-Karten und Effekte, die als ATTACK zählen (Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle, Crusader's, Bamboo Staff,
//  Sacrificial Dagger, Infected Greatmaw, Duel), stempeln gar nicht. Abgebrochene/nicht aufgelöste Spells stempeln nicht (W36a: nur aufgelöste Spells). Ein Spell NACH Eraser Beam bleibt gesperrt (`_spellLockTurn`).
// Matrix: Quelle × beide Sitze; Gegenproben: echter Spell sperrt, Alice sperrt, abgebrochener Sofort-Guss sperrt nicht; Ende-zu-Ende: Eraser Beam nach Attack wirkt wirklich, nach Spell lehnt der Server ab.
// Exit 1 auf der Basis (Attack-Karten stempelten), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W40/a-01-eraser-beam-nur-spells-stempeln-attacks-gar-nicht.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const ER = H.loadCardEffect('Eraser Beam');
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);

// Quellen, nach deren Wirken der Spieler `me` noch Eraser Beam spielen darf (`erlaubt: true`) bzw. nicht (`false`)
const QUELLEN = [
  { id: 'Echte Attack-Karte (Gegenprobe zum Basis-Fehler)', treiber: 'Echte Attack', erlaubt: true },
  { id: 'Broghan (Heldeneffekt, zählt als Attack)', treiber: 'Broghan', erlaubt: true },
  { id: 'Brackle (Heldeneffekt, zählt als Attack)', treiber: 'Brackle', erlaubt: true },
  { id: 'Arthor (Heldeneffekt, zählt als Attack)', treiber: 'Arthor', erlaubt: true },
  { id: 'Kohta (Heldeneffekt, zählt als Attack)', treiber: 'Kohta', erlaubt: true },
  { id: 'Javelin Throw (Artefakt, zählt als Attack)', treiber: 'Javelin Throw', erlaubt: true },
  { id: 'Sword in a Bottle (Trank, zählt als Attack)', treiber: 'Sword in a Bottle', erlaubt: true },
  { id: "Crusader's Cutlass (Ausrüstung, zählt als Attack)", treiber: "Crusader's Cutlass", erlaubt: true },
  { id: 'Bamboo Staff (zählt als Attack)', treiber: 'Bamboo Staff', erlaubt: true },
  { id: 'Sacrificial Dagger (zählt als Attack)', treiber: 'Sacrificial Dagger', erlaubt: true },
  { id: 'Infected Greatmaw (zählt als Attack)', treiber: 'Infected Greatmaw', erlaubt: true },
  { id: 'Duel (Attack-Karte, jeder Schlag eine Attack)', treiber: 'Duel', erlaubt: true },
  { id: 'Echter Spell (Fireball) — Gegenprobe', treiber: 'Echter Spell', erlaubt: false },
  { id: 'Alice (Effekt OHNE Karte, zählt als Spell) — Gegenprobe', treiber: 'Alice', erlaubt: false },
  { id: 'Alluring Light (die KARTE ist ein Spell; der provozierte Angriff nicht) — Gegenprobe', treiber: 'Alluring Light', erlaubt: false },
];

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    for (const q of QUELLEN) {
      let r;
      try { r = await L.szene(q.treiber, me, op, { ziel: 'hero' }); } catch (e) { R.check(q.id + ': Szene baubar', false, String(e && e.stack || e).slice(0, 200)); continue; }
      const t = r.t;
      const ps = t.gs.players[me];
      if (q.erlaubt && q.treiber !== 'Echte Attack') R.check(q.id + ': die Quelle hat getroffen (Treiber lief)', t.treffer.length > 0, { erg: r.erg, treffer: t.treffer.length });
      const frei = ER.spellPlayCondition(t.gs, me, t.engine);
      R.check(q.id + ': Eraser Beam ' + (q.erlaubt ? 'noch spielbar' : 'gesperrt'), frei === q.erlaubt, { frei, stempel: ps._spellResolvedTurn, prior: ps._eraserBeamPriorSpellTurn, turn: t.gs.turn });
      R.check(q.id + ': keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
    }
  }

  // ── Ende zu Ende: nach einer gespielten Attack-Karte wirkt Eraser Beam wirklich; nach einem Spell lehnt der Server ab ──
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Ende-zu-Ende Sitz ' + me);
    for (const vorher of ['Attack', 'Fireball']) {
      const t = await H.fresh({ hand: me === 0 ? [[vorher, 'Eraser Beam'], []] : [[], [vorher, 'Eraser Beam']], deckSize: 30, hp: 800, active: me });
      t.grantFor(me, 0, vorher); t.grantFor(me, 1, 'Eraser Beam');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
      const a = await t.play(me, vorher, { hero: 0, keepActions: true });
      const e = await t.play(me, 'Eraser Beam', { hero: 1 });
      if (vorher === 'Attack') {
        R.check('Attack-Karte gespielt, danach Eraser Beam gespielt', a === true && e === true, { a, e });
        R.check('  der Ziel-Held ist besiegt (Eraser Beam hat gewirkt)', t.hp(op, 0) <= 0, t.hp(op, 0));
      } else {
        R.check('Spell gespielt, danach lehnt der Server Eraser Beam ab', a === true && e === false, { a, e });
        R.check('  Eraser Beam liegt noch auf der Hand', t.gs.players[me].hand.includes('Eraser Beam'), t.gs.players[me].hand);
      }
      R.check('  keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
