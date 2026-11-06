// ═══════════════════════════════════════════
//  CARD EFFECT: "Regeneration"
//  Spell (Attachment, Support Magic Lv1)
//
//  „The Hero this Spell is attached to is healed for 60/120/180 HP at the start of each of its owner's turns, depending on the user's Support Magic level when using this Spell."
//
//  ── BAUFORM ───────────────────────────────────────────────────────────
//  • Anlegen: wie jedes Anhängsel ohne Seitenangabe an JEDEN Helden (eigene und gegnerische; Muster Stoneskin/Guardian Angel/Anti Magic) über `attachToHero`.
//  • ★ „depending on the user's Support Magic level when using this Spell": die Stufe des WIRKERS (seine Support Magic, wirksame Stufe inkl. Boni, 1–3) wird beim Ausspielen
//    festgehalten (`counters.regenerationLevel`) und gilt für die Lebenszeit der Karte — spätere Änderungen an den Abilities ändern den Betrag nicht, und auch ein Umhängen
//    (Inheritance Ceremony) behält ihn. Stufe 1/2/3 → 60/120/180 HP.
//  • „at the start of each of its owner's turns": `onTurnStart` des Anhängsels, nur wenn der Zugspieler der KONTROLLEUR des Wirts ist (`heroSideOf` — wie bei Spell Shackle: ein
//    übernommener Held wird in den Zügen seines neuen Kontrolleurs geheilt; ein Held, dessen Seite keinen eigenen Zug hat, wird nie geheilt). Gefrorener/betäubter/negierter Wirt:
//    das Anhängsel heilt trotzdem (Zeitpunkt-Karten ticken unter Statuseffekten weiter); ein besiegter Wirt wird nicht geheilt. Voller HP-Stand → kein Auftritt, keine Animation.
//  • Mehrere Kopien am selben Helden heilen einzeln (jede mit ihrer eigenen Stufe). Heilung läuft über `actionHealHero` — Heilsperren (Forbidden Curse of Aging …),
//    Max-HP-Deckel und Heil-Reaktionen gelten wie bei jeder Heilung.
//  • Animation `regeneration_bloom` (Client): grüne Pixel-Kreuze steigen aus dem Helden auf — beim Anlegen und bei jedem Tick; `showTriggeredEffect` zeigt beiden Spielern, WELCHE
//    Karte heilt.
// ═══════════════════════════════════════════

const { candidateHosts, attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const { opponentOfGs } = require('./_opp');

const CARD_NAME = 'Regeneration';
const HEAL_PER_LEVEL = 60;
const MAX_LEVEL = 3;

/** Stufe dieses Wurfs: wirksame Support-Magic-Stufe des Wirkers (Brettseite `feld`, Held `heroIdx`), 1–3. */
function wirkerStufe(engine, feld, heroIdx) {
  const lvl = engine.effectiveSchoolLevelForCaster('Support Magic', feld, heroIdx);
  return Math.max(1, Math.min(MAX_LEVEL, lvl || 1));
}

module.exports = {
  // Entkoppeltes Bild: läuft auch, wenn der Zauber negiert wird.
  spellVisual: { impact: { type: 'regeneration_bloom' }, impactMs: 400 },

  activeIn: ['hand', 'support'],
  requiresTarget: true,

  /** CPU: bevorzugt den eigenen Helden mit der größten Lücke zwischen HP und Max-HP (dem, der die Heilung am ehesten braucht). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'target') return undefined;
    const cpuIdx = engine._cpuPlayerIdx;
    const eigene = (promptData?.validTargets || []).filter(t => t.type === 'hero' && t.owner === cpuIdx && !t.ineligible);
    if (eigene.length === 0) return undefined;
    const luecke = (t) => { const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx]; return (h?.maxHp || 0) - (h?.hp || 0); };
    const traegt = (t) => (engine.gs.players[t.owner]?.supportZones?.[t.heroIdx] || []).some(z => (z || []).includes(CARD_NAME));
    return [[...eigene].sort((a, b) => (traegt(a) - traegt(b)) || (luecke(b) - luecke(a)))[0].id];
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
      const casterSeite = ctx.cardHeroOwner ?? pi;
      const casterHeroIdx = ctx.cardHeroIdx;
      // Die Stufe steht fest, sobald der Zauber gewirkt wird (vor der Wahl des Wirts: die Wahl ändert die Abilities des Wirkers nicht).
      const stufe = wirkerStufe(engine, casterSeite, casterHeroIdx);

      const res = await attachToHero(ctx, CARD_NAME, {
        sides: [pi, engine.opponentOf(pi)],
        description: `Choose a Hero to regenerate — it is healed for ${HEAL_PER_LEVEL * stufe} HP at the start of each of its owner's turns.`,
        confirmLabel: '🌱 Regenerate!', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      inst.counters = inst.counters || {};
      inst.counters.regenerationLevel = stufe;
      inst.counters.regenerationCastBy = pi;
      engine._broadcastEvent('play_zone_animation', {
        type: 'regeneration_bloom', owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1,
      });
      await engine._delay(600);
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });
      engine.log('regeneration_placed', {
        player: ps.username, target: gs.players[host.owner].heroes[host.heroIdx].name, owner: host.owner, level: stufe,
      });
      engine.sync();
    },

    /** Zugbeginn des Kontrolleurs des Wirts: 60/120/180 HP je nach festgehaltener Stufe. */
    onTurnStart: async (ctx) => {
      if (ctx.card.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const seite = ctx.cardHeroOwner ?? ctx.card.owner;      // Brettseite des Wirts
      const heroIdx = ctx.cardHeroIdx;
      const host = ctx.attachedHero || gs.players[seite]?.heroes?.[heroIdx];
      if (!host?.name || host.hp <= 0) return;
      // „each of its owner's turns": nur der Zug dessen, der den Wirt gerade kontrolliert.
      if (gs.activePlayer !== engine.heroSideOf(seite, host)) return;
      if (host.hp >= (host.maxHp || host.hp)) return;           // nichts zu heilen → kein Auftritt

      const stufe = Math.max(1, Math.min(MAX_LEVEL, ctx.card.counters?.regenerationLevel || 1));
      const menge = HEAL_PER_LEVEL * stufe;
      const wirker = Number.isInteger(ctx.card.originalOwner) ? ctx.card.originalOwner : ctx.card.owner;

      await engine.showTriggeredEffect(CARD_NAME, { source: ctx.card });
      engine._broadcastEvent('play_zone_animation', {
        type: 'regeneration_bloom', owner: seite, heroIdx, zoneSlot: -1,
      });
      await engine._delay(500);
      const quelle = { name: CARD_NAME, owner: wirker, controller: wirker, heroIdx: -1 };
      await engine.actionHealHero(quelle, host, menge);
      engine.log('regeneration_tick', { hero: host.name, level: stufe, heal: menge });
      engine.sync();
    },
  },
};
