// ═══════════════════════════════════════════════════════════════════
//  ABILITY-STAPEL IN SUPPORT ZONEN VERLAGERN (Teleport, Compulsory Body Swap)
//
//  Eine Ability in einer Support Zone (Xal, Xalibur, gewonnener Xal-Effekt) ist eine Instanz mit `zone: 'support'` und gehört zum Helden
//  ihrer Spalte. Tauschen zwei Helden „ihre Abilities" (Compulsory Body Swap) oder „ihre Positionen samt Abilities" (Teleport), wandern
//  diese Stapel MIT — in die Support Zonen der anderen Spalte. Dafür gilt dieselbe Regel wie für die Puppet-Tokens bei Teleport
//  (Al, 24.10.2026):
//
//    · Ein Held kann nur mit einem getauscht werden, dessen Support Zonen seine Support-Zone-Abilities TRAGEN würden: genug freie
//      Support Zonen in der Zielspalte (abzüglich der Plätze, die ihre eigenen wandernden Karten gerade räumen; versiegelte Zonen zählen
//      nicht). Karten, die nicht mitwandern (Kreaturen, Ausrüstung …), blockieren ihren Platz.
//    · Verliert ein Held dadurch seine Erlaubnis für Abilities in Support Zonen (z. B. Xalibur bleibt in der alten Spalte liegen), werden
//      alle diese Abilities NACH dem Tausch auf den Ablagestapel geschickt (`engine.sendeSupportAbilitiesInAblage`, die Leafagami Snake
//      schützt wie sonst).
//
//  Die Mitwanderer sind Beschreibungen `{ art, seite, col, slot, namen, insts }`:
//    art 'stapel'  Ability-Stapel (auch schlafende, die die Schlange hält); ganzer Slot
//    art 'puppet'  Puppet-Token (Tri Fecta / Tri Ad), nur Teleport
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { hasCardType } = require('./_hooks');

function istAbilityName(engine, name) {
  const cd = engine._getCardDB()[name];
  return !!cd && hasCardType(cd, 'Ability');
}

/** Alle Ability-Stapel in den Support Zonen der Spalte `col` (Brettseite `seite`) — auch schlafende. */
function supportAbilityStapel(engine, seite, col) {
  const zonen = engine.gs.players[seite]?.supportZones?.[col] || [];
  const out = [];
  zonen.forEach((slot, s) => {
    if (!slot || slot.length === 0 || !istAbilityName(engine, slot[0])) return;
    const insts = engine.cardInstances.filter(c => c.zone === 'support' && engine.physicalSide(c) === seite
      && c.heroIdx === col && c.zoneSlot === s);
    out.push({ art: 'stapel', seite, col, slot: s, namen: [...slot], insts });
  });
  return out;
}

/**
 * Wohin wandern die Mitwanderer beim Tausch der Spalten `A = { seite, col, movers }` und `B = { seite, col, movers }`?
 * Eine Spalte nimmt die Mitwanderer der anderen auf (A → B und B → A). Gleicher Slot-Index, wenn frei, sonst der niedrigste freie.
 * Frei = leer ODER von einer wandernden Karte belegt, die auszieht; versiegelte Zonen (Madame Guillotine) sind nie frei.
 * @returns {{ ok: boolean, moves: Array<{ mover, nach: {seite,col,slot} }>, grund?: string }}
 */
function planeVerlagerung(engine, A, B) {
  const V = require('./_ability-verwahrung-shared');
  const gs = engine.gs;
  const quellen = [{ von: A, nach: B }, { von: B, nach: A }];

  // Plätze, die ganz ausziehen: Schlüssel `seite-col-slot`.
  const key = (seite, col, slot) => `${seite}-${col}-${slot}`;
  const raeumt = new Set();
  for (const q of quellen) {
    for (const m of q.von.movers) {
      const arr = gs.players[m.seite]?.supportZones?.[m.col]?.[m.slot] || [];
      if (m.namen.length >= arr.length) raeumt.add(key(m.seite, m.col, m.slot));
    }
  }
  const blockiert = (seite, col, s) => {
    if (V.versiegelt(gs, seite, col, 'support', s)) return true;
    const z = gs.players[seite]?.supportZones?.[col]?.[s] || [];
    if (z.length === 0) return false;
    return !raeumt.has(key(seite, col, s));
  };

  const moves = [];
  for (const q of quellen) {
    if (q.von.movers.length === 0) continue;
    const ziel = q.nach;
    const n = Math.max(3, (gs.players[ziel.seite]?.supportZones?.[ziel.col] || []).length);
    const belegt = new Set();
    for (const m of [...q.von.movers].sort((x, y) => x.slot - y.slot)) {
      let slot = -1;
      if (m.slot < n && !blockiert(ziel.seite, ziel.col, m.slot) && !belegt.has(m.slot)) slot = m.slot;
      else for (let s = 0; s < n; s++) if (!blockiert(ziel.seite, ziel.col, s) && !belegt.has(s)) { slot = s; break; }
      if (slot < 0) return { ok: false, moves: [], grund: 'support_zones' };
      belegt.add(slot);
      moves.push({ mover: m, nach: { seite: ziel.seite, col: ziel.col, slot } });
    }
  }
  return { ok: true, moves };
}

