// ═══════════════════════════════════════════
//  CARD EFFECT: "Kohta, the Silent Observer"
//  Hero — 400 HP / 40 ATK — Creativity, Stealth
//
//  „Once per turn, when a target is defeated by the active effect of a
//   level 2 or lower Creature you control, you may trigger that
//   Creature's effect a second time.\"
//
//  Wann genau?
//  ───────────
//  Der Tod faellt MITTEN in die Aufloesung des Kreatureffekts — dort
//  darf die Wiederholung nicht starten, sie wuerde eine offene
//  Aufloesung aufbrechen. Kohta merkt sich den Fall deshalb nur
//  (`onHeroKO` / `onCreatureDeath`) und handelt im neuen Fenster
//  `afterCreatureEffect` (v740), das der Server nach `onCreatureEffect`
//  oeffnet.
//
//  Die drei Bedingungen des Textes, je an ihrer Stelle:
//   ① „by the ACTIVE effect\" — beim Merken muss der hook-feste Marker
//      `engine._activeCreatureEffect` (v740) stehen und auf genau
//      diese Creature zeigen. Passiv- und Reiter-Effekte setzen ihn
//      nicht.
//   ② „a level 2 or lower Creature YOU CONTROL\" — beim Merken geprueft,
//      im Fenster erneut (das Brett kann sich gedreht haben).
//   ③ „a target is defeated\" — Helden UND Creatures zaehlen, eigene
//      wie fremde: der Text sagt „a target\", nicht „an opponent's\".
//
//  Was NICHT geht, wird auch nicht gefragt: ein Effekt, den eine
//  andere Karte fuer diesen Zug hart gesperrt hat
//  (`_effectLockedTurn`, Grimoire), faellt aus der Eignung heraus.
//
//  „you may\" → Rueckfrage. „Once per turn\" → `claimHOPT`, und zwar
//  erst wenn die Wiederholung TATSAECHLICH gefeuert hat. Der Effekt
//  selbst laeuft dabei mit erzwungener Aufloesung: wer zugesagt hat,
//  kann die Creature nicht mittendrin doch noch abwuergen (v741).
//
//  Die Wiederholung selbst laeuft ueber `engine.reactivateCreatureEffect`
//  (v740): dieselbe Kern-Aufloesung wie ein regulaerer Einsatz, aber
//  ohne Kosten, ohne Aktion und ohne zweiten HOPT-Stempel — es ist ein
//  Geschenk, kein zweiter Zug.
// ═══════════════════════════════════════════

const CARD_NAME = 'Kohta, the Silent Observer';
const HOPT_KEY = 'kohta-silent-observer';
const MAX_LEVEL = 2;

/**
 * Die Creature, deren AKTIVER Effekt gerade laeuft — oder null.
 *
 * Gelesen wird `_activeCreatureEffect` (v740) und NICHT
 * `_currentEffectSource`: letzteres ueberschreibt `runHooks` je
 * Zuhoerer mit dessen eigener Karte, ein Hook saehe dort also stets
 * sich selbst statt des Ausloesers.
 */
function laufenderAktiveffekt(engine, pi) {
  const marke = engine._activeCreatureEffect;
  if (!marke || marke.owner !== pi) return null;
  const inst = (engine.cardInstances || []).find(c => c.id === marke.instId);
  if (!inst || inst.zone !== 'support') return null;
  if ((inst.controller ?? inst.owner) !== pi) return null;
  return inst;
}

/** Level 2 oder niedriger? (Effektive Kartendaten, nicht die gedruckten.) */
function kleinGenug(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  const lv = cd?.level;
  return Number.isFinite(lv) && lv <= MAX_LEVEL;
}

/** Merken, dass dieser Aktiveffekt gerade etwas erledigt hat. */
function merken(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const held = engine.gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
  if (!held?.name || held.hp <= 0) return;
  if (held.statuses?.negated) return;

  const taeter = laufenderAktiveffekt(engine, pi);
  if (!taeter) return;
  if (!kleinGenug(engine, taeter)) return;

  engine._kohtaPending = { pi, instId: taeter.id, name: taeter.name };
}

module.exports = {
  activeIn: ['hero'],

  cpuMeta: {
    // Der Wert haengt ganz am wiederholten Effekt — der Pilot sieht ihn
    // dort, nicht hier.
    dealsDamage: true,
  },

  hooks: {
    // ── ① Merken, waehrend der Effekt noch laeuft ─────────────────
    onHeroKO: async (ctx) => { merken(ctx); },
    onCreatureDeath: async (ctx) => { merken(ctx); },

    // ── ② Handeln, sobald er fertig ist ──────────────────────────
    afterCreatureEffect: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      const vermerk = engine._kohtaPending;
      engine._kohtaPending = null;
      if (!vermerk || vermerk.pi !== pi) return;
      // Nur fuer die Creature, deren Effekt gerade zu Ende ging.
      if (ctx.creature?.id !== vermerk.instId) return;

      const held = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
      if (!held?.name || held.hp <= 0 || held.statuses?.negated) return;
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return;

      // Steht die Creature ueberhaupt noch, und ist sie noch meine?
      const inst = engine.cardInstances.find(c => c.id === vermerk.instId);
      if (!inst || inst.zone !== 'support') return;
      if ((inst.controller ?? inst.owner) !== pi) return;
      if (!kleinGenug(engine, inst)) return;
      if (inst.counters?.negated || inst.counters?.nulled) return;
      // v751: NICHT fragen, was ohnehin nicht geht. Ein Effekt, der fuer
      // diesen Zug hart gesperrt ist („cannot be used another time in
      // any way" — Spirit of the Forbidden Grimoire), laesst sich auch
      // von Kohta nicht wiederholen. Vorher kam die Rueckfrage, die
      // Zusage lief ins Leere und der Spieler sah nichts passieren
      // (Als Befund 5.9.).
      if (inst.counters?._effectLockedTurn === gs.turn) return;

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${inst.name} struck something down — ${held.name} watched closely. Trigger its effect a second time?`,
        showCard: inst.name,
        showCardLeft: CARD_NAME,
        confirmLabel: '👁️ Again',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!engine._confirmSaidYes(ja)) return;

      // Zusage steht — ab hier gibt es keinen Rueckweg mehr: die
      // Wiederholung laeuft mit erzwungener Aufloesung
      // (`_forceNonCancellable`, v741), der Spieler kann den Effekt der
      // Creature also nicht doch noch abwuergen. Deshalb darf der
      // Auftritt hier stehen (Regel v736).
      await engine.showTriggeredEffect(CARD_NAME);

      // ── SPERRE VOR DEM LAUF (v753) ────────────────────────────────
      // Die Wiederholung kann selbst wieder toeten, und ihr Abschluss
      // oeffnet erneut `afterCreatureEffect`. Wurde die Sperre erst
      // DANACH gesetzt, sah die verschachtelte Runde sie noch nicht und
      // Kohta wiederholte endlos (im Test bis zum Hook-Deckel bei
      // 10 000). Also erst sperren, dann laufen lassen.
      engine.claimHOPT(HOPT_KEY, pi);
      const gefeuert = await engine.reactivateCreatureEffect(inst, pi);
      // Steigt das Skript aus eigenem Antrieb aus (`return false`),
      // etwa weil das Brett kein legales Ziel mehr hergibt, wird die
      // Sperre zurueckgegeben — dann hat Kohta nichts verbraucht.
      if (!gefeuert && gs.hoptUsed) delete gs.hoptUsed[`${HOPT_KEY}:${pi}`];
    },
  },
};
