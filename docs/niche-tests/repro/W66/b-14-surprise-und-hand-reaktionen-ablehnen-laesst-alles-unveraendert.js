'use strict';
// W66b-14 · Surprise- und Hand-Reaktions-Fenster: wer ablehnt (Abbruch/„No"), lässt den Zustand EXAKT unverändert — die Karte bleibt aktivierbar (Al, 23.10.2026: „Abbruch → bleibt aktivierbar")
//
// Aufbau: der Angreifer (Sitz `seat`) löst fünf typische Fenster des Verteidigers aus — Heldentreffer, Kreaturentreffer, Heldenstatus, eigene Beschwörung, Ziehen. Der Verteidiger hat EINE Karte bereit:
//   (A) als verdeckte Surprise auf seinem Helden 0, oder (B) als Reaktionskarte auf der Hand. Jede Karte, die das Fenster WIRKLICH anbietet (Bestätigungsfrage mit ihrem Namen), wird abgelehnt
//   (Abbruch-Knopf). Geprüft je angebotener Karte: (1) der Zustand beim Schließen des Fensters gleicht dem beim Öffnen (kein Stempel, keine Kosten, kein Mischen), (2) die Karte liegt weiter verdeckt in der
//   Surprise Zone bzw. auf der Hand (aktivierbar), (3) der Angreifer/Zuschauer haben nichts über die Karte erhalten. Beide Sitze. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const { zustand, zustandDiff } = require('../../lib/zustand.js');
const FENSTER = ['_scanSurpriseEntriesForPlayer', '_checkPreDamageHandReactions', '_checkOppPreDamageHandReactions', '_checkCreaturePreDamageHandReactions', '_checkOppCreaturePreDamageHandReactions',
  '_checkCreaturePreDefeatHandReactions', '_checkHeroDefeatWindowReactions', '_checkHeroDefeatedHandReactions', '_checkPostTargetBoardReactions', '_offerHeroCounterToHandReaction', 'checkHandInteractionReaction'];
const AKTIONEN = {
  heldentreffer: (t, a, v) => t.engine.actionDealDamage({ name: 'Test', owner: a, heroIdx: 0 }, t.gs.players[v].heroes[0], 50, 'attack'),
  kreaturentreffer: (t, a, v) => t.engine.actionDealCreatureDamage({ name: 'Test', owner: a, heroIdx: 0 }, t.find(W.INERT.big, 'support') && t.inst(c => c.zone === 'support' && c.owner === v)[0], 50, 'creature', { sourceOwner: a }),
  heldenstatus: (t, a, v) => t.engine.addHeroStatus(v, 0, 'burned', { appliedBy: a, source: 'Test' }),
  beschwoerung: (t, a, v) => t.engine.summonCreatureWithHooks(W.INERT.creature, a, 2, 2, { source: 'Test' }),
  ziehen: (t, a, v) => t.engine.actionDrawCards(a, 1),
};
const SURPRISES = Object.values(W.DB).filter(c => c.name && !/^ZZ /.test(c.name) && /surprise/i.test(c.subtype || '')).map(c => c.name);
const REAKTIONEN = Object.values(W.DB).filter(c => c.name && !/^ZZ /.test(c.name) && /reaction/i.test(c.subtype || '')).map(c => c.name);

(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const v = 1 - seat;
    const st = { laeufe: 0, angeboten: 0, karten: new Set() }; const spur = [], weg = [], sichtbar = [], fehler = [];
    for (const [art, liste] of [['surprise', SURPRISES], ['hand', REAKTIONEN]]) {
      for (const name of liste) {
        for (const [an, aktion] of Object.entries(AKTIONEN)) {
          try {
            const t = await W.reicheSzene({ seat, scanState: false });
            const e = t.engine;
            if (art === 'surprise') t.putSurprise(v, 0, name); else { t.gs.players[v].hand.push(name); e._trackCard(name, v, 'hand'); }
            t.grantFor(v, 0, name);
            // Fenster-Rahmen: Zustand beim Öffnen/Schließen
            const rahmen = [];
            for (const f of FENSTER) {
              const orig = Object.getPrototypeOf(e)[f]; if (typeof orig !== 'function') continue;
              e[f] = async function (...args) { const vor = zustand(t.gs, e); const r = await orig.apply(this, args); rahmen.push({ f, diff: zustandDiff(vor, zustand(t.gs, e)) }); return r; };
            }
            let angeboten = false;
            const antwort = (en) => { if (en.kind === 'generic' && en.d && en.d.type === 'confirm' && en.d.title === name) { angeboten = true; return W.CANCEL; } return undefined; };
            const r = await W.spiele(t, v, name, { call: () => t.run(() => aktion(t, seat, v)), answer: antwort, timeoutMs: 5000 });
            st.laeufe++;
            if (t.errors.length) fehler.push(`${name}/${an}: ${t.errors[0].slice(0, 100)}`);
            if (!angeboten) continue;
            st.angeboten++; st.karten.add(name);
            // Angebots-Merker EINER Auflösung (`_cibPromptedFor`, `_bsPromptedFor`, `_saPromptedFor`: „in dieser Auflösung schon gefragt", räumen `onChainResolve`/`onAnyActionResolved` ab) sind kein Limit.
            const schlecht = rahmen.map(x => ({ f: x.f, diff: x.diff.filter(z => !/_(cib|bs|sa)PromptedFor/.test(z)) })).filter(x => x.diff.length);
            if (schlecht.length) spur.push(`${art} ${name} / ${an}: ${schlecht[0].f}: ${schlecht[0].diff.slice(0, 3).join(' | ')}`);
            const inst = t.inst(c => c.name === name && c.owner === v).find(c => c.zone === (art === 'surprise' ? 'surprise' : 'hand'));
            const noch = art === 'surprise' ? (!!inst && inst.faceDown === true) : t.gs.players[v].hand.includes(name);
            if (!noch) weg.push(`${art} ${name} / ${an}`);
            const gesehen = r.tl.filter(x => x.k === 'wire' && x.sid === 'S' + seat && x.ev !== 'game_state' && JSON.stringify(x.data || '').includes(name));
            if (gesehen.length) sichtbar.push(`${art} ${name} / ${an}: ${gesehen[0].ev}`);
          } catch (err) { fehler.push(`${name}/${an}: ${String(err.message).slice(0, 100)}`); }
        }
      }
    }
    R.section(`── Sitz ${seat} ──`);
    R.check(`[S${seat}] ${st.laeufe} Läufe, ${st.angeboten} Angebote von ${st.karten.size} verschiedenen Karten wurden abgelehnt`, st.angeboten >= 30 && st.karten.size >= 12, { laeufe: st.laeufe, angeboten: st.angeboten, karten: st.karten.size });
    R.check(`[S${seat}] Ablehnen: der Zustand beim Schließen des Fensters gleicht dem beim Öffnen (kein Stempel, keine Kosten, kein Mischen)`, spur.length === 0, spur.slice(0, 10));
    R.check(`[S${seat}] Ablehnen: die Karte bleibt aktivierbar (Surprise verdeckt in ihrer Zone / Reaktion auf der Hand)`, weg.length === 0, weg.slice(0, 10));
    R.check(`[S${seat}] Ablehnen: dem Angreifer und den Zuschauern wird die Karte nicht verraten`, sichtbar.length === 0, sichtbar.slice(0, 10));
    R.check(`[S${seat}] keine Engine-Fehler`, fehler.length === 0, fehler.slice(0, 6));
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
