// ═══════════════════════════════════════════
//  CARD EFFECT: "Shamanic Curse"
//  Spell (Reaction) — Decay Magic Lv3
//
//  ★ W34a (Al, 22.10.2026): reagiert NICHT auf Effekte, die nur als Spell
//  ZÄHLEN (Alice): der Spell müsste in den Ablagestapel geschickt werden
//  können — ein Effekt ohne Karte kann das nicht (`zaehltAlsArt`-Marke der
//  virtuellen Kette).
//
//  When an opponent's Hero uses a Spell, increase that
//  Spell's level by 1. If the Hero can no longer
//  meet the level requirement — even via Wisdom
//  coverage they can actually pay for in hand cards
//  — the Spell is negated and sent to the discard
//  pile. In that case the opponent may immediately
//  perform an additional Action afterwards.
// ═══════════════════════════════════════════

const { stufeErhoehen } = require('./_level-bump-shared');

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'plague_smoke' }, impactMs: 260 },

  isReaction: true,

  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink || lastLink.owner === pi) return false;
    if (lastLink.cardType !== 'Spell') return false;
    // ★ W34a (Al, 22.10.2026, Punkt 2): „Shamanic Curse nicht, da der Spell nicht zum Discard geschickt werden könnte" — ein Effekt, der nur als Spell ZÄHLT (Alice; virtuelle
    // Kette `alsSpellKette`), ist kein gespielter Spell und hat keine Karte, die in die Ablage ginge: keine Reaktion. Gegenprobe: ein echter Spell (Kette ohne Marke) → reagiert.
    if (lastLink.zaehltAlsArt) return false;

    const ps = gs.players[pi];
    if (!ps) return false;
    const cardData = engine._getCardDB()['Shamanic Curse'];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;   // W13 (Al, A2): `negated` sperrt die Reaktion nicht mehr
      if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
    }
    return !!engine.fremderHeldKannStufe(pi, 'Shamanic Curse');   // W20c: auch ein uebernommener Held wirkt
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;

    // Stufe +1 prüfen / Wisdom-Zusatz zahlen / ggf. negieren — gemeinsamer Baustein mit Celia, the Class Clown.
    const { status, link: targetLink } = await stufeErhoehen(engine, chain, targetIndex, { logPrefix: 'shamanic_curse' });
    if (status !== 'negated') return;
    const oppIdx = targetLink.owner;
    const castingHi = targetLink.heroIdx ?? -1;
    const spellName = targetLink.cardName;

    // „If it does, your opponent may immediately perform an ADDITIONAL
    // Action afterwards" (Text 3.10.) — unabhaengig davon, ob der Zauber
    // die Hauptaktion gekostet hat. Wie bei The Master's Plan NACH der
    // ganzen Kette angeboten (waehrend der Kette sperrt der Reaktionsriegel
    // noch jedes Kartenspiel) und abbrechbar. Das ersetzt die fruehere
    // Bonus-Hauptaktion, die bei Zusatzaktions-Zaubern (Divine Gifts)
    // eine Phantom-Aktion hinterliess.
    engine.queuePostChainAction(async () => {
      await engine.performImmediateActionAnyHero(oppIdx, {
        title: 'Shamanic Curse',
        mitUebernommenenAktionen: true,   // W36a (Al, 22.10.2026): auch Abilities/Heldeneffekte eines UEBERNOMMENEN Helden des Opfers (allgemeine Regel: Klau-Effekte hindern das Handeln nicht)
        description: 'Your Spell was negated. You may perform an additional Action with any Hero — or skip.',
        cancellable: true,
      });
      engine.sync();
    });

    engine.log('shamanic_curse_negate', {
      player: gs.players[pi]?.username,
      spell: spellName, owner: oppIdx, refundTo: castingHi,
    });
    engine.sync();
  },
};
