// ═══════════════════════════════════════════
//  CARD EFFECT: "Energy Aura"
//  Spell (Support Magic Lv 1, Attachment)
//
//  "Attach this card to a Hero you control.
//   Negate the next time the Hero this card is
//   attached to would be affected by a Spell, and
//   if you do, send this attached card to your
//   discard pile and draw 2 cards. A Hero can
//   only have 1 "Energy Aura" attached to it at a
//   time."
//
//  ── WO DIE ARBEIT WIRKLICH STECKT ─────────────
//  Fast nichts davon steht in dieser Datei. „Von
//  einem Spell betroffen" hat FUENF Wege durch die
//  Engine — Schaden, Heilung, Buff, Status und
//  Niederlage —, und die belegt der gemeinsame
//  Riegel `heroSpellWardBlocks` (siehe _engine.js).
//  Diese Karte meldet sich dort mit einem Flag an
//  und kuemmert sich nur noch um zwei Dinge:
//  anlegen und, nach der Aufloesung, abraeumen.
//
//  ── ALS RULINGS (14.9.) ───────────────────────
//  • KEINE Stufenschranke, anders als Anti Magic.
//  • Auch EIGENE Spells loesen aus — die Aura kann
//    ausdruecklich vor einem eigenen „Cataclysm"
//    schuetzen.
//  • Die Einschraenkung ist, dass es immer der
//    NAECHSTE Spell ist: man hat keine Wahl, ob
//    man sie verbraucht oder aufspart.
//  • Der Spell selbst wird NICHT negiert; der Held
//    gilt weiter als getroffen — wie bei
//    „Interference" Stufe 2.
//  • Bei Flaechenzaubern faellt nur die Wirkung an
//    GENAU diesem Helden aus, nicht die an den
//    anderen.
//  • PIERCING (`cannotBeNegated`, Idas Destruction-
//    Spells) geht durch UND loest nicht aus: die
//    Aura bleibt liegen und gewaehrt keine Karten.
//  • „Affect" meint, was den Helden SELBST trifft.
//    Wird er nur anvisiert, um „the Creatures in
//    that Hero's Support Zones" zu treffen, zaehlt
//    das nicht — solche Effekte laufen gar nicht
//    durch die fuenf Wege, die Regel ergibt sich
//    also von allein.
//
//  ── ABRAEUMEN NACH DER AUFLOESUNG ──────────────
//  Al hat ausdruecklich freigegeben, die Karte
//  erst NACH dem Spell zu entfernen — und genau
//  das ist auch die einzige Fassung, die
//  funktioniert: waere sie sofort weg, kaeme der
//  ZWEITE Effekt desselben Zaubers (Schaden plus
//  Status) ungebremst durch. Der Riegel blockt
//  deshalb weiter, solange derselbe Spell laeuft;
//  abgeraeumt wird hier.
//
//  Drei Zeitpunkte, weil `afterSpellResolved`
//  NICHT feuert, wenn der Spell unterwegs negiert
//  wird (dann traegt `gs._spellNegatedByEffect`).
//  Ohne die beiden Rundenwechsel-Haken bliebe eine
//  Aura in genau diesem Fall als verbrauchte
//  Karteileiche liegen.
// ═══════════════════════════════════════════

const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');

const CARD_NAME = 'Energy Aura';

/** Traegt dieser Held bereits eine „Energy Aura"? */
function hatBereitsAura(gs, side, heroIdx) {
  const zonen = gs.players?.[side]?.supportZones?.[heroIdx] || [];
  for (const slot of zonen) {
    if ((slot || []).includes(CARD_NAME)) return true;
  }
  return false;
}

/**
 * „A Hero can only have 1 Energy Aura attached to it at a time."
 * EIN Filter fuer beide Verbraucher: die Zielliste des Pickers und die
 * Empfaengerzonen fuers Ziehen. Zwei getrennte Fassungen waeren genau
 * die Sorte Dublette, bei der das Brett eine Zone hervorhebt, die der
 * Picker dann ablehnt.
 */
function hostOpts() {
  return { heroFilter: (hero, hi, side, engine) => !hatBereitsAura(engine.gs, side, hi) };
}

/** Die eigene Instanz in der Support Zone, oder null. */
function eigeneInstanz(engine, ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return null;
  return inst;
}

/**
 * Verbrauchte Aura abraeumen: in die Ablage, dann 2 Karten ziehen.
 *
 * Idempotent ueber `_wardSettled` — die drei Aufrufzeitpunkte koennen
 * sich ueberschneiden (ein Spell kann am Rundenende aufloesen), und ein
 * doppelter Durchlauf wuerde 4 Karten ziehen.
 */
async function raeumeAb(engine, inst) {
  if (!inst || inst.zone !== 'support') return;
  if (!inst.counters?._wardSpentOn) return;
  if (inst.counters._wardSettled) return;
  inst.counters._wardSettled = true;

  const owner = inst.controller ?? inst.owner;
  const ps = engine.gs.players[owner];
  engine.log('energy_aura_spent', {
    player: ps?.username, spell: inst.counters._wardSpentOn,
  });
  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
  // Standardweg in die Ablage — er feuert `onCardLeaveZone`, traegt die
  // Zone aus und legt die Karte beim URSPRUENGLICHEN Besitzer ab.
  await engine.actionMoveCard(inst, 'discard');
  // „draw 2 cards" — der Zug gehoert dem Kontrolleur der Aura, nicht
  // dem Wirker des Zaubers.
  await engine.actionDrawCards(owner, 2, { source: CARD_NAME });
  engine.sync();
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'gold_sparkle' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Fuer das Blinded-Gate: der Spell oeffnet eine Heldenwahl.
  activeIn: ['hand', 'support'],

  // ★ Der Engine-Vertrag. Alles Weitere macht `heroSpellWardBlocks`.
  heroSpellWard: true,

  spellPlayCondition(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, hostOpts()).length > 0;
  },
  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, hostOpts());
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;

      const res = await attachToHero(ctx, CARD_NAME, {
        ...hostOpts(),
        preferCaster: true,
        description: 'Choose a Hero you control to attach Energy Aura to.',
        confirmLabel: '✨ Attach!',
      });
      if (!res) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: ctx.cardOwner,
        heroIdx: res.host.heroIdx, zoneSlot: -1,
      });
      engine.log('energy_aura_attached', {
        player: engine.gs.players[ctx.cardOwner]?.username,
        hero: engine.gs.players[res.host.owner]?.heroes?.[res.host.heroIdx]?.name,
      });
      engine.sync();
    },

    // Normalfall: der Spell ist durch, die Aura geht.
    afterSpellResolved: async (ctx) => {
      const inst = eigeneInstanz(ctx._engine, ctx);
      if (!inst) return;
      await raeumeAb(ctx._engine, inst);
    },

    // Rueckfall fuer negierte Zauber (dort feuert `afterSpellResolved`
    // nie). Beide Rundenwechsel, damit es hoechstens einen halben Zug
    // dauert.
    onTurnEnd: async (ctx) => {
      const inst = eigeneInstanz(ctx._engine, ctx);
      if (!inst) return;
      await raeumeAb(ctx._engine, inst);
    },
    onTurnStart: async (ctx) => {
      const inst = eigeneInstanz(ctx._engine, ctx);
      if (!inst) return;
      await raeumeAb(ctx._engine, inst);
    },
  },
};
