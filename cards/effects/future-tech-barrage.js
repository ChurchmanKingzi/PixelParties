// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Barrage"
//  Spell (Normal, Lv 3)
//
//  "Choose a target and deal 180 damage to it. Trigger this effect as
//   many times as there are \"Future Tech Barrage\" cards in your
//   discard pile. You can only play 1 \"Future Tech Barrage\" per turn."
//
//  ── Die Karte, an der Als Ruling hängt (21.8.) ──
//  „Trigger this effect as many times as …" heißt **GENAU N Mal**, und
//  die Karte zählt sich dabei NICHT selbst mit — beim Auflösen liegt
//  sie noch in der Hand. Mit leerer Ablage tut dieser Zauber also
//  nichts, kostet eine Aktion und wandert in die Ablage.
//
//  **Das ist so gewollt und deshalb bleibt die Karte spielbar.**
//  Der Leerlauf ist der erste Schritt: die verpuffte Barrage ist die
//  Munition der zweiten. Ein `spellPlayCondition`, das Kopien in der
//  Ablage verlangt, würde den Archetyp abwürgen — siehe die Warnung im
//  Kopf von `_future-tech-shared.js`.
//
//  Unterschied zu Future Tech Mech: dort steht „Repeat this effect",
//  also Grundtreffer plus N. Hier steht „Trigger", also nur N.
//
//  ── EIN Ziel, alle Treffer darauf (Als Korrektur 21.8.) ──
//  „Choose a target" wird EINMAL gefragt, danach schlagen alle
//  Auslösungen auf dasselbe Ziel ein. Meine erste Fassung fragte je
//  Auslösung neu — bei fünf Kopien in der Ablage also fünf Dialoge
//  hintereinander. Falsch gelesen und lästig dazu.
//
//  Stirbt das Ziel zwischendurch, verpuffen die restlichen Treffer;
//  es wird NICHT auf ein Ersatzziel umgeschwenkt.
//
//  ── Animation (Als Vorgabe 21.8.) ──
//  Eine Salve von Blitzen, die vom Caster auf das Ziel schiessen —
//  Vorbild Force Lightning. Umgesetzt ueber den vorhandenen
//  Beam-Kanal mit dem neuen `bolt`-Modus (gezackter Pfad statt
//  gerader Linie), drei Blitze je Ausloesung, Einschlag als
//  `electric_strike`.
//
//  „You can only play 1 per turn" ist die harte Rundensperre je
//  SPIELER (`claimHOPT` — das hängt den Spielerindex selbst an, der
//  Schlüssel darf ihn also nicht enthalten).
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Barrage';
const DAMAGE = 180;
const ANIM_MS = 320;
/** Drei Blitze je Ausloesung — „Salve" statt Einzelschlag. */
const BOLTS_JE_SCHUSS = 3;
const BOLT_ABSTAND_MS = 90;
/** Pause zwischen zwei Treffern, damit jede Zahl einzeln erscheint. */
const TREFFER_ABSTAND_MS = 420;

module.exports = {
  requiresTarget: true,
  // ^ Blinded-Gate (siehe `_hooks.js`).

  // BEWUSST KEIN `spellPlayCondition` auf die Ablage — siehe Kopf.
  // Der einzige echte Riegel ist die Rundensperre.
  spellPlayCondition(gs, pi) {
    return gs.hoptUsed?.[`future-tech-barrage:${pi}`] !== gs.turn;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      if (!engine.claimHOPT('future-tech-barrage', pi)) {
        gs._spellCancelled = true;
        return;
      }

      // ★ Zählstand VOR dem eigenen Ablegen — die Karte ist jetzt noch
      //   in der Hand, zählt sich also nicht mit.
      const treffer = zaehleInAblage(gs, pi, CARD_NAME);

      engine.log('ft_barrage', {
        player: ps.username, shots: treffer, damage: DAMAGE,
      });

      if (treffer === 0) {
        // Kein Abbruch! Der Zauber ist gespielt, verpufft und landet in
        // der Ablage — genau dort wird er gebraucht.
        engine.sync();
        return;
      }

      // EINE Zielwahl fuer die ganze Salve.
      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: DAMAGE * treffer,
        title: CARD_NAME,
        description: treffer > 1
          ? `Choose a target — it takes ${DAMAGE} damage ${treffer} times.`
          : `Choose a target and deal ${DAMAGE} damage to it.`,
        confirmLabel: '🚀 Fire!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) { gs._spellCancelled = true; engine.sync(); return; }

      for (let i = 0; i < treffer; i++) {
        // Ziel schon tot? Dann verpuffen die restlichen Treffer.
        if (ziel.type === 'hero') {
          const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
          if (!h || h.hp <= 0) break;
        } else if (!ziel.cardInstance || ziel.cardInstance.zone !== 'support') break;

        // ── BLITZSALVE (Als Vorgabe 21.8.) ──
        // „Eine Salve von Blitzen, die vom Caster aus auf das Ziel
        // schiessen" — also DREI gezackte Strahlen kurz nacheinander
        // vom wirkenden Helden zum Ziel, ueber den Beam-Kanal mit dem
        // neuen `bolt`-Modus. Der Kanal legt den Klang selbst auf
        // (`elem_lightning`) und zieht den Einschlag hinterher.
        for (let b = 0; b < BOLTS_JE_SCHUSS; b++) {
          engine._broadcastEvent('play_beam_animation', {
            sourceOwner: pi, sourceHeroIdx: ctx.cardHeroIdx ?? 0, sourceZoneSlot: -1,
            targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
            targetZoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
            color: '#9fdcff', glow: '#7cc4ff',
            thickness: 0.8, duration: 700,
            impactAnim: 'electric_strike',
            impactOpacity: 0.75,
            bolt: true,
          });
          if (b < BOLTS_JE_SCHUSS - 1) await engine._delay(BOLT_ABSTAND_MS);
        }
        await engine._delay(ANIM_MS);

        if (ziel.type === 'hero') {
          const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
          if (held && held.hp > 0) await ctx.dealDamage(held, DAMAGE, 'destruction_spell');
        } else if (ziel.cardInstance) {
          await engine.actionDealCreatureDamage(
            { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx ?? -1 },
            ziel.cardInstance, DAMAGE, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }

        // Jeder Treffer bekommt seine EIGENE Schadenszahl (Als
        // Rueckmeldung 21.8.). Der Client leitet die Zahl aus der
        // HP-Differenz zwischen zwei Zustaenden ab — ohne Pause
        // dazwischen fallen alle Treffer in denselben Abgleich und es
        // erscheint nur eine Summe. `sync()` schiebt den Zwischenstand
        // raus, die Pause laesst ihn ankommen.
        if (i < treffer - 1) {
          engine.sync();
          await engine._delay(TREFFER_ABSTAND_MS);
        }
      }

      engine.sync();
    },
  },
};
