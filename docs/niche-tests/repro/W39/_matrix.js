'use strict';
// W39a · Läufer der Test-Matrix: jeder Leser × jeder Treiber × beide Sitze (× Zieltyp). Liefert je Zelle: 'ja' (Leser hat ausgelöst), 'nein', 'n/a' (Kombination ergibt keinen Sinn) oder 'fehler'.
// Referenz ist die „Echte Attack"; löst der Leser dort nicht aus, misst die Sonde falsch (Zelle 'sonde').
const L = require('./_helfer.js');
const { H, TREIBER, szene, setzeFrei, sauber } = L;

/**
 * Leser-Beschreibung (siehe `_leser.js`):
 *   id, art ('equip'|'held'|'kreatur'|'reaktion'|'surprise'|'area'|'sonst'), liest ('attack'|'attackOderSpell'),
 *   ziele: ['hero'|'creature'] (Standard beide), nurTreiber / ohneTreiber, freierHeld: braucht einen frei wählbaren Helden (nicht bei Broghan & Co.),
 *   vorbereiten(t, k, mit) — baut den Leser auf (mit=false: Baseline ohne Leser, falls die Vorbereitung sonst gleich bleiben soll),
 *   attHand / vicHand / meHand (Handkarten), script (promptGeneric-Regeln), waehle(v, cfg, k) (Zielwahl-Übersteuerung),
 *   ok(r, b, k) — hat der Leser ausgelöst? r = Ergebnis der Szene mit Leser, b = Baseline (nur wenn `vergleich`),
 *   vergleich: true — Baseline ohne Leser mitlaufen lassen.
 */
function kombinationSinnvoll(leser, name, ziel) {
  const d = TREIBER[name];
  if (leser.ziele && !leser.ziele.includes(ziel)) return false;
  if (!d.ziele.includes(ziel)) return false;
  if (leser.nurTreiber && !leser.nurTreiber.includes(name)) return false;
  if (leser.ohneTreiber && leser.ohneTreiber.includes(name)) return false;
  if (leser.freierHeld && d.festerHeld) return false;
  return true;
}

async function eineZelle(leser, name, me, op, ziel, o = {}) {
  const op2 = {
    ziel, F: leser.F ?? o.F, zielHeld: leser.zielHeld, kreaturName: leser.kreaturName, kreaturHp: leser.kreaturHp,
    attHand: leser.attHand, vicHand: leser.vicHand, meHand: leser.meHand, discard: leser.discard, potionDeck: leser.potionDeck, deck: leser.deck,
    script: leser.script,
    vorbereiten: async (t, k) => {
      if (leser.waehle) {
        let inner;
        Object.defineProperty(t, 'targetFn', { configurable: true, get: () => (v, cfg, tt) => { const w = leser.waehle(v, cfg, k, t); return w !== undefined ? w : (inner ? inner(v, cfg, tt) : undefined); }, set: (f) => { inner = f; } });
      }
      await leser.vorbereiten(t, k, true);
    },
  };
  const r = await szene(name, me, op, op2);
  let b = null;
  if (leser.vergleich) {
    b = await szene(name, me, op, { ...op2, attHand: leser.attHandBasis ?? leser.attHand, vorbereiten: async (t, k) => { if (leser.vorbereiten) await leser.vorbereiten(t, k, false); } });
  }
  let hat;
  try { hat = !!(await leser.ok(r, b, r.k)); } catch (e) { return { z: 'fehler', info: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }; }
  return { z: hat ? 'ja' : 'nein', sauber: sauber(r.t), fehler: r.t.errors.slice(0, 2), audit: r.t.audit().slice(0, 2), erg: r.erg && r.erg.threw ? String(r.erg.threw) : r.erg === true ? 'true' : String(r.erg && (r.erg.hung ? 'hung' : r.erg.runaway ? 'runaway' : r.erg)) };
}

/** Matrix für eine Liste von Lesern und Treibern. Rückgabe: Liste von Zellen {leser, treiber, sitz, ziel, z, info}. */
async function matrix(leserListe, treiberListe, opts = {}) {
  const out = [];
  for (const leser of leserListe) {
    for (const name of treiberListe) {
      for (const ziel of ['hero', 'creature']) {
        if (!kombinationSinnvoll(leser, name, ziel)) continue;
        for (const [me, op] of (opts.sitze || [[0, 1], [1, 0]])) {
          const zelle = await eineZelle(leser, name, me, op, ziel, opts);
          out.push({ leser: leser.id, treiber: name, sitz: me, ziel, ...zelle });
        }
      }
    }
  }
  return out;
}
module.exports = { matrix, eineZelle, kombinationSinnvoll };
