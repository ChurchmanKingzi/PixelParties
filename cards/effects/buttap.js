'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Buttap"
//  Creature (Normal, Lv1, 50 HP, Summoning Magic)
//
//  „You may once per turn reveal the top card of your deck. If it is an Attack, Spell or Creature, choose a target and deal damage equal to 50 times the revealed
//   card's level to it, to a maximum of 200, and shuffle the card back into your deck afterwards. Otherwise, add the card to your hand."
//
//  ── NEUER TEXT ──────────────────────────────────────────────────────────
//  Vorher: nur Attack/Spell, sonst nichts; jetzt auch Creatures, und jede andere Karte geht auf die Hand (Datenänderung in `data/cards.json`).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion, keine Kosten), Vorlage: Slave Trader / Sky Archeologist.
//  Ohne Karte im Deck nicht aktivierbar. Aufdecken ist keine Suche.
//    ① „reveal the top card": die Karte fliegt in die Bildmitte und bleibt dort liegen (`haltenImZentrum`), bis entschieden ist, was mit ihr geschieht.
//    ② Attack, Spell ODER Creature (auch Hybridkarten mit einem dieser Typen): „choose a target" — ein beliebiges Ziel auf dem Brett (Helden und Kreaturen beider Seiten, auch die
//       eigenen und Buttap selbst), Pflichtwahl (die Karte ist aufgedeckt, sie lässt sich nicht zurücknehmen). Schaden = 50 × aufgedruckter Level der Karte, höchstens 200
//       (Lv0 = 0, Lv1 = 50, Lv2 = 100, Lv3 = 150, Lv4+ = 200); Typ `creature`. Bei 0 Schaden (Level 0) entfällt die Zielwahl: es gibt nichts zu verteilen.
//       Die Karte fliegt aus der Mitte zurück auf das Deck, dann kommt der Schaden; „and shuffle the card back into your deck afterwards" — das GANZE Deck wird nach dem
//       Schaden gemischt (die Karte liegt dann nicht mehr oben).
//    ③ Jede andere Karte (Artifact, Potion, Ability, Surprise, Area, Hero, …): „add the card to your hand" — sie fliegt aus der Mitte auf die Hand. Das Deck wird nicht gemischt.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `buttap_orbs` (Pixelart, ANIM_REGISTRY): drei rosa-violette Kugeln umkreisen sich auf dem Weg von Buttap zum Ziel und platzen dort zu einem Sternring. Klänge
//  in ZONE_ANIM_SFX; Logs `buttap`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Trifft den gegnerischen Helden mit den wenigsten HP (Kill zuerst), sonst die schwächste gegnerische Kreatur; nie die eigene Seite.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { oberste, haltenImZentrum, gibFrei } = require('./_deck-top-shared');

const CARD_NAME = 'Buttap';
const DAMAGE_PER_LEVEL = 50;
const MAX_DAMAGE = 200;
const ORB_MS = 800;          // Länge der Animation (deckt sich mit `buttap_orbs` im Client)
const ORB_HIT_MS = 540;      // Einschlag bei ~480 ms (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 260;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: () => true,

  /** Aktivierbar, solange das Deck nicht leer ist. */
  canActivateCreatureEffect(ctx) {
    return !!oberste(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const seite = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    const name = oberste(engine, pi);
    if (!ps || !name) return false;

    const cd = engine._getCardDB()[name];
    const trifft = !!cd && (hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell') || hasCardType(cd, 'Creature'));
    const level = trifft ? (Number(cd.level) || 0) : 0;
    const schaden = trifft ? Math.min(MAX_DAMAGE, DAMAGE_PER_LEVEL * level) : 0;

    // ① Aufdecken — die Karte bleibt in der Bildmitte, bis entschieden ist, wohin sie geht.
    const key = await haltenImZentrum(engine, pi, name, { source: CARD_NAME });
    let freigegeben = false;
    try {
      if (!trifft) {
        // ③ „Otherwise, add the card to your hand."
        freigegeben = true;
        await gibFrei(engine, pi, key, name, { dest: 'hand' });
        if (oberste(engine, pi) === name) {
          await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME, reveal: false, _skipFlight: true });
        }
        engine.log('buttap', { player: ps.username, revealed: name, hit: false, toHand: true });
        engine.sync();
        return true;
      }

      // ② Attack/Spell/Creature: ein Ziel wählen (Pflicht), Schaden, dann mischen.
      let ziel = null;
      if (schaden > 0) {
        // pflichtwahl: die Karte ist aufgedeckt, die Wahl des Ziels lässt sich nicht abbrechen.
        const gewaehlt = await ctx.promptMultiTarget({
          types: ['hero', 'creature'],
          side: 'any',
          min: 1,
          max: 1,
          baseDamage: schaden,
          damageType: 'creature',
          title: CARD_NAME,
          description: `${name} (level ${level}) was revealed: deal ${schaden} damage (${DAMAGE_PER_LEVEL} × level, max ${MAX_DAMAGE}) to a target.`,
          confirmLabel: `💥 ${schaden}!`,
          confirmClass: 'btn-danger',
          cancellable: false,
          noSpellCancel: true,
        });
        ziel = Array.isArray(gewaehlt) ? gewaehlt[0] : null;
      }

      // Die Karte fliegt zurück aufs Deck, bevor es knallt.
      freigegeben = true;
      await gibFrei(engine, pi, key, name, { dest: 'deck' });

      let dealt = 0;
      if (ziel) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'buttap_orbs', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: ORB_MS,
          targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx }],
          originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: ctx.card?.zoneSlot ?? -1,
        });
        await engine._delay(ORB_HIT_MS);
        const source = { name: CARD_NAME, owner: pi, heroIdx };
        if (ziel.type === 'hero') {
          const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
          if (hero && hero.hp > 0) {
            const r = await ctx.dealDamage(hero, schaden, 'creature');
            dealt = r?.dealt ?? schaden;
          }
        } else if (ziel.cardInstance && ziel.cardInstance.zone === 'support') {
          const r = await engine.actionDealCreatureDamage(source, ziel.cardInstance, schaden, 'creature', { sourceOwner: pi, canBeNegated: true });
          dealt = r?.dealt ?? schaden;
        }
      }

      // „… and shuffle the card back into your deck afterwards."
      engine.shuffleDeck(pi, 'main');
      engine.log('buttap', {
        player: ps.username, revealed: name, level, hit: true, damage: schaden, dealt,
        target: ziel ? ziel.cardName : null, toHand: false,
      });
      engine.sync();
      if (ziel) await engine._delay(NACH_MS);
      return true;
    } finally {
      // Fehlerpfad: liegt die Karte noch in der Mitte, fliegt sie zurück ins Deck.
      if (!freigegeben) await gibFrei(engine, pi, key, name, { dest: 'deck' });
    }
  },

  /** CPU (Puzzle ohne Gehirn): den gegnerischen Helden mit den wenigsten HP treffen, sonst die schwächste Kreatur; nie die eigene Seite. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' || !engine.isPuzzle) return undefined;
    const { validTargets, config, playerIdx } = payload || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const hp = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.hp ?? Infinity;
    const feinde = validTargets.filter(t => !t.ineligible && t.owner !== playerIdx);
    const helden = feinde.filter(t => t.type === 'hero').sort((a, b) => hp(a) - hp(b));
    const rest = feinde.filter(t => t.type !== 'hero');
    const wahl = helden[0] || rest[0];
    return wahl ? [wahl.id] : undefined;
  },

  _test: { DAMAGE_PER_LEVEL, MAX_DAMAGE },
};
