'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — MULLIGAN DER BOTS („Wann Mulligans durchführen?“)
//
//  Karten wie Leadership, Horn in a Bottle, Staff of the Teleporter und Lunatic Cycle - Crescent Moon fragen ihren Besitzer mit einem
//  `handPick`-Prompt, welche Handkarten zurück ins Deck gemischt werden (im Skill Test kommen dafür ebenso viele ZUFÄLLIGE NEUE Karten aus
//  dem Pool nach, siehe engine-ext.installDraws). Die Standard-CPU der Engine lehnt jede abbrechbare Frage ab — so blieben diese Karten bei
//  Bots bisher tot. Diese Datei beantwortet die Frage.
//
//  Zwei Teile:
//   • WELCHE Karten? Dieselbe Bewertung wie beim Behalten/Recyceln im Aufbau (learn/keepmodel.js: Modell + Vorgabe + gelernte Nutzung, Kontext =
//     restliche Hand und Brett): was dort „recyceln“ hieße, ist hier schwach (`d < 0`). Heroes in der Hand (Quetzahuitl) bleiben.
//   • OB und WIE VIEL — der gelernte Kanal `mull`. Drei Arme:
//       skip   nichts tun (Prompt abbrechen; Horn/Staff/Leadership bleiben liegen)
//       weak   alle schwachen Karten zurück (ohne schwache Karte: bei Karten mit Bonus-Zug die Pflichtauswahl bzw. gar keine — Horn zieht dann 1 Karte)
//       more   zusätzlich die Grenzfälle (`d < MORE_MARGIN`)
//     Der Kontext („Eimer“) ist: Zahl der schwachen Karten (0 … 3+), Bonus-Zug ja/nein, Phase der Partie (frühe/mittlere/späte Round).
//     Gelernt wird aus dem Ergebnis des Sitzes (Platzierungsgüte, +1 … −1), und zwar nur aus ERKUNDETEN Entscheidungen (im Training spielt der Bot
//     mit Wahrscheinlichkeit `EXPLORE` einen zufälligen Arm): nur dort ist die Armwahl unabhängig von der Stärke der Hand, der Vergleich also fair
//     (`profile.mullX`). Ohne genug Daten oder ohne klaren Vorsprung vor der Vorgabe gilt sie: schwache Karten zurück (weak), sonst nichts tun.
//
//  Dieselbe Entscheidung gilt je Sitz, Round und Karte nur einmal (der Bot fragt dieselbe Quelle in einer Round mehrmals, ein Zufallsarm
//  würde sonst jedes Mal neu gewürfelt und mehrfach gezählt).
// ═══════════════════════════════════════════════════════════════════
const Rules = require('../public/skilltest-rules.js');
const KM = require('./learn/keepmodel');
const { getCardDB } = require('../cards/effects/_card-db');

const ARMS = ['skip', 'weak', 'more'];
const MORE_MARGIN = 0.08;          // Grenzfälle: Wert (Platzierungsgüte) unter dieser Schwelle fliegen im Arm „more“ mit raus
const EXPLORE = 0.5;               // Training: Anteil der Entscheidungen, die ein zufälliger Arm trifft (Messung)
const MIN_N = 30;                  // so viele erkundete Beobachtungen braucht jeder Arm, bevor der Vergleich entscheidet
const POOL_MIN_N = 15;             // …im gröberen Eimer (nur Zahl der schwachen Karten)
const LEARN_MARGIN = 0.04;         // ein anderer Arm als die Vorgabe muss sie um so viel (Platzierungsgüte) übertreffen — Beobachtungen einer Partie hängen zusammen,
                                   // der Unterschied zweier Arme ist meist winzig (Messung 8.10.: unter 3 Punkte Siegquote); ohne klaren Vorsprung bleibt die Vorgabe

const profileMod = () => require('./learn/profile');

/** Ist das ein Mulligan-Prompt („Karten zurückmischen“)? Einsatz-Picks („welchen Zauber wirken?“) sind es nicht. */
function isMulliganPrompt(pd) {
  return !!pd && pd.type === 'handPick' && pd.pickIntent !== 'use' && /shuffl/i.test(pd.description || '');
}

/** Bonus-Karten, die die Quelle zusätzlich zieht (Horn +1, Leadership Lv3 +1, Staff +1 nur mit ganzer Hand). */
function bonusOf(pd, eligibleCount) {
  const t = pd.title || '';
  if (/^Horn in a Bottle/.test(t)) return 1;
  if (/^Leadership Lv3/.test(t)) return 1;
  if (/^Staff of the Teleporter/.test(t)) return eligibleCount > 0 ? 0.5 : 0;     // nur wenn die ganze Hand mitgeht — selten, halb gezählt
  return 0;
}

