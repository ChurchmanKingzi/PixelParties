'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — GELERNTES BEHALTEN / RECYCELN (Kontext: restliche Hand und Brett)
//
//  Frage je Karte, die nach dem Aufbau übrig ist: BEHALTEN (liegt im Kampf auf der Hand: Zauber, Reaktion, Trank …)
//  oder RECYCELN (Gold, früherer Spielbeginn, jede 2. Karte wirft eine neue aus)?
//
//  Eine Karte lässt sich nicht im Vakuum bewerten: manche verlangen andere (ein Zauber braucht Schulstufen am Helden,
//  eine Ability braucht Zauber, die sie nutzen), manche sind nur zusammen stark (Archetyp, Kombos). Deshalb besteht der
//  Kontext aus der GESAMTEN restlichen Hand UND dem Brett (Helden, Abilities, Creatures, Ausrüstung), und die Entscheidung
//  wird jedes Mal neu bewertet, wenn sich der Kontext ändert (eine Karte fliegt raus, eine neue kommt aus dem Recycler).
//
//  Modell: linear über dünn besetzte Merkmale (Name der Karte, Typ, Archetyp, Erfüllbarkeit der Stufenanforderung,
//  Abdeckung durch Abilities auf der Hand, Archetyp-Synergie, Paare Karte|Mitspieler, Recycler-Stand, freie Zonen):
//
//      Ergebnis(Platzierungsgüte) ≈ b + Σ u[f] + a · Σ w[f]          a = +1 (behalten) / −1 (recycelt)
//
//    u  Basis       „wie gut ist ein Aufbau mit diesem Kontext ohnehin" — fängt die Stärke der Hand ab, damit sie nicht den
//                   Vergleich verfälscht (starke Hände behalten mehr und gewinnen öfter, das ist keine Wirkung des Behaltens)
//    w  Kontrast    2 · Σ w = erwarteter Unterschied behalten − recyceln, der Wert, den die Entscheidung liest
//
//  Gelernt wird aus dem Ergebnis der Partie (Platzierung des Sitzes, +1 … −1) mit normalisiertem LMS. Ohne Daten gilt eine
//  feste Vorgabe (brauchbar im Kampf → behalten), die mit den Beobachtungen der Karte verschwindet. Zur Messung wird im
//  Training gelegentlich gegen die Entscheidung gespielt (Neugier), damit beide Arme in vergleichbaren Lagen Daten bekommen.
// ═══════════════════════════════════════════════════════════════════
const Rules = require('../../public/skilltest-rules.js');

const MU = 0.06;               // Lernrate (Anteil des Fehlers, der je Beobachtung korrigiert wird)
const PRIOR = 0.2;             // Stärke der festen Vorgabe (in Einheiten der Platzierungsgüte)
const PRIOR_K = 30;            // Beobachtungen der Karte, bei denen die Vorgabe auf die Hälfte gefallen ist
const MAX_PAIRS_PER_CARD = 14; // Mitspieler, mit denen eine Karte Paarmerkmale bildet (Hand zuerst, dann Abilities, Creatures/Ausrüstung, Helden)
const MAX_FEATURES = 60000;    // Obergrenze der Merkmale im Modell (beschnitten wird erst über dem 1,5-Fachen, damit neue Paare erst wachsen können)

function newModel() { return { v: 1, n: 0, b: 0, u: {}, w: {} }; }

// ── Kontext ────────────────────────────────────────────────────────

const typeKey = (c) => (c ? c.cardType + '/' + (c.subtype || '') : '?');
const bucket = (n, edges) => { let i = 0; while (i < edges.length && n > edges[i]) i++; return i; };
const schoolsOf = (c) => {
  const out = [];
  if (c && c.spellSchool1) out.push(c.spellSchool1);
  if (c && c.spellSchool2 && c.spellSchool2 !== c.spellSchool1) out.push(c.spellSchool2);
  return out;
};

/**
 * Kontext einer Basis: Brett (Helden, Abilities mit Stufen, Creatures/Ausrüstung, Surprises, Area) und die Handkarten `hand`.
 * `hand` = Karten, über die gerade entschieden wird (Kandidaten) plus feste Mitspieler (z. B. Quetzahuitl).
 */
