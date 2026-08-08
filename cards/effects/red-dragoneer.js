// ═══════════════════════════════════════════
//  CARD EFFECT: "Red Dragoneer"
//  Creature (Summoning + Destruction Magic Lv1,
//  Normal) — 50 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "When you summon this Creature, you may openly
//    add a \"Drago\" Creature from your deck to your
//    hand. You may once per turn deal damage equal
//    to 50 times the number of other \"Drago\"
//    Creatures you control to any target on the
//    board."
//
//  ── Was ist eine "Drago"-Kreatur? ──
//  Definiert in `_drago-shared.js` — geprueft wird
//  der EIGENNAME (alles vor dem ersten Komma), damit
//  "Dragsparov, the King of Dragons" nicht ueber
//  seinen Beinamen hineinrutscht. Dort steht auch der
//  aktuelle Bestand.
//
//  ── "other" ist woertlich ──
//  Red Dragoneer traegt selbst "Drago" im Namen und
//  zaehlt sich deshalb NICHT mit. Eine zweite Kopie
//  auf dem Feld zaehlt sehr wohl.
//
//  ── Beschwoerungseffekt ──
//  "You may" -> abbrechbare Galerie ueber die
//  passenden Karten im Deck; "openly" -> die
//  Engine-Suche zeigt dem Gegner die gefundene
//  Karte (revealSearchedCards) und mischt danach.
//  Beides erledigt `searchDeckForNamedCard`.
//
//  Zum Selbst-Filter (`ctx.playedCard?.id !==
//  ctx.card?.id`): die Engine setzt am Summon-Pfad
//  bereits `_onlyCard` (_engine.js ~Z. 8540), der Hook
//  erreicht also nur diese Karte. Der Riegel ist
//  Absicherung und macht die Absicht sichtbar —
//  kanonisches Muster, siehe acid-rain.js /
//  berserk.js.
//
//  MERKE fuer andere Karten: wer FREMDE Beschwoerungen
//  mitbekommen will, braucht `onCardEnterZone`
//  (~Z. 8553, ohne `_onlyCard`, neue Karte in
//  `ctx.enteringCard`) — onPlay reicht dafuer NICHT.
//
//  ── Aktiv-Effekt ──
//  Frei, Main Phase, einmal je Zug (Standard von
//  `creatureEffect`). Ohne andere "Drago"-Kreatur
//  waere der Schaden 0 — dann ist die Aktivierung
//  gesperrt, statt die Rundennutzung wirkungslos zu
//  verbrennen.
// ═══════════════════════════════════════════

const {
  DRAGO,
  isDragoCreatureName,
  countOtherDragoCreatures,
} = require('./_drago-shared');

const CARD_NAME = 'Red Dragoneer';
const DAMAGE_PER_DRAGO = 50;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  // Ohne Mitstreiter waere der Schaden 0 — nicht anbieten.
  canActivateCreatureEffect(ctx) {
    return countOtherDragoCreatures(ctx._engine, ctx.cardOwner, ctx.card?.id) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const allies = countOtherDragoCreatures(engine, pi, inst?.id);
    const damage = DAMAGE_PER_DRAGO * allies;
    if (damage <= 0) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage — ${DAMAGE_PER_DRAGO} × ${allies} other "${DRAGO}" Creature${allies !== 1 ? 's' : ''} you control.`,
      confirmLabel: `🐉 Breath! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    // Abbruch: `false` laesst die Einmal-pro-Zug-Sperre ungestempelt.
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'fireball',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(520);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('red_dragoneer_breath', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      damage, allies,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /** Beschwoerungseffekt: eine "Drago"-Kreatur aus dem Deck holen. */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card?.id) return;     // nur beim eigenen Summon
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      if (ps.handLocked) return;                           // wie jeder andere Suchpfad

      // Galerie der passenden Deckkarten, Kopien zusammengefasst.
      const counts = {};
      for (const name of (ps.mainDeck || [])) {
        if (!isDragoCreatureName(engine, name)) continue;
        counts[name] = (counts[name] || 0) + 1;
      }
      const gallery = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));
      if (gallery.length === 0) return;

      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: `Add one "${DRAGO}" Creature from your deck to your hand. It is revealed to your opponent.`,
        cancellable: true,          // "you may"
        gerrymanderEligible: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) return;
      if (!isDragoCreatureName(engine, pick.cardName)) return;

      // Nimmt die Karte aus dem Deck, legt sie auf die Hand, zeigt sie
      // dem Gegner und mischt anschliessend.
      await engine.searchDeckForNamedCard(pi, pick.cardName, CARD_NAME);
    },
  },
};
