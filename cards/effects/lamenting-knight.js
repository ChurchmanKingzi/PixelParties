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
//  Wie Skeleton Healer: Heilstrahl (`play_heal_beam`: steigt vom Ritter auf, trifft den Helden) und `heal_sparkle` auf dem Helden. Klänge laufen über diese Standardbilder;
//  Log `lamenting_knight`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Der EIGENE Held, bei dem die Heilung am meisten bringt (fehlende HP, gedeckelt auf die Heilmenge); nie ein gegnerischer Held, es sei denn, nur gegnerische sind wählbar (dann bricht
//  die CPU ab).
// ═══════════════════════════════════════════

const CARD_NAME = 'Lamenting Knight';

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
  spellVisual: { impact: { type: 'heal_sparkle' }, impactMs: 260 },

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

    // Wie Skeleton Healer: Strahl steigt vom Ritter auf, trifft den Helden, Funkenregen.
    engine._broadcastEvent('play_heal_beam', {
      phase: 'rise', sourceOwner: seite, sourceHeroIdx: heroIdx, sourceZoneSlot: zoneSlot,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx, targetZoneSlot: -1,
    });
    await engine._delay(500);
    engine._broadcastEvent('play_heal_beam', {
      phase: 'strike', sourceOwner: seite, sourceHeroIdx: heroIdx, sourceZoneSlot: zoneSlot,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx, targetZoneSlot: -1,
    });
    await engine._delay(350);
    engine._broadcastEvent('play_zone_animation', { type: 'heal_sparkle', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1 });
    await engine._delay(200);

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
