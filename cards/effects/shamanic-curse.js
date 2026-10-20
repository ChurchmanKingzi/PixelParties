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
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    const oppIdx = targetLink.owner;
    const oppPs = gs.players[oppIdx];
    const castingHi = targetLink.heroIdx ?? -1;
    // W16g (R02-22): bei einem geliehenen Wirker (Charme …) liegt der Held auf der Brettseite `casterOwner`, nicht beim
    // Kontrolleur `owner`; Hand/Abwurf bleiben beim Kontrolleur (`oppIdx`).
    const heroSeite = targetLink.casterOwner ?? oppIdx;
    const castingHero = gs.players[heroSeite]?.heroes?.[castingHi];
    const spellName = targetLink.cardName;
    const spellCd = engine._getCardDB()[spellName];

    if (!oppPs || !castingHero || !spellCd) {
      engine.log('shamanic_curse_abort', { reason: 'caster-or-spell-missing' });
      return;
    }

    // Determine the new required Wisdom cost when the spell's effective
    // level goes up by 1. Temporarily patch the caster's levelOverrideCards
    // so engine.getWisdomDiscardCost sees the bumped level.
    if (!castingHero.levelOverrideCards) castingHero.levelOverrideCards = {};
    const hadOverride = Object.prototype.hasOwnProperty.call(castingHero.levelOverrideCards, spellName);
    const prevOverride = hadOverride ? castingHero.levelOverrideCards[spellName] : undefined;
    const currentLevel = prevOverride != null ? prevOverride : (spellCd.level || 0);
    castingHero.levelOverrideCards[spellName] = currentLevel + 1;

    const newCost = engine.getWisdomDiscardCost(heroSeite, castingHi, spellCd);

    // Restore override exactly as it was
    if (!hadOverride) delete castingHero.levelOverrideCards[spellName];
    else castingHero.levelOverrideCards[spellName] = prevOverride;
    // W5b-B9 (Al, Welle 5): der erhöhte Level kostet bei Wisdom-Helden den Zusatz-Abwurf TATSÄCHLICH. Die ursprünglichen
    // Wisdom-Kosten zahlt `doPlaySpell` erst nach der Auflösung (Kosten vorab berechnet, `oldCost`); hier kommt nur die Differenz dazu.
    const oldCost = Math.max(0, engine.getWisdomDiscardCost(heroSeite, castingHi, spellCd));

    // newCost: -1 means uncoverable (no Wisdom path exists), otherwise the
    // required extra discards. Spell survives iff the caster CAN cover it
    // AND has enough hand cards to pay (Gesamtkosten; B9: die Differenz zum Ursprungsgebot wird unten wirklich abgeworfen).
    const coverable = newCost >= 0;
    // ★ Z4 (R02-15): der gerade gewirkte Zauber liegt noch in `oppPs.hand`, ist aber keine bezahlbare Handkarte.
    const affordable = coverable && engine._handIndizesOhneAufloesende(oppPs).length >= newCost;

    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: heroSeite,
      heroIdx: castingHi >= 0 ? castingHi : 0, zoneSlot: -1,
    });
    await engine._delay(500);

    if (affordable) {
      // Still legal – aber der Zusatz-Level kostet bei Wisdom-Helden die Differenz an Handkarten (Abwurf wie die Wisdom-Kosten;
      // die auflösende Karte ist ausgenommen). Gesamtkosten (alt + Zusatz) sind oben als bezahlbar geprüft.
      const extra = Math.max(0, newCost - oldCost);
      if (extra > 0) {
        await engine.actionPromptForceDiscard(oppIdx, extra, {
          title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
        });
      }
      engine.log('shamanic_curse_survived', {
        player: gs.players[pi]?.username,
        spell: spellName, newCost, extraDiscarded: extra,
      });
      engine.sync();
      return;
    }

    // Uncoverable → negate the Spell.
    engine.negateChainLink(chain, targetIndex);

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
