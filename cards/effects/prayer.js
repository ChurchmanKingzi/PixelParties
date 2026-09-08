// ═══════════════════════════════════════════
//  CARD EFFECT: "Prayer"
//  Spell (Attachment, Lv0, Support Magic)
//
//  „Attach this card to the user. You may once per turn discard any
//   number of Abilities from your hand to draw the same number of
//   cards. You may draw 1 extra card afterwards, but if you do, you
//   cannot draw cards for the rest of the turn afterwards."
//
//  KEINE neue Kartenklasse noetig (Al fragte 6.9.): der Engine-Vertrag
//  `equipEffect` ist „Karte in einer Support Zone mit Klick-Effekt" —
//  er fragt nicht nach `isEquip`, sondern scannt die Support Zones
//  (Crimson Web, ein Surprise-Spell, laeuft genauso). Attachments
//  liegen dort. Damit:
//    • Anlegen: `attachToHero` aus `_attachment-shared` (MANDATORY),
//      nur an den Caster („the user"): `heroFilter` = Caster-Index,
//      `preferCaster` fuer die Automatik.
//    • Klick: `equipEffect: true` + `onEquipEffect(ctx)`; die Engine
//      haelt die weiche Einmal-je-Zug-Sperre (`equip-effect:<instId>`)
//      und den Status-Filter des Wirts.
//    • Effekt: `handPick` ueber die Abilities der Hand (min 0, „any
//      number"), Abwurf je Karte ueber `actionDiscardHandCard`, dann
//      `actionDrawCards(n)`; danach Nachfrage „1 extra card?" → ziehen
//      und `ps.drawLocked = true` (reiner Zieh-Lock, faellt am Zugende
//      wie bei The Sacred Jewel). Ist der Zieh-Lock schon gesetzt,
//      entfaellt die Nachfrage.
//  Rueckgabe false = Sperre nicht verbraucht (Abbruch im Picker).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const deckProfile = require('./_deck-profile');

const CARD_NAME = 'Prayer';

function abilityIndices(engine, ps) {
  const db = engine._getCardDB();
  const out = [];
  (ps?.hand || []).forEach((name, i) => {
    const cd = db[name];
    if (cd && hasCardType(cd, 'Ability')) out.push(i);
  });
  return out;
}

