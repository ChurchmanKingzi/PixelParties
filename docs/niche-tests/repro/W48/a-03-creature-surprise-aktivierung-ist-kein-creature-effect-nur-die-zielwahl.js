'use strict';
// W48a · Punkt 6 · Al, 22.10.2026: „Das Aktivieren einer Creature-Surprise an sich soll NICHT ‚on creature effect' feuern. Nur, wenn diese Creature-Surprise dann selbst einen Effekt auslöst, der ein Ziel
// anvisiert/trifft (etwa Water Golem, der explizit ein Ziel wählt, wenn er seinen Effekt aktiviert), löst das on creature effect aus."
//   (i)  Die bloße AKTIVIERUNG (Aufdecken/Platzieren) einer Creature-Surprise löst keinen „Creature effect"-Leser aus (Zielschutz-Reaktionen der Hand, Surprise-Fenster, Zähler, Kettenfenster).
//   (ii) Wählt/trifft der Effekt der Creature-Surprise ein Ziel (Water Golem, Cybug ANTS, Afflicted Vermin …), gilt genau diese Zielwahl/Wirkung als Creature effect (W46a): die Leser feuern bei der
//        Zielwahl, nicht bei der Aktivierung davor.
// Messung: Zeitpunkt = erster Aufruf der Zielwahl der Creature-Surprise (`targetFn` mit dem Titel der Karte). Alles VOR diesem Moment (bzw. bei Pure Advantage Camel [„draw a card and place", keine
// Zielwahl] die ganze Aktivierung) gehört zur bloßen Aktivierung: kein Leser darf dort angeboten werden/aktivieren. Danach: die Leser feuern wie in W46a. Beide Sitze.
// Ergebnis der Matrix: siehe CARD_API.md „Welle 48 / W48a" Punkt 6 — der Ist-Zustand war schon korrekt (kein Code geändert), dieses Repro sichert ihn ab (Exit 0 auf Basis UND Branch).
// Aufruf: node docs/niche-tests/repro/W48/a-03-creature-surprise-aktivierung-ist-kein-creature-effect-nur-die-zielwahl.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

const SURP = ['Booby Trap', 'Jumpscare', 'Mountain Tear River', 'Jumper Spider', 'Spider Avalanche', 'Firewall'];
const HANDR = ['Chaorc Interception', 'Barrier of Faith', 'Divine Gift of Rain'];
const KREAT_SURP = ['Shield of Wisdom', 'Rolling Boulder'];     // lesen „chosen by an opponent's Creature effect" (Vermin wählt Kreaturen)
// Erwartung NACH der Zielwahl (W46a): welche Leser feuern bei welcher Creature-Surprise (Held des Reaktors gewählt)
const NACH = {
  'Water Golem': new Set([...SURP, ...HANDR]),
  'Cybug ANTS': new Set(['Jumpscare', 'Jumper Spider', 'Spider Avalanche', ...HANDR]),   // Kreatur noch in der Surprise Zone: Retourkutschen mit „Angreifer" (Booby Trap, Firewall, MTR) lösen nicht aus (W46a/W47a bestätigt)
};

