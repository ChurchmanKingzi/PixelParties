'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Glasowt"
//  Creature (Normal, Lv1, 50 HP, Summoning Magic)
//
//  „You may once per turn choose a Burned target and deal 200 damage to it. This damage cannot be reduced, negated or redirected."
//
//  ── NEUER TEXT ──────────────────────────────────────────────────────────
//  Vorher: ein Ziel, das gegen Schaden immun ist oder nicht gewählt werden kann. Jetzt: ein VERBRANNTES Ziel (Datenänderung in `data/cards.json`).
//
//  ── ZIEL ────────────────────────────────────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz; keine Aktion, keine Kosten), Vorlage: Assault Eagle. Wählbar: jeder lebende HELD und jede KREATUR auf dem Brett, beide Seiten, die
//  gerade „Burned" ist (Held: Status `burned`; Kreatur: Zähler `burned`) — auch die eigenen. Alles andere steht AUSGEGRAUT in der Liste (`condition` + `dimUnmetCondition`).
//  Gewählt wird über `ctx.promptMultiTarget`: Zielschutz-Regeln (Untargetable, Invisible, Alliance, …) gelten wie bei jeder Zielwahl. Ohne verbranntes Ziel ist die Fähigkeit nicht
//  aktivierbar. Abbrechen ist erlaubt („you MAY"): nichts wird verbraucht.
//
//  ── „CANNOT BE REDUCED, NEGATED OR REDIRECTED" ──────────────────────────
//  Wortlaut wie Acid Vial: Der Schaden ist echter Schaden (`actionDealTrueDamage`): keine Reduzierung, kein Multiplikator, keine Negierung durch Schilde oder Immunitäten; nur die
//  Spielstart-Schutzzeit eines Spielers bleibt absolut (wie bei jedem True Damage). Das Skript trägt `cannotBeRedirected: true`: umleitende Effekte (Bubbles, Monia Bot, Cactus
//  Creature …) lassen den Treffer durch, und die Zielwahl öffnet keine Umleit-Fenster (negierende Surprises werden weiter angeboten: „cannot be redirected" ≠ „cannot be negated" —
//  der DAMAGE-Text nennt zwar „negated", gemeint ist wie bei Acid Vial der Schaden, nicht die Wahl des Ziels).
//  Der Schaden zählt als Kreatureneffekt (Typ `creature`).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `glasowt_fireball` (Pixelart, ANIM_REGISTRY): Glasowt WIRFT einen Feuerball im hohen Bogen auf das Ziel; er flackert, zieht Flammen und Glut hinter sich her und platzt beim
//  Aufprall zu einem Feuerring, am Ziel lodern Flammenzungen auf. Klänge in ZONE_ANIM_SFX; Log `glasowt`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Bevorzugt einen gegnerischen Helden, der damit fällt, dann den mit den meisten HP; sonst die gegnerische Kreatur. Nie die eigene Seite.
// ═══════════════════════════════════════════

const CARD_NAME = 'Glasowt';
const DAMAGE = 200;
const WURF_MS = 820;           // Länge der Animation (deckt sich mit `glasowt_fireball` im Client)
const WURF_HIT_MS = 600;       // Einschlag bei ~500 ms (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 260;

/** Ist dieses Ziel gerade verbrannt? */
function istVerbrannt(t, engine) {
  if (!t) return false;
  if (t.type === 'hero') return !!engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.statuses?.burned;
  return !!(t.cardInstance || t._cardInstance)?.counters?.burned;
}

/** Gibt es irgendwo ein verbranntes Ziel? (Held lebt / Kreatur liegt offen im Brett) */
function hatVerbranntesZiel(engine) {
  const gs = engine.gs;
  for (let seite = 0; seite < (gs.players || []).length; seite++) {
    for (const h of (gs.players[seite]?.heroes || [])) {
      if (h?.name && h.hp > 0 && h.statuses?.burned) return true;
    }
  }
  for (const inst of (engine.cardInstances || [])) {
    if (!inst || inst.zone !== 'support' || inst.faceDown) continue;
    if (!inst.counters?.burned) continue;
    if (engine._istKreaturenInstanz && !engine._istKreaturenInstanz(inst)) continue;
    return true;
  }
  return false;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: () => true,
  // Wortlaut „cannot be reduced, negated or redirected" (Acid Vial): Umleiter (Bubbles, Monia Bot, …) fragen dieses Flag am Quell-Skript ab.
  cannotBeRedirected: true,

  /** Aktivierbar, solange irgendwo ein verbranntes Ziel liegt. */
  canActivateCreatureEffect(ctx) {
    return hatVerbranntesZiel(ctx._engine);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const seite = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    if (!hatVerbranntesZiel(engine)) return false;

    const gewaehlt = await ctx.promptMultiTarget({
      types: ['hero', 'creature'],
      side: 'any',
      min: 1,
      max: 1,
      condition: (t, eng) => istVerbrannt(t, eng),
      dimUnmetCondition: true,
      baseDamage: DAMAGE,
      damageType: 'creature',
      cannotBeRedirected: true,
      title: CARD_NAME,
      description: `Choose a Burned target. It takes ${DAMAGE} damage that cannot be reduced, negated or redirected.`,
      confirmLabel: `🔥 ${DAMAGE}!`,
      confirmClass: 'btn-danger',
      cancellable: true,
      noSpellCancel: true,      // ein Kreatureneffekt ist kein Zauber: keine Abbruchmarke hinterlassen
    });
    const ziel = Array.isArray(gewaehlt) ? gewaehlt[0] : null;
    if (!ziel) return false;      // Abbruch kostet nichts

    // Der Feuerball fliegt von Glasowt zum Ziel.
    engine._broadcastEvent('play_zone_animation', {
      type: 'glasowt_fireball', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: WURF_MS,
      targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx }],
      originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: ctx.card?.zoneSlot ?? -1,
    });
    await engine._delay(WURF_HIT_MS);

    const source = { name: CARD_NAME, owner: pi, heroIdx };
    let dealt = 0;
    if (ziel.type === 'hero') {
      const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (hero && hero.hp > 0) {
        const r = await engine.actionDealTrueDamage(source, hero, DAMAGE, { type: 'creature' });
        dealt = r?.dealt || 0;
      }
    } else if (ziel.cardInstance && ziel.cardInstance.zone === 'support') {
      const r = await engine.actionDealTrueDamage(source, ziel.cardInstance, DAMAGE, { type: 'creature' });
      dealt = r?.dealt || 0;
    }
    engine.log('glasowt', { player: gs.players[pi]?.username, target: ziel.cardName, damage: dealt });
    engine.sync();
    await engine._delay(NACH_MS);
    return true;
  },

  /** CPU: einen verbrannten GEGNER treffen — Kill zuerst, sonst der Held mit den meisten HP, sonst die Kreatur. Nie die eigene Seite. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = payload || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible && t.owner !== playerIdx);
    if (frei.length === 0) return [];
    const hp = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.hp ?? 0;
    const helden = frei.filter(t => t.type === 'hero');
    const kills = helden.filter(t => hp(t) <= DAMAGE).sort((a, b) => hp(b) - hp(a));
    if (kills.length) return [kills[0].id];
    if (helden.length) return [helden.sort((a, b) => hp(b) - hp(a))[0].id];
    return [frei[0].id];
  },

  _test: { istVerbrannt, hatVerbranntesZiel, DAMAGE },
};
