// ═══════════════════════════════════════════
//  CARD EFFECT: "Weapon Unleashing"
//  Spell (Normal, Lv0, Magic Arts) — INHERENTE Zusatzaktion
//
//  „This Spell can only be used by a Hero with an Ability at level 3.
//   Send all copies of a level 3 Ability from the user to the discard
//   pile to use this Spell. You may perform a second Action with the
//   user during your Action Phase this turn. This counts as an
//   additional Action."
//
//  Als Ruling (6.9.): NUR in Main Phase 1 oder Action Phase spielbar —
//  nicht mehr, nachdem die Action Phase geschlossen ist.
//
//  Bauform
//  ───────
//  • `canActivate`: Phase MAIN1 (2) oder ACTION (3); irgendein eigener
//    Held traegt einen Stapel der Hoehe 3. `canPlayWithHero`: genau
//    dieser Held.
//  • Kosten: Stapel waehlen (Brett-Picker, nur Slots mit 3 Kopien),
//    alle drei Kopien ueber `discardAbilityTopCopy` schicken.
//  • Effekt: helden-gebundener Second-Action-Grant nach dem Muster
//    Giga Steroids / `_second-action-shared` — die Karten-INSTANZ
//    traegt den Grant und bleibt in der Ablage aktiv
//    (`activeIn: ['hand','discard']`); `inst.heroIdx` wird auf den
//    Nutzer gepinnt, damit `heroRestricted` greift. „counts as an
//    additional Action" ist genau die Grant-Semantik.
// ═══════════════════════════════════════════

const { secondActionHooks, isSecondActionGrant } = require('./_second-action-shared');

const CARD_NAME = 'Weapon Unleashing';
const TYPE_ID_PREFIX = 'second_action:weapon-unleashing:';
const PHASE_MAIN1 = 2, PHASE_ACTION = 3;
const STACK = 3;

function stacksOf(engine, pi, heroIdx) {
  // Ability-Zonen UND echte Stapel in Support Zones (Xal, Xalibur, v805);
  // Karten, die nur als Ability GELTEN (Cloak of Edge), haben keinen Stapel.
  return engine.getAbilityTargets(pi, { heroIdx })
    .filter(a => (a.level || 0) >= STACK && (a.zoneKind === 'ability' || a.istEchteAbility));
}

