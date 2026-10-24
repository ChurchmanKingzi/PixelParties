'use strict';
// W73f-01 · Namensreferenz-Sweep: ALLE Karten, deren Text eine Kreatur (oder Namensfamilie) in Anführungszeichen nennt
//
// Idee (Differenztest): Für jedes Paar (Referenzkarte R, genannter Name N) laufen drei Welten mit identischem Aufbau:
//   A  eine ECHTE Kreatur N steht auf dem Brett (die Referenz „sieht" N),
//   B  ein Shroomasaur mit Zusatzname N steht dort,
//   C  ein Shroomasaur OHNE Zusatzname (Nullprobe; filtert alles heraus, was nur „da steht irgendeine Kreatur" ist).
// Gemessen wird in jeder Welt: Stufe und Spielbarkeit der Handkarten (R und die in R genannten Nicht-Kreaturen), Beschwörbarkeit,
// das Ergebnis der Aktivierung von R (Kreatur-/Heldeneffekt), und die Reaktion auf die Niederlage des N-Trägers (eigene Seite / Gegenseite).
// Lücke = A weicht gegenüber C ab, B aber nicht (die Referenz erkennt den Zusatznamen nicht). Umgekehrt (B weicht ab, A nicht) = der
// Zusatzname bewirkt zu viel (er darf nur den NAMEN geben, nie den Effekt der genannten Karte).
// Rauschen: Hat die echte Kreatur N eigene Effekte (Ifrit, Loyal Bone Dog …), erscheinen sie nur in A — die Liste „Nur A" wird als Notiz
// ausgegeben und von Hand gegen den Kartentext geprüft; erwartete Befunde stehen in ERWARTET_NUR_A.
const H = require('../../lib/h.js');
const fs = require('fs');
const path = require('path');
const cards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../data/cards.json'), 'utf8'));
const byName = Object.fromEntries(cards.map(c => [c.name, c]));
const creatures = cards.filter(c => /Creature/.test(c.cardType) && !c.banned);
const SHROOM = 'Shroomasaur';
const nurFilter = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const stumm = process.env.QUIET === '1';

// ── 1) Referenzpaare aus den Kartentexten ────────────────────────────────────────────────────────────────────
const FAMILIE = new Map();   // `R|N` → genannter Text (Kartenname oder Namensfamilie)
function paare() {
  const out = new Map();   // R → Set(N)
  for (const c of cards) {
    if (c.banned) continue;
    const e = (c.effect || '').replace(/[“”«»]/g, '"');
    for (const m of e.matchAll(/"([^"]{2,60})"/g)) {
      const q = m[1].trim();
      if (q === c.name) continue;
      let hits = creatures.filter(k => k.name === q);
      if (!hits.length) hits = creatures.filter(k => k.name.includes(q));
      hits = hits.filter(k => k.name !== SHROOM && k.name !== c.name);
      if (!hits.length) continue;
      // Vertreter: exakte Kreatur, sonst bis zu 2 der Familie (erste und mittlere)
      const reps = hits.length <= 2 ? hits : [hits[0], hits[Math.floor(hits.length / 2)]];
      if (!out.has(c.name)) out.set(c.name, new Set());
      for (const r of reps) { out.get(c.name).add(r.name); FAMILIE.set(c.name + '|' + r.name, q); }
    }
  }
  return out;
}

// Nicht-Kreaturen, die R beim Namen nennt (für die Hand-Probe: Stufen-/Spielbarkeitsrabatte)
function genannteKarten(rName) {
  const e = (byName[rName].effect || '').replace(/[“”«»]/g, '"');
  const s = new Set();
  for (const m of e.matchAll(/"([^"]{2,60})"/g)) { const c = byName[m[1].trim()]; if (c && !/Creature/.test(c.cardType) && c.name !== rName) s.add(c.name); }
  return [...s];
}

// ── 2) Aufbau ────────────────────────────────────────────────────────────────────────────────────────────────
async function nennen(t, seat, hi, slot, name) {
  t.gs.activePlayer = seat; t.phase('MAIN1');
  t.script.length = 0;
  t.script.push({ match: (d) => d.type === 'cardNamePicker' && d.title === SHROOM, answer: { cardName: name } });
  const r = await t.activateCreature(seat, hi, slot, {});
  t.script.length = 0;
  return r;
}

const SURPRISES = cards.filter(c => c.subtype === 'Surprise' && !c.banned).map(c => c.name);
const MODI = ['hand', 'brett'];   // R in der Hand bzw. (Kreatur/Held) auf dem Brett

