'use strict';
// W35a · Frage 4 · Al, 22.10.2026 (Antwort auf W34a-Rückfrage 4): „Ja, beheben. ‚Can never use more than 1 Attack per turn' ist ziemlich eindeutig."
//  Mirjams Zähler hing an `onActionUsed` – das feuert NICHT für Attacks, die als INHÄRENTE Zusatzaktion laufen (Quick Attack als „first Attack", Berserk-Attack), nicht für negierte Attacks und
//  nicht für Sofort-Güsse (Guardian Beast Hu, Coffee, Elixir of Rage … = `_castSpellImmediately`); letztere zählten außerdem für KEINEN Attack-Zähler (`attacksPlayedThisTurn`, `heroesAttackedThisTurn`,
//  `hero._attacksThisTurn`). Folge: Mirjam durfte danach noch eine Attack spielen; Quick Attack „first Attack", Berserk (2), Rioting Village (1), Idej Sword - Muras, Ghuanjun („never 2 copies of the
//  same Attack") und Knife Throw („only Attack") sahen die Attack nicht. Zentrale Lösung: JEDE gespielte Attack-Karte läuft durch `engine.zaehleAlsArt('attack', { karte: true })`
//  (doPlaySpell – auch negiert/inhärent –, `_castSpellImmediately`, Love Shot, Nieht), das die Zähler füllt UND `onEffectCountedAsArt` meldet (Mirjam, Ghuanjun).
//  Matrix: Pfad (Karte normal [Gegenprobe] · Quick Attack inhärent · Berserk-Attack inhärent · negierte Attack · Sofort-Guss `performImmediateAction` · Sofort-Guss `performImmediateActionAnyHero`)
//  × Leser (Mirjam · Zähler · Quick Attack · Rioting Village · Berserk · Knife Throw · Idej Sword - Muras · Ghuanjun).
// Aufruf: node docs/niche-tests/repro/W35/a-03-jede-attack-zaehlt-mirjam-und-zaehler-bei-zusatzaktions-attacks.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const MIRJAM = 'Mirjam, the Fallen Cute Angel', GHUANJUN = 'Ghuanjun, the Undead Martial Artist', NOBU = 'Idej Lord Nobunakin';
const EQUIP = 'Possessed Blade of Sinister Vengeance';   // Equipment ohne Skript (Knife Throw braucht ein ausgeruestetes Artefakt)
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const ps = (t, s) => t.gs.players[s];
const HELD = 1;   // der Held, der die Attack spielt; Held 2 = „ein anderer Held desselben Spielers"

/** Szene: Sitz `me` am Zug; `me`-Hand = [Karte]; Held 1 nach `o.held`. */
async function szene(me, op, pfad, o = {}) {
  const karte = pfad === 'quick' ? 'Quick Attack' : 'Attack';
  const hand = [[], []]; hand[me] = [karte]; if (pfad === 'negiert') hand[op] = ['Invisibility Cloak'];
  if (pfad === 'negiertKette') hand[op] = ["The Master's Plan"];
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  if (o.held) t.setHero(me, HELD, o.held, 800);
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  if (pfad === 'negiert') t.grantFor(op, 1, 'Invisibility Cloak');
  if (pfad === 'negiertKette') t.grantFor(op, 1, "The Master's Plan");
  if (pfad === 'berserk') t.heroStatus(me, HELD, 'berserked');
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => [(posHero(v, op, 0) || v[0]).id];
  if (o.nicht) return { t, karte, gespielt: false };
  let gespielt = true;
  if (pfad === 'normal' || pfad === 'quick' || pfad === 'berserk' || pfad === 'negiert' || pfad === 'negiertKette') {
    gespielt = (await t.play(me, karte, { hero: HELD, keepActions: true })) === true;
  } else {
    t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cardName: karte, handIndex: 0, heroIdx: HELD }) });
    t.grantFor(me, HELD, karte);
    const r = pfad === 'sofort' ? await t.run(() => t.engine.performImmediateAction(me, HELD, { title: 'Test' }))
      : await t.run(() => t.engine.performImmediateActionAnyHero(me, { title: 'Test' }));
    gespielt = !!(r && r.played);
  }
  return { t, karte, gespielt };
}
const kann = (t, me, hi, karte) => t.engine.heroKannAngreifen(me, hi, me, { name: karte });

const PFADE = {
  normal: 'Attack-Karte normal gespielt (Gegenprobe, schon korrekt)',
  quick: 'Quick Attack als inhärente Zusatzaktion („first Attack")',
  berserk: 'Attack als inhärente Berserk-Attack („once per turn as an additional Action")',
  negiert: 'Attack, deren Effekt Invisibility Cloak im Zielfenster negiert (läuft regulär durch)',
  negiertKette: "Attack, die The Master's Plan in der Kette ganz negiert (Negierungs-Zweig von doPlaySpell)",
  sofort: 'Sofort-Guss `performImmediateAction` (Zusatzaktion: Coffee, Elixir of Rage, Junshi …)',
  sofortAny: 'Sofort-Guss `performImmediateActionAnyHero` (Zusatzaktion: Guardian Beast Hu …)',
};

