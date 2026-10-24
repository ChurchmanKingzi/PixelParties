'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Ghostly Warning"
//  Spell (Reaction) — Magic Arts Lv2
//
//  „Play this card immediately when an opponent's Hero uses a Spell. Negate that Spell and delete it. At the end of your next turn, if that Hero
//   is not defeated and that Spell is still deleted, that Hero immediately performs that Spell as an additional Action, regardless of its level
//   and in spite of any negative status effects."
//
//  ── Auslegung ─────────────────────────────────────────────────────
//  • Ghostly Warning VERZOEGERT einen Zauber: Negation + Loeschen jetzt, das Wirken am Ende MEINES naechsten Zuges (`_verzoegert-zauber-shared.js`,
//    gemeinsamer Baustein mit Atta). „Next turn": der Zug, in dem die Karte gespielt wird, zaehlt nicht — kam sie im Zug des Gegners, ist es mein
//    naechster Zug; spiele ich sie in meinem eigenen Zug (Reaktion auf einen Zauber, den der Gegner in meinem Zug wirkt), der uebernaechste.
//  • Die Bedingungen werden erst AM ZUGENDE geprueft: der Held (derselbe, im selben Slot) lebt, und der Zauber LIEGT DANN im Geloescht-Stapel —
//    gleich, ob er dazwischen den Stapel verlassen hat und wieder dort liegt (Name zaehlt, Kopien sind austauschbar).
//  • Das Wirken ist PFLICHT (nicht abbrechbar, auch alle Zielwahlen nicht), ohne Stufen-, Status- und Phasenpruefung und ohne Wisdom-Abwuerfe. Der Held des
//    GEGNERS fuehrt den Zauber aus (er entscheidet Ziele); die Aktion ist eine Zusatzaktion.
//  • Die Hauptaktion des Zaubers ist verbraucht (wie bei jeder Negation); eine Ersatzaktion gibt es nicht.
//  • „an opponent's Hero uses a Spell": ein Zauber, den eine KREATUR wirkt (`casterCheck: false`), oder ein Effekt, der nur als Spell zaehlt (Alice),
//    ist nichts Loeschbares — keine Reaktion (wie bei Shamanic Curse).
// ═══════════════════════════════════════════

const { vormerken } = require('./_verzoegert-zauber-shared');

const CARD_NAME = 'Ghostly Warning';

module.exports = {
  // Entkoppelte Zauberbilder: wird die Karte NEGIERT, laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: { impact: { type: 'ghostly_warning' }, impactMs: 600 },

  isReaction: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    const chain = chainCtx?.chain || [];
    const last = chain[chain.length - 1];
    if (!last || last.negated || last.chainClosed) return false;
    if (last.cardType !== 'Spell') return false;
    if (!engine.opponentsOf(pi).includes(last.owner)) return false;
    if (last.zaehltAlsArt) return false;
    if (last.casterCheck === false) return false;
    const hi = last.isInitialCard ? last.heroIdx : (last.casterHeroIdx ?? last.heroIdx);
    return hi != null && hi >= 0;
  },

  resolve: async (engine, pi, _selectedIds, _validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const targetIndex = myIndex - 1;
    const link = chain[targetIndex];
    if (!link || link.negated || link.cardType !== 'Spell') return;

    const heroSeite = link.casterOwner ?? link.owner;
    const heroIdx = link.isInitialCard ? link.heroIdx : (link.casterHeroIdx ?? link.heroIdx);
    const heroSnapshot = gs.players[heroSeite]?.heroes?.[heroIdx];
    if (!heroSnapshot?.name) return;
    // Besitzer des Geloescht-Stapels = urspruenglicher Besitzer der Karte (eine gestohlene Karte wird in SEINEN Stapel gelegt) — jetzt, solange sie noch in der Hand liegt.
    let pileOwnerPi = link.owner;
    try {
      const besitzerPs = engine.handKartenBesitzerPs(gs.players[link.owner], link.cardName);
      const idx = gs.players.indexOf(besitzerPs);
      if (idx >= 0) pileOwnerPi = idx;
    } catch { /* Standard: der Wirkende */ }

    engine._broadcastEvent('play_zone_animation', {
      type: 'ghostly_warning', owner: heroSeite, heroIdx, zoneSlot: -1,
    });
    await engine._delay(600);

    // „Negate that Spell and delete it."
    engine.negateChainLink(chain, targetIndex, { deleteCard: true });
    // „At the end of your next turn …"
    vormerken(engine, {
      kind: 'ghostly', quelle: CARD_NAME, zugspieler: pi,
      spellName: link.cardName, pileOwnerPi, castPi: link.owner, wirkerSeite: heroSeite, heroIdx,
    });
    engine.log('ghostly_warning_negate', { player: gs.players[pi]?.username, spell: link.cardName, hero: heroSnapshot.name });
    engine.sync();
  },
};
