// ═══════════════════════════════════════════
//  CARD EFFECT: „Siege"
//  Spell (Attachment, Magic Arts Lv3)
//
//  "Attach this card to one of your Heroes. While this card is attached
//   to a Hero, your opponent cannot add cards from their deck or
//   discard pile to their hand outside their Resource Phase (but they
//   can still draw cards)."
//
//  ── DIE STARKE SUCH-SPERRE ────────────────────────────────────────
//  ★ Al 14.9.: „Verwende hier auch Search-Locked, aber eine staerkere
//  Version, die den Discard einschliesst." Genau dafuer gibt es die
//  zweite Stufe seit „Cats of the Pharaoh" (v1068) — dort bleibt der
//  Ablagestapel offen, hier nicht.
//
//  „but they can still draw cards" bestaetigt die Wahl: es ist die
//  SUCH-Sperre, nicht `handLocked`.
//
//  ── ZUSTAND, NICHT EREIGNIS ──────────────────────────────────────
//  ★ Cats setzt eine Flagge, die am Zugende faellt. Siege ist ein
//  ZUSTAND: die Sperre gilt, solange die Karte haengt, und zusaetzlich
//  nur AUSSERHALB der Resource Phase des Gegners. Eine Flagge muesste
//  dafuer bei jedem Phasenwechsel nachgefuehrt werden — und liefe beim
//  ersten vergessenen Pfad aus dem Tritt.
//
//  Deshalb der Vertrag `blocksSearchFor` (v1090): der Riegel fragt bei
//  JEDER Suche neu, und die Karte antwortet aus dem aktuellen Zustand.
//  Kein Aufraeumen noetig — faellt die Karte vom Helden, antwortet sie
//  nicht mehr.
//
//  ── „OUTSIDE THEIR RESOURCE PHASE" ───────────────────────────────
//  Gemeint ist die Resource Phase DES GESPERRTEN Spielers — also seine
//  eigene. In einer fremden Runde ist er ohnehin nie in seiner Resource
//  Phase, die Sperre gilt dort also durchgehend. Geprueft wird deshalb
//  BEIDES: es muss sein Zug sein UND die Resource Phase laufen.
// ═══════════════════════════════════════════

const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const { PHASES } = require('./_hooks');

const CARD_NAME = 'Siege';

function hostOpts() {
  return { ownSideOnly: true };
}

module.exports = {
  requiresTarget: true,
  // ^ Fuer das Blinded-Gate: der Spell oeffnet eine Heldenwahl.
  activeIn: ['hand', 'support'],

  spellPlayCondition(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, hostOpts()).length > 0;
  },
  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, hostOpts());
  },

  /**
   * ★ Der Engine-Vertrag (v1090). Beide Quellen werden gesperrt —
   * „from their deck OR discard pile".
   *
   * @param {number} pi      Spieler, der suchen will
   * @param {string} quelle  'deck' | 'discard'  (hier egal: beide)
   */
  blocksSearchFor(gs, pi, quelle, engine, inst) {
    // Nur wirksam, solange die Karte an einem Helden HAENGT.
    if (!inst || inst.zone !== 'support') return false;
    if (inst.heroIdx == null || inst.heroIdx < 0) return false;

    // „YOUR OPPONENT cannot …" — der Traeger selbst bleibt frei.
    const traeger = inst.controller ?? inst.owner;
    if (pi === traeger) return false;

    // „outside THEIR Resource Phase": nur in seiner eigenen Runde kann
    // er ueberhaupt in seiner Resource Phase sein.
    const seineRundeUndResourcePhase =
      gs.activePlayer === pi && gs.currentPhase === PHASES.RESOURCE;
    return !seineRundeUndResourcePhase;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;

      const res = await attachToHero(ctx, CARD_NAME, {
        ...hostOpts(),
        preferCaster: true,
        description: 'Choose a Hero you control to attach Siege to.',
        confirmLabel: '🏰 Attach!',
      });
      if (!res) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: ctx.cardOwner,
        heroIdx: res.host.heroIdx, zoneSlot: -1,
      });
      engine.log('siege_attached', {
        player: engine.gs.players[ctx.cardOwner]?.username,
        hero: engine.gs.players[res.host.owner]?.heroes?.[res.host.heroIdx]?.name,
      });
      engine.sync();
    },
  },
};