/**
 * Führt den Plan aus: erst alles aus den Quellslots nehmen, dann in die Zielslots legen, Instanzen umhängen (`heroIdx`, `zoneSlot`; über die
 * Seite hinweg auch `owner` / `controller` / `heroOwner`). Stiller Umzug — keine Abgangs-/Eintritts-Hooks (der Held trägt seine Boni selbst).
 * @returns {Array<{ mover, nach }>} die ausgeführten Verlagerungen
 */
function fuehreVerlagerungAus(engine, plan) {
  const gs = engine.gs;
  for (const m of plan.moves) {
    const arr = gs.players[m.mover.seite]?.supportZones?.[m.mover.col]?.[m.mover.slot];
    if (!arr) continue;
    for (const name of m.mover.namen) {
      const i = arr.indexOf(name);
      if (i >= 0) arr.splice(i, 1);
    }
  }
  for (const m of plan.moves) {
    const pd = gs.players[m.nach.seite];
    if (!pd.supportZones[m.nach.col]) pd.supportZones[m.nach.col] = [[], [], []];
    if (!pd.supportZones[m.nach.col][m.nach.slot]) pd.supportZones[m.nach.col][m.nach.slot] = [];
    pd.supportZones[m.nach.col][m.nach.slot].push(...m.mover.namen);
    for (const inst of m.mover.insts) {
      inst.heroIdx = m.nach.col;
      inst.zoneSlot = m.nach.slot;
      if (m.nach.seite !== m.mover.seite) {
        inst.owner = m.nach.seite;
        inst.controller = m.nach.seite;
        inst.heroOwner = m.nach.seite;
      }
    }
  }
  return plan.moves;
}

/**
 * Nach dem Tausch: Spalten, deren Held keine Abilities in Support Zonen mehr nimmt, schicken die GERADE angekommenen Ability-Stapel in die Ablage
 * („nach dem Teleport auf den Ablagestapel"). Danach gleicht `syncSupportAbilities` jede betroffene Spalte ab (geschützte Karten schlafen /
 * Karten, die wieder dürfen, wachen auf).
 * @param moves  die Rückgabe von `fuehreVerlagerungAus`
 * @param quelle Name der Karte (Protokoll, Ablage-Herkunft)
 */
async function raeumeNachTausch(engine, moves, quelle) {
  const spalten = new Map();   // `${seite}-${col}` → { seite, col, slots:Set }
  for (const m of moves) {
    if (m.mover.art !== 'stapel') continue;
    const k = `${m.nach.seite}-${m.nach.col}`;
    if (!spalten.has(k)) spalten.set(k, { seite: m.nach.seite, col: m.nach.col, slots: new Set() });
    spalten.get(k).slots.add(m.nach.slot);
  }
  for (const { seite, col, slots } of spalten.values()) {
    if (!engine.heroAcceptsAbilitiesInSupport(seite, col)) {
      await engine.sendeSupportAbilitiesInAblage(seite, col, quelle, { nurSlots: slots });
    }
  }
  // Abgleich für jede Spalte, die Stapel abgegeben oder bekommen hat (auch die, die nur Erlaubnis gewonnen/verloren hat).
  const alle = new Map();
  for (const m of moves) {
    alle.set(`${m.nach.seite}-${m.nach.col}`, { seite: m.nach.seite, col: m.nach.col });
    alle.set(`${m.mover.seite}-${m.mover.col}`, { seite: m.mover.seite, col: m.mover.col });
  }
  for (const { seite, col } of alle.values()) await engine.syncSupportAbilities(seite, col);
}

module.exports = { supportAbilityStapel, planeVerlagerung, fuehreVerlagerungAus, raeumeNachTausch, istAbilityName };
