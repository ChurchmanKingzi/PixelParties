// ═══════════════════════════════════════════
//  HERO EFFECT: "Tazune, the Angry Hot-Blood"
//  Hero (HP 400 / ATK 40 — Adventurousness +
//  Destruction Magic starting abilities)
//
//  EFFECT (per cards.json):
//   "The first two times every turn this Hero
//    would take damage from your own cards or
//    effects (including recoil damage) are
//    reduced to 0."
//
//  ── Was zählt als "your own cards or effects"? ──
//  Genau der Schaden, den eine Karte oder ein
//  Effekt UNTER DEINER KONTROLLE unmittelbar an
//  Tazune anrichtet: der Rückstoß von Phoenix
//  Tackle oder Fire Bolts, ein eigener Spell, der
//  auf ein eigenes Ziel geht, ein eigener Angriff
//  auf die eigene Reihe.
//
//  NICHT dazu zählen Statuseffekte (Burn, Poison):
//  die Engine führt Statusschaden ohne Besitzer
//  (`source.owner` fehlt), und die Kartensprache
//  behandelt sie ohnehin als eigene Kategorie —
//  Smug Coin listet "an opponent's card or effect"
//  und "a negative status effect" getrennt auf.
//  Ein Burn, den du selbst auf Tazune gelegt hast,
//  tickt also weiter durch.
//
//  ── Zwei Ladungen JE ZUG ──
//  Zurückgesetzt wird bei jedem Zugwechsel, nicht
//  je Runde: bis zu zweimal in deinem Zug, dann
//  wieder bis zu zweimal im Zug des Gegners. Der
//  Zähler hängt am Zugstempel (`gs.turn`), damit
//  er auch über Snapshot/Restore der MCTS-Rollouts
//  hinweg stimmt.
//
//  ── Wann wird eine Ladung verbraucht? ──
//  NUR wenn tatsächlich Schaden durchkäme. Steht
//  der Wert schon auf 0, oder hat eine andere
//  Karte den Schaden bereits gesperrt
//  (`cannotBeReduced` / `cannotBeNegated`), passiert
//  nichts und die Ladung bleibt erhalten.
//
//  ── Durchschlagender Schaden ──
//  "cannot be reduced or negated" hat Vorrang. Der
//  praktische Fall: Ida castet Fire Bolts und
//  wählt Tazune als Ziel des Rückstoßes — Idas
//  Destruction-Spell-Schaden ist un-negierbar, also
//  nimmt Tazune ihn trotz seines Effekts, ohne eine
//  Ladung zu verlieren.
//
//  ── "Reduced to 0", nicht "verhindert" ──
//  Der Schaden wird auf 0 GESETZT (`setAmount`),
//  das Schadensereignis läuft also weiter durch —
//  andere Karten sehen ein Ereignis mit 0 Schaden.
//  Der Null-Floater wird hier selbst ausgelöst: die
//  Engine zeigt ihre eigene rote 0 nur, wenn der
//  Wert NACH den beforeDamage-Hooks noch > 0 war
//  (sie vergleicht gegen den Stand vor dem
//  Buff-Multiplikator). Wer schon im Hook auf 0
//  reduziert, muss den Floater selbst senden.
//
//  Geschützt ist ausschließlich der Held selbst —
//  Kreaturen in seinen Support-Zonen nicht ("this
//  Hero").
// ═══════════════════════════════════════════

const CARD_NAME = 'Tazune, the Angry Hot-Blood';
const USES_PER_TURN = 2;

module.exports = {
  activeIn: ['hero'],

  hooks: {
    beforeDamage: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hero') return;

      // Nur echter Schaden verbraucht eine Ladung.
      if (!(ctx.amount > 0)) return;

      // Durchschlag hat Vorrang. `setAmount` würde hier ohnehin
      // wirkungslos bleiben (es verweigert Reduktionen, sobald
      // `cannotBeReduced` steht) — der frühe Ausstieg sorgt dafür,
      // dass dabei auch keine Ladung verfällt.
      if (ctx.cannotBeReduced || ctx.cannotBeNegated) return;

      const engine = ctx._engine;
      const ownerIdx = inst.owner;
      const ps = engine.gs.players[ownerIdx];
      const hero = ps?.heroes?.[inst.heroIdx];
      if (!hero || ctx.target !== hero) return;      // nur Tazune selbst
      if (!(hero.hp > 0)) return;

      // Quelle muss unter DEINER Kontrolle stehen. Statusschaden hat
      // keinen Besitzer (-1) und fällt damit automatisch heraus.
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (srcOwner < 0 || srcOwner !== ownerIdx) return;

      // Zwei Ladungen je Zug, Reset bei jedem Zugwechsel.
      const counters = inst.counters || (inst.counters = {});
      if (counters._tazuneTurn !== engine.gs.turn) {
        counters._tazuneTurn = engine.gs.turn;
        counters._tazuneUsed = 0;
      }
      if ((counters._tazuneUsed || 0) >= USES_PER_TURN) return;
      counters._tazuneUsed = (counters._tazuneUsed || 0) + 1;

      const prevented = ctx.amount;
      ctx.setAmount(0);

      // Rote 0 über Tazune (siehe Kopfkommentar).
      engine._broadcastEvent('play_damage_zero', {
        owner: ownerIdx, heroIdx: inst.heroIdx, zoneSlot: -1,
      });
      engine.log('tazune_shrugged_off', {
        hero: CARD_NAME,
        source: ctx.source?.name || '?',
        prevented,
        usesLeft: USES_PER_TURN - counters._tazuneUsed,
      });
    },
  },
};
