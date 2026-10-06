const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: "Petrification Break"
//  Spell (Attachment, Support Magic, Lv 0)
//
//  „This Spell can only be used by a Stunned Hero. Heal the user from
//   its Stun and attach this card to it. While this card is attached to
//   a Hero, it cannot be affected by negative status effects and any
//   damage it would take is halved (rounded up)."
//
//  ── BAUFORM ───────────────────────────────────────────────────────
//  • „only be used by a Stunned Hero": Muster Outbreak. `canPlayWithHero`
//    (Heldenwahl, Server-Gate fuer die Hand) und `canPlayDespiteStatuses`
//    (der Engine-Freibrief: ein betaeubter Held darf sonst keinen Spell
//    wirken) pruefen beide „Held ist betaeubt und lebt"; `spellPlayCondition`
//    haelt die Karte grau, solange kein eigener Held betaeubt ist UND
//    einen freien Support-Platz hat (die Karte bleibt dort liegen).
//  • „Heal the user from its Stun and attach this card to it": der NUTZER
//    ist der Wirt (`attachToHero` mit festem Held, kein Prompt). Reihenfolge:
//    ZUERST anlegen (abbrechbar), DANN die Betaeubung heilen — ein Abbruch
//    laesst alles unberuehrt.
//  • „cannot be affected by negative status effects": Skript-Flag
//    `immuneToNegativeStatuses` (Engine: `heroHasStatusImmunityAttachment`,
//    an beiden Status-Wegen `addHeroStatus` / `actionAddStatus`). Es
//    verhindert NEUE negative Status; bereits liegende (Gift, Brand …)
//    werden nicht entfernt — die Karte heilt nur die Betaeubung.
//  • „any damage it would take is halved (rounded up)": `beforeDamage` des
//    Anhaengsels, `Math.ceil(Betrag / 2)`, jeder Schadenstyp.
// ═══════════════════════════════════════════

const { placeAttachment, attachmentHostsFor, freeSlots } = require('./_attachment-shared');

const CARD_NAME = 'Petrification Break';

function istBetaeubt(hero) {
  return !!hero?.name && hero.hp > 0 && !!hero.statuses?.stunned;
}

/** Eigene Helden, die diese Karte nutzen koennten (betaeubt + freier Platz). */
function nutzer(gs, pi, engine) {
  const out = [];
  for (const h of attachmentHostsFor(gs, pi, engine, { sides: [pi] })) {
    if (istBetaeubt(gs.players[h.owner]?.heroes?.[h.heroIdx]) && !out.includes(h.heroIdx)) out.push(h.heroIdx);
  }
  return out;
}

module.exports = {
  requiresTarget: true,
  activeIn: ['hand', 'support'],

  // „immune to negative status effects" — gelesen von der Engine.
  immuneToNegativeStatuses: true,

  spellVisual: {
    impact: { type: 'gold_sparkle' }, impactMs: 260,
  },

  /** Held-Gate (Heldenwahl + Hand-Ausgrauen): nur ein betaeubter Held mit freiem Platz. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!istBetaeubt(hero)) return false;
    return attachmentHostsFor(gs, pi, engine, { sides: [pi] }).some(h => h.heroIdx === heroIdx);
  },

  /** Der Freibrief: ein betaeubter Held darf DIESEN Spell wirken. */
  canPlayDespiteStatuses(gs, pi, heroIdx /* , cardData, engine */) {
    return istBetaeubt(gs.players[pi]?.heroes?.[heroIdx]);
  },

  spellPlayCondition(gs, pi, engine) {
    return nutzer(gs, pi, engine).length > 0;
  },
  // Empfaenger = NUR die Zonen eines BETAEUBTEN Helden: er ist der Nutzer.
  // Der Client trennt bei Anlege-Karten Empfaenger und Wirker; ohne diese
  // Einschraenkung liess sich die Karte auf einen gesunden Helden ziehen
  // und wirkte trotzdem ueber den betaeubten.
  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, { sides: [pi] })
      .filter(h => istBetaeubt(gs.players[h.owner]?.heroes?.[h.heroIdx]));
  },

  cpuShouldPlay(engine, pi) {
    return nutzer(engine.gs, pi, engine).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const seite = ctx.cardHeroOwner ?? pi;
      const heroIdx = ctx.cardHeroIdx;
      const user = ctx.attachedHero || gs.players[seite]?.heroes?.[heroIdx];
      if (!istBetaeubt(user)) { gs._spellCancelled = true; return; }
      // Wurde auf einen ANDEREN Helden gezogen als den Nutzer, ist das kein
      // gueltiger Empfaenger („only the Stunned Hero itself").
      const hinweis = gs._attachmentHeroIdx;
      const hinweisSeite = (isSeat(gs, gs._attachmentOwner)) ? gs._attachmentOwner : pi;
      if (hinweis != null && hinweis >= 0 && (hinweis !== heroIdx || hinweisSeite !== seite)) {
        gs._spellCancelled = true;
        return;
      }

      // ① Anlegen — der NUTZER ist der Wirt, es gibt nichts zu waehlen: der
      // gezogene Zonen-Hinweis des Servers gilt, sonst der linkeste freie
      // Platz (auch im Sofort-Guss, wo ein Prompt ins Leere liefe).
      const frei = freeSlots(gs.players[seite], heroIdx);
      if (frei.length === 0) { gs._spellCancelled = true; return; }
      const wunsch = gs._attachmentZoneSlot;
      const slotIdx = frei.includes(wunsch) ? wunsch : frei[0];
      const host = { owner: seite, heroIdx, slotIdx };
      const inst0 = await placeAttachment(ctx, CARD_NAME, host, { skipMagicImmune: true, skipEnterHook: true });
      if (!inst0) { gs._spellCancelled = true; return; }
      const res = { host, inst: inst0 };
      const inst = res.inst;

      // ② Betaeubung heilen.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: res.host.owner, heroIdx: res.host.heroIdx, zoneSlot: -1,
      });
      await engine._delay(350);
      engine.cleanseHeroStatuses(user, res.host.owner, res.host.heroIdx, ['stunned'], CARD_NAME);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: res.host.heroIdx,
        _skipReactionCheck: true,
      });
      engine.log('petrification_break', { player: ps.username, hero: user.name });
      engine.sync();
    },

    /** Der Wirt nimmt nur den halben Schaden (aufgerundet). */
    beforeDamage: (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const host = ctx.attachedHero;
      if (!host || ctx.target !== host) return;
      if (!(ctx.amount > 0)) return;
      ctx.setAmount(Math.ceil(ctx.amount / 2));
    },
  },
};
