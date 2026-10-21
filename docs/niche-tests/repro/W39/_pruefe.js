'use strict';
// W39a · Prüfhilfe der Repros: Leser × Quellen aus der Matrix (`_matrix.js`) als `R.check`-Zeilen.
//   pruefe(R, { leser: [Objekte|Ids], treiber: [Namen], bewusst: {…}, sitze })
//     Je Leser und Quelle EINE Zeile über beide Sitze und alle sinnvollen Zieltypen; eine Zelle gilt als bestanden, wenn der Leser ausgelöst hat ('ja'), wenn die Kombination
//     in `BEWUSST` steht (mit Grund, siehe unten) oder wenn die Quelle kein Attack-Effekt ist (Gegenprobe: Siphem/Alice dürfen Attack-Leser NICHT auslösen).
//   Die Gegenproben prüft `gegenproben(R, …)`.
const L = require('./_helfer.js');
const { TREIBER } = L;
const M = require('./_matrix.js');
const LS = require('./_leser.js');

/** Alle Leser aus `_leser.js` (Reihenfolge der Listen). */
function alleLeser() { const all = []; for (const k of Object.keys(LS)) if (Array.isArray(LS[k])) all.push(...LS[k]); return all; }

/**
 * Bewusst NICHT (Kombination Leser × Quelle, Grund):
 *   MOOT   Ziel wird vom Treffer besiegt (Kohta) bzw. ist tot – ein Leser, der am LEBENDEN Ziel wirkt (Status, Heilung, Zuschlag), hat nichts mehr zu tun
 *   WAHL   Duel wählt keine Ziele (die Helden stehen fest, „is chosen"-Fenster öffnen nicht, Duel-Kopfkommentar) / Alluring Light: das Opfer wählt der Besitzer des Ziels selbst
 *          – Schutz, der das WÄHLEN durch den Gegner verbietet (Butterfly Cloud, Invisibility, Hardy Slime, Taunt), greift nicht
 */
const MOOT_KOHTA = ['Blade of the Frostbringer', 'Blade of the Swamp Witch', 'The Sun Sword', 'Vampiric Sword'];
function bewusstNein(leser, treiber) {
  if (treiber === 'Kohta' && MOOT_KOHTA.includes(leser.id)) return 'MOOT';
  if (treiber === 'Duel' && leser.duelWahlFenster) return 'WAHL';
  if (treiber === 'Alluring Light' && leser.lichtEigeneWahl) return 'WAHL';
  return null;
}

async function pruefe(R, { leser, treiber, sitze, kopf }) {
  const liste = (leser || []).map(l => (typeof l === 'string' ? alleLeser().find(x => x.id === l) : l)).filter(Boolean);
  for (const l of liste) {
    if (kopf) R.section(`${kopf}: ${l.id}`);
    for (const d of treiber) {
      const schlecht = [];
      let n = 0;
      for (const ziel of ['hero', 'creature']) {
        if (!M.kombinationSinnvoll(l, d, ziel)) continue;
        for (const [me, op] of (sitze || [[0, 1], [1, 0]])) {
          const z = await M.eineZelle(l, d, me, op, ziel);
          n++;
          if (z.z === 'ja' && z.sauber === false && !l.auditAusnahme) schlecht.push({ ziel, sitz: me, fehler: z.fehler, audit: z.audit });
          if (z.z === 'ja' || bewusstNein(l, d)) continue;
          schlecht.push({ ziel, sitz: me, z: z.z, info: z.info });
        }
      }
      if (n) R.check(`${l.id} × ${d}`, schlecht.length === 0, schlecht);
    }
  }
}

/**
 * Gegenproben: gewöhnliche Heldeneffekte (Siphem) lösen einen Attack-Leser NIE aus; Alice (zählt als SPELL) nur die Leser, die auch Spells lesen (`liest: 'attackOderSpell'`).
 * Leser mit `liest: 'allgemein'` (Zielschutz-Status) gelten für jede Zielwahl und werden hier nicht geprüft.
 */
async function gegenproben(R, { leser, sitze }) {
  const liste = (leser || []).map(l => (typeof l === 'string' ? alleLeser().find(x => x.id === l) : l)).filter(Boolean);
  for (const l of liste) {
    if (l.liest === 'allgemein') continue;
    for (const d of ['Siphem', 'Alice', 'Echter Spell']) {
      const soll = d !== 'Siphem' && l.liest === 'attackOderSpell';
      const schlecht = [];
      let n = 0;
      for (const ziel of ['hero', 'creature']) {
        if (!M.kombinationSinnvoll(l, d, ziel)) continue;
        for (const [me, op] of (sitze || [[0, 1], [1, 0]])) {
          const z = await M.eineZelle(l, d, me, op, ziel);
          n++;
          if (soll ? z.z !== 'ja' : z.z === 'ja') schlecht.push({ ziel, sitz: me, z: z.z });
        }
      }
      if (n) R.check(`Gegenprobe ${l.id} × ${d}: ${soll ? 'Spell-Leser reagiert' : 'reagiert NICHT'}`, schlecht.length === 0, schlecht);
    }
  }
}
/** Quellen, die als Attack zählen (plus die Referenz „Echte Attack"). */
const POSITIV = ['Echte Attack', 'Broghan', 'Brackle', 'Arthor', 'Heragas', 'Kohta', 'Javelin Throw', 'Sword in a Bottle', "Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot",
  'Bamboo Staff', 'Sacrificial Dagger', 'Infected Greatmaw', 'Alluring Light', 'Duel'];
module.exports = { POSITIV, pruefe, gegenproben, alleLeser, bewusstNein, TREIBER };
