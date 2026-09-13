// ═══════════════════════════════════════════
//  CARD EFFECT: „Dangerous Knowledge"
//  Spell / NORMAL (Decay Magic + Support Magic, Lv 1, PP ART, Banned)
//
//  „Choose a Hero your opponent controls with a different name from all
//   Heroes you control (including defeated ones). The user gains that
//   Hero's effects in addition to its own for the rest of the game. A
//   Hero's effects can only be gained once per game with this effect.
//   This counts as an additional Action."
//
//  BAUART
//  ──────
//  • ★ KEINE REACTION MEHR (Als Vorgabe 12.9., UX): staendige
//    Reaktionsfenster nerven. Die Karte ist jetzt ein NORMALER Zauber
//    mit `inherentAction: true` — „This counts as an additional
//    Action" — und laeuft ueber `onPlay` statt ueber das Kettenfenster.
//    Der Subtyp in cards.json wechselte dafuer von Reaction auf Normal.
//
//  • „The user" ist der wirkende Held: bei einem normal gespielten
//    Zauber schlicht `ctx.cardHeroIdx`.
//
//  • ★ „gains that Hero's unique effect IN ADDITION to its own":
//    dieselbe Zusage wie bei Initiation Ritual, und deshalb derselbe
//    Weg — eine Instanz der fremden Heldenkarte mit
//    `counters.treatAsEquip = true` und `isActiveIn = () => true`:
//      – aktivierbare Heldeneffekte holt `getActiveHeroEffects` ueber
//        den Equip-Zweig ab,
//      – passive Hooks feuern, weil die Instanz in jeder Zone aktiv ist
//        (ohne den Override fiele ein Heldenskript mit
//        `activeIn: ['hero']` aus der Support Zone heraus — der Befund
//        vom 28.8. zu Initiation Ritual).
//    UNTERSCHIED: die Instanz bekommt KEINEN Zonenplatz
//    (`zoneSlot: -1`, und `supportZones` wird nicht angefasst). Sie
//    belegt also nichts, ist nicht anklickbar, taucht in keiner
//    Zielliste auf (jeder Sammler filtert auf Kreaturen oder laeuft
//    ueber die Zonen-Arrays) — und kann damit auch nicht zerstoert
//    werden. „For the rest of the game" heisst genau das.
//
//  • „with a different name from all Heroes you control (including
//    defeated ones)": verglichen wird ueber `baseCardName` (v876), also
//    ohne Farbvarianten-Anhaengsel. Besiegte eigene Helden zaehlen mit,
//    der Text sagt es ausdruecklich.
//
//  • „only once per game with this effect": Register am Spielerzustand
//    (`ps._dangerousKnowledgeGained`). Je Spieler eigenes Register —
//    „this effect" ist der Effekt DIESES Spielers.
//
//  • Ein Held ohne eigenes Skript hat nichts zu verschenken und wird
//    gar nicht erst angeboten.
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Dangerous Knowledge';

/** Namen aller eigenen Helden — besiegte eingeschlossen. */
function eigeneHeldennamen(engine, pi) {
  const ps = engine.gs.players[pi];
  const raus = new Set();
  for (const h of (ps?.heroes || [])) {
    if (h?.name) raus.add(baseCardName(h.name));
  }
  return raus;
}

/** Hat dieser Held ueberhaupt einen Effekt zu verschenken? */
function hatEffekt(name) {
  const script = loadCardEffect(name);
  if (!script) return false;
  return !!script.heroEffect || !!script.hooks;
}

/** Waehlbare Gegnerhelden. */
function kandidaten(engine, pi) {
  const oi = pi === 0 ? 1 : 0;
  const ops = engine.gs.players[oi];
  const eigene = eigeneHeldennamen(engine, pi);
  const schon = engine.gs.players[pi]?._dangerousKnowledgeGained;
  const out = [];
  for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
    const hero = ops.heroes[hi];
    if (!hero?.name) continue;
    const basis = baseCardName(hero.name);
    if (eigene.has(basis)) continue;                       // „different name"
    if (schon?.has(basis)) continue;                       // einmal je Partie
    if (!hatEffekt(hero.name)) continue;
    out.push({ id: `hero-${oi}-${hi}`, type: 'hero', owner: oi, heroIdx: hi, cardName: hero.name });
  }
  return out;
}

