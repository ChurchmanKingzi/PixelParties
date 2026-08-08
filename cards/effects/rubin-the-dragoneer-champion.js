// ═══════════════════════════════════════════
//  CARD EFFECT: "Rubin, the Dragoneer Champion"
//  Hero — 400 HP / 80 ATK (Destruction Magic + Resistance)
//
//  "Once per turn, during either player's turn, when you summon a
//   Creature by sacrificing one or more other Creatures, you may
//   immediately perform a Destruction Spell from your hand with this
//   Hero as an additional Action."
//
//  ── Auslöser ────────────────────────────────────────────────────
//  Der Vertrag `_tributePaid` (Engine, 8.8.) beantwortet „wurde für
//  diese Beschwörung geopfert?" an genau EINER Stelle:
//   • Kosten-Tribute (`sacrificeSpec`, Suspicious-Monster-/Teocuilatl-
//     Muster) erkennt `_runBeforeSummon` daran, dass während der
//     Kostenzahlung ON_CREATURE_SACRIFICED gefeuert hat.
//   • Karten, die ERST opfern und DANN separat beschwören
//     (Calamitusk, Garius), melden es ausdrücklich über
//     `hookExtras._tributePaid`.
//
//  ALS RULING 8.8.: **Dark Deepsea God zählt NICHT** — er bounct seine
//  „Opfer" zurück auf die Hand, statt sie abzuwerfen. Das ergibt sich
//  hier von selbst und ohne Namensprüfung: DDG feuert
//  ON_CREATURE_SACRIFICED gar nicht, also bleibt `_tributePaid` aus.
//
//  „one or more OTHER Creatures": der Tribut ist per Konstruktion nie
//  die beschworene Karte selbst — er wird bezahlt, BEVOR sie das Feld
//  betritt.
//
//  ── Der Zauber ──────────────────────────────────────────────────
//  ALS RULING 8.8.: alle Anforderungen gelten ganz normal — Level,
//  Schule, Wisdom-Kosten, Karten-eigene Spielbedingungen, Helden-
//  Beschränkungen. EINZIGE Ausnahme: es kostet keine Aktion. Deshalb
//  wird hier NICHT der rohe Sub-Cast von Timeless King Zi benutzt (der
//  umgeht die Levelprüfung, weil SEIN Text „regardless of its level"
//  sagt), sondern der reguläre Weg von `learning.js` — mit
//  Reaktionsfenster, Wisdom-Zahlung und Helden-Bindung, aber ohne
//  jede Aktions-Buchhaltung.
//
//  ── „during either player's turn" ───────────────────────────────
//  ALS RULING 8.8.: ausdrücklich so gewollt, als künftiger Designraum.
//  Eine Opfer-Beschwörung im GEGNERZUG ist derzeit noch gar nicht
//  möglich — der Auslöser ist trotzdem seitenunabhängig gebaut, damit
//  er greift, sobald es sie gibt. `once per turn` hängt am Zugzähler,
//  der pro Halbzug hochzählt: einmal im eigenen, einmal im gegnerischen
//  Zug.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Rubin, the Dragoneer Champion';

/** Ist die Karte ein Spell mit Destruction Magic? (Attacks zählen nicht.) */
function isDestructionSpell(cd) {
  if (!cd || cd.cardType !== 'Spell') return false;
  return cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic';
}

/**
 * Handindizes, die Rubin JETZT wirklich wirken dürfte. Bewusst dieselbe
 * Prüfkette wie `learning.js` — das ist die kanonische Antwort auf
 * „darf dieser Held diesen Zauber aus der Hand spielen?".
 */
