// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Awakening"
//  Spell (Attachment)
//
//  "Attach this Spell to a Hero you control. That Hero can Ascend to an
//   appropriate Ascended Hero without fulfilling its Ascension
//   Conditions."
//
//  ── WAS DIE KARTE TUT ─────────────────────────────────────────────
//  Sie ist die Kartenfassung von `opts.skipCondition`, das am 28.8.
//  fuer „???, the Throne Robber" an `performAscension` kam. Der Held
//  mit diesem Attachment darf zu JEDER passenden Ascended-Hero-Karte
//  aufsteigen, ohne deren Bedingung zu erfuellen.
//
//  „appropriate" liest sich als: die Zielkarte muss ueberhaupt auf
//  diesen Helden passen. Was das heisst, steht auf der ZIELKARTE
//  („You must play this Hero on top of a 'X' you control") — deshalb
//  wird die Namensbindung NICHT uebersprungen, nur die
//  Zusatzbedingung. Ohne diese Grenze koennte ein beliebiger Held zu
//  einem beliebigen Ascended Hero werden, was dem Wort „appropriate"
//  offen widerspraeche.
//
//  ── UND WAS SIE NICHT TUT (Als Hinweis 28.8.) ─────────────────────
//  Sechs Ascended Heroes sperren das Ueberspringen ausdruecklich:
//  „Bloom", Beato, Chuck, Definitely not Andras, Sparrow, Styx. An
//  denen prallt sie ab. Der Riegel sitzt in der ENGINE
//  (`isAscensionConditionUnskippable`) und nicht hier, weil er fuer
//  JEDEN Weg gelten muss, der eine Bedingung ueberspringt — diese
//  Karte und Throne Robber lesen dieselbe Wahrheit.
// ═══════════════════════════════════════════

const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const CARD_NAME = 'Divine Awakening';

/** Linkeste freie Support-Zone dieses Helden, sonst -1. */
function findFreeSlot(ps, heroIdx) {
  const slots = ps.supportZones?.[heroIdx] || [];
  for (let si = 0; si < 3; si++) {
    if (!slots[si] || slots[si].length === 0) return si;
  }
  return -1;
}

/**
 * Alle eigenen Helden, an die das Attachment gehen DARF.
 *
 * ★ Als Befund 28.8.: „Aktuell kann Awakening nur an Heroes angelegt
 * werden, die selbst faehig sind, es zu casten. Das ist NICHT, wie es
 * funktionieren soll."
 *
 * Ursache war nicht diese Karte, sondern die Verwechslung zweier
 * Rollen: der Client meldet den Helden, auf den man zieht, als CASTER
 * (`attachmentZoneSlot`), und die Karte legte sich daraufhin an genau
 * diesen an. Wirken und Anlegen sind aber zwei verschiedene Dinge —
 * wer wirkt, muss die Stufe erfuellen; wer es TRAEGT, muss nur eine
 * Ascended-Form besitzen.
 *
 * Die Aufstiegslinie liest `engine.heroHasAscendedForm` — die gab es
 * bis heute nicht und ist aus dem gedruckten Text der Ascended Heroes
 * abgeleitet (siehe dort).
 */
function legaleZiele(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps || !engine?.heroHasAscendedForm) return [];
  const raus = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (findFreeSlot(ps, hi) < 0) continue;
    if (!engine.heroHasAscendedForm(hero.name)) continue;
    raus.push(hi);
  }
  return raus;
}

/**
 * Traegt dieser Held ein „Divine Awakening"?
 *
 * Von der Engine ueber `hasDivineAwakening` gelesen, damit die
 * Aufstiegspruefung nicht selbst in Support Zones wuehlen muss.
 */
function heroHasAwakening(engine, pi, heroIdx) {
  return engine.cardInstances.some(c =>
    c.owner === pi && c.zone === 'support' && c.heroIdx === heroIdx
    && c.name === CARD_NAME);
}