module.exports = {
  requiresTarget: true,

  // Ohne waehlbaren Gegnerhelden ist die Karte gar nicht erst spielbar
  // (der Client graut sie aus) — besser als ein Zauber, der ins Leere
  // laeuft und sich selbst abbrechen muss.
  spellPlayCondition: (gs, pi, engine) => (engine ? kandidaten(engine, pi).length > 0 : true),
  // ^ Tor fuer Blinded — siehe `_hooks.js`.

  // „This counts as an additional Action." — die Karte verbraucht die
  // Zug-Aktion nicht (Vorbild: Aligning Goals).
  inherentAction: true,

  // Der Ziel-Prompt ist abbrechbar; ohne Antwort bricht die Engine ihn
  // fuer die CPU pauschal ab (Befund v828). Genommen wird der erste
  // Kandidat — eine feinere Bewertung fremder Heldeneffekte gibt es
  // nicht, und jeder Zugewinn ist einer.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const quelle = promptData?.config?.title;
    if (quelle !== CARD_NAME) return undefined;
    const erste = (promptData?.validTargets || [])[0];
    return erste ? [erste.id] : undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return false;

      // „The user" — der wirkende Held.
      const heroIdx = ctx.cardHeroIdx;
      const user = heroIdx >= 0 ? ps.heroes?.[heroIdx] : null;
      if (!user?.name || user.hp <= 0) { gs._spellCancelled = true; return false; }

      const ziele = kandidaten(engine, pi);
      if (ziele.length === 0) { gs._spellCancelled = true; return false; }

      let ziel = ziele[0];
      if (ziele.length > 1) {
        const pick = await engine.promptEffectTarget(pi, ziele, {
          title: CARD_NAME,
          description: `${user.name} permanently gains the chosen Hero's effects in addition to its own.`,
          confirmLabel: '📖 Learn it!',
          confirmClass: 'btn-info',
          cancellable: true,
          exclusiveTypes: true,
          maxPerType: { hero: 1 },
          maxTotal: 1,
        });
        // ★ ABBRUCH EINES ZAUBERS: `gs._spellCancelled` SETZEN (v981,
        // Als Befund 12.9. — dieselbe Fehlerklasse wie beim Difficulty
        // Lever). Nur dieses Flag laesst den Spielweg die Karte auf die
        // Hand zuruecklegen; ohne es gilt der Zauber als aufgeloest und
        // wandert in die Ablage. Die ctx-Helfer (`promptDamageTarget`,
        // `promptMultiTarget`) setzen es selbst — wer den ROHEN
        // `promptEffectTarget` oder `promptGeneric` benutzt, muss es
        // von Hand tun.
        if (!pick || pick.length === 0) { gs._spellCancelled = true; return false; }
        ziel = ziele.find(t => t.id === pick[0]);
        if (!ziel) { gs._spellCancelled = true; return false; }
      }

      // ── Das Wissen anhaengen ────────────────────────────────────────
      // Instanz OHNE Zonenplatz: sie belegt nichts, ist unsichtbar und
      // unzerstoerbar — aber `getActiveHeroEffects` (Equip-Zweig) und der
      // Hook-Verteiler finden sie.
      const wissen = engine._trackCard(ziel.cardName, pi, 'support', heroIdx, -1);
      wissen.counters = wissen.counters || {};
      wissen.counters.treatAsEquip = true;
      wissen.counters._gainedEffectOnly = true;
      wissen.isActiveIn = () => true;

      if (!ps._dangerousKnowledgeGained) ps._dangerousKnowledgeGained = new Set();
      ps._dangerousKnowledgeGained.add(baseCardName(ziel.cardName));

      // ★ SICHTBAR MACHEN (v981, Als Vorgabe 12.9.): die Wissens-Instanz
      // liegt ohne Zonenplatz und ist auf dem Brett unsichtbar — der
      // Tooltip des Helden muss deshalb sagen, wessen Effekte er
      // mittraegt. Die Liste haengt am HELDEN und wird mitsynchronisiert;
      // der Client zeigt die Namen ganz oben und die vollen Texte im
      // vorhandenen „Inherited Effects"-Block.
      if (!Array.isArray(user.gainedEffectNames)) user.gainedEffectNames = [];
      if (!user.gainedEffectNames.includes(ziel.cardName)) user.gainedEffectNames.push(ziel.cardName);

      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1,
      });
      engine.log('dangerous_knowledge', {
        player: ps.username, hero: user.name, learned: ziel.cardName,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: wissen, toZone: 'support', toHeroIdx: heroIdx,
        _skipReactionCheck: true,
      });
      engine.sync();
      return true;
    },
  },
};
