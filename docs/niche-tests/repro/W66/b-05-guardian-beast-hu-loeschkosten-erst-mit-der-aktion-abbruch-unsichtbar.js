'use strict';
// W66b-05 · Guardian Beast Hu: die 5 Löschkosten gelten erst, wenn die geschenkte Aktion committed ist — ein Abbruch löscht nichts, verbraucht die Einmal-Sperre nicht, der Gegner sieht nichts (Al, 23.10.2026)
//
// Kartentext: „You may once per turn delete 5 cards total from both discard piles to immediately perform an additional Action with any Hero you control."
// Al: „Die 5 Löschkosten werden erst bezahlt, nachdem die abbrechbare Aktionswahl abgeschlossen/committed ist (Abbruch: nichts gelöscht, HOPT nicht verbraucht, Gegner sieht nichts)."
// Vorher: die Aktivierung wurde dem Gegner schon beim Öffnen der Aktionswahl gezeigt (`performImmediateActionAnyHero` stand in der Schritt-Liste des Auftritts-Puffers), und die 5 Löschungen samt Animation
//   und Protokollzeilen gingen an ihn raus, bevor die Aktion feststand; ein Abbruch legte sie zurück (Rückerstattungszeilen für den Gegner sichtbar).
// Jetzt: die Auswahl der 5 Karten und die Aktionswahl sind abbrechbar; die Löschung läuft im Kosten-Vorlauf der Engine (die Aktion muss sie sehen — z. B. ein Guardian Beast braucht die leere Ablage),
//   alles Sichtbare (Aktivierung, Löschzeilen, Animation, Rückerstattung) wartet im Auftritts-Puffer: erst die committete Aktion zeigt Hu und die Löschung; ein Abbruch lässt den Spielzustand EXAKT wie
//   vorher (Ablage in derselben Reihenfolge) und dem Gegner nichts übrig.
// Szenen: (A) Aktion ohne Rückfrage, (B) Aktion mit Zielwahl (Fireball): Abbruch in der Zielwahl führt zur Aktionswahl zurück, dort Abbruch. Beide Sitze. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const HU = 'Guardian Beast Hu';
const FB = 'Fireball';
const hopt0 = (t) => Object.keys(t.gs.hoptUsed || {}).filter(k => /^creature-effect:/.test(k)).length === 0;
const geloescht = (t) => t.gs.players.reduce((n, p) => n + (p.deletedPile || []).length, 0);   // aus BEIDEN Ablagen
const sichtbar = (r, seat) => r.tl.filter(e => e.k === 'wire' && e.sid !== 'S' + seat && e.ev !== 'game_state' && e.ev !== 'spectator_state' && e.ev !== 'opponent_targeting').map(e => e.ev);

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    for (const [szene, aktion] of [['A ohne Rückfrage', null], ['B Fireball mit Zielwahl', FB]]) {
      const label = `[S${seat}] ${HU} · ${szene}`;
      R.section(label);
      const mk = async () => W.reicheSzene({ seat, karten: aktion ? [aktion] : [] });
      const prepFn = async (t) => { t.put(seat, 0, 0, HU).turnPlayed = 1; t.gs.activePlayer = seat; t.phase(2); if (aktion) t.grantFor(seat, 0, aktion); };
      const callFn = (t) => t.activateCreature(seat, 0, 0);
      const antwort = (e) => {
        if (e.kind === 'generic' && e.d.type === 'heroAction') {
          const ps = e.t ? e.t.gs.players[seat] : null;
          const el = e.d.eligibleCards || [];
          const pick = aktion ? el.find(n => n === aktion) : el.find(n => W.DB[n] && W.DB[n].cardType === 'Spell' && n !== FB);
          if (!pick) return undefined;
          return { cardName: pick, heroIdx: (e.d.heroIndicesByCard[pick] || [0])[0], fromCreation: false, __pick: true };
        }
        if (e.kind === 'target') { const x = (e.valid || []).find(q => !q.ineligible && q.owner === 1 - seat); return x ? [x.id] : undefined; }
        return undefined;
      };
      // handIndex kennt nur die Szene: nachtragen
      let tRef = null;
      const answer = (e) => { const a = antwort(e); if (a && a.__pick) { delete a.__pick; a.handIndex = tRef.gs.players[seat].hand.indexOf(a.cardName); } return a; };
      const mk2 = async () => { tRef = await mk(); return tRef; };
      const d = await W.durchlauf(mk2, seat, HU, { seat, hero: 0, maxCancel: 6, prepFn, callFn, answer, undoneFn: hopt0, aktivierung: true, zustandsdiff: true });
      const c = d.clean;
      R.check(`${label}: Durchlauf — Hu aktiviert, die Aktion fand statt, 5 Karten gelöscht, Einmal-Sperre gestempelt`, !hopt0(c.t) && geloescht(c.t) === 5, { hopt: Object.keys(c.t.gs.hoptUsed || {}), del: geloescht(c.t), res: c.r.result, err: c.t.errors });
      const sehen = c.r.tl.map((e, i) => [e, i]).filter(([e]) => e.k === 'wire' && e.sid === 'S' + (1 - seat));
      const iHu = sehen.find(([e]) => e.ev === 'card_reveal' && e.data && e.data.cardName === HU);
      const iDel = sehen.find(([e]) => e.ev === 'discard_to_deleted_animation');
      const iAktion = sehen.find(([e]) => e.ev === 'card_reveal' && e.data && e.data.cardName !== HU);
      R.check(`${label}: Durchlauf — der Gegner sieht Hu und die Löschung (Auftritt vor der Löschung)`, !!iHu && !!iDel && iHu[1] < iDel[1], { hu: iHu && iHu[1], del: iDel && iDel[1] });
      if (iAktion && iDel) R.check(`${label}: Durchlauf — die gespielte Aktion zeigt sich VOR der Löschung der Kosten (Kosten erst mit dem Commit der Aktion sichtbar)`, iAktion[1] < iDel[1], { aktion: iAktion[1], del: iDel[1] });
      const aborts = d.cancels;
      R.check(`${label}: mindestens 2 Abbruchstellen (Kartenwahl + Aktionswahl${aktion ? ' + Zielwahl' : ''}) — gefunden ${aborts.length}`, aborts.length >= (aktion ? 3 : 2), aborts.map(x => [x.k, x.r.undone]));
      for (const { k, r, t } of aborts) {
        const ps = t.gs.players[seat];
        R.check(`${label}: Abbruch an Stelle ${k} — Einmal-Sperre frei, nichts gelöscht, Ablage in derselben Reihenfolge`, r.undone && geloescht(t) === 0, { hopt: Object.keys(t.gs.hoptUsed || {}), del: geloescht(t), undone: r.undone });
        R.check(`${label}: Abbruch an Stelle ${k} — der Gegner/Zuschauer sieht NICHTS (keine Aktivierung, keine Löschzeilen, keine Rückerstattung)`, sichtbar(r, seat).length === 0 && r.appearances.length === 0, sichtbar(r, seat).slice(0, 10));
        R.check(`${label}: Abbruch an Stelle ${k} — Zustandsdifferenz nach Abbruch = 0`, (r.zustandsDiff || []).length === 0, (r.zustandsDiff || []).slice(0, 6));
        R.check(`${label}: Abbruch an Stelle ${k} — keine Engine-Fehler`, t.errors.length === 0, t.errors);
      }
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