module.exports = {
  requiresTarget: true,
  activeIn: ['hand', 'support'],

  /**
   * Spielbar, sobald ein lebender eigener Held mit ASCENDED-FORM Platz
   * hat (Als Vorgabe 28.8.). Ein Held ohne Aufstiegslinie kann mit dem
   * Erlass nichts anfangen — die Karte an ihn zu haengen waere ein
   * toter Zug.
   */
  spellPlayCondition(gs, pi, engine) {
    return legaleZiele(gs, pi, engine).length > 0;
  },

  /**
   * Empfaenger-Zonen fuers Ziehen (Als Vorgabe 28.8.).
   *
   * „Wenn ich einen ??? habe, der Awakening casten kann, und einen
   * Arthor, der das NICHT kann, sollen trotzdem die Support Zones
   * BEIDER Heroes als Drop Zones eligible sein."
   *
   * Genau dieselbe Menge wie `legaleZiele`, nur in der Form, die der
   * Client fuers Hervorheben braucht. Beide lesen denselben Helfer —
   * eine zweite Liste waere die zweite Wahrheit.
   */
  attachmentHosts(gs, pi, engine) {
    const erlaubt = new Set(legaleZiele(gs, pi, engine));
    return attachmentHostsFor(gs, pi, engine, { heroFilter: (h, hi) => erlaubt.has(hi) });
  },
  // ── Vertrag fuer die Engine ────────────────────────────────────
  // `performAscension` fragt ueber diesen Namen, ob der aufsteigende
  // Held seine Bedingung ueberspringen darf. Als Funktion auf dem
  // Skript, damit die Engine nicht nach Kartennamen in Zonen suchen
  // muss — dieselbe Linie wie bei `_crystals-shared`.
  grantsAscensionSkip: heroHasAwakening,

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const casterHeroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Zielliste wie bei Light Ball / Curse / Berserk: der Held selbst
      // (linkester freier Slot) UND jede freie Zone einzeln.
      // NUR Helden mit Ascended-Form — unabhaengig davon, wer gewirkt
      // hat.
      // v650: Wirt + Platzierung ueber den geteilten Anlege-Vorgang;
      // die Kandidaten sind weiterhin `legaleZiele` (Helden mit
      // Ascended-Form), Drop-Hinweise und Prompt kommen vom Baustein.
      const erlaubt = new Set(legaleZiele(gs, pi, engine));
      const res = await attachToHero(ctx, CARD_NAME, {
        heroFilter: (h, hi) => erlaubt.has(hi), preferCaster: true,
        description: 'Choose one of your Heroes that has an Ascended form (auto-leftmost-free slot), or click a specific empty Support Zone.',
        confirmLabel: '✨ Attach!', animationType: 'divine_awakening',
      });
      if (!res) return;
      const destHero = res.host.heroIdx, destSlot = res.host.slotIdx, inst = res.inst;
      const destHeroObj = ps.heroes?.[destHero];
      engine.log('divine_awakening_attached', {
        player: ps.username, hero: destHeroObj?.name, heroIdx: destHero, zoneSlot: destSlot,
      });
      // ★ Hier stand ein Aufruf `engine.refreshAscensionAvailability(pi)`
      // — den es NICHT GIBT. Der Optional-Aufruf haette ihn still
      // verschluckt, und genau diese Stille ist der teure Fall: die
      // Karte haette ausgesehen, als kuemmere sie sich um die
      // Bereitschaftsanzeige, ohne es zu tun.
      //
      // Sie muss es auch gar nicht: die Anzeige der eigenen Helden
      // (Shapeshifter, Waflav) haengt an DEREN Bedingungen, und dieses
      // Attachment aendert nur, ob die Bedingung der ZIELKARTE
      // uebersprungen wird. Das liest `performAscension` bei jedem
      // Versuch frisch.
      engine.sync();
      // `onCardEnterZone` hat der Anlege-Baustein bereits gefeuert.
    },
  },
};
