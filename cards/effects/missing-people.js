// ═══════════════════════════════════════════
//  CARD EFFECT: „Missing People"
//  Spell (Decay Magic Lv0, Normal)
//
//  „Choose a Creature your opponent controls and place it at the bottom
//   of their deck. If your opponent has discarded 1 or more cards since
//   the beginning of the turn, this counts as an additional Action."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  · „a Creature your opponent controls" geht nach KONTROLLE: eine
//    geklaute Creature in der Gegnerreihe zaehlt, eine eigene, die dort
//    steht, nicht.
//  · „at the bottom of THEIR deck" — das Deck des BESITZERS, nicht des
//    Kontrolleurs. Eine geklaute Karte findet so nach Hause.
//  · Der Zusatzaktions-Teil haengt an einer Tatsache des Spielstands:
//    hat der Gegner in DIESEM Zug abgeworfen? Die Engine stempelt das
//    seit v897 an der einen Stelle, durch die jeder Abwurf laeuft.
//    `inherentAction` wird VOR dem Spielen gefragt — der Stempel muss
//    also schon stehen, was er tut, sobald irgendein Abwurf lief.
//
//  ── ENTFERNEN VOM BRETT ───────────────────────────────────────────
//  Das ist ein FREMDER Zugriff auf eine gegnerische Support Zone.
//  „Defending the Gate" schuetzt davor und wird deshalb ausdruecklich
//  gefragt (`_isGateShielded`), bevor irgendetwas passiert — die Regel
//  zu Support-Zonen-Effekten verlangt das von jeder Karte, die dort
//  etwas wegnimmt. Eine fertige „Brett → Deck"-Primitive gibt es nicht
//  (`actionMoveCard` kennt kein Deck-Ziel), deshalb derselbe Ablauf wie
//  bei Divine Gift of Forgetting: Flug ansagen, `onCardLeaveZone`
//  feuern, Zone leeren, Namen ins Deck, Instanz abmelden.
//
//  ── ANIMATION (Als Vorgabe 11.9.) ─────────────────────────────────
//  Die Zielkreatur wird transparent — dieselbe Blende wie bei
//  Teleportation Powder (`zone_fade`, generisch fuer Zonen). Geblendet
//  wird die KARTE in der Zone, nicht die Zone selbst; die Blende laeuft
//  VOR dem Entfernen, sonst ist nichts mehr da, was verblassen koennte.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Missing People';
const BLENDE_MS = 700;
const KLANG_WEG = { name: 'elem_wind', rate: 0.85, volume: 1.1 };

/** Hat `pi` in diesem Zug abgeworfen? (Engine-Stempel, v897) */
function hatAbgeworfen(gs, pi) {
  return (gs._discardedOnTurn || {})[pi] === gs.turn;
}

/** Alle Creatures, die der Gegner KONTROLLIERT. */
function gegnerCreatures(engine, pi) {
  const oi = pi === 0 ? 1 : 0;
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== oi) continue;
    if (inst.counters?.treatAsEquip) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['hand'],
  requiresTarget: true,
  // ^ Tagged for Blinded gating — siehe cards/effects/_hooks.js.

  /** „this counts as an additional Action" — nur mit Gegner-Abwurf. */
  inherentAction: (gs, playerIdx) => hatAbgeworfen(gs, playerIdx === 0 ? 1 : 0),

  spellPlayCondition(gs, playerIdx, engine) {
    if (!engine) return true;
    const oi = playerIdx === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    return gegnerCreatures(engine, playerIdx).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      if (gs.firstTurnProtectedPlayer === oi) return;

      const kandidaten = gegnerCreatures(engine, pi);
      if (kandidaten.length === 0) return;

      // Zielwahl ueber den Standard-Trichter: er kennt Untargetable,
      // Taunt, Stealth und jeden `blocksTargeting`-Vertrag.
      const ziel = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['creature'],
        title: CARD_NAME,
        description: "Choose a Creature your opponent controls — it goes to the bottom of its owner's deck.",
        confirmLabel: '🕳️ Vanish',
        confirmClass: 'btn-info',
        dealsDamage: false,
        cancellable: true,
      });
      if (!ziel || ziel.type !== 'equip') return;

      const inst = ziel.cardInstance || engine.cardInstances.find(c =>
        c.zone === 'support' && c.heroIdx === ziel.heroIdx && c.zoneSlot === ziel.slotIdx
        && (c.controller ?? c.owner) === ziel.owner);
      if (!inst) return;

      // „Defending the Gate" schuetzt die Support Zones des Gegners.
      if (engine._isGateShielded(inst.controller ?? inst.owner)) {
        engine.log('destroy_blocked', { card: inst.name, reason: 'Defending the Gate' });
        return;
      }

      // ── Blende: die KARTE wird transparent (Als Vorgabe) ──────────
      engine._broadcastEvent('zone_fade', {
        owner: ziel.owner, durationMs: BLENDE_MS, direction: 'out',
        sfx: KLANG_WEG,
        zones: [{ kind: 'support', heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot }],
      });
      await engine._delay(BLENDE_MS);

      // ── Ans Deckende — ins Deck des BESITZERS ─────────────────────
      const besitzer = inst.owner;                 // „their deck"
      const seite = inst.controller ?? inst.owner;  // wo die Karte liegt
      const bPs = gs.players[besitzer];
      const sPs = gs.players[seite];

      engine._broadcastEvent('play_pile_transfer', {
        owner: seite, toOwner: besitzer, cardName: inst.name,
        from: 'support', to: 'deck',
        fromHeroIdx: inst.heroIdx, fromSlotIdx: inst.zoneSlot,
      });

      await engine.runHooks('onCardLeaveZone', {
        _onlyCard: inst,
        card: inst, leavingCard: inst,
        fromZone: 'support', fromOwner: seite,
        fromHeroIdx: inst.heroIdx, fromZoneSlot: inst.zoneSlot,
        toZone: 'deck',
        _skipReactionCheck: true,
      });

      const slot = sPs?.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
      if (Array.isArray(slot)) {
        const idx = slot.indexOf(inst.name);
        if (idx >= 0) slot.splice(idx, 1);
      }
      // ANS ENDE — „at the bottom of their deck".
      bPs.mainDeck.push(inst.name);
      engine._untrackCard(inst.id);

      engine.log('missing_people', {
        player: gs.players[pi]?.username,
        creature: inst.name,
        owner: gs.players[inst.owner]?.username,
        freeAction: hatAbgeworfen(gs, oi),
      });
      engine.sync();
    },
  },
};
