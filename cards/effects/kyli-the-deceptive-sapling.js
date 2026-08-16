// ═══════════════════════════════════════════
//  CARD EFFECT: "Kyli, the Deceptive Sapling"
//  Hero — 400 HP / 40 ATK. Starting abilities:
//  Biomancy, Occultism.
//
//  "Once per turn, when you sacrifice a Creature that is not a
//   Potion with the effect of this Hero's Occultism, you may choose
//   up to 3 of your deleted Potions and place them into this Hero's
//   free Support Zones as if they were summoned by the effect of
//   this Hero's Biomancy."
//
//  ── WARUM „not a Potion" (Anti-Schleife) ──────────────────────
//  Biomancy-Tokens SIND Potions: `biomancy.js` legt die Potion
//  selbst aufs Brett und macht sie nur ueber
//  `counters._cardDataOverride` zur `Creature/Token`. Ohne die
//  Klausel koennte man Token opfern → geloeschte Potions
//  zurueckholen → endlos drehen. Geprueft wird deshalb am ROHEN
//  Datenbankeintrag (`isPotionCardName`), NICHT an den effektiven
//  Kartendaten — sonst waere jeder Token „eine Kreatur" und die
//  Klausel wirkungslos.
//
//  Bis v399 war das ein theoretischer Fall: `getSacrificableCreatures`
//  las selbst roh und liess Tokens gar nicht erst als Tribut zu.
//  Al hat das als Bug bestaetigt, seit v399 ist es gefixt — die
//  Klausel ist also ab jetzt scharf.
//
//  ── AUSLEGUNG (Als Rulings 16.8.) ─────────────────────────────
//  · Kylis Effekt VERBRAUCHT Biomancy nicht und wird von deren
//    Einmal-pro-Zug auch nicht blockiert. „as if they were summoned
//    by the effect of this Hero's Biomancy" beschreibt die ART des
//    Ergebnisses, nicht die Kosten; Kyli hat ihr eigenes Limit.
//  · Er SKALIERT aber mit Kylis aktueller Biomancy-Stufe, und bei
//    Stufe 0 (keine Biomancy an ihr) passiert nichts.
//  · „Once per turn" ohne Zusatz = SOFT, pro Instanz (v249-Regel).
//    Zwei Kylis duerfen also beide.
//
//  ── ZWEISTUFIG, UND WARUM ─────────────────────────────────────
//  `onCreatureSacrificed` feuert in Occultism VOR `actionDestroyCard`
//  — der Tribut steht dann noch in seiner Zone. Lag er in KYLIS
//  Zone, waere sie beim Platzieren um einen Platz aermer.
//  `onCreatureDeath` feuert dagegen laut Engine-Kommentar
//  (_engine.js, „Fire ON_CREATURE_DEATH BETWEEN the splice and the
//  inst-zone update") ausdruecklich, NACHDEM der Slot geleert ist —
//  „so on-death tutors that want to land in the vacated slot (Elven
//  Rider) see it free". Also: im Sacrificed-Hook pruefen und
//  vormerken, im Death-Hook ausfuehren.
//
//  AUSNAHME Hand-Substitut (Chosen Sacrifice): Occultism raeumt das
//  per Hand ab und feuert dafuer bewusst KEIN ON_CREATURE_DEATH.
//  Ein Tribut aus der Hand belegt aber auch keine Zone — dieser Fall
//  laeuft deshalb sofort im Sacrificed-Hook.
// ═══════════════════════════════════════════

'use strict';

const {
  tokenStatsForLevel, biomancyLevelOf, freeSupportSlots,
  isPotionCardName, placeBiomancyToken,
} = require('./_biomancy-shared');

const CARD_NAME = 'Kyli, the Deceptive Sapling';
const OCCULTISM = 'Occultism';
const MAX_PICKS = 3;

/**
 * Soft-HOPT mit Rundenstempel auf der Helden-INSTANZ.
 *
 * Bewusst NICHT ueber einen `onTurnStart`-Hook zurueckgesetzt: `runHooks`
 * ueberspringt Karten, die eingefroren / gestunnt / negiert sind, ein
 * Zuruecksetzen dort ginge also genau dann verloren, wenn Kyli im Lauf
 * der Runde geheilt wird (Regel aus [[pixel-parties-kartenbugs5]],
 * Muster `steam-dwarf-dragon-pilot.js`). Der Stempel raeumt sich selbst
 * auf, indem er mit der aktuellen Rundenzahl verglichen wird.
 */
