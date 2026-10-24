'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Motharch Squire"
//  Creature (Normal, Lv0, 10 HP, Summoning Magic, Archetyp „Motharch")
//
//  „When you play this Creature, choose up to 2 Artifacts with different names from your discard pile and shuffle them back into your deck. When this Creature is defeated,
//   you may search your deck for an Artifact, reveal it and add it to your hand. You can only activate this effect of "Motharch Squire" once per turn."
//
//  ── NEUE WERTE ──────────────────────────────────────────────────────────
//  Jetzt 10 HP (vorher 50); der Text ist unverändert (Datenänderung in `data/cards.json`).
//
//  ── ① EINSATZ („When you play this Creature") ───────────────────────────
//  `hooks.onPlay` (On-Summon-Vertrag: feuert bei JEDER Herkunft — Hand, Wiederbelebung, Effekt; Vorlage: Black Marketeer). Der Kontrolleur wählt BIS ZU 2 Artifacts mit
//  VERSCHIEDENEN Namen (Basisnamen, [B]/[W] zählen als derselbe Name) aus der eigenen Ablage; sie werden ins Deck zurückgemischt (`actionRecycleCards`, `shuffle: true`).
//  Die Wahl ist freiwillig im Sinn von „up to": Abbruch = keine Karte (die Beschwörung gilt trotzdem). Die Galerie zeigt jeden Artifact-Namen EINMAL (Basisname). Ist die Ablage
//  ohne Artifact, ist das Zurückmischen aus der Ablage gesperrt (Distracting Crystal, Hatusbal — `shufflesFromHandOrDiscardIntoDeck`) oder der Ablage-Ausgang gesperrt (Staff of the
//  Teleporter …), wirkt der Einsatz nicht und die Beschwörungsblase bleibt stumm (`summonEffektFizzelt`).
//
//  ── ② BESIEGT („When this Creature is defeated") ────────────────────────
//  `hooks.onCreatureDeath` (die Engine ruft ihn NACH dem Entfernen aus der Zone, VOR dem Wechsel in die Ablage; Selbsterkennung über `death.instId === ctx.card.id`).
//  Gilt für JEDES Besiegtwerden (Schaden, Opfer, Zerstörung). „you may search your deck for an Artifact": Galerie ALLER Artifacts im eigenen Deck, Abbruch erlaubt; nach der
//  Suche (Wahl ODER Abbruch) wird das Deck gemischt. Die Karte geht aufgedeckt (`reveal: true`) auf die Hand. Hand-Suche nach Bauform ② (`_search-shared.js`): unter einer
//  Such-Sperre oder bei gesperrter Hand wird sie nicht angeboten; auch ohne Artifact im Deck nicht.
//  „You can only activate this effect of "Motharch Squire" once per turn": EINMAL PRO ZUG UND SPIELER über ALLE Squires zusammen (`engine.claimHOPT('motharch-squire', pi)`,
//  Schlüssel wie Exploding Skull). Verbraucht wird die Sperre erst, wenn die Suche tatsächlich stattfindet (Karte gewählt); ein Abbruch der Galerie lässt sie frei („may").
//  Sterben zwei Squires im selben Moment, fragt nur der erste; wählt er nichts, darf der zweite fragen.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `moth_dust` (Pixelart, ANIM_REGISTRY): beim Einsatz stäubt goldener Mottenstaub über der Kreatur; die Karten fliegen mit den Standard-Flügen
//  (Ablage → Deck, Deck → Hand). Klänge in ZONE_ANIM_SFX; Logs `motharch_squire_recycle` / `motharch_squire_search`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Einsatz: die zwei Artifacts mit den höchsten Kosten. Besiegt: das Artifact mit den höchsten Kosten (ersatzweise das erste).
// ═══════════════════════════════════════════

const { hasCardType, baseCardName } = require('./_hooks');
const { skipIfSearchBlocked } = require('./_search-shared');
const { shuffleIntoDeckBlocked } = require('./_crystals-shared');

const CARD_NAME = 'Motharch Squire';
const MAX_PICKS = 2;
const HOPT_KEY = 'motharch-squire';
const STAUB_MS = 800;       // Länge von `moth_dust` im Client

/** Artifacts der Ablage — jeder Basisname EINMAL („different names"). */
function ablageArtifacts(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const n of (ps?.discardPile || [])) {
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    const b = baseCardName(n);
    if (gesehen.has(b)) continue;
    gesehen.add(b);
    out.push({ name: n, source: 'discard' });
  }
  return out;
}

/** Artifacts im Deck, nach Name gruppiert. */
function deckArtifacts(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const zaehler = {};
  for (const n of (ps?.mainDeck || [])) {
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    zaehler[n] = (zaehler[n] || 0) + 1;
  }
  return Object.entries(zaehler).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'deck', count }));
}

