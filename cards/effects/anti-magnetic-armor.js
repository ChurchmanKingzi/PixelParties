// ═══════════════════════════════════════════
//  CARD EFFECT: "Anti-Magnetic Armor"
//  Artifact (Equipment, Cost 8) — PP MSRU
//
//  „Once per turn, when the equipped Hero is chosen by an opponent's
//   card or effect, you may make your opponent choose a different target
//   you control instead."
//
//  ── AUSLEGUNG (Ruling-Vorschlag, im Gespraech bestaetigt) ───────────
//  • AUSLOESER: der ausgeruestete HELD wird gewaehlt (nicht seine
//    Kreaturen), und zwar von einer Karte/einem Effekt des GEGNERS.
//    „card or effect" ist bewusst weit gefasst — anders als Anti-Magnet
//    und Empty Armor, die auf Attack/Spell/Creature-Effekt beschraenkt
//    sind, zaehlen hier auch Heldeneffekte, Artefakte, Traenke, Abilities.
//  • ERSATZZIEL: der GEGNER waehlt unter den ANDEREN gueltigen Zielen
//    des Effekts, die ICH kontrolliere (Helden, Kreaturen, Ausruestung —
//    was der Effekt eben treffen darf). Gibt es keins, ist die Ruestung
//    nicht nutzbar (kein Leerlauf-Angebot).
//  • „you may": Rueckfrage (Engine-Standard des Brett-Waechters).
//  • „Once per turn": WEICH, je Instanz (Regel: nacktes „once per turn"
//    ohne „hard"). Verbraucht wird die Nutzung erst, wenn wirklich
//    umgeleitet wird.
//  • Wie alle Ziel-Umleitungen: nur Einzelzielwahl; Flaechenschaden
//    waehlt nicht und loest nichts aus.
//
//  ── MECHANIK ────────────────────────────────────────────────────────
//  `isBoardRedirect` (Brett-Waechter, `_checkTargetRedirectOnce`): die
//  Engine fragt, ruft `onBoardRedirect`, loggt und rekursiert auf das
//  neue Ziel (die Einmal-Sperre verhindert Endlosketten).
//  Ausruestung wird ueber den Kartentyp in `doPlayArtifact` angelegt —
//  `isEquip: true` meldet das Skript dem Loader an.
// ═══════════════════════════════════════════

const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Anti-Magnetic Armor';
const ZAEHLER = { key: 'antiMagneticArmorRedirect', max: 1 };

/** Andere gueltige Ziele des Effekts, die der Ruestungsbesitzer kontrolliert. */
function ersatzZiele(engine, ownerIdx, selected, validTargets) {
  return (validTargets || []).filter(t => t && !t.ineligible && t.id !== selected.id
    && engine.zielSeite(t, t.owner) === ownerIdx);
}

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  isBoardRedirect: true,

  canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine) {
    if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
    if (!selected || selected.type !== 'hero') return false;
    // „the equipped Hero": Held derselben Spalte wie die Ruestung.
    if (selected.owner !== inst.owner || selected.heroIdx !== inst.heroIdx) return false;
    if (!engine.isCardEffectActive(inst)) return false;
    // „an opponent's card or effect".
    const quellSeite = sourceCard?.controller ?? sourceCard?.owner;
    if (quellSeite == null || quellSeite < 0 || quellSeite === ownerIdx) return false;
    if (usesLeft(inst, gs, ZAEHLER) <= 0) return false;
    return ersatzZiele(engine, ownerIdx, selected, validTargets).length > 0;
  },

  boardRedirectPrompt(attackerName, selected) {
    return `${selected.cardName} was chosen by ${attackerName}! Make your opponent choose a different target you control instead?`;
  },

  async onBoardRedirect(engine, ownerIdx, inst, selected, validTargets, config, sourceCard) {
    const eligible = ersatzZiele(engine, ownerIdx, selected, validTargets);
    if (eligible.length === 0) return null;

    // Der GEGNER (Quelle des Effekts) waehlt das neue Ziel.
    const oppIdx = sourceCard?.controller ?? sourceCard?.owner ?? (ownerIdx === 0 ? 1 : 0);
    // Auftritt der Ruestung vor der Wahl — der Waehlende soll sehen, warum.
    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: ownerIdx });

    let neu;
    if (eligible.length === 1) {
      neu = eligible[0];
    } else {
      const picked = await engine.promptEffectTarget(oppIdx, eligible, {
        title: CARD_NAME,
        description: `Choose a different target instead of ${selected.cardName}.`,
        confirmLabel: '🧲 Redirect!',
        confirmClass: 'btn-danger',
        cancellable: false,           // Pflicht: „make your opponent choose"
        exclusiveTypes: true,
        maxTotal: 1,
        minRequired: 1,
      });
      const id = Array.isArray(picked) ? picked[0] : null;
      neu = eligible.find(t => t.id === id) || eligible[0];
    }

    spendUse(inst, engine.gs, ZAEHLER);

    for (const t of [selected, neu]) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'anger_mark', owner: t.owner, heroIdx: t.heroIdx,
        zoneSlot: t.type === 'hero' ? -1 : (t.slotIdx ?? -1),
      });
    }
    await engine._delay(600);

    engine.log('anti_magnetic_armor', {
      player: engine.gs.players[ownerIdx]?.username,
      originalTarget: selected.cardName, newTarget: neu.cardName,
      source: sourceCard?.name || null,
    });
    engine.sync();
    return { redirectTo: neu };
  },

  // CPU: die Umleitung annehmen — ein anderes Ziel waehlt der Gegner.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData?.showCardLeft === CARD_NAME) {
      return { confirmed: true };
    }
    return undefined;
  },
};
