'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Creepy Clown of Heaven"
//  Creature (Normal, Lv0, Summoning Magic)
//
//  „While you control this Creature, negate the effects of all other Creatures on the board. Either player may spend an Action during their turn
//   to defeat this Creature. When this Creature is defeated, the effects of all Creatures stay negated for the rest of the turn."
//
//  ── LEVEL UND WORTLAUT (Als Vorgabe 10.10.) ─────────────────────────────
//  Jetzt Lv 0 (vorher höher) und mit neuem Effekt. Datenänderung in `data/cards.json`.
//
//  ── DIE AURA ───────────────────────────────────────────────────────────
//  Skript-Flag `negatesOtherCreatureEffects`: `engine.creatureAuraNegiert(inst)` ist Teil von `isCreatureEffectSuppressed` — dem EINEN Prädikat für „die
//  Effekte dieser Kreatur sind stumm" (Hook-Verteiler, aktive Effekte, Reaktionsfenster, Schutzauren). Die Negation ist ABGELEITET, kein Zähler: sie
//  endet mit dem Clown von selbst und braucht keine Aufräumarbeit.
//  • „All other Creatures on the board": beide Seiten, auch Artefakt-Kreaturen. Nicht der Clown selbst.
//  • Ein negierter/eingefrorener/betäubter Clown hat keine Aura (seine Effekte sind ja selbst stumm).
//  • Zwei Clowns neutralisieren sich NICHT: jede Aura-Quelle ignoriert die Aura der anderen (Annahme; sonst wären beide Karten tot).
//  • Ein Negations-Wächter (Queen of Kings [B]) schützt gegen die Aura eines FREMDEN Clowns.
//
//  ── „EITHER PLAYER MAY SPEND AN ACTION" ─────────────────────────────────
//  `creatureEffect` + `creatureActionCost` (wie Plant Golem) + `activatableByAnyPlayer`: auch der Gegner sieht den Clown auf dem Brett als aktivierbar
//  (`getActivatableCreatures` → Eintrag mit `anyPlayer: true`) und zahlt SEINE Aktion — ein eigener Held führt sie aus (`anyPlayerActorHero`), das
//  Skript bleibt davon unberührt. Server (`doActivateCreatureEffect`): kein Kontrollwechsel, kein Beschwörungs-Schlaf für den Nicht-Besitzer.
//  Eine Rückfrage schützt vor dem versehentlichen Klick (die Aktion ist weg, die Nachwirkung trifft BEIDE Seiten).
//  „Defeat" = regulärer Tod (`actionDestroyCard`, Quelle: der Clown selbst, daher keine Gegnereffekt-Schutzwirkung, die nur Fremdeffekte aussperrt).
//
//  ── „WHEN THIS CREATURE IS DEFEATED …" ──────────────────────────────────
//  `hooks.onCreatureDeath` des Clowns selbst (die sterbende Instanz steht während der Hooks noch auf dem Brett, ihre Aura also auch — andere Todes-Hooks im
//  selben Schlag bleiben negiert): setzt `gs._creatureEffectsNegated = { turn, source }`. `creatureAuraNegiert` liest den Stempel für ALLE Kreaturen,
//  auch später beschworene und auch die anderen Clowns, bis Zugende (Annahme: „all Creatures" ist wörtlich gemeint). Der Tod gilt für JEDEN Weg
//  (Schaden, Zerstörung, die eigene Aktion).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `clown_pop` (Pixelart, Brett-Animation am Platz des Clowns, Hülle `ppSalve`): die rote Nase bläht sich auf und platzt, Konfetti,
//  Luftschlangen, Rauchring. Klänge in ZONE_ANIM_SFX; Log `creepy_clown_defeated`. Die CPU löst die Aktion nie selbst aus (`shouldActivateNow` = false).
// ═══════════════════════════════════════════

const CARD_NAME = 'The Creepy Clown of Heaven';
const POP_MS = 520;           // bis zum Platzen der Nase (deckt sich mit `clown_pop` im Client: 420 ms + 100 ms Einbau-Versatz)

module.exports = {
  activeIn: ['support'],

  // ── Engine-Verträge ──
  negatesOtherCreatureEffects: true,   // Aura → `engine.creatureAuraNegiert`
  hitsMultipleTargets: true,           // die Aura trifft ALLE anderen Creatures auf einmal (Negation, kein Schaden) — Kennzeichnung für `check-aoe-text`
  creatureEffect: true,
  creatureActionCost: true,            // „spend an Action"
  activatableByAnyPlayer: true,        // … „either player"

  /** Das Besiegen: Rückfrage, dann regulärer Tod. Der Aktivierende ist der Spieler, der die Aktion bezahlt hat — nicht zwingend der Besitzer. */
  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    const gs = engine.gs;
    const ctrl = inst.controller ?? inst.owner;
    const aktiv = engine._activeCreatureEffect?.owner ?? ctrl;
    const yes = await engine.promptGeneric(aktiv, {
      type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
      message: 'Spend your Action to defeat The Creepy Clown of Heaven? Afterwards the effects of ALL Creatures stay negated for the rest of the turn.',
      confirmLabel: '🎪 Pop it!', cancelLabel: 'Keep it', cancellable: true,
    });
    if (!yes || yes.confirmed === false) return false;
    engine.log('creepy_clown_popped', { player: gs.players[aktiv]?.username, owner: gs.players[ctrl]?.username });
    await engine.actionDestroyCard({ name: CARD_NAME, owner: ctrl, heroIdx: inst.heroIdx }, inst, { source: CARD_NAME });
    engine.sync();
    return true;
  },

  hooks: {
    /** „When this Creature is defeated, the effects of all Creatures stay negated for the rest of the turn." */
    onCreatureDeath: async (ctx) => {
      const tod = ctx.creature;
      const inst = ctx.card;
      if (!tod || !inst || tod.instId !== inst.id) return;   // nur dieser Clown
      const engine = ctx._engine;
      const gs = engine.gs;
      gs._creatureEffectsNegated = { turn: gs.turn || 0, source: inst.controller ?? inst.owner };
      const seite = engine.physicalSide(inst);
      engine._broadcastEvent('play_zone_animation', {
        type: 'clown_pop', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: POP_MS + 700,
        targets: [{ owner: seite, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: CARD_NAME }],
        originOwner: seite, originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
      });
      await engine._delay(POP_MS);
      engine.log('creepy_clown_defeated', { player: gs.players[inst.controller ?? inst.owner]?.username });
      engine.sync();
    },
  },

  cpuMeta: {
    // Die CPU würde ihren eigenen Clown sonst „zur Nutzung" besiegen — er ist ihre Aura, kein Werkzeug. (Den Clown des Menschen sucht sie nicht auf:
    // ihre Aktivierungs-Suche läuft nur über die eigene Seite.)
    shouldActivateNow: () => false,
  },
};
