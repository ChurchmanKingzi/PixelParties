// ═══════════════════════════════════════════
//  CARD EFFECT: "Skull Carpet Bombing"
//  Spell (Surprise, Lv1, Destruction Magic + Summoning Magic) — PP MBS1
//  neu in v1271
//
//  "Activate this Surprise at the end of your turn if you have dealt no
//   damage to any target during your turn. Deal 100 damage to all
//   targets your opponent controls. If you have placed this card into
//   your Surprise Zone this turn, also deal 100 damage to all targets you
//   control. When this would result in a draw, you win the game. You can
//   only activate 1 "Skull Carpet Bombing" per turn."   (Text v1274)
//
//  ── Ausloeser ──
//  Zugende-Fenster der Engine (`surpriseTurnEndTrigger`, Vorbild Spider
//  Silk Bridge — dort am Zugende des GEGNERS, hier am eigenen).
//  „dealt no damage to any target" liest `info.dealtDamageAnyTarget`
//  (v1271, Engine): gesetzt, sobald ein Effekt dieses Spielers echten
//  Schaden > 0 an IRGENDEIN Ziel verursacht — eigene eingeschlossen,
//  zurueckgesetzt zu jedem Zugbeginn. Status-Ticks (Burn/Poison) haben
//  keinen Verursacher und zaehlen nicht (Als Ruling 1.9. zu Aquatic Spear:
//  „you deal damage" umfasst sie nicht). Auf 0 reduzierter Schaden zaehlt
//  ebenfalls nicht als „dealt".
//
//  ── „You can only activate 1 … per turn" ──
//  HART, pro Spieler (Als Wortlaut-Regel v249) — neu in dieser Fassung.
//  Mit zwei gesetzten Exemplaren zuendet am Zugende nur eines. Sperre
//  `gs.hoptUsed['skull_carpet_bombing:<pi>']` (Muster Spider Avalanche),
//  geprueft im Ausloeser, gesetzt bei Aktivierung.
//
//  ── Eigenschaden ──
//  „placed this card into your Surprise Zone this turn" = die Karte liegt
//  seit DIESEM Zug in der Surprise Zone, egal ob per Hand gesetzt oder per
//  Effekt platziert: `turnPlayed` der Instanz (setzt `_trackCard` beim
//  Eintritt; im Puzzle vorgesetzte Karten sind auf Zug 0 datiert, v1272).
//  ★ v1273 (Als Vorgabe 22.9.): trifft die Karte beide Seiten, dann
//  GLEICHZEITIG — EIN Flaechentreffer mit `side: 'both'` statt zwei
//  nacheinander (vorher: erst Gegner, dann eigene Seite).
//
//  ── Unentschieden ──
//  ★ Als Vorgabe 22.9.: fallen dabei ALLE Helden beider Seiten, gewinnt
//  der Nutzer. Vertrag wie Bunny Bombs / Armageddon: die Spielende-
//  Pruefung ist waehrend des Schlags angehalten (`_deferGameOverCheck`),
//  sonst entschiede der erste toedliche Treffer (= die Reihenfolge der
//  Ziele); danach EINE Auswertung mit dem Verlierer-Hinweis
//  `_drawLoserIdx` = Gegner. Gilt auch fuer den Fall ohne Eigenschaden —
//  Rueckstoss-Effekte koennen die eigene Seite dort ebenfalls leeren.
//
//  ── Flaechenschaden ──
//  Beide Treffer laufen ueber `ctx.aoeHit` (Als Regel 18.9.: jede Karte,
//  die 2+ Ziele treffen kann, muss als AoE erkennbar sein) mit Schadensart
//  `destruction_spell` — Interference, Ida & Co. greifen damit von selbst.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skull Carpet Bombing';
const SCHADEN = 100;
const ANIM = 'skull_carpet_bombing';
const hoptKey = (pi) => `skull_carpet_bombing:${pi}`;

/** Liegt dieses Exemplar seit diesem Zug in der Surprise Zone? */
function seitDiesemZug(engine, inst) {
  return !!inst && (inst.turnPlayed ?? -1) === (engine.gs.turn || 0);
}

/**
 * Faellt der LETZTE gegnerische Held? Dann gewinnt der Nutzer — auch wenn
 * die eigene Seite mitfaellt (Unentschieden-Regel). Gezaehlt werden alle
 * lebenden gegnerischen Helden; geschirmte stehen nicht in der Projektion
 * und ueberleben damit richtig.
 */
