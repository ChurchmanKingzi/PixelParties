// ═══════════════════════════════════════════
//  CARD EFFECT: „Soul Transmigration Ritual"
//  Spell · Normal · Magic Arts Lv0 · PP MBS1
//  (v1329: Decay → Magic Arts; v1330: Attachment → Normal, Debuff statt Anhaengen)
//
//  „Sacrifice 3 level 0 Creatures you control to use this Spell. Choose
//   a defeated Hero you control and revive it, healing its HP
//   completely. If the user has at least Magic Arts 1, this counts as an
//   additional Action. The next time the revived Hero is defeated,
//   delete it and all cards in its Ability and Support Zones, except
//   Creatures."
//
//  ── ABLAUF (onPlay) ───────────────────────────────────────────────
//  1. ZIEL: ein besiegter eigener Held. Abbrechbar (Als Regel 23.9.) —
//     die Karte bleibt dann auf der Hand.
//  2. PREIS: genau 3 Creatures mit AKTUELLEM Level 0 opfern (Grundlevel
//     plus `counters.level`, wie Rocky Slime es fuehrt). Ueber
//     `resolveSacrificeCost` — damit gelten Hand-Ersatz (Chosen
//     Sacrifice), `cannotBeSacrificed`, Cardinal-Immunitaet und die
//     Rettung eines Opfers (Barrier of Undying → der Zauber fizzelt,
//     ist aber gespielt; das wertet der Server ueber `nimmOpferFizzle`).
//     Bild (v1331): dunkle Faeden von allen Opfern gleichzeitig zum
//     gefallenen Helden (`play_tether_animation`), statt Messer je Opfer.
//  3. WIEDERBELEBEN mit vollen HP (`actionReviveHero`, max HP) — Bild
//     `undead_revival` (Runenkreis, mit Klang).
//  4. DEBUFF „Soul Transmitted" (Als Vorgabe 24.9.): NICHT ENTFERNBAR —
//     nicht heil-, nicht uebertragbar, auch nicht abfangbar. Er wird
//     direkt gesetzt, nicht ueber `addHeroStatus`: er ist Teil der
//     Wiederbelebung, kein Angriff, und darf weder umgeleitet
//     (Status-Surprises) noch abgefangen (Resistance) werden.
//
//  ── DIE SCHLUSSKLAUSEL ────────────────────────────────────────────
//  Traeger ist der STATUS (`soul_transmitted` in STATUS_EFFECTS mit
//  `deletesHeroOnDefeat`). Wird der Held besiegt, loescht die Engine
//  ihn samt ALLEN Karten seiner Ability- und Support-Zonen — ausser
//  Creatures (`_runHeroDefeatSequence` → `deleteHero` mit
//  `supportPile: 'deleted'`). Verhindert ein Effekt die Niederlage
//  (Guardian Angel), greift nichts; der Debuff bleibt.
//
//  ── ZIELREGELN ────────────────────────────────────────────────────
//  Waehlbar ist jeder besiegte eigene Held. Magie-Immunitaet schirmt
//  gegen diese Karte ab — aber ein BESIEGTER Held ist nie magieimmun
//  (Als Regel 24.9., zentral in der Engine: `_isHeroSpellProtected`
//  und das Todes-Aufraeumen).
//
//  ── ZUSATZAKTION ──────────────────────────────────────────────────
//  „If the user has at least Magic Arts 1" — `inherentAction` als
//  Funktion ueber `effectiveSchoolLevelForCaster` (Performance, Xal &
//  Co. zaehlen mit, wie bei Dive Down). Ohne Magic Arts kostet der
//  Einsatz die Aktion.
// ═══════════════════════════════════════════

const CARD_NAME = 'Soul Transmigration Ritual';
const SCHULE = 'Magic Arts';
const OPFER = 3;

const STATUS = 'soul_transmitted';

/** Besiegte eigene Helden, die diese Karte waehlen kann. */
function waehlbareHelden(engine, pi) {
  const ps = engine.gs.players?.[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp > 0) continue;
    if (engine._isHeroSpellProtected?.(h, CARD_NAME)) continue;
    out.push(hi);
  }
  return out;
}

/** Aktuelles Level eines Opferkandidaten (Grundlevel + Aenderungen). */
function aktuellesLevel(c) {
  return (c?.level || 0) + (c?.inst?.counters?.level || 0);
}

const FADEN_MS = 1500;

/**
 * ★ v1331 (Als Vorgabe 24.9., Kartenbild als Vorlage): dunkle, magische
 * Faeden von den Opfern zum gefallenen Helden — ALLE gleichzeitig, bevor
 * die Opfer fallen und der Held aufsteht. Hand-Ersatz (Chosen Sacrifice)
 * hat keinen Brettplatz und bekommt keinen Faden.
 */
