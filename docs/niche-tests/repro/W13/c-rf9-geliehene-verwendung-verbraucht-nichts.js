'use strict';
// W13c · Rückfrage 9 (geliehene Verwendung und Zähler der geliehenen Karte, z. B. 3-Headed Giant) · Al, 15.10.2026: „Nein, nicht verbrauchen."
// Eine durch Grimoire/Kohta (oder andere Ausleih-Effekte) GELIEHENE Verwendung (`engine.reactivateCreatureEffect(inst, pi, { borrowed: true })`, `ctx._borrowedUse`) verbraucht
//   den Zähler/Einmal-Stempel der geliehenen Karte NICHT (Ausnahme: „hard once per turn", siehe c-rf8). Die Karte muss dabei WIRKLICH feuern (kein leerer Test).
// Je Karte zwei Szenen: (1) Kontrolle — die NORMALE Aktivierung (`t.activateCreature`) verändert den Stempel (der Messpunkt sieht ihn also); (2) geliehene Verwendung — Stempel unverändert.
// Dazu Folgeproben: 3-Headed Giant nutzt nach der Leihe weiter alle 3 normalen Schläge; Grimoire (Karte selbst) sperrt die geliehene Karte weiter für den Zug („cannot be used another time … in any way").
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const { usesLeft } = require('../../../../cards/effects/_charges');
const FIL = H.INERT.filler;

