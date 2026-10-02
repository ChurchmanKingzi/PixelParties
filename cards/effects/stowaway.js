// ═══════════════════════════════════════════
//  CARD EFFECT: "Stowaway"
//  Creature (Decay Magic + Summoning Magic Lv 1, 50 HP)
//
//  „Summon this Creature into the free Support Zone of any Hero. The
//   corresponding Hero's effect and Abilities are negated. This counts as a
//   negative status effect. This Creature is unaffected by all other cards and
//   effects, but if the status effect it inflicted is removed from the
//   corresponding Hero, it is deleted."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „Corresponding Hero" = der Held, in dessen Zone der Blinde Passagier liegt
//    (Als Ruling 2.10.). Er bekommt den ECHTEN Status `negated` (Muster Decisive Defeat:
//    `attachmentStatus` + `countsAsNegativeStatus` — der Status ist heilbar, taucht in den
//    Heil-Listen als „Negated (Stowaway)" auf und zaehlt als negativer Status).
//  • Wird dieser Status entfernt (Cleanse, Tea …) ODER stirbt der Held (der Todesraeumer
//    nimmt ihm alle Status), wird der Stowaway GELOESCHT (`deleteOnCleanse`, `onHeroKO`) —
//    nicht abgelegt. Verlaesst der Stowaway selbst das Brett, faellt der Status mit.
//  • „Unaffected by all other cards and effects": `counters._cardinalImmune` (quellenblind,
//    wie die Cardinal Beasts) — gegen Schaden, Status, Negation, Bewegen und Zerstoeren.
//    Die eigene Loeschung laeuft ausdruecklich `unaufhaltsam`.
//  • Beschwoerung in die freie Zone JEDES Helden (`playOnAnyHeroSide`, Muster Chilly Wizard):
//    Dragziel = beliebiger freier Platz; Level reicht, wenn irgendein EIGENER lebender Held
//    Decay + Summoning >= 1 hat. Die Creature gehoert danach der Seite, in deren Zone sie liegt.
// ═══════════════════════════════════════════

const { anhaengselStatusHooks, setzeAnhaengselStatus } = require('./_attachment-shared');

const CARD_NAME = 'Stowaway';
const BASE_LEVEL = 1;
const SCHOOLS = ['Decay Magic', 'Summoning Magic'];

/**
 * Count combined Decay+Summoning Magic on the given hero's ability
 * zones (Performance copies on a school base count as that school).
 */
function _combinedSchoolLevel(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const abZones = ps?.abilityZones?.[heroIdx] || [];
  let total = 0;
  for (const s of SCHOOLS) total += engine.countAbilitiesForSchool(s, abZones);
  return total;
}

/**
 * Validate a destination hint stashed by the server before `onPlay`
 * fires. Returns the parsed `{ ownerIdx, heroIdx, slotIdx }` iff:
 *   • the hint addresses a free Support Zone on an alive Hero, AND
 *   • the destination differs from where the engine already placed the
 *     Creature (the chosen summoner's slot).
 *
 * Same-side hints are also honoured — they let the player drop onto
 * Hero X's slot while crediting a different own Hero Y as the summoner
 * (the engine puts the Creature on Y's slot, the hint relocates it
 * over to X's slot). When the hint matches the initial placement
 * exactly, returns null and we leave the Creature in place.
 */
function _consumeCrossSideHint(engine, casterPi, inst) {
  const hint = engine.gs._chillyWizardHint?.[casterPi];
  if (!hint) return null;
  delete engine.gs._chillyWizardHint[casterPi];
  if (typeof hint.ownerIdx !== 'number'
      || typeof hint.heroIdx !== 'number'
      || typeof hint.slotIdx !== 'number') return null;
  const currentOwner = inst.controller ?? inst.owner;
  if (hint.ownerIdx === currentOwner
      && hint.heroIdx === inst.heroIdx
      && hint.slotIdx === inst.zoneSlot) return null;
  const toPs = engine.gs.players[hint.ownerIdx];
  if (!toPs) return null;
  const toHero = toPs.heroes?.[hint.heroIdx];
  if (!toHero?.name || toHero.hp <= 0) return null;
  const zones = toPs.supportZones?.[hint.heroIdx] || [];
  if (hint.slotIdx < 0 || hint.slotIdx >= Math.max(zones.length, 3)) return null;
  const slot = zones[hint.slotIdx];
  if (slot && slot.length > 0) return null;
  return hint;
}


/** Den Stowaway unaufhaltsam loeschen (Geloescht-Stapel seines urspruenglichen Besitzers). */
async function loeschen(engine, inst, grund) {
  if (!inst || inst.zone !== 'support') return;
  engine.log('stowaway_deleted', { reason: grund });
  await engine.anhaengselAbraeumen(inst, { name: grund });
}

