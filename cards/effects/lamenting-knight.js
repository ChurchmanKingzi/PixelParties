'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Lamenting Knight"
//  Creature (Normal, Lv1, 90 HP, Summoning Magic)
//
//  „You may once per turn choose a Hero and heal it for half its max HP (rounded up)."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion, keine Kosten), Vorlage: Skeleton Healer.
//  Wählbar: jeder LEBENDE Held auf dem Brett, beide Seiten, auch der eigene und der Held, in dessen Zone der Ritter steht („a Hero"). Gewählt wird über `ctx.promptDamageTarget`
//  (Helden, `isHealing: true`): Zielschutz-Regeln (Untargetable, Invisible, …) gelten wie bei jeder Zielwahl, die CPU-Heil-Sicherungen auch. Abbruch ist erlaubt („you MAY"): nichts wird
//  verbraucht.
//  Heilmenge: die HÄLFTE der MAXIMALEN HP des gewählten Helden, AUFGERUNDET (`Math.ceil(maxHp / 2)`: 450 → 225, 475 → 238). Maßgeblich ist der Stand der max HP zum Zeitpunkt der
//  Heilung (Boni wie Toughness oder Arnolds +40 zählen). Geheilt wird über die normale Heilung (`ctx.healHero`): Heilungs-Modifikatoren (Healing Reversed, Doppelheilung …),
//  Obergrenze = max HP. Ein Held, der schon voll ist, darf trotzdem gewählt werden (die Heilung bringt 0).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  HEILENDE TRÄNEN (24.10., Pixelart, `play_zone_animation` `lament_tears`, Quelle → Ziel wie Glasowt): am Ritter quellen zwei Tränen und rinnen die Wange hinab, dann fliegen große
//  Tränen im Bogen zum Helden und regnen über ihm nieder (Spritzer am Boden, grüne Heilkreuze steigen auf); ~1700 ms. Die Heilung greift beim Einschlag (~960 ms). Ursprung ist die Zone
//  des Ritters (liegt er auf Hulijing, die Heldenzone, `originZoneSlot` −1). Klänge in ZONE_ANIM_SFX; Log `lamenting_knight`. Für die entkoppelten Bilder einer NEGIERTEN Karte
//  (`spellVisual`) läuft nur der Regen (`lament_rain`).
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Der EIGENE Held, bei dem die Heilung am meisten bringt (fehlende HP, gedeckelt auf die Heilmenge); nie ein gegnerischer Held, es sei denn, nur gegnerische sind wählbar (dann bricht
//  die CPU ab).
// ═══════════════════════════════════════════

const CARD_NAME = 'Lamenting Knight';
const TRAENEN_MS = 1700;       // Länge der Animation (deckt sich mit `lament_tears` im Client)
const TRAENEN_HIT_MS = 960;    // Einschlag der Tränen: hier greift die Heilung

/** Heilmenge für einen Helden: die Hälfte seiner max HP, aufgerundet. */
function healAmount(hero) {
  const max = Math.max(0, Number(hero?.maxHp ?? hero?.hp) || 0);
  return Math.ceil(max / 2);
}

/** Gibt es irgendeinen lebenden Helden auf dem Brett? */
function hatHeldenZiel(engine) {
  return (engine.gs.players || []).some(ps => (ps?.heroes || []).some(h => h?.name && h.hp > 0));
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: { impact: { type: 'lament_rain' }, impactMs: 700 },

  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  canActivateCreatureEffect(ctx) { return hatHeldenZiel(ctx._engine); },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const seite = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    const zoneSlot = ctx.card.zoneSlot;

    const ziel = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero'],
      damageType: 'other',
      isHealing: true,
      title: CARD_NAME,
      description: 'Choose a Hero. Heal it for half its max HP (rounded up).',
      confirmLabel: '✨ Heal!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!ziel) return false;                         // Abbruch kostet nichts

    const hero = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    const menge = healAmount(hero);

    // Der Ritter weint: Tränen quellen an ihm, fliegen im Bogen zum Helden und regnen über ihm nieder (Pixelart, `lament_tears`). Die Heilung greift beim Einschlag.
    engine._broadcastEvent('play_zone_animation', {
      type: 'lament_tears', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: TRAENEN_MS,
      targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1 }],
      originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: zoneSlot,
    });
    await engine._delay(TRAENEN_HIT_MS);

    if (hero.hp > 0) await ctx.healHero(hero, menge);
    engine.log('lamenting_knight', { player: engine.gs.players[pi]?.username, target: hero.name, amount: menge });
    engine.sync();
    return true;
  },

  /** CPU: den eigenen Helden heilen, bei dem es am meisten bringt; nie einen gegnerischen. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = payload || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const eigene = validTargets.filter(t => !t.ineligible && t.type === 'hero' && t.owner === playerIdx);
    if (eigene.length === 0) return [];
    const nutzen = (t) => {
      const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!h) return -1;
      return Math.min(healAmount(h), Math.max(0, (h.maxHp || h.hp) - h.hp));
    };
    const beste = eigene.slice().sort((a, b) => nutzen(b) - nutzen(a))[0];
    return nutzen(beste) > 0 ? [beste.id] : [];
  },

  _test: { healAmount },
};
