// ═══════════════════════════════════════════
//  CARD EFFECT: "Weapon Absorption"
//  Spell (Reaction, Magic Arts Lv2)
//
//  Play this card immediately when the user would take any damage.
//  Choose any number of Artifacts equipped and Abilities attached to
//  the user and send them to the discard pile. The user heals for
//  80 HP times the number of cards sent. This Spell's level is
//  reduced by the number of Abilities you send with this effect.
//
//  ── Als Rulings (6.9.) ────────────────────────────────────────────
//  • „the user" ist der GETROFFENE Held — nur er castet die Karte
//    (`casterIsTarget`), nicht irgendein anderer Held der Seite.
//  • Die Level-Pruefung laeuft VOR den Kosten: eine Magic-Arts-Ability,
//    die der Held mit diesem Effekt abschickt, zaehlt noch fuer sein
//    Level. Ein Held mit genau EINER Magic-Arts-Ability darf sie also
//    schicken (Spell faellt auf Lv1) und die Karte trotzdem casten.
//  • Reicht das Level des Helden nicht, muss er MINDESTENS so viele
//    Abilities schicken, dass die Luecke geschlossen ist — das wird
//    erzwungen, nicht nur angeboten.
//
//  ── Bauform ──────────────────────────────────────────────────────
//  1. Fenster: `isPreDamageReaction` (Escape-Muster) — je Held und
//     Schadensinstanz, auch Status-Ticks („any damage").
//  2. Tuersteher: das Fenster fragt `heroMeetsLevelReq`; die Karte
//     exportiert dafuer `canBypassLevelReq` und probiert dort, ob
//     der Held das Level mit k = 0..N geschickten Abilities erreicht
//     (`heroMeetsLevelReq` mit reduziertem Level und
//     `noPlacementBypass`, damit der Bypass nicht auf sich selbst
//     rekurriert). Divinity, Mana Absorbing Crystal, Rocky-Slime-
//     Offsets laufen dadurch automatisch mit.
//  3. Auswahl ueber das BRETT in der Greenhouse-Schleife (v720): ein
//     Klick schickt EINE Karte (bei Ability-Stapeln die oberste
//     Kopie), dann wieder fragen. „✓ Done" erscheint erst, wenn die
//     Luecke geschlossen ist. So lassen sich einzelne Kopien eines
//     Stapels schicken — ein Einmal-Picker kennt nur ganze Slots.
//  4. Wisdom: `handlesOwnWisdomCost` — das Fenster zieht KEIN Wisdom
//     ein, denn erst nach der Auswahl steht fest, ob eine Luecke
//     bleibt. Bleibt eine und Wisdom kann sie decken, wird der
//     Abwurf bei „Done" faellig; sonst bleibt „Done" gesperrt.
//  5. Heilung 80 × Karten am Ende (Max-HP-Kappe ueber
//     `actionHealHero`), der Schaden landet danach normal — die Karte
//     verringert nichts (`{}`), sie heilt vorher.
//
//  Senden laeuft ueber `engine.sendBoardCardToDiscard` (v800) —
//  Leave-Hooks (Fighting nimmt ATK zurueck, Toughness HP), Untracking,
//  `onBoardSentToDiscard`, alles an einer Stelle.
// ═══════════════════════════════════════════

const { ZONES } = require('./_hooks');

const CARD_NAME = 'Weapon Absorption';
const HEAL_PER_CARD = 80;

