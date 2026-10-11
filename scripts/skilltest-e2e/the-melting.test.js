'use strict';
// The Melting (Spell/Reaction, Support Magic Lv1): „Play this card immediately when one or more targets are Frozen. Heal all Frozen targets on the board from
// their Freeze. If the user has at least Destruction Magic 1 and the Freeze effect was an opponent's effect during the opponent's turn, immediately end
// their turn." — Das generische Kettenfenster auf `onStatusApplied`; Massen-Freezes laufen über `engine.batchStatusWindow` als EIN Fenster.
//   node scripts/skilltest-e2e/the-melting.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const MELT = 'The Melting';
const ST = 'Sculpture Theft';
const DB = require('../../cards/effects/_card-db').getCardDB();
const pick = (pred, n = 0) => Object.values(DB).filter(pred).sort((a, b) => a.name.localeCompare(b.name))[n].name;
const KRE = pick(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name) && (c.hp || 0) > 0);
const stapel = (name, n) => Array.from({ length: n }, () => name);

/**
 * Spiel mit zwei Sitzen. Sitz 0 hält The Melting (Held 0: Support Magic `sm`, Destruction Magic `dm`; Held 1: `sm1`/`dm1`), Sitz 1 ist der Gegner.
 * `aktiv` = wessen Zug es ist (Standard: 1, der Gegner).
 */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  engine._fastMode = false;                       // der Sim-Lauf steht auf Fast-Mode: dort feuern die Kreaturen-Status-Hooks (samt Reaktionsfenster) nie
  engine._delay = async () => {};                 // …Wartezeiten sparen (Fast-Mode tat das bisher)
  gs.turn = 6; gs.activePlayer = opts.aktiv ?? 1; gs.currentPhase = 3; gs.firstTurnProtectedPlayer = null;
  for (const c of engine.cardInstances.filter(c => c.zone === 'support' || c.zone === 'surprise' || c.zone === 'hand')) engine._untrackCard(c.id);
  const [p0, p1] = gs.players;
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.hand = []; ps.discardPile = []; ps.deletedPile = [];
    ps.heroesActedThisTurn = [];
    ps.abilityZones = ps.abilityZones.map(() => [[], [], []]);
  }
  p0.abilityZones[0] = [stapel('Support Magic', opts.sm ?? 1), stapel('Destruction Magic', opts.dm ?? 0), []];
  p0.abilityZones[1] = [stapel('Support Magic', opts.sm1 ?? 0), stapel('Destruction Magic', opts.dm1 ?? 0), []];
  if (opts.magicArts) p0.abilityZones[2] = [stapel('Magic Arts', 1), [], []];
  const t = { room, host, engine, gs, p0, p1, prompts: [], events: [], logs: [], heroWahl: null, antwort: true };
  engine.promptGeneric = async (pi, d) => {
    t.prompts.push({ pi, d });
    if (d.type === 'confirm') return typeof t.antwort === 'function' ? t.antwort(pi, d) : t.antwort;
    if (d.type === 'optionPicker') return { optionId: t.heroWahl ?? d.options[0].id };
    return undefined;
  };
  engine.promptEffectTarget = async (pi, ziele) => (ziele[0] ? [ziele[0].id] : []);
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, ...r) => { t.events.push({ ev, data }); return origBc(ev, data, ...r); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, d) => { t.logs.push({ type, d }); return origLog(type, d); };
  return t;
}
function setzeHand(t, names, seat = 0) {
  t.gs.players[seat].hand = [...names];
  for (const n of names) t.engine._trackCard(n, seat, 'hand');
}
function lege(t, seat, hi, slot, name = KRE) {
  t.gs.players[seat].supportZones[hi][slot] = [name];
  return t.engine._trackCard(name, seat, 'support', hi, slot);
}
const friere = (t, inst, von = 1) => t.engine.applyCreatureStatus(inst, 'frozen', { sourceOwner: von, source: 'Test', duration: 1 });
const friereHeld = (t, seat, hi, von = 1) => t.engine.addHeroStatus(seat, hi, 'frozen', { duration: 1, appliedBy: von });
const angebote = (t, titel = MELT, pi = 0) => t.prompts.filter(p => p.pi === pi && p.d.type === 'confirm' && p.d.title === titel);
const anim = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'the_melting').map(e => e.data);
const log = (t, typ) => t.logs.filter(l => l.type === typ).map(l => l.d);
const gefroren = (t) => {
  const out = [];
  t.gs.players.forEach((ps, p) => ps.heroes.forEach((h, hi) => { if (h.statuses && h.statuses.frozen) out.push(`${p}:H${hi}`); }));
  for (const c of t.engine.cardInstances) if (c.zone === 'support' && c.counters && c.counters.frozen) out.push(`${c.owner}:${c.heroIdx}.${c.zoneSlot}`);
  return out;
};

