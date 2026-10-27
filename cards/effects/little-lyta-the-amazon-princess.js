'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Little Lyta, the Amazon Princess"  (W79)
//  Hero (300 HP, 100 ATK, Charme + Diplomacy)
//
//  „At the beginning of the game, choose a Hero your opponent controls. At the start of each of your turns, while you control this undefeated Hero, you may take control of that
//   Hero OR any Creature your opponent controls for the duration of the turn. A Hero controlled by this effect takes no damage from any sources. These effects cannot be negated."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Spielstart (`onGameStart`): der Kontrolleur wählt einen Helden des Gegners (Pflichtwahl; Erst-Zug-Schutz und Schutzmarken gelten dafür nicht — es wird nur „gemerkt", nichts
//    getroffen). Gemerkt wird der Platz (`hero._lytaZiel = { owner, heroIdx }`): der Held bleibt „that Hero", auch wenn er sich verwandelt. Kommt Lyta erst später ins Spiel (True Form,
//    Pseudonia), gibt es keine Wahl — dann bleibt nur der Kreaturen-Teil.
//  • Zugstart (`onTurnStart`, nur eigene Züge): solange der Spieler Lyta kontrolliert und sie nicht besiegt ist, darf er (abbrechbar) EINES der Ziele übernehmen: den gemerkten Helden
//    (falls er lebt und nicht schon übernommen ist) ODER eine beliebige Kreatur (Token mit Kreatur-Untertyp eingeschlossen), die sein Gegner kontrolliert — für die Dauer des Zuges.
//  • Kreaturen bleiben in ihren Zonen (nur der Kontrolleur wechselt, Rückgabe zu Beginn des nächsten Zuges); sie sind NICHT unantastbar (der Text nennt nur den Helden).
//  • Der übernommene Held nimmt für die Dauer der Kontrolle KEINEN Schaden aus irgendeiner Quelle und kann nicht besiegt werden - auch nicht
//    durch ein Opfer (`statuses.charmed.nurSchadenSchutz`, wie Deepsea Succubus; `engine.heldNichtBesiegbar`); negative Status kommen durch. Die Immunität endet mit der Kontrolle (Rückgabe am Zugwechsel).
//  • „These effects cannot be negated": `bypassStatusFilter` — Lyta wirkt auch frozen/stunned/negated; besiegt ruht sie (Text: „undefeated").
//  • Boris, the Guardian of Blackport: der Zugstart-Effekt läuft ins Leere (kein Angebot).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `pink_hearts` (ANIM_REGISTRY, Pixelart): lauter pinke Herzchen steigen um das Ziel auf, dann geht die Kontrolle über.
// ═══════════════════════════════════════════

const { ziele, uebernehmen, borisBlockt } = require('./_temp-control-shared');

const CARD_NAME = 'Little Lyta, the Amazon Princess';
const HERZ_MS = 1500;

/** Lyta lebt und gehört (aktuell) dem Spieler `pi`? */
function aktiv(engine, ctx, pi) {
  const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
  const hero = ctx.attachedHero || engine.gs.players[feld]?.heroes?.[ctx.cardHeroIdx];
  if (!hero?.name || hero.hp <= 0) return null;
  if (engine.heroSideOf(feld, hero) !== pi) return null;
  return { hero, feld };
}

