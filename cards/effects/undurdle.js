// ═══════════════════════════════════════════
//  CARD EFFECT: "Undurdle"
//  Creature (Summoning Magic Lv1, Normal, 50 HP) — PP MSRU
//
//  „When this Creature is defeated, you may choose a level 1/2/3 or
//   lower Creature from your discard pile, except "Undurdle", and place
//   it into the Support Zone this Creature occupied."
//
//  ── AUSLEGUNG (Ruling-Vorschlag) ────────────────────────────────────
//  • „level 1/2/3": Staffel nach dem Summoning-Magic-Level des
//    ENTSPRECHENDEN Helden (Held der Zone, die Undurdle belegte) —
//    Summoning Magic 1 → Lv ≤ 1, 2 → Lv ≤ 2, 3 → Lv ≤ 3. Gleiche
//    Staffelschreibweise wie Soul Shard Ka („level 0/1/2") dort.
//    Performance-Kopien zählen (Engine-Zähler `countAbilitiesForSchool`).
//  • „place": PLATZIEREN, nicht Beschwören — keine Schul-/Level-Prüfung
//    des Helden, keine Aktion, Effekte nicht negiert. Als Ruling 25.9.
//    gilt Platzieren aus der Ablage trotzdem als „summoned from the
//    discard pile" (`summonFromDiscard`, Modus 'place').
//  • Kandidaten: NUR echte Creatures (kein Artifact-Creature — Regel für
//    alles, was aus der Ablage aufs Feld kommt), Level nach
//    `effectiveCardLevel`, Sperre `darfAusAblageAufsFeld`, eigene
//    `canSummon`-Bedingungen der Karte, Name ≠ „Undurdle".
//  • Der frei gewordene Platz muss noch frei sein; der Held darf auch
//    tot sein (Platzieren ist erlaubt, Muster der Cycling Demons).
//  • „you may": die Galerie ist abbrechbar — Abbrechen = Verzicht.
//
//  ── ANIMATION (Als Vorgabe 29.9.) ───────────────────────────────────
//  Wie Necromancy: `necromancy_summon` (Schädel-Ausbruch, Klang
//  `elem_dark`) auf dem Platz, danach landet die Karte. Der Modus
//  'place' von `summonFromDiscard` kennt kein `vorAnim`, deshalb
//  sendet die Karte den Broadcast selbst.
// ═══════════════════════════════════════════

const CARD_NAME = 'Undurdle';

/** Level-Deckel: Summoning-Magic-Level des Helden an dem Platz. */
function levelDeckel(engine, feld, heroIdx) {
  const ab = engine.gs.players[feld]?.abilityZones?.[heroIdx] || [];
  return engine.countAbilitiesForSchool('Summoning Magic', ab);
}

/** Wiederbelebbare Kreaturen aus der eigenen Ablage. */
function kandidaten(engine, pi, feld, heroIdx, deckel) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const name of (ps?.discardPile || [])) {
    if (name === CARD_NAME || gesehen.has(name)) continue;
    if (!engine.darfAusAblageAufsFeld(name)) continue;
    const cd = db[name];
    if (!cd || cd.cardType !== 'Creature') continue;
    if (engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' }) > deckel) continue;
    if (!engine.isCreatureSummonable(name, feld, heroIdx, { _bypassBeforeSummon: true, beschwoerer: pi })) continue;
    gesehen.add(name);
    out.push({ name, source: 'discard' });
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  // Der Tod erwischt oft Undurdle UND seinen Helden im selben Schlag.
  bypassDeadHeroFilter: true,

  // CPU: eine kostenlose Wiederbelebung — Bestaetigungen immer bejahen.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME || death.instId !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = death.controller ?? death.owner ?? ctx.cardOwner;   // wer die Kreatur kontrollierte
      const ps = gs.players[pi];
      if (!ps || ps.summonLocked) return;
      const feld = engine.physicalSide(ctx.card);                    // Brettseite der Zone
      const hi = death.heroIdx, slot = death.zoneSlot;
      const zoneFrei = () => ((gs.players[feld]?.supportZones?.[hi] || [])[slot] || []).length === 0;
      if (!zoneFrei()) return;

      const deckel = levelDeckel(engine, feld, hi);
      const liste = kandidaten(engine, pi, feld, hi, deckel);
      if (liste.length === 0) return;

      const gewaehlt = await ctx.promptCardGallery(liste, {
        title: CARD_NAME,
        description: `Undurdle was defeated. Choose a Lv ${deckel} or lower Creature from your discard pile to place into its Support Zone.`,
        cancellable: true,
      });
      if (!gewaehlt?.cardName) return;
      const name = gewaehlt.cardName;
      // Nach der Wahl neu pruefen — waehrend der Abfrage kann sich das Brett aendern.
      if (!zoneFrei() || !(ps.discardPile || []).includes(name)) return;

      // Ab hier gibt es kein Zurueck: Auftritt, dann die Necromancy-Animation.
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `undurdle:${death.instId}` });
      engine._broadcastEvent('play_zone_animation', {
        type: 'necromancy_summon', owner: feld, heroIdx: hi, zoneSlot: slot,
      });
      await engine._delay(800);

      const res = await engine.summonFromDiscard(pi, pi, name, hi, slot, {
        mode: 'place', source: CARD_NAME,
        ...(feld !== pi ? { heldSeite: feld } : {}),
      });
      engine.log('undurdle_place', {
        player: ps.username, placed: name, placedOk: !!res?.inst, cap: deckel,
      });
      engine.sync();
    },
  },
};