async function welt(R, N, welt_, modus, seiteN, opt = {}) {
  const rc = byName[R];
  const extras = genannteKarten(R);
  const hand0 = [];
  const sub = (rc.subtype || '').toLowerCase();
  const ist = { held: rc.cardType === 'Hero' || rc.cardType === 'Ascended Hero', kreatur: /Creature/.test(rc.cardType), area: sub === 'area', equip: rc.cardType === 'Artifact' && sub === 'equipment' };
  if (modus === 'hand') { if (ist.held) return null; hand0.push(R); hand0.push(...extras); }
  else { if (!ist.held && !ist.kreatur && !ist.area && !ist.equip) return null; hand0.push(...extras); }
  const deck0 = [...SURPRISES.slice(0, 5), ...Array(7).fill('ZZ Dummy')];
  const t = await H.fresh({ hand: [hand0, ['ZZ Filler', 'ZZ Filler']], deck: [deck0, undefined], deckSize: 12, discard: [['ZZ Dummy', 'ZZ Filler'], ['ZZ Dummy']], gold: 50 });
  const seatN = seiteN === 'eigen' ? 0 : 1;
  t.put(1, 0, 0, H.INERT.big); t.put(1, 1, 0, H.INERT.big);
  t.putSurprise(0, 1, SURPRISES[5]);   // eine verdeckte Surprise auf dem Brett (Spider Hive u. ä.)
  if (modus === 'brett') {
    if (ist.held) t.setHero(0, 0, R, 800);
    else if (ist.kreatur) t.put(0, 0, 0, R, { counters: {} });
    else if (ist.area) t.putArea(0, R);
    else if (ist.equip) t.put(0, 0, 2, R);
  }
  // der Träger von N: Slot 1 (eigene Seite, Held 0) bzw. Slot 1 beim Gegner, Held 0
  const slotN = 1;
  let trager = null;
  if (welt_ === 'A') trager = t.put(seatN, 0, slotN, N);
  else trager = t.put(seatN, 0, slotN, SHROOM);
  trager.turnPlayed = 0;
  if (opt.begleiter) {
    const q = FAMILIE.get(R + '|' + N);
    const k = q && creatures.find(c => c.name.includes(q) && c.name !== N && c.name !== R && c.name !== SHROOM && !/Ascended/.test(c.cardType));
    if (k) { const b = t.put(0, 1, 1, k.name); b.turnPlayed = 0; }
  }
  for (const nm of hand0) t.grantFor(0, 0, nm);
  t.put(0, 2, 0, H.INERT.creature);
  if (welt_ === 'B') await nennen(t, seatN, 0, slotN, N);
  else await t.engine.runHooks('onNameChanged', { inst: trager, name: null, oldName: null, _skipReactionCheck: true });   // A/C: die Buchungen an Namensfamilien gleichen sich wie in B ab
  t.gs.activePlayer = 0; t.phase(3); t.resetActions(0); t.reset();
  return { t, trager, seatN, slotN };
}

function snapshot(w, R) {
  const { t } = w; const e = t.engine; const out = {};
  const DB = t.DB;
  const ps = t.gs.players[0];
  ps.hand.forEach((nm, i) => {
    try { out[`stufe:${nm}#${i}`] = e.effectiveCardLevel(DB[nm], 0, { handIdx: i, heroIdx: 0 }); } catch (x) { out[`stufe:${nm}#${i}`] = 'ERR ' + x.message.slice(0, 60); }
  });
  try {
    const pl = e.getHeroPlayableCards(0);
    const flat = (o) => Object.keys(o || {}).sort().map(k => k + '=' + JSON.stringify(o[k]).slice(0, 120));
    out['spielbar:own'] = flat(pl.own).join(' ; ');
    out['spielbar:charmed'] = flat(pl.charmed).join(' ; ');
  } catch (x) { out['spielbar'] = 'ERR ' + x.message.slice(0, 80); }
  out['start.traeger'] = traegerZustand(w.trager);
  out['start.zustand'] = JSON.stringify(zustand(t));
  try { out['inherente-aktion'] = e.cardHasInherentAction(0, 0, DB[R], {}); } catch (x) { out['inherente-aktion'] = 'ERR'; }
  if (/Creature/.test(byName[R].cardType)) {
    for (const hi of [0, 1]) { try { out[`beschwoerbar:${hi}`] = e.isCreatureSummonable(R, 0, hi); } catch (x) { out[`beschwoerbar:${hi}`] = 'ERR'; } }
  }
  return out;
}

