'use strict';
// W72a · Control Monitors — CPU: echtes CPU-Gehirn (BEIDE Sitze) und PUZZLE-Gegner. Meldung Al: „Die Puzzle-CPU aktiviert, trotz eines Heroes, der das koennte, nie ‚Control Monitors' in
//   Reaktion auf meine Magnetic Potion. Die Erwartung ist: Ich fuege eine Karte meiner Hand hinzu, also sollte Monitors eingesetzt werden und die nehmen!"
// Erwartet: Mensch spielt Magnetic Potion → die CPU-Seite (Control Monitors + Held mit Decay Magic/Magic Arts Lv1 + mindestens 1 weitere Handkarte) setzt Monitors ein,
//   zahlt die entbehrlichste Handkarte (nicht Fireball / die teure Kreatur), die hinzugefuegte Karte ist geloescht. Ohne Held / ohne weitere Handkarte: nichts (nie ohne Ziel).
//   Die CPU als Hinzufuegende waehlt „die hinzugefuegten Karten loeschen" (kleineres Uebel). Aufruf: node docs/niche-tests/repro/W72/a-17-….js   (Exit 0 = korrekt)
const L = require('../../lib/monitors.js');
const { H, F, MC } = L;
const cpu = require('../../../../cards/effects/_cpu.js');

/** Puzzle-Betrieb wie `createPuzzleGame`: Sitz 1 = CPU-Gegner OHNE Gehirn (`isPuzzle`, Prompts an Sitz 1 laufen ueber die echte Engine-Methode). Sitz 0 = Mensch (Harness-Antworten). */
function puzzleModus(t) {
  const eng = t.engine;
  eng.isPuzzle = true; eng._isSelfPlay = false; eng._cpuPlayerIdx = 1;
  const proto = Object.getPrototypeOf(eng).promptGeneric;
  const harness = eng.promptGeneric;
  eng.promptGeneric = async (pi, d, ...r) => {
    if (pi !== 1) return harness(pi, d, ...r);
    const eintrag = { pi, d, sim: false }; t.prompts.push(eintrag);
    eintrag.antwort = await proto.call(eng, pi, d, ...r);
    return eintrag.antwort;
  };
}

