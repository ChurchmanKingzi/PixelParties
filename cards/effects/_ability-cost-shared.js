// ═══════════════════════════════════════════
//  SHARED: Karten, die mit ABILITIES / EQUIPS bezahlen (v804)
//
//  „Send any number of Artifacts equipped and Abilities attached to
//   the user" (Weapon Storm), „Send 3/2/1 Abilities from that Hero"
//   (Barrier of Faith) — die Brett-Schleife aus Weapon Absorption als
//  Modul: ein Klick schickt EINE Karte (bei Ability-Stapeln die
//  oberste Kopie), dann neu fragen; „✓ Done" erst, wenn das Minimum
//  erreicht ist. Jeder Prompt traegt den `_abilityCost`-Vertrag, damit
//  der Ability-Kosten-Lernkanal (v801) mitentscheidet und mitlernt.
//
//  Senden laeuft ueber `discardAbilityTopCopy` / `sendBoardCardToDiscard`
//  (v800) — Leave-Hooks, Untracking, `onBoardSentToDiscard` inklusive.
// ═══════════════════════════════════════════

const { ZONES } = require('./_hooks');

/**
 * Was der Held schicken darf.
 *   abilities: Eintraege aus `getAbilityTargets` (je Slot einer,
 *              `level` = Stapelhoehe; Cloak-of-Edge-Karten zaehlen als Ability)
 *   equips:    Artefakte mit Subtype Equipment in seinen Support Zones,
 *              die nicht schon als Ability zaehlen
 */
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

/** Zahl der einzelnen Ability-KARTEN (Stapel zaehlen mit ihrer Hoehe). */
function abilityCardCount(abilities) {
  // `level` = Stapelhoehe — in Ability-Zonen UND bei echten Ability-
  // Stapeln in Support Zones (Xal, Xalibur); Cloak-of-Edge-Karten 1.
  return abilities.reduce((n, a) => n + (a.level || 1), 0);
}

function targetsFor(engine, pi, heroIdx, kinds) {
  const { abilities, equips } = sendables(engine, pi, heroIdx);
  const out = [];
  if (kinds.includes('ability')) {
    for (const a of abilities) {
      out.push({
        id: a.id, type: a.type, owner: a.owner, heroIdx: a.heroIdx, slotIdx: a.slotIdx,
        cardName: a.cardName, cardInstance: a.cardInstance || undefined,
        _send: { kind: 'ability', entry: a },
      });
    }
  }
  if (kinds.includes('equip')) {
    for (const e of equips) {
      out.push({
        id: e.id, type: 'equip', owner: e.owner, heroIdx: e.heroIdx, slotIdx: e.slotIdx,
        cardName: e.cardName, cardInstance: e.cardInstance,
        _send: { kind: 'equip', inst: e.cardInstance },
      });
    }
  }
  return out;
}

/**
 * Die Schleife.
 * @param opts.cardName     Titel / Kanal-Schluessel
 * @param opts.kinds        ['ability'] | ['ability','equip']
 * @param opts.min          Mindestzahl zu schickender Karten (Abilities
 *                          zaehlen immer, Equips nur wenn erlaubt)
 * @param opts.max          Hoechstzahl (Infinity = „any number")
 * @param opts.amount       anstehender Schaden fuer den Lernkanal (0 = keiner)
 * @param opts.confirmLabel Button-Text
 * @param opts.describe     (sent, abilitiesSent, remaining) → Beschreibung
 * @returns {{sent, abilitiesSent, equipsSent, aborted}}
 */
async function sendCardsLoop(engine, pi, heroIdx, opts) {
  const kinds = opts.kinds || ['ability', 'equip'];
  const min = Math.max(0, opts.min || 0);
  const max = opts.max == null ? Infinity : opts.max;
  let sent = 0, abilitiesSent = 0, equipsSent = 0, schleifen = 0, aborted = false;
  while (schleifen++ < 40 && sent < max) {
    const ziele = targetsFor(engine, pi, heroIdx, kinds);
    if (ziele.length === 0) break;
    const remaining = Math.max(0, min - sent);
    const fertigErlaubt = remaining === 0 && sent > 0;
    const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
      title: opts.cardName,
      description: opts.describe ? opts.describe(sent, abilitiesSent, remaining) : '',
      confirmLabel: opts.confirmLabel || '📤 Send',
      confirmClass: opts.confirmClass || 'btn-info',
      cancelLabel: '✓ Done',
      cancellable: fertigErlaubt,
      previewCardName: opts.cardName,
      autoConfirm: true,
      maxTotal: 1,
      minRequired: 1,
      _abilityCost: {
        cardName: opts.cardName, heroIdx, sent, abilitiesSent, amount: opts.amount || 0,
        needMore: remaining > 0, wisdomPending: false,
        max: Number.isFinite(max) ? max : undefined,
      },
    });
    // „✓ Done" kommt vom Client als null (Cancel-Pfad des Pickers) —
    // das ist ein regulaeres Aufhoeren, KEIN Abbruch (Als Befund 6.9.:
    // Weapon Storm brach nach „Done" den ganzen Angriff ab). Abbruch
    // ist nur die stillgelegte Engine.
    if (gewaehlt == null) {
      if (engine._aborted) { aborted = true; break; }
      if (fertigErlaubt) break;
      continue;
    }
    if (gewaehlt.length === 0) {
      if (fertigErlaubt) break;
      continue;
    }
    const ziel = ziele.find(z => z.id === gewaehlt[0]);
    if (!ziel?._send) continue;
    let weg = false;
    if (ziel._send.kind === 'ability') {
      weg = await engine.discardAbilityTopCopy(ziel._send.entry, { source: opts.cardName, sourceOwner: pi });
      if (weg) abilitiesSent++;
    } else {
      weg = await engine.sendBoardCardToDiscard(ziel._send.inst, { source: opts.cardName, sourceOwner: pi });
      if (weg) equipsSent++;
    }
    if (!weg) continue;
    sent++;
    engine.sync();
    await engine._delay(350);
  }
  return { sent, abilitiesSent, equipsSent, aborted };
}

/**
 * CPU-Rueckfall fuer `cpuResponse('effectTarget')` einer zahlenden
 * Karte, wenn der Lernkanal keine Meinung hat: Pflichtsendungen
 * zuerst (Ability, wenn eine gefordert ist), Equips vor Abilities,
 * Abilities der eigenen Kartenschule zuletzt; aufhoeren, sobald
 * `wantMore(state)` false sagt und Aufhoeren erlaubt ist.
 * Im Puzzle: undefined (Engine-Standard, alles schicken).
 */
function cpuSendFallback(engine, promptData, { school, wantMore } = {}) {
  const { validTargets, config } = promptData || {};
  const st = config?._abilityCost;
  if (!st || !Array.isArray(validTargets) || validTargets.length === 0) return undefined;
  if (engine.isPuzzle) return undefined;
  const more = st.needMore || st.sent === 0 || (typeof wantMore === 'function' ? wantMore(st) : false);
  if (!more && config.cancellable) return [];
  const rank = (t) => t.type === 'equip' ? 0 : (school && t.cardName === school ? 2 : 1);
  const sorted = validTargets.slice().sort((a, b) => rank(a) - rank(b));
  const pick = st.needMore ? (sorted.find(t => t.type !== 'equip') || sorted[0]) : sorted[0];
  return pick ? [pick.id] : [];
}

module.exports = { sendables, abilityCardCount, targetsFor, sendCardsLoop, cpuSendFallback };
