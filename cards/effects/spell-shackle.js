// ═══════════════════════════════════════════
//  CARD EFFECT: "Spell Shackle"
//  Spell (Attachment, Decay Magic Lv2)
//
//  „At the beginning of each turn of the controller of the Hero this
//   card is attached to, that Hero takes 50 damage for every Spell
//   School Ability attached to it."
//
//  ── BAUFORM ───────────────────────────────────────────────────────
//  • Anlegen: wie jedes Anhängsel ohne Seitenangabe an JEDEN Helden
//    (Muster Guardian Angel/Anti Magic/Berserk) über `attachToHero`.
//  • „At the beginning of each turn of the controller": `onTurnStart`
//    des Anhängsels, nur wenn der Zugspieler der KONTROLLEUR des Wirts
//    ist (`heroSideOf` — ein übernommener Held tickt in den Zügen seines
//    neuen Kontrolleurs). Eine Seite ohne eigenen Zug (Gegner-Zug eines
//    eigenen Helden) tickt nie. Gefrorener/betäubter/negierter Wirt:
//    das Anhängsel tickt trotzdem (Al W25b, N2-06); ein besiegter Wirt
//    nimmt nichts mehr.
//  • ★ „for every Spell School Ability attached to it": gezählt wird
//    JEDE KARTE, nicht der Name — ein Stapel aus 3× Destruction Magic
//    zählt 3 (= 150 Schaden). „Spell Schools" sind die fünf aus
//    `SPELL_SCHOOL_ABILITIES` (Decay, Destruction, Magic Arts, Summoning,
//    Support; Fighting & Co. nicht). Ein Performance-Joker in einem
//    Schulstapel zählt wie dort als Karte dieser Schule. ★ Es zählt die
//    EXISTENZ, nicht die Wirksamkeit (Al, 24.10.2026): auch negierte
//    Abilities zählen mit (kein `heroAbilityLevelsBlanked`).
//    Mehrere Kopien am selben Helden schlagen einzeln zu.
//  • Schaden: Typ `decay_spell`, Quelle = die Karte mit dem WIRKER als
//    Besitzer (`originalOwner`), ohne Heldenquelle (`heroIdx: -1`) — kein
//    „gewähltes Ziel", also kein Surprise-/Reaktionsfenster. 0 Schulen →
//    nichts (kein Auftritt, keine Animation).
//  • Animation `spell_shackle_chains` (Client: `SpellShackleChainsEffect`):
//    blaue, leuchtende Pixelart-Ketten um den Helden — beim Anlegen und
//    bei jedem Tick; der Auftritt der Karte (`showTriggeredEffect`) zeigt
//    beiden Spielern, WELCHE Karte schlägt.
// ═══════════════════════════════════════════

const { candidateHosts, attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const { opponentOfGs } = require('./_opp');
const { SPELL_SCHOOL_ABILITIES } = require('./_hooks');

const CARD_NAME = 'Spell Shackle';
const PER_SCHOOL_ABILITY = 50;

/** Zauberschul-Ability-KARTEN am Helden (Brettseite `seite`): jede Karte eines Schulstapels zählt — auch negierte (nur die Existenz zählt). */
function schulKarten(engine, seite, heroIdx) {
  const zonen = engine.gs.players[seite]?.abilityZones?.[heroIdx] || [];
  let n = 0;
  for (const schule of SPELL_SCHOOL_ABILITIES) n += engine.countAbilitiesForSchool(schule, zonen);
  return n;
}

module.exports = {
  // Entkoppeltes Bild: läuft auch, wenn der Zauber negiert wird.
  spellVisual: { impact: { type: 'spell_shackle_chains' }, impactMs: 400 },

  activeIn: ['hand', 'support'],
  requiresTarget: true,

  /** CPU: legt die Fessel auf den GEGNERISCHEN Helden mit den meisten Zauberschul-Karten. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'target') return undefined;
    const cpuIdx = engine._cpuPlayerIdx;
    const gegner = (promptData?.validTargets || []).filter(t => t.type === 'hero' && t.owner !== cpuIdx && !t.ineligible);
    if (gegner.length === 0) return undefined;
    const wert = (t) => schulKarten(engine, t.owner, t.heroIdx);
    return [[...gegner].sort((a, b) => wert(b) - wert(a))[0].id];
  },

  spellPlayCondition(gs, pi, engine) {
    return candidateHosts(gs, pi, engine, { sides: [pi, opponentOfGs(gs, pi)] }).length > 0;
  },
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine, { sides: [pi, opponentOfGs(gs, pi)] }); },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      const res = await attachToHero(ctx, CARD_NAME, {
        sides: [pi, engine.opponentOf(pi)],
        description: `Choose a Hero to shackle — at the start of its controller's turns it takes ${PER_SCHOOL_ABILITY} damage for every Spell School Ability attached to it.`,
        confirmLabel: '⛓️ Shackle!', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      engine._broadcastEvent('play_zone_animation', {
        type: 'spell_shackle_chains', owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1,
      });
      await engine._delay(900);
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });
      engine.log('spell_shackle_placed', {
        player: ps.username, target: gs.players[host.owner].heroes[host.heroIdx].name, owner: host.owner,
      });
      engine.sync();
    },

    /** Zugbeginn des Kontrolleurs des Wirts: 50 Schaden je Zauberschul-Ability-Karte. */
    onTurnStart: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const seite = ctx.cardHeroOwner ?? ctx.card.owner;      // Brettseite des Wirts
      const heroIdx = ctx.cardHeroIdx;
      const host = ctx.attachedHero || gs.players[seite]?.heroes?.[heroIdx];
      if (!host?.name || host.hp <= 0) return;
      // „each turn of the controller of the Hero": nur der Zug dessen, der den Wirt gerade kontrolliert.
      if (gs.activePlayer !== engine.heroSideOf(seite, host)) return;

      const anzahl = schulKarten(engine, seite, heroIdx);
      if (anzahl <= 0) return;                                 // kein Leerlauf-Auftritt
      const schaden = PER_SCHOOL_ABILITY * anzahl;

      await engine.showTriggeredEffect(CARD_NAME, { source: ctx.card });
      engine._broadcastEvent('play_zone_animation', {
        type: 'spell_shackle_chains', owner: seite, heroIdx, zoneSlot: -1,
      });
      await engine._delay(700);
      const wirker = Number.isInteger(ctx.card.originalOwner) ? ctx.card.originalOwner : ctx.card.owner;
      const quelle = { name: CARD_NAME, owner: wirker, controller: wirker, heroIdx: -1 };
      await engine.actionDealDamage(quelle, host, schaden, 'decay_spell', { _skipReactionCheck: true });
      engine.log('spell_shackle_tick', { hero: host.name, schools: anzahl, damage: schaden });
      engine.sync();
    },
  },
};
