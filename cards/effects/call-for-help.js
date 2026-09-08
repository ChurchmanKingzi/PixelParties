// ═══════════════════════════════════════════
//  CARD EFFECT: "Call for Help"
//  Spell (Support Magic Lv0, Normal)
//
//  „You can only play this card if a Creature you control was defeated
//   since the start of your turn. Choose a level 2 or lower Spell from
//   your deck or hand and play it immediately as an additional Action,
//   regardless of its level. You can only play any given Spell once per
//   turn with this effect."   (neuer Text, Al 29.8. — cards.json v645)
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Spielbedingung `spellPlayCondition`: der Engine-Stempel
//    `ps._lastCreatureDefeatedTurn === gs.turn` (v645, gesetzt an der
//    einen Kreaturentod-Stelle in runHooks) — „seit Beginn deines Zuges"
//    = in diesem Spielerzug (gs.turn zaehlt Spielerzuege).
//  · Auswahl: Galerie ueber alle Normal-Spells mit Level <= 2 aus Hand
//    UND Deck — je (Name, Quelle) ein Eintrag (Barker-Muster); ohne
//    Call for Help selbst und ohne Namen, die dieser Effekt in diesem
//    Zug schon gespielt hat (`hoptUsed['call-for-help:<pi>:<name>']`).
//  · Aus dem Deck wird DIREKT gegossen (v646, Al) — kein Umweg ueber die
//    Hand; die Karte verlaesst das Deck beim Guss und landet danach im
//    Discard (`_castSpellImmediately`, fromZone 'deck').
//  · „regardless of its level": der Sofort-Guss `_castSpellImmediately`
//    prueft keine Level-/Schulanforderung — die Wahl in der Galerie IST
//    die Freigabe; kein Override noetig.
//  · „play it immediately as an additional Action": der kanonische
//    Sofort-Guss `engine._castSpellImmediately` (v646, aus der
//    Zusatzaktion herausgezogen) — kein Aktionsverbrauch, Caster ist
//    der Held, der Call for Help gespielt hat. Sperren, die auch die
//    normale Aktion traefen (Friendship-Support-Lock, Aktionsblock,
//    spellPlayCondition des Spells), gelten weiter.
// ═══════════════════════════════════════════

const { hasCardType, hasSpellSchool } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Call for Help';
const MAX_LEVEL = 2;

function usedKey(pi, name) { return `call-for-help:${pi}:${name}`; }

module.exports = {
  spellPlayCondition(gs, pi) {
    return gs.players[pi]?._lastCreatureDefeatedTurn === gs.turn;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      const db = engine._getCardDB();

      const eligible = (name) => {
        const cd = db[name];
        if (!cd || !hasCardType(cd, 'Spell') || name === CARD_NAME) return false;
        if ((cd.subtype || 'Normal').toLowerCase() !== 'normal') return false;
        if ((cd.level || 0) > MAX_LEVEL) return false;
        return gs.hoptUsed?.[usedKey(pi, name)] !== gs.turn;
      };
      const cards = [];
      for (const n of (ps.hand || [])) if (eligible(n) && !cards.some(c => c.name === n && c.source === 'hand')) cards.push({ name: n, source: 'hand' });
      for (const n of (ps.mainDeck || [])) if (eligible(n) && !cards.some(c => c.name === n && c.source === 'deck')) cards.push({ name: n, source: 'deck' });
      if (cards.length === 0) { engine.log('call_for_help_none', { player: ps.username }); return; }
      cards.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery', cards, title: CARD_NAME,
        description: `Choose a level ${MAX_LEVEL} or lower Spell from your hand or deck and play it immediately as an additional Action, regardless of its level.`,
        confirmLabel: '📣 Call it!', confirmClass: 'btn-success', cancellable: false,
      });
      if (!picked || !picked.cardName) return;
      const name = picked.cardName;
      const source = picked.source === 'deck' ? 'deck' : (picked.source === 'hand' ? 'hand' : (ps.hand.includes(name) ? 'hand' : 'deck'));
      const pool = source === 'deck' ? ps.mainDeck : ps.hand;
      const poolIndex = pool.indexOf(name);
      if (poolIndex < 0) return;
      // Der Zusatz-Guss braucht einen handlungsfaehigen Helden und darf
      // keine Sperre umgehen, die auch die normale Aktion traefe (Friendship-
      // Support-Lock, Aktionsblock). Level/Schule sind per Text egal.
      const cd = db[name];
      if (!engine.canHeroPerformAction(pi, heroIdx) || engine.areActionsBlocked(pi)) return;
      // v800: beide Schulen pruefen (`hasSpellSchool`), nicht nur
      // `spellSchool1` — Support Magic steht bei Doppelschul-Karten
      // (Energy Drain, Holy Selection, Sacrifice to Divinity) alphabetisch
      // an ZWEITER Stelle und lief an der Friendship-Sperre vorbei.
      if (ps.supportSpellLocked && hasSpellSchool(cd, 'Support Magic')) return;
      const spellScript = loadCardEffect(name);
      if (spellScript?.spellPlayCondition && !spellScript.spellPlayCondition(gs, pi, engine)) return;

      // v646 (Al): direkt aus Hand ODER Deck giessen, „als waere sie Teil
      // der Hand" — kein Umweg ueber die Hand. Der Guss laeuft ueber den
      // kanonischen Sofort-Guss `_castSpellImmediately` (Wisdom,
      // Aufloesungstiefe, afterSpellResolved, Discard-Routing); Level und
      // Schule prueft er nicht — „regardless of its level".
      const result = await engine._castSpellImmediately(pi, heroIdx, name, {
        fromZone: source, pool, poolIndex, by: CARD_NAME,
      });
      if (!result.cancelled) {
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[usedKey(pi, name)] = gs.turn;
        await engine.runHooks('onAnyActionResolved', {
          actionType: 'spell', playerIdx: pi, cardName: name, playedCardName: name, heroIdx,
          isAdditional: true, isInherent: false, isFree: false, _skipReactionCheck: true,
        });
      }
      engine.log('call_for_help', { player: ps.username, spell: name, from: source, played: !result.cancelled });
      engine.sync();
    },
  },
};
