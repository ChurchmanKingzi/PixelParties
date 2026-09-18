// ═══════════════════════════════════════════
//  CARD EFFECT: „Memory Blast"
//  Spell (Normal, Destruction Magic Lv2)
//
//  NEUER TEXT (Al 15.9.) — cards.json ist mitgeaendert:
//  "Choose a target your opponent controls and deal damage equal to 10
//   times the number of cards in your opponent's discard pile to it. If
//   that target was originally controlled by you, permanently regain
//   control of it instead."
//
//  ── ★ ZWEI KLAUSELN SIND GESTRICHEN (v1107) ──────────────────────
//  Die Karte war mit zwei Bremsen gebaut; beide sind weg:
//
//    ✗ „This must be the ONLY DAMAGE you deal this turn."
//      → `ps.damageLocked` faellt ersatzlos. Man darf nach Memory Blast
//      in derselben Runde weiter austeilen.
//
//    ✗ „This Spell can NEVER HIT MORE THAN 1 TARGET."
//      → `neverMultiTarget` faellt ersatzlos.
//      ★ FOLGE, die man kennen sollte: Verdopplungs-Effekte duerfen die
//      Karte jetzt ausweiten. „Bomb Berserker Bartas" liest genau diese
//      Flagge und liess sie bisher in Ruhe — bei vollem gegnerischem
//      Ablagestapel trifft der Zauber dann zweimal mit voller Wucht.
//
//  ── WAS BLEIBT ───────────────────────────────────────────────────
//  ① SCHADEN = 10 × Karten im GEGNERISCHEN Ablagestapel. Nicht im
//     eigenen — die Karte bestraft den, der viel abgelegt hat.
//
//  ② ★ DIE ABZWEIGUNG: „If that target was ORIGINALLY CONTROLLED BY
//     YOU, permanently regain control of it INSTEAD." — statt Schaden.
//     Gemessen an `inst.originalOwner`, das sich nie aendert (die
//     Engine fuehrt es ausdruecklich fuer genau solche Faelle). Heisst:
//     hat der Gegner mir eine Kreatur gestohlen, hole ich sie zurueck
//     und tue ihr NICHTS.
//     Nur Kreaturen koennen den Besitzer wechseln — bei einem Helden
//     greift die Abzweigung nie.
//
//  ── ANIMATION ────────────────────────────────────────────────────
//  Al 14.9.: dunkle Magie, deren Blast groesser und zerstoererischer
//  wird, je hoeher der Schaden ausfaellt. `dark_blast` bekommt die
//  Staerke als `power` (0..1) mit; die Skala steht VOR dem Start fest,
//  animiert werden weiter nur `opacity` und `transform`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Memory Blast';
const PRO_KARTE = 10;
// Ab dieser Schadenshoehe ist der Blast maximal — darueber waechst er
// nicht weiter, sonst sprengte er bei einem vollen Ablagestapel das
// halbe Brett.
const VOLLE_WUCHT = 300;

module.exports = {
  /**
   * ★★ v1179 — ENTKOPPELTE ZAUBERBILDER. Eigene Funktion, weil die Wucht
   * (`power`) Flugdauer und Einschlag skaliert. Rein visuell.
   * Bei einer Negation kennt die Engine die Wucht nicht — dann steht sie
   * auf halber Kraft, damit der abgewehrte Stoss trotzdem sichtbar ist.
   */
  async spellVisual(engine, info) {
    const wucht = typeof info.power === 'number' ? info.power : 0.5;
    const ziel = (info.targets || [])[0];
    if (!ziel) return;
    const flug = 620 + Math.round(wucht * 260);
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: info.owner, sourceHeroIdx: info.heroIdx ?? -1,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
      targetZoneSlot: ziel.type === 'hero' ? undefined : ziel.slotIdx,
      projectileShape: 'darkBlast', noTrail: true,
      power: wucht, duration: flug, sfx: 'elem_dark',
    });
    await engine._delay(flug);
    engine._broadcastEvent('play_zone_animation', {
      type: 'dark_blast', power: wucht,
      owner: ziel.owner, heroIdx: ziel.heroIdx,
      zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
      duration: 1100,
    });
    await engine._delay(420);
  },

  requiresTarget: true,
  // ★ v1107: `neverMultiTarget` ENTFERNT — die Klausel steht nicht mehr
  // auf der Karte.

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oppIdx];
      if (!ps || !ops) return;

      // ① 10 × Karten im GEGNERISCHEN Ablagestapel.
      const schaden = (ops.discardPile || []).length * PRO_KARTE;

      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: schaden,
        title: CARD_NAME,
        description: `Deal ${schaden} damage (10 × ${(ops.discardPile || []).length} cards in ${ops.username}'s discard pile).`,
        confirmLabel: `🌑 Blast! (${schaden})`,
        cancellable: true,
      });
      if (!target) { gs._spellCancelled = true; return; }

      // ④ Die Abzweigung ZUERST pruefen — sie ersetzt den Schaden.
      let inst = null;
      if (target.type !== 'hero') {
        inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support'
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
      }
      const warMeine = !!inst && (inst.originalOwner ?? inst.owner) === pi;

      if (warMeine) {
        // Erste freie Zone auf meiner Seite suchen.
        let ziel = null;
        for (let hi = 0; hi < (ps.heroes || []).length && !ziel; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          for (let zi = 0; zi < 3; zi++) {
            if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) { ziel = { hi, zi }; break; }
          }
        }
        if (!ziel) {
          // Kein Platz — dann passiert schlicht nichts. „instead" laesst
          // keinen Rueckfall auf Schaden zu.
          engine.log('memory_blast', { player: ps.username, reclaimed: null, reason: 'no_free_zone' });
          engine.sync();
          return;
        }
        // Rueckholung: derselbe Stoss, nur kleiner.
        await engine.spielZauberBilder(CARD_NAME, {
          owner: pi, heroIdx: ctx.cardHeroIdx, targets: [target], power: 0.35,
        });
        await engine._delay(420);
        await engine.actionTransferCreature(inst, pi, ziel.hi, ziel.zi, {
          source: CARD_NAME, permanent: true,
        });
        engine.log('memory_blast', { player: ps.username, reclaimed: inst.name });
        engine.sync();
        return;
      }

      // ── Sonst: Schaden ───────────────────────────────────────────
      const wucht = Math.max(0, Math.min(1, schaden / VOLLE_WUCHT));
      // ★★ v1179: Bilder ueber `spellVisual` (unten) — dieselbe Folge
      // laeuft auch, wenn der Zauber abgefangen wird. Die Wucht reicht
      // die Karte als `power` mit.
      await engine.spielZauberBilder(CARD_NAME, {
        owner: pi, heroIdx: ctx.cardHeroIdx, targets: [target], power: wucht,
      });

      if (schaden > 0) {
        const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };
        if (target.type === 'hero') {
          const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (hero && hero.hp > 0) {
            await engine.actionDealDamage(quelle, hero, schaden, 'destruction_spell');
          }
        } else if (inst && inst.zone === 'support') {
          await engine.actionDealCreatureDamage(
            quelle, inst, schaden, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // ★ v1107: KEINE Schadenssperre mehr — „This must be the only
      // damage you deal this turn" ist gestrichen. Hier stand frueher
      // `ps.damageLocked = true`, bewusst NACH dem eigenen Schlag.
      engine.log('memory_blast', {
        player: ps.username, target: target.cardName, damage: schaden,
      });
      engine.sync();
    },
  },
};
