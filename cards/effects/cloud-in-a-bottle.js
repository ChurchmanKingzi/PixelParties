// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloud in a Bottle"
//  Potion (Reaction).
//
//  „Play this card immediately when a target you control takes any damage.
//   Halve any damage that target would take for the rest of the turn
//   (including that damage) (rounded up)."
//
//  ★ W51c (Al, 22.10.2026) — ECHTES HALBIEREN statt Wiederherstellung
//  ─────────────────────────────────────────────────────────────────
//  Bis W51b wurde der Treffer zuerst VOLL angewendet und danach die Haelfte
//  der HP „zurueckgegeben" (Marke `_cibMarks` + `afterDamage`-Hook, fuer
//  Kreaturen die Nach-Schaden-/Pre-Defeat-Fenster). Dafuer gab es keinen
//  fachlichen Grund, nur einen historischen: die Karte war von Anfang an
//  (Structure Deck End of the World, 4db2f97b) wie ein Fireshield-artiger
//  Nach-Schaden-Waechter gebaut (`isAfterDamageReaction`), obwohl die Engine
//  mit Spectral Armor schon ein Vor-Schaden-Fenster samt Betragsaenderung
//  hatte. Folgen der Wiederherstellung: Schilde/Deckel/Boeden (Immortal,
//  `capAtHPMinus1`, Smug Coin, Einmal-Schilde) sahen den VOLLEN Betrag und
//  rechneten die Halbierung erst danach drauf, ein Held konnte zwischenzeitlich
//  mit 0 HP „fallen" und wieder aufstehen, Todes-/Treffer-Hooks sahen den
//  vollen Treffer.
//
//  Jetzt ist die Halbierung eine ganz normale Schadenssenkung:
//   • Die Karte legt „Cloudy" (Buff `damageMultiplier: 0.5`, derselbe wie bei
//     Cloud Pillow) AUF, BEVOR der Treffer berechnet ist. Die Schadens-
//     Pipeline halbiert ihn im Multiplikatoren-Durchgang (aufgerundet) —
//     „including that damage" — und erst DANACH greifen Einmal-Schilde,
//     Deckel und HP-Boeden. Ricochet: der Buff-Multiplikator ist eine
//     Senkung und geht in den Kettenbetrag ein (kein Sonderweg noetig).
//   • Es gibt keine Marken, keine Wiederherstellung und keine Nach-Schaden-
//     Fenster mehr. Cloudy gilt wie bisher bis Zugende fuer jeden weiteren
//     Schaden dieses Ziels.
//
//  Fenster (wie Spectral Armor, aber VOR dem Multiplikatoren-Durchgang):
//   1. Helden, gezielte Quellen: `isPostTargetReaction` — EIN Angebot je
//      Quelle nach der Zielwahl; bei 2+ eigenen Helden im Ziel waehlt der
//      Spieler, welcher geschuetzt wird. Cloudy liegt dann, bevor der Schaden
//      berechnet wird.
//   2. Helden, alle anderen Schadenswege (Recoil, Status-Ticks, Kreatur-
//      Effekte …) und Kreaturen: FRUEHES Hand-Fenster (`preDamageEarly: true`
//      + `isPreDamageReaction` / `isCreaturePreDamageReaction`), von der
//      Engine unmittelbar VOR dem Multiplikatoren-Durchgang geoeffnet. Dort
//      liegt auch ein sonst TOEDLICHER Treffer (Welle 14, Q10): der volle
//      Betrag inkl. Overkill wird halbiert; reicht die Haelfte noch zum Tod,
//      stirbt das Ziel trotzdem (die Karte ist verbraucht, kein Cloudy fuer
//      einen Gefallenen — `afterDamage` raeumt es ab). Kreaturen: Nur Schaden,
//      kein Zerstoeren/Opfer.
//   • Nicht anbieten, wenn der Treffer nicht senkbar ist (`cannotBeReduced`/
//     `cannotBeNegated`, z. B. Ida): der Multiplikator-Durchgang liesse ihn
//     ohnehin aus.
//   • Stapel-Sperre: Ziele, die schon „Cloudy" tragen, werden nicht mehr
//     angeboten (der Treffer ist ja bereits halbiert).
//   • Ein Angebot je Ziel und Quelle (wie Spectral Armor, v1378).
// ═══════════════════════════════════════════

const CARD_NAME = 'Cloud in a Bottle';