module.exports = {
  activeIn: ['hero'],
  bypassStatusFilter: true,        // „These effects cannot be negated"

  /** CPU: Spielstart-Wahl = Gegnerheld mit dem höchsten Angriff; Zugstart: der Held, sonst die stärkste Kreatur. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = payload || {};
    if (!Array.isArray(validTargets) || config?.title !== CARD_NAME) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return undefined;
    const wert = (t) => {
      if (t.type === 'hero') return 1000 + (engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.atk || 0);
      const cd = t.cardInstance ? (engine.getEffectiveCardData(t.cardInstance) || {}) : {};
      return (cd.level || 0) * 50 + (cd.hp || 0) / 10;
    };
    frei.sort((a, b) => wert(b) - wert(a));
    return [frei[0].id];
  },

  hooks: {
    /** „At the beginning of the game, choose a Hero your opponent controls." */
    onGameStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const a = aktiv(engine, ctx, pi);
      if (!a) return;
      const oi = engine.opponentOf(pi);
      const liste = engine.getControlledHeroTargets(oi).filter(t => (gs.players[t.owner]?.heroes?.[t.heroIdx]?.hp || 0) > 0);
      if (liste.length === 0) return;
      let ziel = liste[0];
      if (liste.length > 1) {
        const wahl = await engine.promptEffectTarget(pi, liste, {
          title: CARD_NAME, source: CARD_NAME,
          description: 'Choose a Hero your opponent controls. At the start of each of your turns you may take control of it for the turn.',
          confirmLabel: '💗 This one!', confirmClass: 'btn-success', greenSelect: true,
          maxTotal: 1, maxSelect: 1, exclusiveTypes: true, maxPerType: { hero: 1 },
          cancellable: false,                                          // Pflichtwahl
          ignoreUntargetable: true, ignoreFirstTurnProtection: true,   // es wird nur gemerkt, nichts getroffen
          _skipRedirectCheck: true, _skipSurpriseCheck: true, _skipPostTargetReactions: true,
        });
        const id = Array.isArray(wahl) ? wahl[0] : wahl;
        ziel = (id && liste.find(t => t.id === id)) || liste[0];
      }
      a.hero._lytaZiel = { owner: ziel.owner, heroIdx: ziel.heroIdx };
      engine.log('lyta_choice', { player: gs.players[pi]?.username, target: ziel.cardName });
      engine.sync();
    },

    /** „At the start of each of your turns, … you may take control of that Hero OR any Creature your opponent controls for the duration of the turn." */
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs.result || gs._endGameLaeuft) return;
      const pi = gs.activePlayer;
      const a = aktiv(engine, ctx, pi);
      if (!a) return;                                                  // nur eigene Züge, solange kontrolliert und unbesiegt
      if (borisBlockt(engine, pi)) return;

      const gemerkt = a.hero._lytaZiel || null;
      const liste = [
        ...(gemerkt ? ziele(engine, pi, { helden: true, kreaturen: false, nurHeld: gemerkt }) : []),
        ...ziele(engine, pi, { helden: false, kreaturen: true }),
      ];
      if (liste.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `${CARD_NAME}#${a.hero.name}@${gs.turn}`, sfx: 'ability_activate' });
      const wahl = await engine.promptEffectTarget(pi, liste, {
        title: CARD_NAME, source: CARD_NAME,
        description: 'You may take control of the chosen Hero OR any Creature your opponent controls for the duration of the turn.',
        confirmLabel: '💗 Take Control!', confirmClass: 'btn-success', greenSelect: true,
        maxTotal: 1, maxSelect: 1, exclusiveTypes: false, maxPerType: { hero: 1, equip: 1 },
        cancellable: true,                                             // „may"
        ignoreUntargetable: true,                                      // „These effects cannot be negated" / der Held ist vorgemerkt, nicht anvisiert
      });
      const id = Array.isArray(wahl) ? wahl[0] : wahl;
      const ziel = id && liste.find(t => t.id === id);
      if (!ziel) return;

      const erg = await uebernehmen(engine, pi, ziel, {
        sourceName: CARD_NAME, heroMarker: 'nurSchadenSchutz', kreaturImmun: false,
        anim: 'pink_hearts', animMs: HERZ_MS, trefferMs: Math.round(HERZ_MS * 0.6),
      });
      engine.log(erg.ok ? 'lyta_control' : 'lyta_fizzle', { player: gs.players[pi]?.username, target: ziel.cardName });
      engine.sync();
    },
  },
};
