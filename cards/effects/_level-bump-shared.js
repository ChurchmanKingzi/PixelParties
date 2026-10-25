// ═══════════════════════════════════════════
//  GEMEINSAMER BAUSTEIN: „Increase that Spell's level by 1. If the Spell's level is then too high for its user to use, negate it and send
//  it to the discard pile."  (Shamanic Curse, Celia, the Class Clown)
//
//  Die Stufe wird NICHT dauerhaft veraendert: fuer die Pruefung wird `levelOverrideCards` des Wirkers kurz auf Stufe+1 gesetzt und
//  `getWisdomDiscardCost` gefragt (-1 = auch ueber Wisdom nicht zu decken). Wisdom-Helden zahlen den Zusatz-Abwurf TATSAECHLICH
//  (die urspruenglichen Wisdom-Kosten zahlt `doPlaySpell` nach der Aufloesung; hier kommt nur die Differenz dazu).
//
//  Rueckgabe `{ status, link }`:
//    'abort'    — Wirker/Zauber nicht mehr da, nichts passiert
//    'survived' — die erhoehte Stufe ist noch spielbar (Zusatz-Abwurf bezahlt)
//    'negated'  — zu hoch: Kettenglied negiert (Ablage), der Zauber ist verloren
//  `link` = das betroffene Kettenglied. Wer danach eine Zusatzaktion gewaehrt, entscheidet der Aufrufer.
// ═══════════════════════════════════════════

/**
 * @param {object} engine
 * @param {Array} chain
 * @param {number} targetIndex   Index des Zauber-Kettenglieds
 * @param {object} [opts]        { logPrefix, title, animation }
 */
async function stufeErhoehen(engine, chain, targetIndex, opts = {}) {
  const gs = engine.gs;
  const logPrefix = opts.logPrefix || 'level_bump';
  const targetLink = chain?.[targetIndex];
  if (!targetLink) return { status: 'abort', link: null };

  const oppIdx = targetLink.owner;
  const oppPs = gs.players[oppIdx];
  const castingHi = targetLink.heroIdx ?? -1;
  // W16g (R02-22): bei einem geliehenen Wirker (Charme …) liegt der Held auf der Brettseite `casterOwner`, nicht beim
  // Kontrolleur `owner`; Hand/Abwurf bleiben beim Kontrolleur (`oppIdx`).
  const heroSeite = targetLink.casterOwner ?? oppIdx;
  const castingHero = gs.players[heroSeite]?.heroes?.[castingHi];
  const spellName = targetLink.cardName;
  const spellCd = engine._getCardDB()[spellName];

  if (!oppPs || !castingHero || !spellCd) {
    engine.log(`${logPrefix}_abort`, { reason: 'caster-or-spell-missing' });
    return { status: 'abort', link: targetLink };
  }

  // Determine the new required Wisdom cost when the spell's effective
  // level goes up by 1. Temporarily patch the caster's levelOverrideCards
  // so engine.getWisdomDiscardCost sees the bumped level.
  if (!castingHero.levelOverrideCards) castingHero.levelOverrideCards = {};
  const hadOverride = Object.prototype.hasOwnProperty.call(castingHero.levelOverrideCards, spellName);
  const prevOverride = hadOverride ? castingHero.levelOverrideCards[spellName] : undefined;
  const currentLevel = prevOverride != null ? prevOverride : (spellCd.level || 0);
  castingHero.levelOverrideCards[spellName] = currentLevel + 1;

  const newCost = engine.getWisdomDiscardCost(heroSeite, castingHi, spellCd);

  // Restore override exactly as it was
  if (!hadOverride) delete castingHero.levelOverrideCards[spellName];
  else castingHero.levelOverrideCards[spellName] = prevOverride;
  // W5b-B9 (Al, Welle 5): der erhöhte Level kostet bei Wisdom-Helden den Zusatz-Abwurf TATSÄCHLICH.
  const oldCost = Math.max(0, engine.getWisdomDiscardCost(heroSeite, castingHi, spellCd));

  // newCost: -1 means uncoverable (no Wisdom path exists), otherwise the
  // required extra discards. Spell survives iff the caster CAN cover it
  // AND has enough hand cards to pay (Gesamtkosten; B9: die Differenz zum Ursprungsgebot wird unten wirklich abgeworfen).
  const coverable = newCost >= 0;
  // ★ Z4 (R02-15): der gerade gewirkte Zauber liegt noch in `oppPs.hand`, ist aber keine bezahlbare Handkarte.
  const affordable = coverable && engine._handIndizesOhneAufloesende(oppPs).length >= newCost;

  if (opts.animation !== null) {   // `animation: null` = der Aufrufer spielt sein eigenes Bild
    engine._broadcastEvent('play_zone_animation', {
      type: opts.animation || 'plague_smoke', owner: heroSeite,
      heroIdx: castingHi >= 0 ? castingHi : 0, zoneSlot: -1,
    });
    await engine._delay(500);
  }

  if (affordable) {
    // Still legal – aber der Zusatz-Level kostet bei Wisdom-Helden die Differenz an Handkarten (Abwurf wie die Wisdom-Kosten;
    // die auflösende Karte ist ausgenommen). Gesamtkosten (alt + Zusatz) sind oben als bezahlbar geprüft.
    const extra = Math.max(0, newCost - oldCost);
    if (extra > 0) {
      await engine.actionPromptForceDiscard(oppIdx, extra, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
      });
    }
    engine.log(`${logPrefix}_survived`, { spell: spellName, newCost, extraDiscarded: extra });
    engine.sync();
    return { status: 'survived', link: targetLink };
  }

  // Uncoverable → negate the Spell (Ablage).
  engine.negateChainLink(chain, targetIndex);
  return { status: 'negated', link: targetLink };
}

/**
 * Hat der Zauber seinem Spieler eine AKTION gekostet („If this was your opponent's Action")? Dieselbe Erkennung wie bei Lunar Eclipse /
 * The Master's Plan: nur ein Initial-Kettenglied (aus der Hand gespielt, keine Reaktion) und nur Spell/Attack/Creature ohne `inherentAction`.
 */
function kostetteAktion(engine, link, loadCardEffect, hasCardType) {
  if (!link?.isInitialCard) return false;
  const cd = engine._getCardDB()[link.cardName];
  if (!cd) return false;
  if (!(hasCardType(cd, 'Spell') || hasCardType(cd, 'Attack') || hasCardType(cd, 'Creature'))) return false;
  const sc = loadCardEffect(link.cardName);
  const gs = engine.gs;
  const inherent = sc
    ? (typeof sc.inherentAction === 'function' ? sc.inherentAction(gs, link.owner, link.heroIdx ?? -1, engine) : sc.inherentAction === true)
    : false;
  return !inherent;
}

module.exports = { stufeErhoehen, kostetteAktion };