function eligibleHandIndices(engine, pi, heroIdx) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const hero = ps.heroes?.[heroIdx];
  const heroScript = hero?.name ? loadCardEffect(hero.name) : null;
  // Der gewählte Zauber verlässt die Hand, BEVOR seine Wisdom-Kosten
  // bezahlt werden — er kann seinen eigenen Abwurf also nicht finanzieren.
  const wisdomPool = Math.max(0, (ps.hand || []).length - 1);

  const cache = new Map();
  const out = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const name = ps.hand[i];
    let ok = cache.get(name);
    if (ok === undefined) {
      ok = false;
      const cd = cardDB[name];
      if (isDestructionSpell(cd)) {
        const script = loadCardEffect(name);
        ok = true;
        if (script?.isReaction || script?.isSurprise || script?.neverPlayable) ok = false;
        if (ok && !engine.heroMeetsLevelReq(pi, heroIdx, cd)) ok = false;
        if (ok) {
          const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cd);
          if (wisdomCost > 0 && wisdomPool < wisdomCost) ok = false;
        }
        if (ok && heroScript?.canPlayCard
            && !heroScript.canPlayCard(gs, pi, heroIdx, cd, engine)) ok = false;
        if (ok && typeof script?.spellPlayCondition === 'function') {
          try { if (!script.spellPlayCondition(gs, pi)) ok = false; }
          catch (err) {
            console.error(`[${CARD_NAME}] spellPlayCondition ${name}:`, err.message);
            ok = false;
          }
        }
      }
      cache.set(name, ok);
    }
    if (ok) out.push(i);
  }
  return out;
}

/**
 * Den gewählten Zauber wirken — Vorlage `castLearningSpell` aus
 * learning.js, ohne jede Aktions-Buchhaltung (Rubins Zusatz-Aktion
 * verbraucht keine Aktion, also wird auch keine gezählt).
 */
