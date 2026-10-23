'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W66b — ABBRUCH-WÄCHTER (Entdeckungswerkzeug, nur per Umgebungsvariable PP_ABBRUCH_WAECHTER=<Ausgabedatei>; von lib/h.js geladen)
//
//  Regel (Al, 23.10.2026): Kosten UND Limits werden erst bezahlt/gestempelt, wenn die Karte/der Effekt committed ist. Der Wächter findet Karten-HOOKS (Trigger, Reaktionen, Passive,
//  Heldeneffekte …), die VOR einer abbrechbaren Frage schon etwas im Spielzustand verändert haben: er nimmt zu Beginn jedes Hooks einen Zustands-Schnappschuss (lib/zustand.js) und
//  vergleicht ihn, sobald der Hook (oder ein darin geschachtelter Aufruf) dem Spieler eine ABBRECHBARE Frage stellt. Jede Differenz ist ein Kandidat (HOPT-Stempel, Zähler, Kosten, Marken …),
//  der dann von Hand geprüft wird (viele sind harmlos: Buchführung, Rückerstattung im Abbruchzweig). Die Hooks laufen dabei unverändert — der Wächter beantwortet keine Fragen anders.
//
//  Zweiter Modus (PP_ABBRUCH_MODUS=abbrechen): innerhalb eines Hooks wird JEDE abbrechbare Frage des Hooks mit „abgebrochen" beantwortet; am Ende des Hooks wird der Zustand mit dem vom
//  Hookbeginn verglichen — eine Differenz heißt: der Abbruch hinterlässt Spuren (Stempel, Kosten, Zähler). Gemeldet als { art: 'abbruch', karte, hook, frage, diff[] }; `onPlay`-Hooks gespielter
//  Karten werden hier nicht gemeldet (die prüft der Handkarten-Sweep).
//
//  Aufruf:  PP_ABBRUCH_WAECHTER=/pfad/ausgabe.jsonl node datei.js      (jede Zeile: { karte, hook, frage, diff[] })
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const { zustand, zustandDiff } = require('./zustand.js');