/** Brett und Hand eines Sitzes in der Form der Aufbau-Regeln (public/skilltest-rules.js), damit das Keep-Modell sie lesen kann. */
function battleForm(engine, seat) {
  const gs = engine.gs, p = gs.players[seat], out = Rules.emptyPlayer();
  out.hand = [...(p.hand || [])];
  (p.heroes || []).slice(0, 3).forEach((h, hi) => {
    if (!h || !h.name || !(h.hp > 0)) return;                                    // gefallene Helden wirken nichts mehr
    out.heroes[hi] = h.name;
    ((p.abilityZones && p.abilityZones[hi]) || []).slice(0, 3).forEach((z, zi) => { if (z && z.length) out.abilityZones[hi][zi] = { n: z[0], s: z.length, c: false }; });
    ((p.supportZones && p.supportZones[hi]) || []).slice(0, 3).forEach((z, zi) => { out.supportZones[hi][zi] = z ? [...z] : []; });
    const sz = p.surpriseZones && p.surpriseZones[hi];
    out.surpriseZones[hi] = (Array.isArray(sz) ? sz[0] : sz) || null;
  });
  const st = gs.skillTest;
  out.recycled = (st && st.recycled && st.recycled[seat]) || 0;
  return out;
}

/** Wert „behalten“ je Handkarte (Platzierungsgüte; negativ = die Aufbau-Entscheidung hätte sie recycelt). */
function keepValues(engine, seat, prof) {
  const { usableInBattle } = require('./autoprep');
  const cards = getCardDB(), env = { cards };
  const ps = battleForm(engine, seat);
  const model = (prof && prof.keepModel) || KM.newModel();
  const ctx = KM.buildContext(env, ps, ps.hand);
  return ps.hand.map((n) => {
    if (Rules.HAND_ONLY_HEROES.includes(n)) return Infinity;
    const c = cards[n];
    if (!c || c.cardType === 'Hero') return Infinity;
    const f = KM.featuresFor(env, n, ctx), use = KM.usability(env, n, ctx);
    return KM.edge(model, f) + KM.prior(model, n, usableInBattle(c), use)
      + KM.usagePrior(prof && prof.usage, prof && prof.usageClass, n, c.cardType, use);
  });
}

const phaseOf = (round) => (round <= 2 ? 0 : round <= 5 ? 1 : 2);

/** Lage vor der Entscheidung: wählbare Plätze mit Wert, Zahl der schwachen Karten, Bonus, Eimer. */
function planFor(engine, seat, pd, prof) {
  const gs = engine.gs, st = gs.skillTest, ps = gs.players[seat];
  const d = keepValues(engine, seat, prof);
  const elig = (pd.eligibleIndices || ps.hand.map((_, i) => i)).filter(i => i >= 0 && i < ps.hand.length && Number.isFinite(d[i]));
  const sorted = elig.slice().sort((a, b) => d[a] - d[b]);
  const weak = sorted.filter(i => d[i] < 0);
  const border = sorted.filter(i => d[i] >= 0 && d[i] < MORE_MARGIN);
  const maxSel = Math.min(pd.maxSelect != null ? pd.maxSelect : elig.length, elig.length);
  const minSel = Math.min(pd.minSelect != null ? pd.minSelect : 1, maxSel);
  const bonus = bonusOf(pd, elig.length);
  const nw = Math.min(3, weak.length);
  const round = (st && st.round) || 1;
  const bucket = 'w' + nw + (bonus ? 'b' : '') + 'p' + phaseOf(round);
  return { d, elig, sorted, weak, border, maxSel, minSel, bonus, nw, round, bucket, coarse: 'w' + nw + (bonus ? 'b' : '') };
}

/** Welche Plätze geht ein Arm zurück? `null` = Prompt abbrechen. */
function indicesFor(plan, arm) {
  if (arm === 'skip') return null;
  let pick = plan.weak.slice(0, plan.maxSel);
  if (arm === 'more') pick = pick.concat(plan.border).slice(0, plan.maxSel);
  if (pick.length < plan.minSel) pick = plan.sorted.slice(0, plan.minSel);       // Pflichtauswahl: die schwächste Karte
  return pick;
}

/** Welche Arme sind in dieser Lage überhaupt sinnvoll? */
function armsAvailable(plan) {
  const arms = ['skip'];
  const hasWeak = plan.weak.length > 0;
  if (hasWeak || plan.bonus > 0) arms.push('weak');                                // ohne schwache Karte nur, wenn die Quelle einen Bonus-Zug bietet
  if (plan.border.length > 0 && hasWeak) arms.push('more');
  else if (plan.border.length > 0 && plan.bonus > 0) arms.push('more');
  return arms;
}

function meanOf(e) { return e && e.n > 0 ? e.sum / e.n : null; }