// Aufbauten: je Karte `bau(t)` → Instanz (Sitz 0), `messen(t, inst)` → JSON-Zeichenkette des Stempel-Messpunkts.
const FAELLE = [
  { name: '3-Headed Giant',
    bau: (t) => t.put(0, 0, 0, '3-Headed Giant'),
    messen: (t, i) => usesLeft(i, t.gs, { key: 'threeHeadedGiant', max: 3 }) },
  { name: 'Analyzer from the Cosmic Depths',
    bau: (t) => { const i = t.put(0, 0, 0, 'Analyzer from the Cosmic Depths'); i.counters.changeCounter = 8; return i; },
    messen: (t, i) => [t.gs.hoptUsed?.[`analyzer-move:${i.id}`], t.gs.hoptUsed?.[`analyzer-spawn:${i.id}`]],
    optionen: [{ match: d => d.type === 'optionPicker' && (d.options || []).some(o => o.id === 'move'), answer: () => ({ optionId: 'move' }) },
      { match: d => d.type === 'optionPicker' && /Move how many/.test(d.description || ''), answer: () => ({ optionId: '2' }) }] },
  { name: 'Gatherer from the Cosmic Depths',
    bau: (t) => { const i = t.put(0, 0, 0, 'Gatherer from the Cosmic Depths'); i.counters.changeCounter = 4; return i; },
    messen: (t, i) => [t.gs.hoptUsed?.[`gatherer-move:${i.id}`], t.gs.hoptUsed?.[`gatherer-draw:${i.id}`]],
    optionen: [{ match: d => d.type === 'optionPicker' && (d.options || []).some(o => o.id === 'draw'), answer: () => ({ optionId: 'draw' }) },
      { match: d => d.type === 'optionPicker' && /how many|Spend|Draw/i.test(d.description || ''), answer: () => ({ optionId: '2' }) }] },
  { name: 'Sparkfly Queen',
    bau: (t) => t.put(0, 0, 0, 'Sparkfly Queen'),
    messen: (t, i) => i.counters._sparkflyQueenModeUsed || {},
    optionen: [{ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: (d.options.find(o => o.id === 'main') || d.options[0]).id }) }] },
  { name: 'Cheeky Monkee',
    bau: (t) => { const i = t.put(0, 1, 0, 'Cheeky Monkee'); t.hero(0, 1)._investCounters = 12; return i; },
    messen: (t, i) => t.gs.hoptUsed?.[`monkee-invest:${i.id}`] },
  { name: 'Nimble Monkee',
    bau: (t) => { const i = t.put(0, 1, 0, 'Nimble Monkee'); t.hero(0, 1)._investCounters = 12; return i; },
    messen: (t, i) => t.gs.hoptUsed?.[`monkee-invest:${i.id}`] },
  { name: 'Resilient Monkee',
    bau: (t) => { const i = t.put(0, 1, 0, 'Resilient Monkee'); t.hero(0, 1)._investCounters = 12; return i; },
    messen: (t, i) => t.gs.hoptUsed?.[`monkee-invest:${i.id}`] },
  { name: 'Criminal Monkee',
    deck: ['Non-Fungible Monkee'],
    bau: (t) => { const i = t.put(0, 1, 0, 'Criminal Monkee'); t.hero(0, 1)._investCounters = 12; return i; },
    messen: (t, i) => t.gs.hoptUsed?.[`monkee-invest:${i.id}`] },
  { name: 'Debt-O-Tron Model Loan Shredder',
    bau: (t) => { t.setGold(0, 50); return t.put(0, 0, 0, 'Debt-O-Tron Model Loan Shredder'); },
    messen: (t) => t.gs.hoptUsed?.['debt-shredder-cut:0'] },
  { name: 'Debt-O-Tron Model Missing Parts',
    bau: (t) => { t.setGold(0, -30); return t.put(0, 0, 0, 'Debt-O-Tron Model Missing Parts'); },
    messen: (t) => t.gs.hoptUsed?.['debt-missing-parts:0'] },
  { name: 'Gigantisaur Chimera',
    bau: (t) => { t.setDiscard(0, ['Gigantisaur Ankylos']); return t.put(0, 0, 0, 'Gigantisaur Chimera'); },
    messen: (t, i) => t.gs.hoptUsed?.[`chimera-blast:${i.id}`] },
  { name: 'Phatnir, Prototype of Coolness',
    bau: (t) => t.put(0, 0, 0, 'Phatnir, Prototype of Coolness'),
    messen: (t, i) => i.counters.phatnirBlastedThisTurn },
  { name: 'Wowkyrie, Bringer of Coolness',
    bau: (t) => { t.gs.players[0].coolnessStack.push(FIL); t.engine._trackCard(FIL, 0, 'coolnessStack'); return t.put(0, 0, 0, 'Wowkyrie, Bringer of Coolness'); },
    messen: (t, i) => i.counters.wowkyriePushedThisTurn },
  { name: 'Thrysh, Robber of Coolness',
    bau: (t) => { t.gs.players[0].mainDeck.unshift('Modnir, Hammer of Coolness'); return t.put(0, 0, 0, 'Thrysh, Robber of Coolness'); },
    messen: (t, i) => i.counters.thryshRobbedThisTurn },
  { name: 'Swagdri, Forger of Coolness',
    bau: (t) => { const ps = t.gs.players[0]; ps.coolnessStack.push('Golden Bananas'); t.engine._trackCard('Golden Bananas', 0, 'coolnessStack'); t.putArea(0, 'Wowhalla, the Hall of the Cool'); return t.put(0, 1, 0, 'Swagdri, Forger of Coolness'); },
    messen: (t, i) => i.counters.swagdriPlayedArtifactThisTurn },
];

async function szene(f) {
  const t = await H.fresh({ deck: [Array(30).fill(FIL), Array(30).fill(FIL)] });
  if (f.deck) t.gs.players[0].mainDeck.unshift(...f.deck);
  const inst = f.bau(t);
  inst.turnPlayed = 1;
  t.targetFn = (valid) => { const g = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid.find(v => !v.ineligible) || valid[0]; return [g.id]; };
  t.policy.confirm = true;
  for (const s of (f.optionen || [])) t.script.push({ ...s, once: false });
  t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }), once: false });
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }), once: false });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }), once: false });
  t.gs.currentPhase = 2;
  return { t, inst };
}

