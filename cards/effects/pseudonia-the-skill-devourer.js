// ═══════════════════════════════════════════
//  CARD EFFECT: "Pseudonia, the Skill Devourer"
//  Hero (400 HP, 80 ATK, Cannibalism + Charme) — PP MBS1
//  ★ v1275: GANZ NEUER EFFEKT (Als Auftrag 22.9.)
//
//  "Up to three times, when another Hero is defeated: You may have this
//   Hero permanently gain that Hero's effects. This Hero can only gain
//   each Hero's effects once per game."
//
//  ── ALS RULINGS 22.9. (bindend) ──
//  • „another Hero" = eigene wie gegnerische Helden. „may" → Frage; nur
//    angenommene Aufnahmen zaehlen gegen die drei.
//  • „that Hero's effects" = der GEDRUCKTE Effekt der Karte (keine
//    Abilities, keine Effekte, die jener Held selbst gewonnen hatte).
//    Auch Ascended Heroes geben ihren Effekt. Welcher Name das ist,
//    entscheidet EINE Stelle: `engine.heroEffectIdentity(pi, hi)` —
//      – ein verwandelter „???, the Shapeshifter" gibt NUR seinen
//        eigenen Effekt, nicht den der Gestalt,
//      – ein per eigenem Effekt aufgestiegener „???, the Throne Robber"
//        gibt NUR den Throne-Robber-Effekt.
//  • Pseudonia muss beim Tod des anderen Helden LEBEN und darf nicht
//    stummgeschaltet sein (Frozen, Stunned, Negated …). Sterben sie und
//    andere Helden im SELBEN Flaechentreffer, nimmt sie nichts auf —
//    darum wird eine Aufnahme waehrend eines Flaechentreffers
//    (`engine._multiHitScope`) nur VORGEMERKT und erst nach dem Schlag
//    entschieden; faellt Pseudonia im selben Schlag, verfaellt sie.
//  • „permanently": die Effekte bleiben ueber Tod und Wiederbelebung
//    erhalten, der Dreier-Zaehler ebenso. (Dafuer raeumt die Engine die
//    unsichtbaren Traeger gewonnener Effekte beim Heldentod seit v1275
//    nicht mehr ab.)
//  • Verwandelt sich ??? in Pseudonia und nimmt etwas auf, VERLIERT er
//    es zusammen mit der Gestalt, sobald er sich zurueckverwandelt
//    (`hooks.onIdentityLost`, laeuft vor der Rueckbenennung).
//  • Einmal-pro-Zug-Effekte der aufgenommenen Helden teilen sich ihren
//    Ausloeser mit dem Original auf derselben Seite (pro SPIELER, nicht
//    spielerübergreifend) — `engine.heroHoptKey` / `_hero-hopt-shared.js`.
//
//  ── CPU-Deck-Regel (Al) ──
//  „Kopiere mit Pseudonia IMMER deine eigenen zwei Heroes, falls diese
//  sterben, und EINEN Gegner-Hero im Verlauf des Spiels; welchen, soll von
//  der im Laufe des Spiels gesehenen Wertigkeit seines Effekts abhaengen."
//  Umgesetzt in `cpuResponse` (unten) auf die Aufnahme-Frage:
//    • eigener Held gefallen → IMMER aufnehmen,
//    • Gegner-Held gefallen  → hoechstens EINER pro Partie. Die CPU kann
//      nicht waehlen, nur nehmen oder warten: sie nimmt den Gefallenen,
//      wenn kein noch lebender Gegner-Held einen klar hoeheren Effektwert
//      hat (`_hero-effect-seen-shared.seenValue`, Schwelle 0,8), sonst
//      wartet sie auf einen besseren.
//
//  ── Anzeige ──
//  Zaehler oben rechts auf der Heldenkarte (app-board.jsx, Muster der
//  anderen Heldenzaehler): `hero._pseudoniaAbsorbiert` = Liste der
//  aufgenommenen Namen, angezeigt als „n/3".
// ═══════════════════════════════════════════

const CARD_NAME = 'Pseudonia, the Skill Devourer';
const MAX_AUFNAHMEN = 3;

// CPU-Regel: so viele GEGNER-Helden darf die CPU in einer Partie aufnehmen
// (die uebrigen Plaetze gehoeren den eigenen Helden), und ab welchem Anteil
// des besten noch lebenden Gegner-Effekts sie nicht mehr auf einen besseren
// wartet. Vorgaben; die Schwelle ersetzt das Profil unter
// `ruleParams["pseudonia.warteSchwelle"]`.
const MAX_GEGNER_AUFNAHMEN = 1;
const WARTE_SCHWELLE = 0.8;

