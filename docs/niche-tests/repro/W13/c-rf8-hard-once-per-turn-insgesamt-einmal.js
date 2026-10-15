'use strict';
// W13c · Rückfrage 8 (Grimoire/Kohta und Effekte mit ausdrücklich verschärftem Text „You can only activate/use this effect once per turn") · Al, 15.10.2026: „Nein, solche Effekte sind
//   'hard once per turn' und dürfen, egal mit wie vielen möglichen Instanzen/Nutzern nur *insgesamt einmal* genutzt werden. Nicht erlauben!"
// Verallgemeinerung: Ein „hard once per turn"-Effekt wird je Spieler und Zug insgesamt nur EINMAL genutzt — egal über wie viele Kopien der Karte und egal wie (normale Aktivierung, geliehene
//   Verwendung über Grimoire/Kohta = `reactivateCreatureEffect(…, { borrowed: true })`); auch die geliehene Nutzung verbraucht das Limit (Ausnahme von Rückfrage 9), und bei erschöpftem Limit darf
//   Grimoire/Kohta den Effekt NICHT nutzen. Geprüft für: Rebelliokai Oblivious Oni, Greatmaw Shark, Skeleton Bard, The Spawn Mother (Selbst-Rückholung), Lunatic Golem, Sleeping Beauty, Future Tech Fists.
// Je Karte zwei Reihenfolgen mit je zwei Kopien A, B: (1) ERST GELIEHEN: A geliehen feuert; danach A erneut geliehen, B geliehen und B normal → alle verweigert, Wirkung nur einmal;
//   (2) ERST NORMAL: A normal feuert; danach A geliehen, B geliehen und B normal → alle verweigert. Dazu die Grimoire-Probe über den echten Weg (Oni mit erschöpftem Limit).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const FIL = H.INERT.filler;
const CYCLES = ['Lunatic Cycle - New Moon', 'Lunatic Cycle - Crescent Moon'];

// bau(t) → { a, b } (Sitz-0-Instanzen) und wirkung(t) → Zahl (wächst mit jeder Nutzung)
const FAELLE = [
  { name: 'Rebelliokai Oblivious Oni',
    bau: (t) => { t.put(1, 0, 0, H.INERT.big); const a = t.put(0, 0, 0, 'Rebelliokai Oblivious Oni'), b = t.put(0, 0, 1, 'Rebelliokai Oblivious Oni'); return { a, b }; },
    wirkung: (t) => 800 - t.hp(1, 0) },
  { name: 'Greatmaw Shark',
    bau: (t) => { t.hero(0, 0).atk = 100; for (let s = 0; s < 3; s++) t.put(0, 1, s, H.INERT.creature).turnPlayed = 1; t.put(0, 2, 0, H.INERT.creature).turnPlayed = 1; t.put(0, 2, 1, H.INERT.creature).turnPlayed = 1;
      return { a: t.put(0, 0, 0, 'Greatmaw Shark'), b: t.put(0, 0, 1, 'Greatmaw Shark') }; },
    wirkung: (t) => 5 - t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === H.INERT.creature).length },
  { name: 'Skeleton Bard',
    hand: ['ZZ Filler', 'ZZ Filler'],
    bau: (t) => { t.put(0, 1, 0, 'Skeleton Mage').turnPlayed = 1; t.put(0, 2, 0, 'Skeleton Mage').turnPlayed = 1; t.put(1, 0, 0, H.INERT.big);
      t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable' || d.type === 'handPick', answer: () => ({ handIndex: 0, selectedCards: [{ handIndex: 0, cardName: t.pile(0, 'hand')[0] }] }), once: false });
      return { a: t.put(0, 0, 0, 'Skeleton Bard'), b: t.put(0, 0, 1, 'Skeleton Bard') }; },
    wirkung: (t) => t.pile(0, 'hand').length - 2 },
  { name: 'The Spawn Mother', phase: 3,   // Aktionskosten (creatureActionCost): normale Aktivierung in der Action Phase
    bau: (t) => ({ a: t.put(0, 0, 0, 'The Spawn Mother'), b: t.put(0, 0, 1, 'The Spawn Mother') }),
    wirkung: (t) => 2 - t.inst(c => c.zone === 'support' && c.owner === 0 && c.name === 'The Spawn Mother').length },
  { name: 'Lunatic Golem',
    bau: (t) => { t.put(1, 0, 0, H.INERT.big); CYCLES.forEach((n, i) => t.put(0, 1, i, n)); return { a: t.put(0, 0, 0, 'Lunatic Golem'), b: t.put(0, 0, 1, 'Lunatic Golem') }; },
    wirkung: (t) => 800 - t.hp(1, 0) + (1000 - (t.inst(c => c.zone === 'support' && c.owner === 1 && c.name === H.INERT.big)[0]?.counters?.currentHp ?? 1000)) },
  { name: 'Sleeping Beauty',
    heroes: ['Elana, the Rocky Rebel', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'],
    bau: (t) => { const mk = (s) => { const i = t.put(0, 1, s, 'Sleeping Beauty'); i.counters._linkedHeroOwner = 0; i.counters._linkedHeroIdx = 0; return i; };
      return { a: mk(0), b: mk(1), vorher: async () => { t.setHand(0, ['ZZ Filler', 'ZZ Filler', 'ZZ Filler']); t.gs.activePlayer = 0; t.phase(2); return t.activateHero(0, 0, {}); } }; },
    wirkung: (t) => (t.gs.hoptUsed?.['sleeping-beauty-hard:0'] === t.gs.turn ? 1 : 0) },
];

