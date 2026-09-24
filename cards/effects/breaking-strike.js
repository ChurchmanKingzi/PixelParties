// ═══════════════════════════════════════════
//  CARD EFFECT: „Breaking Strike"
//  Attack (Fighting Lv 1, PP DD)
//
//  „Discard any number of Artifacts equipped to the user and choose a
//   target. This Attack deals the user's Attack stat times the number
//   of discarded Artifacts to that target."
//
//  BAUART
//  ──────
//  • Bauform von „Weapon Storm": `hooks.onPlay`, `ctx.cardHeroIdx` ist
//    der Nutzer, Abwurf ueber die Brett-Schleife aus
//    `_ability-cost-shared` — hier aber NUR `kinds: ['equip']`, denn
//    der Text nennt ausschliesslich Artefakte. Ohne ausruestbares
//    Artefakt ist der Angriff nicht spielbar (`canPlayWithHero`).
//
//  • ★ ABBRECHBAR, SOLANGE NICHTS ABGELEGT IST (`cancelAtZero`, v1009):
//    der erste Waehler traegt einen CANCEL-Knopf; wird er gedrueckt,
//    loest der Angriff gar nicht auf und bleibt auf der Hand. Ab der
//    ersten abgelegten Karte heisst der Knopf wieder „Done" und beendet
//    nur das Sammeln — sonst waere die Ausruestung weg und der Angriff
//    trotzdem verpufft.
//
//  • ★ DER ATK-WERT WIRD ERST NACH DEM ABWURF GELESEN (Als Vorgabe
//    12.9.). Das ist keine Feinheit, sondern die halbe Karte: die
//    abgeworfenen Artefakte sind haeufig genau die, die den Angriff
//    erhoehen. Wer drei ATK-Ausruestungen wegwirft, multipliziert also
//    mit dem Wert OHNE sie. `hero.atk` wird deshalb nach der Schleife
//    gelesen, nicht davor.
//
//  • Schaden = ATK × Anzahl. Steht der Held danach auf 0 ATK, ist der
//    Schaden 0 — die Karte laeuft trotzdem durch (der Text kennt keine
//    Untergrenze), der Angriff kommt nur nicht an.
//
//  • Animation `glass_blade_shatter` (Als Vorgabe): ein Schwertstreich,
//    der klirrend Glasscherben hinterlaesst, als waere eine Glasklinge
//    am Ziel zerschellt.
// ═══════════════════════════════════════════

const { sendables, sendCardsLoop, cpuSendFallback } = require('./_ability-cost-shared');

const CARD_NAME = 'Breaking Strike';

/** Ausruestbare Artefakte am Nutzer. */
function equipsAm(engine, pi, heroIdx) {
  try { return sendables(engine, pi, heroIdx).equips || []; } catch { return []; }
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'glass_blade_shatter' }, impactMs: 260 },

  requiresTarget: true,

  // „Artifacts equipped to the user" — ohne eins geht die Karte nicht.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return equipsAm(engine, pi, heroIdx).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }
      if (equipsAm(engine, pi, heroIdx).length === 0) { gs._spellCancelled = true; return; }

      // 1) Abwerfen — mindestens eins, beliebig viele.
      const res = await sendCardsLoop(engine, pi, heroIdx, {
        cardName: CARD_NAME, kinds: ['equip'], min: 1, amount: 0,
        // ★ Abbrechbar, SOLANGE nichts abgelegt ist (Als Vorgabe 12.9.):
        // wer es sich anders ueberlegt, kommt ohne Verlust heraus — der
        // Angriff loest dann gar nicht auf und bleibt auf der Hand
        // (`gs._spellCancelled` unten). Ab der ersten abgelegten Karte
        // heisst der Knopf wieder „Done" und beendet nur das Sammeln.
        cancelAtZero: true,
        confirmLabel: '🗡️ Discard',
        describe: (sent) => sent === 0
          ? `Click an Artifact equipped to ${hero.name} to discard it — each one multiplies the Attack.`
          : `Discarded ${sent} — the Attack will deal ${hero.atk || 0} × ${sent} with the CURRENT Attack stat. Click the next Artifact, or stop here.`,
      });
      if (res.aborted || res.sent === 0) { gs._spellCancelled = true; return; }

      // 2) ★ JETZT erst den ATK-Wert lesen — die Ausruestung ist weg.
      const atk = Math.max(0, hero.atk || 0);
      const dmg = atk * res.sent;
      engine.log('breaking_strike', {
        player: ps.username, hero: hero.name, discarded: res.sent, atk, damage: dmg,
      });

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: dmg,
        title: CARD_NAME,
        description: `Deal ${dmg} damage (${atk} Attack × ${res.sent} Artifact${res.sent > 1 ? 's' : ''}).`,
        confirmLabel: `🗡️ Strike! (${dmg})`,
        confirmClass: 'btn-danger',
        cancellable: false,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });
      if (!target) return;

      const quelle = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      const endgueltig = await engine._fireAttackDeclare(quelle, target, dmg);
      const slot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'glass_blade_shatter',
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot,
        duration: 1300,
      });
      await engine._delay(620);

      if (target.type === 'hero') {
        const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (th && th.hp > 0) await engine.actionDealDamage(quelle, th, endgueltig, 'attack');
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support'
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          await engine.actionDealCreatureDamage(quelle, inst, endgueltig, 'attack',
            { sourceOwner: pi, canBeNegated: true });
        }
      }
      engine.sync();
    },
  },

  // CPU: Lernkanal zuerst (`_abilityCost` am Prompt), sonst alles
  // abwerfen, was keine ATK gibt — der Rest waere Selbstabschwaechung.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    return cpuSendFallback(engine, promptData, {
      cardName: CARD_NAME, keepFighting: false,
    });
  },
};
