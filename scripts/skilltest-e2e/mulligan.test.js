'use strict';
// Mulligan der Bots (skilltest/mulligan.js): Auswahl über das Keep-Modell, Arme skip/weak/more, Lernkanal „Wann Mulligans?“, Ablauf im Spiel.
//   node scripts/skilltest-e2e/mulligan.test.js
process.env.PP_ST_SIM = '1';
const M = require('../../skilltest/mulligan');
const KM = require('../../skilltest/learn/keepmodel');
const Rules = require('../../public/skilltest-rules.js');
const { runGame } = require('../../skilltest/sim');
const bot = require('../../skilltest/bot');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const prompt = (title, extra = {}) => Object.assign({ type: 'handPick', title, description: 'Select any number of cards to shuffle back into your deck.', maxSelect: 99, minSelect: 0, cancellable: true }, extra);

(async () => {
  console.log('Erkennung');
  check('Leadership/Horn/Staff/Crescent sind Mulligan-Prompts',
    [prompt('Leadership Lv2', { description: 'Select up to 3 cards to shuffle back and redraw.' }), prompt('Horn in a Bottle'), prompt('Staff of the Teleporter', { description: 'They will be shuffled into your deck' }), prompt('Lunatic Cycle - Crescent Moon', { description: 'You may shuffle any number of cards' })].every(M.isMulliganPrompt));
  check('Einsatz-Pick („welchen Zauber wirken?“) und Abwurf sind es nicht',
    !M.isMulliganPrompt({ type: 'handPick', pickIntent: 'use', description: 'Choose a Spell to shuffle?' }) && !M.isMulliganPrompt({ type: 'handPick', title: 'Discard', description: 'Select a card to discard.' }) && !M.isMulliganPrompt({ type: 'confirm', description: 'shuffle' }));

  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 61 });
  console.log = oL; console.error = oE;
  const { room, gs, engine, st, host } = out;
  const cards = engine._getCardDB();
  const seat = 0, ps = gs.players[seat];

  // Karten, die dieses Brett nie wirken kann (Zauber hoher Stufe einer Schule ohne Abilities) → im Keep-Modell „unbrauchbar“
  const form = M.battleForm(engine, seat);
  const ctx0 = KM.buildContext({ cards }, form, []);
  const dead = Object.values(cards).filter(c => c && c.skilltestLegal && (c.cardType === 'Spell' || c.cardType === 'Attack') && (c.subtype || '').toLowerCase() === 'normal' && c.level >= 3
    && KM.usability({ cards }, c.name, ctx0) === 'no').sort((x, y) => x.name < y.name ? -1 : 1).slice(0, 3).map(c => c.name);
  const good = Object.values(cards).filter(c => c && c.skilltestLegal && c.cardType === 'Spell' && (c.subtype || '').toLowerCase() === 'normal' && KM.usability({ cards }, c.name, ctx0) === 'now' && c.level <= 2)
    .sort((x, y) => x.name < y.name ? -1 : 1).slice(0, 3).map(c => c.name);
  check('drei unwirkbare Zauber gefunden', dead.length === 3, dead);

  console.log('Auswahl der schwachen Karten');
  ps.hand = [...dead, ...good];
  const dv = M.keepValues(engine, seat, null);
  check('unwirkbare Zauber haben negativen Behalten-Wert', dead.every(n => dv[ps.hand.indexOf(n)] < 0), dv.map((v, i) => [ps.hand[i], Math.round(v * 100) / 100]));
  const horn = prompt('Horn in a Bottle', { eligibleIndices: ps.hand.map((_, i) => i), maxSelect: ps.hand.length, minSelect: 0 });
  st.mullMode = { [seat]: 'weak' };
  let r = M.respond(engine, seat, horn);
  check('Arm „weak“: genau die schwachen Karten gehen zurück', r && r.selectedCards.map(c => c.cardName).sort().join() === [...dead].sort().join(), r && r.selectedCards.map(c => c.cardName));
  check('…mit den richtigen Handplätzen', r.selectedCards.every(c => ps.hand[c.handIndex] === c.cardName));
  st.mullDecided = {}; st.mullMode = { [seat]: 'skip' };
  r = M.respond(engine, seat, horn);
  check('Arm „skip“: Prompt wird abgebrochen (null)', r === null, r);
  st.mullDecided = {}; st.mullMode = { [seat]: 'more' };
  r = M.respond(engine, seat, horn);
  check('Arm „more“ gibt mindestens die schwachen Karten zurück', r && dead.every(n => r.selectedCards.some(c => c.cardName === n)), r && r.selectedCards.map(c => c.cardName));

  console.log('Grenzen der Quelle');
  st.mullDecided = {}; st.mullMode = { [seat]: 'weak' };
  const lead1 = prompt('Leadership Lv1', { description: 'Select up to 1 card to shuffle back and redraw.', eligibleIndices: ps.hand.map((_, i) => i), maxSelect: 1, minSelect: 1 });
  r = M.respond(engine, seat, lead1);
  check('Leadership Lv1 (höchstens 1 Karte): genau eine, und zwar eine schwache', r && r.selectedCards.length === 1 && dead.includes(r.selectedCards[0].cardName), r && r.selectedCards);
  st.mullDecided = {};
  const lead3 = prompt('Leadership Lv3', { description: 'Select up to 5 cards to shuffle back and redraw. (+1 bonus draw!)', eligibleIndices: ps.hand.map((_, i) => i), maxSelect: 5, minSelect: 1 });
  r = M.respond(engine, seat, lead3);
  check('Leadership Lv3: alle drei schwachen Karten', r && r.selectedCards.length === 3, r && r.selectedCards.length);
  // Nur gute Karten auf der Hand: Quelle ohne Bonus lohnt nicht, Quelle mit Bonus zieht ohne Rückgabe
  ps.hand = [...good];
  const dGood = M.keepValues(engine, seat, null);
  if (dGood.every(v => v >= 0)) {
    st.mullDecided = {}; st.mullMode = {};
    const crescent = prompt('Lunatic Cycle - Crescent Moon', { description: 'You may shuffle any number of cards from your hand back', eligibleIndices: ps.hand.map((_, i) => i), maxSelect: ps.hand.length, minSelect: 1 });
    check('Crescent Moon (kein Bonus) ohne schwache Karte: Bot lässt es', M.respond(engine, seat, crescent) === null);
    st.mullDecided = {};
    const horn2 = prompt('Horn in a Bottle', { eligibleIndices: ps.hand.map((_, i) => i), maxSelect: ps.hand.length, minSelect: 0 });
    r = M.respond(engine, seat, horn2);
    check('Horn in a Bottle ohne schwache Karte: nichts zurück, aber die Karte wird gespielt (zieht 1)', r && Array.isArray(r.selectedCards) && r.selectedCards.length === 0, r);
  } else check('Testhand „nur gute Karten“ steht', false, dGood);

  console.log('Eine Entscheidung je Sitz, Round und Karte');
  st.mullDecided = {}; st.mullLog = []; st.mullMode = {}; st.record = true;
  ps.hand = [...dead, ...good];
  const origRandom = Math.random;
  let calls = 0; Math.random = () => { calls++; return 0.01; };                 // Training: erkundet (< EXPLORE), zufälliger Arm = der erste
  const hornD = prompt('Horn in a Bottle', { eligibleIndices: ps.hand.map((_, i) => i), maxSelect: ps.hand.length, minSelect: 0 });
  const a1 = M.respond(engine, seat, hornD), a2 = M.respond(engine, seat, hornD), a3 = M.respond(engine, seat, hornD);
  Math.random = origRandom;
  check('mehrfaches Fragen in derselben Round gibt dieselbe Antwort', JSON.stringify(a1) === JSON.stringify(a2) && JSON.stringify(a2) === JSON.stringify(a3));
  check('…und wird nur einmal protokolliert (erkundet, mit Eimer)', st.mullLog.length === 1 && st.mullLog[0].x === 1 && /^w\dbp\d$/.test(st.mullLog[0].b), st.mullLog);
  st.record = false;

  console.log('Lernkanal');
  const prof = { mullX: {}, mull: {} };
  const rows = [];
  for (let i = 0; i < M.MIN_N; i++) { rows.push({ seat: 0, b: 'w2p1', c: 'w2', arm: 'weak', x: 1 }); rows.push({ seat: 0, b: 'w2p1', c: 'w2', arm: 'skip', x: 1 }); }
  const scores = { weak: 0.4, skip: -0.2 };
  let k = 0;
  for (const m of rows) { const sc = scores[m.arm]; M.learn(prof, [m], () => sc); k++; }
  check('Beobachtungen landen in mull und (erkundet) in mullX, je Eimer und gröber', prof.mullX['w2p1|weak'].n === M.MIN_N && prof.mullX['w2|skip'].n === M.MIN_N && prof.mull['w2p1|skip'].n === M.MIN_N, Object.keys(prof.mullX));
  M.learn(prof, [{ seat: 0, b: 'w2p1', c: 'w2', arm: 'weak', x: 0 }], () => -1);
  check('nicht erkundete Entscheidungen zählen nur in mull', prof.mull['w2p1|weak'].n === M.MIN_N + 1 && prof.mullX['w2p1|weak'].n === M.MIN_N);
  M.learn(prof, [{ seat: 0, b: 'w2p1', c: 'w2', arm: 'weak', x: 1, forced: 1 }], () => -1);
  check('erzwungene Arme (Messläufe) lernen nicht', prof.mull['w2p1|weak'].n === M.MIN_N + 1);

  // Anbindung an das Lernen (learn/train.js learnFrom): Platz 1 von 3 → Güte +1, Platz 3 → −1
  const T = require('../../skilltest/learn/train'), LP = require('../../skilltest/learn/profile');
  const lp = LP.emptyProfile();
  T.learnFrom(lp, { n: 3, personaIds: [], rec: { placements: { 0: 1, 1: 3, 2: 2 }, bases: [], learnLog: [], mullLog: [
    { seat: 0, b: 'w1bp0', c: 'w1b', arm: 'weak', x: 1 }, { seat: 1, b: 'w1bp0', c: 'w1b', arm: 'skip', x: 1 }, { seat: 2, b: 'w1bp0', c: 'w1b', arm: 'weak', x: 0 } ] } });
  check('learnFrom: Platzierungsgüte je Arm landet im Profil (Sieger +1, Letzter −1, Zweiter 0)', lp.mullX['w1bp0|weak'].sum === 1 && lp.mullX['w1bp0|skip'].sum === -1 && lp.mull['w1bp0|weak'].n === 2 && lp.mull['w1bp0|weak'].sum === 1, [lp.mullX, lp.mull]);
  check('das ausgelieferte Profil (exportCompact) trägt den Kanal mit', T.exportCompact(lp).mullX && T.exportCompact(lp).mullX['w1bp0|weak'].n === 1);

  // Entscheidung aus gelernten Werten
  const plan = { bucket: 'w2p1', coarse: 'w2' }, arms = ['skip', 'weak', 'more'];
  check('Vergleich aus genug erkundeten Beobachtungen je Arm: der deutlich bessere Arm (weak) gewinnt', M.learnedArm({ mullX: prof.mullX }, plan, ['skip', 'weak']) === 'weak');
  check('Fehlt ein Arm im Vergleich (more hat keine Daten), entscheidet nichts → Vorgabe', M.learnedArm({ mullX: prof.mullX }, plan, arms) === null);
  const thin = { mullX: { 'w2p1|weak': { n: 3, sum: 3 }, 'w2p1|skip': { n: 3, sum: -3 } } };
  check('Zu wenig Daten (3 je Arm): keine gelernte Wahl', M.learnedArm(thin, plan, ['skip', 'weak']) === null);
  const coarseOnly = { mullX: { 'w2|weak': { n: M.POOL_MIN_N, sum: -0.5 * M.POOL_MIN_N }, 'w2|skip': { n: M.POOL_MIN_N, sum: 0.5 * M.POOL_MIN_N } } };
  check('Gröberer Eimer (nur Zahl der schwachen Karten) springt ein, wenn der feine zu dünn ist', M.learnedArm(coarseOnly, plan, ['skip', 'weak']) === 'skip');
  const tie = { mullX: { 'w2p1|weak': { n: M.MIN_N, sum: 0.10 * M.MIN_N }, 'w2p1|skip': { n: M.MIN_N, sum: 0.11 * M.MIN_N } } };
  check('Ohne klaren Vorsprung vor der Vorgabe (weak) bleibt es bei der Vorgabe (kein Rauschen lernen)', M.learnedArm(tie, plan, ['skip', 'weak']) === null);
  check('Vorgabe: schwache Karten zurück, sonst nichts', M.priorArm({}, ['skip', 'weak']) === 'weak' && M.priorArm({}, ['skip']) === 'skip');

  // Die Szenen gehören dem Test: eine Leadership-Start-Ability des Heroes (je nach Tisch) würde die Hand schon vor Horn/Leadership zurückmischen
  const stripLeadership = (ps) => { for (const row of ps.abilityZones) for (let z = 0; z < row.length; z++) if (row[z] && row[z].n === 'Leadership') row[z] = null; };

  console.log('Ablauf im Spiel (Bot mit Horn in a Bottle und drei toten Karten)');
  console.log = () => {}; console.error = () => {};
  const g = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 61, mullMode: { 0: 'weak' }, record: true,
    mutatePrep: (prep) => { stripLeadership(prep.players[0]); prep.players[0].hand = [...dead, 'Horn in a Bottle']; } });      // die Hand gehört dem Test: sonst zieht eine andere Karte dazwischen
  console.log = oL; console.error = oE;
  const gp = g.gs.players[0], pool = g.room.skillTest.pool;
  const handBefore = [...gp.hand];
  let poolBefore = pool.remaining();
  const deadIn = dead.filter(n => gp.hand.includes(n)).length;
  check('Vorbereitung: tote Karten und Horn liegen auf der Hand', deadIn === 3 && gp.hand.includes('Horn in a Bottle'), handBefore);
  let guard = 0;
  while (g.gs.activePlayer !== 0 && guard++ < 6) await bot.takeTurn(g.room, g.gs.activePlayer, g.host);
  poolBefore = pool.remaining();                 // erst jetzt: die Züge der anderen Sitze (Alchemy-Tränke u. a.) ziehen ebenfalls aus dem Pool
  await bot.takeTurn(g.room, 0, g.host);
  const stillDead = dead.filter(n => gp.hand.includes(n)).length;
  const log = (g.gs.skillTest.mullLog || []).find(m => m.seat === 0 && m.src === 'Horn in a Bottle');
  check('Der Bot hat Horn in a Bottle ausgespielt (Entscheidung „weak“ protokolliert)', !!log && log.arm === 'weak' && log.nw >= 3, g.gs.skillTest.mullLog);
  check('Die toten Karten sind aus der Hand', stillDead === 0 || stillDead < deadIn, { stillDead, hand: gp.hand });
  check('Horn ist verbraucht', !gp.hand.includes('Horn in a Bottle'));
  check('Gezogene Karten zählen: 3 Ersatzkarten wurden gegengerechnet, nur der Bonus-Zug bleibt', gp._stDrawn === 1, gp._stDrawn);
  check('Der Pool ist nicht geschrumpft (3 zurückgemischt = 3 neue, +1 Bonus)', pool.remaining() <= poolBefore && pool.remaining() >= poolBefore - 1, { vorher: poolBefore, nachher: pool.remaining() });

  console.log('Ablauf im Spiel (Bot mit Leadership Lv3 auf dem Brett)');
  console.log = () => {}; console.error = () => {};
  const g2 = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 61, mullMode: { 0: 'weak' }, record: true,
    mutatePrep: (prep) => { stripLeadership(prep.players[0]); prep.players[0].hand = [...dead]; prep.players[0].abilityZones[0][0] = { n: 'Leadership', s: 0, c: true }; } });
  console.log = oL; console.error = oE;
  const g2p = g2.gs.players[0];
  check('Leadership liegt als Lv3-Ability auf dem Brett', g2p.abilityZones[0][0] && g2p.abilityZones[0][0].length === 3 && g2p.abilityZones[0][0][0] === 'Leadership', g2p.abilityZones[0][0]);
  guard = 0;
  while (g2.gs.activePlayer !== 0 && guard++ < 6) await bot.takeTurn(g2.room, g2.gs.activePlayer, g2.host);
  await bot.takeTurn(g2.room, 0, g2.host);
  const log2 = (g2.gs.skillTest.mullLog || []).find(m => m.seat === 0 && /^Leadership/.test(m.src));
  check('Der Bot nutzt Leadership (Entscheidung „weak“, 3 schwache Karten, Bonus-Zug)', !!log2 && log2.arm === 'weak' && log2.nw === 3 && log2.bonus === 1, g2.gs.skillTest.mullLog);
  check('Die toten Karten sind weg, die Hand hat Ersatz plus Bonus (3 + 1; der Bot darf danach schon neue Karten gespielt haben: eine freie Ausrüstung und die Zug-Aktion)', dead.every(n => !g2p.hand.includes(n)) && g2p.hand.length >= 2 && g2p.hand.length <= 4, g2p.hand);
  void Rules; void host; void room; void gs; void st;

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Mulligan-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