module.exports = {
  isPotion: true,
  canActivate: () => false,
  // Active in hand + deleted (Potions route to deletedPile on resolve)
  // so the afterDamage / cleanup hooks fire while the card sits in
  // either zone.
  activeIn: ['hand', 'deleted'],

  // ── Helden, gezielte Quellen (vor der Schadensberechnung) ─────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedTargets, sourceCard, opts) {
    // "when a target you control takes ANY DAMAGE" — never chain to
    // non-damage targeting (Disruption Ray, …). See Spectral Armor.
    if (opts && opts.dealsDamage === false) return false;
    const offen = _collectOwnedHeroTargets(gs, pi, targetedTargets, engine)
      .filter(t => !_alreadyPrompted(gs, _dedupKey(gs, t.owner, t.heroIdx, sourceCard)));
    if (offen.length === 0) return false;
    // Side effect — covers the decline path: once offered (accept or
    // decline), the early window stays quiet for exactly these Heroes
    // and THIS source.
    for (const t of offen) _markPrompted(gs, _dedupKey(gs, t.owner, t.heroIdx, sourceCard));
    return true;
  },

  async postTargetResolve(engine, pi, targetedTargets /*, sourceCard, opts */) {
    const candidates = _collectOwnedHeroTargets(engine.gs, pi, targetedTargets, engine);
    if (candidates.length === 0) return { effectNegated: false };

    let picked;
    if (candidates.length === 1) {
      picked = candidates[0];
    } else {
      const result = await engine.promptEffectTarget(pi, candidates.map(c => ({
        id: c.id, type: 'hero',
        owner: c.owner, heroIdx: c.heroIdx, cardName: c.cardName,
      })), {
        title: CARD_NAME,
        description: 'Choose one of your Heroes to halve the incoming damage and gain Cloudy.',
        confirmLabel: '☁️ Protect!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      picked = (result && result.length > 0)
        ? (candidates.find(c => c.id === result[0]) || candidates[0])
        : candidates[0];
    }

    const hero = engine.gs.players[picked.owner]?.heroes?.[picked.heroIdx];
    await _cloudyHero(engine, pi, hero, picked.owner, picked.heroIdx);
    engine.log('cloud_bottle_prompt_accepted', {
      player: engine.gs.players[pi]?.username, target: picked.cardName,
    });
    engine.sync();
    return { effectNegated: false };
  },

  // ── Helden, uebrige Schadenswege: fruehes Hand-Fenster ────────────
  isPreDamageReaction: true,
  preDamageEarly: true,

  preDamageCondition(gs, pi, engine, target, heroIdx, source, amount, _type, flags) {
    if (!(amount > 0)) return false;
    if (flags && flags.cannotBeReduced) return false;
    if (!target || target.hp === undefined || !(target.hp > 0)) return false;
    // Kontrolle statt Seite (Styx 28.9.): `pi` ist bereits der Kontrolleur des Helden.
    if (engine && engine.heroSideOf) {
      const phys = engine._findHeroOwner(target);
      if (phys >= 0 && engine.heroSideOf(phys, target) !== pi) return false;
    }
    // Stapel-Sperre: schon Cloudy, der Treffer ist bereits halbiert.
    if (target.buffs?.cloudy) return false;
    const phys = engine?._findHeroOwner ? engine._findHeroOwner(target) : pi;
    const key = _dedupKey(gs, phys >= 0 ? phys : pi, heroIdx, source);
    if (_alreadyPrompted(gs, key)) return false;
    _markPrompted(gs, key);
    return true;
  },

  async preDamageResolve(engine, pi, target, heroIdx, source, amount /*, type */) {
    const phys = engine._findHeroOwner(target);
    const owner = phys >= 0 ? phys : pi;
    engine.log('cloud_bottle', { player: engine.gs.players[pi]?.username, hero: target.name, originalDamage: amount, effectiveDamage: Math.ceil(amount / 2) });
    const ok = await _cloudyHero(engine, pi, target, owner, heroIdx);
    // Wurde der Buff verhindert (z. B. Anti-Magic-Schild), halbiert die Engine diesen Treffer trotzdem direkt.
    return ok ? {} : { multiplier: 0.5 };
  },

  // ── Kreaturen (Welle 13, Q134; Welle 14, Q10): ebenfalls das fruehe Fenster ──
  isCreaturePreDamageReaction: true,

  creaturePreDamageCondition(gs, pi, engine, inst, source, amount, type) {
    if (!(amount > 0)) return false;
    if (type === 'destroy') return false;   // Zerstoeren/Opfer sind kein Schaden
    if (!inst || (inst.controller ?? inst.owner) !== pi) return false;
    if (inst.zone !== 'support') return false;
    if ((inst.counters?.currentHp ?? 0) <= 0) return false;
    if (inst.counters?.buffs?.cloudy) return false;   // Stapel-Sperre
    const key = _dedupKey(gs, 'c' + inst.id, 0, source);
    if (_alreadyPrompted(gs, key)) return false;
    _markPrompted(gs, key);
    return true;
  },

  async creaturePreDamageResolve(engine, pi, inst, source, amount /*, type */) {
    engine.log('cloud_bottle', { player: engine.gs.players[pi]?.username, creature: inst.name, originalDamage: amount, effectiveDamage: Math.ceil(amount / 2) });
    const ok = await _cloudyCreature(engine, pi, inst);
    return ok ? {} : { multiplier: 0.5 };
  },

  hooks: {
    /**
     * Kein Cloudy fuer einen Gefallenen (Welle 14, Q10): reicht auch der halbierte Treffer zum Tod, raeumt der Held den frisch aufgelegten Buff dieser
     * Karte ab. (Kreaturen nehmen ihre Buffs mit ins Grab.) Cloud Pillows Cloudy hat eine andere Quelle und bleibt unberuehrt.
     */
    afterDamage: (ctx) => {
      const target = ctx.target;
      if (!target || target.hp === undefined || target.hp > 0) return;
      const b = target.buffs?.cloudy;
      if (!b || b.source !== CARD_NAME) return;
      delete target.buffs.cloudy;
      ctx._engine.log('cloud_bottle_still_lethal', { target: ctx._engine._heroLabel(target) });
    },

    /** Merker (ein Angebot je Ziel und Quelle) leben nur fuer eine Aufloesung (Spectral Armor, v1378). */
    onChainResolve: (ctx) => { _clear(ctx._engine.gs); },
    onAnyActionResolved: (ctx) => { _clear(ctx._engine.gs); },
    afterSpellResolved: (ctx) => { _clear(ctx._engine.gs); },
    onTurnStart: (ctx) => { _clear(ctx._engine.gs); },
  },
};

// ─── Cloudy auflegen ───────────────────────────────────────────────

/** Cloudy bis Zugende (laeuft zu Beginn des naechsten Spielers aus). true = der Buff liegt. */
async function _cloudyHero(engine, pi, hero, owner, heroIdx) {
  if (!hero?.name || !(hero.hp > 0)) return false;
  const gs = engine.gs;
  await engine.actionAddBuff(hero, owner, heroIdx, 'cloudy', {
    sourceOwner: pi,   // v1067: Quelle ist Pflicht (siehe _affected-shared)
    expiresAtTurn: gs.turn + 1,
    expiresForPlayer: engine.opponentOf(gs.activePlayer),
    source: CARD_NAME,
    addAnim: 'cloud_gather',
    removeAnim: 'cloud_disperse',
  });
  await engine._delay(450);
  return !!hero.buffs?.cloudy;
}

async function _cloudyCreature(engine, pi, inst) {
  const gs = engine.gs;
  await engine.actionAddCreatureBuff(inst, 'cloudy', {
    sourceOwner: pi,
    expiresAtTurn: gs.turn + 1,
    expiresForPlayer: engine.opponentOf(gs.activePlayer),
    source: CARD_NAME,
    addAnim: 'cloud_gather',
    removeAnim: 'cloud_disperse',
  });
  await engine._delay(450);
  return !!inst.counters?.buffs?.cloudy;
}

// ─── Ein Angebot je Ziel und Quelle (wie Spectral Armor, v1378) ────

function _dedupKey(gs, pi, heroIdx, source) {
  const s = source || {};
  const quelle = `${s.controller ?? s.owner ?? '?'}:${s.name || s.cardName || '?'}`;
  return `${gs.turn || 0}|${pi}|${heroIdx}|${quelle}`;
}
function _alreadyPrompted(gs, key) {
  return !!gs._cibPromptedFor?.[key];
}
function _markPrompted(gs, key) {
  if (!gs._cibPromptedFor) gs._cibPromptedFor = {};
  gs._cibPromptedFor[key] = true;
}
function _clear(gs) {
  if (gs._cibPromptedFor) delete gs._cibPromptedFor;
}

/**
 * Filter the source's target list to alive Heroes controlled by `pi`
 * that don't already have the Cloudy buff. Kreaturen laufen ueber das
 * fruehe Hand-Fenster der Engine (`creaturePreDamageResolve`).
 */
function _collectOwnedHeroTargets(gs, pi, targetedTargets, engine) {
  const out = [];
  if (!Array.isArray(targetedTargets)) return out;
  for (const t of targetedTargets) {
    if (!t || t.type !== 'hero') continue;
    const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
    // Kontrolle statt Seite (Styx 28.9.) — „a target you control"
    const seite = engine ? engine.heroSideOf(t.owner, hero) : t.owner;
    if (seite !== pi) continue;
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.buffs?.cloudy) continue;
    out.push({
      id: `hero-${t.owner}-${t.heroIdx}`,
      owner: t.owner, heroIdx: t.heroIdx,
      cardName: hero.name,
    });
  }
  return out;
}
