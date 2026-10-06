'use strict';
// Anzeige und Gegnerwahl im Kampf (headless):
//  • Zugbeginn und Zielwahl melden „hierhin schauen" (skillTest.watch), BEVOR die Karte wirkt.
//  • Wer handelt, steht in skillTest.acting, solange die Aktion läuft; danach ist er leer.
//  • Karten mit „dem Gegner" fragen den Menschen bei mehreren Gegnern (playerPicker); Bots wählen über die Policy; bei einem Gegner keine Frage.
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
const { publicState } = require('../../skilltest/index');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const log = console.log; console.log = (...a) => { if (!/^\[(skilltest|deck-profile|heap-guard|build|DB)/.test(String(a[0]))) log(...a); };
  // Alle Sitze starten als Bots (ein echter Mensch am Start würde bei Zugbeginn-Effekten ewig auf eine Antwort warten); Sitz 0 wird danach zum Menschen.
  const { room, host, engine, gs, st } = await runGame({ seats: 4, setupOnly: true });
  st.botSeats = st.botSeats.filter(s => s !== 0);
  console.log = log;
  const delays = [];
  // Anzeigehilfen sind in Simulationen (Schnellmodus) aus; die Abschnitte, die sie prüfen, laufen wie im echten Raum.
  // Alles andere bleibt im Schnellmodus: Zugbeginn-Effekte eines Menschen würden sonst ewig auf eine Antwort warten.
  const live = async (fn) => { engine._fastMode = false; try { return await fn(); } finally { engine._fastMode = true; } };
  engine.sync = () => {};
  engine._delay = async (ms) => { delays.push(ms); };
  process.env.PP_ST_WATCH_MS = '77';

  console.log('Zugbeginn');
  await rounds.beginTurn(engine, 2);
  check('beginTurn meldet den Spieler am Zug als Blick', st.watch && st.watch.actor === 2 && st.watch.target === null, st.watch);
  const n0 = st.watch.n;
  await rounds.beginTurn(engine, 3);
  check('Jeder Zug zählt hoch (derselbe Blick zieht erneut)', st.watch.n === n0 + 1 && st.watch.actor === 3, st.watch);
  check('Der Blick steht im öffentlichen Zustand', publicState(gs, engine).watch.actor === 3 && 'acting' in publicState(gs, engine));

  console.log('Aktion: Akteur leuchtet');
  await rounds.beginTurn(engine, 0);
  let seenActing = null, seenBusy = null;
  await rounds.act(room, 0, 'play_spell', { heroIdx: 1 }, async () => { seenActing = st.acting && { ...st.acting }; seenBusy = st.busy; return false; }, host);
  check('Während der Aktion steht der handelnde Held im Zustand', seenBusy === true && seenActing && seenActing.seat === 0 && seenActing.hi === 1, { seenActing, seenBusy });
  check('Nach der Aktion ist niemand mehr „am Handeln"', st.acting == null, st.acting);

  console.log('Gegnerwahl (Mensch, 3 Gegner)');
  const prompts = [];
  const origPrompt = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, data) => { prompts.push({ pi, data }); return { playerIdx: 3 }; };
  delays.length = 0;
  const gewaehlt = await live(() => engine._stChooseOpponent(0, 'Chain Lightning'));
  check('Der Mensch bekommt eine Spielerwahl mit den drei Gegnern', prompts.length === 1 && prompts[0].data.type === 'playerPicker' && JSON.stringify(prompts[0].data.allowedPlayers) === '[1,2,3]' && prompts[0].data.cancellable === false, prompts[0] && prompts[0].data);
  check('Der gewählte Gegner wird zum Fokus (opponentOf)', gewaehlt === 3 && engine.opponentOf(0) === 3, { gewaehlt, opp: engine.opponentOf(0) });
  check('Die Anzeige wechselt auf ihn (Mensch wartet nicht auf sich selbst)', st.watch.actor === 0 && st.watch.target === 3 && delays.length === 0, { watch: st.watch, delays });

  console.log('Gegnerwahl (Bot)');
  engine.promptGeneric = origPrompt;
  prompts.length = 0; delays.length = 0;
  const botWahl = await live(() => engine._stChooseOpponent(1, 'Chain Lightning'));
  check('Der Bot wählt über die Policy einen lebenden Gegner (keine Frage an einen Menschen)', [0, 2, 3].includes(botWahl) && engine.opponentOf(1) === botWahl, botWahl);
  check('Der Bot wartet kurz, damit man den Wechsel sieht', delays.includes(77) && st.watch.actor === 1 && st.watch.target === botWahl, { delays, watch: st.watch });

  console.log('Zielwahl bei einem Dritten');
  prompts.length = 0; delays.length = 0;
  await rounds.beginTurn(engine, 1);
  const targets = [{ id: 'hero-2-0', type: 'hero', owner: 2, heroIdx: 0, cardName: 'x' }, { id: 'hero-3-0', type: 'hero', owner: 3, heroIdx: 0, cardName: 'y' }];
  await live(() => engine._zielwahlAbschliessen(1, targets, {}, ['hero-2-0']));
  check('Wählt der Bot ein Ziel bei Sitz 2, zeigt die Anzeige Sitz 2, bevor die Karte wirkt', st.watch.actor === 1 && st.watch.target === 2 && delays.includes(77), { watch: st.watch, delays });
  const n1 = st.watch.n;
  await live(() => engine._zielwahlAbschliessen(1, targets, {}, ['hero-2-0']));
  check('Dasselbe Ziel im selben Zug zieht die Anzeige nicht noch einmal', st.watch.n === n1, st.watch);
  await live(() => engine._zielwahlAbschliessen(1, [{ id: 'hero-1-0', type: 'hero', owner: 1, heroIdx: 0, cardName: 'z' }], {}, ['hero-1-0']));
  check('Ein Ziel auf dem eigenen Brett ändert nichts', st.watch.n === n1, st.watch);

  console.log('Nur ein Gegner übrig');
  for (const seat of [2, 3]) gs.players[seat].heroes.forEach(h => { if (h) h.hp = 0; });
  prompts.length = 0;
  engine.promptGeneric = async (pi, data) => { prompts.push({ pi, data }); return { playerIdx: 1 }; };
  const einziger = await live(() => engine._stChooseOpponent(0, 'Chain Lightning'));
  check('Bei nur einem lebenden Gegner gibt es keine Frage', prompts.length === 0 && einziger === 1, { n: prompts.length, einziger });

  console.log('Karten, die „den Gegner" meinen, fragen den Spieler');
  for (const seat of [2, 3]) gs.players[seat].heroes.forEach((h, i) => { if (h && h.name) h.hp = Math.max(1, (require('../../cards/effects/_card-db').getCardDB()[h.name] || {}).hp || 100); });
  const asked = [];
  engine._stChooseOpponent = async (pi, title) => { asked.push({ pi, title }); return 2; };
  engine.promptChainTargets = async () => [];
  engine.promptGeneric = async () => ({ cancelled: true });
  gs.activePlayer = 0;
  await require('../../cards/effects/chain-lightning').hooks.onPlay({ _engine: engine, gameState: gs, cardOwner: 0, cardHeroIdx: 0, cardHeroOwner: 0 });
  check('Chain Lightning fragt nach dem Gegner', asked.some(a => a.pi === 0 && a.title === 'Chain Lightning'), asked);
  await require('../../cards/effects/cardinal-beast-qinglong').onCreatureEffect({ _engine: engine, gameState: gs, cardOwner: 0, cardHeroIdx: 0, cardZoneSlot: 0, cardHeroOwner: 0 });
  check('Cardinal Beast Qinglong fragt nach dem Gegner', asked.some(a => a.pi === 0 && /Qinglong/.test(a.title)), asked);
  asked.length = 0;
  await require('../../cards/effects/_bottled-shared').runDiscardChain(engine, 0, 'Bottled Lightning');
  check('Die Bottled-Kette (Bottled Lightning/Flame) fragt nach dem Gegner', asked.some(a => a.pi === 0 && a.title === 'Bottled Lightning'), asked);

  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