function buildContext(env, ps, hand) {
  const cards = env.cards;
  const board = [], schoolLv = [];
  let freeSupport = 0;
  (ps.heroes || []).forEach((h, hi) => {
    schoolLv[hi] = null;
    if (!h) return;
    board.push(h);
    schoolLv[hi] = {};
    for (const z of (ps.abilityZones[hi] || [])) {
      if (!z) continue;
      schoolLv[hi][z.n] = (schoolLv[hi][z.n] || 0) + Rules.abilityLevel(z);
      board.push(z.n);
    }
    for (const st of (ps.supportZones[hi] || [])) {
      if (!st || !st.length) { freeSupport++; continue; }
      board.push(st[0]);
      if (cards[st[0]] && cards[st[0]].cardType === 'Ability') schoolLv[hi][st[0]] = (schoolLv[hi][st[0]] || 0) + st.length;
    }
    if (ps.surpriseZones && ps.surpriseZones[hi]) board.push(ps.surpriseZones[hi]);
  });
  for (const n of (ps.areaZone || [])) board.push(n);
  // Archetyp-Zähler und Nachfrage nach Schulen über Brett UND Hand
  const arch = {}, schoolNeed = {};
  for (const n of [...board, ...hand]) {
    const c = cards[n]; if (!c) continue;
    if (c.archetype) arch[c.archetype] = (arch[c.archetype] || 0) + 1;
    for (const s of schoolsOf(c)) if (c.level > 0) schoolNeed[s] = (schoolNeed[s] || 0) + 1;
  }
  const handAbilities = {};
  for (const n of hand) { const c = cards[n]; if (c && c.cardType === 'Ability') handAbilities[n] = (handAbilities[n] || 0) + 1; }
  return { board, hand, schoolLv, freeSupport, arch, schoolNeed, handAbilities, recycled: ps.recycled || 0 };
}

/** Kleinste Lücke zwischen verlangter Stufe und den Schul-Stufen eines Helden auf dem Brett (0 = sofort spielbar). */
function levelGap(c, ctx) {
  const schools = schoolsOf(c);
  if (!schools.length || !(c.level > 0)) return null;
  let best = null;
  for (const lv of ctx.schoolLv) {
    if (!lv) continue;
    let have = 0; for (const s of schools) have += lv[s] || 0;
    const gap = Math.max(0, c.level - have);
    if (best == null || gap < best) best = gap;
  }
  return best == null ? 9 : best;
}

/** Merkmale einer Karte im Kontext (ohne die Karte selbst als Mitspieler). */
function featuresFor(env, name, ctx) {
  const cards = env.cards, c = cards[name];
  if (!c) return ['c:' + name];
  const tk = typeKey(c);
  const f = ['c:' + name, 'ty:' + tk];
  if (c.archetype) {
    f.push('a:' + c.archetype);
    const same = (ctx.arch[c.archetype] || 0) - 1;                    // andere Karten desselben Archetyps (Brett + Hand)
    f.push('syn:' + c.archetype + ':' + Math.min(4, Math.max(0, same)));
    f.push('syn:' + tk + ':' + Math.min(4, Math.max(0, same)));
  }
  // Anforderung: kann ein Held auf dem Brett sie wirken/beschwören — oder käme er mit Abilities von der Hand dorthin?
  const gap = levelGap(c, ctx);
  if (gap != null) {
    const handClose = schoolsOf(c).reduce((a, s) => a + (ctx.handAbilities[s] || 0), 0);
    const closable = Math.max(0, gap - handClose);
    f.push('fit:' + tk + ':' + Math.min(3, gap), 'fit:' + name + ':' + Math.min(3, gap));
    if (gap > 0) f.push('fitH:' + tk + ':' + Math.min(3, closable), 'fitH:' + name + ':' + Math.min(3, closable));
  }
  // Ability: wie viel Stufe liegt schon auf dem Brett, wie viele Karten brauchen diese Schule?
  if (c.cardType === 'Ability') {
    let have = 0; for (const lv of ctx.schoolLv) if (lv && (lv[name] || 0) > have) have = lv[name];
    const need = Math.min(3, ctx.schoolNeed[name] || 0);
    f.push('ab:' + Math.min(3, have) + ':' + need, 'ab:' + name + ':' + Math.min(3, have));
  }
  // Tempo / Gold: wie viel ist schon recycelt (jede 2. Karte wirft eine neue aus), wie viel Platz ist auf dem Brett?
  const rc = bucket(ctx.recycled, [0, 2, 4, 7]);
  f.push('rc:' + rc, 'rc:' + rc + ':' + tk, 'free:' + tk + ':' + Math.min(3, ctx.freeSupport));
  // Paare: Karte | Mitspieler — die restliche HAND zuerst (darum geht es), dann Abilities, Creatures/Ausrüstung und Helden auf dem Brett;
  // dazu Karte | Archetyp des Mitspielers (dichter besetzt als einzelne Karten)
  const seen = new Set([name]), seenArch = new Set();
  let k = 0;
  const rank = (o) => { const t = cards[o] && cards[o].cardType; return t === 'Ability' ? 1 : t === 'Hero' ? 3 : 2; };
  const boardOrdered = [...ctx.board].sort((a, b) => rank(a) - rank(b));
  for (const o of [...ctx.hand, ...boardOrdered]) {
    if (seen.has(o)) continue;
    seen.add(o);
    if (k++ < MAX_PAIRS_PER_CARD) f.push('p:' + name + '|' + o);
    const oc = cards[o];
    if (oc && oc.archetype && !seenArch.has(oc.archetype)) { seenArch.add(oc.archetype); f.push('pa:' + name + '|' + oc.archetype); }
  }
  return f;
}