module.exports = {
  activeIn: ['hand', 'discard'],
  // Als Korrektur 6.9.: KEINE Reaction (cards.json: Subtype Normal),
  // sondern eine ganz normale INHERENTE Zusatzaktion — das Spielen
  // selbst kostet keine Aktion (Archer-Muster `inherentAction`).
  inherentAction: true,

  canActivate(gs, pi, engine) {
    if (!gs || (gs.currentPhase !== PHASE_MAIN1 && gs.currentPhase !== PHASE_ACTION)) return false;
    if (!engine) return true;
    return (gs.players[pi]?.heroes || []).some((h, hi) => h?.name && h.hp > 0 && stacksOf(engine, pi, hi).length > 0);
  },

  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    try { return stacksOf(engine, pi, heroIdx).length > 0; } catch { return true; }
  },

  hooks: {
    ...secondActionHooks,

    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      const inst = ctx.card;
      if (!hero?.name || hero.hp <= 0 || !inst) { gs._spellCancelled = true; return; }
      const stacks = stacksOf(engine, pi, heroIdx);
      if (stacks.length === 0) { gs._spellCancelled = true; return; }
      // Kartenbild ZURUECKHALTEN, bis die Ability gewaehlt ist (Als Vorgabe
      // 6.9.) — vorher kann der Spieler noch abbrechen. Danach an BEIDE
      // Spieler streamen (der Reveal geht sonst nur an den Gegner).
      gs._holdCardReveal = true;

      // Kosten: welcher Level-3-Stapel? IMMER fragen — auch bei nur
      // einem Stapel —, denn bis zur Wahl darf der Spieler abbrechen
      // (Als Vorgabe 6.9.); danach ist die Karte gespielt.
      const ziele = stacks.map(a => ({ id: a.id, type: a.type, owner: a.owner, heroIdx: a.heroIdx, slotIdx: a.slotIdx, cardName: a.cardName, cardInstance: a.cardInstance || undefined }));
      const wahl = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        description: `Choose a level 3 Ability of ${hero.name} — all 3 copies go to the discard pile. ${hero.name} may then perform a second Action this turn.`,
        confirmLabel: '💥 Unleash',
        confirmClass: 'btn-danger',
        cancelLabel: 'Cancel',
        cancellable: true, maxTotal: 1, minRequired: 1,
        _abilityCost: { cardName: CARD_NAME, heroIdx, sent: 0, abilitiesSent: 0, amount: 0, needMore: true, wisdomPending: false },
      });
      delete gs._holdCardReveal;
      if (!wahl || wahl.length === 0) { gs._spellCancelled = true; return; }
      const gewaehlt = stacks.find(a => a.id === wahl[0]);
      if (!gewaehlt) { gs._spellCancelled = true; return; }
      engine._firePendingCardReveal();
      try {
        const ownSid = ps.socketId;
        if (ownSid && engine.io) engine.io.to(ownSid).emit('card_reveal', { cardName: CARD_NAME });
      } catch { /* Anzeige ist Beiwerk */ }
      const abilityName = gewaehlt.cardName;
      for (let k = 0; k < STACK; k++) {
        const entry = engine.getAbilityTargets(pi, { heroIdx, cardName: abilityName })
          .find(a => a.zoneKind === gewaehlt.zoneKind && a.slotIdx === gewaehlt.slotIdx);
        if (!entry || !(await engine.discardAbilityTopCopy(entry, { source: CARD_NAME, sourceOwner: pi }))) break;
        engine.sync();
        await engine._delay(250);
      }

      // Effekt: Second-Action-Grant, an den Nutzer gebunden.
      inst.heroIdx = heroIdx;
      inst.counters = inst.counters || {};
      inst.counters._unleashHero = heroIdx;
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
      // Die Instanz traegt den Grant — der Server darf sie nach dem
      // Resolve nicht entsorgen, sondern zont sie in die Ablage um
      // (`_spellKeepInstance`, v808).
      gs._spellKeepInstance = true;
      hero.buffs = hero.buffs || {};
      hero.buffs.second_action_grant = { appliedTurn: gs.turn };   // Badge-Schluessel aus _second-action-shared
      if ((ps._actionsPlayedThisPhase || 0) === 1) gs._preventPhaseAdvance = true;
      engine._broadcastEvent('play_zone_animation', {
        type: 'weapon_unleashing', owner: pi, heroIdx, zoneSlot: -1,
      });
      engine.log('weapon_unleashing', { player: ps.username, hero: hero.name, ability: abilityName });
      engine.sync();
    },

    // Der Zug Hand → Ablage nach dem Resolve ist KEIN Verlust des Grants:
    // die geteilten Hooks raeumen in `onCardLeaveZone` (self) den Helden-
    // Badge weg, sobald die tragende Instanz ihre Zone verlaesst — bei
    // einer Karte auf dem Brett richtig, hier falsch (Als Befund 6.9.:
    // Badge fehlte). Nur das Verlassen der ABLAGE (Loeschen, Rueckkehr
    // auf die Hand) zaehlt.
    onCardLeaveZone: async (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card?.id) return;
      if (ctx.fromZone === 'hand') return;
      return secondActionHooks.onCardLeaveZone(ctx);
    },

    // Die Karten-Instanz wandert nach dem Resolve in die Ablage; die
    // Engine setzt dabei ihren heroIdx zurueck. Der Grant ist aber
    // helden-gebunden — den Pin nach dem Zonenwechsel wiederherstellen
    // (und den Badge, falls ein anderer Weg ihn geraeumt hat).
    onCardEnterZone: async (ctx) => {
      const inst = ctx.card;
      const engine = ctx._engine;
      if (!inst || !isSecondActionGrant(engine, inst)) return;
      const pinned = inst.counters?._unleashHero;
      if (Number.isInteger(pinned) && inst.heroIdx !== pinned) inst.heroIdx = pinned;
      if (Number.isInteger(pinned) && inst.counters?.additionalActionAvail > 0) {
        const hero = engine.gs.players[inst.owner]?.heroes?.[pinned];
        if (hero?.name) { hero.buffs = hero.buffs || {}; hero.buffs.second_action_grant = hero.buffs.second_action_grant || { appliedTurn: engine.gs.turn }; }
      }
    },
  },

  cpuMeta: {
    cpuInstBonus(engine, inst) {
      return inst.counters?.additionalActionAvail ? 60 : 0;
    },
  },
};
