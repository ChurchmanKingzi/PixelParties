// ═══════════════════════════════════════════
//  CARD EFFECT: "The Master's Key"
//  Artifact (Normal, Cost 20)
//
//  „You can only play this card if you have not performed any Actions yet this
//   turn. Choose a level 3 Creature in your hand and place it into the free
//   Support Zone of any Hero you control, but negate its effects for the rest of
//   the turn. You cannot perform an Action for the rest of the turn. This
//   Artifact's Cost is reduced by 5 times the combined Decay Magic levels of all
//   Heroes you control. You can only play 1 \"The Master's Key\" per turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Spielbar nur, solange der Spieler in diesem Zug noch KEINE Aktion ausgefuehrt hat
//    (`ps._actionsPlayedThisTurn`, der Zaehler hinter `onAnyActionResolved`), nur einmal
//    je Zug und nur mit einer Level-3-Creature auf der Hand und einer freien Zone.
//  • PLATZIEREN, nicht Beschwoeren: `actionPlaceCreature` ohne Beschwoerungs-Hooks
//    (`negateEffects`); Level/Schule des Helden sind egal. Die Zone eines beliebigen
//    kontrollierten Helden (auch besiegt, solange die Hero Zone belegt ist — wie
//    The Root of all Evil).
//  • Beschwoerungseinschraenkungen: `canSummon` filtert Kandidaten/Zonen (`isCreatureSummonable`);
//    `beforeSummon` (Opfer o.ae.) wird nach der Zonenwahl bezahlt, ein Abbruch verbraucht den Key nicht.
//  • „Negate its effects for the rest of the turn": Negation mit Ablauf am Beginn des naechsten
//    Zuges (`expiresAtTurn`), eigenverursacht.
//  • „You cannot perform an Action for the rest of the turn": spielerweiter Rundenstempel
//    `ps._playerActionLockedTurn` (derselbe Weg wie Kent) — wirkt auf Spielen, Abilities,
//    Heldeneffekte und Zusatzaktionen.
//  • Preis: 20 − 5 × (Decay-Magic-Level aller kontrollierten Helden), nie unter 0
//    (`selfCostReduction`, wie Future Tech Laser Cannon).
// ═══════════════════════════════════════════

const { hasCardType, isArtifactCreature, isOwnSideSummonableCreature } = require('./_hooks');

const CARD_NAME = "The Master's Key";
const STUFE = 3;
const RABATT_JE_LEVEL = 5;
const NEG_BUFF = 'masters_key_negated';

/** Level-3-Creatures auf der Hand, entdoppelt. */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const zaehler = new Map();
  for (const n of (ps?.hand || [])) {
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Creature') || isArtifactCreature(cd)) continue;
    if (!isOwnSideSummonableCreature(cd, n)) continue;
    if ((cd.level || 0) !== STUFE) continue;
    zaehler.set(n, (zaehler.get(n) || 0) + 1);
  }
  return [...zaehler.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'hand', count }));
}

/** Freie Support-Plaetze kontrollierter Helden (auch besiegter: die Hero Zone muss belegt sein). */
function zonenFuer(engine, pi, cardName) {
  const out = [];
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(pi)) {
    if (!h?.name) continue;
    if (engine.isSupportZoneLocked(physOwner, hi, { source: CARD_NAME, cardName, via: 'place' })) continue;
    // Beschwoerungseinschraenkungen (`canSummon`, z.B. benoetigte Opfer) gelten auch hier.
    if (cardName && !engine.isCreatureSummonable(cardName, physOwner, hi)) continue;
    for (let si = 0; si < 3; si++) {
      if (engine.supportSlotBelegt(physOwner, hi, si)) continue;
      out.push({ owner: physOwner, heroIdx: hi, slotIdx: si, label: `${h.name} — Slot ${si + 1}` });
    }
  }
  return out;
}

/** Summe der Decay-Magic-Level aller kontrollierten Helden. */
function decayLevel(engine, pi) {
  let summe = 0;
  for (const { physOwner, heroIdx: hi } of engine.heroesControlledBy(pi)) {
    const zonen = engine.gs.players[physOwner]?.abilityZones?.[hi] || [];
    summe += engine.countAbilitiesForSchool('Decay Magic', zonen) || 0;
  }
  return summe;
}