/** Gelernte Armwahl für einen Eimer (erkundete Beobachtungen); `null`, wenn nicht genug Daten für den Vergleich. */
function learnedArm(prof, plan, arms) {
  const tab = prof && prof.mullX;
  if (!tab) return null;
  const pri = priorArm(plan, arms);
  for (const [key, minN] of [[plan.bucket, MIN_N], [plan.coarse, POOL_MIN_N]]) {
    // Vergleich nur, wenn jeder verfügbare Arm genug Beobachtungen hat
    if (!arms.every(a => (tab[key + '|' + a] || { n: 0 }).n >= minN)) continue;
    let best = null, bestV = -Infinity;
    for (const a of arms) { const v = meanOf(tab[key + '|' + a]); if (v > bestV) { bestV = v; best = a; } }
    if (best && best !== pri && bestV - meanOf(tab[key + '|' + pri]) < LEARN_MARGIN) return null;      // kein klarer Vorsprung vor der Vorgabe
    if (best) return best;
  }
  return null;
}

/** Vorgabe ohne Daten: schwache Karten zurück (die Aufbau-Bewertung sagt, dass sie nichts taugen), sonst nichts tun; Bonus-Zug immer nehmen. */
function priorArm(plan, arms) {
  return arms.includes('weak') ? 'weak' : 'skip';
}

/**
 * Antwort auf einen Mulligan-Prompt eines Bot-Sitzes. Rückgabe: `{ selectedCards }` oder `null` (abbrechen).
 * Im Training (`st.record`) wird mit Wahrscheinlichkeit EXPLORE ein zufälliger Arm gespielt; jede Entscheidung kommt ins Lernprotokoll
 * (`st.mullLog`). Im Lookahead (`_inMctsSim`) gilt nur die gelernte Armwahl/Vorgabe, ohne Zufall und ohne Protokoll.
 */
function respond(engine, seat, pd) {
  const gs = engine.gs, st = gs.skillTest, ps = gs.players[seat];
  if (!ps || !ps.hand || !ps.hand.length) return null;
  const prof = (() => { try { const noProf = st && st.noProfile && st.noProfile.includes(seat); return noProf ? null : profileMod().get(); } catch { return null; } })();
  const plan = planFor(engine, seat, pd, prof);
  if (!plan.elig.length) return null;
  const arms = armsAvailable(plan);
  const sim = !!engine._inMctsSim;
  const mode = st && st.mullMode && st.mullMode[seat];                    // Messung: erzwungener Arm (scripts/skilltest-mulligan.js)

  const decided = (st && st.mullDecided) || (st && (st.mullDecided = {}));
  const dkey = seat + ':' + plan.round + ':' + (pd.title || '');
  let arm, explored = 0;
  if (!sim && decided && decided[dkey]) arm = decided[dkey].arm;
  else {
    if (mode && ARMS.includes(mode)) arm = arms.includes(mode) ? mode : (mode === 'more' && arms.includes('weak') ? 'weak' : 'skip');   // erzwungen; nicht möglich → nächstbester
    else if (!sim && st && st.record && Math.random() < EXPLORE) { arm = arms[Math.floor(Math.random() * arms.length)]; explored = 1; }
    else arm = learnedArm(prof, plan, arms) || priorArm(plan, arms);
    if (!sim && st) {
      decided[dkey] = { arm };
      (st.mullLog || (st.mullLog = [])).push({ seat, round: plan.round, b: plan.bucket, c: plan.coarse, arm, x: explored, nw: plan.weak.length, bonus: plan.bonus, src: pd.title || '', forced: mode ? 1 : 0 });
    }
  }
  const idx = indicesFor(plan, arm);
  if (idx == null) return null;
  return { selectedCards: idx.slice().sort((a, b) => a - b).map(i => ({ cardName: ps.hand[i], handIndex: i })) };
}

/** Beobachtungen eines Spiels ins Profil (aufgerufen von learn/train.learnFrom): Ergebnis des Sitzes je Entscheidung. */
function learn(profile, mullLog, scoreOf) {
  if (!mullLog || !mullLog.length) return;
  const L = profileMod();
  if (!profile.mull) profile.mull = {};
  if (!profile.mullX) profile.mullX = {};
  for (const m of mullLog) {
    if (m.forced) continue;                                              // Messläufe mit erzwungenem Arm lernen nicht
    const sc = scoreOf(m.seat);
    if (!Number.isFinite(sc)) continue;
    L.addObs(profile.mull, m.b + '|' + m.arm, sc);
    L.addObs(profile.mull, m.c + '|' + m.arm, sc);
    if (m.x) { L.addObs(profile.mullX, m.b + '|' + m.arm, sc); L.addObs(profile.mullX, m.c + '|' + m.arm, sc); }
  }
}

module.exports = { isMulliganPrompt, respond, learn, learnedArm, priorArm, planFor, keepValues, battleForm, armsAvailable, indicesFor, ARMS, MORE_MARGIN, EXPLORE, MIN_N, POOL_MIN_N, LEARN_MARGIN };
