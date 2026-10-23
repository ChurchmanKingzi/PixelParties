// ═══════════════════════════════════════════
//  CARD EFFECT: "Card Game Player Inya"
//  Hero — 400 HP, 20 ATK (Creativity + Friendship)
//
//  ① Whenever Inya casts a Spell DURING HER
//    CONTROLLER'S TURN that would head to the
//    discard pile after resolving, the controller
//    may instead summon it into one of Inya's
//    free Support Zones as a "Fantasy Buddy
//    Token" with 10 HP.
//
//    Eligibility (★ W67a, Al 23.10.2026: JEDER Spell-Subtyp —
//    Normal, Surprise, Reaction, Counter … — sofern es der Zug des
//    Inya-Spielers ist):
//     • Inya is the user of the Spell (Handspiel, Sofort-Guss,
//       Kettenglied, aktivierte Surprise, Hand-Reaktion).
//     • `gs.activePlayer === cardOwner` (eigener Zug).
//     • Die Karte würde nach dem Auflösen in die ABLAGE gehen
//       (`ticket.ablageErwartet()`): Areas, Attachments, Permanents
//       (Teleportal), Glass Wall / offen liegende Surprises,
//       „Delete this card" und „zurück auf die Hand" sind ausgenommen.
//     • Inya needs at least one free base Support Zone slot
//       (Alice: Zone eines gleichnamigen Buddys zählt).
//
//    Implementation: place a fresh Token inst in
//    Inya's free Support Zone via
//    `engine.safePlaceInSupport`, override its
//    card data + HP via `_cardDataOverride`, and
//    flag it with `_fantasyBuddyToken` so the
//    damage-shield count finds it. Der Auflösungsweg
//    reicht im Hook-Kontext ein TICKET (`_buddy`, siehe
//    `engine.neuesBuddyTicket`): Inya trägt den Token
//    dort ein (`ticket.token`), nimmt die Karte ggf. aus
//    der Ablage (`ticket.nimm()`, Hand-Reaktionen), und der
//    Weg legt sie danach NICHT zusätzlich ab — genau EINE
//    Platzierung, keine Marken im Spielstand.
//
//    Same Token-creation pattern Biomancy Token
//    uses — keeps the spell's card image while
//    the tooltip / cardType reads as a Token.
//
//  ② While the controller has 1+ Fantasy Buddy
//    Tokens on the board, Inya takes no damage.
//    Hooked via beforeDamage: target=Inya AND
//    any live Buddy → setAmount(0).
//
//  ★ W7a (H01-heroes-20, Al 14.10.2026: „Freeze, Stun
//  und Negated unterbrechen alle laufenden passiven
//  Effekte"): KEIN `bypassStatusFilter` mehr — der
//  Schadensschild ist ein laufender Schutz und ruht
//  wie der Buddy-Effekt bei Frost, Betäubung und
//  Negation. (Vorher hielt das Flag den Schild.)
// ═══════════════════════════════════════════

const CARD_NAME = 'Card Game Player Inya';
const TOKEN_HP = 10;

/**
 * Count the Fantasy Buddy Tokens currently controlled by `pi`. A Buddy
 * is any cardInstance in zone='support' belonging to `pi` with the
 * `_fantasyBuddyToken` marker counter set and currentHp > 0.
 */
function _countBuddies(engine, pi) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (!inst.counters?._fantasyBuddyToken) continue;
    const hp = inst.counters?.currentHp ?? inst.counters?._cardDataOverride?.hp ?? 0;
    if (hp <= 0) continue;
    n++;
  }
  return n;
}