function schonGespielt(gs, pi) {
  return gs.hoptUsed?.[`masters-key:${pi}`] === gs.turn;
}

module.exports = {
  neverMultiTarget: true,   // genau EINE Creature wird platziert
  blockedBySummonLock: true,

  /** Rabatt: 5 je Decay-Magic-Level. */
  selfCostReduction(gs, pi, cardData, engine) {
    if (!engine) return 0;
    try { return RABATT_JE_LEVEL * decayLevel(engine, pi); } catch { return 0; }
  },

  canActivate(gs, pi, engine) {
    const ps = gs?.players?.[pi];
    if (!ps || !engine) return false;
    if ((ps._actionsPlayedThisTurn || 0) > 0) return false;      // keine Aktion in diesem Zug
    if (schonGespielt(gs, pi)) return false;                      // 1 je Zug
    if (ps.summonLocked) return false;
    return kandidaten(engine, pi).some(k => zonenFuer(engine, pi, k.name).length > 0);
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'cardGallery' && payload?.title === CARD_NAME) {
      return { cardName: payload.cards?.[0]?.name };
    }
    if (kind === 'generic' && payload?.type === 'zonePick' && payload?.title === CARD_NAME) {
      const z = payload.zones?.[0];
      return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner } : undefined;
    }
    return undefined;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    if ((ps._actionsPlayedThisTurn || 0) > 0 || schonGespielt(gs, pi)) return { cancelled: true };
    const karten = kandidaten(engine, pi).filter(k => zonenFuer(engine, pi, k.name).length > 0);
    if (karten.length === 0) return { cancelled: true };

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
      description: 'Choose a level 3 Creature in your hand to place into a free Support Zone. Its effects are negated for the rest of the turn, and you cannot perform an Action for the rest of the turn.',
      cards: karten, confirmLabel: '🗝️ Place it', cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName || !karten.some(k => k.name === wahl.cardName)) return { cancelled: true };
    const name = wahl.cardName;

    const zonen = zonenFuer(engine, pi, name);
    if (zonen.length === 0) return { cancelled: true };
    let ziel = zonen[0];
    if (zonen.length > 1) {
      const z = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME, source: CARD_NAME,
        description: `Place ${name} into which Support Zone?`, zones: zonen, cancellable: true,
      });
      if (!z || z.cancelled) return { cancelled: true };
      const gleich = q => q.heroIdx === z.heroIdx && q.slotIdx === z.slotIdx;
      ziel = zonen.find(q => gleich(q) && q.owner === (z.owner ?? pi))
        || (z.owner == null ? zonen.find(gleich) : null) || null;
      if (!ziel) return { cancelled: true };
    }

    // Beschwoerungskosten (`beforeSummon`, z.B. Opfer) zahlen — Abbruch: Karte bleibt unverbraucht.
    const kostenOk = await engine._runBeforeSummon(name, pi, ziel.heroIdx,
      { _isNormalSummon: false, ...(ziel.owner !== pi ? { heldSeite: ziel.owner } : {}) }, ziel.slotIdx);
    if (!kostenOk) return { cancelled: true };
    engine.takeTributeSummonExtras(name, pi);   // Opfer-Stempel verbrauchen (Platzieren feuert keine Beschwoerungs-Hooks)

    // ── Commit: ab hier ist die Karte gespielt ──
    engine.claimHOPT('masters-key', pi);
    const res = await engine.actionPlaceCreature(name, pi, ziel.heroIdx, ziel.slotIdx, {
      source: 'hand', sourceName: CARD_NAME, countAsSummon: false, animationType: 'summon',
      negateEffects: true, heldSeite: ziel.owner,
    });
    if (res?.inst) {
      // „for the rest of the turn": die Negation faellt am Beginn des naechsten Zuges.
      const naechster = engine.opponentOf(gs.activePlayer);
      await engine.actionAddCreatureBuff(res.inst, NEG_BUFF, {
        expiresAtTurn: gs.turn + 1, expiresForPlayer: naechster,
        clearCountersOnExpire: ['negated', 'negated_placement'],
        source: CARD_NAME, ignoreGateShield: true,
      });
    }
    // „You cannot perform an Action for the rest of the turn."
    ps._playerActionLockedTurn = gs.turn;
    engine.log('masters_key', { player: ps.username, creature: name, placed: !!res?.inst });
    engine.sync();
  },
};