let installiert = false;
function installieren(ROOT, ausgabe) {
  if (installiert) return; installiert = true;
  const { GameEngine, CardInstance } = require(ROOT + '/cards/effects/_engine');
  const gesehen = new Set();
  const stapel = [];       // aktive Hooks (innerster zuletzt): { karte, hook, engine, vorher }
  const schreibe = (e) => { try { fs.appendFileSync(ausgabe, JSON.stringify(e) + '\n'); } catch { /* egal */ } };

  const origGetHook = CardInstance.prototype.getHook;
  CardInstance.prototype.getHook = function (hookName) {
    const fn = origGetHook.call(this, hookName);
    if (typeof fn !== 'function') return fn;
    const karte = this.name;
    return async function (ctx, ...rest) {
      const engine = ctx && ctx._engine;
      let eintrag = null;
      if (engine && engine.gs && !engine._inMctsSim && !engine._fastMode) {
        let vorher = null; try { vorher = zustand(engine.gs, engine); } catch { vorher = null; }
        eintrag = { karte, hook: hookName, engine, vorher }; stapel.push(eintrag);
      }
      try { return await fn.call(this, ctx, ...rest); }
      finally {
        if (eintrag) {
          const i = stapel.lastIndexOf(eintrag); if (i >= 0) stapel.splice(i, 1);
          if (eintrag.abgebrochen && eintrag.vorher && eintrag.hook !== 'onPlay') {
            let diff; try { diff = zustandDiff(eintrag.vorher, zustand(engine.gs, engine)); } catch { diff = []; }
            const norm = diff.map(x => x.replace(/\[\d+\]/g, '[]').replace(/#\d+/g, '').replace(/[0-9a-f]{12}/g, '<id>').split(':')[0]);
            const schl = 'abbruch|' + eintrag.karte + '|' + eintrag.hook + '|' + [...new Set(norm)].sort().join(',');
            if (!diff.length && process.env.PP_ABBRUCH_OK) schreibe({ art: 'hook-ok', karte: eintrag.karte, hook: eintrag.hook, frage: eintrag.abgebrochen });
            if (diff.length && !gesehen.has(schl)) { gesehen.add(schl); schreibe({ art: 'abbruch', karte: eintrag.karte, hook: eintrag.hook, frage: eintrag.abgebrochen, diff: diff.slice(0, 12) }); }
          }
        }
      }
    };
  };

  // Reaktions-/Surprise-FENSTER der Engine zählen wie Hooks: jede Fassung wird in einen Rahmen gelegt (Schnappschuss davor, Vergleich danach)
  const FENSTER = ['_scanSurpriseEntriesForPlayer', '_checkPreDamageHandReactions', '_checkOppPreDamageHandReactions', '_checkCreaturePreDamageHandReactions', '_checkOppCreaturePreDamageHandReactions',
    '_checkCreaturePreDefeatHandReactions', '_checkHeroDefeatWindowReactions', '_checkHeroRevivedHandReactions', '_checkHeroDefeatedHandReactions', '_checkBoardSentToDiscardHandReactions',
    '_checkPostTargetBoardReactions', '_offerHeroCounterToHandReaction', 'checkHandInteractionReaction', '_reaktionGespielt'];
  for (const name of FENSTER) {
    const orig = GameEngine.prototype[name];
    if (typeof orig !== 'function') continue;
    GameEngine.prototype[name] = async function (...args) {
      const engine = this;
      let eintrag = null;
      if (engine.gs && !engine._inMctsSim && !engine._fastMode) {
        let vorher = null; try { vorher = zustand(engine.gs, engine); } catch { vorher = null; }
        eintrag = { karte: '<Fenster>', hook: name, engine, vorher }; stapel.push(eintrag);
      }
      try { return await orig.apply(this, args); }
      finally {
        if (eintrag) {
          const i = stapel.lastIndexOf(eintrag); if (i >= 0) stapel.splice(i, 1);
          if (eintrag.abgebrochen && eintrag.vorher) {
            let diff; try { diff = zustandDiff(eintrag.vorher, zustand(engine.gs, engine)); } catch { diff = []; }
            const norm = diff.map(x => x.replace(/\[\d+\]/g, '[]').replace(/#\d+/g, '').replace(/[0-9a-f]{12}/g, '<id>').split(':')[0]);
            const schl = 'fenster|' + name + '|' + [...new Set(norm)].sort().join(',');
            if (!diff.length && process.env.PP_ABBRUCH_OK) schreibe({ art: 'fenster-ok', karte: eintrag.abgebrochen.split('|')[1] || '', hook: name, frage: eintrag.abgebrochen });
            if (diff.length && !gesehen.has(schl)) { gesehen.add(schl); schreibe({ art: 'fenster-abbruch', karte: eintrag.abgebrochen.split('|')[1] || '', hook: name, frage: eintrag.abgebrochen, diff: diff.slice(0, 12) }); }
          }
        }
      }
    };
  }

  function pruefe(engine, frage, cancellable) {
    if (!cancellable) return;
    for (let k = stapel.length - 1; k >= 0 && k >= stapel.length - 2; k--) {   // innerster Hook und sein Aufrufer
      const h = stapel[k];
      if (h.engine !== engine || !h.vorher) continue;
      let diff; try { diff = zustandDiff(h.vorher, zustand(engine.gs, engine)); } catch { continue; }
      if (!diff.length) continue;
      const norm = diff.map(x => x.replace(/\[\d+\]/g, '[]').replace(/#\d+/g, '').replace(/[0-9a-f]{12}/g, '<id>').slice(0, 160));
      const schl = h.karte + '|' + h.hook + '|' + [...new Set(norm.map(x => x.split(':')[0]))].sort().join(',');
      if (gesehen.has(schl)) continue;
      gesehen.add(schl);
      schreibe({ karte: h.karte, hook: h.hook, frage, diff: diff.slice(0, 12) });
    }
  }
  const ABBRECHEN = process.env.PP_ABBRUCH_MODUS === 'abbrechen';
  const innerster = (engine) => { for (let k = stapel.length - 1; k >= 0; k--) if (stapel[k].engine === engine) return stapel[k]; return null; };
  const pg = GameEngine.prototype.promptGeneric;
  GameEngine.prototype.promptGeneric = function (pi, d, ...r) {
    const abbrechbar = !!(d && d.cancellable); const frage = 'generic:' + ((d && (d.type + ':' + (d.title || ''))) || '');
    if (!ABBRECHEN) pruefe(this, frage, abbrechbar);
    else if (abbrechbar) { const h = innerster(this); if (h && h.vorher) { h.abgebrochen = frage + '|' + ((d && d.title) || ''); return Promise.resolve({ cancelled: true }); } }
    return pg.call(this, pi, d, ...r);
  };
  const pe = GameEngine.prototype.promptEffectTarget;
  GameEngine.prototype.promptEffectTarget = function (pi, valid, config = {}) {
    const abbrechbar = !!(config && config.cancellable); const frage = 'target:' + ((config && (config.title || '')) || '');
    if (!ABBRECHEN) pruefe(this, frage, abbrechbar);
    else if (abbrechbar && valid && valid.length) { const h = innerster(this); if (h && h.vorher) { h.abgebrochen = frage + '|' + ((config && config.title) || ''); return Promise.resolve(null); } }
    return pe.call(this, pi, valid, config);
  };
}
module.exports = { installieren };