function gegnerFaellt(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const lebend = (engine.gs.players[oppIdx]?.heroes || []).filter(h => h?.name && h.hp > 0).length;
  if (lebend === 0) return false;
  const tot = engine.projectAoeTargets(pi, { side: 'enemy', types: ['hero'] })
    .filter(t => t.kind === 'hero' && t.hp > 0 && t.hp <= SCHADEN).length;
  return tot >= lebend;
}

/** Grober Wert eines Flaechentreffers fuer die CPU (Schaden + Toetungen). */
function trefferWert(engine, pi, seite) {
  let wert = 0, heldTot = 0;
  for (const t of engine.projectAoeTargets(pi, { side: seite, types: ['hero', 'creature'] })) {
    const hp = Math.max(0, t.hp || 0);
    wert += Math.min(SCHADEN, hp);
    if (hp > 0 && hp <= SCHADEN) {
      if (t.kind === 'hero') { wert += 250; heldTot++; } else wert += 40;
    }
  }
  return { wert, heldTot };
}

module.exports = {
  // Entkoppelte Bilder (v1182): laufen auch, wenn die Karte negiert wird.
  spellVisual: { impact: { type: ANIM }, impactMs: 450 },

  isSurprise: true,

  surpriseTurnEndTrigger(gs, ownerIdx, heroIdx, info /*, engine */) {
    if (info.endingPlayer !== ownerIdx) return false;                  // „at the end of YOUR turn"
    if (info.dealtDamageAnyTarget) return false;                        // „dealt no damage to any target"
    if (gs.hoptUsed?.[hoptKey(ownerIdx)] === gs.turn) return false;    // hart einmal pro Zug
    return true;
  },

  async onSurpriseActivate(ctx /*, sourceInfo */) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[hoptKey(pi)] = gs.turn;

    // Vor dem ersten Treffer festhalten — der Treffer selbst aendert nichts
    // am Eintrittszug, aber so steht die Bedingung sichtbar am Anfang.
    const auchEigene = seitDiesemZug(engine, ctx.card);

    const basis = {
      types: ['hero', 'creature'],
      damage: SCHADEN,
      damageType: 'destruction_spell',
      sourceName: CARD_NAME,
      animationType: ANIM,
      animDelay: 450,
    };

    const oppIdx = pi === 0 ? 1 : 0;
    const vorherDrawLoser = gs._drawLoserIdx;
    gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
    try {
      await ctx.aoeHit({ ...basis, side: auchEigene ? 'both' : 'enemy' });
    } finally {
      gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
    }
    // Jetzt EINMAL auswerten — bei beidseitiger Ausloeschung verliert der
    // Gegner (Als Vorgabe: der Nutzer gewinnt das Unentschieden).
    gs._drawLoserIdx = oppIdx;
    try {
      await engine.checkAllHeroesDead();
    } finally {
      if (vorherDrawLoser === 0 || vorherDrawLoser === 1) gs._drawLoserIdx = vorherDrawLoser;
      else delete gs._drawLoserIdx;
    }
    if (gs.result) { engine.sync(); return null; }   // Spiel entschieden

    engine.log('skull_carpet_bombing', {
      player: gs.players[pi]?.username,
      damage: SCHADEN,
      selfHit: auchEigene,
    });
    engine.sync();
    return null;   // negiert nichts
  },

  /**
   * CPU: die Engine lehnt abbrechbare Bestaetigungen ohne Kartenantwort ab.
   * Der Ausloeser feuert nur am Ende des EIGENEN Zuges — der Gefragte ist
   * also der aktive Spieler. Ohne Eigenschaden zuendet sie, sobald es ein
   * gegnerisches Ziel gibt (sonst wartet die Karte auf einen besseren Zug).
   * Faellt der letzte gegnerische Held, zuendet sie immer (Sieg, auch als
   * Unentschieden). Sonst mit Eigenschaden nur, wenn der Treffer beim
   * Gegner klar ueberwiegt und kein eigener Held dabei stirbt.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    const pi = engine.gs.activePlayer;
    const inst = engine.cardInstances.find(c => c.name === CARD_NAME
      && (c.controller ?? c.owner) === pi && c.heroIdx === promptData._hostHeroIdx
      && (c.zone === 'surprise' || c.faceDown));
    const gegner = trefferWert(engine, pi, 'enemy');
    if (gegner.wert <= 0) return { confirmed: false };
    if (gegnerFaellt(engine, pi)) return { confirmed: true };   // Sieg — auch als Unentschieden
    if (!seitDiesemZug(engine, inst)) return { confirmed: true };
    const eigen = trefferWert(engine, pi, 'own');
    if (eigen.heldTot > 0) return { confirmed: false };
    return { confirmed: gegner.wert > eigen.wert * 1.25 };
  },
};
