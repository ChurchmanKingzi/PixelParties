
// ═══════════════════════════════════════════
//  CARD EFFECT: "Frost Breaker"
//  Spell (Decay Magic + Destruction Magic Lv1, Normal)
//
//  „Choose a Frozen target. Heal it from its Freeze and deal 100/200/300 damage to it. If the target was already Frozen during
//   your last turn, this counts as an additional Action."
//
//  ── ZIEL: EIN GEFRORENES ZIEL ───────────────────────────────────────────
//  Held oder Kreatur, BEIDE Seiten, sofern gerade Frozen (Held: `statuses.frozen`, Kreatur: `counters.frozen`). Die Zielwahl ist die
//  kanonische Schadens-Zielwahl (`ctx.promptDamageTarget`): Schutz („cannot be chosen"), Umleitung und Reaktionsfenster gelten wie
//  bei jedem Zauber. Ohne gefrorenes Ziel ist die Karte nicht spielbar (`spellPlayCondition`).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  Erst das Auftauen (`cleanse…Statuses` — Sperren wie „status effects cannot be removed" gelten), dann der Schaden. Beides fällt,
//  wenn das Eis in der Animation birst (HIT_MS).
//
//  ── SCALING 100/200/300 — ZWEI SCHULEN ──────────────────────────────────
//  Die Karte trägt zwei Schulen; wie beim Wirken (Stufenanforderung = Summe beider Schulen) zählt hier die SUMME der wirksamen
//  Stufen von Decay Magic und Destruction Magic (`effectiveSchoolLevelForCaster`: „as if"-Effekte wie Demon's Gate zählen), 1–3.
//
//  ── ZUSATZAKTION JE ZIEL (Vertrag wie „Forbidden Curse of Aging") ───────
//  „Das Ziel war schon während deines letzten Zuges Frozen" = der Status liegt noch UND wurde spätestens in deinem letzten eigenen
//  Zug gesetzt (`engine.statusSeitLetztemEigenenZug`; Held: `statuses.frozen.appliedTurn`, Kreatur: `counters.frozenAppliedTurn`;
//  ein Zeitpunkt, den niemand kennt — Puzzle-Aufbau — gilt als „schon vorher"). Ein Freeze aus diesem Zug oder dem Zug des Gegners
//  zählt NICHT.
//    • `inherentAction` ist wahr, sobald IRGENDEIN gefrorenes Ziel so alt ist. Die Karte bleibt auch ohne solches Ziel spielbar —
//      dann kostet sie die Aktion.
//    • Steht eine Rückfall-Aktion bereit (Grund-Aktion, Bonus-Aktion, Geber), sind ALLE gefrorenen Ziele wählbar; ein jüngerer Freeze
//      schaltet die Zusatzaktion nach der Wahl zurück (`gs._spellForcesActionConsume`, der Server bezahlt sie wirklich). Ohne
//      Rückfall (Main Phase, Aktion schon verbraucht) sind NUR die alten Freezes wählbar.
//    • Sofort gewirkt (`gs._immediateActionContext`, Chaos Diamond …): der Guss IST schon die Zusatzaktion — alle gefrorenen Ziele,
//      nichts wird verbraucht.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `frost_breaker` (Pixelart, ANIM_REGISTRY; Vorlage: Lagerfeuer zwischen schmelzenden Schneemännern): Flammen
//  lecken am Eis, Risse laufen, das Eis birst in Splitter, Dampf und Tropfen. Klänge in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { alleGefrorenen } = require('./_frost-shared');

const CARD_NAME = 'Frost Breaker';
const SCHULEN = ['Decay Magic', 'Destruction Magic'];
const DAMAGE = { 1: 100, 2: 200, 3: 300 };
const DAUER_MS = 1500;       // Länge der Animation (deckt sich mit `frost_breaker` im Client)
const HIT_MS = 640;          // Eis birst bei ~540 ms der Animation (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 420;         // Dampf noch ein Stück aufsteigen lassen, bevor der Zauber endet

/** War dieses Ziel schon in `pi`s letztem eigenen Zug Frozen (und ist es noch)? */
function altGenug(engine, pi, obj) {
  return engine.statusSeitLetztemEigenenZug(obj, 'frozen', pi);
}

