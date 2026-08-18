// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Wizard"
//  Creature (Summoning Magic Lv1, Normal) — 50 HP
//
//  "You may once per turn have this Creature perform a level 1 or
//   lower Magic Arts Spell from your hand as an additional Action."
//
//  Vorlage ist `demon-s-gate.js` (Als Ansage 17.8.: „eine Creature,
//  die selbst castet"), naechster Verwandter ist `skeleton-priest.js`.
//  Aufbau bewusst deckungsgleich mit dem Gate — dieselben drei
//  Schritte, dieselben Engine-Riegel, dieselbe Aufraeumreihenfolge.
//
//  UNTERSCHIEDE zum Gate, alle aus dem Kartentext:
//
//   1. SCHULE: nur Magic Arts (Gate: Destruction ODER Decay).
//      Geprueft mit `hasSpellSchool` — Als verbindliche Regel vom
//      16.8.: nie ein Schulfeld einzeln vergleichen. Eine
//      Doppelschul-Karte gehoert BEIDEN Schulen an, „Aligning Goals"
//      (Decay + Magic Arts) zaehlt also mit.
//
//   2. STUFENGRENZE: Lv1 oder niedriger. Das Gate hat keine.
//      Geprueft wird die EFFEKTIVE Stufe je Handplatz
//      (`effectiveCardLevel(cd, pi, { handIdx: i })`) — Muster von
//      Victory Phoenix Cannon, der einzigen anderen Karte, die
//      „Lv1 oder niedriger" auf die HAND anwendet. Damit zaehlen
//      Mana Absorbing Crystals +1 und alle Handplatz-Rabatte mit,
//      nicht die gedruckte Zahl.
//
//   3. KEIN `_castSchoolOverride`. Gate und Priest sagen beide
//      ausdruecklich „as if it had <Schule> N" — der Wizard sagt es
//      NICHT. Der Spell sieht also die echte Magic-Arts-Stufe des
//      Wirtshelden (oft 0). Heute ist das folgenlos: von den 49
//      infrage kommenden Spells skaliert KEINER ueber
//      `effectiveSchoolLevelForCaster` (nachgezaehlt am 17.8.).
//      Kommt einmal ein skalierender Lv0/Lv1-Magic-Arts-Spell dazu,
//      ist das hier die Stelle, an der Al entscheiden muss.
//
//  GLEICH wie beim Gate:
//   • Die SCHULANFORDERUNG des Spells ist aufgehoben — der Wizard ist
//     der Zaubernde, nicht der Held. Genau das ist der Sinn der Karte:
//     kleine Magic-Arts-Spells ohne Magic-Arts-Ability.
//     Die EIGENE Spielbedingung des Spells (`spellPlayCondition`)
//     bleibt dagegen bestehen — sie ist keine Schulhuerde.
//   • Nur Subtyp „Normal". Reactions lassen sich nicht aktiv spielen,
//     Area/Surprise/Attachment sind eigene Spielwege.
//   • Zaubernden-Identitaet ist der Wizard selbst:
//     `_spellCasterOverride` verankert die Animationen an seinem
//     Support-Platz, `_spellCasterCreature` leitet Rueckstoss und
//     Vergeltung (Booby Trap, Fireshield) auf ihn statt auf den
//     Wirtshelden, und die ctx-Flicken unten fangen alles ab, was der
//     Spell „dem zaubernden Helden" antun wuerde.
//   • Abbruch in der Zielabfrage kostet NICHTS: kein Rundenverbrauch,
//     der Spell bleibt auf der Hand. Der Rueckgabewert `false` haelt
//     die Engine davon ab, die Einmal-pro-Runde-Sperre zu stempeln
//     (server.js ~7570).
//   • `asPlay: 'sole'` am Pile-Transfer. Der Cast ruft
//     `script.hooks.onPlay` DIREKT auf und umgeht die Spell-Pipeline,
//     also feuert `afterSpellResolved` nie — ohne diesen Marker
//     saehe der Recorder den Einsatz nicht und der Spell erschiene
//     als Erfassungsloch mit 0 Einsaetzen.
// ═══════════════════════════════════════════

const { hasCardType, hasSpellSchool } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Skeleton Wizard';
const SCHOOL = 'Magic Arts';
const MAX_SPELL_LEVEL = 1;

