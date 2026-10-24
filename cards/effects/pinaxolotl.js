'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Pinaxolotl"
//  Creature (Normal, Lv0, 40 HP, Summoning Magic)
//
//  „When this Creature is defeated, you may search your deck for any Creature, except "Pinaxolotl", reveal it and add it to your hand. If it's a level 0 Creature,
//   you may immediately summon it as an additional Action."
//
//  ── NEUE WERTE ──────────────────────────────────────────────────────────
//  Jetzt Lv 0 (vorher Lv 1) mit 40 HP (vorher 50) und dem Zusatz „except Pinaxolotl" (Datenänderung in `data/cards.json`).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  `hooks.onCreatureDeath` (die Engine ruft ihn NACH dem Entfernen aus der Zone, VOR dem Wechsel in die Ablage — das Skript der sterbenden Instanz ist noch aktiv; Vorlage: Hell Fox).
//  Gilt für JEDES Besiegtwerden (Schaden, Opfer, Zerstörung). Selbsterkennung über `death.instId === ctx.card.id`: mehrere Pinaxolotl am Brett lösen je ihren eigenen Treffer aus.
//    ① SUCHE („you may search your deck for any Creature, except Pinaxolotl"): Galerie ALLER Creatures im eigenen Deck außer „Pinaxolotl" (Basisname, auch [B]/[W]). Abbruch ist erlaubt
//       („may"); nach der Suche (Wahl ODER Abbruch) wird das Deck gemischt. Ohne wählbare Creature im Deck wird nichts angeboten. Die Suche ist eine Hand-Suche (Bauform ②,
//       `_search-shared.js`): unter einer Such-Sperre wird sie gar nicht erst angeboten; auch bei gesperrter Hand (`handLocked`) nicht. „your deck" = das Deck des KONTROLLEURS.
//    ② AUF DIE HAND (`actionAddCardFromDeckToHand`, `reveal: true`: der Gegner sieht die Karte).
//    ③ „If it's a level 0 Creature": zählt die WIRKSAME Handstufe der gerade geholten Karte (`effectiveCardLevel` mit `handIdx` — Handstufen-Effekte wie Coreling zählen, wie bei Slave
//       Trader). Ist sie 0 UND gibt es einen tauglichen Beschwörer mit freier Zone („if possible"), fragt eine Ja/Nein-Abfrage („may"), ob sie SOFORT als Zusatzaktion beschworen werden
//       soll (`sofortAusHandBeschwoeren`: ganz normale Beschwörung, Zone wählbar, `alsZusatzaktion`). Die Zone, die Pinaxolotl gerade frei gemacht hat, ist dabei verfügbar.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `pinaxolotl_bubbles` (Pixelart, ANIM_REGISTRY) auf dem frei gewordenen Platz: Blasen steigen auf und zerplatzen. Klänge in ZONE_ANIM_SFX; Log `pinaxolotl`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Sucht bevorzugt eine Lv0-Creature, die sich sofort beschwören lässt (Kartenvorteil + Zusatzaktion), sonst die Creature mit der höchsten Stufe.
// ═══════════════════════════════════════════

const { hasCardType, baseCardName } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { eligibleSummonZones, sofortAusHandBeschwoeren } = require('./_summon-eligibility');
const { skipIfSearchBlocked } = require('./_search-shared');

const CARD_NAME = 'Pinaxolotl';
const BLASEN_MS = 700;      // Länge von `pinaxolotl_bubbles` im Client

/** Creatures im Deck des Spielers (ohne „Pinaxolotl"), nach Name gruppiert. */
function deckCreatures(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const zaehler = {};
  for (const n of (ps?.mainDeck || [])) {
    if (baseCardName(n) === CARD_NAME) continue;
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    zaehler[n] = (zaehler[n] || 0) + 1;
  }
  return Object.entries(zaehler).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'deck', count }));
}

/** Zonen, in die `name` JETZT als Zusatzaktion beschworen werden könnte (leer = „if possible" scheitert). */
function moeglicheZonen(engine, pi, name) {
  const cd = engine._getCardDB()[name];
  if (!cd || !hasCardType(cd, 'Creature')) return [];
  if (loadCardEffect(name)?.summonOnlyViaOwnEffect) return [];
  return eligibleSummonZones(engine, pi, name, { nachKontrolle: true, alsAktion: true })
    .filter(z => engine.isCreatureSummonable(name, z.owner ?? pi, z.heroIdx, { beschwoerer: pi }));
}