/**
 * Spalte und Platz eines Heldenobjekts suchen.
 *
 * ★ v1286: mit Rueckfall auf `gs._heroKOContext` (die Engine setzt ihn
 * um den ON_HERO_KO-Hook herum und nennt darin `heroOwner`). Wird der
 * Held waehrend der Todeskette ersetzt oder aus der Reihe genommen —
 * etwa durch eine sofortige Wiederbelebung (Elixir of Immortality) —,
 * findet die Objektsuche ihn nicht mehr und die Aufnahme verpuffte
 * lautlos. Der Name kommt dann aus dem Kontext, die Lage aus dem
 * Besitzer plus Namensvergleich.
 */
function lageVon(gs, hero) {
  for (let pi = 0; pi < gs.players.length; pi++) {
    const hi = (gs.players[pi]?.heroes || []).indexOf(hero);
    if (hi >= 0) return { pi, hi };
  }
  const ctxTod = gs._heroKOContext;
  if (ctxTod?.hero === hero && ctxTod.heroOwner >= 0) {
    const reihe = gs.players[ctxTod.heroOwner]?.heroes || [];
    const hi = reihe.findIndex(h => h && h.name === hero?.name);
    if (hi >= 0) return { pi: ctxTod.heroOwner, hi };
  }
  return null;
}

/** Ist Pseudonia an (spalte, hi) gerade aufnahmefaehig? */
function bereit(engine, spalte, hi) {
  const selbst = engine.gs.players[spalte]?.heroes?.[hi];
  if (!selbst?.name || selbst.hp <= 0) return false;
  // (Bewusst KEINE Namenspruefung: hat ein anderer Held Pseudonias Effekt
  //  gewonnen, laufen diese Hooks ueber seinen Traeger — dann ist ER es,
  //  der aufnimmt. Legt ??? die Gestalt ab, laufen sie gar nicht mehr.)
  if (engine._isHeroEffectSilenced(spalte, hi)) return false;  // Frozen/Stunned/Negated …
  return (selbst._pseudoniaAbsorbiert || []).length < MAX_AUFNAHMEN;
}

/** Darf dieser Name (noch) aufgenommen werden? */
function aufnehmbar(selbst, name) {
  if (!name) return false;
  if ((selbst._pseudoniaAbsorbiert || []).includes(name)) return false;   // je Held einmal pro Partie
  if (name === selbst.name || name === selbst._shapeshiftBase) return false;
  if ((selbst.gainedEffectNames || []).includes(name)) return false;
  return true;
}

/** Die eigentliche Aufnahme: Frage, Strahl, Effekt, Zaehler. */
async function verschlinge(engine, spalte, hi, fragender, eintrag) {
  const gs = engine.gs;
  if (!bereit(engine, spalte, hi)) return false;
  const selbst = gs.players[spalte].heroes[hi];
  if (!aufnehmbar(selbst, eintrag.name)) return false;
  const genutzt = (selbst._pseudoniaAbsorbiert || []).length;

  const antwort = await engine.promptGeneric(fragender, {
    type: 'confirm',
    title: CARD_NAME,
    message: `${eintrag.heldName} was defeated. Devour its effects permanently? (${genutzt}/${MAX_AUFNAHMEN} used)`,
    showCard: eintrag.name,
    showCardLeft: CARD_NAME,
    confirmLabel: '🦷 Devour!',
    cancelLabel: 'No',
    cancellable: true,
    // Kontext fuer die CPU-Entscheidung (`cpuResponse`); der Client ignoriert ihn.
    devour: { effect: eintrag.name, deadPi: eintrag.pi, deadHi: eintrag.hi, spalte, hi, fragender },
  });
  if (!engine._confirmSaidYes(antwort)) return false;
  if (!bereit(engine, spalte, hi) || !aufnehmbar(selbst, eintrag.name)) return false;

  // Violetter Strahl vom Besiegten zu Pseudonia, dunkles Ritual am Ziel.
  if (eintrag.pi != null && eintrag.hi != null) {
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: eintrag.pi, sourceHeroIdx: eintrag.hi, sourceZoneSlot: -1,
      targetOwner: spalte, targetHeroIdx: hi, targetZoneSlot: -1,
      color: '#d9a6ff', glow: '#8a2be2',
      thickness: 1.1, duration: 700,
      impactAnim: 'dark_ritual', impactOpacity: 0.9,
    });
    await engine._delay(760);
  }

  const traeger = engine.grantHeroEffect(spalte, hi, eintrag.name);
  if (!traeger) return false;
  selbst._pseudoniaAbsorbiert = [...(selbst._pseudoniaAbsorbiert || []), eintrag.name];
  // Wie viele davon stammen von GEGNER-Helden? (CPU-Regel: hoechstens einer)
  if (eintrag.pi != null && eintrag.pi !== spalte) {
    selbst._pseudoniaFremd = [...(selbst._pseudoniaFremd || []), eintrag.name];
  }
  await engine.finishGainedHeroEffects(spalte, hi);

  engine.log('pseudonia_devour', {
    player: gs.players[spalte]?.username,
    gained: eintrag.name, from: eintrag.heldName,
    count: selbst._pseudoniaAbsorbiert.length, max: MAX_AUFNAHMEN,
  });
  engine.sync();
  return true;
}