(async () => {
  const R = H.runner();
  for (const f of FAELLE) {
    const vorher = JSON.stringify((await (async () => { const { t, inst } = await szene(f); return f.messen(t, inst) ?? null; })()));
    { // (1) Kontrolle: normale Aktivierung verändert den Messpunkt
      const { t, inst } = await szene(f);
      const r = await t.activateCreature(0, inst.heroIdx, inst.zoneSlot);
      const nachher = JSON.stringify(f.messen(t, inst) ?? null);
      R.check(`${f.name}: Kontrolle — normale Aktivierung wirkt (${r}) und stempelt (${vorher} → ${nachher})`, r === true && nachher !== vorher && t.errors.length === 0, { r, vorher, nachher, e: t.errors });
    }
    { // (2) geliehene Verwendung: Messpunkt bleibt
      const { t, inst } = await szene(f);
      const dmg0 = t.hp(1, 0) + (t.gs.players[0].hand.length * 1000);
      const ok = await t.run(() => t.engine.reactivateCreatureEffect(inst, 0, { borrowed: true }));
      const nachher = JSON.stringify(f.messen(t, inst) ?? null);
      R.check(`${f.name}: geliehene Verwendung feuert`, ok === true, { ok, e: t.errors });
      R.check(`${f.name}: geliehene Verwendung verbraucht den Zähler/Stempel NICHT (${vorher} → ${nachher})`, nachher === vorher, { vorher, nachher });
      R.check(`${f.name}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
      void dmg0;
    }
  }

  R.section('3-Headed Giant: nach der Leihe bleiben alle 3 normalen Schläge');
  { // Folgeprobe 1: erst geliehen, dann 3 normale Schläge, der vierte normale wird verweigert
    const { t, inst } = await szene(FAELLE[0]);
    const h0 = t.hp(1, 0);
    await t.run(() => t.engine.reactivateCreatureEffect(inst, 0, { borrowed: true }));
    R.check('Leihe: ein Schlag (80)', h0 - t.hp(1, 0) === 80, h0 - t.hp(1, 0));
    for (let i = 0; i < 3; i++) await t.activateCreature(0, 0, 0);
    R.check('danach 3 normale Schläge (insgesamt 320)', h0 - t.hp(1, 0) === 320, h0 - t.hp(1, 0));
    const vier = await t.activateCreature(0, 0, 0);
    R.check('der vierte normale Schlag wird verweigert (3/3)', vier === false && h0 - t.hp(1, 0) === 320, { vier });
  }
  { // Folgeprobe 2: erst 1 normaler Schlag (1/3), dann geliehen → Zähler bleibt 1/3, zwei normale folgen
    const { t, inst } = await szene(FAELLE[0]);
    await t.activateCreature(0, 0, 0);
    await t.run(() => t.engine.reactivateCreatureEffect(inst, 0, { borrowed: true }));
    R.check('nach 1 normalen + 1 geliehenen Schlag steht der Zähler bei 1/3', usesLeft(inst, t.gs, { key: 'threeHeadedGiant', max: 3 }) === 2, usesLeft(inst, t.gs, { key: 'threeHeadedGiant', max: 3 }));
    const h0 = t.hp(1, 0);
    for (let i = 0; i < 3; i++) await t.activateCreature(0, 0, 0);
    R.check('noch zwei normale Schläge möglich, der dritte wird verweigert (160)', h0 - t.hp(1, 0) === 160, h0 - t.hp(1, 0));
  }

  R.section('Spirit of the Forbidden Grimoire: Zähler bleibt, aber die Grimoire-Sperre gilt weiter');
  { // echter Weg über das Grimoire
    const t = await H.fresh({});
    const SG = 'Spirit of the Forbidden Grimoire';
    t.put(0, 2, 0, SG).turnPlayed = 1; const giant = t.put(0, 0, 0, '3-Headed Giant'); giant.turnPlayed = 1;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) return valid.filter(x => !x.ineligible && x.cardName === '3-Headed Giant').map(x => x.id).slice(0, 1);
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    t.gs.currentPhase = 2;
    const h0 = t.hp(1, 0);
    await t.activateCreature(0, 2, 0);
    R.check('Grimoire leiht den Giant: ein Schlag (80)', h0 - t.hp(1, 0) === 80, h0 - t.hp(1, 0));
    R.check('Zähler des Giants unverbraucht (3 von 3 frei)', usesLeft(giant, t.gs, { key: 'threeHeadedGiant', max: 3 }) === 3, usesLeft(giant, t.gs, { key: 'threeHeadedGiant', max: 3 }));
    const danach = await t.activateCreature(0, 0, 0);
    R.check('Grimoire-Text bleibt: der Giant ist für den Zug gesperrt', danach === false && h0 - t.hp(1, 0) === 80, { danach });
    R.check('keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
