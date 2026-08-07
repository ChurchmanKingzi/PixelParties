// ═══════════════════════════════════════════
//  ASCENDED HERO: "Deep-Drowned Waflav"
//  550 HP, 180 ATK — Waflav archetype, top of the stack
//
//  "You must play this Hero from your hand on top of a
//   'Waflav' Hero you control by removing 4 Evolution
//   Counters from it. Ascending this Hero does not end your
//   turn. You may once per turn remove up to 3 Evolution
//   Counters from this Hero to deal 100 damage to a target
//   that many times. You may once per turn Descend this
//   Hero to place 2 Evolution Counters onto it."
//
//  TWO independent once-per-turn effects. The engine's shared
//  `hero-effect:<name>` stamp would lock the second one out
//  after the first, which the card text does not say — so this
//  card keeps its own HOPT keys and returns `false` from
//  `onHeroEffect` (see `finishSelfManagedHeroEffect`).
//
//  "deal 100 damage to a target that many times" — Als Ruling:
//  the target is chosen ONCE, then the damage instances land in
//  quick succession. Not re-targeted per hit.
// ═══════════════════════════════════════════

const W = require('./_waflav-shared');

const CARD_NAME = 'Deep-Drowned Waflav';
const ASCEND_COST = 4;
const DESCEND_GAIN = 2;
const MAX_SURGE = 3;
const SURGE_DAMAGE = 100;

const surgeKey = (pi, hi) => `waflav-surge:${CARD_NAME}:${pi}:${hi}`;

function surgeAvailable(engine, pi, heroIdx) {
  const gs = engine.gs;
  if (gs.hoptUsed?.[surgeKey(pi, heroIdx)] === gs.turn) return false;
  const hero = gs.players[pi]?.heroes?.[heroIdx];
  return !!hero?.name && hero.hp > 0 && W.getEvo(hero) >= 1;
}