/**
 * Handplaetze, die der Wizard wirken darf: Normal-Spells der Schule
 * Magic Arts mit effektiver Stufe <= 1, deren eigene Spielbedingung
 * erfuellt ist.
 *
 * Gibt INDIZES zurueck, keine Namen — `handPick` arbeitet auf
 * Handplaetzen, und zwei Kopien derselben Karte koennen dank
 * Handplatz-Rabatten unterschiedliche effektive Stufen haben.
 */
function eligibleHandIndices(engine, ps, pi) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const name = ps.hand[i];
    const cd = cardDB[name];
    if (!cd) continue;
    if (!hasCardType(cd, 'Spell')) continue;
    if ((cd.subtype || '').toLowerCase() !== 'normal') continue;
    if (!hasSpellSchool(cd, SCHOOL)) continue;
    if (engine.effectiveCardLevel(cd, pi, { handIdx: i }) > MAX_SPELL_LEVEL) continue;
    // Die Schulhuerde faellt (der Wizard castet), die EIGENE
    // Spielbedingung des Spells nicht. Defensiv gekapselt — eine
    // fehlerhafte Bedingung darf den Waehler nicht zerreissen.
    const script = loadCardEffect(name);
    if (typeof script?.spellPlayCondition === 'function') {
      let ok = false;
      try { ok = !!script.spellPlayCondition(engine.gs, pi, engine); }
      catch { ok = false; }
      if (!ok) continue;
    }
    // Ohne onPlay gaebe es nichts zu wirken.
    if (typeof script?.hooks?.onPlay !== 'function') continue;
    out.push(i);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    return eligibleHandIndices(engine, ps, ctx.cardOwner).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const wizInst = ctx.card;
    if (!wizInst) return false;
    const heroIdx = wizInst.heroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    const castingHero = ps.heroes?.[heroIdx] || null;

    const eligibleIdx = eligibleHandIndices(engine, ps, pi);
    if (eligibleIdx.length === 0) return false;

    // ── Schritt 1: Auswahl auf der Hand ──
    // `handPick` statt `cardGallery` — Hausregel fuer jede Auswahl aus
    // der EIGENEN Hand (Demon's Gate haelt sich daran, Victory Phoenix
    // Cannon stammt noch aus der Zeit davor).
    const result = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: CARD_NAME,
      description: 'Choose a Lv1-or-lower Normal Magic Arts Spell for Skeleton Wizard to cast.',
      eligibleIndices: eligibleIdx,
      minSelect: 1,
      maxSelect: 1,
      cancellable: true,
      confirmLabel: '💀 Cast!',
      // Sagt dem CPU-Piloten, dass hier EINGESETZT und nicht abgeworfen
      // wird. Ohne den Marker greift die Mulligan-Bewertung, die
      // aufsteigend sortiert und den SCHLECHTESTEN Spell zurueckgibt.
      // Mit ihm laeuft der Pick ueber den gelernten Tutor-Kanal
      // (`tutorPickRules['Skeleton Wizard→<Spell>']`) und ueber
      // MCTS-Rollouts — Als Vorgabe 18.8.: welcher Magic-Arts-Spell in
      // welcher Lage richtig ist, soll gelernt und nicht geraten werden.
      pickIntent: 'use',
    });
    if (!result || result.cancelled
        || !Array.isArray(result.selectedCards)
        || result.selectedCards.length === 0) {
      return false; // Noch nichts verbindlich — Rundensperre bleibt frei.
    }
    const pick = result.selectedCards[0];
    const handIndex = pick.handIndex;
    const spellName = pick.cardName;

    // Defensiv: die Auswahl gegen den echten Handstand nachpruefen.
    if (typeof handIndex !== 'number' || ps.hand[handIndex] !== spellName) return false;
    const cardDB = engine._getCardDB();
    const cd = cardDB[spellName];
    if (!cd || !hasCardType(cd, 'Spell')) return false;
    if ((cd.subtype || '').toLowerCase() !== 'normal') return false;
    if (!hasSpellSchool(cd, SCHOOL)) return false;
    if (engine.effectiveCardLevel(cd, pi, { handIdx: handIndex }) > MAX_SPELL_LEVEL) return false;

    // ── Schritt 2: Zaubernden-Identitaet setzen ──
    // Animationen an den Support-Platz des Wizards verankern.
    const prevCasterOverride = gs._spellCasterOverride;
    gs._spellCasterOverride = {
      owner: wizInst.owner,
      heroIdx: wizInst.heroIdx,
      zoneSlot: wizInst.zoneSlot,
    };
    // Quellen-Umschrift: Surprise-/afterDamage-/Fireshield-Fenster
    // sehen den Wizard als Angreifer, Vergeltung trifft also ihn.
    const prevCasterCreature = gs._spellCasterCreature;
    gs._spellCasterCreature = wizInst;

    // Fluechtige Instanz des Spells, damit sein onPlay einen normal
    // geformten ctx bekommt (Wirtsheld + Zone 'hand').
    const spellInst = engine._trackCard(spellName, pi, 'hand', heroIdx, -1);
    spellInst.turnPlayed = gs.turn || 0;

    const spellCtx = engine._createContext(spellInst, {
      playedCard: spellInst, cardName: spellName, zone: 'hand',
      heroIdx,
      _onlyCard: spellInst, _skipReactionCheck: true,
      _viaSkeletonWizard: true,
    });

    // Alles, was der Spell „dem zaubernden Helden" antun wuerde, landet
    // auf dem Wizard — gleiche Flicken wie bei Gate und Priest.
    const origDealDamage = spellCtx.dealDamage;
    const origDealTrueDamage = spellCtx.dealTrueDamage;
    const origHealHero = spellCtx.healHero;
    spellCtx.dealDamage = async (target, amount, type) => {
      if (target && castingHero && target === castingHero) {
        return engine.actionDealCreatureDamage(
          spellInst, wizInst, amount, type || 'other',
          { sourceOwner: pi, canBeNegated: false },
        );
      }
      return origDealDamage(target, amount, type);
    };
    spellCtx.dealTrueDamage = async (target, amount, type, opts) => {
      if (target && castingHero && target === castingHero) {
        return engine.actionDealTrueDamage(
          spellInst, wizInst, amount,
          { ...(opts || {}), type: type || 'other' },
        );
      }
      return origDealTrueDamage(target, amount, type, opts);
    };
    spellCtx.healHero = async (target, amount) => {
      if (target && castingHero && target === castingHero) {
        return engine.actionHealCreature(spellInst, wizInst, amount);
      }
      return origHealHero(target, amount);
    };

    // Abbruchmelder zuruecksetzen, damit wir NUR eine Absage aus
    // diesem verschachtelten Cast sehen.
    const prevCancelled = gs._spellCancelled;
    gs._spellCancelled = false;

    let castError = null;
    try {
      const script = loadCardEffect(spellName);
      if (typeof script?.hooks?.onPlay === 'function') {
        await script.hooks.onPlay(spellCtx);
      }
    } catch (err) {
      castError = err;
      console.error(`[Skeleton Wizard] spell '${spellName}' onPlay threw:`, err.message);
    }

    const cancelled = gs._spellCancelled === true;
    // Aufraeumen in umgekehrter Reihenfolge, damit nichts in einen
    // aeusseren Ablauf durchsickert.
    gs._spellCancelled = prevCancelled;
    if (prevCasterOverride === undefined) delete gs._spellCasterOverride;
    else gs._spellCasterOverride = prevCasterOverride;
    if (prevCasterCreature === undefined) delete gs._spellCasterCreature;
    else gs._spellCasterCreature = prevCasterCreature;
    engine._untrackCard(spellInst.id);

    // Abgebrochen oder abgestuerzt → keine Kosten, keine Rundensperre.
    // Der Spell liegt unveraendert auf der Hand (nie gespliced).
    if (cancelled || castError) {
      engine.sync();
      return false;
    }

    // ── Schritt 3: verbindlich. Spell wandert Hand → Discard. ──
    // Index neu suchen: nachgelagerte Effekte koennen die Hand
    // verschoben haben.
    const finalIdx = ps.hand.indexOf(spellName);
    if (finalIdx >= 0) {
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: spellName,
        from: 'hand', to: 'discard',
        fromHandIdx: finalIdx,
        // 'sole' statt true: `true` ueberspringt Spell/Attack bewusst,
        // weil dort sonst `afterSpellResolved` doppelt zaehlt. Der
        // Direktaufruf oben feuert diesen Hook aber gerade NICHT.
        asPlay: 'sole',
      });
      ps.hand.splice(finalIdx, 1);
      ps.discardPile.push(spellName);
    }

    engine.log('skeleton_wizard_cast', { player: ps.username, spell: spellName });
    engine.sync();
    return true;
  },
};
