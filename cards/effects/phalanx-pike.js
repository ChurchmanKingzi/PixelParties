// ═══════════════════════════════════════════
//  CARD EFFECT: "Phalanx Pike"
//  Artifact (Equipment, Cost 8)
//
//  ① Equipped Hero gains +30 ATK.
//  ② The equipped Hero does not trigger Surprises
//    with its Attacks. Covers every surprise that
//    fires from `_checkSurpriseWindow` (Booby
//    Trap, Firewall, etc.) — gated on damageType
//    === 'attack' so the same hero's Spells / Hero
//    effects / Creature activations still open the
//    window normally.
//  ③ Spielgestalter-Entscheidung 17.11.2026: KEIN Limit je Held
//  (der Kartentext nennt keines). Mehrere Phalanx Pike am selben
//  Helden sind erlaubt, jede gibt +30 ATK; die Surprise-Regel gilt,
//  solange mindestens eine liegt.
//
//  Wiring: the engine reads `hero._skipAttackSurprises`
//  inside `_checkSurpriseWindow`. We stamp the flag
//  on the equipped hero in onPlay/onGameStart and
//  clear it in onCardLeaveZone (only when no other
//  Pike — or Heart-Shaped Bow, which uses the same
//  flag — is still equipped: the flag ends with the
//  LAST suppressor).
// ═══════════════════════════════════════════

const ATK_BONUS = 30;
const CARD_NAME = 'Phalanx Pike';

// Heart-Shaped Bow stempelt dasselbe Flag (`_skipAttackSurprises`) — ihr Abgang raeumt es nur, wenn kein Pike/Bogen mehr liegt (dort schon so);
// umgekehrt darf der Abgang der letzten Pike das Flag nicht loeschen, solange ein Bogen am Helden liegt.
const SUPPRESSOR_NAMES = [CARD_NAME, 'Heart-Shaped Bow, the Final Proof of Cuteness'];

function _otherPikeOnHero(engine, ownerIdx, heroIdx, excludeId) {
  return engine.cardInstances.some(c =>
    c.id !== excludeId &&
    c.owner === ownerIdx && c.zone === 'support' &&
    c.heroIdx === heroIdx && SUPPRESSOR_NAMES.includes(c.counters?._effectOverride || c.name)
  );
}

function _applySurpriseSkip(engine, ownerIdx, heroIdx) {
  const hero = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];
  if (hero) hero._skipAttackSurprises = true;
}

function _clearSurpriseSkipIfLast(engine, ownerIdx, heroIdx, excludeId) {
  if (_otherPikeOnHero(engine, ownerIdx, heroIdx, excludeId)) return;
  const hero = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];
  if (hero) delete hero._skipAttackSurprises;
}

module.exports = {
  activeIn: ['support'],

  // „Equip this card to a Hero you control." — Seitenbindung (CARD_API `equipOwnSideOnly`). Ersetzt das frühere
  // `canEquipToHero` („Maximum 1 Phalanx Pike per Hero", Spielgestalter-Entscheidung 17.11.2026: kein Limit), das die Karte
  // nebenbei an die eigene Seite gebunden hatte.
  equipOwnSideOnly: true,

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
      _applySurpriseSkip(ctx._engine, ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx);   // Styx 28.9.: Brettseite
    },

    /**
     * Game start path — fires for pre-equipped Pikes loaded from a
     * puzzle preset. `atkGranted` is the canonical "already applied"
     * counter set by ctx.grantAtk; if non-zero, skip both halves.
     */
    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      const hero = ctx.attachedHero;
      if (!hero?.name) return;
      ctx.grantAtk(ATK_BONUS);
      _applySurpriseSkip(ctx._engine, ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx);   // Styx 28.9.: Brettseite
    },

    /**
     * On removal: revoke ATK and clear the surprise-skip flag IFF no
     * other Pike is still equipped to the same hero.
     */
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner && ctx.fromOwner !== ctx.cardHeroOwner) return;   // Styx 28.9.: Brettseite
      if (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
      _clearSurpriseSkipIfLast(ctx._engine, ctx.fromOwner, ctx.fromHeroIdx, ctx.card.id);
    },
  },
};