/** Das Zielobjekt (Held bzw. Kreatur-Instanz) zu einem Ziel der Zielwahl. */
function zielObjekt(engine, t) {
  if (t.type === 'hero') return engine.gs.players[t.owner]?.heroes?.[t.heroIdx] || null;
  return t.cardInstance || null;
}

function istGefroren(t, obj) {
  if (!obj) return false;
  if (t.type === 'hero') return obj.hp > 0 && !!obj.statuses?.frozen;
  return obj.zone === 'support' && !!obj.counters?.frozen;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // CPU: auch gegen ein jüngeres Eis als NORMALE Aktion spielbar (Vertrag `optionalInherent`) — die Frage entscheidet `onPlay`.
  cpuMeta: { optionalInherent: true },

  /** „If the target was already Frozen during your last turn, this counts as an additional Action" — irgendein solches Ziel genügt. */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return alleGefrorenen(engine).some(z => altGenug(engine, pi, z.obj));
  },

  /** Grau, solange nichts gefroren ist. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    return alleGefrorenen(engine).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      // ── Welcher Weg? ──
      //   inhaerent: die Zusatzaktion trägt diesen Einsatz (Engine-Stempel vor `onPlay`); sofort: Sofort-Guss (schon die Zusatzaktion);
      //   sonst bezahlt der Einsatz selbst (normale Aktion oder externer Geber) — dann ist jedes gefrorene Ziel in Ordnung.
      const sofort = !!gs._immediateActionContext;
      const inhaerent = !sofort && gs._spellWasInherent === true;
      const rueckfall = inhaerent && !!engine.hasPayableActionFor?.(pi, CARD_NAME, heroIdx);
      const alleWaehlbar = !inhaerent || rueckfall;

      const stufe = SCHULEN.reduce((n, s) => n + engine.effectiveSchoolLevelForCaster(s, pi, heroIdx, heroSeite), 0);
      const damage = DAMAGE[Math.max(1, Math.min(stufe, 3))];

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        condition: (t) => {
          const obj = zielObjekt(engine, t);
          return istGefroren(t, obj) && (alleWaehlbar || altGenug(engine, pi, obj));
        },
        baseDamage: damage,
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: !inhaerent
          ? `Choose a Frozen target. It is healed from its Freeze and takes ${damage} damage.`
          : alleWaehlbar
          ? `Choose a Frozen target. It is healed from its Freeze and takes ${damage} damage. If it was already Frozen during your last turn this is an additional Action — otherwise it costs an Action.`
          : `Choose a target that was already Frozen during your last turn (an additional Action). It is healed from its Freeze and takes ${damage} damage.`,
        confirmLabel: `🔥 ${damage} Damage!`,
        confirmClass: 'btn-danger',
      });
      if (!ziel) { gs._spellCancelled = true; return; }

      const obj = zielObjekt(engine, ziel);
      const warAlt = !!obj && altGenug(engine, pi, obj);
      // Jüngeres Eis: die Zusatzaktion fällt weg, der Einsatz kostet die nächste Aktion.
      if (inhaerent && !warAlt) {
        gs._spellForcesActionConsume = true;
        engine.log('frost_breaker_no_free_action', { player: ps.username });
      }

      const slot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'frost_breaker', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: slot, duration: DAUER_MS,
      });
      await engine._delay(HIT_MS);

      // ── Auftauen, dann Schaden ──
      let aufgetaut = false;
      if (ziel.type === 'hero') {
        const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (h?.name && h.hp > 0) {
          aufgetaut = engine.cleanseHeroStatuses(h, ziel.owner, ziel.heroIdx, ['frozen'], CARD_NAME).includes('frozen');
          engine.sync();
          await ctx.dealDamage(h, damage, 'destruction_spell');
        }
      } else if (ziel.cardInstance && ziel.cardInstance.zone === 'support') {
        aufgetaut = engine.cleanseCreatureStatuses(ziel.cardInstance, ['frozen'], CARD_NAME).includes('frozen');
        engine.sync();
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx, heroOwner: heroSeite },
          ziel.cardInstance, damage, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('frost_breaker', {
        player: ps.username, target: ziel.cardName, damage, healed: aufgetaut, additional: inhaerent && warAlt,
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },
};