// ── Modell ─────────────────────────────────────────────────────────

const getW = (tab, f) => { const e = tab[f]; return e ? e[0] : 0; };
const isPairFeature = (f) => f.startsWith('p:') || f.startsWith('pa:');          // Paare tragen nur einen Kontrast, keine Basis

/** Erwartete Differenz behalten − recyceln für diese Merkmale. */
function edge(model, feats) {
  let s = 0;
  for (const f of feats) s += getW(model.w, f);
  return 2 * s;
}

/** Feste Vorgabe (brauchbar → behalten), die mit den Beobachtungen der Karte verschwindet. */
function prior(model, name, usable) {
  const e = model.w['c:' + name];
  const n = e ? e[1] : 0;
  return (usable ? PRIOR : -PRIOR) * PRIOR_K / (PRIOR_K + n);
}

/** Eine Beobachtung lernen: Merkmale `feats`, Arm a (+1 behalten, −1 recycelt), Ergebnis y (Platzierungsgüte). */
function update(model, feats, a, y) {
  if (!feats || !feats.length || !Number.isFinite(y)) return;
  let pred = model.b;
  for (const f of feats) pred += getW(model.u, f) + a * getW(model.w, f);
  const step = MU * (y - pred) / (2 * feats.length + 1);
  model.b += step;
  for (const f of feats) {
    if (!isPairFeature(f)) { const eu = model.u[f] || (model.u[f] = [0, 0]); eu[0] += step; eu[1]++; }
    const ew = model.w[f] || (model.w[f] = [0, 0]); ew[0] += a * step; ew[1]++;
  }
  model.n++;
}

/** Tabelle klein halten: seltene Merkmale fallen heraus, danach die mit dem kleinsten Gewicht. */
function prune(model, max = MAX_FEATURES, slack = 1.5) {
  const keys = new Set([...Object.keys(model.u), ...Object.keys(model.w)]);
  if (keys.size <= max * slack) return;
  const rank = [...keys].map(f => {
    const w = model.w[f], u = model.u[f];
    const n = Math.max(w ? w[1] : 0, u ? u[1] : 0);
    return [f, n, Math.abs(w ? w[0] : 0) * Math.sqrt(n)];
  }).sort((a, b) => (a[1] - b[1]) || (a[2] - b[2]));
  for (let i = 0; i < keys.size - max; i++) { delete model.u[rank[i][0]]; delete model.w[rank[i][0]]; }
}