async function runSurge(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero) return false;

  const have = W.getEvo(hero);
  const max = Math.min(MAX_SURGE, have);
  if (max < 1) return false;

  // "remove UP TO 3" — the player picks how many.
  const options = [];
  for (let n = 1; n <= max; n++) {
    options.push({
      id: String(n),
      label: `${n} Counter${n > 1 ? 's' : ''} → ${n}× ${SURGE_DAMAGE} damage`,
    });
  }
  const choice = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    source: CARD_NAME,
    description: 'Remove how many Evolution Counters?',
    options,
    cancellable: true,
  });
  const count = parseInt(choice?.optionId || '0', 10);
  if (!count || count < 1) return false;

  const targets = W.collectBoardTargets(engine);
  if (targets.length === 0) return false;

  const pick = await engine.promptEffectTarget(pi, targets, {
    title: CARD_NAME,
    source: CARD_NAME,
    description: `Deal ${SURGE_DAMAGE} damage ${count} time${count > 1 ? 's' : ''} to one target.`,
    confirmLabel: '🌊 Surge!',
    confirmClass: 'btn-danger',
    cancellable: true,
    maxTotal: 1,
    minRequired: 1,
    baseDamage: SURGE_DAMAGE,
    damageType: 'other',
    redSelect: true,
  });
  if (!pick || pick.length === 0) return false;
  const sel = targets.find(t => t.id === pick[0]);
  if (!sel) return false;

  // Commit: pay, stamp, then land the instances in quick succession.
  if (!W.spendEvo(engine, pi, heroIdx, count)) return false;
  if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
  engine.gs.hoptUsed[surgeKey(pi, heroIdx)] = engine.gs.turn;

  const source = { name: CARD_NAME, owner: pi, heroIdx };
  for (let i = 0; i < count; i++) {
    // Target chosen once (Als Ruling) — but it can die partway through,
    // so re-check before each instance instead of hitting a corpse.
    if (sel.type === 'hero') {
      const h = engine.gs.players[sel.owner]?.heroes?.[sel.heroIdx];
      if (!h?.name || h.hp <= 0) break;
      await engine.actionDealDamage(source, h, SURGE_DAMAGE, 'other');
    } else {
      const inst = sel.cardInstance;
      if (!inst || inst.zone !== 'support') break;
      await engine.actionDealDamage(source, inst, SURGE_DAMAGE, 'other');
    }
    engine.sync();
    await engine._delay(220);
  }
  engine.log('deepdrowned_surge', {
    player: engine.gs.players[pi]?.username,
    target: sel.cardName, hits: count, damage: SURGE_DAMAGE,
  });
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['hero'],

  // ── Ascension ──
  ...W.ascensionContract(ASCEND_COST),
  blockEndPhaseOnAscend: true,
  formsAscensionStack: true,
  evolutionAnimation: true,

  /**
   * Nach dem Aufstieg die Ascension-Ziele neu berechnen.
   *
   * `performAscension` loescht direkt vor diesem Aufruf `ascensionReady`
   * und `ascensionTargets` (Aufraeumen der alten Form). Ohne dieses
   * Setup blieben beide leer, bis das naechste Mal ein Counter bewegt
   * wird — GENAU der Fall, den Al gesehen hat: nach dem Aufstieg zu
   * Thunderstruck war mit 7 Countern keine weitere Form waehlbar, und
   * erst der Descend (der Counter setzt und dabei refresht) machte sie
   * wieder sichtbar.
   */
  onAscendSetup(gs, pi, heroIdx, engine) {
    W.refreshAscensionTargets(engine, pi);
  },


  /**
   * On Ascension: "Choose up to 2 Ascended Heroes from your discard pile
   * and add them to your hand." Die Wiederaufstiegs-Munition des
   * Archetyps — abgelegte Formen kommen zurueck auf die Hand.
   */
  async onAscensionBonus(engine, pi, heroIdx) {
    await W.tutorAscendedHeroes(engine, pi, CARD_NAME, { from: 'discard', max: 2 });
  },

  // ── Hero Effect: menu over the two independent once-per-turn effects ──
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    return surgeAvailable(engine, ctx.cardOwner, ctx.cardHeroIdx)
      || W.canDescend(engine, ctx.cardOwner, ctx.cardHeroIdx);
  },

  cpuShouldUseHeroEffect(engine, pi, heroIdx) {
    // Surge ist fast immer gut (Direktschaden), Descend nur im Zyklus.
    return surgeAvailable(engine, pi, heroIdx) || W.cpuShouldDescend(engine, pi, heroIdx);
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const canSurge = surgeAvailable(engine, pi, heroIdx);
    const canDesc = W.canDescend(engine, pi, heroIdx);

    let mode = null;
    if (canSurge && canDesc) {
      const opts = [
        { id: 'surge', label: `⚡ Remove up to ${MAX_SURGE} Counters → ${SURGE_DAMAGE} damage each` },
        { id: 'descend', label: `⬇️ Descend (place ${DESCEND_GAIN} Evolution Counters)` },
      ];
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        source: CARD_NAME,
        description: 'Which effect?',
        options: opts,
        cancellable: true,
      });
      mode = choice?.optionId || null;
    } else if (canSurge) {
      mode = 'surge';
    } else if (canDesc) {
      mode = 'descend';
    }

    if (mode === 'surge') await runSurge(ctx);
    else if (mode === 'descend') await W.performWaflavDescend(engine, pi, heroIdx, DESCEND_GAIN);

    // Self-managed HOPT keys — never let the engine stamp the shared
    // `hero-effect:<name>` slot, or using one effect would lock out the
    // other for the turn.
    return W.finishSelfManagedHeroEffect(engine);
  },

  /** CPU: aim the surge at the opponent, never at our own side. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget' && kind !== 'target') return undefined;
    const { validTargets, playerIdx } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    const me = playerIdx != null ? playerIdx : engine._cpuPlayerIdx;
    if (me < 0) return undefined;
    const enemy = validTargets.filter(t => t.owner !== me);
    if (enemy.length === 0) return undefined;   // decline rather than self-burn
    let best = null, bestScore = -Infinity;
    for (const t of enemy) {
      let score;
      if (t.type === 'hero') {
        const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
        // Prefer a Hero we can actually finish off.
        score = (h?.hp || 0) <= SURGE_DAMAGE * MAX_SURGE ? 1000 - (h?.hp || 0) : (h?.atk || 0);
      } else {
        const inst = t.cardInstance;
        score = (inst?.atk || 0) * 2 + (inst?.hp || 0) / 10;
      }
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best ? [best.id] : undefined;
  },

  hooks: { ...W.gameStartHook },

  // Fighting-Lv1-Boden gegen Lern-Drift (Begruendung in _waflav-shared).
  // An JEDER Form deklariert, weil `abilityPlacementBonus` das Skript der
  // AKTUELLEN Form nachschlaegt und Abilities auch im aufgestiegenen
  // Zustand platziert werden.
  cpuAbilityPriorFloor(abilityName, targetLevel) {
    return W.waflavAbilityPriorFloor(abilityName, targetLevel);
  },

  cpuMeta: {
    // ── Ability-Prior-Identitaet (Als Vorschlag 6.8.) ────────────────
    // Alle Formen dieses Helden teilen sich EINEN Prior-Satz fuer
    // Ability-Platzierungen. Begruendung: `performAscension` fasst
    // `abilityZones` nicht an — die Abilities haengen am HELDENSLOT und
    // ueberleben jeden Auf- und Abstieg. Es gibt also gar keine
    // Entscheidung "welche Form soll Fighting bekommen", es gibt nur
    // "soll dieser Held Fighting bekommen".
    //
    // Getrennte Priors waren nicht bloss duenn, sie waren VERDREHT: der
    // Recorder stempelt `abilities` am SPIELENDE mit dem dann aktuellen
    // Formnamen. `Fighting@Flamebathed +150` (11 Beobachtungen) hiess
    // damit nicht "Fighting ist gut auf Flamebathed", sondern "Spiele,
    // die in Flamebathed-Form endeten, liefen gut" — die Endform-WR
    // reicht von 30.2% (Basis) bis 68.8% (Thunderstruck), also lud der
    // Ability-Kanal genau diese Spanne als Ability-Wert ein. Umgekehrt
    // stammte `Fighting@Waflav −60` aus 691 Beobachtungen von Spielen,
    // die in der Basisform endeten — den verlorenen.
    abilityIdentity: W.ARCHETYPE,
    // Woher bezieht DIESE Form laufend Evolution Counter?
    // Keine laufende Quelle — das ist die Auszahlform, nicht die
    // Sammelform.
    // Deckneutraler Vertrag: die Zugende-Messung liest ihn, statt
    // Formnamen zu kennen.
    counterSource: { kind: 'none' },
    counterConsumer: true,
    dealsDamage: true,
    // Der Overcharge verbraucht Zaehler, der Descend legt welche nach.
    // Nur der erste Fall ist eine Ausgabe-Entscheidung — steht der
    // Overcharge nicht zur Verfuegung, meldet der Vertrag 0 und der
    // Kanal bleibt stumm.
    //
    // Ebenfalls 0, solange ein DESCEND moeglich ist: der Held bietet
    // dann beide Zweige an, und ein "skip" aus dem Ausgabe-Kanal wuerde
    // den ganzen Helden-Effekt sperren — also auch den Abstieg, der
    // Zaehler NACHLEGT statt sie auszugeben. Genau verkehrt herum. Die
    // Frage "nuken oder wieder aufbauen" ist eine andere als "ausgeben
    // oder aufheben" und gehoert nicht in diesen Kanal.
    //
    // Bewusst NICHT gesperrt: hier ausgegebene Zaehler sind der ZWECK
    // des Archetyps, nicht sein Leck. Der Lerner sieht das ueber das
    // Tag `cs:ascended` und kann diesen Arm positiv gewichten, waehrend
    // er `cs:base` + `cs:blocks-ascend` bestraft — dieselbe Mechanik,
    // gegenlaeufige Gewichte, entschieden von den Daten.
    counterSpend: W.counterSpendContract(
      (engine, pi, heroIdx) => (
        // `cpuShouldDescendRaw` statt `cpuShouldDescend`: die Kosten-Funktion
      // wird aus KLASSIFIKATOREN heraus aufgerufen. Die gelernte Variante
      // wuerfelt Exploration und schreibt in den Descend-Lernkanal — eine
      // Messfunktion darf beides nicht. Die Vertragslage ("waere ein
      // Abstieg moeglich?") reicht hier voellig aus.
      (surgeAvailable(engine, pi, heroIdx) && !W.cpuShouldDescendRaw(engine, pi, heroIdx)) ? 1 : 0
      ),
    ),
  },
};
