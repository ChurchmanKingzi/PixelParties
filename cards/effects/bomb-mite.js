// ═══════════════════════════════════════════
//  CARD EFFECT: „Bomb Mite"
//  Creature (Summoning Magic Lv 0, 1 HP, PP CROSS, Diamond Rare)
//
//  „When you control this Creature at the end of your next turn after
//   summoning it, send it to the discard pile and deal 100 damage to
//   all Heroes your opponent controls. If this Creature is defeated by
//   an opponent's card or effect, deal 100 damage to all Heroes you
//   control."
//
//  (Zuendschaden von 150 auf 100 gesenkt — Als Vorgabe 12.9.)
//
//  BAUART
//  ──────
//  • ★ „AT THE END OF YOUR NEXT TURN AFTER SUMMONING IT" — das ist das
//    ZWEITE Zugende des Legers, nicht das erste. Beschworen in Zug T
//    (`inst.turnPlayed`), zuendet sie am Ende von Zug T+2, denn
//    dazwischen liegt der gegnerische Zug. Geprueft wird deshalb
//    `ctx.isMyTurn && gs.turn > inst.turnPlayed` — am eigenen Zugende
//    ist das erst beim NAECHSTEN eigenen Zug wahr.
//
//  • „when you CONTROL this Creature": der Kontrolleur muss der Leger
//    sein. Wurde sie zwischendurch uebernommen (Dark Gear, Diplomacy),
//    zuendet sie NICHT beim urspruenglichen Besitzer — sondern am
//    Zugende dessen, der sie jetzt hat, gegen DESSEN Gegner. Genau das
//    macht `ctx.cardOwner`/`ctx.isMyTurn` von selbst richtig, weil die
//    Engine die Hooks am Kontrolleur ausrichtet.
//
//  • ★ DER RUECKSCHLAG BRAUCHT EINEN FREMDEN TAETER: `ctx.source` des
//    Todes-Hooks traegt die toetende Karte. Ohne Quelle (Zustands-Tod,
//    Selbstopfer) und bei eigener Quelle passiert NICHTS — „by an
//    OPPONENT's card or effect". Wer das weglaesst, sprengt sich beim
//    eigenen Opferritual selbst die Helden weg.
//
//  • Beide Zweige treffen nur HELDEN, nicht Kreaturen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Bomb Mite';
const SCHADEN_GEGNER = 100;   // v1014: war 150
const SCHADEN_EIGEN  = 100;

/** Alle lebenden Helden einer Seite. */
function helden(engine, seite) {
  const out = [];
  const liste = engine.gs.players[seite]?.heroes || [];
  for (let hi = 0; hi < liste.length; hi++) {
    const h = liste[hi];
    if (h?.name && h.hp > 0) out.push({ heroIdx: hi, hero: h });
  }
  return out;
}

/** Explosion auf einer Seite: Animation, dann Schaden Held fuer Held. */
async function explodiere(engine, quelle, seite, betrag) {
  const ziele = helden(engine, seite);
  if (ziele.length === 0) return 0;
  for (const z of ziele) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: seite, heroIdx: z.heroIdx, zoneSlot: -1,
    });
  }
  await engine._delay(420);
  // ★ v1043 („Interference"): EIN Schlag auf mehrere Ziele —
  // gezaehlt wird, was WIRKLICH getroffen wird.
  let getroffen = 0;
  // ★ v1392: über die EINE Stelle für Mehrfachtreffer.
  const lebend = ziele.filter(z => { const h = engine.gs.players[seite]?.heroes?.[z.heroIdx]; return h?.name && h.hp > 0; });
  await engine.dealDamageToTargets(quelle, lebend.map(z => ({ type: 'hero', owner: seite, heroIdx: z.heroIdx })), {
    damage: betrag, damageType: 'creature', hitDelay: 0, surpriseCheck: false, postTargetCheck: false,
  });
  getroffen = lebend.length;
  engine.sync();
  return getroffen;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'explosion' }, impactMs: 260,
  },

  creatureEffect: true,

  hooks: {
    /**
     * ★ Der Zuender. Siehe Kopf: erst am ZWEITEN eigenen Zugende.
     */
    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;                       // = Kontrolleur
      if ((inst.controller ?? inst.owner) !== pi) return;
      if ((gs.turn || 0) <= (inst.turnPlayed || 0)) return;   // ★ nicht im Legezug
      if (inst.counters?._bombMiteFired) return;
      inst.counters = inst.counters || {};
      inst.counters._bombMiteFired = true;

      const oi = pi === 0 ? 1 : 0;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ── Erst in die Ablage, dann zuenden ────────────────────────
      // Reihenfolge nach dem Text: „send it to the discard pile AND
      // deal …". So kann die Zuendung die Mite nicht noch einmal
      // ueber ihren eigenen Todeszweig erwischen.
      inst.counters._bombMiteSelfSend = true;         // kein Rueckschlag
      await engine.actionMoveCard(inst, 'discard', { source: CARD_NAME, sourceOwner: pi });

      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: inst.heroIdx };
      const getroffen = await explodiere(engine, quelle, oi, SCHADEN_GEGNER);
      engine.log('bomb_mite_detonate', {
        player: gs.players[pi]?.username, targets: getroffen, damage: SCHADEN_GEGNER,
      });
    },

    /**
     * ★ Der Rueckschlag — nur bei einem FREMDEN Taeter (s. Kopf).
     */
    onCreatureDeath: async (ctx) => {
      const tod = ctx.creature;
      if (!tod || tod.instId !== ctx.card?.id) return;         // nur diese Mite
      const inst = ctx.card;
      if (inst.counters?._bombMiteSelfSend) return;            // eigene Zuendung
      if (inst.counters?._bombMiteBackfired) return;
      const engine = ctx._engine;
      const pi = inst.controller ?? inst.owner;
      const oi = pi === 0 ? 1 : 0;

      // „by an OPPONENT's card or effect": ohne Quelle oder mit eigener
      // Quelle passiert nichts.
      const q = ctx.source;
      const taeter = q ? (q.owner ?? q.controller) : null;
      if (taeter == null || taeter !== oi) return;

      inst.counters = inst.counters || {};
      inst.counters._bombMiteBackfired = true;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: inst.heroIdx };
      const getroffen = await explodiere(engine, quelle, pi, SCHADEN_EIGEN);
      engine.log('bomb_mite_backfire', {
        player: engine.gs.players[pi]?.username, targets: getroffen, damage: SCHADEN_EIGEN,
      });
    },
  },
};