function traegerZustand(inst) {
  if (!inst || inst.zone === 'discard') return 'weg';
  const c = {};
  for (const [k, v] of Object.entries(inst.counters || {}).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (k.startsWith('_zusatzName') || k === 'currentHp' || k === 'maxHp' || /Hopt|hopt|turn/i.test(k)) continue;
    c[k] = v;
  }
  return JSON.stringify({ z: inst.zone, c, st: Object.keys(inst.statuses || {}).sort() });
}

function zustand(t) {
  const out = {};
  for (let s = 0; s < t.n; s++) {
    const p = t.gs.players[s];
    out[`s${s}.gold`] = p.gold; out[`s${s}.hand`] = p.hand.length; out[`s${s}.deck`] = p.mainDeck.length; out[`s${s}.ablage`] = p.discardPile.length; out[`s${s}.geloescht`] = (p.deletedPile || []).length;
    p.heroes.forEach((h, i) => { if (h && h.name) { out[`s${s}.h${i}.hp`] = h.hp; out[`s${s}.h${i}.atk`] = h.atk; } });
  }
  return out;
}

async function aktivierung(w, R, pick = 0) {
  const { t } = w;
  t.script.length = 0;
  t.script.push({ match: (d) => d.type === 'optionPicker' && Array.isArray(d.options) && d.options.length, answer: (d) => ({ optionId: (pick >= 0 ? d.options[Math.min(pick, d.options.length - 1)] : d.options[d.options.length - 1]).id }) });
  const rc = byName[R]; const out = {};
  const vorC = t.census(); const vorZ = zustand(t);
  t.reset();
  t.gs.activePlayer = 0; t.phase('MAIN1'); t.resetActions(0);
  let r;
  try {
    if (rc.cardType === 'Hero' || rc.cardType === 'Ascended Hero') r = await t.activateHero(0, 0, {});
    else if (/Creature/.test(rc.cardType)) { const inst = t.find(R, 'support'); if (inst) { inst.turnPlayed = 0; r = await t.activateCreature(0, inst.heroIdx, inst.zoneSlot, {}); } }
  } catch (x) { r = 'THROW ' + x.message.slice(0, 60); }
  out['aktiv.ergebnis'] = r === undefined ? 'n/a' : (r && r.hung ? 'hung' : (typeof r === 'object' ? 'obj' : String(r)));
  out['aktiv.census'] = t.censusDiff(vorC, t.census()).sort().join(', ');
  const nachZ = zustand(t);
  out['aktiv.zustand'] = Object.keys(nachZ).filter(k => nachZ[k] !== vorZ[k]).map(k => `${k}:${vorZ[k]}→${nachZ[k]}`).join(', ');
  out['aktiv.prompts'] = [...new Set(t.prompts.map(p => (p.d && (p.d.title || p.d.type)) || '?'))].sort().join('|');
  return out;
}

async function niederlage(w, R) {
  // Der N-Träger wird besiegt (Schaden von der Gegenseite bzw. vom eigenen Helden aus), R darf darauf reagieren.
  const { t, trager, seatN } = w;
  const out = {};
  t.gs.activePlayer = 1 - seatN === 0 ? 0 : 1; // Angreifer ist die andere Seite als der Träger
  const quelleSeat = 1 - seatN;
  t.gs.activePlayer = quelleSeat;
  t.reset();
  const vorC = t.census(); const vorZ = zustand(t);
  const src = { name: 'ZZ Test', owner: quelleSeat, heroIdx: 0 };
  try {
    await t.run(async () => { await t.engine.actionDealCreatureDamage(src, trager, 99999, 'creature', { sourceOwner: quelleSeat, canBeNegated: true }); await t.engine._runPostChainActions?.(); });
  } catch (x) { out['besiegt.fehler'] = x.message.slice(0, 60); }
  out['besiegt.census'] = t.censusDiff(vorC, t.census()).filter(x => !x.startsWith(trager.name + ':') && !x.startsWith(SHROOM + ':')).sort().join(', ');
  const nachZ = zustand(t);
  out['besiegt.zustand'] = Object.keys(nachZ).filter(k => nachZ[k] !== vorZ[k]).map(k => `${k}:${vorZ[k]}→${nachZ[k]}`).join(', ');
  out['besiegt.prompts'] = [...new Set(t.prompts.map(p => (p.d && (p.d.title || p.d.type)) || '?'))].sort().join('|');
  out['besiegt.traeger'] = traegerZustand(trager);
  out['besiegt.fehler'] = out['besiegt.fehler'] || (t.errors.length ? t.errors.join(' || ').slice(0, 160) : '');
  return out;
}