function alreadyUsedThisTurn(engine, inst) {
  return (inst?.counters?._kyliTurn ?? -1) === (engine.gs?.turn ?? 0);
}
function markUsedThisTurn(engine, inst) {
  if (!inst) return;
  if (!inst.counters) inst.counters = {};
  inst.counters._kyliTurn = engine.gs?.turn ?? 0;
}

/** Geloeschte Potions des Spielers, als Galerie-Eintraege mit Pile-Index. */
function deletedPotionEntries(engine, pi) {
  const pile = engine.gs?.players?.[pi]?.deletedPile || [];
  const out = [];
  for (let i = 0; i < pile.length; i++) {
    if (!isPotionCardName(engine, pile[i])) continue;
    // `pileIndex` haelt die Kopien auseinander: zwei geloeschte „Acid
    // Vial" muessen zwei waehlbare Eintraege sein, nicht einer.
    out.push({ name: pile[i], pileIndex: i, source: 'deleted' });
  }
  return out;
}

/** Stammt dieses Opfer aus der Occultism DIESES Helden? */
function firedByOwnOccultism(ctx) {
  const src = ctx.source;
  if (!src || src.name !== OCCULTISM) return false;
  if (src.owner !== ctx.cardOwner) return false;
  return src.heroIdx === ctx.cardHeroIdx;
}

/**
 * Der eigentliche Effekt. Wird entweder sofort (Hand-Substitut) oder aus
 * dem Death-Hook heraus gerufen — zu dem Zeitpunkt ist der Tribut-Slot
 * bereits frei.
 */
