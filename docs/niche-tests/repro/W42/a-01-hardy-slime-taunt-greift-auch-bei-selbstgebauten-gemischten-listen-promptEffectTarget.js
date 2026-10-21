'use strict';
// W42a · Punkt 5 · Al, 22.10.2026 (Antwort auf W41a-Rückfrage 5): „Ja, die sollen abgedeckt sein. Nur, wenn *Hardy Slime selbst* kein mögliches Ziel ist, greift der Taunt nicht."
// Kartentext Hardy Slime: „When you summon this Creature, your opponent has to choose it with all Attacks and Spells they use until your next turn, if possible."
// Regel: Karten, die eine gemischte Helden-und-Kreaturen-Liste SELBST bauen und direkt an `promptEffectTarget` reichen, laufen nicht mehr am Taunt vorbei. Ist der Slime ein MÖGLICHES Ziel des konkreten
//  Effekts (steht in der Liste, nicht ausgegraut), ist er für den Gegner das einzige wählbare Ziel seiner Seite (die übrigen Ziele der Slime-Seite werden ausgegraut; eigene Ziele des Wählenden bleiben);
//  ist er kein mögliches Ziel (Liste nur mit Helden, Slime nicht in der Liste, Slime ausgegraut durch Immunität/Status/Schutz), greift der Taunt nicht.
// Exit 1 auf der Basis 9f6cb59e (Teile A–E, G, H), Exit 0 auf dem Branch.
// A direkter Aufruf `promptEffectTarget` (beide Sitze, Gegenproben) · B Mehrfachwahl · C Schutz-Wechselwirkung (Butterfly Cloud auf einem Slime-Seiten-Helden, Slime selbst geschützt)
// D echte Karten: Skeleton Archer (Kreatureneffekt, Liste aus `_cardInstance`-Zielen) und Cardinal Beast Baihu · E Engine-Picker bleiben unverändert (Attack, einmal gefiltert) · G Eye · H Wählender = Slime-Besitzer
// Aufruf: node docs/niche-tests/repro/W42/a-01-hardy-slime-taunt-greift-auch-bei-selbstgebauten-gemischten-listen-promptEffectTarget.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ids = (v) => v.map(x => x.id).sort().join(',');

