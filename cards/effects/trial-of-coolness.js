// ═══════════════════════════════════════════
//  CARD EFFECT: "Trial of Coolness"
//  Spell (Summoning Magic Lv1, Normal, Trials)
//
//  Restrictions:
//    • Once per game (engine `oncePerGame`).
//    • Cannot be played if any Attack or Spell
//      has already been played this turn (the
//      lockout is symmetric — see `spellPlayCondition`).
//
//  Effect:
//    Stamp a generic "Extra Life" mark on a chosen
//    target the controller controls (any of their
//    own Heroes — including the user — or any of
//    their own Creatures). The next time that
//    target would be defeated, the mark is consumed
//    and the target is fully revived/healed. The
//    mark persists across turns until consumed.
//
//    On resolve, also stamps `_attackSpellLockedTurn`
//    so the controller cannot play any further
//    Attacks or Spells this turn (engine-side gate
//    in `validateActionPlay`).
//
//  Implementation notes:
//    • The Extra Life mark itself is a generic
//      engine mechanic — the engine checks for
//      `target._extraLife` (heroes) or
//      `inst.counters._extraLife` (creatures) and
//      handles the revive automatically. This script
//      only stamps the mark; it does not subscribe
//      to KO/death hooks.
//    • The mark stores `{ by: 'Trial of Coolness' }`
//      for log attribution.
//    • The badge UI is keyed off the same fields
//      (see app-shared.jsx `StatusBadges`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
// v481: Schluessel und Rundenriegel kommen aus dem gemeinsamen Modul —
// siehe die Begruendung im Kopf von `_trials-shared.js`.
const { TRIAL_KEYS, trialTurnIsClean, stampTrialLock } = require('./_trials-shared');

const CARD_NAME = 'Trial of Coolness';
const ONCE_PER_GAME_KEY = TRIAL_KEYS[CARD_NAME];

// "Target" in card-text terms covers Heroes and Creatures — never
// Equipment, Attachment-Spells, or other support-zone residents.
function _hasEligibleTarget(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return false;
  // Own heroes (alive, not already marked).
  // ⚠ Grobe Vorpruefung: WELCHER Held castet, steht hier noch nicht
  // fest (`spellPlayCondition` bekommt keinen Heldenindex). Ist das
  // einzige Ziel am Ende der Nutzer selbst, bricht die Aufloesung
  // sauber ab und die Karte bleibt auf der Hand — kein Schaden, nur
  // ein vergeblicher Klick.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    return true;
  }
  // Own Creatures only — engine is required for the cardType lookup.
  if (!engine) return false;
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    return true;
  }
  return false;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  oncePerGame: true,
  oncePerGameKey: ONCE_PER_GAME_KEY,

  // Pre-resolution gates:
  //   • At least one eligible target must exist.
  //   • No prior Attacks or Spells this turn (mirrors the post-resolve
  //     lock — Trial demands the turn be entirely Trial-or-nothing).
  spellPlayCondition(gs, pi, engine) {
    if (!trialTurnIsClean(gs, pi)) return false;
    return _hasEligibleTarget(gs, pi, engine);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine    = ctx._engine;
      const gs        = ctx.gameState;
      const pi        = ctx.cardOwner;
      const ps        = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Build target list. "Targets" in card-text terms means Heroes
      // and Creatures only — Equipment, Attachment-Spells, and any
      // other non-Creature support-zone residents are ineligible.
      // ★ ALS RULING 18.8.: „die Extraleben sollten stacken, sie kann
      // dann mehrere haben!" Ein Ziel, das schon eine Marke traegt, ist
      // deshalb NICHT mehr ausgeschlossen — Anlass war Damsel-Cecilia,
      // deren eingebautes Extraleben sie unwaehlbar machte.
      //
      // ★ ALS BEFUND 18.8.: „Trial of Coolness soll jedes Ziel wählen
      // können, *außer* den Nutzer." Genau das fehlte — der Kommentar
      // hier behauptete sogar das Gegenteil („the user is itself a
      // valid pick"), und der Kartentext sagt klar „Choose a target you
      // control, EXCEPT the user". Der Nutzer ist der beschwoerende
      // Held, also `ctx.heroIdx`.
      const userHeroIdx = ctx.heroIdx;
      const cardDB = engine._getCardDB();
      const targets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (hi === userHeroIdx) continue;
        targets.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== pi) continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }

      if (targets.length === 0) { gs._spellCancelled = true; return; }

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: 'Choose any Hero or Creature you control to grant an Extra Life.',
        confirmLabel: '🌟 Bestow!',
        confirmClass: 'btn-success',
        cancellable: true,
        exclusiveTypes: false,
        maxPerType: { hero: 1, equip: 1 },
        maxTotal: 1,
        minRequired: 1,
        autoConfirm: true,
      });
      if (!picked || picked.length === 0) { gs._spellCancelled = true; return; }

      const target = targets.find(t => t.id === picked[0]);
      if (!target) { gs._spellCancelled = true; return; }

      // ── Stamp the Extra Life mark ─────────────────────────────────
      const lifeMark = { by: CARD_NAME };
      // Ueber `addExtraLife` statt per Zuweisung — die Funktion legt die
      // Marke auf den Stapel und laesst vorhandene stehen.
      let stampedName, stampedOwner, stampedHeroIdx, stampedZoneSlot;
      if (target.type === 'hero') {
        const h = ps.heroes[target.heroIdx];
        if (!h?.name || h.hp <= 0) { gs._spellCancelled = true; return; }
        engine.addExtraLife(h, lifeMark);
        stampedName = h.name;
        stampedOwner = pi;
        stampedHeroIdx = target.heroIdx;
        stampedZoneSlot = -1;
      } else { // 'equip' (creature)
        const inst = engine.cardInstances.find(c =>
          c.zone === 'support' && c.owner === target.owner
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (!inst) { gs._spellCancelled = true; return; }
        if (!inst.counters) inst.counters = {};
        // Kreaturen tragen ihre Marke in den Countern; derselbe Stapel,
        // nur an anderer Stelle. `addExtraLife` arbeitet auf einem
        // beliebigen Traegerobjekt.
        engine.addExtraLife(inst.counters, lifeMark);
        stampedName = inst.name;
        stampedOwner = inst.owner;
        stampedHeroIdx = inst.heroIdx;
        stampedZoneSlot = inst.zoneSlot;
      }

      // ── Lock out further Attacks/Spells this turn ────────────────
      // Engine-side `validateActionPlay` consults this flag and refuses
      // any further Spell or Attack play from the player's hand.
      stampTrialLock(gs, pi);

      // Visual flourish on the marked target.
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival',
        owner: stampedOwner, heroIdx: stampedHeroIdx, zoneSlot: stampedZoneSlot,
      });

      engine.log('trial_of_coolness', {
        player: ps.username, target: stampedName,
        targetType: target.type === 'hero' ? 'hero' : 'creature',
      });
      engine.sync();
    },
  },
};
