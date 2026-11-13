// ═══════════════════════════════════════════
//  CARD EFFECT: "Strong Ox Headbutt"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  Forces opponent to discard 1 card (2 if 2nd
//  Attack this turn). If 3rd Attack and target
//  is a Hero with Abilities, may remove one.
//
//  Animation (Pixelart, public/app-fx-62.jsx): Der Held springt hoch (Hocke, Absprung, Scheitel) und stürzt im Bogen KOPF VORAN
//  aufs Ziel (`ox_headbutt`, Quelle = `von`, Stärke = `pow` 1–3 = 1./2./3. Angriff der Runde). Kontakt = Bild 0, der Anlauf beginnt
//  19 Bilder (633 ms) davor; der SCHADEN fällt bei Bild 2 (Kontakt + 67 ms, nach dem Hit-Stop = 21 Bilder ≈ 700 ms nach Animationsbeginn).
//  Discard-/Ability-Rider erst nach dem Ende der Zielanimation (Bild 38). Der Client entscheidet über den Rückfall (Retro, Animationen aus,
//  Quelle ohne Figur …) und spielt dann selbst die alte Kombination Ram-Anlauf + Explosion + Ochsen-Symbol auf denselben Schadenszeitpunkt.
// ═══════════════════════════════════════════

// Zeiten (ms) der Zonen-Animation `ox_headbutt` (app-fx-62.jsx, 30 Hz, Bild 0 = Kontakt, Beginn bei Bild −19). `VORLAUF`: Mount-Vorlauf der Animation im Client (ZONE_ANIM_MOUNT_DELAY_MS 100 + Aufbau,
// gemessen im Spiel) — die Engine-Wartezeiten sind Animationszeit + Vorlauf (wie bei Blow of the Venom Snake / Flame Avalanche), damit HP-Zahl im Schadensbild (2) und der Rider nach dem Ende (38) kommen.
const BILD_MS = 1000 / 30;
const ANLAUF_BILDER = 19;
const VORLAUF_MS = 125;
const SCHADEN_MS = Math.round((ANLAUF_BILDER + 2) * BILD_MS) + VORLAUF_MS;       // Bild 2 = nach dem Hit-Stop
const ENDE_MS = Math.round((ANLAUF_BILDER + 38) * BILD_MS) + VORLAUF_MS;         // Bild 38 = Ziel gefedert, Anwender zurück am Platz

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'explosion' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const oppIdx = engine.opponentOf(pi);
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      const baseAtk = hero.baseAtk || 0;
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1;
      const is2nd = attackNumber === 2;
      const is3rd = attackNumber === 3;

      let desc = `Deal ${baseAtk} base ATK damage. Opponent discards ${is2nd ? 2 : 1}.`;
      if (is3rd) desc += '\n🌟 3rd Attack: May remove an Ability from target!';

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: baseAtk,
        title: 'Strong Ox Headbutt',
        description: desc,
        confirmLabel: `𖤍 Headbutt! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === (ctx.cardHeroOwner ?? pi) && t.heroIdx === heroIdx),   // Als Befund 29.9.: Brettseite des Angreifers
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // animation + damage. Listeners may mutate the about-to-deal
      // damage.
      const attackSource = { name: 'Strong Ox Headbutt', owner: pi, heroIdx, controller: pi, heroOwner: ctx.cardHeroOwner ?? pi, usesHeroAtk: true };   // Als Befund 29.9.: Brettseite des Angreifers
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, baseAtk);

      // Sprung-Kopfstoß: EIN Ereignis (kein Ram-Anlauf, keine Explosion mehr). `von`: der angreifende Held (Brettseite), `pow`: 1./2./3. Angriff der Runde.
      // `cardName`: nur für den Rückfall im Client (alter Ram-Anlauf). Der Schaden fällt bei Bild 2 der Animation (Hit-Stop vorbei), Mount-Vorlauf eingerechnet.
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      const _zoneT0 = Date.now();
      engine._broadcastEvent('play_zone_animation', {
        type: 'ox_headbutt', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
        von: { owner: ctx.cardHeroOwner ?? pi, heroIdx, el: true },
        pow: Math.max(1, Math.min(3, attackNumber)), cardName: hero.name,
      });
      await engine._delay(SCHADEN_MS);

      // Deal base ATK damage
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // Discard-/Ability-Rider erst nach dem Ende der Zonen-Animation (Bild 38, Rückweg + Federung): Rest der Animationszeit abwarten (Schaden-Verarbeitung zählt mit).
      await engine._delay(Math.max(0, ENDE_MS - (Date.now() - _zoneT0)));

      // Force opponent to discard (1 normally, 2 if 2nd Attack)
      const discardCount = is2nd ? 2 : 1;
      const oppPs = gs.players[oppIdx];
      if (oppPs && (oppPs.hand || []).length > 0) {
        await engine.actionPromptForceDiscard(oppIdx, discardCount, {
          title: 'Strong Ox Headbutt',
          source: 'Strong Ox Headbutt',
        });
      }

      // 3rd Attack bonus: remove an Ability from target Hero
      // „choose an Ability attached to the target and send it to the discard pile, if possible"
      // 24.10.2026: ALLE Abilities des Helden — die in den Ability Zonen und die Stapel in seinen Support Zonen (Xal, Xalibur). Abgeworfen wird ueber die
      // zentrale Engine-Primitive (`discardAbilityTopCopy`): sie nimmt die oberste Kopie, kennt Zonenart und Stapelhoehe, und „if possible" gilt wirklich
      // (Leafagami Snake schuetzt die Karte, Resistance faengt den Effekt auf den Helden ab).
      if (is3rd && target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          const sammeln = () => engine.getAbilityTargets(tgtOwner, { heroIdx: tgtHeroIdx });
          const abilityTargets = sammeln().map(e => ({
            id: e.id, type: e.type, owner: e.owner, heroIdx: e.heroIdx, slotIdx: e.slotIdx,
            cardName: e.zoneKind === 'support' ? e.cardName : (gs.players[tgtOwner].abilityZones[tgtHeroIdx]?.[e.slotIdx] || []).slice(-1)[0] || e.cardName,   // oberste Kopie
            cardInstance: e.cardInstance || undefined,
          }));

          if (abilityTargets.length > 0) {
            // Ask player if they want to remove an ability
            const wantsRemove = await engine.promptGeneric(pi, {
              type: 'confirm',
              title: 'Strong Ox Headbutt',
              message: `Remove an Ability from ${targetHero.name}?`,
              confirmLabel: '⚒️ Yes, remove!',
              cancelLabel: 'No',
              cancellable: true,
              gerrymanderEligible: true, // True "you may" — opt-in ability removal.
            });

            if (wantsRemove) {
              // Highlight abilities and let player pick one
              const picked = await engine.promptEffectTarget(pi, abilityTargets, {
                maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
                title: 'Strong Ox Headbutt',
                description: `Select an Ability on ${targetHero.name} to remove.`,
                confirmLabel: '⚒️ Remove!',
                confirmClass: 'btn-danger',
                cancellable: true,
                exclusiveTypes: false,                       // Ability Zonen (`ability`) und Support Zonen (`equip`) in einer Wahl
                maxPerType: { ability: 1, equip: 1 },
              });

              if (picked && picked.length > 0) {
                // Nach der Abfrage neu einsammeln: das Brett kann sich bewegt haben, und die Primitive arbeitet auf Slot-Indizes.
                const eintrag = sammeln().find(e => e.id === picked[0]);
                if (eintrag) {
                  const abgeworfen = await engine.discardAbilityTopCopy(eintrag, { source: 'Strong Ox Headbutt', sourceOwner: pi, effectOnHero: true });
                  if (abgeworfen) engine.log('ability_removed', { card: eintrag.cardName, by: 'Strong Ox Headbutt', from: targetHero.name });
                }
              }
            }
          }
        }
      }

      engine.log('ox_headbutt', { player: ps.username, target: target.cardName, baseAtk, attackNumber });
      engine.sync();
    },
  },
};
