// ═══════════════════════════════════════════
//  CARD EFFECT: "Calm Diatribe"
//  Spell (Normal, Lv3, Magic Arts)
//
//  „Choose a Hero you control, except the user. You may perform a second
//   Action with that Hero during your Action Phase next turn. This counts
//   as an additional Action."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Der gewaehlte Held bekommt den Buff `calm` (Abzeichen am Helden). Er
//    ueberlebt den Tod des Helden — er ist eine NACHWIRKUNG
//    (`NACHWIRKUNGEN` im Engine-Todesraeumer, wie `blessed_skill`).
//  • ZWEI ABZEICHEN: `calm` (🌙) kuendigt die zweite Aktion nur AN (gilt erst im naechsten Zug);
//    zu Beginn dieses Zuges wechselt es zu `calm_ready` (🕊️), dessen Tooltip sagt, dass die
//    zweite Aktion in DIESER Action Phase bereitsteht. Beide sind Nachwirkungen.
//  • Die Zusage haengt — wie bei Weapon Unleashing — an der Karten-INSTANZ, die
//    nach dem Resolve in der Ablage weiterlebt (`_spellKeepInstance`). Sie wird
//    ERST zu Beginn des naechsten eigenen Zuges eingerichtet (heldengebundene
//    Second-Action-Zusage, `_second-action-shared`); „this counts as an
//    additional Action" ist genau deren Semantik.
//  • Der Buff endet, sobald die Zusage eingeloest ODER verfallen ist: Verfall am
//    Ende der Action Phase des naechsten Zuges (auch bei totem Helden), Verlust
//    der Zusage an eine andere zweite Aktion (Fizzle) oder Verlassen der Ablage.
//  • INHERENTE Zusatzaktion: das Spielen der Karte kostet selbst keine Aktion.
//  • Puzzle-Editor: Helden koennen den Buff `calm` zugewiesen bekommen. Dafuer
//    legt `ensureCalmProviders` zu Spielbeginn eine unsichtbare Anbieter-Instanz
//    an; die Zusage gilt dann gleich in der ersten Action Phase.
// ═══════════════════════════════════════════

const { secondActionHooks, isSecondActionGrant } = require('./_second-action-shared');
const { heldSeite } = require('./_hooks');

const CARD_NAME = 'Calm Diatribe';
const TYPE_ID_PREFIX = 'second_action:calm-diatribe:';
const BUFF = 'calm';             // angekuendigt: gilt erst im naechsten Zug
const BUFF_READY = 'calm_ready'; // aktiv: die zweite Aktion steht in DIESER Action Phase bereit

/** Lebende Helden, die `pi` KONTROLLIERT — Ziel-IDs bleiben physisch (Styx 28.9.). */
function kontrollierteHeldenZiele(engine, pi) {
  return engine.heroesControlledBy(pi)
    .filter(({ hero }) => hero?.name && hero.hp > 0)
    .map(({ physOwner, heroIdx, hero }) => ({
      id: `hero-${physOwner}-${heroIdx}`, type: 'hero', owner: physOwner, heroIdx, cardName: hero.name,
    }));
}

function ziele(engine, pi, userSeite, userIdx) {
  return kontrollierteHeldenZiele(engine, pi).filter(t => !(t.owner === userSeite && t.heroIdx === userIdx));
}

function grantLebt(inst) {
  return Object.values(inst?.counters?.aaGrants || {}).some(v => v > 0);
}

/** Buff vom Helden nehmen — nur, wenn kein anderer Calm-Anbieter ihn noch braucht. */
function entferneCalm(engine, inst) {
  const c = inst?.counters;
  if (!c?._calmLive) return;
  c._calmLive = false;
  const seite = c._grantSeite ?? inst.owner;
  const hi = c._calmHero;
  const hero = engine.gs.players[seite]?.heroes?.[hi];
  if (!hero?.buffs?.[BUFF] && !hero?.buffs?.[BUFF_READY]) return;
  const anderer = engine.cardInstances.some(o => o.id !== inst.id && o.counters?._calmLive
    && o.counters._calmHero === hi && (o.counters._grantSeite ?? o.owner) === seite);
  if (anderer) return;
  delete hero.buffs[BUFF];
  delete hero.buffs[BUFF_READY];
  engine.log('calm_faded', { hero: hero.name });
  engine.sync();
}