// ── Was darf der Held schicken? ──────────────────────────────────
// Abilities: alle Eintraege aus `getAbilityTargets` (je Slot einer,
// `level` = Stapelhoehe; Cloak-of-Edge-Karten zaehlen als Ability).
// Equips: Artefakte mit Subtype Equipment in den Support Zones des
// Helden, die NICHT schon als Ability zaehlen.
function sendables(engine, pi, heroIdx) {
  const db = engine._getCardDB();
  const abilities = engine.getAbilityTargets(pi, { heroIdx });
  const abilityInstIds = new Set(abilities.map(a => a.cardInstance?.id).filter(Boolean));
  const equips = engine.getArtifactTargets(pi, { heroIdx }).filter(t => {
    if (!t.cardInstance || t.cardInstance.zone !== ZONES.SUPPORT) return false;
    if (abilityInstIds.has(t.cardInstance.id)) return false;
    if (t.cardInstance.counters?.immovable || t.cardInstance.counters?._cardinalImmune) return false;
    const cd = engine.getEffectiveCardData(t.cardInstance) || db[t.cardName];
    return String(cd?.subtype || '').toLowerCase() === 'equipment';
  });
  return { abilities, equips };
}

function abilityCardCount(abilities) {
  // v805: `level` = Stapelhoehe, auch fuer echte Stapel in Support Zones (Xalibur).
  return abilities.reduce((n, a) => n + (a.level || 1), 0);
}

// ── Level-Simulation ─────────────────────────────────────────────
// Kann der Held die Karte casten, wenn er k Abilities schickt? Der
// Spell traegt dann Level (2 − k); alles andere (Divinity, Offsets,
// Crystal) entscheidet `heroMeetsLevelReq`. `noPlacementBypass`
// haelt den eigenen `canBypassLevelReq` heraus.
//
// ★ CAST-ZEITPUNKT (Als Ruling 6.9., Nischenfall gemeldet): die
// Pruefung gilt gegen die Ability-Zonen, wie sie BEIM CAST lagen — wer
// zuerst seine einzige Magic Arts schickt, hat sie fuer die Pruefung
// trotzdem noch. `zonesAtCast` ist der Schnappschuss aus dem Resolve;
// waehrend der Pruefung werden die Live-Zonen kurz dagegen getauscht
// (beide Helfer sind synchron, nichts laeuft dazwischen).
function withCastZones(engine, pi, heroIdx, zonesAtCast, fn) {
  const ps = engine.gs.players[pi];
  if (!zonesAtCast || !ps?.abilityZones) return fn();
  const live = ps.abilityZones[heroIdx];
  ps.abilityZones[heroIdx] = zonesAtCast.map(z => z.slice());
  try { return fn(); } finally { ps.abilityZones[heroIdx] = live; }
}

function meetsWith(engine, pi, heroIdx, cd, k, zonesAtCast) {
  const probe = { ...cd, level: Math.max(0, (cd.level || 0) - k) };
  return withCastZones(engine, pi, heroIdx, zonesAtCast,
    () => engine.heroMeetsLevelReq(pi, heroIdx, probe, { noPlacementBypass: true }));
}

// Wisdom-Abwurf, der bei k geschickten Abilities noch faellig waere
// (0 = keine Luecke oder Divinity deckt sie).
function wisdomFor(engine, pi, heroIdx, cd, k, zonesAtCast) {
  const probe = { ...cd, level: Math.max(0, (cd.level || 0) - k) };
  return withCastZones(engine, pi, heroIdx, zonesAtCast,
    () => Math.max(0, engine.getWisdomDiscardCost(pi, heroIdx, probe)));
}

/**
 * Plan fuer einen Helden: mit wie vielen geschickten Abilities ist
 * die Karte castbar? Liefert
 *   minFree   – kleinstes k OHNE Wisdom-Abwurf (−1: gibt es nicht)
 *   minPaid   – kleinstes k, bei dem Wisdom die Restluecke deckt UND
 *               die Hand den Abwurf hergibt (−1: gibt es nicht)
 *   total     – wie viele Ability-Karten haengen ueberhaupt
 * `handFree` = Karten, die neben der Karte selbst noch in der Hand
 * liegen (im Fenster ist die Karte noch drin, im Resolve schon raus).
 */