async function fluss(w, R, art) {
  // Weitere Auslöser mit dem N-Träger: Schaden (nicht tödlich), Rückkehr auf die Hand, Spielen von R aus der Hand.
  const { t, trager, seatN } = w;
  const out = {};
  const quelleSeat = 1 - seatN;
  t.gs.activePlayer = art === 'spielen' ? 0 : quelleSeat;
  t.reset();
  const vorC = t.census(); const vorZ = zustand(t);
  try {
    if (art === 'schaden') {
      trager.counters.currentHp = 5000; trager.counters.maxHp = 5000;   // nur ein Kratzer – keine Niederlage durch niedrige Basis-HP der echten Karte
      const src = { name: 'ZZ Test', owner: quelleSeat, heroIdx: 0 };
      await t.run(async () => { await t.engine.actionDealCreatureDamage(src, trager, 10, 'creature', { sourceOwner: quelleSeat, canBeNegated: true }); await t.engine._runPostChainActions?.(); });
    } else if (art === 'feind') {
      // ein ANDERES Ziel fällt (die Gegenkreatur auf Held 0, Platz 0) – für „whenever a target is defeated"-Karten (Baaliel, Bomblebee …)
      const opfer = t.find(H.INERT.big, 'support');
      if (opfer) await t.run(async () => { await t.engine.actionDealCreatureDamage({ name: 'ZZ Test', owner: 0, heroIdx: 0 }, opfer, 99999, 'creature', { sourceOwner: 0, canBeNegated: true }); await t.engine._runPostChainActions?.(); });
    } else if (art === 'weg') {
      await t.run(async () => { await t.engine.actionMoveCard(trager, 'hand', seatN, 0, { source: { name: 'ZZ Test', owner: quelleSeat }, sourceOwner: quelleSeat }); await t.engine._runPostChainActions?.(); });
    } else if (art === 'spielen') {
      if (!t.gs.players[0].hand.includes(R)) return {};
      const cd = t.DB[R];
      const slot = /Creature/.test(cd.cardType) ? 0 : undefined;
      await t.play(0, R, { hero: 1, slot: slot ?? 0 });
    }
  } catch (x) { out[art + '.fehler'] = x.message.slice(0, 60); }
  const nm = (k) => !k.startsWith(trager.name + ':') && !k.startsWith(SHROOM + ':');
  out[art + '.census'] = t.censusDiff(vorC, t.census()).filter(nm).sort().join(', ');
  const nachZ = zustand(t);
  out[art + '.zustand'] = Object.keys(nachZ).filter(k => nachZ[k] !== vorZ[k]).map(k => `${k}:${vorZ[k]}→${nachZ[k]}`).join(', ');
  out[art + '.prompts'] = [...new Set(t.prompts.map(p => (p.d && (p.d.title || p.d.type)) || '?'))].sort().join('|');
  out[art + '.traeger'] = traegerZustand(trager);
  return out;
}

function diff(a, b) {   // Schlüssel, in denen a und b verschieden sind
  const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
  const d = {};
  for (const k of ks) { const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]); if (x !== y) d[k] = [a[k], b[k]]; }
  return d;
}
// Schlüsselnamen ohne die Handindizes/Träger-Eigennamen vergleichen
const norm = (o, N) => { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = typeof v === 'string' ? v.split(N).join('<N>').split(SHROOM).join('<N>') : v; return r; };

async function messen(R, N, modus, seite, begleiter = 0) {
  const erg = {};
  for (const wl of ['A', 'B', 'C']) {
    const w = await welt(R, N, wl, modus, seite, { begleiter });
    if (!w) return null;
    const s = snapshot(w, R);
    Object.assign(s, await aktivierung(w, R, 0));
    // Zweite Antwortrunde: bei Auswahl-Karten (Harpthenean: Gold ODER Schaden) die LETZTE Option
    const w1 = await welt(R, N, wl, modus, seite, { begleiter });
    const s1 = await aktivierung(w1, R, -1);
    for (const [k, v] of Object.entries(s1)) s[k.replace('aktiv.', 'aktiv-letzte.')] = v;
    w.t.errors.push(...w1.t.errors);
    // Neuaufbau für die Niederlage (die Aktivierung hat den Zustand verändert)
    const w2 = await welt(R, N, wl, modus, seite, { begleiter });
    Object.assign(s, await niederlage(w2, R));
    for (const art of ['schaden', 'weg', 'spielen', 'feind']) {
      const w3 = await welt(R, N, wl, modus, seite, { begleiter });
      Object.assign(s, await fluss(w3, R, art));
      w2.t.errors.push(...w3.t.errors);
    }
    erg[wl] = norm(s, N);
    erg[wl + '_err'] = w.t.errors.concat(w2.t.errors);
  }
  return erg;
}

