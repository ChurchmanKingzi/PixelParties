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
//  ── Anzeige ──
//  Zaehler oben rechts auf der Heldenkarte (app-board.jsx, Muster der
//  anderen Heldenzaehler): `hero._pseudoniaAbsorbiert` = Liste der
//  aufgenommenen Namen, angezeigt als „n/3".
// ═══════════════════════════════════════════

const CARD_NAME = 'Pseudonia, the Skill Devourer';
const MAX_AUFNAHMEN = 3;

/** Spalte und Platz eines Heldenobjekts suchen. */
function lageVon(gs, hero) {
  for (let pi = 0; pi < 2; pi++) {
    const hi = (gs.players[pi]?.heroes || []).indexOf(hero);
    if (hi >= 0) return { pi, hi };
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
async function arbeiteVormerkungenAb(ctx) {
  const engine = ctx._engine;
  if (engine._multiHitScope) return;                 // Schlag laeuft noch
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

module.exports = {
  activeIn: ['hero'],

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
      delete selbst._pseudoniaVormerk;
      engine.sync();
    },
  },

  /** CPU: nimmt jeden angebotenen Effekt (der Preis ist nur ein Platz von drei). */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
};
