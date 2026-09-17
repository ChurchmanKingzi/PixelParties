// ═══════════════════════════════════════════
//  CARD EFFECT: „Armageddon"
//  Spell (Normal, Destruction Magic Lv3)
//
//  "Deal 50 damage to all targets, including the user. If all Heroes
//   are defeated after this Spell has resolved, the player controlling
//   the most Creatures wins the game. If this results in a draw, you
//   lose the game. You cannot deal any other damage to targets your
//   opponent controls this turn. Immediately end your turn afterwards."
//
//  ── ① „ALL TARGETS, INCLUDING THE USER" ──────────────────────────
//  Wirklich ALLES: beide Seiten, Helden UND Kreaturen, der eigene
//  Wirker eingeschlossen. Die Karte kennt keine Freunde.
//
//  Grundschaden 50, plus 100 je „Ifrit" auf dem Brett —
//  ★ ueber BEIDE Seiten gezaehlt („any player activates" steht auf
//  Ifrit, der Aufschlag gehoert also nicht einer Seite). Der Betrag
//  kommt aus Ifrits eigenem `armageddonBonus`, damit die Zahl an EINER
//  Stelle steht.
//
//  Ausgenommen sind nur, was sich ausdruecklich ausnimmt:
//    • Ifrit selbst (`immuneToSourceNames`, v1100),
//    • Damus, solange er mindestens eine Ifrit kontrolliert.
//
//  ── ② DIE SIEGBEDINGUNG GREIFT NUR BEI TOTALER AUSLOESCHUNG ──────
//  ★ Al 14.9. ausdruecklich: „Armageddons unique Zielbedingung ist nur
//  fuer wenn WIRKLICH ALLE sterben. Sind nur die Heroes EINES Spielers
//  tot, gewinnt ganz normal der andere."
//
//  Das ist der Fall, der beim Bauen schiefgeht: „if all Heroes are
//  defeated" heisst ALLE auf BEIDEN Seiten. Bleibt auch nur ein Held
//  stehen — typischerweise Damus hinter seiner Ifrit —, laeuft die
//  normale Niederlage-Regel, und die Karte sagt dazu nichts.
//
//  Bei totaler Ausloeschung entscheidet die Zahl der Kreaturen;
//  Gleichstand heisst ausdruecklich: DER WIRKER VERLIERT.
//
//  ── ③ „NO OTHER DAMAGE … THIS TURN" ──────────────────────────────
//  `ps.damageLocked`, gesetzt NACH dem eigenen Schlag
//  (Memory-Blast-Lehre, v1091) — sonst loeschte die Karte ihren eigenen
//  Schaden.
//
//  ── ④ „IMMEDIATELY END YOUR TURN" ────────────────────────────────
//  Zuletzt, und nur wenn das Spiel ueberhaupt weitergeht.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { IFRIT, ARMAGEDDON, ifritsOf, damusActive } = require('./_apocalypse-shared');

const CARD_NAME = ARMAGEDDON;
const GRUNDSCHADEN = 50;

/**
 * ★ Der Schadensaufschlag, an EINER Stelle.
 * Jede Ifrit auf dem Brett — egal wessen — bringt ihren eigenen Bonus
 * mit („any player activates").
 */
function schaden(engine) {
  let summe = GRUNDSCHADEN;
  for (let pi = 0; pi < 2; pi++) {
    for (const inst of ifritsOf(engine, pi)) {
      summe += loadCardEffect(inst.name)?.armageddonBonus || 0;
    }
  }
  return summe;
}