module.exports = {
  // Mischt aus der Ablage ins eigene Deck zurück (Distracting Crystal / Hatusbal / „No Retreat!" lesen die Marke).
  shufflesFromHandOrDiscardIntoDeck: true,
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: { impact: { type: 'moth_dust' }, impactMs: STAUB_MS },

  activeIn: ['support'],

  cpuMeta: { onDeathBenefit: 10 },

  hooks: {
    /** „When you play this Creature, choose up to 2 Artifacts with different names from your discard pile and shuffle them back into your deck." */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      const galerie = ablageArtifacts(engine, pi);
      if (galerie.length === 0
          || shuffleIntoDeckBlocked(engine, pi)
          || engine.shuffleBackIntoOwnDeckBlocked?.(pi, { fromHandOrDiscard: true })) {
        return engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });
      }

      const wahl = await ctx.promptCardGalleryMulti(galerie, {
        title: CARD_NAME,
        description: `Choose up to ${MAX_PICKS} Artifacts with different names from your discard pile to shuffle back into your deck.`,
        selectCount: Math.min(MAX_PICKS, galerie.length),
        minSelect: 1,
        confirmLabel: '🔄 Shuffle Back!',
        confirmClass: 'btn-success',
        cancellable: true,
        menuSource: CARD_NAME,
      });
      // „different names" (Basisnamen) und höchstens 2 — auch wenn ein veränderter Client mehr oder Doppelte schickt.
      const gesehen = new Set();
      const namen = (wahl?.selectedCards || []).filter(n => {
        const b = baseCardName(n);
        if (gesehen.has(b) || gesehen.size >= MAX_PICKS) return false;
        if (!galerie.some(g => baseCardName(g.name) === b)) return false;
        gesehen.add(b);
        return true;
      });
      if (namen.length === 0) return engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });

      engine._broadcastEvent('play_zone_animation', {
        type: 'moth_dust', owner: ctx.cardHeroOwner ?? pi, heroIdx: ctx.cardHeroIdx, zoneSlot: ctx.card.zoneSlot, duration: STAUB_MS,
      });
      const recycelt = await engine.actionRecycleCards(pi, namen, { source: CARD_NAME, shuffle: true });
      if (!(recycelt || []).length) return engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });
      engine.log('motharch_squire_recycle', { player: ps.username, cards: recycelt, count: recycelt.length });
      engine.sync();
    },

    /** „When this Creature is defeated, you may search your deck for an Artifact, reveal it and add it to your hand." — einmal pro Zug. */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;      // nur ICH selbst

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;                                // Kontrolleur: „your deck"
      const ps = gs.players[pi];
      if (!ps) return;
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return;          // schon aktiviert (ein anderer Squire, diesen Zug)
      if (ps.handLocked) { engine.log('motharch_squire_skipped', { reason: 'hand_locked' }); return; }
      if (skipIfSearchBlocked(engine, pi, CARD_NAME)) return;
      const galerie = deckArtifacts(engine, pi);
      if (galerie.length === 0) { engine.log('motharch_squire_skipped', { reason: 'no_artifact' }); return; }

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        searchToHand: true,      // Hand-Suche (Such-Template): unter einer Such-Sperre öffnet `promptGeneric` die Galerie gar nicht erst
        searchPile: 'deck',
        cards: galerie,
        title: CARD_NAME,
        description: 'Search your deck for an Artifact and add it to your hand (once per turn).',
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName || !galerie.some(g => g.name === wahl.cardName)) {
        // Ein Abbruch ist keine Aktivierung: die Sperre bleibt frei, das Deck wird (wie bei jeder Suche) gemischt.
        engine.shuffleDeck(pi, 'main');
        engine.sync();
        return;
      }
      if (ps.mainDeck.indexOf(wahl.cardName) < 0) { engine.shuffleDeck(pi, 'main'); engine.sync(); return; }
      if (!engine.claimHOPT(HOPT_KEY, pi)) return;             // zwischen Anzeige und Wahl von einem anderen Squire verbraucht

      await engine.actionAddCardFromDeckToHand(pi, wahl.cardName, { source: CARD_NAME, reveal: true, shuffle: true });
      engine.log('motharch_squire_search', { player: ps.username, card: wahl.cardName });
      engine.sync();
    },
  },

  /** CPU: Einsatz — die zwei teuersten Artifacts; Tod — das teuerste Artifact. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME) return undefined;
    const db = engine._getCardDB();
    const kosten = (n) => Number(db[n]?.cost) || 0;
    const karten = (payload.cards || []).filter(c => c && c.name);
    if (karten.length === 0) return undefined;
    const sortiert = karten.slice().sort((a, b) => (kosten(b.name) - kosten(a.name)) || a.name.localeCompare(b.name));
    if (payload.type === 'cardGalleryMulti') return { selectedCards: sortiert.slice(0, MAX_PICKS).map(c => c.name) };
    if (payload.type === 'cardGallery') return { cardName: sortiert[0].name };
    return undefined;
  },

  _test: { ablageArtifacts, deckArtifacts, MAX_PICKS },
};