// ── 3) Erwartete Befunde (Identität statt Referenz bzw. Eigeneffekt der echten Karte) ────────────────────────
// Schlüssel: `R|N` → Begründung. Wird hier begründet, damit der Sweep als Regressionswächter taugt.
const ERWARTET_NUR_A = {
  // wird nach der ersten Auswertung von Hand gefüllt (siehe Notizen im Lauf)
};

(async () => {
  const R = H.runner();
  const P = paare();
  R.section(`Namensreferenz-Sweep: ${P.size} Referenzkarten`);
  const luecken = [], zuViel = [], nurA = [], fehler = [];
  let n = 0;
  for (const [rName, ns] of P) {
    if (nurFilter && !nurFilter.test(rName)) continue;
    for (const N of ns) {
      for (const modus of MODI) {
        for (const [seite, begleiter] of [['eigen', 0], ['gegner', 0], ['eigen', 1]]) {
          let e;
          if (begleiter && !/at least|different|3 /.test(byName[rName].effect || '')) continue;   // Begleiter nur, wo der Text eine Mindestzahl verlangt
          try { e = await messen(rName, N, modus, seite, begleiter); } catch (x) { fehler.push(`${rName}|${N}|${modus}|${seite}: Aufbau warf ${String(x.message).slice(0, 100)}`); continue; }
          if (!e) continue;
          n++;
          if (process.env.FULL) for (const w of ['A', 'B', 'C']) REAL_LOG(`${rName} ⇐ ${N} [${modus}/${seite}${begleiter ? '+B' : ''}] ${w}: ${JSON.stringify(Object.fromEntries(Object.entries(e[w]).filter(([k]) => new RegExp(process.env.FULL).test(k)))).slice(0, 700)}`);
          const dA = diff(e.C, e.A), dB = diff(e.C, e.B);
          const kA = Object.keys(dA), kB = Object.keys(dB);
          const fehlt = kA.filter(k => !(k in dB) || JSON.stringify(dB[k]) !== JSON.stringify(dA[k]));
          const zuviel = kB.filter(k => !(k in dA));
          const tag = `${rName} ⇐ ${N} [${modus}/${seite}${begleiter ? '+B' : ''}]`;
          if (process.env.DUMP) (global.__dump = global.__dump || []).push({ tag, dA, dB });
          if (process.env.DEBUG) REAL_LOG(`${tag}: dA=${JSON.stringify(Object.fromEntries(kA.map(k => [k, dA[k]]))).slice(0, 300)} dB=${kB.join(',')}`);
          if (fehlt.length) luecken.push(`${tag}: ${fehlt.map(k => `${k} A=${JSON.stringify(dA[k][1])} B=${JSON.stringify(dB[k] ? dB[k][1] : dA[k][0])} (C=${JSON.stringify(dA[k][0])})`).join(' ; ')}`.slice(0, 700));
          if (zuviel.length) zuViel.push(`${tag}: ${zuviel.map(k => `${k} B=${JSON.stringify(dB[k][1])} (C=${JSON.stringify(dB[k][0])})`).join(' ; ')}`.slice(0, 500));
          const eb = e.B_err.filter(x => !e.C_err.includes(x));
          if (eb.length) fehler.push(`${tag}: Engine-Fehler nur in B: ${eb.join(' | ').slice(0, 300)}`);
        }
      }
    }
  }
  R.note(`Paare gemessen: ${n}`);
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(global.__dump || [], null, 1));
  if (!stumm) for (const l of luecken) REAL_LOG(l);
  R.check(`Lücken (A erkennt N, B nicht): ${luecken.length}`, luecken.length === 0, luecken.slice(0, 40));
  R.check(`Alias bewirkt zu viel (nur B weicht ab): ${zuViel.length}`, zuViel.length === 0, zuViel.slice(0, 40));
  R.check(`keine Engine-Fehler nur in B: ${fehler.length}`, fehler.length === 0, fehler.slice(0, 20));
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });

function REAL_LOG(s) { process.stdout.write('  · ' + s + '\n'); }