/** Vorgemerkte Aufnahmen nach einem Flaechentreffer abarbeiten. */
async function arbeiteVormerkungenAb(ctx, opts = {}) {
  const engine = ctx._engine;
  // Waehrend eines Schlags wird normalerweise gewartet (sie selbst koennte
  // im selben Schlag fallen). Ausnahme v1288: eine Wiederbelebung steht
  // unmittelbar bevor — dann muss jetzt entschieden werden.
  if (engine._multiHitScope && !opts.auchImSchlag) return;
  const spalte = ctx.cardOriginalOwner;
  const hi = ctx.cardHeroIdx;
  const selbst = engine.gs.players[spalte]?.heroes?.[hi];
  const offen = selbst?._pseudoniaVormerk;
  if (!Array.isArray(offen) || offen.length === 0) return;
  delete selbst._pseudoniaVormerk;
  for (const eintrag of offen) {
    await verschlinge(engine, spalte, hi, ctx.cardOwner, eintrag);
  }
}

/**
 * Soll die CPU den Effekt des gefallenen Helden aufnehmen?
 * `d` = der Kontext aus `verschlinge` ({ effect, deadPi, deadHi, spalte, hi, fragender }).
 */
function cpuSollAufnehmen(engine, d) {
  const selbst = engine.gs.players[d.spalte]?.heroes?.[d.hi];
  if (!selbst) return true;
  // Eigener Held: IMMER (er stirbt hoechstens einmal je Effekt, `aufnehmbar` sperrt Doppelte).
  if (d.deadPi == null || d.deadPi === d.spalte) return true;
  // Gegner-Held: der eine Gegner-Platz.
  if ((selbst._pseudoniaFremd || []).length >= MAX_GEGNER_AUFNAHMEN) return false;
  // Lebt noch ein Gegner-Held mit klar hoeherem Effektwert? Dann auf ihn warten —
  // sonst ist dieser der Beste (oder gleichauf) bzw. der letzte seiner Seite.
  const seen = require('./_hero-effect-seen-shared');
  const mein = seen.seenValue(engine, d.fragender, d.effect);
  let bester = -Infinity;
  for (let p = 0; p < engine.gs.players.length; p++) {
    if (p === d.spalte) continue;
    (engine.gs.players[p]?.heroes || []).forEach((h, hi) => {
      if (!h?.name || h.hp <= 0) return;
      if (p === d.deadPi && hi === d.deadHi) return;           // der Gefallene selbst
      const name = engine.heroEffectIdentity(p, hi);
      if (!name || (selbst._pseudoniaAbsorbiert || []).includes(name)) return;
      bester = Math.max(bester, seen.seenValue(engine, d.fragender, name));
    });
  }
  if (!(bester > mein)) return true;
  let schwelle = WARTE_SCHWELLE;
  try { schwelle = require('./_deck-profile').ruleParam(engine, d.fragender, 'pseudonia.warteSchwelle', WARTE_SCHWELLE); }
  catch { /* Profil optional */ }
  return mein >= schwelle * bester;     // fast so gut wie der Beste: lieber den Spatz in der Hand
}