async function faedenZiehen(engine, pi, heroIdx, gewaehlt) {
  const quellen = (gewaehlt || [])
    .map(t => t?.cardInstance)
    .filter(i => i && i.zone === 'support' && i.heroIdx >= 0 && i.zoneSlot >= 0)
    .map(i => ({ owner: i.owner, heroIdx: i.heroIdx, zoneSlot: i.zoneSlot }));
  if (quellen.length === 0) return;
  engine._broadcastEvent('play_tether_animation', {
    sources: quellen, targetOwner: pi, targetHeroIdx: heroIdx, targetZoneSlot: -1,
    duration: FADEN_MS, color: '#b56cff', glow: 'rgba(70,10,130,0.9)', sfx: 'elem_dark',
  });
  await engine._delay(FADEN_MS - 150);
}

/** Der Preis: genau 3 Creatures mit Level 0. */
function opferSpec(zielHeroIdx) {
  return {
    minCount: OPFER, maxCount: OPFER,
    filter: c => aktuellesLevel(c) === 0,
    showFilteredAsIneligible: true,
    title: `${CARD_NAME} — Sacrifice`,
    description: `Sacrifice ${OPFER} level 0 Creatures you control to perform the ritual.`,
    confirmLabel: '🕯️ Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
    // Faeden statt Messer — die Opferung IST das Ritual.
    ...(Number.isInteger(zielHeroIdx) ? {
      sacrificeAnimation: false,
      onTributesChosen: (ctx, gewaehlt) => faedenZiehen(ctx._engine, ctx.cardOwner, zielHeroIdx, gewaehlt),
    } : {}),
  };
}

module.exports = {
  // ★★ ENTKOPPELTE BILDER (CARD_API): wird die Karte negiert, laeuft ihr
  // Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: { impact: { type: 'undead_revival' }, impactMs: 300 },

  requiresTarget: true,
  activeIn: ['hand'],

  cpuMeta: { reviveCard: true },

  /** „If the user has at least Magic Arts 1, this counts as an additional Action." */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine || !Number.isInteger(heroIdx) || heroIdx < 0) return false;
    return (engine.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx) || 0) >= 1;
  },

  /** Nur spielbar mit einem waehlbaren Helden UND bezahlbarem Preis. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    if (waehlbareHelden(engine, pi).length === 0) return false;
    return engine.canSatisfySacrifice(pi, opferSpec(), null);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ── 1. Ziel ──────────────────────────────────────────────────
      const kandidaten = waehlbareHelden(engine, pi);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }
      const ziele = kandidaten.map(hi => ({
        id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi,
        cardName: ps.heroes[hi].name,
      }));
      const wahl = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        description: 'Choose a defeated Hero you control to revive with full HP.',
        confirmLabel: '🕯️ Revive!',
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        maxTotal: 1,
      });
      const ziel = ziele.find(z => z.id === wahl?.[0]);
      if (!ziel) { gs._spellCancelled = true; return; }

      // ── 2. Preis ─────────────────────────────────────────────────
      const bezahlt = await engine.resolveSacrificeCost(ctx, opferSpec(ziel.heroIdx));
      if (!bezahlt) { gs._spellCancelled = true; return; }   // Abbruch — oder Rettung (Server: fizzelt)

      // ── 3. Wiederbeleben ─────────────────────────────────────────
      const held = ps.heroes[ziel.heroIdx];
      if (!held?.name || held.hp > 0) {
        engine.log('soul_transmigration_fizzle', { player: ps.username, reason: 'target_gone' });
        return;                     // Preis bezahlt, Ziel weg — Karte gespielt, keine Wirkung
      }
      const ok = await engine.actionReviveHero(pi, ziel.heroIdx, held.maxHp || 0, {
        source: CARD_NAME, animationType: 'undead_revival', animDelay: 900,
      });
      if (!ok) {
        engine.log('soul_transmigration_fizzle', { player: ps.username, reason: 'revive_failed' });
        return;
      }

      // ── 4. Der unentfernbare Debuff ───────────────────────────────
      if (!held.statuses) held.statuses = {};
      held.statuses[STATUS] = {
        appliedTurn: gs.turn || 0, permanent: true, unhealable: true,
        source: CARD_NAME, appliedBy: pi,
      };
      engine._heldenStatusVerursacher(held.statuses[STATUS], { appliedBy: pi, source: ctx.card });   // v1399
      engine._broadcastEvent('play_zone_animation', {
        type: 'soul_shard_dark_grant', owner: pi, heroIdx: ziel.heroIdx, zoneSlot: -1,
      });
      engine.log('status_add', { target: held.name, status: STATUS, source: CARD_NAME });
      engine.log('soul_transmigration', { player: ps.username, hero: held.name });
      engine.sync();
    },
  },

};