(async () => {
  const R = H.runner();

  // ── 1) Echtes CPU-Gehirn auf dem Monitors-Sitz (beide Sitze) ──
  for (const M of [0, 1]) {
    const A = 1 - M;
    R.section(`CPU-Gehirn auf Sitz ${M} (haelt Monitors + Held), Mensch auf Sitz ${A} spielt Magnetic Potion`);
    const t = await L.szene(M, { handM: [MC, F, 'Fireball', 'Cute Hydra'] });
    t.engine._cpuPlayerIdx = M; cpu.installCpuBrain(t.engine);
    await t.play(A, 'Magnetic Potion'); await t.drain();
    R.check('die CPU hat Control Monitors eingesetzt (Ablage)', t.pile(M, 'discardPile').includes(MC), t.pile(M, 'discardPile'));
    R.check('die hinzugefuegte Karte (Fireball) ist beim Menschen geloescht', t.pile(A, 'deletedPile').includes('Fireball') && !t.pile(A, 'hand').includes('Fireball'), { g: t.pile(A, 'deletedPile'), h: t.pile(A, 'hand') });
    R.check('die CPU zahlte die ENTBEHRLICHSTE Karte (den Filler), behielt Fireball und die Kreatur', t.pile(M, 'discardPile').includes(F) && t.pile(M, 'hand').includes('Fireball') && t.pile(M, 'hand').includes('Cute Hydra'), { ab: t.pile(M, 'discardPile'), h: t.pile(M, 'hand') });
    R.check('genau ein Preis (N=1)', t.pile(M, 'discardPile').length === 2, t.pile(M, 'discardPile'));
    R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

    R.section(`CPU-Gehirn auf Sitz ${M}: keine weitere Handkarte → nie ohne Preis, nichts passiert`);
    const t2 = await L.szene(M, { handM: [MC] });
    t2.engine._cpuPlayerIdx = M; cpu.installCpuBrain(t2.engine);
    await t2.play(A, 'Magnetic Potion'); await t2.drain();
    R.check('Monitors bleibt auf der Hand, Fireball bleibt', t2.pile(M, 'hand').join() === MC && t2.pile(A, 'hand').includes('Fireball'), { h: t2.pile(M, 'hand'), ha: t2.pile(A, 'hand') });

    R.section(`CPU-Gehirn auf Sitz ${M}: kein Held, der Control Monitors wirken kann → nichts`);
    const t3 = await L.szene(M, { keinHeld: true });
    t3.engine._cpuPlayerIdx = M; cpu.installCpuBrain(t3.engine);
    await t3.play(A, 'Magnetic Potion'); await t3.drain();
    R.check('Monitors bleibt auf der Hand', t3.pile(M, 'hand').includes(MC) && t3.pile(A, 'hand').includes('Fireball'));

    R.section(`Die CPU als HINZUFUEGENDE (Sitz ${A}) waehlt „die hinzugefuegten Karten loeschen"`);
    const t4 = await L.szene(M);
    t4.engine._cpuPlayerIdx = A; cpu.installCpuBrain(t4.engine);
    const antwort = t4.engine._getCpuGenericResponse({ type: 'optionPicker', title: MC, options: [{ id: 'added' }, { id: 'rest' }], cancellable: false }, A);
    R.check('optionPicker → added', antwort && antwort.optionId === 'added', antwort);
  }

  // ── 2) PUZZLE: Sitz 0 = Mensch, Sitz 1 = CPU-Gegner ohne Gehirn ──
  R.section('PUZZLE: Mensch (Sitz 0) spielt Magnetic Potion, der CPU-Gegner (Sitz 1) haelt Control Monitors + Held (Decay Magic + Magic Arts)');
  const mkPuz = async (o = {}) => {
    const t = await H.fresh({ active: 0, hand: [['Magnetic Potion', F], o.handCpu || [MC, 'Cute Hydra', F, 'Fireball']], deck: [['Fireball', F, F, F], [F, F, F]], gold: [100, 100] });
    puzzleModus(t);
    if (!o.keinHeld) t.grantFor(1, 0, MC);
    return t;
  };
  let t = await mkPuz();
  await t.play(0, 'Magnetic Potion'); await t.drain();
  R.note('prompts', JSON.stringify(t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || ''))));
  R.check('Puzzle: die CPU hat Control Monitors eingesetzt', t.pile(1, 'discardPile').includes(MC), t.pile(1, 'discardPile'));
  R.check('Puzzle: die hinzugefuegte Karte des Menschen ist geloescht', t.pile(0, 'deletedPile').includes('Fireball') && !t.pile(0, 'hand').includes('Fireball'), { g: t.pile(0, 'deletedPile'), h: t.pile(0, 'hand') });
  R.check('Puzzle: die CPU zahlte die billigste Karte (Filler), nicht Fireball / Cute Hydra', t.pile(1, 'discardPile').includes(F) && t.pile(1, 'hand').includes('Fireball') && t.pile(1, 'hand').includes('Cute Hydra'), { ab: t.pile(1, 'discardPile'), h: t.pile(1, 'hand') });
  R.check('Puzzle: die Preiswahl der CPU wurde beantwortet (handPick mit 1 Karte)', t.prompts.some(p => p.pi === 1 && p.d.type === 'handPick' && p.antwort && p.antwort.selectedCards && p.antwort.selectedCards.length === 1));
  R.check('Puzzle: sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

  R.section('PUZZLE: der CPU-Gegner hat keinen Helden, der es wirken kann → kein Einsatz; zu wenige Handkarten → kein Einsatz');
  t = await mkPuz({ keinHeld: true });
  await t.play(0, 'Magnetic Potion'); await t.drain();
  R.check('ohne Held: Monitors bleibt auf der Hand, Fireball bleibt', t.pile(1, 'hand').includes(MC) && t.pile(0, 'hand').includes('Fireball'));
  t = await mkPuz({ handCpu: [MC] });
  await t.play(0, 'Magnetic Potion'); await t.drain();
  R.check('ohne weitere Handkarte: Monitors bleibt auf der Hand (nie ohne Preis)', t.pile(1, 'hand').join() === MC && t.pile(0, 'hand').includes('Fireball'), { h: t.pile(1, 'hand') });

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