/** Ist dieser Held gegen Armageddon gefeit? */
/** Kreaturen, die `p` gerade kontrolliert. */
function zaehleKreaturen(engine, p) {
  // ★ GEZAEHLT WIRD AUS DEN ZONEN, nicht aus `cardInstances`.
  // Die Instanzliste wird waehrend eines Schadens-Batches neu
  // aufgebaut; eine Kreatur konnte dann noch `zone === 'support'`
  // tragen und trotzdem nicht mehr in der Liste stehen. Die Zaehlung
  // stand dadurch immer auf 0:0 — und weil Gleichstand „du verlierst"
  // heisst, verlor der Wirker jedes Mal. Die Zonen sind der
  // massgebliche Brettzustand.
  const ps = engine.gs.players[p];
  let n = 0;
  for (const zonen of (ps?.supportZones || [])) {
    for (const slot of (zonen || [])) {
      const name = (slot || [])[0];
      if (!name) continue;
      const cd = engine._getCardDB()[name] || {};
      if (cd.cardType === 'Creature' || cd.cardType === 'Token') n++;
    }
  }
  return n;
}

/**
 * ★ `getEffectiveCardData` liefert ein UEBERSCHREIBUNGS-Objekt, das
 * `cardType` nicht enthalten muss. Wer nur daraus liest, findet NIE
 * eine Kreatur — die Zaehlung stand dadurch immer auf 0:0 und der
 * Wirker verlor jedes Mal. Deshalb die Datenbank als Grundlage und die
 * Ueberschreibung nur obendrauf.
 */
function istKreatur(engine, inst) {
  const basis = engine._getCardDB()[inst.name] || {};
  const ueber = engine.getEffectiveCardData(inst) || {};
  const typ = ueber.cardType || basis.cardType || '';
  return typ === 'Creature' || typ === 'Token';
}

