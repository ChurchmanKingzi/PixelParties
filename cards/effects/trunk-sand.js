// ═══════════════════════════════════════════
//  CARD EFFECT: "Trunk Sand"
//  Attack (Fighting Lv1, Normal)
//
//  "Choose a target and deal damage equal to the attacker's Attack stat
//   to it and Blind it until the next time it takes damage."
//
//  ── DREI PUNKTE, DIE DEN BAU BESTIMMEN ────────────────────────────
//  ① ATTACK STAT, nicht base ATK. Ferocious Tiger Kick (dieselbe
//     Bauform, dieselbe Schule) sagt ausdruecklich „base Attack stat"
//     und liest `hero.baseAtk`; hier steht „the attacker's Attack
//     stat", also `hero.atk` samt aller Buffs und Ausruestung.
//
//  ② „UNTIL THE NEXT TIME IT TAKES DAMAGE" ist eine NEUE Ablaufform.
//     `blinded` kannte bisher nur Smoke Vials Rundenende. Der Status
//     traegt jetzt `untilDamaged: true`; abgeraeumt wird er zentral in
//     `_noteDamageTaken` (siehe _engine.js) — der einen Stelle, die
//     alle drei Schadenswege durchlaufen, und nur bei Schaden > 0.
//     Ein weggedrueckter Treffer loest die Blendung also NICHT.
//
//     ★ Die Reihenfolge hier ist entscheidend: erst Schaden, DANN
//     blenden. Andersherum haette der eigene Treffer die Blendung im
//     selben Atemzug wieder abgeraeumt.
//
//  ③ EIGENER STATUS `blinded_hit`, nicht `blinded` (Als Befund 14.9.).
//     Ein Statusobjekt kann nur EINE Endbedingung tragen — die zweite
//     Anwendung haette die erste ueberschrieben. Und welche laenger
//     haelt, ist nie vorher klar, also muessen beide gleichzeitig
//     anliegen koennen. Sie wirken identisch; „ist geblendet?" fragt
//     `BLIND_STATUSES` bzw. `engine._isHeroBlinded`.
//
//  ④ Blinded gilt fuer Helden UND Kreaturen. Die Engine hatte den
//     Kreaturen-Fall schon vorgesehen (`inst.counters?.blinded`, mit
//     dem Kommentar „a future card may apply that") — Trunk Sand ist
//     diese Karte.
//
//  Animation: „Pocket Sand" — eine Handvoll gelb-brauner Koerner fliegt
//  vom Anwender zum Ziel (`play_projectile_animation` mit
//  `projectileShape: 'sand'`, KEIN Emoji), dann eine Staubwolke am
//  Einschlag (`sand_burst`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Trunk Sand';

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    projectile: { projectileShape: 'sand', duration: 520 },
    stagger: 110, flightMs: 330,
    impact: { type: 'sand_burst' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Fuer das Blinded-Gate — siehe cards/effects/_hooks.js.

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const atk = hero.atk || 0;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: atk,
        title: CARD_NAME,
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): die Karte
        // traegt Schaden UND Status, das Ziel-Gate filtert deshalb
        // nicht — `classifyTargetTags` stempelt `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie
        // stark das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'blinded_hit',
        description: `Deal ${atk} damage and Blind the target until it next takes damage.`,
        confirmLabel: `🏜️ Pocket Sand! (${atk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });
      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      const attackSource = {
        name: CARD_NAME, owner: pi, heroIdx, controller: pi, usesHeroAtk: true,
      };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, atk);

      // ── „Pocket Sand": ein SANDSTRAHL zum Ziel (v1149) ────────────────
      // Al 17.9.: „ein richtiger Strahl aus Sand, der auf das Ziel
      // geschossen wird (vgl. Sandwirbel aus Pokemon)". Der Client zeichnet
      // bei `projectileShape: 'sandStream'` statt eines einzelnen Projektils
      // einen Strom aus ~280 Koernern, der ueber ~70 % der Dauer vom Werfer
      // zum Ziel schiesst. Die Dusche am Ziel startet, sobald die ersten
      // Koerner ankommen, und laeuft unter dem noch fliessenden Strahl.
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: target.type === 'hero' ? undefined : target.slotIdx,
        // ★ Kein Emoji (Als Befund 14.9.): 🏜️ zeigt eine Oase.
        projectileShape: 'sandStream',
        noTrail: true,
        duration: 950,
        sfx: 'elem_wind',
      });
      await engine._delay(380);

      // Einschlag: Sanddusche auf dem Ziel.
      engine._broadcastEvent('play_zone_animation', {
        type: 'sand_burst', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(300);

      // ── Schaden ZUERST ─────────────────────────────────────────────
      let dealt = 0, damageCancelled = false;
      if (target.type === 'hero') {
        const th = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (th && th.hp > 0) {
          const r = await engine.actionDealDamage(attackSource, th, finalDmg, 'attack');
          dealt = r?.dealt || 0;
          damageCancelled = !!r?.cancelled;
        }
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support'
          && c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          const r = await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
          dealt = r?.dealt || 0;
          damageCancelled = !!r?.cancelled;
        }
      }

      // Wurde der Treffer vollstaendig negiert, faellt auch der Rider —
      // „negate that damage AND all associated effects" (Bauform Tiger
      // Kick).
      if (damageCancelled) {
        engine.log('trunk_sand_rider_skipped', { reason: 'damage_cancelled' });
        engine.sync();
        return;
      }

      // ── DANN blenden ───────────────────────────────────────────────
      if (target.type === 'hero') {
        const th = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (th && th.hp > 0) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'blinded_hit', {
            appliedBy: pi,
            source: CARD_NAME,
            untilDamaged: true,
            animationType: 'sand_burst',
          });
        }
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support'
          && c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx);
        if (inst && inst.zone === 'support') {
          const applied = await engine.applyCreatureStatus(inst, 'blinded_hit', {
            sourceOwner: pi,
            source: CARD_NAME,
            untilDamaged: true,
          });
          if (applied) engine.log('blind', { target: inst.name, by: CARD_NAME, type: 'creature' });
        }
      }

      engine.log('trunk_sand', {
        player: ps.username, target: target.cardName, atk, dealt,
      });
      engine.sync();
    },
  },
};
