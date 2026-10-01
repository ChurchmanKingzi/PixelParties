// ═══════════════════════════════════════════
//  CARD EFFECT: "Tempeste Moana, the Rain Singer"
//  Hero — 400 HP, 40 ATK (Magic Arts + Singing)
//
//  „The first 2 Artifacts equipped and Spells attached to any Hero each
//   turn also count as Creatures with 50 HP. If an Artifact's or Spell's
//   HP are reduced to 0, it is sent to the discard pile. Equipping an
//   Artifact or attaching a Spell also counts as summoning it as a
//   Creature. You may once per turn deal damage equal to 50 times the
//   number of Creatures on the board that are originally Equipments or
//   Attachments to any target."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „Equipped Artifacts" = Artefakte mit Subtyp Equipment, „attached
//    Spells" = Zauber mit Subtyp Attachment, die in eine Support Zone
//    EINES BELIEBIGEN Helden (auch des Gegners) kommen. Gezaehlt wird
//    zugweit ueber beide Seiten zusammen: die ersten 2 Karten dieser Art
//    pro Zug. Ab der dritten bleibt eine Karte, was sie ist.
//  • „also count as" = die Karte bleibt Artefakt/Zauber UND ist zusaetzlich
//    Creature (Kartentyp „Artifact/Creature" bzw. „Spell/Creature") —
//    `_cardDataOverride`, 50 HP (Biomancy-Muster). Sie bleibt Equipment
//    bzw. Attachment, ihre bisherigen Effekte laufen weiter.
//  • 0 HP → die Engine behandelt sie als besiegte Creature: Ablagestapel
//    ihres Besitzers (nicht „besiegt"-geloescht).
//  • „also counts as summoning": nach dem Umstempeln feuert die normale
//    Beschwoerungs-Meldung (`onCardEnterZone` mit `_moanaSummon`, dazu
//    das Hand-Reaktionsfenster nach Beschwoerungen). `onPlay` der Karte
//    selbst feuert NICHT noch einmal — sie ist ja schon gespielt.
//  • Aktiver Effekt: einmal pro Zug (Held-Effekt-Sperre der Engine), der
//    Schaden = 50 × Zahl der Creatures auf dem Brett (BEIDE Seiten), die
//    im Kartenwerk ein Equipment-Artefakt oder Attachment-Zauber sind
//    und gerade als Creature zaehlen. Ziel: ein beliebiges Ziel (Held
//    oder Creature, beide Seiten). Mit 0 solcher Creatures nicht
//    aktivierbar.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Tempeste Moana, the Rain Singer';
const MAX_PER_TURN = 2;
const CREATURE_HP = 50;
const DMG_PER = 50;

/** Ist diese Karte (laut Kartenwerk) ein Equipment-Artefakt / Attachment-Zauber? */
function isOriginalEquipOrAttach(cd) {
  if (!cd) return false;
  const st = (cd.subtype || '').toLowerCase();
  if (hasCardType(cd, 'Artifact') && st === 'equipment') return true;
  if (hasCardType(cd, 'Spell') && st === 'attachment') return true;
  return false;
}

/** Creatures auf dem Brett, die urspruenglich Equipment/Attachment sind. */
function zaehleCreatures(engine) {
  const db = engine._getCardDB();
  let n = 0;
  for (const c of engine.cardInstances) {
    if (c.zone !== 'support') continue;
    if (!c.counters?._moanaCreature) continue;
    if (!isOriginalEquipOrAttach(db[c.name])) continue;
    const eff = engine.getEffectiveCardData(c);
    if (!hasCardType(eff, 'Creature')) continue;
    if ((c.counters.currentHp ?? 0) <= 0) continue;
    n++;
  }
  return n;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  hooks: {
    onCardEnterZone: async (ctx) => {
      if (ctx._moanaSummon) return;
      if (ctx.toZone !== 'support') return;
      const inst = ctx.enteringCard;
      const engine = ctx._engine;
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?._cardDataOverride || inst.counters?._moanaCreature) return;
      const db = engine._getCardDB();
      const cd = db[inst.name];
      if (!isOriginalEquipOrAttach(cd)) return;

      // Zugweiter Zaehler ueber beide Seiten.
      const gs = engine.gs;
      if (!gs._moanaZaehler || gs._moanaZaehler.turn !== gs.turn) gs._moanaZaehler = { turn: gs.turn, n: 0 };
      if (gs._moanaZaehler.n >= MAX_PER_TURN) return;
      gs._moanaZaehler.n++;

      if (!inst.counters) inst.counters = {};
      inst.counters._moanaCreature = true;
      inst.counters._cardDataOverride = {
        ...cd,
        cardType: `${cd.cardType}/Creature`,
        hp: CREATURE_HP,
        level: 0,
      };
      inst.counters.currentHp = CREATURE_HP;
      inst.counters.maxHp = CREATURE_HP;
      engine.log('moana_creature', { card: inst.name });
      engine.sync();

      // „Counts as summoning it as a Creature."
      const host = inst.controller ?? inst.owner;
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: inst.heroIdx,
        _moanaSummon: true, _skipReactionCheck: false,
      });
      await engine._checkPostSummonHandReactions(host, inst, { _moanaSummon: true });
    },
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
    const hero = engine.gs.players[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return zaehleCreatures(engine) > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const feld = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[feld]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const n = zaehleCreatures(engine);
    if (n <= 0) return false;
    const schaden = DMG_PER * n;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      baseDamage: schaden,
      title: CARD_NAME,
      description: `Deal ${schaden} damage (50 × ${n} Equipment/Attachment Creature${n === 1 ? '' : 's'}) to any target.`,
      confirmLabel: `🌧️ ${schaden} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    engine._broadcastEvent('play_zone_animation', {
      type: 'moana_rain',
      owner: target.owner, heroIdx: target.heroIdx,
      zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
    });
    await engine._delay(1100);

    if (target.type === 'hero') {
      if (tgtHero && tgtHero.hp > 0) await ctx.dealDamage(tgtHero, schaden, 'other');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, schaden, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('moana_rain', { player: gs.players[pi]?.username, damage: schaden, creatures: n });
    engine.sync();
    return true;
  },
};