/** Wirksame Handstufe der Karte `name` (letzter Platz in der Hand). */
function handStufe(engine, pi, name) {
  const ps = engine.gs.players[pi];
  const cd = engine._getCardDB()[name];
  if (!ps || !cd) return null;
  const handIdx = (ps.hand || []).lastIndexOf(name);
  if (handIdx < 0) return null;
  const lv = engine.effectiveCardLevel(cd, pi, { handIdx });
  return Number.isFinite(Number(lv)) ? Number(lv) : null;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: { impact: { type: 'pinaxolotl_bubbles' }, impactMs: BLASEN_MS },

  activeIn: ['support'],

  cpuMeta: { onDeathBenefit: 14 },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;      // nur ICH selbst

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;                                // Kontrolleur: „your deck"
      const ps = gs.players[pi];
      if (!ps) return;

      // Die Blasen steigen auf dem frei gewordenen Platz auf (auch wenn danach nichts gesucht wird).
      engine._broadcastEvent('play_zone_animation', {
        type: 'pinaxolotl_bubbles', owner: death.owner, heroIdx: death.heroIdx, zoneSlot: death.zoneSlot, duration: BLASEN_MS,
      });

      // ── ① Suche ──
      if (ps.handLocked) { engine.log('pinaxolotl_skipped', { reason: 'hand_locked' }); engine.sync(); return; }
      if (skipIfSearchBlocked(engine, pi, CARD_NAME)) { engine.sync(); return; }
      const galerie = deckCreatures(engine, pi);
      if (galerie.length === 0) { engine.log('pinaxolotl_skipped', { reason: 'no_creature' }); engine.sync(); return; }

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        searchToHand: true,      // Hand-Suche (Such-Template): unter einer Such-Sperre öffnet `promptGeneric` die Galerie gar nicht erst
        searchPile: 'deck',
        cards: galerie,
        title: CARD_NAME,
        description: `Search your deck for any Creature except "${CARD_NAME}" and add it to your hand. A level 0 Creature may be summoned immediately.`,
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName || !galerie.some(g => g.name === wahl.cardName)) {
        // Auch ein Abbruch ist eine Suche: das Deck wird gemischt (wie Hell Fox / Elven Rider).
        engine.shuffleDeck(pi, 'main');
        engine.sync();
        return;
      }
      const name = wahl.cardName;
      if (ps.mainDeck.indexOf(name) < 0) { engine.shuffleDeck(pi, 'main'); engine.sync(); return; }

      await engine.showTriggeredEffect(CARD_NAME);      // Auftritt erst jetzt: die Suche findet statt (nach dem „you may")
      // ── ② Auf die Hand (kanonischer Weg: ON_CARD_ADDED_TO_HAND feuert, Gegner sieht die Karte, Deck wird gemischt) ──
      await engine.actionAddCardFromDeckToHand(pi, name, { source: CARD_NAME, reveal: true, shuffle: true });
      engine.log('pinaxolotl', { player: ps.username, card: name });

      // ── ③ Lv0-Creature: darf sofort als Zusatzaktion beschworen werden ──
      if (!(ps.hand || []).includes(name)) { engine.sync(); return; }       // die Hand-Aufnahme wurde verhindert
      if (handStufe(engine, pi, name) !== 0) { engine.sync(); return; }
      const zonen = moeglicheZonen(engine, pi, name);
      if (zonen.length === 0) { engine.sync(); return; }
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Immediately summon ${name} as an additional Action?`,
        confirmLabel: '✨ Summon!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,      // echtes „you may": freiwillige Beschwörung
      });
      if (!ja) { engine.sync(); return; }
      const ok = await sofortAusHandBeschwoeren(engine, pi, name, {
        source: CARD_NAME,
        zonenFilter: (z) => engine.isCreatureSummonable(name, z.owner ?? pi, z.heroIdx, { beschwoerer: pi }),
      });
      engine.log('pinaxolotl_summon', { player: ps.username, card: name, summoned: !!ok });
      engine.sync();
    },
  },

  /** CPU: eine Lv0-Creature, die sich sofort beschwören lässt, sonst die Creature mit der höchsten Stufe; die sofortige Beschwörung nimmt die CPU immer. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME) return undefined;
    if (payload.type === 'confirm') return { confirmed: true };
    if (payload.type !== 'cardGallery') return undefined;
    const pi = engine._cpuPlayerIdx;
    const db = engine._getCardDB();
    const karten = (payload.cards || []).filter(c => c && c.name);
    if (karten.length === 0) return undefined;
    const lv = (n) => Number(db[n]?.level) || 0;
    const sofort = karten.filter(c => lv(c.name) === 0 && moeglicheZonen(engine, pi, c.name).length > 0);
    const pool = sofort.length ? sofort : karten;
    const beste = pool.slice().sort((a, b) => (lv(b.name) - lv(a.name)) || a.name.localeCompare(b.name))[0];
    return { cardName: beste.name };
  },

  _test: { deckCreatures, moeglicheZonen, handStufe },
};