(async () => {
  console.log('Karte, Kunst und Skript');
  {
    const cd = DB[MELT], s = loadCardEffect(MELT);
    check('Spell, Reaction, Lv1, Support Magic', cd && cd.cardType === 'Spell' && cd.subtype === 'Reaction' && cd.level === 1 && cd.spellSchool1 === 'Support Magic', cd);
    check('Kartentext: „one or more targets are Frozen", ALLE Gefrorenen, Destruction Magic 1, Gegner-Effekt im Gegner-Zug', cd && /Play this card immediately when one or more targets are Frozen\./.test(cd.effect) && /Heal all Frozen targets on the board from their Freeze\./.test(cd.effect) && /at least Destruction Magic 1/.test(cd.effect) && /opponent's effect during the opponent's turn, immediately end their turn\./.test(cd.effect), cd && cd.effect);
    check('Skript: Kettenreaktion (`isReaction`, nie aktiv spielbar), Bedingung, Kettenglied-Hook, Auflösung, CPU-Heuristik', s.isReaction === true && s.canActivate() === false && typeof s.reactionCondition === 'function' && typeof s.onChainAdd === 'function' && typeof s.resolve === 'function' && typeof s.cpuMeta?.reactionHeuristic === 'function');
    const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/card-art/index.json'), 'utf8'));
    check('Kunst nativ 76×51 im Index und als Datei', idx[MELT] && idx[MELT].kind === 'a' && fs.existsSync(path.join(__dirname, '../../data/card-art/native', idx[MELT].id + '.png')));
    const quelle = (n) => fs.readFileSync(path.join(__dirname, '../../cards/effects', n + '.js'), 'utf8');
    const massen = ['iceage', 'cold-hearted-yuki-onna', 'embodiment-of-biseria', 'snowstorm-mischief', 'mischief-invasion', 'the-white-army'];
    check('alle Massen-Freezes bündeln ihr Eis über `batchStatusWindow(\'frozen\', …)`', massen.every(n => /batchStatusWindow\('frozen'/.test(quelle(n))), massen.filter(n => !/batchStatusWindow\('frozen'/.test(quelle(n))));
  }
  console.log(`(Testkreatur: ${KRE})`);

  console.log('Ein Freeze → Angebot → ALLE Gefrorenen tauen auf');
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    const eigene = lege(t, 0, 1, 0), fremde = lege(t, 1, 2, 1);
    t.p0.heroes[2].statuses.frozen = { duration: 1, appliedBy: 0, appliedTurn: 5 };   // schon gefrorener eigener Held (Eis aus früherem Effekt)
    fremde.counters.frozen = 1;                // schon gefrorene Gegner-Kreatur
    t.prompts.length = 0; t.events.length = 0;
    await friere(t, eigene, 1);                // JETZT friert der Gegner (Sitz 1) meine Kreatur ein → Fenster
    check('dem Besitzer der Karte wird sie angeboten (Held mit Support Magic Lv1)', angebote(t).length === 1, t.prompts.map(p => p.d.title));
    check('ALLE Gefrorenen sind aufgetaut — das neue Eis, der alte eigene Held, die Gegner-Kreatur', gefroren(t).length === 0, gefroren(t));
    check('The Melting liegt in der Ablage, nicht mehr auf der Hand', t.p0.discardPile.includes(MELT) && !t.p0.hand.includes(MELT), { abl: t.p0.discardPile, hand: t.p0.hand });
    const a = anim(t);
    check('Brett-Animation `the_melting` (zoneType board) mit ALLEN drei Zielen', a.length === 1 && a[0].zoneType === 'board' && a[0].targets.length === 3 && a[0].targets.some(x => x.zoneSlot === -1) && a[0].regionAll === true, a);
    const l = log(t, 'the_melting');
    check('Log `the_melting`: 3 aufgetaut, Zug NICHT beendet (keine Destruction Magic)', l.length === 1 && l[0].healed === 3 && l[0].endedTurn === false, l);
    check('kein Zug-Ende vorgemerkt', t.gs._terrorForceEndTurn == null, t.gs._terrorForceEndTurn);
  }
  {
    const t = await fresh({ sm: 1 });
    await friere(t, lege(t, 0, 0, 0), 1);
    check('ohne The Melting auf der Hand: kein Angebot, das Eis bleibt', angebote(t).length === 0 && gefroren(t).length === 1);
  }
  {
    const t = await fresh({ sm: 0 });
    setzeHand(t, [MELT]);
    await friere(t, lege(t, 0, 0, 0), 1);
    check('kein Held mit Support Magic Lv1: nicht angeboten, das Eis bleibt', angebote(t).length === 0 && gefroren(t).length === 1, t.prompts.map(p => p.d.title));
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    t.antwort = false;
    const k = lege(t, 0, 0, 0);
    await friere(t, k, 1);
    check('„Nein": die Karte bleibt auf der Hand, das Eis bleibt', angebote(t).length === 1 && t.p0.hand.includes(MELT) && gefroren(t).length === 1, { hand: t.p0.hand });
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    const k = lege(t, 0, 0, 0);
    await t.engine.applyCreatureStatus(k, 'stunned', { sourceOwner: 1 });
    check('andere Status (Stun) öffnen das Fenster nicht', angebote(t).length === 0);
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    await friereHeld(t, 0, 2, 1);
    check('auch ein eingefrorener HELD öffnet das Fenster; ein anderer Held (Held 0) wirkt — der gefrorene taut', angebote(t).length === 1 && gefroren(t).length === 0, { prompts: t.prompts.map(p => p.d.title), gefroren: gefroren(t) });
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    const k = lege(t, 1, 0, 0);
    await friere(t, k, 0);                       // MEIN eigener Effekt friert die Kreatur des Gegners ein
    check('auch bei Eis aus dem EIGENEN Effekt und auf fremden Zielen wird die Karte angeboten und taut alles', angebote(t).length === 1 && gefroren(t).length === 0, { prompts: t.prompts.map(p => p.d.title), gefroren: gefroren(t) });
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT, MELT]);
    await friere(t, lege(t, 0, 0, 0), 1);
    check('zwei Kopien auf der Hand: EINE wird gespielt, die zweite bleibt (nichts mehr gefroren)', t.p0.discardPile.filter(c => c === MELT).length === 1 && t.p0.hand.filter(c => c === MELT).length === 1, { abl: t.p0.discardPile, hand: t.p0.hand });
  }

  console.log('„Immediately end their turn“ — Destruction Magic 1 UND Gegner-Eis im Gegner-Zug');
  {
    const t = await fresh({ sm: 1, dm: 1 });
    setzeHand(t, [MELT]);
    await friere(t, lege(t, 0, 0, 0), 1);
    check('Destruction Magic 1, Eis des Gegners in SEINEM Zug: sein Zug wird beendet (`gs._terrorForceEndTurn` = Sitz 1)', t.gs._terrorForceEndTurn === 1, t.gs._terrorForceEndTurn);
    check('…Quelle ist The Melting des Nutzers (Sitz 0) — damit greifen Blackstache & Co.', t.gs._terrorForceEndSource && t.gs._terrorForceEndSource.name === MELT && t.gs._terrorForceEndSource.owner === 0, t.gs._terrorForceEndSource);
    check('…und Log `the_melting` meldet es', log(t, 'the_melting')[0].endedTurn === true && log(t, 'the_melting')[0].healed === 1, log(t, 'the_melting'));
  }
  {
    const t = await fresh({ sm: 1, dm: 0 });
    setzeHand(t, [MELT]);
    await friere(t, lege(t, 0, 0, 0), 1);
    check('Destruction Magic 0: der Zug bleibt, das Eis taut trotzdem', t.gs._terrorForceEndTurn == null && gefroren(t).length === 0);
  }
  {
    const t = await fresh({ sm: 1, dm: 1 });
    setzeHand(t, [MELT]);
    await friere(t, lege(t, 1, 0, 0), 0);
    check('Eis aus dem EIGENEN Effekt des Nutzers (auch im Zug des Gegners): kein Zug-Ende', t.gs._terrorForceEndTurn == null && gefroren(t).length === 0, t.gs._terrorForceEndTurn);
  }
  {
    const t = await fresh({ sm: 1, dm: 1, aktiv: 0 });
    setzeHand(t, [MELT]);
    await friere(t, lege(t, 0, 0, 0), 1);
    check('Eis des Gegners im EIGENEN Zug (nicht im Zug des Gegners): kein Zug-Ende', t.gs._terrorForceEndTurn == null && gefroren(t).length === 0, t.gs._terrorForceEndTurn);
  }
  {
    const t = await fresh({ sm: 1, dm: 1 });
    setzeHand(t, [MELT]);
    await friereHeld(t, 0, 2, 1);
    check('auch beim Helden-Freeze des Gegners endet sein Zug', t.gs._terrorForceEndTurn === 1 && gefroren(t).length === 0, { flag: t.gs._terrorForceEndTurn, gefroren: gefroren(t) });
  }
  {
    const t = await fresh({ sm: 1, dm: 1 });
    setzeHand(t, [MELT]);
    t.p1.heroes[1].name = 'Blackstache, Scourge of the Pixel Seas';
    t.engine._clearHeroScriptCache?.(t.p1.heroes[1]);
    await friere(t, lege(t, 0, 0, 0), 1);
    check('Blackstache auf der Gegnerseite schützt vor dem Zug-Ende (`turn_end_blocked`) — das Eis taut trotzdem', t.gs._terrorForceEndTurn == null && gefroren(t).length === 0 && log(t, 'turn_end_blocked').length === 1 && log(t, 'the_melting')[0].blocked === true, { flag: t.gs._terrorForceEndTurn, l: log(t, 'the_melting') });
  }
  {
    // Zwei mögliche Wirker: nur Held 0 hat Destruction Magic — wer wirkt, entscheidet über das Zug-Ende
    const mitHeld = async (wahl) => {
      const t = await fresh({ sm: 1, dm: 1, sm1: 1, dm1: 0 });
      setzeHand(t, [MELT]);
      t.heroWahl = wahl;
      await friere(t, lege(t, 0, 2, 0), 1);
      return t;
    };
    const a = await mitHeld('hero-0');
    check('zwei mögliche Wirker: der Spieler wählt; Held 0 (Destruction Magic 1) → Zug-Ende', a.prompts.some(p => p.d.type === 'optionPicker') && a.gs._terrorForceEndTurn === 1, { picker: a.prompts.map(p => p.d.type), flag: a.gs._terrorForceEndTurn });
    const b = await mitHeld('hero-1');
    check('…Held 1 (nur Support Magic) wirkt: Eis taut, KEIN Zug-Ende', b.gs._terrorForceEndTurn == null && gefroren(b).length === 0, { flag: b.gs._terrorForceEndTurn });
  }
  {
    // Das Ergebnis steht beim Aktivieren fest: der Freeze kam vom Gegner
    const t = await fresh({ sm: 1, dm: 1 });
    setzeHand(t, [MELT]);
    const k = lege(t, 0, 0, 0);
    await friere(t, k, 1);
    check('(Gegenprobe) dasselbe Setup, Eis vom Gegner → Zug-Ende vorgemerkt', t.gs._terrorForceEndTurn === 1);
  }

  console.log('Massen-Freeze: EIN Fenster nach dem ganzen Effekt („one or more targets“)');
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    const ks = [lege(t, 0, 0, 0), lege(t, 0, 1, 0), lege(t, 0, 2, 0)];
    t.prompts.length = 0;
    await t.engine.batchStatusWindow('frozen', async () => { for (const k of ks) await friere(t, k, 1); });
    check('drei Kreaturen im Stapel eingefroren: GENAU EIN Angebot, nach dem ganzen Effekt', angebote(t).length === 1, t.prompts.map(p => p.d.title));
    check('…und alle drei tauen auf', gefroren(t).length === 0 && log(t, 'the_melting')[0].healed === 3, { gefroren: gefroren(t), l: log(t, 'the_melting') });
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    t.antwort = false;
    const ks = [lege(t, 0, 0, 0), lege(t, 0, 1, 0), lege(t, 0, 2, 0)];
    for (const k of ks) await friere(t, k, 1);
    check('Gegenprobe ohne Stapel: jedes Eis öffnet sein EIGENES Fenster (3 Angebote)', angebote(t).length === 3, angebote(t).length);
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    for (let hi = 0; hi < 3; hi++) t.p0.heroes[hi].statuses = {};
    t.prompts.length = 0;
    await t.engine.batchStatusWindow('frozen', async () => { for (let hi = 0; hi < 3; hi++) await friereHeld(t, 0, hi, 1); });
    check('ein Massen-Freeze, der ALLE eigenen Helden trifft: kein Wirker mehr — kein Angebot, alles bleibt gefroren', angebote(t).length === 0 && gefroren(t).length === 3, { prompts: t.prompts.map(p => p.d.title), gefroren: gefroren(t) });
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    const ks = [lege(t, 0, 0, 0), lege(t, 0, 1, 0)];
    ks.forEach(k => { k.counters.freeze_immune = 0; });
    await t.engine.batchStatusWindow('frozen', async () => {
      await friere(t, ks[0], 1);
      await t.engine.batchStatusWindow('frozen', async () => { await friere(t, ks[1], 1); });   // verschachtelt: gleicher Stapel
    });
    check('verschachtelte Stapel sammeln im äußeren: ein Angebot, beide tauen', angebote(t).length === 1 && gefroren(t).length === 0, { n: angebote(t).length, gefroren: gefroren(t) });
  }
  {
    const t = await fresh({ sm: 1 });
    setzeHand(t, [MELT]);
    t.antwort = false;
    const k = lege(t, 0, 0, 0);
    let fehler = null;
    try { await t.engine.batchStatusWindow('frozen', async () => { await friere(t, k, 1); throw new Error('Test'); }); } catch (e) { fehler = e.message; }
    check('wirft der Effekt mitten im Stapel, wird der Stapel geräumt (nächstes Eis öffnet wieder ein Einzelfenster)', fehler === 'Test' && !t.engine._statusBatch);
  }

  console.log('Sculpture Theft arbeitet weiter — auch mit dem Stapel');
  {
    const t = await fresh({ sm: 0, magicArts: true });
    setzeHand(t, [ST]);
    const k = lege(t, 1, 0, 0);
    await friere(t, k, 0);
    check('Einzelfall: Sculpture Theft wird angeboten und holt die Kreatur auf die Hand', angebote(t, ST).length === 1 && t.p0.hand.includes(KRE), { prompts: t.prompts.map(p => p.d.title), hand: t.p0.hand });
  }
  {
    const t = await fresh({ sm: 0, magicArts: true });
    setzeHand(t, [ST]);
    const ks = [lege(t, 1, 0, 0), lege(t, 1, 1, 0)];
    await t.engine.batchStatusWindow('frozen', async () => { for (const k of ks) await friere(t, k, 0); });
    check('Stapel: Sculpture Theft wird EINMAL angeboten (nach dem ganzen Effekt) und holt eine der gefrorenen Kreaturen', angebote(t, ST).length === 1 && t.p0.hand.includes(KRE), { prompts: t.prompts.map(p => p.d.title), hand: t.p0.hand });
  }

  console.log('CPU-Heuristik: nur spielen, wenn das Eis überwiegend eigene Ziele trifft');
  {
    const t = await fresh({ sm: 1 });
    t.engine._cpuPlayerIdx = 0;
    const h = loadCardEffect(MELT).cpuMeta.reactionHeuristic;
    check('nichts gefroren → nicht spielen', h(t.engine) === false);
    await friere(t, lege(t, 0, 0, 0), 1);
    check('ein eigenes gefrorenes Ziel, kein fremdes → spielen', h(t.engine) === true);
    await friere(t, lege(t, 1, 0, 0), 0);
    check('eigene und fremde gleich viele → spielen (Gleichstand zählt)', h(t.engine) === true);
    await friere(t, lege(t, 1, 1, 0), 0);
    check('mehr fremde als eigene → nicht spielen', h(t.engine) === false);
  }

  console.log(fails === 0 ? '\n✓ The-Melting-Tests grün' : `\n✗ ${fails} Fehler`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