module.exports = {
  activeIn: ['hero'],

  /**
   * ★ v1288 (Als Vorgabe 22.9.: „Pseudonias Effekt soll vor JEDEM
   * Revival-Effekt passieren"). Im Todesfenster und in allen Fenstern,
   * in denen sie Vormerkungen einloest, laeuft sie VOR den anderen
   * Zuhoerern — auch vor einem Elixir, das im selben Fenster
   * wiederbelebt. Fuer Wiederbelebungen, die ausserhalb dieser Fenster
   * kommen, gibt es `beforeHeroRevive` (unten).
   */
  hookPriority: {
    onHeroKO: 100, beforeHeroRevive: 100,
    afterSpellResolved: 100, onAnyActionResolved: 100, afterCreatureEffect: 100,
    afterAllStatusDamage: 100, onPhaseEnd: 100, onTurnEnd: 100, onTurnStart: 100,
  },

  hooks: {
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const spalte = ctx.cardOriginalOwner;
      const hi = ctx.cardHeroIdx;
      const selbst = gs.players[spalte]?.heroes?.[hi];
      const tot = ctx.hero;
      if (!selbst || !tot) return;

      // Pseudonia selbst faellt: was im selben Schlag vorgemerkt war,
      // verfaellt (Ruling: gleichzeitiger Tod → keine Aufnahme).
      if (tot === selbst) { delete selbst._pseudoniaVormerk; return; }

      const lage = lageVon(gs, tot);
      if (!lage) return;
      const name = engine.heroEffectIdentity(lage.pi, lage.hi);
      const eintrag = { name, heldName: tot.name, pi: lage.pi, hi: lage.hi };

      if (engine._multiHitScope) {
        // Waehrend eines Flaechentreffers nur vormerken — entschieden wird
        // nach dem Schlag, wenn feststeht, ob Pseudonia ihn ueberlebt hat.
        if (!selbst?.name || selbst.hp <= 0) return;
        selbst._pseudoniaVormerk = [...(selbst._pseudoniaVormerk || []), eintrag];
        return;
      }
      await verschlinge(engine, spalte, hi, ctx.cardOwner, eintrag);
    },

    // Nach dem Schlag: an den ueblichen Nachlauf-Punkten abarbeiten.
    afterSpellResolved: arbeiteVormerkungenAb,
    onAnyActionResolved: arbeiteVormerkungenAb,
    afterCreatureEffect: arbeiteVormerkungenAb,
    onTurnEnd: arbeiteVormerkungenAb,
    onTurnStart: arbeiteVormerkungenAb,
    // v1288: dieselben Einloesepunkte, an denen das Elixir wiederbelebt —
    // mit der Prioritaet oben ist sie dort immer zuerst dran.
    afterAllStatusDamage: arbeiteVormerkungenAb,
    onPhaseEnd: arbeiteVormerkungenAb,
    /**
     * ★ v1288: unmittelbar vor JEDER Wiederbelebung (Held noch tot).
     * Steht fuer den Helden eine Vormerkung aus, wird sie JETZT
     * entschieden — sonst kaeme die Wiederbelebung zuerst. Auch mitten
     * in einem Schlag: wer jetzt zurueckgeholt wird, war besiegt.
     */
    beforeHeroRevive: async (ctx) => {
      await arbeiteVormerkungenAb(ctx, { auchImSchlag: true });
    },

    // ??? (the Shapeshifter) legt die Pseudonia-Gestalt ab: alles, was er
    // in ihr aufgenommen hat, geht mit (Ruling 22.9.). Die echte Pseudonia
    // verliert ihre Identitaet nie — fuer sie ist die Aufnahme dauerhaft.
    onIdentityLost: async (ctx) => {
      const engine = ctx._engine;
      const spalte = ctx.card?.owner ?? ctx.cardOriginalOwner;
      const hi = ctx.card?.heroIdx ?? ctx.cardHeroIdx;
      const selbst = engine.gs.players[spalte]?.heroes?.[hi];
      if (!selbst) return;
      for (const name of (selbst._pseudoniaAbsorbiert || [])) {
        await engine.revokeHeroEffect(spalte, hi, name, 'pseudoniaFormLost');
      }
      delete selbst._pseudoniaAbsorbiert;
      delete selbst._pseudoniaFremd;
      delete selbst._pseudoniaVormerk;
      engine.sync();
    },
  },

  /**
   * CPU-Deck-Regel (siehe Kopf): eigene Helden IMMER, vom Gegner genau
   * einen — den, dessen Effekt (gesehene Nutzung) am meisten wert ist.
   * Ohne Kontext im Prompt (Alt-Aufrufer) gilt wie frueher: alles nehmen.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    const d = promptData.devour;
    if (!d) return { confirmed: true };
    return { confirmed: cpuSollAufnehmen(engine, d) };
  },
};