async function resolveKyli(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const ps = engine.gs?.players?.[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return;

  // Skaliert mit Kylis AKTUELLER Biomancy-Stufe; ohne Biomancy kein
  // Effekt (Als Ruling — der Verweis haette dann keinen Bezug).
  const level = biomancyLevelOf(engine, pi, heroIdx);
  if (level <= 0) return;

  const frei = freeSupportSlots(engine, pi, heroIdx);
  if (frei.length === 0) return;

  const kandidaten = deletedPotionEntries(engine, pi);
  if (kandidaten.length === 0) return;

  // „up to 3" UND „into this Hero's free Support Zones" — beides
  // begrenzt, die kleinere Zahl gewinnt.
  const maxPicks = Math.min(MAX_PICKS, frei.length, kandidaten.length);
  const stats = tokenStatsForLevel(level);

  const auswahl = await engine.promptGeneric(pi, {
    type: 'cardGalleryMulti',
    // Titel = blanker Kartenname, damit der CPU-Brain den cpuResponse
    // unten ueber `promptData.title` findet (dieselbe Auflage wie bei
    // Biomancy). Die Stufe steht in der Beschreibung.
    title: CARD_NAME,
    description: `Biomancy Lv${level}: place up to ${maxPicks} deleted Potion${maxPicks === 1 ? '' : 's'} `
      + `into ${hero.name}'s free Support Zones as Biomancy Tokens (${stats.hp} HP, ${stats.damage} damage).`,
    cards: kandidaten,
    selectCount: maxPicks,
    minSelect: 1,
    confirmLabel: '🌱 Regrow!',
    confirmClass: 'btn-success',
    cancellable: true,
    // Echtes „you may" — Gerrymander darf die Entscheidung umlenken,
    // gleiche Einstufung wie bei Biomancy selbst.
    gerrymanderEligible: true,
  });
  if (!auswahl || auswahl.cancelled) return;

  // Der Prompt kann je nach Fassung Namen ODER Eintraege liefern; beide
  // Formen auf Pile-Indizes normalisieren. Ueber den Index wird auch die
  // richtige KOPIE aus dem Loeschstapel entfernt.
  const gewaehlt = Array.isArray(auswahl.selectedCards) ? auswahl.selectedCards
    : Array.isArray(auswahl) ? auswahl : [];
  if (gewaehlt.length === 0) return;

  const offen = kandidaten.slice();
  const picks = [];
  for (const g of gewaehlt) {
    if (picks.length >= maxPicks) break;
    const name = (typeof g === 'string') ? g : (g?.name ?? g?.cardName);
    const idx = (typeof g === 'object' && g?.pileIndex != null)
      ? offen.findIndex(k => k.pileIndex === g.pileIndex)
      : offen.findIndex(k => k.name === name);
    if (idx < 0) continue;
    picks.push(offen.splice(idx, 1)[0]);
  }
  if (picks.length === 0) return;

  engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
  await engine._delay(300);

  let gelegt = 0;
  for (const pick of picks) {
    // Jede Platzierung prueft die Zone NEU — zwischen zwei Tokens kann
    // ein Eintritts-Hook (Pes'zet & Co.) das Brett veraendert haben.
    if (freeSupportSlots(engine, pi, heroIdx).length === 0) break;

    // Erst JETZT aus dem Loeschstapel nehmen: bricht die Platzierung ab,
    // bleibt die Potion geloescht statt spurlos zu verschwinden.
    const pile = ps.deletedPile || [];
    const at = pile.lastIndexOf(pick.name);
    if (at < 0) continue;

    const platziert = await placeBiomancyToken(
      engine, pi, heroIdx, pick.name, level, { sourceName: CARD_NAME },
    );
    if (!platziert) continue;

    pile.splice(at, 1);
    gelegt++;
  }

  if (gelegt > 0) {
    engine.log('kyli_regrow', {
      player: ps.username, hero: hero.name,
      level, placed: gelegt,
      potions: picks.slice(0, gelegt).map(p => p.name),
    });
  }
  engine.sync();
}

module.exports = {
  activeIn: ['hero'],

  /**
   * CPU: die Galerie ist ein abbrechbarer „you may"-Prompt, und der
   * generische Loeser lehnt solche standardmaessig ab — ohne das hier
   * waere Kyli fuer die CPU tot. Geloeschte Potions als Kreaturen
   * zurueckzuholen ist kostenlos und immer gut (freie Zone ist bereits
   * Vorbedingung), also nimmt sie so viele wie erlaubt.
   */
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type !== 'cardGalleryMulti') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    const angebot = promptData.cards || [];
    if (!angebot.length) return undefined;
    const n = Math.min(promptData.selectCount || MAX_PICKS, angebot.length);
    return { selectedCards: angebot.slice(0, n).map(c => c?.name ?? c) };
  },

  cpuMeta: {
    // Kylis Ertrag zeigt sich erst, wenn die Token spaeter zuschlagen —
    // die Sofort-Bewertung sieht nur „Potion aus dem Loeschstapel wird
    // Kreatur". Den Rest des Zuges mitrechnen lassen, damit der
    // Aktiveffekt der frischen Token in die Bewertung faellt.
    evaluateThroughTurnEnd: true,
  },

  hooks: {
    /**
     * Stufe 1 — pruefen und vormerken. Hier NICHT platzieren: der
     * Tribut steht noch in seiner Zone (siehe Kopfkommentar).
     */
    onCreatureSacrificed: async (ctx) => {
      const engine = ctx._engine;
      if (!firedByOwnOccultism(ctx)) return;

      const opfer = ctx.creature;
      const opferName = opfer?.name || ctx.cardName;
      // Anti-Schleife: Biomancy-Tokens sind Potions.
      if (isPotionCardName(engine, opferName)) return;

      if (alreadyUsedThisTurn(engine, ctx.card)) return;
      markUsedThisTurn(engine, ctx.card);

      // Hand-Substitut (Chosen Sacrifice): kein Brett-Slot beteiligt, es
      // kommt kein Death-Hook — sofort ausfuehren.
      if (opfer?.zone === 'hand') { await resolveKyli(ctx); return; }

      if (!ctx.card.counters) ctx.card.counters = {};
      ctx.card.counters._kyliPendingId = opfer?.id ?? null;
    },

    /**
     * Stufe 2 — ausfuehren. Der Slot des Tributs ist ab hier frei.
     * `onCreatureDeath` feuert fuer JEDEN Tod, deshalb der Abgleich der
     * vorgemerkten Instanz-ID.
     */
    onCreatureDeath: async (ctx) => {
      const pending = ctx.card?.counters?._kyliPendingId;
      if (pending == null) return;
      const gestorben = ctx.creature?.instId ?? ctx.creature?.id;
      if (gestorben !== pending) return;
      delete ctx.card.counters._kyliPendingId;
      await resolveKyli(ctx);
    },

    /**
     * Aufraeumen: stirbt der Tribut wider Erwarten nie (abgefangene
     * Zerstoerung, Partieende mitten in der Kette), darf die Vormerkung
     * nicht in die naechste Runde lecken und dort einen fremden Tod
     * einfangen.
     */
    onTurnEnd: async (ctx) => {
      if (ctx.card?.counters?._kyliPendingId != null) {
        delete ctx.card.counters._kyliPendingId;
      }
    },
  },
};