module.exports = {
  /**
   * CPU-Antwort auf die "Buddy beschwoeren?"-Abfrage.
   *
   * WARUM NOETIG (Als Befund 5.8.: "Inya beschwoert bei der CPU nicht"):
   * Der heuristische Standard fuer ABBRECHBARE confirm-Abfragen ist
   * ABLEHNEN (`_cpu.js`: "Confirm-cancellable default: decline"). Die
   * MCTS-Kandidatenliste bietet zwar zusaetzlich "confirm" an — waehrend
   * einer Reaktionskette und im Puzzle laeuft aber kein MCTS, also greift
   * der Standard und Inya lehnte immer ab.
   *
   * Als Vorgabe: "Sie SOLLTE immer beschwoeren, wenn sie kann." Der
   * Hook wird nur erreicht, wenn `onSpellDiscard` die Vorbedingungen
   * schon geprueft hat (freie Support-Zone vorhanden), ein Ja ist hier
   * also immer ausfuehrbar.
   *
   * Der GLOBALE Standard bleibt bewusst unangetastet — er ist fuer
   * "may"-Abfragen richtig, deren Nutzen nicht feststeht.
   */
  cpuResponse(engine, promptType, promptData) {
    if (promptType !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    return { confirmed: true };
  },

  activeIn: ['hero'],

  hooks: {
    /**
     * Spell-cast trigger — fires after the spell's effect has resolved
     * (and after any chain resolution wraps up). Gates on:
     *   • Inya is the caster (cardHeroIdx + cardOwner match).
     *   • It IS Inya's controller's turn.
     *   • Spell did NOT self-place on the board (no Areas /
     *     Attachments).
     *   • Inya has at least one free base Support Zone slot.
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;

      // ★ W67a (Al, 23.10.2026: „JEDER Subtyp von Spell" — Normal, Surprise, Reaction, Counter …, sofern es der Zug des Inya-Spielers ist und die Karte nach ihrem
      // Effekt nicht auf dem Board bleibt): jeder Weg, der einen Spell-Kartenabschluss meldet, trägt ein Ticket (`engine.neuesBuddyTicket`). Ohne Ticket
      // (Skripte, die `afterSpellResolved` für Effekte melden, die keine Karte ablegen) gibt es nichts zu ersetzen. W66a hatte Inya auf drei Wege beschränkt,
      // weil die Marken im Spielstand (`_spellPlacedOnBoard`/`_spellBecameToken`) in den übrigen stehenblieben; das Ticket lebt nur für diesen Aufruf.
      const ticket = ctx._buddy;
      if (!ticket || ticket.token) return;

      // Caster must be THIS Inya.
      if (ctx.casterIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden —
      // `heroOwner` (falls gemeldet) = Reihe, in die `heroIdx` zeigt.
      const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
      if (ctx.heroOwner != null && ctx.heroOwner !== feld) return;
      // Must be Inya's controller's turn — excludes opp-turn reactions
      // / surprises Inya casts.
      if (gs.activePlayer !== ctx.cardOwner) return;
      // Defensive: only Spell-type cards. afterSpellResolved fires
      // only for Spells in practice but check the field on hookCtx.
      if (ctx.spellCardData?.cardType !== 'Spell') return;
      // Die Karte würde nach dem Auflösen NICHT in die Ablage gehen (Area/Attachment/Permanent legen sich selbst aufs Brett, Glass Wall bleibt offen liegen,
      // „Delete this card", zurück auf die Hand): nicht berechtigt. Jeder Weg beantwortet das für sich (`ticket.ablageErwartet`).
      if (!ticket.ablageErwartet()) return;

      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      // Must have a free base support zone on Inya.
      // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden
      const supZones = gs.players[feld]?.supportZones?.[heroIdx] || [];
      const spellName = ctx.spellName;
      let hasFree = false;
      for (let z = 0; z < 3; z++) {
        if ((supZones[z] || []).length === 0) { hasFree = true; break; }
      }
      // W64a (Al, 23.10.2026: Creature-Tokens teilen bei aktiver Alice): auch die Zone eines Buddys GLEICHEN Namens (derselbe Zauber) zaehlt als frei.
      if (!hasFree) hasFree = require('./_biomancy-shared').teilbareSlots(engine, pi, feld, heroIdx, spellName).length > 0;
      if (!hasFree) return;

      // Player prompt — "you may" effect.
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Summon ${spellName} as a Fantasy Buddy Token (${TOKEN_HP} HP) on Inya's free Support Zone instead of discarding it?`,
        showCard: spellName,
        confirmLabel: '🦄 Summon Buddy!',
        cancelLabel: 'Discard normally',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!engine._confirmSaidYes(confirmed)) return;   // W63b: `{ confirmed: false }` ist ein wahrheitsfähiges Objekt (Rückgabeform-Falle v672)
      // W67a: während der Frage kann sich der Zustand geändert haben (Karte nicht mehr da, Zone belegt) — alles neu prüfen, ehe etwas verändert wird.
      if (!ticket.ablageErwartet() || !ticket.kannNehmen()) return;

      // safePlaceInSupport finds the first free base zone and creates
      // a fresh tracked inst. Same primitive Biomancy Token uses for
      // its spell-as-creature placement.
      // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden,
      // Kontrolle beim Spieler, der Inya gerade fuehrt.
      const placeResult = engine.safePlaceInSupport(spellName, feld, heroIdx, -1,
        feld !== pi ? { controller: pi } : {});
      if (!placeResult) return; // Race: zone filled mid-prompt.

      const { inst, actualSlot } = placeResult;
      // W67a: liegt die Karte schon in der Ablage (Hand-Reaktion), kommt sie dort heraus — der Token ERSETZT die Ablage, er kommt nicht dazu.
      ticket.nimm();

      // W64a (Al, 23.10.2026: „der Spell wandert in den Discard Pile"; Besitzer-Regel: Karten gehen IMMER in die Stapel ihres permanenten Besitzers):
      // gehört der gespielte Zauber einem anderen als dem Wirker (gestohlen/geschenkt), gehört die Karte unter dem Buddy weiter ihrem Besitzer.
      const _gespielt = engine.findCards({ owner: pi, zone: 'hand', name: spellName })[0];
      const _besitzer = Number.isInteger(ticket.kartenBesitzer) ? ticket.kartenBesitzer : _gespielt?.originalOwner;
      if (Number.isInteger(_besitzer) && _besitzer !== inst.originalOwner) inst.originalOwner = _besitzer;

      // Mark + override card data so the engine + UI treat this as a
      // Creature/Token. The card image stays as the original spell.
      // Tooltip / cardType / hp / effect text read as the Buddy.
      const cardDB = engine._getCardDB();
      const baseSpell = cardDB[spellName] || {};
      inst.counters._fantasyBuddyToken = true;
      inst.counters.currentHp = TOKEN_HP;
      inst.counters.maxHp = TOKEN_HP;
      inst.counters._cardDataOverride = {
        ...baseSpell,
        name: 'Fantasy Buddy Token',
        cardType: 'Creature/Token',
        subtype: 'Token',
        hp: TOKEN_HP,
        atk: null,
        level: null,
        cost: null,
        effect: 'Fantasy Buddy Token. While its controller has at least 1 of these Tokens, Card Game Player Inya takes no damage.',
      };

      // W67a: Ticket eintragen. Der Auflösungsweg liest es nach dem Hook und legt die Karte dann NICHT zusätzlich ab (keine Marken im Spielstand).
      // Die gespielte Instanz ist NICHT der Token (eigene Instanz) — der Weg räumt sie ab bzw. behält sie als Wirkungsträger
      // (`_spellKeepInstance`: Anti Magic Zone, Calm Diatribe, Mission, Weapon Unleashing), `engine.zauberInstanzNachBrettzug`.
      ticket.token = inst;

      // Sparkle on the Buddy's slot.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: feld,
        heroIdx, zoneSlot: actualSlot,
      });

      // Fire onCardEnterZone so support-zone listeners (Pes'zet, Maya,
      // Ingo, etc.) react to the Buddy landing in Inya's zone.
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
        _skipReactionCheck: true,
      });

      engine.log('inya_buddy_summoned', {
        player: ps.username, spell: spellName, slot: actualSlot,
      });
      engine.sync();
    },

    /**
     * Damage immunity while a Fantasy Buddy is on the controller's
     * side. Hooks hero damage. Creature damage to the Buddy itself is
     * handled normally — the Buddy CAN be killed; killing the last
     * Buddy ends the immunity.
     */
    beforeDamage: (ctx) => {
      const engine = ctx._engine;
      // Only protect Inya herself.
      if (ctx.target !== ctx.attachedHero) return;
      if (_countBuddies(engine, ctx.cardOwner) <= 0) return;
      ctx.setAmount(0);
    },
  },
};