async function lauf(me, op, name, leser) {
  const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
  t.putSurprise(me, 0, name); t.grantFor(me, 0, name); if (name === 'Cybug ANTS') t.addHand(me, 'Future Tech Gun');
  if (name === 'Pure Advantage Camel') t.addHand(op, 'ZZ Filler');
  if (SURP.includes(leser) || KREAT_SURP.includes(leser)) { t.putSurprise(op, 0, leser); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, leser); }
  else { t.addHand(op, leser); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, leser); t.setAbilities(op, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Fighting'], ['Magic Arts']]); }
  const c = t.put(op, 1, 0, 'Chaorc Cannon Fodder'); c.turnPlayed = 1;
  const x = t.put(op, 1, 1, H.INERT.creature); x.turnPlayed = 1;
  const y = t.put(op, 0, 1, H.INERT.creature); y.turnPlayed = 1;   // Kreatur im Support des Helden 0 des Reaktors: Wahlziel von Afflicted Vermin (Shield of Wisdom / Rolling Boulder)
  const m = t.put(me, 2, 0, H.INERT.creature); m.turnPlayed = 1;
  let snap = null;
  t.targetFn = (v, cfg) => {
    if (cfg && cfg.title === name) { if (!snap) snap = { p: t.prompts.length, l: t.logs.length }; return name === 'Afflicted Vermin' ? [`equip-${op}-0-1`] : [`hero-${op}-0`]; }
    return [(v.find(q => !q.ineligible) || v[0]).id];
  };
  const z0 = { me: { sp: t.gs.players[me].spellsPlayedThisTurn || 0, at: t.gs.players[me].attacksPlayedThisTurn || 0 }, op: { sp: t.gs.players[op].spellsPlayedThisTurn || 0, at: t.gs.players[op].attacksPlayedThisTurn || 0 } };
  await t.run(() => t.engine._activateSurprise(me, 0, name, { cardName: 'x', owner: op, heroIdx: 0, amount: 100, cardInstance: x }, loadCardEffect(name)));
  const cut = snap || { p: t.prompts.length, l: t.logs.length };
  const ev = (pf, pt, lf, lt) => ({ angeboten: t.prompts.slice(pf, pt).filter(p => p.pi === op && p.d && p.d.title === leser).length, aktiviert: t.logs.slice(lf, lt).filter(l => l.type === 'surprise_activated' && l.data.card === leser).length });
  const vor = ev(0, cut.p, 0, cut.l), nach = ev(cut.p, t.prompts.length, cut.l, t.logs.length);
  const z1 = { me: { sp: t.gs.players[me].spellsPlayedThisTurn || 0, at: t.gs.players[me].attacksPlayedThisTurn || 0 }, op: { sp: t.gs.players[op].spellsPlayedThisTurn || 0, at: t.gs.players[op].attacksPlayedThisTurn || 0 } };
  return { t, vor, nach, hatteZielwahl: !!snap, zaehler: JSON.stringify(z0) === JSON.stringify(z1) };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} aktiviert eine Creature-Surprise — (i) die bloße Aktivierung feuert keinen Creature-effect-Leser`);
    for (const name of ['Pure Advantage Camel', 'Water Golem', 'Cybug ANTS', 'Afflicted Vermin', 'Cactus Creature']) {
      let vorSumme = 0, nurVorFehler = [], ok = true;
      for (const leser of [...SURP, ...HANDR, ...KREAT_SURP]) {
        const r = await lauf(me, op, name, leser);
        if (r.vor.angeboten || r.vor.aktiviert) nurVorFehler.push({ leser, vor: r.vor });
        vorSumme += r.vor.angeboten + r.vor.aktiviert;
        if (!(sauber(r.t) && (r.zaehler || r.nach.aktiviert > 0))) ok = { leser, e: r.t.errors, a: r.t.audit(), z: r.zaehler };
      }
      R.check(`${name}: vor der Zielwahl (bloße Aktivierung) wird KEIN Leser angeboten/aktiviert (${SURP.length + HANDR.length + KREAT_SURP.length} Leser), kein Zähler, sauber`, nurVorFehler.length === 0 && ok === true, { nurVorFehler, ok });
    }

    R.section(`Sitz ${me}: (ii) die Zielwahl/Wirkung der Creature-Surprise ist der Creature effect — Leser feuern DORT`);
    for (const name of ['Water Golem', 'Cybug ANTS']) {
      const erwartet = NACH[name];
      for (const leser of [...SURP, ...HANDR]) {
        const r = await lauf(me, op, name, leser);
        const gefeuert = r.nach.angeboten + r.nach.aktiviert > 0;
        R.check(`${name} × ${leser}: bei der Zielwahl ${erwartet.has(leser) ? 'feuert er' : 'feuert er nicht (kein Angreifer auf dem Brett)'}`, r.hatteZielwahl && gefeuert === erwartet.has(leser), { nach: r.nach, z: r.hatteZielwahl });
      }
    }
    {   // Afflicted Vermin wählt eine KREATUR: Shield of Wisdom / Rolling Boulder lesen „Creature effect" bei dieser Wahl
      for (const leser of KREAT_SURP) {
        const r = await lauf(me, op, 'Afflicted Vermin', leser);
        R.check(`Afflicted Vermin × ${leser}: nicht bei der Aktivierung, wohl bei der Kreaturenwahl`, r.hatteZielwahl && r.vor.aktiviert + r.vor.angeboten === 0 && r.nach.aktiviert + r.nach.angeboten > 0, { vor: r.vor, nach: r.nach });
      }
    }
    {   // Gegenprobe: Pure Advantage Camel („draw a card and place") — keine Zielwahl, also nichts feuert; die Surprise selbst wirkt (1 Karte, Kreatur platziert)
      const r = await lauf(me, op, 'Pure Advantage Camel', 'Booby Trap');
      R.check('Pure Advantage Camel: keine Zielwahl, Booby Trap des Gegners bleibt verdeckt; Camel wirkt (zieht 1 Karte, steht auf dem Brett)', !r.hatteZielwahl && r.nach.aktiviert === 0 && r.t.pile(me, 'hand').length === 1 && !!r.t.inst(c => c.name === 'Pure Advantage Camel' && c.zone === 'support')[0], { hand: r.t.pile(me, 'hand') });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