function heldGefeit(engine, pi, heroIdx) {
  const d = damusActive(engine, pi);
  if (!d || d.heroIdx !== heroIdx) return false;
  // „While you control at least 1 «Ifrit» Creature."
  return ifritsOf(engine, pi).length > 0;
}

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const dmg = schaden(engine);
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };

      // ── ① Alles einsammeln, BEVOR etwas faellt ───────────────────
      const helden = [];
      const kreaturen = [];
      for (let p = 0; p < 2; p++) {
        const sp = gs.players[p];
        for (let hi = 0; hi < (sp?.heroes || []).length; hi++) {
          const hero = sp.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (heldGefeit(engine, p, hi)) continue;     // Damus hinter Ifrit
          helden.push({ hero, p, hi });
        }
      }
      for (const inst of (engine.cardInstances || [])) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        if (!istKreatur(engine, inst)) continue;
        kreaturen.push(inst);
        // Ifrit selbst faengt der Schadensweg ab
        // (`immuneToSourceNames`) — hier nicht doppelt filtern, sonst
        // liefe die Regel an zwei Stellen auseinander.
      }

      // ★★ v1146 (Al 17.9.): eigene Animation — Feuerball vom Wirker,
      // der das ganze Brett einhuellt, Flammen und Feuerregen. Staerke
      // skaliert mit dem Schaden: 50 → Glimmen, ab 450 → volle Wucht.
      // Obere Ebene (kein `layer: 'background'`): das Feuer liegt UEBER
      // den Karten. Gewartet wird, bis die Welle das Brett erreicht hat.
      const staerke = Math.max(0.1, Math.min(1, dmg / 450));
      engine._broadcastEvent('play_zone_animation', {
        type: 'armageddon', power: staerke, damage: dmg,
        duration: Math.round(1800 + 1400 * staerke),
        zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1,
        originOwner: pi, originHeroIdx: ctx.cardHeroIdx,
      });
      await engine._delay(Math.round(650 + 450 * staerke));

      // ═══ ZWEI KLAMMERN UM DEN SCHLAG ════════════════════════════
      //
      // ★ (a) SPIELENDE-PRUEFUNG ANHALTEN (`_deferGameOverCheck`,
      // Bunny-Bombs-Vertrag). Trifft eine Karte das ganze Brett, darf
      // nicht der erste toedliche Treffer das Spiel entscheiden — sonst
      // haengt der Ausgang an der Reihenfolge, in der die Ziele
      // abgearbeitet werden. Genau darum geht es bei Armageddon.
      //
      // ★ (b) DEN VERLIERER EINES UNENTSCHIEDENS BENENNEN
      // (`_drawLoserIdx`). Die Engine kennt den Fall „beide Seiten
      // ausgeloescht" bereits und fragt diesen Hinweis. Armageddon setzt
      // ihn NICHT pauschal auf den Wirker, sondern nach der Kartenregel:
      // wer mehr Kreaturen kontrolliert, gewinnt — bei Gleichstand
      // verliert der Wirker.
      //
      // ★ (c) Ein einziger Flaechenschlag — AoE-Klammer (v1060).
      const zielzahl = helden.length + kreaturen.length;
      const vorherDrawLoser = gs._drawLoserIdx;
      gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
      // ★ GEZAEHLT WIRD HINTERHER — und zwar bewusst (Al 14.9.).
      //
      // Meine erste Fassung zog die Zaehlung VOR die Heldenschlaege, mit
      // der Begruendung, der Tod der letzten Heldenreihe raeume das
      // Brett mit ab. Das ist FALSCH: Kreaturen ueberleben den Tod ihres
      // Helden. Die leeren Zonen, die mich auf die Idee brachten, kamen
      // von einem eigenen Fehler in der Ifrit-Immunitaet.
      //
      // Und es ist nicht nur harmlos, sondern WICHTIG, hinterher zu
      // zaehlen: Armageddon toetet selbst Kreaturen. Wer vorher zaehlt,
      // zaehlt Kreaturen mit, die der Zauber gerade weggeraeumt hat —
      // „the player controlling the most Creatures" meint den Stand
      // NACH der Aufloesung.
      if (zielzahl >= 2) engine.beginMultiHit(zielzahl);
      try {
        for (const { hero } of helden) {
          if (hero.hp <= 0) continue;
          await engine.actionDealDamage(quelle, hero, dmg, 'destruction_spell');
        }
        for (const inst of kreaturen) {
          if (inst.zone !== 'support') continue;
          await engine.actionDealCreatureDamage(quelle, inst, dmg, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true });
        }
      } finally {
        if (zielzahl >= 2) engine.endMultiHit();
        gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
      }

      // ── Wer gewinnt, falls WIRKLICH alle Helden gefallen sind? ────
      // ★ Al 14.9.: die Sonderregel gilt NUR fuer die totale
      // Ausloeschung. Steht auch nur ein Held — typischerweise Damus
      // hinter seiner Ifrit —, entscheidet die normale Regel, und die
      // Engine kommt hier ohnehin nie in den Unentschieden-Zweig.
      const meine = zaehleKreaturen(engine, pi);
      const seine = zaehleKreaturen(engine, pi === 0 ? 1 : 0);
      const oppIdx = pi === 0 ? 1 : 0;
      // „the player controlling the MOST Creatures wins" / „if this
      // results in a DRAW, YOU lose" → bei Gleichstand ist der Wirker
      // der Verlierer.
      gs._drawLoserIdx = (meine > seine) ? oppIdx : pi;

      try {
        await engine.checkAllHeroesDead();
      } finally {
        if (vorherDrawLoser === 0 || vorherDrawLoser === 1) gs._drawLoserIdx = vorherDrawLoser;
        else delete gs._drawLoserIdx;
      }
      if (gs.result) { engine.sync(); return; }   // Spiel ist entschieden

      // ── ③ Keine weitere Schadensquelle diese Runde ───────────────
      ps.damageLocked = true;
      engine.log('armageddon', {
        player: ps.username, damage: dmg, targets: zielzahl,
        eigeneKreaturen: meine, fremdeKreaturen: seine,
      });
      engine.log('damage_locked', { player: ps.username, by: CARD_NAME });

      // ── ④ „Immediately end your turn afterwards." ────────────────
      // ★ `_terrorForceEndTurn` ist der kanonische Hebel der Engine,
      // einen Zug in die End Phase zu zwingen — trotz des Namens nicht
      // Terror-spezifisch, sondern der einzige vorhandene Weg.
      gs._terrorForceEndTurn = pi;
      gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
      engine.sync();
    },
  },
};
