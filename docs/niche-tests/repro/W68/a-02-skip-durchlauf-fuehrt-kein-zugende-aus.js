'use strict';
// W68a-02 · Der formale Durchlauf eines ÜBERSPRUNGENEN Zuges führt KEIN Zugende aus (Al, 23.10.2026: „nur 'echte' Züge")
//
// `_switchTurnInner({ uebersprungen: true })` ruft kein ON_TURN_END (keine Zugende-Auslöser, keine Zähler „at the end of each turn"), keine Zugende-Aufträge, kein Zugende-Surprise-Fenster, räumt
// weder Zusatzaktionen noch `itemLocked` ab und lässt auch den Beginn des nächsten eigenen Zuges (`Divine Gift of the Guardian`: „until the beginning of your next turn") nicht schon im Skip fällig werden.
// Geprüft wird, WAS der Durchlauf ausführt (Hook-Protokoll je Zugwechsel) und vier Dauer-Mechaniken, die an ihm hängen:
//   · Hook-Protokoll: ON_TURN_END feuert genau für die TATSÄCHLICH gespielten Züge (je Zug einmal, mit dem richtigen aktiven Spieler), ON_TURN_START für jeden beobachteten Zugbeginn · `gs._uebersprungeneZuege` · `engine.istEchterZug`
//   · Divine Gift of the Guardian (Spielermarke, B: bis zum Beginn des nächsten eigenen Zuges) — der Skip des EIGENEN Zuges beendet sie nicht
//   · Hammer Throw (`itemLocked`: bis nach dem eigenen Zug des Betroffenen) — der Skip des Betroffenen hebt die Sperre nicht auf
//   · Held-Status „for 2 turns" (`stunned` mit `duration: 2`) und Kreatur-Freeze (`frozenDuration: 2`) — nur echte Züge der Betroffenen zählen herunter
// Alle Szenarien je Sitz: ohne Skip (Gegenprobe) · Gegnerzug 1 · Gegnerzüge 1 und 3 · eigener Zug 2 · eigene Züge 2 und 4 · Gegnerzug 1 und eigener Zug 2 direkt hintereinander. Exit 0 = korrekt.
const Skip = require('../../lib/skip.js');
const { H } = Skip;

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`════ Sitz ${seat} ════`);

    // ── 1) Hook-Protokoll ────────────────────────────────────────────────────────────────────────────────
    for (const [nm, skip] of Skip.SZENARIEN) {
      const t = await H.fresh({ turn: 5, active: seat, deckSize: 40, gold: 300 });
      const ende = [], start = [];
      const orig = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = async (name, ctx, ...r) => {
        if (name === 'onTurnEnd') ende.push(`${ctx.turn}:${ctx.activePlayer}`);
        if (name === 'onTurnStart') start.push(`${ctx.turn}:${ctx.activePlayer}`);
        return orig(name, ctx, ...r);
      };
      const T0 = t.gs.turn;
      const z = await Skip.lauf(t, seat, { skip, schritte: 5 });
      // erwartet: ON_TURN_END der ersten 5 echten Züge (Index 0 = T0), ON_TURN_START der beobachteten Zugbeginne
      const echt = []; for (let i = 0; echt.length < 5; i++) if (!skip.includes(i)) echt.push(i);
      const sollEnde = echt.map(i => `${T0 + i}:${i % 2 === 0 ? seat : opp}`);
      const sollStart = z.beob.map(b => `${b.turn}:${b.aktiv}`);
      R.check(`[S${seat}] Hook-Protokoll — ${nm}: ON_TURN_END genau für die echten Züge ${sollEnde.join(' ')}`, JSON.stringify(ende) === JSON.stringify(sollEnde), { ist: ende, soll: sollEnde });
      R.check(`[S${seat}] Hook-Protokoll — ${nm}: ON_TURN_START nur für gespielte Züge (${sollStart.join(' ')})`, JSON.stringify(start) === JSON.stringify(sollStart), { ist: start, soll: sollStart });
      const vermerkt = (t.gs._uebersprungeneZuege || []).map(e => e.turn - T0);
      R.check(`[S${seat}] Hook-Protokoll — ${nm}: gs._uebersprungeneZuege/istEchterZug stimmen (übersprungen: ${skip.join(',') || 'keiner'})`,
        JSON.stringify(vermerkt.filter(i => i <= z.beob[z.beob.length - 1].turn - T0)) === JSON.stringify(skip.filter(i => i <= z.beob[z.beob.length - 1].turn - T0))
        && typeof t.engine.istEchterZug === 'function' && skip.every(i => i > z.beob[z.beob.length - 1].turn - T0 || t.engine.istEchterZug(T0 + i) === false) && t.engine.istEchterZug(T0) === true,
        { vermerkt, skip });
      R.check(`[S${seat}] Hook-Protokoll — ${nm}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
    }

    // ── 2) Dauer-Mechaniken am Skip-Durchlauf ────────────────────────────────────────────────────────────────
    const DAUER = [
      ['Divine Gift of the Guardian (Spielermarke bis zum Beginn des nächsten eigenen Zuges)', 'B',
        async () => { const t = await H.fresh({ turn: 5, active: seat, deckSize: 40, gold: 300 }); t.engine._guardianSchutzSetzen(seat); return t; },
        (t) => !!t.gs.players[seat]._guardianShield],
      ['Hammer Throw (itemLocked bis nach dem eigenen Zug des Betroffenen)', 'E',
        async () => { const t = await H.fresh({ turn: 5, active: seat, deckSize: 40, gold: 300 }); t.gs.players[opp].itemLocked = true; return t; },
        (t) => !!t.gs.players[opp].itemLocked],
      ['Held „stunned" mit duration 2 (for 2 turns)', 'E2',
        async () => { const t = await H.fresh({ turn: 5, active: seat, deckSize: 40, gold: 300 }); await t.engine.addHeroStatus(opp, 0, 'stunned', { duration: 2, appliedBy: seat }); return t; },
        (t) => !!t.hero(opp, 0).statuses.stunned],
      ['Kreatur „frozen" mit frozenDuration 2 (for 2 turns)', 'E2',
        async () => { const t = await H.fresh({ turn: 5, active: seat, deckSize: 40, gold: 300 }); const i = t.put(opp, 0, 0, H.INERT.creature); await t.engine.applyCreatureStatus(i, 'frozen', { duration: 2, sourceOwner: seat }); return t; },
        (t) => !!t.inst(c => c.name === H.INERT.creature && c.zone === 'support')[0]?.counters.frozen],
    ];
    for (const [name, art, bau, probe] of DAUER) {
      for (const [nm, skip] of Skip.SZENARIEN) {
        const t = await bau();
        const z = await Skip.lauf(t, seat, { skip, schritte: 6, probe: (tt) => probe(tt) });
        const p = Skip.pruefe(art, z);
        R.check(`[S${seat}] ${name} — ${nm}`, p.ok && t.errors.length === 0 && t.audit().length === 0, { ist: p.ist, soll: p.soll, e: t.errors.slice(0, 2) });
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