/** Zusage einrichten (idempotent). */
function richteZusageEin(engine, inst) {
  const c = inst.counters;
  if (c._calmGranted) return;
  const hero = engine.gs.players[c._grantSeite ?? inst.owner]?.heroes?.[c._calmHero];
  if (!hero?.name) return;
  c._calmGranted = true;
  // Das Abzeichen wechselt von „angekuendigt" (`calm`) zu „bereit" (`calm_ready`).
  if (hero.buffs?.[BUFF]) {
    hero.buffs[BUFF_READY] = { ...hero.buffs[BUFF], activatedTurn: engine.gs.turn };
    delete hero.buffs[BUFF];
  }
  const typeId = `${TYPE_ID_PREFIX}${inst.id}`;
  engine.registerAdditionalActionType(typeId, {
    label: hero.name,
    allowedCategories: ['creature', 'spell', 'attack', 'ability_activation', 'hero_effect_activation'],
    heroRestricted: true,
    isSecondActionGrant: true,
    sourceLabel: CARD_NAME,
    expiresAtTurnEnd: true,
  });
  engine.grantAdditionalAction(inst, typeId);
  engine.log('calm_granted', { hero: hero.name });
  engine.sync();
}

/**
 * Puzzle-Editor: Helden mit `buffs.calm` ohne Anbieter bekommen einen. Die Instanz liegt in der Ablage
 * (ohne Eintrag im Ablagestapel — sie ist unsichtbar) und richtet die Zusage beim ersten Zugbeginn ein.
 */
function ensureCalmProviders(engine) {
  for (let pi = 0; pi < engine.playerCount(); pi++) {
    const heroes = engine.gs.players[pi]?.heroes || [];
    heroes.forEach((h, hi) => {
      if (!h?.buffs?.[BUFF]) return;
      const hat = engine.cardInstances.some(o => o.name === CARD_NAME && o.counters?._calmLive
        && o.counters._calmHero === hi && (o.counters._grantSeite ?? o.owner) === pi);
      if (hat) return;
      const inst = engine._trackCard(CARD_NAME, pi, 'discard', hi, -1);
      inst.counters = inst.counters || {};
      Object.assign(inst.counters, { _calmHero: hi, _grantSeite: pi, _calmTurn: -1, _calmLive: true });
    });
  }
}