function plan(engine, pi, heroIdx, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return null;
  const cd = engine._getCardDB()[CARD_NAME];
  if (!cd) return null;
  const { abilities, equips } = sendables(engine, pi, heroIdx);
  const total = abilityCardCount(abilities);
  const handFree = Math.max(0, (ps.hand || []).length - (opts.cardStillInHand ? 1 : 0));
  let minFree = -1, minPaid = -1;
  for (let k = 0; k <= total; k++) {
    if (!meetsWith(engine, pi, heroIdx, cd, k)) continue;
    const w = wisdomFor(engine, pi, heroIdx, cd, k);
    if (w === 0) { minFree = k; break; }
    if (minPaid < 0 && handFree >= w) minPaid = k;
  }
  return { minFree, minPaid, total, equips: equips.length, hero };
}

function castable(p) {
  return !!p && (p.minFree >= 0 || p.minPaid >= 0) && (p.total + p.equips) > 0;
}

// ── Ziel-Objekte fuer die Brett-Auswahl ──────────────────────────
function targetsFor(engine, pi, heroIdx) {
  const { abilities, equips } = sendables(engine, pi, heroIdx);
  const out = [];
  for (const a of abilities) {
    out.push({
      id: a.id, type: a.type, owner: a.owner, heroIdx: a.heroIdx, slotIdx: a.slotIdx,
      cardName: a.cardName, cardInstance: a.cardInstance || undefined,
      _wa: { kind: 'ability', entry: a },
    });
  }
  for (const e of equips) {
    out.push({
      id: e.id, type: 'equip', owner: e.owner, heroIdx: e.heroIdx, slotIdx: e.slotIdx,
      cardName: e.cardName, cardInstance: e.cardInstance,
      _wa: { kind: 'equip', inst: e.cardInstance },
    });
  }
  return out;
}