/** Szene: Slime des Gegners (`op`) mit Taunt gegen `me`; eine weitere Gegner-Kreatur; eine eigene Kreatur. */
async function szene(me, op, o = {}) {
  const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me });
  const andere = t.put(op, 2, 1, H.INERT.creature); andere.turnPlayed = 1;
  const eigene = t.put(me, 2, 1, H.INERT.creature); eigene.turnPlayed = 1;
  let slime = null;
  if (!o.ohneSlime) {
    slime = t.put(op, 1, 0, 'Hardy Slime'); slime.turnPlayed = 1;
    slime.counters.forcesTargeting = true; slime.counters.forcesTargeting_pi = me; slime.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + (o.bis ?? 1);
    slime.counters.buffs = { ...(slime.counters.buffs || {}), forcesTargeting: true };
  }
  return { t, slime, andere, eigene };
}
const heldZiel = (seite, hi) => ({ id: `hero-${seite}-${hi}`, type: 'hero', owner: seite, heroIdx: hi, cardName: 'x' });
const kreaturZiel = (inst) => ({ id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
/** Gemischte Liste einer Seite: 3 Helden + alle Kreaturen (so baut sie eine Karte selbst). */
const liste = (t, seite, nurHelden) => {
  const l = [0, 1, 2].map(i => heldZiel(seite, i));
  if (!nurHelden) for (const inst of t.engine.cardInstances) if (inst.zone === 'support' && inst.owner === seite && inst.name !== 'Test') l.push(kreaturZiel(inst));
  return l;
};

/** `promptEffectTarget(chooser, liste, cfg)` aufrufen; liefert die dem Wählenden angebotenen (wählbaren) IDs und die Antwort. */
async function frage(t, chooser, l, cfg = {}, antwort) {
  let angebot = null;
  t.targetFn = (v) => { angebot = v.filter(x => !x.ineligible); const w = antwort ? antwort(angebot) : angebot[0]; return w ? (Array.isArray(w) ? w : [w.id]) : null; };
  let res;
  await t.run(async () => { res = await t.engine.promptEffectTarget(chooser, l, { title: 'W42a', cancellable: true, ...cfg }); });
  return { angebot: angebot ? ids(angebot) : null, res, liste: l };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const slimeId = `equip-${op}-1-0`;
    const heldenOp = [0, 1, 2].map(i => `hero-${op}-${i}`);
    const eigeneIds = [0, 1, 2].map(i => `hero-${me}-${i}`);

    // ── A · gemischte Liste beider Seiten, selbst gebaut ──
    {
      const { t } = await szene(me, op);
      const l = [...liste(t, op), ...liste(t, me)];
      const x = await frage(t, me, l);
      const erwartet = [slimeId, ...eigeneIds, `equip-${me}-2-1`].sort().join(',');
      R.check('A1 gemischte Liste (Gegner-Helden + Gegner-Kreaturen + eigene Ziele) mit Slime: von der Slime-Seite ist nur der Slime wählbar, eigene Ziele bleiben wählbar', x.angebot === erwartet, x);
      R.check('A1 die Slime-Seite wird ausgegraut (Liste bleibt vollständig)', l.filter(a => a.ineligible).map(a => a.id).sort().join(',') === [...heldenOp, `equip-${op}-2-1`].sort().join(','), l.map(a => a.id + (a.ineligible ? '*' : '')));
      R.check('A1 keine Engine-Fehler, Zustand sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {
      const { t } = await szene(me, op);
      const x = await frage(t, me, liste(t, op));
      R.check('A2 nur Gegner-Liste (Helden + Kreaturen): einziges wählbares Ziel ist der Slime', x.angebot === slimeId && x.res && x.res.length === 1 && x.res[0] === slimeId, x);
    }
    {   // Gegenprobe: Held-only-Liste → der Slime ist kein mögliches Ziel
      const { t } = await szene(me, op);
      const x = await frage(t, me, liste(t, op, true));
      R.check('A3 Liste nur mit Helden (Slime kein mögliches Ziel): alle drei Helden wählbar, kein Taunt', x.angebot === heldenOp.join(','), x);
    }
    {   // Slime in der Liste, aber ausgegraut (Immunität/Status/Schutz → `ineligible`): kein mögliches Ziel → kein Taunt
      const { t, slime } = await szene(me, op);
      const l = liste(t, op);
      l.find(a => a.id === slimeId).ineligible = true;
      const x = await frage(t, me, l);
      R.check('A4 Slime ausgegraut (nicht wählbar): kein Taunt, alle übrigen Gegnerziele wählbar', x.angebot === [...heldenOp, `equip-${op}-2-1`].sort().join(','), x);
    }
    {   // Slime nicht in der Liste (der Effekt bietet ihn nicht an)
      const { t } = await szene(me, op);
      const l = liste(t, op).filter(a => a.id !== slimeId);
      const x = await frage(t, me, l);
      R.check('A5 Slime nicht in der Liste: kein Taunt', x.angebot === [...heldenOp, `equip-${op}-2-1`].sort().join(','), x);
    }
    {   // Gegenprobe ohne Slime
      const { t } = await szene(me, op, { ohneSlime: true });
      const x = await frage(t, me, liste(t, op));
      R.check('A6 ohne Slime (Gegenprobe): alle Gegnerziele wählbar', x.angebot === heldenOp.concat([`equip-${op}-2-1`]).sort().join(','), x);
    }
    {   // abgelaufener Taunt ("until your next turn")
      const { t } = await szene(me, op, { bis: -1 });
      const x = await frage(t, me, liste(t, op));
      R.check('A7 Taunt abgelaufen: alle Gegnerziele wählbar', x.angebot === [...heldenOp, `equip-${op}-2-1`, slimeId].sort().join(','), x);
    }
    {   // Taunt gilt nur gegen den Gegner des Slime-Besitzers: der Besitzer selbst wählt frei
      const { t } = await szene(me, op);
      const x = await frage(t, op, liste(t, op));
      R.check('H1 der Slime-Besitzer wählt unter seinen eigenen Zielen: kein Taunt', x.angebot === [...heldenOp, `equip-${op}-2-1`, slimeId].sort().join(','), x);
    }
    {   // Truth-Seeing Eye / ignoresTargetingRestrictions hebt den Taunt auf
      const { t } = await szene(me, op);
      const x = await frage(t, me, liste(t, op), { ignoreUntargetable: true, _truthSeeingEye: true });
      R.check('G1 Truth-Seeing Eye (`_truthSeeingEye`): kein Taunt', x.angebot === [...heldenOp, `equip-${op}-2-1`, slimeId].sort().join(','), x);
    }

    // ── B · Mehrfachwahl ──
    {
      const { t } = await szene(me, op);
      const x = await frage(t, me, liste(t, op), { maxTotal: 3, minRequired: 1 }, (a) => a.map(z => z.id));
      R.check('B1 Mehrfachziel-Wahl (bis 3): nur der Slime ist wählbar und wird gewählt', x.angebot === slimeId && x.res && x.res.join(',') === slimeId, x);
    }

    // ── C · Schutz-Wechselwirkung ──
    {   // Butterfly-Cloud-Held auf der Slime-Seite: war schon ausgegraut, bleibt es; Slime bleibt das einzige wählbare Ziel der Seite
      const { t } = await szene(me, op);
      t.heroStatus(op, 0, 'untargetable');
      const x = await frage(t, me, liste(t, op));
      R.check('C1 Cloud-Held 0 auf der Slime-Seite + Slime: nur der Slime wählbar', x.angebot === slimeId, x);
      R.check('C1 keine Engine-Fehler', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Slime selbst durch Stealth-artigen Kreaturenschutz unwählbar (`untargetable_all`) → kein Taunt, Helden wählbar
      const { t, slime } = await szene(me, op);
      slime.counters.untargetable_all = true;
      const x = await frage(t, me, liste(t, op));
      R.check('C2 Slime unwählbar (`untargetable_all`): kein Taunt, übrige Gegnerziele wählbar', x.angebot === [...heldenOp, `equip-${op}-2-1`].sort().join(','), x);
    }
    {   // Erst-Runden-Immunität schützt die Slime-Seite: alles ausgegraut, nichts wählbar
      const { t } = await szene(me, op);
      t.gs.firstTurnProtectedPlayer = op;
      const x = await frage(t, me, liste(t, op));
      R.check('C3 Erst-Runden-Immunität der Slime-Seite: keine Gegnerziele wählbar (Slime inklusive), kein Fehler', (x.angebot === null || x.angebot === '') && sauber(t), x);
    }

    // ── D · echte Karten ──
    {   // Skeleton Archer (Kreatureneffekt, baut seine Liste selbst)
      const { t, slime } = await szene(me, op);
      const arch = t.put(me, 0, 0, 'Skeleton Archer'); arch.turnPlayed = 1;
      let angebot = null;
      t.targetFn = (v) => { const el = v.filter(z => !z.ineligible && (z.type === 'hero' || z.type === 'equip')); angebot = el.filter(z => z.owner === op || (z._cardInstance || z.cardInstance || {}).controller === op); const w = angebot[0]; return w ? [w.id] : null; };
      const hpVor = slime.counters.currentHp ?? 99;
      t.phase(2);
      const r = await t.activateCreature(me, 0, 0);
      const nur = angebot && angebot.length === 1 && angebot[0].id === slimeId;
      R.check('D1 Skeleton Archer: der Gegner-Teil der Zielwahl ist NUR der Slime, der Pfeil trifft ihn (50 Schaden: HP weniger bzw. besiegt)', nur && ((slime.counters.currentHp ?? 99) < hpVor || slime.zone !== 'support'), { angebot: angebot && angebot.map(z => z.id), hp: slime.counters.currentHp, r });
      R.check('D1 keine Engine-Fehler, Zustand sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Gegenprobe Skeleton Archer ohne Slime
      const { t } = await szene(me, op, { ohneSlime: true });
      const arch = t.put(me, 0, 0, 'Skeleton Archer'); arch.turnPlayed = 1;
      let angebot = null;
      t.targetFn = (v) => { const el = v.filter(z => !z.ineligible); angebot = el.filter(z => z.owner === op); return angebot[0] ? [angebot[0].id] : null; };
      t.phase(2);
      await t.activateCreature(me, 0, 0);
      R.check('D2 Skeleton Archer ohne Slime: alle Gegnerziele wählbar (Helden + Kreatur)', angebot && angebot.length >= 4, angebot && angebot.map(z => z.id));
    }
    {   // Cardinal Beast Baihu: "choose a target your opponent controls and Stun it"
      const { t, slime } = await szene(me, op);
      const b = t.put(me, 0, 0, 'Cardinal Beast Baihu'); b.turnPlayed = 1;
      let angebot = null;
      t.targetFn = (v) => { angebot = v.filter(z => !z.ineligible && z.owner === op); return angebot[0] ? [angebot[0].id] : null; };
      t.phase(2);
      await t.activateCreature(me, 0, 0);
      R.check('D3 Cardinal Beast Baihu: nur der Slime ist wählbar', angebot && angebot.length === 1 && angebot[0].id === slimeId, angebot && angebot.map(z => z.id));
      R.check('D3 keine Engine-Fehler, Zustand sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }

    // ── E · Engine-Picker unverändert (Attack): Slime einziges Ziel, genau einmal gefiltert ──
    {
      const t = await H.fresh({ hand: me === 0 ? [['Attack'], []] : [[], ['Attack']], hp: 800, deckSize: 20, active: me });
      for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
      const slime = t.put(op, 1, 0, 'Hardy Slime'); slime.turnPlayed = 1;
      slime.counters.forcesTargeting = true; slime.counters.forcesTargeting_pi = me; slime.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + 1;
      slime.counters.buffs = { forcesTargeting: true };
      const andere = t.put(op, 2, 1, H.INERT.creature); andere.turnPlayed = 1;
      let angebot = null;
      t.targetFn = (v) => { angebot = v.filter(z => !z.ineligible && z.owner === op); return angebot[0] ? [angebot[0].id] : null; };
      await t.play(me, 'Attack', { hero: 0 });
      R.check('E1 Attack mit Slime: weiter nur der Slime wählbar', angebot && angebot.length === 1 && angebot[0].id === slimeId, angebot && angebot.map(z => z.id));
      R.check('E1 keine Engine-Fehler, Zustand sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