async function szene(f) {
  const opts = f.heroes ? { heroes: [f.heroes, null] } : {};
  if (f.hand) opts.hand = [f.hand, []];
  const t = await H.fresh({ deck: [Array(30).fill(FIL), Array(30).fill(FIL)], ...opts });
  const { a, b, vorher } = f.bau(t);
  a.turnPlayed = 1; b.turnPlayed = 1;
  t.targetFn = (valid) => { const g = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0 && !v.ineligible) || valid.find(v => !v.ineligible) || valid[0]; return [g.id]; };
  t.policy.confirm = true;
  t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }), once: false });
  t.gs.activePlayer = 0; t.phase(f.phase ?? 2);
  if (vorher) { const r = await vorher(); if (r !== true) throw new Error('Vorbedingung ' + f.name + ': ' + r); }
  return { t, a, b };
}
const geliehen = (t, inst) => t.run(() => t.engine.reactivateCreatureEffect(inst, 0, { borrowed: true }));

(async () => {
  const R = H.runner();
  for (const f of FAELLE) {
    R.section(f.name);
    { // (1) erst geliehen
      const { t, a, b } = await szene(f);
      const w0 = f.wirkung(t);
      const ok1 = await geliehen(t, a);
      const w1 = f.wirkung(t);
      R.check(`${f.name} (1): erste geliehene Verwendung feuert`, ok1 === true && w1 > w0, { ok1, w0, w1, e: t.errors });
      const ok2 = await geliehen(t, a), ok3 = await geliehen(t, b);
      const n = await t.activateCreature(0, b.heroIdx, b.zoneSlot);
      R.check(`${f.name} (1): danach geliehen (gleiche Kopie), geliehen (zweite Kopie), normal (zweite Kopie) → verweigert, Wirkung unverändert`, ok2 === false && ok3 === false && n !== true && f.wirkung(t) === w1, { ok2, ok3, n, w1, w2: f.wirkung(t) });
      R.check(`${f.name} (1): keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    { // (2) erst normal
      const { t, a, b } = await szene(f);
      const w0 = f.wirkung(t);
      const n1 = await t.activateCreature(0, a.heroIdx, a.zoneSlot);
      const w1 = f.wirkung(t);
      R.check(`${f.name} (2): erste normale Aktivierung feuert`, n1 === true && w1 > w0, { n1, w0, w1, e: t.errors });
      const ok2 = await geliehen(t, a), ok3 = await geliehen(t, b);
      const n2 = await t.activateCreature(0, b.heroIdx, b.zoneSlot);
      R.check(`${f.name} (2): danach geliehen (gleiche Kopie), geliehen (zweite Kopie), normal (zweite Kopie) → verweigert, Wirkung unverändert`, ok2 === false && ok3 === false && n2 !== true && f.wirkung(t) === w1, { ok2, ok3, n2, w1, w2: f.wirkung(t) });
      R.check(`${f.name} (2): keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }

  R.section('Future Tech Fists (Ausrüstungs-Effekt, zwei Kopien auf zwei Helden)');
  {
    const F = 'Future Tech Fists';
    const t = await H.fresh({ discard: [[F, F], []], gold: [200, 100] });
    t.put(0, 0, 0, F); t.put(0, 1, 0, F);
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    const base0 = t.hero(0, 0).baseAtk;
    await t.activateEquip(0, 0, 0);
    const nach1 = t.hp(1, 0);
    R.check('Fists: erste Aktivierung trifft (Basis-ATK von Held 0)', nach1 === 800 - base0, { nach1, base0 });
    await t.activateEquip(0, 1, 0);
    R.check('Fists: zweite Kopie im selben Zug verweigert (hard once per turn, spielerweit)', t.hp(1, 0) === nach1, { hp: t.hp(1, 0), nach1 });
    await t.endTurn(); await t.endTurn();
    const h2 = t.hp(1, 0);
    await t.activateEquip(0, 1, 0);
    R.check('Fists: im nächsten eigenen Zug wieder nutzbar', t.hp(1, 0) < h2, { h2, hp: t.hp(1, 0) });
    R.check('Fists: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Grimoire / Kohta über den echten Weg bei erschöpftem hartem Limit');
  { // Grimoire + Oni (Limit durch die Oni selbst verbraucht)
    const t = await H.fresh({});
    const SG = 'Spirit of the Forbidden Grimoire';
    t.put(1, 0, 0, H.INERT.big);
    t.put(0, 2, 0, SG).turnPlayed = 1; const oni = t.put(0, 0, 0, 'Rebelliokai Oblivious Oni'); oni.turnPlayed = 1;
    let angeboten = null;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) { angeboten = valid.filter(x => !x.ineligible).map(x => x.cardName); return []; }
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    t.gs.currentPhase = 2;
    await t.activateCreature(0, 0, 0);
    const nachOni = t.hp(1, 0);
    R.check('Oni hat ihre 150 Schaden verursacht', 800 - nachOni === 150, 800 - nachOni);
    const rg = await t.activateCreature(0, 2, 0);
    R.check('Grimoire darf den Oni bei erschöpftem Limit NICHT nutzen (nicht aktivierbar / nicht angeboten)', rg !== true && !(angeboten || []).includes('Rebelliokai Oblivious Oni') && t.hp(1, 0) === nachOni, { rg, angeboten, hp: t.hp(1, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  { // Grimoire zuerst, dann die Oni selbst: das geliehene Mal zählt
    const t = await H.fresh({});
    const SG = 'Spirit of the Forbidden Grimoire';
    t.put(1, 0, 0, H.INERT.big);
    t.put(0, 2, 0, SG).turnPlayed = 1; const oni = t.put(0, 0, 0, 'Rebelliokai Oblivious Oni'); oni.turnPlayed = 1;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) return valid.filter(x => !x.ineligible && x.cardName === 'Rebelliokai Oblivious Oni').map(x => x.id).slice(0, 1);
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    t.gs.currentPhase = 2;
    await t.activateCreature(0, 2, 0);
    R.check('Grimoire nutzt den Oni (150)', 800 - t.hp(1, 0) === 150, 800 - t.hp(1, 0));
    const h = t.hp(1, 0);
    const r = await t.activateCreature(0, 0, 0);
    R.check('die geliehene Nutzung zählt: Oni selbst danach verweigert', r !== true && t.hp(1, 0) === h, { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