(async () => {
  const R = H.runner();
  const QA = H.loadCardEffect('Quick Attack'), KT = H.loadCardEffect('Knife Throw');
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const [pfad, titel] of Object.entries(PFADE)) {
      R.section(`Sitz ${me}: ${titel}`);
      // ── Zähler ──
      { const r = await szene(me, op, pfad);
        const p = ps(r.t, me), h = r.t.hero(me, HELD);
        R.check('die Attack wurde gespielt', r.gespielt, null);
        R.check('Zähler: attacksPlayedThisTurn == 1, Held steht in heroesAttackedThisTurn, hero._attacksThisTurn == 1', (p.attacksPlayedThisTurn || 0) === 1 && (p.heroesAttackedThisTurn || []).includes(HELD) && (h._attacksThisTurn || 0) === 1, { ap: p.attacksPlayedThisTurn, hatt: p.heroesAttackedThisTurn, hit: h._attacksThisTurn });
        R.check('Quick Attack ist danach NICHT mehr die erste Attack (keine Zusatzaktion)', QA.inherentAction(r.t.gs, me, 2, r.t.engine) === false, null);
        R.check('der Gegner hat nichts gezählt', (ps(r.t, op).attacksPlayedThisTurn || 0) === 0, null);
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
      // ── Mirjam ──
      { const r = await szene(me, op, pfad, { held: MIRJAM });
        const h = r.t.hero(me, HELD);
        R.check('Mirjam: ihr Zähler steht auf 1 (genau einmal, kein Doppelzählen)', h._mirjamAttacksUsed === 1 && h._mirjamAttackTurn === r.t.gs.turn, { n: h._mirjamAttacksUsed });
        R.check('Mirjam kann in diesem Zug KEINE weitere Attack mehr spielen (heroKannAngreifen), ein anderer Held schon', kann(r.t, me, HELD, r.karte) === false && kann(r.t, me, 2, r.karte) === true, null);
        const MIR = H.loadCardEffect(MIRJAM), cd = H.DB['Attack'];
        R.check('Mirjams `canPlayCard` sperrt die nächste Attack-Karte', MIR.canPlayCard(r.t.gs, me, HELD, cd, r.t.engine) === false, null);
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
      { const r = await szene(me, op, pfad, { held: MIRJAM, nicht: true });
        R.check('Gegenprobe: Mirjam ohne gespielte Attack kann angreifen', kann(r.t, me, HELD, r.karte) === true, null); }
      // ── Rioting Village ──
      { const r = await szene(me, op, pfad, { vorbereiten: (t) => t.putArea(op, 'Rioting Village') });
        R.check('Rioting Village („no player can use more than 1 Attack per turn"): danach ist jede weitere Attack gesperrt, auch von einem anderen Helden', kann(r.t, me, 2, r.karte) === false, null);
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
      // ── Berserk ──
      { const r = await szene(me, op, pfad, { vorbereiten: (t) => { t.heroStatus(me, HELD, 'berserked'); t.hero(me, HELD)._attacksThisTurn = 1; } });
        R.check('Berserk („never more than 2 Attacks per turn"): mit 1 Attack vorher ist die gespielte die zweite → der Held ist danach gesperrt', r.t.hero(me, HELD)._attacksThisTurn === 2 && kann(r.t, me, HELD, r.karte) === false, { n: r.t.hero(me, HELD)._attacksThisTurn });
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
      // ── Knife Throw ──
      { const r = await szene(me, op, pfad, { vorbereiten: (t) => { t.put(me, 2, 1, EQUIP); t.addHand(me, 'Knife Throw'); } });
        const cd = H.DB['Knife Throw'];
        R.check('Knife Throw („the only Attack you play this turn") ist nach der gespielten Attack NICHT mehr spielbar (Held 2 mit Ausrüstung)', KT.canPlayWithHero(r.t.gs, me, 2, cd, r.t.engine) === false, null);
        const g = await szene(me, op, pfad, { nicht: true, vorbereiten: (t) => { t.put(me, 2, 1, EQUIP); t.addHand(me, 'Knife Throw'); } });
        R.check('Gegenprobe: ohne gespielte Attack ist Knife Throw spielbar', KT.canPlayWithHero(g.t.gs, me, 2, cd, g.t.engine) === true, null);
        R.check('sauber', sauber(r.t) && sauber(g.t), { e: [...r.t.errors, ...g.t.errors], a: [...r.t.audit(), ...g.t.audit()] }); }
      // ── Idej Sword - Muras ──
      { const r = await szene(me, op, pfad, { held: NOBU, vorbereiten: (t) => { const sw = t.put(me, HELD, 0, 'Idej Sword - Muras'); sw.counters.treatAsEquip = 1; } });
        R.check('Idej Sword - Muras („the only Attack the equipped Hero uses this turn"): der Träger ist danach für weitere Attacks gesperrt', kann(r.t, me, HELD, r.karte) === false, null);
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
      // ── Ghuanjun ──
      { const r = await szene(me, op, pfad, { held: GHUANJUN });
        const h = r.t.hero(me, HELD);
        R.check('Ghuanjun („never more than 1 copy of the same Attack per turn"): der Kartenname steht in `ghuanjunAttacksUsed`, dieselbe Attack ist gesperrt, eine andere nicht', (h.ghuanjunAttacksUsed || []).includes(r.karte) && kann(r.t, me, HELD, r.karte) === false && kann(r.t, me, HELD, 'Backstab') === true, { l: h.ghuanjunAttacksUsed });
        R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }
    }
  }
  R.finish();
})();
