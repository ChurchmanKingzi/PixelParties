// ═══════════════════════════════════════════
//  CARD EFFECT: "Energy Drain"
//  Spell (Normal), Lv2, PP ART
//  Spell Schools: Destruction Magic + Support Magic
//
//  "Heal the user for 100 HP. Then, deal damage
//   equal to half the HP healed to all targets your
//   opponent controls (rounded up)."
//
//  Als Ruling (5.8.) — der springende Punkt
//  ────────────────────────────────────────
//  Der AoE-Schaden richtet sich nach der TATSAECHLICH
//  geheilten HP, nicht nach den nominellen 100:
//  wurden nur 50 geheilt, sind es nur 25 Schaden.
//
//  Deshalb wird der Heilbetrag GEMESSEN (HP vorher
//  gegen HP nachher) statt gerechnet. Das deckt alle
//  Faelle automatisch ab, ohne dass die Karte sie
//  einzeln kennen muss:
//    • Held fast voll  -> nur die fehlende Differenz
//    • Held voll       -> 0 geheilt, 0 Schaden
//    • Heilung blockiert (Gift + `blocksPoisonHeal`)
//    • Heilung umgekehrt (Grand Inquisitor Karian)
//      -> negative Differenz, auf 0 geklemmt
//    • Max-HP-Buffs, die die Obergrenze verschieben
//
//  Level in cards.json von 1 auf 2 angehoben (Als
//  Vorgabe 5.8.), Effekttext unveraendert.
// ═══════════════════════════════════════════

const CARD_NAME = 'Energy Drain';
const HEAL_AMOUNT = 100;

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero || hero.hp <= 0) return;

      // 1) Heilen — und den ECHTEN Zuwachs messen.
      const vorher = hero.hp;
      await ctx.healHero(hero, HEAL_AMOUNT);
      const geheilt = Math.max(0, (hero.hp || 0) - vorher);

      // 2) Schaden = die Haelfte davon, aufgerundet.
      const schaden = Math.ceil(geheilt / 2);

      engine.log('energy_drain', {
        player: gs.players[pi]?.username,
        hero: hero.name,
        healed: geheilt,
        damage: schaden,
      });

      // Nichts geheilt -> nichts zu verteilen. Der Zauber ist damit
      // wirkungslos, aber nicht ungueltig: der Kartentext verbietet
      // das Spielen bei vollen HP nicht.
      if (schaden <= 0) {
        engine.sync();
        return;
      }

      // ── ABSAUG-ANIMATION (Als Vorgabe 5.8.) ─────────────────────────
      // Stroeme einzelner gruener BLASEN, die langsam aus ALLEN Zielen
      // heraus und zum geheilten Helden fliegen. Bewusst KEIN Strahl:
      // `play_beam_animation` zeichnet eine Linie, das las sich als
      // schneller Laser.
      //
      // Umgesetzt ueber `play_projectile_animation` mit der neuen Form
      // `projectileShape: 'bubble'` — je Quelle mehrere Blasen mit
      // Versatz, dadurch entsteht ein Strom statt eines Einzelschusses.
      // Die Richtung ist umgekehrt zur ueblichen Angriffs-Anzeige:
      // QUELLE ist das abgesaugte Ziel, ZIEL der Held.
      //
      // Steht NACH der Heilmessung: bei 0 geheilten HP kommt die Karte
      // gar nicht bis hierher, also gibt es dann auch keine Animation.
      const BLASEN_JE_QUELLE = 5;
      const BLASEN_ABSTAND_MS = 130;   // Versatz innerhalb eines Stroms
      const BLASEN_FLUGZEIT_MS = 1500; // langsam, wie gewuenscht

      const oi = pi === 0 ? 1 : 0;
      const ops = gs.players[oi];
      const quellen = [];
      for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
        if (!ops.heroes[hi]?.name || ops.heroes[hi].hp <= 0) continue;
        quellen.push({ heroIdx: hi, zoneSlot: undefined });
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== oi) continue;
        quellen.push({ heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
      }

      if (quellen.length) {
        for (let n = 0; n < BLASEN_JE_QUELLE; n++) {
          // Alle Quellen gleichzeitig, damit die Stroeme parallel
          // laufen; der Versatz entsteht ueber die Wellen-Schleife.
          for (const q of quellen) {
            engine._broadcastEvent('play_projectile_animation', {
              sourceOwner: oi,
              sourceHeroIdx: q.heroIdx,
              ...(q.zoneSlot != null ? { sourceZoneSlot: q.zoneSlot } : {}),
              targetOwner: pi,
              targetHeroIdx: heroIdx,
              projectileShape: 'bubble',
              noTrail: true,
              duration: BLASEN_FLUGZEIT_MS,
              // Leichte Groessen- und Farbstreuung, damit der Strom
              // nicht wie eine Perlenkette aussieht.
              emojiStyle: {
                width: (10 + Math.round(Math.random() * 8)) + 'px',
                height: (10 + Math.round(Math.random() * 8)) + 'px',
                opacity: 0.75 + Math.random() * 0.25,
              },
            });
          }
          if (n < BLASEN_JE_QUELLE - 1) await engine._delay(BLASEN_ABSTAND_MS);
        }
        // Letzte Blasen ankommen lassen, bevor die Schadenszahlen
        // erscheinen. Gesamtdauer bleibt damit knapp unter 2 s.
        await engine._delay(900);
      }

      await ctx.aoeHit({
        damage: schaden,
        damageType: 'destruction_spell',
        side: 'enemy',
        types: ['hero', 'creature'],
        // Kein zusaetzlicher Zonen-Effekt: der gruene Strom IST die
        // Animation dieser Karte.
        animationType: null,
        sourceName: CARD_NAME,
      });
      engine.sync();
    },
  },
};