async function performSpell(engine, pi, heroIdx, cardName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return false;

  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;

  const findInHand = () => (ps.hand || []).indexOf(cardName);
  if (findInHand() < 0) return false;

  // Die getrackte Handinstanz an Rubin binden — Zauber, die
  // `ctx.cardHeroIdx` lesen (Burning Finger & Co.), fizzeln sonst still.
  let handInst = null;
  for (let i = engine.cardInstances.length - 1; i >= 0; i--) {
    const c = engine.cardInstances[i];
    if (c.zone === 'hand' && c.owner === pi && c.name === cardName) { handInst = c; break; }
  }
  if (handInst) handInst.heroIdx = heroIdx;

  const wisdomCost = engine.getWisdomDiscardCost(pi, heroIdx, cd);
  const payWisdom = async () => {
    if (wisdomCost <= 0) return;
    await engine.actionPromptForceDiscard(pi, wisdomCost, {
      title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
    });
  };

  engine.log('rubin_perform', { player: ps.username, hero: hero.name, spell: cardName });

  // Reaktionsfenster, solange der Zauber noch in der Hand liegt
  // (Anti Magic Shield, The Master's Plan, …) — wie beim normalen Cast.
  const chainResult = await engine.executeCardWithChain({
    cardName, owner: pi, heroIdx, cardType: cd.cardType, goldCost: 0,
  });

  if (chainResult.negated) {
    const i = findInHand();
    if (i >= 0) ps.hand.splice(i, 1);
    ps.discardPile.push(cardName);
    if (handInst) engine._untrackCard(handInst.id);
    await payWisdom();
    engine.log('rubin_spell_negated', { player: ps.username, spell: cardName });
    engine.sync();
    return true;
  }

  gs._immediateActionContext = true;
  gs._spellResolutionDepth = (gs._spellResolutionDepth || 0) + 1;
  const hadPriorLog = gs._spellDamageLog !== undefined;
  if (!hadPriorLog) gs._spellDamageLog = [];

  try {
    await engine.runHooks('onPlay', {
      _onlyCard: handInst, playedCard: handInst,
      cardName, zone: 'hand', heroIdx,
      _skipReactionCheck: true,
    });

    if (!gs._spellNegatedByEffect) {
      const uniqueTargets = [];
      const seenIds = new Set();
      for (const t of (gs._spellDamageLog || [])) {
        if (t && !seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
      }
      await engine.runHooks('afterSpellResolved', {
        spellName: cardName, spellCardData: cd,
        heroIdx, casterIdx: pi, damageTargets: uniqueTargets,
        isSecondCast: false, _skipReactionCheck: true,
      });
    }
  } catch (err) {
    console.error(`[${CARD_NAME}] Zauber-Auflösung fehlgeschlagen:`, err?.message || err);
  } finally {
    gs._spellResolutionDepth = Math.max(0, (gs._spellResolutionDepth || 1) - 1);
    delete gs._immediateActionContext;
    if (!hadPriorLog) delete gs._spellDamageLog;
  }

  // Areas / Attachments legen sich selbst aufs Brett — dann bleibt die
  // Instanz dort und darf nicht zusätzlich abgelegt werden.
  const placedOnBoard = !!gs._spellPlacedOnBoard;
  delete gs._spellPlacedOnBoard;

  const i = findInHand();
  if (i >= 0) ps.hand.splice(i, 1);
  if (!placedOnBoard) {
    ps.discardPile.push(cardName);
    if (handInst) engine._untrackCard(handInst.id);
  }
  await payWisdom();
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * Auslöser: eine Kreatur betritt die Support Zone dieses Spielers,
     * und für ihre Beschwörung wurde geopfert (`_tributePaid`).
     */
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      // Reihenfolge der Wachen: erst die BILLIGEN und stillen (jede Karte,
      // die irgendwo hin wandert, laeuft hier durch — auch in den
      // Ablagestapel), dann erst die interessanten. Sonst steht die
      // Diagnose voller `zone=discard`-Zeilen.
      if (ctx.toZone !== 'support') return;
      if (ctx._isMove) return;
      const inst = ctx.enteringCard;
      if (!inst) return;
      const summoner = inst.controller ?? inst.owner;
      const pi = ctx.cardOwner;                 // Rubins Besitzer
      if (summoner !== pi) return;              // „when YOU summon"

      const cardDB = engine._getCardDB();
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      if (!ctx._tributePaid) return;

      const hero = ctx.attachedHero;
      const heroIdx = ctx.cardHeroIdx;
      if (!hero?.name || hero.hp <= 0) return;

      // Once per turn — Rundenstempel auf der Instanz statt eines
      // onTurnStart-Zählers: der würde bei eingefrorenem/gestuntem
      // Helden übersprungen (Als Regel 4.8.). Der Zugzähler läuft je
      // Halbzug hoch, „einmal je Zug" gilt damit in beiden Zügen.
      const counters = ctx.card?.counters || (ctx.card ? (ctx.card.counters = {}) : null);
      if (!counters) return;
      if (counters._rubinTurn === gs.turn) return;

      const eligible = eligibleHandIndices(engine, pi, heroIdx);
      if (eligible.length === 0) return;

      const pick = await engine.promptGeneric(pi, {
        type: 'pickHandCard',
        title: CARD_NAME,
        description: `Choose a Destruction Spell from your hand to perform with ${hero.name} as an additional Action.`,
        eligibleIndices: eligible,
        cancellable: true,
      });
      // Abgelehnt verbraucht die Nutzung NICHT — „you may … perform"
      // begrenzt die Ausführungen, nicht die Angebote (Muster Ralzish).
      if (!pick || pick.cancelled || pick.handIndex == null) return;

      const pickedName = pick.cardName || gs.players[pi]?.hand?.[pick.handIndex];
      if (!pickedName) return;

      // Gegenprüfung am LEBENDEN Zustand: die Abfrage ist asynchron, die
      // Hand kann sich zwischenzeitlich geändert haben.
      const live = eligibleHandIndices(engine, pi, heroIdx);
      if (!live.some(i => gs.players[pi].hand[i] === pickedName)) return;

      counters._rubinTurn = gs.turn;
      await performSpell(engine, pi, heroIdx, pickedName);
    },
  },
};