/** Zum Speichern runden (kleinere Datei). */
function compact(model) {
  const r = (t) => { const o = {}; for (const [f, e] of Object.entries(t)) o[f] = [Math.round(e[0] * 1e5) / 1e5, e[1]]; return o; };
  return { v: model.v, n: model.n, b: Math.round(model.b * 1e5) / 1e5, u: r(model.u), w: r(model.w) };
}

// ── Entscheidung ───────────────────────────────────────────────────

/**
 * Entscheider für den Aufbau: bekommt die Basis (Brett + Hand) und gibt zurück, welche Handkarten recycelt werden.
 *
 * opts: { env, model, usable(card) → bool, protect(name) → bool, maxKeep, bias, explore (0 … 1), rng }
 *  • Die Karte mit dem schlechtesten Wert (Kontrast + Vorgabe + Bias) fliegt zuerst; danach wird der Kontext neu bewertet
 *    (fehlt ein Partner, sinkt der Wert der anderen) — bis keine Karte mehr unter 0 liegt.
 *  • `maxKeep` begrenzt, wie viele Karten höchstens auf der Hand bleiben (Persona).
 *  • `explore` = Wahrscheinlichkeit, eine Karte gegen die Entscheidung zu behandeln (nur im Training), damit beide Arme
 *    vergleichbare Beobachtungen bekommen.
 * Rückgabe: { recycle: [Handindex …], log: [{ c, a, f, x }] } — `log` hält je Karte die letzte Bewertung (a = Entscheidung,
 * x = 1, wenn die Entscheidung erzwungen/erkundet war).
 */
function makeDecider(opts) {
  const { env, model, usable } = opts;
  const rng = opts.rng || Math.random;
  const cards = env.cards;
  const cap = opts.maxKeep != null ? opts.maxKeep : Infinity;
  return function decide(ps) {
    const cand = [];
    ps.hand.forEach((n, idx) => {
      if (opts.protect && opts.protect(n)) return;
      const c = cards[n];
      if (c && c.cardType === 'Hero' && !Rules.boardFull(ps)) return;           // Heroes nur bei vollem Brett recycelbar
      cand.push({ n, idx, forced: null });
    });
    if (opts.explore > 0) for (const x of cand) if (rng() < opts.explore) x.forced = rng() < 0.5 ? 'keep' : 'recycle';
    const log = {}, recycle = [];
    let alive = cand.slice();
    const evaluate = () => {
      const hand = ps.hand.filter((n, idx) => !recycle.includes(idx));          // Mitspieler: alles, was noch auf der Hand liegt
      const ctx = buildContext(env, ps, hand);
      return alive.map(x => {
        const f = featuresFor(env, x.n, ctx);
        const d = x.forced === 'keep' ? Infinity : x.forced === 'recycle' ? -Infinity
          : edge(model, f) + prior(model, x.n, usable(cards[x.n])) + (opts.bias || 0);
        return { x, f, d };
      });
    };
    for (let guard = 0; guard < 60 && alive.length; guard++) {
      const ev = evaluate();
      const removable = ev.filter(e => e.x.forced !== 'keep');
      let worst = null;
      for (const e of removable) if (!worst || e.d < worst.d) worst = e;
      const remove = worst && (worst.d < 0 || alive.length > cap);            // unter 0, oder über der Obergrenze der Persona
      // `d` = der Wert, den die Entscheidung der Karte gab (positiv: behalten, negativ: recyceln); erzwungene (erkundete) Fälle haben keinen.
      const dOf = (e) => (Number.isFinite(e.d) ? Math.round(e.d * 1000) / 1000 : null);
      if (!remove) {
        for (const e of ev) log[e.x.n] = { c: e.x.n, a: +1, f: e.f, x: e.x.forced ? 1 : 0, d: dOf(e) };
        break;
      }
      log[worst.x.n] = { c: worst.x.n, a: -1, f: worst.f, x: worst.x.forced ? 1 : 0, d: dOf(worst) };
      recycle.push(worst.x.idx);
      alive = alive.filter(x => x !== worst.x);
    }
    return { recycle, log: Object.values(log) };
  };
}

module.exports = { newModel, buildContext, featuresFor, edge, prior, update, prune, compact, makeDecider, levelGap, MAX_FEATURES };