module.exports = {
  activeIn: ['hand', 'support'],
  equipEffect: true,

  // Drop-Hervorhebung beim Ziehen: jeder eigene Held mit freier Zone —
  // WER castet, steht beim Ziehen noch nicht fest. Gebunden wird erst
  // in `onPlay`: `heroFilter` = Caster, ein Drop-Hinweis auf einen
  // anderen Helden verfaellt dort (der Hinweis muss in der gefilterten
  // Wirt-Liste liegen), `preferCaster` legt automatisch an.
  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, {});
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const casterHeroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      const res = await attachToHero(ctx, CARD_NAME, {
        heroFilter: (h, hi) => hi === casterHeroIdx, preferCaster: true,
        description: `Attach ${CARD_NAME} to ${ps.heroes?.[casterHeroIdx]?.name || 'the user'} — pick one of its empty Support Zones.`,
        confirmLabel: '🙏 Attach!', animationType: 'equip_flash',
      });
      if (!res) return;
      engine.log('prayer_attached', {
        player: ps.username, hero: ps.heroes?.[res.host.heroIdx]?.name, heroIdx: res.host.heroIdx, zoneSlot: res.host.slotIdx,
      });
    },
  },

  /** Klickbar, wenn es etwas zu tun gibt: eine Ability auf der Hand
   *  ODER (Deck nicht leer und Zieh-Lock nicht gesetzt) fuer die Extra-Karte. */
  canActivateEquipEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    const pi = inst?.controller ?? inst?.owner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    if (abilityIndices(engine, ps).length > 0) return true;
    return !ps.drawLocked && !ps.handLocked && (ps.mainDeck || []).length > 0;
  },

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // 1) Abilities aus der Hand abwerfen — „any number", auch 0.
    const eligible = abilityIndices(engine, ps);
    let picked = [];
    if (eligible.length > 0) {
      const res = await engine.promptGeneric(pi, {
        type: 'handPick',
        title: CARD_NAME,
        description: 'Click Abilities in your hand to discard them — you draw 1 card for each. Confirm with none to skip to the extra card.',
        showCard: CARD_NAME,
        eligibleIndices: eligible,
        minSelect: 0,
        maxSelect: eligible.length,
        cancellable: true,
        confirmLabel: '🙏 Pray',
      });
      if (!res || res.cancelled) return false;              // Sperre nicht verbraucht
      picked = (res.selectedCards || []).slice().sort((a, b) => b.handIndex - a.handIndex);
    }
    for (const c of picked) {
      await engine.actionDiscardHandCard(pi, c.cardName, c.handIndex, { source: CARD_NAME, selfInflicted: true });
    }
    let drawn = 0;
    if (picked.length > 0) {
      const got = await engine.actionDrawCards(pi, picked.length, { source: CARD_NAME });
      drawn = Array.isArray(got) ? got.length : picked.length;
    }
    engine.log('prayer_exchange', { player: ps.username, discarded: picked.length, drawn });
    engine.sync();

    // 2) „You may draw 1 extra card afterwards, but if you do, you
    //    cannot draw cards for the rest of the turn."
    if (!ps.drawLocked && !ps.handLocked && (ps.mainDeck || []).length > 0) {
      const extra = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: 'Draw 1 extra card? You cannot draw any more cards this turn afterwards.',
        showCard: CARD_NAME,
        confirmLabel: '🃏 Draw 1',
        cancelLabel: 'No',
        cancellable: true,
        _ownerIdx: pi,
      });
      if (extra && !extra.cancelled && extra.confirmed !== false) {
        const got = await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
        ps.drawLocked = true;
        engine.log('prayer_extra_draw', { player: ps.username, drawn: Array.isArray(got) ? got.length : 1 });
        engine.sync();
      }
    }
    return true;
  },

  /**
   * CPU: alle Abilities abwerfen, die der Held nicht mehr anlegen kann
   * (kein freier Ability-Slot fuer ihre Schule) — sonst keine; die
   * Extra-Karte nur, wenn spaeter im Zug kein Ziehen mehr zu erwarten
   * ist (Main Phase 2). Puzzle: Engine-Standard (alles, ja).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || engine.isPuzzle) return undefined;
    if ((promptData?._gerryOriginalTitle || promptData?.title) !== CARD_NAME) return undefined;
    if (promptData.type === 'handPick') {
      const pi = engine._cpuPlayerIdx;
      const ps = engine.gs.players[pi];
      const idx = (promptData.eligibleIndices || []).filter(i => {
        const name = ps?.hand?.[i];
        // Behalten, wenn irgendein eigener Held diese Ability noch anlegen koennte.
        return !(ps?.heroes || []).some((h, hi) => h?.name && h.hp > 0
          && (ps.abilityZones?.[hi] || []).some(slot => slot.length === 0 || slot[0] === name));
      });
      return { selectedCards: idx.map(i => ({ handIndex: i, cardName: ps.hand[i] })) };
    }
    if (promptData.type === 'confirm') {
      // Extra-Karte: Zieh-Kanal (Mill-Schutz / gelernte Regel), und nur
      // in Main Phase 2, wenn kein weiteres Ziehen im Zug zu erwarten ist.
      const pi = Number.isInteger(promptData._ownerIdx) ? promptData._ownerIdx : engine._cpuPlayerIdx;
      if (engine.gs.currentPhase !== 4) return null;
      return deckProfile.optionalDrawChoice(engine, pi, CARD_NAME, 1) ? { confirmed: true } : null;
    }
    return undefined;
  },
};
