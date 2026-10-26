// ═══════════════════════════════════════════
//  CARD EFFECT: "Sun Beam"
//  Spell (Destruction Magic Lv1, Normal)
//  Pollution archetype.
//
//  Choose up to 3 non-Hero cards on the board and
//  send them to the discard pile. Place the same
//  number of Pollution Tokens into your free
//  Support Zones.
//
//  Legal targets: anything in a Support, Ability,
//  Permanent, Area or Surprise zone.
//
//  Als Ruling (Al 26.10., „Diese Anwählbar machen; dasselbe gilt
//  für andere ‚any card that is not a Hero'-Effekte wie The
//  Yeeting"): Pollution Tokens und VERDECKTE Surprises sind
//  wählbar („cards on the board that aren't Heroes"). Früher
//  ausgeschlossen (Tokens als „Munition" der Karte). Verdeckte
//  Karten erscheinen im Zielwähler mit maskiertem Namen
//  (`potionTargetingFuer`, server.js); ein gewählter Token zählt
//  wie jede Karte (je Ziel 1 Pollution Token in eine freie eigene
//  Zone, wie bisher).
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');
const { areaTargetId, supportAbilityZiel } = require('./_targeting-shared');

const SUN_BEAM_MAX = 3;

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'sun_beam' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  placesPollutionTokens: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;

      // ── Collect legal targets across every non-Hero board zone ──
      // We mirror The Yeeting's `_collectBoardTargets` ID convention so the
      // existing frontend click handlers for support/ability/permanent slots
      // light up without any board-side changes (area targeting does need
      // a small frontend addition — see app-board.jsx).
      //
      // Targets in the caster's OWN support zone are tagged ownSupport:true.
      // The Pollution-archetype targeting rule (see below) exempts those
      // from the "free-zone" cap because destroying them immediately opens
      // a slot for the Pollution Token that would be placed in return.
      const targets = [];
      const seenInstIds = new Set();
      let ownSupportAvailable = 0;
      for (const inst of engine.cardInstances) {
        if (seenInstIds.has(inst.id)) continue;
        if (inst.counters?.immovable) continue; // can't be destroyed → don't offer
        // Als Ruling (Al 26.10.): Pollution Tokens und verdeckte Surprises sind wählbar (früher: `inst.faceDown` / Token ausgeschlossen).

        if (inst.zone === 'support') {
          // 25.10.2026 (Xal-Runde 4): eine Ability in einer Support Zone ist eine ABILITY — ein Stapel ist EIN Ziel, getroffen wird seine oberste Kopie
          // (`supportAbilityZiel`). Nur eine Stufe-1-Ability gibt ihren Slot frei; bei höherem Stapel bleibt er belegt und schafft keinen Platz für ein Token.
          const sa = supportAbilityZiel(engine, inst);
          if (sa !== undefined) {
            if (sa) {
              const eigen = (inst.controller ?? inst.owner) === pi;
              const schafftPlatz = eigen && sa.level <= 1;
              if (schafftPlatz) ownSupportAvailable++;
              targets.push({ ...sa, ownSupport: schafftPlatz });
            }
            seenInstIds.add(inst.id);
            continue;
          }
          // "Your" / "opponent's" is the CONTROLLER axis. A Creature
          // you originally own but cross-side-placed onto opp's board
          // counts as theirs for picker semantics.
          const isOwnSupport = (inst.controller ?? inst.owner) === pi;
          if (isOwnSupport) ownSupportAvailable++;
          targets.push({
            id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
            type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
            ownSupport: isOwnSupport,
          });
        } else if (inst.zone === 'ability') {
          // Only the top card of an ability stack is targetable.
          const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
          if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
          // Ein Stapel gleichnamiger Karten (Ability Lv 2/3) hat mehrere Instanzen im selben Platz: EIN Ziel je Stapel (eindeutige ID), und zwar die letzte (= oberste) Kopie — wie `supportAbilitySpitze`.
          const _abId = `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`;
          const _abErst = targets.find(x => x.id === _abId);
          if (_abErst) { _abErst.cardInstance = inst; _abErst._cardInstance = inst; continue; }
          targets.push({
            id: _abId,
            type: 'ability', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
          });
        } else if (inst.zone === 'permanent') {
          targets.push({
            id: `perm-${inst.owner}-${inst.counters?.permId || inst.id}`,
            type: 'perm', owner: inst.owner, heroIdx: -1,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
          });
        } else if (inst.zone === 'area') {
      // ★ v1054: JEDE Area der Zone ist ihr eigenes Ziel. Der frühere
      // Filter auf den obersten Eintrag stammt aus der Zeit, als eine
      // Seite nur eine Area halten konnte — seit „Spatial Crevice"
      // machte er die unteren unauswählbar, und die Wahl landete
      // stumm auf der obersten. Die ID trägt den Stapelplatz.
          const areaArr = gs.areaZones?.[inst.owner] || [];
          const stapelPlatz = areaArr.indexOf(inst.name);
          if (stapelPlatz < 0) continue;
          targets.push({
            id: areaTargetId(inst.owner, stapelPlatz),
            type: 'area', owner: inst.owner, heroIdx: -1,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
          });
        } else if (inst.zone === 'surprise') {
          // Als Ruling (Al 26.10.): auch VERDECKTE Surprises (Client-ID wie die übrigen „not a Hero"-Sammler: `surprise-<Seite>-<Held>`); der Name wird dem
          // Wähler maskiert (`potionTargetingFuer`). Eine Surprise belegt keine Support Zone — räumt also keinen Platz für ein Token frei.
          targets.push({
            id: `surprise-${inst.owner}-${inst.heroIdx}`,
            type: 'surprise', owner: inst.owner, heroIdx: inst.heroIdx,
            cardName: inst.name, cardInstance: inst, _cardInstance: inst,
          });
        }
        seenInstIds.add(inst.id);
      }

      // ── Pollution-cap rule ──
      // Every destroyed card places a Pollution Token into one of the
      // caster's free Support Zones, so the number of destructions cannot
      // exceed the number of slots that will actually be available to
      // receive tokens. Specifically:
      //   • non-own-support destructions ≤ freeZones (F)
      //   • own-support destructions each free a slot one-for-one, so
      //     they're uncapped beyond the card's natural 3-target max.
      // Total selection ceiling becomes min(3, F + ownSupportAvailable).
      const freeZones = countFreeZones(gs, pi);
      // ★ Darion: ein Equip-Stapel ist EIN Ziel je Platz (die Rueckfrage „welches Equip?" stellt die Engine); unzulaessige Karten (z. B. `immovable`) nennt sie nicht.
      targets.splice(0, targets.length, ...require('./_equip-stack-shared').gruppiereZiele(targets));
      // W5b-B5 (Al, Welle 5; wie die übrigen Destruction-Zauber unter Ida): Idas Held „can never hit more than 1 target
      // with a Destruction Spell" – höchstens EIN Ziel (und damit höchstens 1 Pollution Token).
      const idaEinzel = !!ctx._engine.heroFlagsLive(ctx.cardHeroOwner ?? pi, ctx.cardHeroIdx)?.forcesSingleTarget;
      const maxTotal = Math.min(idaEinzel ? 1 : SUN_BEAM_MAX, freeZones + ownSupportAvailable);

      if (targets.length === 0 || maxTotal === 0) {
        engine.log('sun_beam_fizzle', {
          player: gs.players[pi].username,
          reason: targets.length === 0 ? 'no_targets' : 'no_pollution_capacity',
        });
        gs._spellCancelled = true;
        return;
      }

      // ── Prompt up to maxTotal targets on the board ──
      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: 'Sun Beam',
        description: `Send up to ${maxTotal} non-Hero card${maxTotal === 1 ? '' : 's'} on the board to the discard pile. Pollution Tokens equal to the number hit will fill your free Support Zones.`,
        confirmLabel: '☀️ Sun Beam!',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal,
        // Non-own-support selections are capped at freeZones. Own-support
        // targets (ownSupport:true) are exempt from this cap. Frontend
        // enforces this in togglePotionTarget.
        maxNonOwnSupport: freeZones,
      });

      if (!selectedIds || selectedIds.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const gewaehlt = selectedIds.map(id => targets.find(t => t.id === id)).filter(Boolean).slice(0, maxTotal);   // W5b-B5: Obergrenze (Ida: 1) serverseitig durchsetzen
      // Darion: aus einem Equip-Stapel koennen MEHRERE Karten gewaehlt sein (`gewaehlteInstanzen`); jede Karte zaehlt einzeln fuer die Obergrenzen (Gesamtzahl, fremde Karten <= freie Zonen).
      const picked = [];
      let fremde = 0;
      for (const t of gewaehlt) {
        const karten = t.type === 'equip' ? engine.gewaehlteInstanzen(t) : [t._cardInstance];
        for (const inst of karten) {
          if (!inst || picked.length >= maxTotal) continue;
          if (!t.ownSupport) { if (fremde >= freeZones) continue; fremde++; }
          picked.push({ ...t, _cardInstance: inst, cardInstance: inst, cardName: inst.name });
        }
      }
      if (picked.length === 0) { gs._spellCancelled = true; return; }

      // ── Descending orbital beam animation on every target ──
      for (const t of picked) {
        const animEvent = { type: 'sun_beam', owner: t.owner };
        if (t.type === 'perm') {
          animEvent.heroIdx = 0;
          animEvent.zoneSlot = -1;
          animEvent.zoneType = 'permanent';
          animEvent.permId = t._cardInstance?.counters?.permId || t._cardInstance?.id;
        } else if (t.type === 'area') {
          animEvent.heroIdx = -1;
          animEvent.zoneSlot = -1;
          animEvent.zoneType = 'area';
        } else if (t.type === 'ability') {
          animEvent.heroIdx = t.heroIdx;
          animEvent.zoneSlot = t.slotIdx;
          animEvent.zoneType = 'ability';
        } else if (t.type === 'surprise') {
          animEvent.heroIdx = t.heroIdx;
          animEvent.zoneSlot = -1;
          animEvent.zoneType = 'surprise';
        } else {
          animEvent.heroIdx = t.heroIdx;
          animEvent.zoneSlot = t.slotIdx ?? -1;
        }
        engine._broadcastEvent('play_zone_animation', animEvent);
      }
      // Beam descends + impact flash lasts ~800–1000ms. Wait for impact.
      await engine._delay(900);

      // ── Destroy each target via the correct removal path ──
      let destroyed = 0;
      // ★ v1057 („Enhanced Guard Dog"): Zerstoerungs-Klammer. Zaehlt die
      // GEWAEHLTEN Ziele — bei genau einem bleibt es eine
      // Einzelzerstoerung und der Dog darf feuern.
      engine.beginDestroyScope(picked.length, picked.map(t => t._cardInstance));   // W78: die gewaehlten Ziele sind todgeweiht (Infallible Oracle Pythia darf keines opfern)
      try {
        for (const t of picked) {
          const inst = t._cardInstance;
          if (!inst) continue;
          if (inst.zone === 'area') {
            await engine.removeArea(inst, 'Sun Beam');
            destroyed++;
          } else {
            await engine.actionDestroyCard(ctx.card, inst);
            destroyed++;
          }
        }
      } finally { engine.endDestroyScope(); }

      engine.sync();
      await engine._delay(300);

      // ── Place Pollution Tokens equal to the number destroyed ──
      if (destroyed > 0) {
        const { placed } = await placePollutionTokens(engine, pi, destroyed, 'Sun Beam', {
          promptCtx: ctx,
        });
        engine.log('sun_beam', {
          player: gs.players[pi].username,
          destroyed, tokensPlaced: placed,
        });
      }

      engine.sync();
    },
  },
};