module.exports = {
  activeIn: ['hand', 'discard'],
  requiresTarget: true,
  spellVisual: { impact: { type: 'blessed_skill_burst' }, impactMs: 260 },
  ensureCalmProviders,

  // INHERENTE Zusatzaktion (Als Korrektur 2.10.): das Spielen selbst kostet keine Aktion (Archer-Muster /
  // Weapon Unleashing) — nur in Main Phase 1 oder der Action Phase.
  inherentAction: true,
  canActivate(gs, pi, engine) {
    if (!gs || (gs.currentPhase !== 2 && gs.currentPhase !== 3)) return false;
    if (!engine) return true;
    try { return kontrollierteHeldenZiele(engine, pi).length >= 2; } catch { return true; }
  },

  /** Grauton: ohne einen weiteren lebenden Helden gibt es nichts zu waehlen. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    try { return kontrollierteHeldenZiele(engine, pi).length >= 2; } catch { return true; }
  },

  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    try { return ziele(engine, pi, heldSeite(gs, pi, heroIdx), heroIdx).length > 0; } catch { return true; }
  },

  hooks: {
    ...secondActionHooks,

    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const inst = ctx.card;
      if (!inst || ctx.cardZone !== 'hand' || ctx.playedCard?.id !== inst.id) return;
      const userSeite = ctx.cardHeroOwner ?? pi;
      const angebot = ziele(engine, pi, userSeite, ctx.cardHeroIdx);
      if (angebot.length === 0) { gs._spellCancelled = true; return; }
      const wahl = await engine.promptEffectTarget(pi, angebot, {
        title: CARD_NAME,
        description: 'Choose a Hero you control, except the user. It may perform a second Action during your Action Phase next turn.',
        confirmLabel: '🕊️ Calm',
        maxSelect: 1, maxTotal: 1, minRequired: 1,
        cancellable: true,
      });
      const roh = Array.isArray(wahl) ? wahl[0] : wahl;
      const id = roh && typeof roh === 'object' ? roh.id : roh;
      const ziel = angebot.find(t => t.id === id);
      if (!ziel) { gs._spellCancelled = true; return; }
      const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (!hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      const ok = await engine.actionAddBuff(hero, ziel.owner, ziel.heroIdx, BUFF, { source: CARD_NAME, sourceOwner: pi });
      if (!ok) return;   // abgewehrt (Anti Magic, Schild …): die Karte geht normal in die Ablage
      engine._broadcastEvent('play_zone_animation', { type: 'blessed_skill_burst', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1 });

      // Die Instanz traegt die Zusage und lebt in der Ablage weiter.
      inst.heroIdx = ziel.heroIdx;
      inst.counters = inst.counters || {};
      Object.assign(inst.counters, { _calmHero: ziel.heroIdx, _grantSeite: ziel.owner, _calmTurn: gs.turn, _calmLive: true, _calmGranted: false });
      gs._spellKeepInstance = true;
      engine.log('calm_diatribe', { hero: hero.name });
      engine.sync();
    },

    /** Zugbeginn des Besitzers (nicht der Zug des Wirkens): Zusage einrichten. */
    onTurnStart: async (ctx) => {
      const inst = ctx.card;
      const c = inst?.counters;
      if (!c?._calmLive || c._calmGranted) return;
      if (ctx.playerIdx !== ctx.cardOwner || ctx._engine.gs.turn === c._calmTurn) return;
      richteZusageEin(ctx._engine, inst);
    },

    onActionUsed: async (ctx) => {
      await secondActionHooks.onActionUsed(ctx);
      const inst = ctx.card;
      if (inst?.counters?._calmGranted && !grantLebt(inst)) entferneCalm(ctx._engine, inst);
    },

    onAdditionalActionUsed: async (ctx) => {
      await secondActionHooks.onAdditionalActionUsed(ctx);
      const inst = ctx.card;
      if (inst?.counters?._calmGranted && !grantLebt(inst)) entferneCalm(ctx._engine, inst);
    },

    /** Ende der Action Phase des naechsten Zuges: unverbraucht verfaellt alles — auch bei totem Helden. */
    onPhaseEnd: async (ctx) => {
      await secondActionHooks.onPhaseEnd(ctx);
      if (ctx.phaseIndex !== 3) return;
      const inst = ctx.card;
      const c = inst?.counters;
      if (!c?._calmLive || !c._calmGranted) return;
      entferneCalm(ctx._engine, inst);
    },

    // Der Zug Hand → Ablage nach dem Resolve ist kein Verlust; nur das Verlassen der Ablage zaehlt.
    onCardLeaveZone: async (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card?.id) return;
      if (ctx.fromZone === 'hand') return;
      await secondActionHooks.onCardLeaveZone(ctx);
      const inst = ctx.card;
      if (inst?.counters?._calmLive) {
        ctx._engine.expireAdditionalAction(inst);
        entferneCalm(ctx._engine, inst);
      }
    },

    // Die Engine setzt beim Zonenwechsel heroIdx zurueck — die Bindung an den Helden wiederherstellen.
    onCardEnterZone: async (ctx) => {
      const inst = ctx.card;
      const pinned = inst?.counters?._calmHero;
      if (Number.isInteger(pinned) && inst.counters._calmLive && inst.heroIdx !== pinned) inst.heroIdx = pinned;
    },
  },
};