const geteilt = anhaengselStatusHooks(CARD_NAME, 'negated', { heilenWirftAb: true });

module.exports = {
  playOnAnyHeroSide: true,
  activeIn: ['support'],

  // ── Status als Karten-Zustand (Muster Decisive Defeat) ──
  attachmentStatus: 'negated',
  countsAsNegativeStatus: true,
  deleteOnCleanse: true,
  unaffectedByOthers: true,   // Puzzle-Start setzt `_cardinalImmune` (server.js)
  negativeStatusLabel: 'Negated (Stowaway)',
  negativeStatusIcon: '🧳',

  /** Jede Hero Zone ist nur eine Adresse (auch besiegte): Platz frei genuegt. */
  canBypassFreeZoneRequirement() { return true; },

  cpuMeta: {
    onDeathBenefit: 0,
    preferOpponentSupportZone: true,
  },

  /** Level: irgendein EIGENER lebender Held mit Decay + Summoning >= 1 genuegt. */
  canBypassLevelReq(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (hi === heroIdx) continue;
      const sibling = ps.heroes[hi];
      if (!sibling?.name || sibling.hp <= 0) continue;
      if (sibling.statuses?.frozen || sibling.statuses?.stunned
          || sibling.statuses?.negated || sibling.statuses?.bound) continue;
      if (_combinedSchoolLevel(engine, pi, hi) >= BASE_LEVEL) return true;
    }
    return false;
  },

  cpuResponse() { return undefined; },

  hooks: {
    // Austritt: der Status faellt mit — Heilen: der Stowaway wird geloescht (geteilter Helfer).
    onCardLeaveZone: geteilt.onCardLeaveZone,
    onStatusRemoved: geteilt.onStatusRemoved,

    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Zielzone: Hinweis des Spielers (Drop auf eine fremde/andere Zone) verschiebt die Creature dorthin.
      const rohHint = engine.gs._chillyWizardHint?.[pi];
      const hint = _consumeCrossSideHint(engine, pi, inst);
      const schonDort = rohHint && rohHint.ownerIdx === (inst.controller ?? inst.owner)
        && rohHint.heroIdx === inst.heroIdx && rohHint.slotIdx === inst.zoneSlot;
      if (rohHint && !hint && !schonDort) {
        // Zielzone ungueltig (besiegter/fehlender Held): es gibt keinen Helden zu negieren — der Passagier faellt weg,
        // statt versehentlich den Helden der Beschwoerungsseite zu negieren.
        await loeschen(engine, inst, 'no_host');
        return;
      }
      if (hint) {
        const fromOwner = inst.controller ?? inst.owner;
        const fromPs = engine.gs.players[fromOwner];
        const toPi = hint.ownerIdx;
        const toPs = engine.gs.players[toPi];
        const fromSlot = fromPs.supportZones?.[inst.heroIdx];
        if (fromSlot) {
          const idx = (fromSlot[inst.zoneSlot] || []).indexOf(CARD_NAME);
          if (idx >= 0) fromSlot[inst.zoneSlot].splice(idx, 1);
        }
        if (!toPs.supportZones[hint.heroIdx]) toPs.supportZones[hint.heroIdx] = [[], [], []];
        toPs.supportZones[hint.heroIdx][hint.slotIdx] = [CARD_NAME];
        inst.heroIdx = hint.heroIdx;
        inst.zoneSlot = hint.slotIdx;
        inst.controller = toPi;
        inst.owner = toPi;
        engine._broadcastEvent('summon_effect', { owner: toPi, heroIdx: hint.heroIdx, zoneSlot: hint.slotIdx, cardName: CARD_NAME });
        await engine._delay(200);
      }

      // „Unaffected by all other cards and effects."
      inst.counters = inst.counters || {};
      inst.counters._cardinalImmune = true;

      // Der Held dieser Zone wird negiert (echter, heilbarer Status).
      const ok = setzeAnhaengselStatus(engine, inst.owner, inst.heroIdx, CARD_NAME, 'negated');
      if (!ok) { await loeschen(engine, inst, 'no_host'); return; }   // Hero Zone ohne lebenden Helden: nichts zu negieren
      engine._broadcastEvent('play_zone_animation', { type: 'stowaway_tentacles', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: -1, duration: 2700 });   // rosa Tentakel umklammern den Wirt
      engine.log('stowaway_negates', {
        hero: engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx]?.name,
      });
      engine.sync();
    },

    /** Stirbt der Wirt, ist der Status weg — und der Stowaway wird geloescht. */
    onHeroKO: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const wirt = engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx];
      if (!ctx.hero || wirt !== ctx.hero) return;
      await loeschen(engine, inst, 'host_defeated');
    },
  },
};