module.exports = {
  // Reaction-Subtype: nie proaktiv in der Main Phase spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isPreDamageReaction: true,
  // „the user" — der getroffene Held castet (v800, `_rxCastPlan`).
  casterIsTarget: true,
  // Wisdom entscheidet sich erst nach der Auswahl — siehe Kopf.
  handlesOwnWisdomCost: true,

  /**
   * Level-Bypass fuer den Tuersteher des Fensters: der Held erreicht
   * das Level, indem er Abilities schickt. Tote Helden nie (die
   * Engine fragt den Bypass auch im Toten-Zweig).
   */
  canBypassLevelReq(gs, pi, heroIdx, cardData, engine) {
    if (cardData?.name !== CARD_NAME) return false;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return castable(plan(engine, pi, heroIdx, { cardStillInHand: true }));
  },

  preDamageCondition(gs, ownerIdx, engine, target, heroIdx, source, amount /*, type */) {
    if (!(amount > 0)) return false;
    if (!target || target.hp <= 0) return false;
    return castable(plan(engine, ownerIdx, heroIdx, { cardStillInHand: true }));
  },

  /**
   * Die Karte ist hier schon aus der Hand (Fenster-Vertrag). Schleife:
   * ein Klick = eine Karte fliegt, dann neu fragen. „Done" gibt es
   * erst, wenn die Luecke zu ist — entweder durch Abilities allein
   * oder durch Abilities + Wisdom-Abwurf, der dann bei „Done" faellig
   * wird.
   */
  async preDamageResolve(engine, ownerIdx, target, heroIdx, source, amount /*, type */) {
    const ps = engine.gs.players[ownerIdx];
    const heroName = target?.name || 'the user';
    let sent = 0, abilitiesSent = 0, schleifen = 0;
    // Schnappschuss der Ability-Zonen zum Cast-Zeitpunkt (s. withCastZones).
    const zonesAtCast = (ps?.abilityZones?.[heroIdx] || [[], [], []]).map(z => (z || []).slice());

    // Der Cast steht — ab hier laufen Auswahl und Abwurf als Effekt,
    // Wisdom bemisst sich an dem, was NACH der Auswahl noch fehlt.
    const remainingWisdom = () => {
      const cd = engine._getCardDB()[CARD_NAME];
      if (meetsWith(engine, ownerIdx, heroIdx, cd, abilitiesSent, zonesAtCast)) {
        return wisdomFor(engine, ownerIdx, heroIdx, cd, abilitiesSent, zonesAtCast);
      }
      return -1; // Luecke ohne Deckung
    };
    const doneAllowed = () => {
      if (sent === 0) return false;             // nichts geschickt = nichts geheilt
      const w = remainingWisdom();
      if (w < 0) return false;
      return w === 0 || (ps.hand || []).length >= w;
    };

    // Schleifenkappe: eine Karte je Durchlauf, hoechstens 3 Ability-Slots
    // × 3 Kopien + 3 Equips = 12 Sendungen; 40 ist reichlich.
    while (schleifen++ < 40) {
      const ziele = targetsFor(engine, ownerIdx, heroIdx);
      if (ziele.length === 0) break;
      const fertigErlaubt = doneAllowed();
      const w = remainingWisdom();
      const hint = sent === 0
        ? `Click an Artifact equipped or an Ability attached to ${heroName} to send it to the discard pile (+${HEAL_PER_CARD} HP each).`
        : `Sent ${sent} (${abilitiesSent} Abilit${abilitiesSent === 1 ? 'y' : 'ies'}) — heal ${sent * HEAL_PER_CARD} HP so far. Click the next card, or stop here.`;
      const need = !fertigErlaubt
        ? (w > 0 ? ` You still need ${w} more card${w === 1 ? '' : 's'} in hand for Wisdom, or send more Abilities.`
                 : ' Send more Abilities to reach the required level.')
        : (w > 0 ? ` Stopping now discards ${w} card${w === 1 ? '' : 's'} for Wisdom.` : '');
      const gewaehlt = await engine.promptEffectTarget(ownerIdx, ziele, {
        title: CARD_NAME,
        description: hint + need,
        confirmLabel: '🌀 Absorb',
        confirmClass: 'btn-info',
        cancelLabel: '✓ Done',
        cancellable: fertigErlaubt,
        previewCardName: CARD_NAME,
        autoConfirm: true,
        maxTotal: 1,
        minRequired: 1,
        // Vertrag fuer den Ability-Kosten-Lernkanal (v801, CARD_API):
        // das CPU-Gehirn entscheidet daran je Schritt, ob und was
        // geschickt wird; Menschen sehen das Feld nie (Weisse Liste).
        _abilityCost: {
          cardName: CARD_NAME, heroIdx, sent, abilitiesSent, amount: amount || 0,
          // Luecke NICHT durch Aufhoeren schliessbar → es MUSS eine Ability kommen
          needMore: w < 0 || (w > 0 && (ps.hand || []).length < w),
          // Aufhoeren ginge, kostet aber Wisdom-Abwuerfe
          wisdomPending: w > 0,
        },
      });
      if (gewaehlt == null) break;                 // Engine stillgelegt
      if (gewaehlt.length === 0) {
        if (fertigErlaubt) break;
        continue; // darf noch nicht aufhoeren
      }
      const ziel = ziele.find(z => z.id === gewaehlt[0]);
      if (!ziel?._wa) continue;

      let weg = false;
      if (ziel._wa.kind === 'ability') {
        weg = await engine.discardAbilityTopCopy(ziel._wa.entry, { source: CARD_NAME, sourceOwner: ownerIdx });
        if (weg) abilitiesSent++;
      } else {
        weg = await engine.sendBoardCardToDiscard(ziel._wa.inst, { source: CARD_NAME, sourceOwner: ownerIdx });
      }
      if (!weg) continue;
      sent++;
      engine.sync();
      await engine._delay(350);
    }

    if (sent === 0) {
      engine.log('weapon_absorption', { player: ps?.username, hero: heroName, sent: 0, abilities: 0, heal: 0 });
      return {};
    }

    // Wisdom fuer die Restluecke — jetzt, da die Auswahl steht.
    const w = remainingWisdom();
    if (w > 0) {
      await engine.actionPromptForceDiscard(ownerIdx, w, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
      });
    }

    const heal = sent * HEAL_PER_CARD;
    engine._broadcastEvent('play_zone_animation', {
      type: 'weapon_absorption', owner: ownerIdx, heroIdx, zoneSlot: -1,
    });
    await engine._delay(300);
    await engine.actionHealHero({ name: CARD_NAME, owner: ownerIdx }, target, heal);
    engine.log('weapon_absorption', {
      player: ps?.username, hero: heroName, sent, abilities: abilitiesSent, heal,
    });
    engine.sync();
    await engine._delay(300);
    return {};
  },

  /**
   * CPU — zwei Ebenen, beide OHNE das Gehirn zu umgehen:
   *
   * 1. OB feuern: `cpuMeta.reactionHeuristic` (Vorstufe des Reaktions-
   *    Lernkanals, v801): nur wenn der Treffer toedlich waere und die
   *    Heilung (Max-HP-Kappe!) ihn ueberleben laesst. Der gelernte
   *    Reaktions-Kanal (`reactionFireDecision`, Bucket lethal/heavy/
   *    light) darf das uebersteuern. Im Puzzle feuert die CPU immer
   *    (Engine-Standard) — deshalb hier KEIN `cpuResponse('generic')`.
   * 2. WAS und WIE VIEL: der Ability-Kosten-Kanal (`_abilityCost` am
   *    Prompt) entscheidet mit Regel/Exploration; ohne Meinung greift
   *    die Heuristik unten — so viele Karten wie noetig, Equips zuerst,
   *    Fremdschul-Abilities vor Magic Arts. Im Puzzle: undefined →
   *    die Engine schickt alles (erster Kandidat, bis nichts mehr da ist).
   */
  cpuMeta: {
    reactionHeuristic(engine, promptData) {
      const ctx = promptData?._preDamageContext;
      if (!ctx) return false;
      const { targetOwner, targetHeroIdx, amount } = ctx;
      const hero = engine.gs?.players?.[targetOwner]?.heroes?.[targetHeroIdx];
      if (!hero) return false;
      const p = plan(engine, targetOwner, targetHeroIdx, { cardStillInHand: true });
      if (!castable(p)) return false;
      const need = Math.max(p.minFree >= 0 ? p.minFree : p.minPaid, 1);
      const maxCards = p.total + p.equips;
      const maxHeal = Math.min(hero.maxHp || hero.hp, hero.hp + maxCards * HEAL_PER_CARD);
      if (amount < hero.hp) return false;          // nicht toedlich
      if (maxHeal <= amount) return false;         // rettet nicht
      return need <= maxCards;
    },
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = promptData || {};
    const st = config?._abilityCost;
    if (!st || !Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    if (engine.isPuzzle) return undefined;         // Puzzle: alles schicken (Engine-Standard)
    const hero = engine.gs?.players?.[playerIdx]?.heroes?.[st.heroIdx];
    if (!hero) return undefined;
    // Mehr als bis Max-HP heilt keine Karte — sonst schickt die CPU
    // alles, obwohl es nichts mehr bringt.
    const needHeal = Math.min(Math.max(0, (st.amount || 0) - hero.hp + 1), Math.max(0, (hero.maxHp || hero.hp) - hero.hp));
    const wantMore = st.needMore || st.sent * HEAL_PER_CARD < needHeal || st.sent === 0;
    if (!wantMore && config.cancellable) return [];
    // Reihenfolge: Equips, dann Nicht-Magic-Arts-Abilities, dann Magic Arts.
    const rank = (t) => t.type === 'equip' ? 0 : (t.cardName === 'Magic Arts' ? 2 : 1);
    const sorted = validTargets.slice().sort((a, b) => rank(a) - rank(b));
    // Ist die Luecke offen, muss eine ABILITY kommen.
    const pick = st.needMore ? (sorted.find(t => t.type !== 'equip') || sorted[0]) : sorted[0];
    return pick ? [pick.id] : [];
  },
};
